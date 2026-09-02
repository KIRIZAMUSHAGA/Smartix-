/**
 * NetworkCollector
 * Collecte les métriques réseau (latence, taille des requêtes)
 */

import EventEmitter from 'events';

export class NetworkCollector extends EventEmitter {
  /**
   * Crée une instance de NetworkCollector
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      simulate: options.simulate !== false,
      ...options
    };

    this.running = false;
    this.history = [];
    this.maxHistory = 200;
    this.requests = new Map();
    
    this.current = {
      latency: 0,
      size: 0,
      requestsPerMinute: 0,
      timestamp: Date.now()
    };

    this._setupNetworkInterception();
  }

  /**
   * Configure l'interception réseau
   * @private
   */
  _setupNetworkInterception() {
    if (typeof window === 'undefined') return;

    // Intercepter fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      
      try {
        const response = await originalFetch(...args);
        this._recordRequest(args[0], response, startTime);
        return response;
      } catch (error) {
        this._recordError(args[0], error, startTime);
        throw error;
      }
    };

    // Intercepter XHR
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(...args) {
      this._url = args[1];
      this._method = args[0];
      this._startTime = null;
      return originalXHROpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      this._startTime = performance.now();
      
      this.addEventListener('loadend', () => {
        if (this._url && this._startTime) {
          const duration = performance.now() - this._startTime;
          networkCollector.recordRequest({
            url: this._url,
            method: this._method,
            duration,
            status: this.status,
            size: this.getResponseHeader('content-length') || 0
          });
        }
      });

      return originalXHRSend.apply(this, args);
    };
  }

  /**
   * Démarre la collecte
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.emit('started');
  }

  /**
   * Arrête la collecte
   */
  stop() {
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Enregistre une requête
   * @param {string} url - URL
   * @param {Response} response - Réponse
   * @param {number} startTime - Temps de début
   * @private
   */
  _recordRequest(url, response, startTime) {
    const duration = performance.now() - startTime;
    const contentLength = response.headers.get('content-length');
    
    this.recordRequest({
      url: url.url || url,
      method: url.method || 'GET',
      duration,
      status: response.status,
      size: contentLength ? parseInt(contentLength) : 0
    });
  }

  /**
   * Enregistre une erreur réseau
   * @param {string} url - URL
   * @param {Error} error - Erreur
   * @param {number} startTime - Temps de début
   * @private
   */
  _recordError(url, error, startTime) {
    const duration = performance.now() - startTime;
    
    this.emit('error', {
      url: url.url || url,
      duration,
      error: error.message
    });
  }

  /**
   * Enregistre une requête manuellement
   * @param {Object} request - Requête
   */
  recordRequest(request) {
    const metric = {
      url: request.url,
      method: request.method,
      duration: request.duration,
      status: request.status,
      size: request.size,
      timestamp: Date.now()
    };

    this.history.push(metric);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this._updateCurrent();
    this.emit('metric', { type: 'network', ...metric });
  }

  /**
   * Met à jour les métriques courantes
   * @private
   */
  _updateCurrent() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.history.filter(r => r.timestamp > oneMinuteAgo);
    
    const avgLatency = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length
      : 0;

    const totalSize = recentRequests.reduce((sum, r) => sum + r.size, 0);

    this.current = {
      latency: avgLatency,
      size: totalSize,
      requestsPerMinute: recentRequests.length,
      timestamp: now
    };
  }

  /**
   * Obtient la valeur actuelle
   * @returns {Object} Métrique actuelle
   */
  getCurrent() {
    return this.current;
  }

  /**
   * Obtient l'historique
   * @param {number} limit - Nombre de valeurs
   * @returns {Array} Historique
   */
  getHistory(limit = 100) {
    return this.history.slice(-limit);
  }

  /**
   * Obtient la latence moyenne sur une période
   * @param {number} duration - Durée en ms
   * @returns {number} Latence moyenne
   */
  getAverageLatency(duration = 60000) {
    const cutoff = Date.now() - duration;
    const recent = this.history.filter(r => r.timestamp > cutoff);
    
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, r) => acc + r.duration, 0);
    return sum / recent.length;
  }

  /**
   * Obtient le nombre de requêtes par minute
   * @returns {number} Requêtes par minute
   */
  getRequestsPerMinute() {
    return this.current.requestsPerMinute;
  }

  /**
   * Obtient la taille totale transférée
   * @param {number} duration - Durée en ms
   * @returns {number} Taille en bytes
   */
  getTotalSize(duration = 60000) {
    const cutoff = Date.now() - duration;
    const recent = this.history.filter(r => r.timestamp > cutoff);
    
    return recent.reduce((sum, r) => sum + r.size, 0);
  }

  /**
   * Formate la taille en unité lisible
   * @param {number} bytes - Octets
   * @returns {string} Taille formatée
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Nettoie l'historique
   */
  clearHistory() {
    this.history = [];
    this._updateCurrent();
  }

  /**
   * Vérifie si le collecteur tourne
   * @returns {boolean}
   */
  isRunning() {
    return this.running;
  }

  /**
   * Obtient les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      running: this.running,
      samples: this.history.length,
      currentLatency: Math.round(this.current.latency),
      requestsPerMinute: this.current.requestsPerMinute,
      totalSize: this.formatSize(this.getTotalSize()),
      averageLatency: Math.round(this.getAverageLatency())
    };
  }
}

// Instance globale pour l'interception
const networkCollector = new NetworkCollector();
export default networkCollector;
