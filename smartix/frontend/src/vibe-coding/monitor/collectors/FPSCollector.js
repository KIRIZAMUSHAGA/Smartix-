/**
 * FPSCollector
 * Collecte les métriques de FPS (images par seconde)
 */

import EventEmitter from 'events';

export class FPSCollector extends EventEmitter {
  /**
   * Crée une instance de FPSCollector
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
    this.rafId = null;
    this.frames = 0;
    this.lastTime = performance.now();
    this.history = [];
    this.maxHistory = 100;
    
    this.current = {
      value: 60,
      timestamp: Date.now()
    };
  }

  /**
   * Démarre la collecte
   */
  start() {
    if (this.running) return;

    this.running = true;
    this.frames = 0;
    this.lastTime = performance.now();
    this._measure();

    this.emit('started');
  }

  /**
   * Arrête la collecte
   */
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Mesure les FPS
   * @private
   */
  _measure() {
    if (!this.running) return;

    this.frames++;
    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      const fps = Math.round((this.frames * 1000) / delta);
      
      const metric = {
        value: fps,
        frames: this.frames,
        delta,
        timestamp: now
      };

      this.current = metric;
      this.history.push(metric);

      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      this.emit('metric', { type: 'fps', ...metric });

      this.frames = 0;
      this.lastTime = now;
    }

    this.rafId = requestAnimationFrame(() => this._measure());
  }

  /**
   * Enregistre une valeur manuellement
   * @param {number} value - Valeur FPS
   */
  record(value) {
    const metric = {
      value,
      frames: 1,
      delta: 1000,
      timestamp: Date.now()
    };

    this.current = metric;
    this.history.push(metric);
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit('metric', { type: 'fps', ...metric });
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
   * Obtient le minimum sur une période
   * @param {number} duration - Durée en ms
   * @returns {number} Minimum
   */
  getMin(duration = 60000) {
    const cutoff = Date.now() - duration;
    const recent = this.history.filter(m => m.timestamp > cutoff);
    
    if (recent.length === 0) return 0;
    
    return Math.min(...recent.map(m => m.value));
  }

  /**
   * Évalue la stabilité des FPS
   * @returns {string} Niveau de stabilité
   */
  getStability() {
    if (this.history.length < 10) return 'unknown';

    const recent = this.history.slice(-10).map(m => m.value);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 3) return 'stable';
    if (stdDev < 8) return 'moderate';
    return 'unstable';
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
      average: Math.round(this.getAverage()),
      min: this.getMin(),
      stability: this.getStability()
    };
  }
}

export default FPSCollector;
