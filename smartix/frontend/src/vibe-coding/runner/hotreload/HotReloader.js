/**
 * HotReloader
 * Gère le rechargement à chaud des fichiers modifiés
 */

import EventEmitter from 'events';
import { FileWatcher } from './FileWatcher';
import { CSSStrategy } from './strategies/CSSStrategy';
import { JSStrategy } from './strategies/JSStrategy';
import { HTMLStrategy } from './strategies/HTMLStrategy';

export class HotReloader extends EventEmitter {
  /**
   * Crée une instance de HotReloader
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      enabled: options.enabled !== false,
      port: options.port || 8080,
      reconnectInterval: options.reconnectInterval || 3000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      debounceTime: options.debounceTime || 300,
      ...options
    };

    this.fileWatcher = new FileWatcher(this.options);
    this.strategies = {
      css: new CSSStrategy(this),
      js: new JSStrategy(this),
      jsx: new JSStrategy(this),
      ts: new JSStrategy(this),
      tsx: new JSStrategy(this),
      html: new HTMLStrategy(this),
      htm: new HTMLStrategy(this)
    };

    this.connections = new Map();
    this.pendingUpdates = new Map();
    this.stats = {
      connections: 0,
      reloads: 0,
      errors: 0,
      bytesTransferred: 0
    };

    this._setupListeners();
  }

  /**
   * Configure les écouteurs
   * @private
   */
  _setupListeners() {
    this.fileWatcher.on('file-changed', (data) => {
      this._handleFileChange(data);
    });

    this.fileWatcher.on('file-added', (data) => {
      this.emit('file-added', data);
    });

    this.fileWatcher.on('file-removed', (data) => {
      this.emit('file-removed', data);
    });

    this.fileWatcher.on('error', (error) => {
      this.stats.errors++;
      this.emit('error', error);
    });
  }

  /**
   * Connecte le hot reload pour un projet
   * @param {string} projectId - ID du projet
   * @param {number} port - Port du serveur
   */
  connect(projectId, port = this.options.port) {
    if (this.connections.has(projectId)) {
      return;
    }

    const connection = {
      id: projectId,
      port,
      connected: true,
      reconnectAttempts: 0,
      lastPing: Date.now(),
      startTime: Date.now(),
      files: new Set()
    };

    this.connections.set(projectId, connection);
    this.stats.connections++;

    this._startHeartbeat(projectId);
    this.emit('connected', { projectId, port });
  }

  /**
   * Déconnecte le hot reload d'un projet
   * @param {string} projectId - ID du projet
   */
  disconnect(projectId) {
    const connection = this.connections.get(projectId);
    if (!connection) return;

    connection.connected = false;
    this.connections.delete(projectId);
    
    this.emit('disconnected', { 
      projectId, 
      duration: Date.now() - connection.startTime 
    });
  }

  /**
   * Démarre le heartbeat pour un projet
   * @private
   * @param {string} projectId - ID du projet
   */
  _startHeartbeat(projectId) {
    const interval = setInterval(() => {
      const connection = this.connections.get(projectId);
      if (!connection) {
        clearInterval(interval);
        return;
      }

      // Vérifier la connexion
      const now = Date.now();
      const timeSinceLastPing = now - connection.lastPing;

      if (timeSinceLastPing > 30000) {
        // Connexion perdue, tenter de reconnecter
        this._handleDisconnection(projectId);
      } else {
        // Envoyer un ping
        connection.lastPing = now;
        this.emit('ping', { projectId, timestamp: now });
      }
    }, 15000);

    // Stocker l'intervalle pour nettoyage
    this.connections.get(projectId).heartbeat = interval;
  }

  /**
   * Gère une déconnexion
   * @private
   * @param {string} projectId - ID du projet
   */
  _handleDisconnection(projectId) {
    const connection = this.connections.get(projectId);
    if (!connection) return;

    connection.reconnectAttempts++;

    if (connection.reconnectAttempts > this.options.maxReconnectAttempts) {
      this.disconnect(projectId);
      this.emit('reconnect-failed', { projectId });
      return;
    }

    this.emit('reconnecting', { 
      projectId, 
      attempt: connection.reconnectAttempts 
    });

    setTimeout(() => {
      if (this.connections.has(projectId)) {
        this.connect(projectId, connection.port);
      }
    }, this.options.reconnectInterval * connection.reconnectAttempts);
  }

