/**
 * CPUCollector
 * Collecte les métriques d'utilisation CPU
 */

import EventEmitter from 'events';

export class CPUCollector extends EventEmitter {
  /**
   * Crée une instance de CPUCollector
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      interval: options.interval || 1000,
      simulate: options.simulate !== false,
      ...options
    };

    this.running = false;
    this.intervalId = null;
    this.history = [];
    this.maxHistory = 100;
    
    // Métriques actuelles
    this.current = {
      usage: 0,
      load: 0,
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
    let value;

    if (this.options.simulate) {
      // Simulation pour le développement
      value = this._simulateCPUUsage();
    } else {
      // TODO: Implémenter la vraie collecte CPU
      value = this._getRealCPUUsage();
    }

    const metric = {
      value,
      load: value, // Pour compatibilité
      timestamp: Date.now()
    };

    this.current = metric;
    this.history.push(metric);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit('metric', { type: 'cpu', ...metric });
  }

  /**
   * Simule l'utilisation CPU
   * @private
   * @returns {number} Utilisation CPU simulée
   */
  _simulateCPUUsage() {
    // Base entre 20 et 60%
    const base = 20 + Math.random() * 40;
    
    // Ajouter des pics aléatoires
    if (Math.random() < 0.1) {
      return Math.min(100, base + 40 + Math.random() * 30);
    }
    
    return Math.round(base * 10) / 10;
  }

  /**
   * Récupère l'utilisation CPU réelle
   * @private
   * @returns {number} Utilisation CPU
   */
  _getRealCPUUsage() {
    // TODO: Implémenter avec performance API ou navigator.hardwareConcurrency
    return this._simulateCPUUsage();
  }

  /**
   * Enregistre une valeur manuellement
   * @param {number} value - Valeur CPU
   */
  record(value) {
    const metric = {
      value,
      load: value,
      timestamp: Date.now()
    };

    this.current = metric;
    this.history.push(metric);
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit('metric', { type: 'cpu', ...metric });
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
  getAverage(duration = 60000) {
    const cutoff = Date.now() - duration;
    const recent = this.history.filter(m => m.timestamp > cutoff);
    
    if (recent.length === 0) return 0;
    
    const sum = recent.reduce((acc, m) => acc + m.value, 0);
    return sum / recent.length;
  }

  /**
   * Obtient le maximum sur une période
   * @param {number} duration - Durée en ms
   * @returns {number} Maximum
   */
  getMax(duration = 60000) {
    const cutoff = Date.now() - duration;
    const recent = this.history.filter(m => m.timestamp > cutoff);
    
    if (recent.length === 0) return 0;
    
    return Math.max(...recent.map(m => m.value));
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
      current: this.current.value,
      average: this.getAverage(60000),
      max: this.getMax(60000)
    };
  }
}

export default CPUCollector;
