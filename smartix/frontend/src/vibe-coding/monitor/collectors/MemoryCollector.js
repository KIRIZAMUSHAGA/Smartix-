/**
 * MemoryCollector
 * Collecte les métriques d'utilisation mémoire
 */

import EventEmitter from 'events';

export class MemoryCollector extends EventEmitter {
  /**
   * Crée une instance de MemoryCollector
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      interval: options.interval || 5000,
      simulate: options.simulate !== false,
      ...options
    };

    this.running = false;
    this.intervalId = null;
    this.history = [];
    this.maxHistory = 100;
    
    this.current = {
      used: 0,
      total: 0,
      percentage: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Démarre la collecte
   */
  start() {
    if (this.running) return;

    this.running = true;
    this._collect();
    
    this.intervalId = setInterval(() => {
      this._collect();
    }, this.options.interval);

    this.emit('started');
  }

  /**
   * Arrête la collecte
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Collecte une métrique
   * @private
   */
  _collect() {
    let used, total;

    if (this.options.simulate) {
      const simulated = this._simulateMemoryUsage();
      used = simulated.used;
      total = simulated.total;
    } else {
      const real = this._getRealMemoryUsage();
      used = real.used;
      total = real.total;
    }

    const metric = {
      used,
      total,
      percentage: (used / total) * 100,
      timestamp: Date.now()
    };

    this.current = metric;
    this.history.push(metric);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit('metric', { type: 'memory', ...metric });
  }

  /**
   * Simule l'utilisation mémoire
   * @private
   * @returns {Object} Métriques simulées
   */
  _simulateMemoryUsage() {
    // Base entre 100 et 300 MB
    const used = 100 + Math.random() * 200;
    const total = 512; // 512 MB simulé
    
    return { used, total };
  }

  /**
   * Récupère l'utilisation mémoire réelle
   * @private
   * @returns {Object} Métriques réelles
   */
  _getRealMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize / (1024 * 1024),
        total: performance.memory.jsHeapSizeLimit / (1024 * 1024)
      };
    }
    
    return this._simulateMemoryUsage();
  }

  /**
   * Enregistre une valeur manuellement
   * @param {number} used - Mémoire utilisée en MB
   * @param {number} total - Mémoire totale en MB
   */
  record(used, total) {
    const metric = {
      used,
      total,
      percentage: (used / total) * 100,
      timestamp: Date.now()
    };

    this.current = metric;
    this.history.push(metric);
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit('metric', { type: 'memory', ...metric });
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
  getHistory(limit = 60) {
    return this.history.slice(-limit);
  }

  /**
   * Obtient la moyenne sur une période
   * @param {number} duration - Durée en ms
   * @returns {number} Moyenne
   */
  getAverage(duration = 300000) { // 5 minutes
    const cutoff = Date.now() - duration;
    const recent = this.history.filter(m => m.timestamp > cutoff);
    
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, m) => acc + m.used, 0);
    return sum / recent.length;
  }

  /**
   * Obtient le pic de mémoire
   * @param {number} duration - Durée en ms
   * @returns {number} Pic
   */
  getPeak(duration = 300000) {
    const cutoff = Date.now() - duration;
    const recent = this.history.filter(m => m.timestamp > cutoff);
    
    if (recent.length === 0) return 0;
    
    return Math.max(...recent.map(m => m.used));
  }

  /**
   * Formate la mémoire en unité lisible
   * @param {number} mb - Mégaoctets
   * @returns {string} Taille formatée
   */
  formatMemory(mb) {
    if (mb < 1024) return `${Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  }

  /**
   * Nettoie l'historique
   */
  clearHistory() {
    this.history = [];
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
      current: this.formatMemory(this.current.used),
      currentPercentage: Math.round(this.current.percentage),
      average: this.formatMemory(this.getAverage()),
      peak: this.formatMemory(this.getPeak())
    };
  }
}

export default MemoryCollector;