  /**
   * Gère un changement de fichier
   * @private
   * @param {Object} data - Données du changement
   */
  _handleFileChange(data) {
    const { path, content, oldContent } = data;
    
    // Débouncer les changements multiples
    const timeout = this.pendingUpdates.get(path);
    if (timeout) {
      clearTimeout(timeout);
    }

    this.pendingUpdates.set(path, setTimeout(() => {
      this._applyHotReload(path, content, oldContent);
      this.pendingUpdates.delete(path);
    }, this.options.debounceTime));
  }

  /**
   * Applique le hot reload
   * @private
   * @param {string} path - Chemin du fichier
   * @param {string} content - Nouveau contenu
   * @param {string} oldContent - Ancien contenu
   */
  _applyHotReload(path, content, oldContent) {
    const ext = path.split('.').pop().toLowerCase();
    const strategy = this.strategies[ext];

    if (!strategy) {
      this.emit('unsupported', { path, ext });
      return;
    }

    try {
      const result = strategy.apply(path, content, oldContent);
      
      if (result.success) {
        this.stats.reloads++;
        this.stats.bytesTransferred += content?.length || 0;
        
        this.emit('reloaded', {
          path,
          ext,
          type: result.type,
          duration: result.duration,
          changes: result.changes
        });

        // Notifier toutes les connexions
        this.connections.forEach((connection, projectId) => {
          if (connection.connected) {
            connection.files.add(path);
            this.emit('file-updated', { projectId, path, ...result });
          }
        });
      } else {
        this.stats.errors++;
        this.emit('reload-failed', { path, error: result.error });
      }

    } catch (error) {
      this.stats.errors++;
      this.emit('error', { path, error: error.message });
    }
  }

  /**
   * Surveille un fichier
   * @param {string} projectId - ID du projet
   * @param {string} path - Chemin du fichier
   * @param {string} content - Contenu du fichier
   */
  watchFile(projectId, path, content) {
    this.fileWatcher.watch(projectId, path, content);
  }

  /**
   * Arrête de surveiller un fichier
   * @param {string} projectId - ID du projet
   * @param {string} path - Chemin du fichier
   */
  unwatchFile(projectId, path) {
    this.fileWatcher.unwatch(projectId, path);
  }

  /**
   * Vérifie si le hot reload est actif pour un projet
   * @param {string} projectId - ID du projet
   * @returns {boolean} true si actif
   */
  isActive(projectId) {
    const connection = this.connections.get(projectId);
    return connection ? connection.connected : false;
  }

  /**
   * Récupère les fichiers surveillés pour un projet
   * @param {string} projectId - ID du projet
   * @returns {Array} Liste des fichiers
   */
  getWatchedFiles(projectId) {
    return Array.from(this.connections.get(projectId)?.files || []);
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.connections.size,
      watchedFiles: this.fileWatcher.getWatchedCount(),
      pendingUpdates: this.pendingUpdates.size
    };
  }

  /**
   * Injecte le client de hot reload dans une page
   * @returns {string} Script client
   */
  getClientScript() {
    return `
      // Hot Reload Client
      (function() {
        const socket = new WebSocket('ws://localhost:${this.options.port}');
        
        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          switch(data.type) {
            case 'reload-css':
              reloadCSS(data.path);
              break;
            case 'reload-js':
              reloadJS(data.path);
              break;
            case 'reload-page':
              window.location.reload();
              break;
          }
        };

        function reloadCSS(path) {
          const links = document.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(link => {
            if (link.href.includes(path)) {
              const newLink = document.createElement('link');
              newLink.rel = 'stylesheet';
              newLink.href = path + '?t=' + Date.now();
              link.parentNode.replaceChild(newLink, link);
              console.log('🔁 CSS reloaded:', path);
            }
          });
        }

        function reloadJS(path) {
          const scripts = document.querySelectorAll('script[src]');
          scripts.forEach(script => {
            if (script.src.includes(path)) {
              const newScript = document.createElement('script');
              newScript.src = path + '?t=' + Date.now();
              script.parentNode.replaceChild(newScript, script);
              console.log('🔁 JS reloaded:', path);
            }
          });
        }

        socket.onopen = () => console.log('🔌 Hot Reload connected');
        socket.onclose = () => console.log('🔌 Hot Reload disconnected');
      })();
    `;
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoyer les connexions
    this.connections.forEach((connection, projectId) => {
      if (connection.heartbeat) {
        clearInterval(connection.heartbeat);
      }
    });

    this.connections.clear();
    this.pendingUpdates.clear();
    this.fileWatcher.destroy();
    this.removeAllListeners();
  }
}

export default HotReloader;
