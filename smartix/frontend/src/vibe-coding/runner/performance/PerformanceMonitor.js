/**
 * PerformanceMonitor
 * Surveille les performances de l'application (FPS, mémoire, réseau)
 */

import EventEmitter from 'events';
import { MetricsCollector } from './MetricsCollector';

export class PerformanceMonitor extends EventEmitter {
  /**
   * Crée une instance de PerformanceMonitor
   * @param {Object} options - Options de configuration
   * @param {number} options.interval - Intervalle de collecte des métriques (ms)
   * @param {boolean} options.enableFPS - Activer la surveillance FPS
   * @param {boolean} options.enableMemory - Activer la surveillance mémoire
   * @param {boolean} options.enableNetwork - Activer la surveillance réseau
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      interval: options.interval || 1000,
      enableFPS: options.enableFPS !== false,
      enableMemory: options.enableMemory !== false,
      enableNetwork: options.enableNetwork !== false,
      fpsWarningThreshold: options.fpsWarningThreshold || 30,
      memoryWarningThreshold: options.memoryWarningThreshold || 80,
      ...options
    };

    this.metricsCollector = new MetricsCollector(this.options);
    this.monitoring = false;
    this.intervalId = null;
    this.warnings = [];
    this.longTasks = [];
    
    this._setupListeners();
  }

  /**
   * Configure les écouteurs internes
   * @private
   */
  _setupListeners() {
    // Écouter les métriques collectées
    this.metricsCollector.on('metrics', (metrics) => {
      this._processMetrics(metrics);
    });

    this.metricsCollector.on('long-task', (task) => {
      this._handleLongTask(task);
    });

    this.metricsCollector.on('warning', (warning) => {
      this._handleWarning(warning);
    });
  }

  /**
   * Démarre la surveillance
   */
  start() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.metricsCollector.start();
    
    // Émettre les métriques périodiquement
    this.intervalId = setInterval(() => {
      if (this.monitoring) {
        const metrics = this.getCurrentMetrics();
        this.emit('metrics-update', metrics);
      }
    }, this.options.interval);

