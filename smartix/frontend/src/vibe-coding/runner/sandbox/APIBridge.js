/**
 * APIBridge
 * Gère les APIs exposées au sandbox et leur communication
 */

export class APIBridge {
  /**
   * Crée une instance d'APIBridge
   * @param {SandboxedRunner} runner - Instance du runner parent
   * @param {string[]} allowedApis - Liste des APIs autorisées
   */
  constructor(runner, allowedApis = []) {
    this.runner = runner;
    this.allowedApis = allowedApis;
    this.pendingFetches = new Map();
  }

  /**
   * Génère le code JavaScript de l'API pour le sandbox
   * @returns {string} Code de l'API
   */
  generateAPI() {
    const apis = [];

    // Console API
    if (this.allowedApis.includes('console')) {
      apis.push(this._generateConsoleAPI());
    }

    // Fetch API
    if (this.allowedApis.includes('fetch')) {
      apis.push(this._generateFetchAPI());
    }

    // Timer API
    if (this.allowedApis.includes('timer')) {
      apis.push(this._generateTimerAPI());
    }

    // Storage API (simulée)
    if (this.allowedApis.includes('storage')) {
      apis.push(this._generateStorageAPI());
    }

    // Module API (simulation de require/import)
    if (this.allowedApis.includes('modules')) {
      apis.push(this._generateModuleAPI());
    }

    return apis.join('\n\n');
  }

  /**
   * Génère l'API Console
   * @private
   * @returns {string} Code de l'API Console
   */
  _generateConsoleAPI() {
    return `
      // Console API sécurisée
      window.console = (function() {
        const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
        const consoleObj = {};
        
        methods.forEach(method => {
          consoleObj[method] = (...args) => {
            parent.postMessage({
              type: 'console',
              method,
              args: args.map(arg => {
                try {
                  if (arg instanceof Error) {
                    return { 
                      message: arg.message, 
                      stack: arg.stack,
                      name: arg.name 
                    };
                  }
                  if (typeof arg === 'object') {
                    return JSON.parse(JSON.stringify(arg));
                  }
                  return String(arg);
                } catch {
                  return String(arg);
                }
              })
            }, '*');
          };
        });
        
        return consoleObj;
      })();
    `;
  }

  /**
   * Génère l'API Fetch
   * @private
   * @returns {string} Code de l'API Fetch
   */
  _generateFetchAPI() {
    return `
      // Fetch API contrôlée
      window.fetch = async (...args) => {
        const id = Math.random().toString(36) + Date.now().toString(36);
        
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('Fetch timeout'));
          }, 30000);

          const handler = (event) => {
            if (event.data.type === 'fetch-response' && event.data.id === id) {
              clearTimeout(timeout);
              window.removeEventListener('message', handler);
              
              if (event.data.error) {
                reject(new Error(event.data.error));
              } else {
                const response = new Response(event.data.data, {
                  status: event.data.status || 200,
                  statusText: event.data.statusText || 'OK',
                  headers: new Headers(event.data.headers || {})
                });
                
                // Ajouter les méthodes pratiques
                response.json = () => JSON.parse(event.data.data);
                response.text = () => event.data.data;
                
                resolve(response);
              }
            }
          };
          
          window.addEventListener('message', handler);
          
          parent.postMessage({
            type: 'fetch',
            id,
            args: args.map(arg => {
              if (arg instanceof Request) {
                return {
                  url: arg.url,
                  method: arg.method,
                  headers: Array.from(arg.headers.entries()),
                  body: arg.body
                };
              }
              return arg;
            })
          }, '*');
        });
      };

      // Headers polyfill
      if (!window.Headers) {
        window.Headers = class Headers {
          constructor(init) {
            this._headers = new Map();
            if (init) {
              Object.entries(init).forEach(([key, value]) => {
                this.set(key, value);
              });
            }
          }
          append(name, value) { this._headers.set(name.toLowerCase(), value); }
          delete(name) { this._headers.delete(name.toLowerCase()); }
          get(name) { return this._headers.get(name.toLowerCase()); }
          has(name) { return this._headers.has(name.toLowerCase()); }
          set(name, value) { this._headers.set(name.toLowerCase(), value); }
          forEach(callback) { this._headers.forEach(callback); }
        };
      }

      // Response polyfill
      if (!window.Response) {
        window.Response = class Response {
          constructor(body, init = {}) {
            this.body = body;
            this.status = init.status || 200;
            this.statusText = init.statusText || 'OK';
            this.headers = new Headers(init.headers || {});
            this.ok = this.status >= 200 && this.status < 300;
          }
          async json() { return JSON.parse(this.body); }
          async text() { return this.body; }
          async blob() { return new Blob([this.body]); }
        };
      }
    `;
  }

