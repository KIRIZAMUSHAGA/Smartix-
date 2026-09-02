/**
 * MetricsCollector
 * Collecte les métriques de performance (FPS, mémoire, réseau)
 */

import EventEmitter from 'events';

export class MetricsCollector extends EventEmitter {
  /**
   * Crée une instance de MetricsCollector
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = options;
    this.metrics = {
      fps: [],
      memory: [],
      network: [],
      timings: {}
    };
    
    this.collecting = false;
    this.observers = [];
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.rafId = null;
  }

  /**
   * Démarre la collecte des métriques
   */
  start() {
    if (this.collecting) return;
    
    this.collecting = true;
    
    if (this.options.enableFPS) {
      this._startFPSCollection();
    }
    
    if (this.options.enableMemory) {
      this._startMemoryCollection();
    }
    
    if (this.options.enableNetwork) {
      this._startNetworkCollection();
    }
    
    this._startLongTaskObservation();
  }

  /**
   * Arrête la collecte des métriques
   */
  stop() {
    this.collecting = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (e) {
        // Ignorer les erreurs de déconnexion
      }
    });
    
    this.observers = [];
  }

  /**
   * Démarre la collecte des FPS
   * @private
   */
  _startFPSCollection() {
    const measureFPS = () => {
      if (!this.collecting) return;

      this.frameCount++;
      const now = performance.now();
      const delta = now - this.lastFrameTime;

      if (delta >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / delta);
        
        const fpsMetric = {
          timestamp: now,
          value: fps,
          frameCount: this.frameCount,
          delta
        };

        this.metrics.fps.push(fpsMetric);
        
        // Garder seulement les 100 dernières mesures
        if (this.metrics.fps.length > 100) {
          this.metrics.fps.shift();
        }

        this.emit('metrics', { type: 'fps', ...fpsMetric });
        
        this.frameCount = 0;
        this.lastFrameTime = now;
      }

      this.rafId = requestAnimationFrame(measureFPS);
    };

    this.rafId = requestAnimationFrame(measureFPS);
  }

  /**
   * Démarre la collecte de la mémoire
   * @private
   */
  _startMemoryCollection() {
    if (!performance.memory) {
      this.emit('warning', {
        type: 'memory',
        message: 'API mémoire non disponible'
      });
      return;
    }

    const measureMemory = () => {
      if (!this.collecting) return;

      const memory = performance.memory;
      const memoryMetric = {
        timestamp: Date.now(),
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        usage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };

      this.metrics.memory.push(memoryMetric);

      // Garder seulement les 50 dernières mesures
      if (this.metrics.memory.length > 50) {
        this.metrics.memory.shift();
      }

      this.emit('metrics', { type: 'memory', ...memoryMetric });

      setTimeout(measureMemory, 5000);
    };

    setTimeout(measureMemory, 5000);
  }

  /**
   * Démarre la collecte des métriques réseau
   * @private
   */
  _startNetworkCollection() {
    if (!window.PerformanceObserver) {
      this.emit('warning', {
        type: 'network',
        message: 'PerformanceObserver non supporté'
      });
      return;
    }

    try {
      // Observer les ressources réseau
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'resource') {
            this._handleResourceEntry(entry);
          }
        });
      });

      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

      // Observer les repaints
      const paintObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'paint') {
            this._handlePaintEntry(entry);
          }
        });
      });

      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

    } catch (error) {
      this.emit('warning', {
        type: 'network',
        message: `Erreur observation réseau: ${error.message}`
      });
    }
  }

  /**
   * Gère une entrée de ressource réseau
   * @private
   * @param {PerformanceEntry} entry - Entrée de performance
   */
  _handleResourceEntry(entry) {
    const networkMetric = {
      name: entry.name,
      type: entry.initiatorType || 'other',
      duration: entry.duration,
      size: entry.transferSize || 0,
      encodedSize: entry.encodedBodySize,
      decodedSize: entry.decodedBodySize,
      protocol: entry.nextHopProtocol,
      serverTiming: entry.serverTiming,
      timestamp: entry.startTime,
      cache: this._getCacheStatus(entry)
    };

    this.metrics.network.push(networkMetric);

    // Garder seulement les 100 dernières requêtes
    if (this.metrics.network.length > 100) {
      this.metrics.network.shift();
    }

    this.emit('metrics', { type: 'network', ...networkMetric });

    // Alerter si requête lente
    if (entry.duration > 1000) {
      this.emit('warning', {
        type: 'slow-request',
        url: entry.name,
        duration: entry.duration,
        timestamp: entry.startTime
      });
    }
  }

  /**
   * Gère une entrée de paint
   * @private
   * @param {PerformanceEntry} entry - Entrée de performance
   */
  _handlePaintEntry(entry) {
    if (entry.name === 'first-paint') {
      this.metrics.timings.firstPaint = entry.startTime;
    } else if (entry.name === 'first-contentful-paint') {
      this.metrics.timings.firstContentfulPaint = entry.startTime;
    }

    this.emit('metrics', { 
      type: 'paint', 
      name: entry.name, 
      value: entry.startTime 
    });
  }

  /**
   * Démarre l'observation des long tasks
   * @private
   */
  _startLongTaskObservation() {
    if (!window.PerformanceObserver) return;

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'longtask') {
            this.emit('long-task', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
              attribution: entry.attribution
            });
          }
        });
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);

    } catch (error) {
      // Ignorer si les long tasks ne sont pas supportées
    }
  }

  /**
   * Détermine le statut de cache d'une ressource
   * @private
   * @param {PerformanceEntry} entry - Entrée de performance
   * @returns {string} Statut de cache
   */
  _getCacheStatus(entry) {
    if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
      return 'cached';
    }
    if (entry.duration < 10) {
      return 'cache-possible';
    }
    return 'miss';
  }

  /**
   * Récupère les métriques actuelles
   * @returns {Object} Dernières métriques
   */
  getLatest() {
    return {
      fps: this.metrics.fps[this.metrics.fps.length - 1] || null,
      memory: this.metrics.memory[this.metrics.memory.length - 1] || null,
      network: this.metrics.network.slice(-5),
      timings: this.metrics.timings
    };
  }

  /**
   * Récupère l'historique des métriques
   * @returns {Object} Historique des métriques
   */
  getHistory() {
    return { ...this.metrics };
  }

  /**
   * Nettoie l'historique
   */
  clearHistory() {
    this.metrics = {
      fps: [],
      memory: [],
      network: [],
      timings: {}
    };
    this.emit('history-cleared');
  }

  /**
   * Exporte les métriques au format JSON
   * @returns {string} JSON des métriques
   */
  exportMetrics() {
    return JSON.stringify({
      metrics: this.metrics,
      collected: Date.now(),
      options: this.options
    }, null, 2);
  }

  /**
   * Obtient des statistiques sur la collecte
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      fpsSamples: this.metrics.fps.length,
      memorySamples: this.metrics.memory.length,
      networkSamples: this.metrics.network.length,
      hasTimings: Object.keys(this.metrics.timings).length > 0
    };
  }
}

export default MetricsCollector;
