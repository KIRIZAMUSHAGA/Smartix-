/**
 * ErrorCapture
 * Capture et gère les erreurs globales de l'application
 */

import EventEmitter from 'events';

export class ErrorCapture extends EventEmitter {
  /**
   * Crée une instance de ErrorCapture
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      maxErrors: options.maxErrors || 100,
      captureConsole: options.captureConsole !== false,
      captureUnhandled: options.captureUnhandled !== false,
      captureNetwork: options.captureNetwork !== false,
      ...options
    };

    this.errors = [];
    this.originalConsoleError = null;
    this.ignoredPatterns = [
      /ResizeObserver/i,
      /NetworkError/i,
      /AbortError/i
    ];

    this._setupGlobalHandlers();
  }

  /**
   * Configure les gestionnaires globaux d'erreurs
   * @private
   */
  _setupGlobalHandlers() {
    // Erreurs non catchées
    if (this.options.captureUnhandled) {
      window.addEventListener('error', this._handleGlobalError.bind(this));
      window.addEventListener('unhandledrejection', this._handleUnhandledRejection.bind(this));
    }

    // Erreurs console
    if (this.options.captureConsole) {
      this._captureConsoleErrors();
    }

    // Erreurs réseau
    if (this.options.captureNetwork) {
      this._captureNetworkErrors();
    }
  }

  /**
   * Capture les erreurs globales
   * @private
   * @param {ErrorEvent} event - Événement d'erreur
   */
  _handleGlobalError(event) {
    const error = {
      type: 'uncaught',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: Date.now()
    };

    if (!this._shouldIgnore(error)) {
      this.capture(error);
    }
  }

  /**
   * Capture les promesses non gérées
   * @private
   * @param {PromiseRejectionEvent} event - Événement de rejet
   */
  _handleUnhandledRejection(event) {
    const error = {
      type: 'unhandled-rejection',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      reason: event.reason,
      timestamp: Date.now()
    };

    if (!this._shouldIgnore(error)) {
      this.capture(error);
    }
  }

  /**
   * Capture les erreurs console.error
   * @private
   */
  _captureConsoleErrors() {
    this.originalConsoleError = console.error;
    
    console.error = (...args) => {
      // Appeler l'original
      this.originalConsoleError.apply(console, args);

      // Capturer l'erreur
      const error = {
        type: 'console',
        message: args.map(arg => String(arg)).join(' '),
        args: args,
        timestamp: Date.now()
      };

      if (!this._shouldIgnore(error)) {
        this.capture(error);
      }
    };
  }

  /**
   * Capture les erreurs réseau
   * @private
   */
  _captureNetworkErrors() {
    const self = this;

    this._originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await self._originalFetch(...args);

        if (!response.ok) {
          self.capture({
            type: 'network',
            subType: 'http-error',
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            timestamp: Date.now()
          });
        }

        return response;
      } catch (error) {
        self.capture({
          type: 'network',
          subType: 'network-error',
          url: args[0],
          message: error.message,
          timestamp: Date.now()
        });
        throw error;
      }
    };

    // Capturer les erreurs XHR
    this._originalXHROpen = XMLHttpRequest.prototype.open;
    this._originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(...args) {
      this._url = args[1];
      this._method = args[0];
      return self._originalXHROpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      xhr.addEventListener('error', () => {
        self.capture({
          type: 'network',
          subType: 'xhr-error',
          url: xhr._url,
          method: xhr._method,
          timestamp: Date.now()
        });
      });

      xhr.addEventListener('timeout', () => {
        self.capture({
          type: 'network',
          subType: 'xhr-timeout',
          url: xhr._url,
          method: xhr._method,
          timestamp: Date.now()
        });
      });

      return self._originalXHRSend.apply(this, args);
    };
  }

  /**
   * Capture une erreur manuellement
   * @param {Object|Error} error - Erreur à capturer
   * @param {Object} context - Contexte supplémentaire
   * @returns {Object} Erreur capturée
   */
  capture(error, context = {}) {
    // Si c'est un objet Error, le normaliser
    if (error instanceof Error) {
      error = {
        type: 'error-object',
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...context
      };
    }

    // Ajouter un ID unique
    const errorEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...error,
      timestamp: error.timestamp || Date.now(),
      context
    };

    // Vérifier si on doit ignorer
    if (this._shouldIgnore(errorEntry)) {
      return null;
    }

    // Ajouter à l'historique
    this.errors.push(errorEntry);

    // Limiter la taille
    if (this.errors.length > this.options.maxErrors) {
      this.errors.shift();
    }

    // Émettre l'événement
    this.emit('captured', errorEntry);

    return errorEntry;
  }

  /**
   * Vérifie si une erreur doit être ignorée
   * @private
   * @param {Object} error - Erreur à vérifier
   * @returns {boolean} true si doit être ignorée
   */
  _shouldIgnore(error) {
    const message = error.message || '';
    
    return this.ignoredPatterns.some(pattern => 
      pattern.test(message)
    );
  }

  /**
   * Ajoute un pattern à ignorer
   * @param {RegExp} pattern - Pattern à ignorer
   */
  addIgnoredPattern(pattern) {
    this.ignoredPatterns.push(pattern);
  }

  /**
   * Récupère toutes les erreurs capturées
   * @param {Object} options - Options de filtrage
   * @returns {Array} Liste des erreurs
   */
  getErrors(options = {}) {
    let filtered = [...this.errors];

    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }

    if (options.since) {
      filtered = filtered.filter(e => e.timestamp > options.since);
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Récupère un rapport d'erreurs
   * @returns {Object} Rapport d'erreurs
   */
  getReport() {
    const byType = {};
    const byHour = {};

    this.errors.forEach(error => {
      // Par type
      byType[error.type] = (byType[error.type] || 0) + 1;

      // Par heure
      const hour = new Date(error.timestamp).toISOString().slice(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    return {
      total: this.errors.length,
      byType,
      byHour,
      lastError: this.errors[this.errors.length - 1],
      recentErrors: this.errors.slice(-5)
    };
  }

  /**
   * Efface toutes les erreurs
   */
  clear() {
    this.errors = [];
    this.emit('cleared');
  }

  /**
   * Restaure tous les patches globaux (console, fetch, XHR)
   */
  restore() {
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
    }
    if (this._originalFetch) {
      window.fetch = this._originalFetch;
      this._originalFetch = null;
    }
    if (this._originalXHROpen) {
      XMLHttpRequest.prototype.open = this._originalXHROpen;
      this._originalXHROpen = null;
    }
    if (this._originalXHRSend) {
      XMLHttpRequest.prototype.send = this._originalXHRSend;
      this._originalXHRSend = null;
    }
  }

  /**
   * Restaure la console originale (alias de restore() pour compatibilité)
   */
  restoreConsole() {
    this.restore();
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.restore();
    this.removeAllListeners();
    this.errors = [];
  }
}

export default ErrorCapture;