  /**
   * Génère l'API Timer
   * @private
   * @returns {string} Code de l'API Timer
   */
  _generateTimerAPI() {
    return `
      // Timer API
      (function() {
        const timers = new Map();
        
        window.setTimeout = (fn, delay) => {
          const id = Date.now() + Math.random();
          timers.set(id, { fn, delay, type: 'timeout' });
          
          parent.postMessage({
            type: 'timer',
            action: 'set',
            id,
            delay,
            type: 'timeout'
          }, '*');
          
          return id;
        };

        window.setInterval = (fn, interval) => {
          const id = Date.now() + Math.random();
          timers.set(id, { fn, interval, type: 'interval' });
          
          parent.postMessage({
            type: 'timer',
            action: 'set',
            id,
            interval,
            type: 'interval'
          }, '*');
          
          return id;
        };

        window.clearTimeout = (id) => {
          timers.delete(id);
          parent.postMessage({ type: 'timer', action: 'clear', id }, '*');
        };

        window.clearInterval = window.clearTimeout;

        // Fonction interne pour exécuter les timers (appelée par le parent)
        window.__executeTimer = (id) => {
          const timer = timers.get(id);
          if (timer) {
            timer.fn();
            if (timer.type === 'timeout') {
              timers.delete(id);
            }
          }
        };
      })();
    `;
  }

  /**
   * Génère l'API Storage (localStorage/sessionStorage simulé)
   * @private
   * @returns {string} Code de l'API Storage
   */
  _generateStorageAPI() {
    return `
      // Storage API simulée
      (function() {
        class SandboxStorage {
          constructor(prefix) {
            this.prefix = prefix;
            this._data = new Map();
          }

          get length() { return this._data.size; }

          key(index) {
            const keys = Array.from(this._data.keys());
            return keys[index] || null;
          }

          getItem(key) {
            return this._data.get(key) || null;
          }

          setItem(key, value) {
            this._data.set(key, String(value));
            parent.postMessage({
              type: 'storage',
              action: 'set',
              storage: this.prefix,
              key,
              value: String(value)
            }, '*');
          }

          removeItem(key) {
            this._data.delete(key);
            parent.postMessage({
              type: 'storage',
              action: 'remove',
              storage: this.prefix,
              key
            }, '*');
          }

          clear() {
            this._data.clear();
            parent.postMessage({
              type: 'storage',
              action: 'clear',
              storage: this.prefix
            }, '*');
          }
        }

        window.localStorage = new SandboxStorage('local');
        window.sessionStorage = new SandboxStorage('session');
      })();
    `;
  }

  /**
   * Génère l'API Modules (simulation de require/import)
   * @private
   * @returns {string} Code de l'API Modules
   */
  _generateModuleAPI() {
    return `
      // Module API
      window.require = (moduleName) => {
        const modules = {
          'react': window.React,
          'react-dom': window.ReactDOM,
          'vue': window.Vue,
          'axios': window.axios,
          'lodash': window._,
          'moment': window.moment
        };
        
        if (modules[moduleName]) {
          return modules[moduleName];
        }
        
        throw new Error(\`Module non supporté: \${moduleName}\`);
      };

      // Simple systeme de modules
      window.define = (name, deps, factory) => {
        if (typeof name !== 'string') {
          factory = deps;
          deps = name;
          name = null;
        }
        
        if (typeof deps === 'function') {
          factory = deps;
          deps = [];
        }
        
        const exports = {};
        const module = { exports };
        
        const resolvedDeps = deps.map(dep => {
          if (dep === 'exports') return exports;
          if (dep === 'module') return module;
          return window.require(dep);
        });
        
        const result = factory(...resolvedDeps);
        
        if (name) {
          window[name] = result || module.exports;
        }
        
        return result || module.exports;
      };
    `;
  }

  /**
   * Gère une requête fetch depuis le sandbox
   * @param {Object} data - Données de la requête
   */
  async handleFetch({ id, args }) {
    try {
      const [url, options = {}] = args;
      
      // Effectuer la vraie requête fetch
      const response = await fetch(url, options);
      
      // Lire la réponse
      const data = await response.text();
      
      // Renvoyer au sandbox
      this.runner.iframe.contentWindow.postMessage({
        type: 'fetch-response',
        id,
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      }, '*');

    } catch (error) {
      this.runner.iframe.contentWindow.postMessage({
        type: 'fetch-response',
        id,
        error: error.message
      }, '*');
    }
  }
}

export default APIBridge;