    this.emit('started');
  }

  /**
   * Arrête la surveillance
   */
  stop() {
    this.monitoring = false;
    this.metricsCollector.stop();
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('stopped');
  }

  /**
   * Traite les métriques collectées
   * @private
   * @param {Object} metrics - Métriques collectées
   */
  _processMetrics(metrics) {
    // Vérifier les seuils d'avertissement
    if (metrics.fps && metrics.fps.current < this.options.fpsWarningThreshold) {
      this._addWarning({
        type: 'fps',
        value: metrics.fps.current,
        threshold: this.options.fpsWarningThreshold,
        timestamp: Date.now()
      });
    }

    if (metrics.memory && metrics.memory.percentage > this.options.memoryWarningThreshold) {
      this._addWarning({
        type: 'memory',
        value: metrics.memory.percentage,
        threshold: this.options.memoryWarningThreshold,
        timestamp: Date.now()
      });
    }

    this.emit('metrics', metrics);
  }

  /**
   * Gère une longue tâche
   * @private
   * @param {Object} task - Données de la tâche longue
   */
  _handleLongTask(task) {
    this.longTasks.push({
      ...task,
      timestamp: Date.now()
    });

    // Garder seulement les 50 dernières tâches longues
    if (this.longTasks.length > 50) {
      this.longTasks.shift();
    }

    this.emit('long-task', task);
  }

  /**
   * Gère un avertissement
   * @private
   * @param {Object} warning - Données de l'avertissement
   */
  _handleWarning(warning) {
    this.warnings.push({
      ...warning,
      timestamp: Date.now()
    });

    // Garder seulement les 100 derniers avertissements
    if (this.warnings.length > 100) {
      this.warnings.shift();
    }

    this.emit('warning', warning);
  }

  /**
   * Ajoute un avertissement manuellement
   * @private
   * @param {Object} warning - Avertissement à ajouter
   */
  _addWarning(warning) {
    this.warnings.push(warning);
    this.emit('warning', warning);
    
    // Émettre également un événement spécifique
    this.emit(`warning:${warning.type}`, warning);
  }

  /**
   * Récupère les métriques actuelles
   * @returns {Object} Métriques actuelles
   */
  getCurrentMetrics() {
    return this.metricsCollector.getLatest();
  }

  /**
   * Récupère un rapport complet
   * @returns {Object} Rapport de performance
   */
  getReport() {
    const metrics = this.metricsCollector.getHistory();
    
    return {
      current: this.getCurrentMetrics(),
      history: {
        fps: metrics.fps.slice(-60), // Dernière minute
        memory: metrics.memory.slice(-12), // Dernière minute (toutes les 5s)
        network: metrics.network
      },
      warnings: this.warnings.slice(-10),
      longTasks: this.longTasks.slice(-5),
      stats: this._calculateStats(metrics)
    };
  }

  /**
   * Calcule des statistiques sur les métriques
   * @private
   * @param {Object} metrics - Historique des métriques
   * @returns {Object} Statistiques calculées
   */
  _calculateStats(metrics) {
    const stats = {};

    // Statistiques FPS
    if (metrics.fps.length > 0) {
      const fpsValues = metrics.fps.map(m => m.value);
      stats.fps = {
        min: Math.min(...fpsValues),
        max: Math.max(...fpsValues),
        avg: this._average(fpsValues),
        p95: this._percentile(fpsValues, 95),
        stability: this._calculateStability(fpsValues)
      };
    }

    // Statistiques mémoire
    if (metrics.memory.length > 0) {
      const memValues = metrics.memory.map(m => m.percentage);
      stats.memory = {
        min: Math.min(...memValues),
        max: Math.max(...memValues),
        avg: this._average(memValues),
        peak: Math.max(...memValues),
        trend: this._calculateTrend(memValues)
      };
    }

    // Statistiques réseau
    if (metrics.network.length > 0) {
      const durations = metrics.network.map(r => r.duration).filter(Boolean);
      const sizes = metrics.network.map(r => r.size).filter(Boolean);
      
      stats.network = {
        totalRequests: metrics.network.length,
        totalSize: sizes.reduce((a, b) => a + b, 0),
        avgLatency: this._average(durations),
        maxLatency: Math.max(...durations, 0),
        byType: this._groupBy(metrics.network, 'type')
      };
    }

    return stats;
  }

  /**
   * Calcule la moyenne d'un tableau
   * @private
   * @param {number[]} arr - Tableau de nombres
   * @returns {number} Moyenne
   */
  _average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Calcule un percentile
   * @private
   * @param {number[]} arr - Tableau de nombres
   * @param {number} p - Percentile (0-100)
   * @returns {number} Valeur au percentile
   */
  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Calcule la stabilité (inverse de la variance)
   * @private
   * @param {number[]} arr - Tableau de nombres
   * @returns {number} Score de stabilité (0-1)
   */
  _calculateStability(arr) {
    if (arr.length < 2) return 1;
    const mean = this._average(arr);
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
    const maxVariance = Math.pow(mean, 2); // Variance maximale théorique
    return Math.max(0, 1 - (variance / maxVariance));
  }

  /**
   * Calcule la tendance (croissante/décroissante)
   * @private
   * @param {number[]} arr - Tableau de nombres
   * @returns {string} Tendance ('up', 'down', 'stable')
   */
  _calculateTrend(arr) {
    if (arr.length < 5) return 'stable';
    
    const first = this._average(arr.slice(0, 3));
    const last = this._average(arr.slice(-3));
    const diff = last - first;
    
    if (Math.abs(diff) < first * 0.05) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  /**
   * Groupe un tableau par propriété
   * @private
   * @param {Object[]} arr - Tableau d'objets
   * @param {string} prop - Propriété de groupement
   * @returns {Object} Objet groupé
   */
  _groupBy(arr, prop) {
    return arr.reduce((acc, item) => {
      const key = item[prop] || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Réinitialise les avertissements
   */
  clearWarnings() {
    this.warnings = [];
    this.longTasks = [];
    this.emit('warnings-cleared');
  }

  /**
   * Vérifie si la surveillance est active
   * @returns {boolean} true si active
   */
  isMonitoring() {
    return this.monitoring;
  }

  /**
   * Obtient des informations sur le moniteur
   * @returns {Object} Informations
   */
  getInfo() {
    return {
      monitoring: this.monitoring,
      warningsCount: this.warnings.length,
      longTasksCount: this.longTasks.length,
      options: this.options
    };
  }
}

export default PerformanceMonitor;
