/**
 * Sandboxed Runner
 * Exécute du code JavaScript dans un environnement isolé (iframe)
 * avec une API contrôlée et sécurisée
 */

import EventEmitter from 'events';
import { APIBridge } from './APIBridge';
import { ConsoleCapture } from './ConsoleCapture';

export class SandboxedRunner extends EventEmitter {
  /**
   * Crée une instance de SandboxedRunner
   * @param {Object} options - Options de configuration
   * @param {number} options.timeout - Timeout maximum pour l'exécution (ms)
   * @param {string[]} options.allowedApis - Liste des APIs autorisées
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      timeout: options.timeout || 5000,
      allowedApis: options.allowedApis || ['console', 'fetch', 'timer'],
      ...options
    };
    
    this.iframe = null;
    this.ready = false;
    this.messageQueue = [];
    this.executionCounter = 0;
    this.pendingExecutions = new Map();
    
    // Initialiser les bridges
    this.apiBridge = new APIBridge(this, this.options.allowedApis);
    this.consoleCapture = new ConsoleCapture(this);
    
    // Bind des méthodes
    this._handleMessage = this._handleMessage.bind(this);
  }

  /**
   * Initialise le sandbox (crée l'iframe)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.iframe) {
      throw new Error('Sandbox déjà initialisé');
    }

    return new Promise((resolve, reject) => {
      try {
        // Créer l'iframe sandboxé
        this.iframe = document.createElement('iframe');
        this.iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-modals';
        this.iframe.style.display = 'none';
        this.iframe.setAttribute('aria-hidden', 'true');
        
        // Timeout d'initialisation
        const initTimeout = setTimeout(() => {
          reject(new Error('Timeout initialisation sandbox'));
        }, this.options.timeout);

        this.iframe.onload = () => {
          clearTimeout(initTimeout);
          this._injectAPI();
          this.ready = true;
          this._processQueue();
          this.emit('ready');
          resolve();
        };

        this.iframe.onerror = (error) => {
          clearTimeout(initTimeout);
          reject(error);
        };

        // Contenu HTML de base
        this.iframe.srcdoc = this._generateSandboxHTML();

        document.body.appendChild(this.iframe);
        
        // Écouter les messages du sandbox
        window.addEventListener('message', this._handleMessage);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Génère le HTML de base pour le sandbox
   * @private
   * @returns {string} HTML du sandbox
   */
  _generateSandboxHTML() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; background: #1e1e1e; color: #d4d4d4; }
            #root { min-height: 100vh; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script>
            // Le script d'API sera injecté ici
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Injecte l'API contrôlée dans le sandbox
   * @private
   */
  _injectAPI() {
    if (!this.iframe || !this.iframe.contentWindow) {
      throw new Error('Iframe non disponible');
    }

    // Générer l'API via le bridge
    const apiCode = this.apiBridge.generateAPI();
    
    try {
      this.iframe.contentWindow.eval(apiCode);
      
      // Injecter également quelques polyfills de base
      this.iframe.contentWindow.eval(`
        // Polyfill pour structuredClone si nécessaire
        if (!window.structuredClone) {
          window.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
        }
        
        // Gestionnaire d'erreurs global
        window.addEventListener('error', (event) => {
          parent.postMessage({
            type: 'error',
            error: event.error?.message || String(event.error),
            stack: event.error?.stack,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }, '*');
        });

        window.addEventListener('unhandledrejection', (event) => {
          parent.postMessage({
            type: 'error',
            error: event.reason?.message || String(event.reason),
            stack: event.reason?.stack,
            type: 'unhandled-rejection'
          }, '*');
        });
      `);

    } catch (error) {
      this.emit('error', {
        error: error.message,
        stack: error.stack,
        phase: 'api-injection'
      });
    }
  }

  /**
   * Gère les messages venant du sandbox
   * @private
   * @param {MessageEvent} event - Événement message
   */
  _handleMessage(event) {
    // Vérifier que le message vient bien de notre iframe
    if (event.source !== this.iframe?.contentWindow) {
      return;
    }

    const { type, id, ...data } = event.data;

    switch (type) {
      case 'console':
        this.consoleCapture.handle(data);
        break;

      case 'fetch':
        this.apiBridge.handleFetch({ id, ...data });
        break;

      case 'fetch-response':
        // Réponse à une requête fetch
        const pending = this.pendingExecutions.get(id);
        if (pending) {
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data);
          }
          this.pendingExecutions.delete(id);
        }
        break;

      case 'timer':
        this.emit('timer', data);
        break;

      case 'error':
        this.emit('error', {
          error: data.error,
          stack: data.stack,
          filename: data.filename,
          lineno: data.lineno,
          colno: data.colno
        });
        break;

      case 'ready':
        this.emit('sandbox-ready');
        break;

      case 'result':
        // Résultat d'exécution synchrone
        const execution = this.pendingExecutions.get(id);
        if (execution) {
          if (data.error) {
            execution.reject(new Error(data.error));
          } else {
            execution.resolve(data.result);
          }
          this.pendingExecutions.delete(id);
        }
        break;

      default:
        console.warn('Message inconnu du sandbox:', type, data);
    }
  }

  /**
   * Exécute du code dans le sandbox
   * @param {string} code - Code JavaScript à exécuter
   * @param {Object} options - Options d'exécution
   * @param {boolean} options.async - Si true, retourne une promesse
   * @param {number} options.timeout - Timeout personnalisé
   * @returns {Promise<Object>} Résultat de l'exécution
   */
  async execute(code, options = {}) {
    if (!this.ready) {
      // Mettre en queue si pas prêt
      return new Promise((resolve) => {
        this.messageQueue.push({ code, options, resolve });
      });
    }

    const executionId = `exec_${Date.now()}_${this.executionCounter++}`;
    const timeout = options.timeout || this.options.timeout;

    return new Promise((resolve, reject) => {
      // Timeout
      const timeoutId = setTimeout(() => {
        this.pendingExecutions.delete(executionId);
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      // Enregistrer la promesse en attente
      this.pendingExecutions.set(executionId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve({ success: true, result });
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          resolve({ success: false, error: error.message });
        }
      });

      try {
        // Envoyer le code à exécuter
        const wrappedCode = `
          (function() {
            try {
              const result = ${code};
              if (result && typeof result.then === 'function') {
                result.then(
                  value => parent.postMessage({ 
                    type: 'result', 
                    id: '${executionId}', 
                    result: value 
                  }, '*'),
                  error => parent.postMessage({ 
                    type: 'result', 
                    id: '${executionId}', 
                    error: error.message 
                  }, '*')
                );
              } else {
                parent.postMessage({ 
                  type: 'result', 
                  id: '${executionId}', 
                  result 
                }, '*');
              }
            } catch (error) {
              parent.postMessage({ 
                type: 'result', 
                id: '${executionId}', 
                error: error.message 
              }, '*');
            }
          })();
        `;

        this.iframe.contentWindow.eval(wrappedCode);

      } catch (error) {
        this.pendingExecutions.delete(executionId);
        clearTimeout(timeoutId);
        resolve({ 
          success: false, 
          error: `Erreur d'exécution: ${error.message}` 
        });
      }
    });
  }

  /**
   * Évalue une expression et retourne le résultat immédiat
   * @param {string} expression - Expression à évaluer
   * @returns {any} Résultat de l'évaluation
   */
  evaluate(expression) {
    if (!this.ready || !this.iframe?.contentWindow) {
      throw new Error('Sandbox non prêt');
    }

    try {
      return this.iframe.contentWindow.eval(expression);
    } catch (error) {
      throw new Error(`Erreur d'évaluation: ${error.message}`);
    }
  }

  /**
   * Injecte une variable globale dans le sandbox
   * @param {string} name - Nom de la variable
   * @param {any} value - Valeur
   */
  injectGlobal(name, value) {
    if (!this.ready || !this.iframe?.contentWindow) {
      throw new Error('Sandbox non prêt');
    }

    try {
      const serialized = JSON.stringify(value);
      this.iframe.contentWindow.eval(`window.${name} = ${serialized};`);
    } catch (error) {
      throw new Error(`Erreur injection globale: ${error.message}`);
    }
  }

  /**
   * Réinitialise le sandbox (supprime toutes les variables)
   */
  reset() {
    if (!this.iframe?.contentWindow) return;

    try {
      this.iframe.contentWindow.eval(`
        // Nettoyer le window object
        for (const prop in window) {
          if (window.hasOwnProperty(prop) && 
              !prop.startsWith('_') && 
              prop !== 'console' && 
              prop !== 'parent') {
            delete window[prop];
          }
        }
        
        // Réinitialiser le DOM
        document.body.innerHTML = '<div id="root"></div>';
      `);

      // Réinjecter l'API
      this._injectAPI();

      this.emit('reset');

    } catch (error) {
      this.emit('error', {
        error: error.message,
        phase: 'reset'
      });
    }
  }

  /**
   * Vérifie si le sandbox est prêt
   * @returns {boolean}
   */
  isReady() {
    return this.ready && this.iframe !== null;
  }

  /**
   * Obtient des informations sur le sandbox
   * @returns {Object} Informations
   */
  getInfo() {
    return {
      ready: this.ready,
      pendingExecutions: this.pendingExecutions.size,
      queuedMessages: this.messageQueue.length,
      allowedApis: this.options.allowedApis,
      userAgent: this.iframe?.contentWindow?.navigator?.userAgent || 'unknown'
    };
  }

  /**
   * Traite la file d'attente
   * @private
   */
  _processQueue() {
    while (this.messageQueue.length > 0) {
      const { code, options, resolve } = this.messageQueue.shift();
      resolve(this.execute(code, options));
    }
  }

  /**
   * Nettoie les ressources et détruit le sandbox
   */
  destroy() {
    // Nettoyer les exécutions en attente
    this.pendingExecutions.forEach((_, id) => {
      this.pendingExecutions.delete(id);
    });

    // Nettoyer la file d'attente
    this.messageQueue = [];

    // Retirer l'écouteur d'événements
    window.removeEventListener('message', this._handleMessage);

    // Supprimer l'iframe
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }

    this.iframe = null;
    this.ready = false;

    this.emit('destroyed');
  }
}

export default SandboxedRunner;
