/**
 * ThresholdAnalyzer
 * Analyse les métriques par rapport aux seuils définis
 */

import { THRESHOLDS, SEVERITY_LEVELS } from '../core/constants';

export class ThresholdAnalyzer {
  /**
   * Crée une instance de ThresholdAnalyzer
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      thresholds: { ...THRESHOLDS, ...options.thresholds },
      strictMode: options.strictMode || false,
      ...options
    };
  }

  /**
   * Analyse les métriques par rapport aux seuils
   * @param {Object} metrics - Métriques actuelles
   * @returns {Array} Alertes générées
   */
  analyze(metrics) {
    const alerts = [];

    // Analyser chaque type de métrique
    Object.entries(metrics).forEach(([type, value]) => {
      const threshold = this.options.thresholds[type];
      if (threshold && value > threshold) {
        alerts.push(this._createAlert(type, value, threshold));
      }
    });

    // Analyses spécifiques
    if (metrics.cpu && metrics.memory) {
      alerts.push(...this._analyzeCombined(metrics));
    }

    return alerts;
  }

  /**
   * Analyse une métrique spécifique
   * @param {string} type - Type de métrique
   * @param {number} value - Valeur
   * @returns {Object|null} Alerte ou null
   */
  analyzeMetric(type, value) {
    const threshold = this.options.thresholds[type];
    if (!threshold) return null;

    if (value > threshold) {
      return this._createAlert(type, value, threshold);
    }

    return null;
  }

  /**
   * Crée une alerte pour dépassement de seuil
   * @private
   * @param {string} type - Type de métrique
   * @param {number} value - Valeur
   * @param {number} threshold - Seuil
   * @returns {Object} Alerte
   */
  _createAlert(type, value, threshold) {
    const severity = this._getSeverity(type, value, threshold);
    const percentage = ((value - threshold) / threshold) * 100;

    return {
      type: 'threshold_crossed',
      metric: type,
      value,
      threshold,
      percentage: Math.round(percentage),
      title: this._getAlertTitle(type, value),
      message: this._getAlertMessage(type, value, threshold),
      severity,
      timestamp: Date.now()
    };
  }

  /**
   * Analyse des métriques combinées
   * @private
   * @param {Object} metrics - Métriques
   * @returns {Array} Alertes combinées
   */
  _analyzeCombined(metrics) {
    const alerts = [];

    // CPU + Mémoire élevés simultanément
    if (metrics.cpu > this.options.thresholds.cpu * 0.8 &&
        metrics.memory > this.options.thresholds.memory * 0.8) {
      alerts.push({
        type: 'combined_high',
        title: 'Ressources critiques',
        message: `CPU (${metrics.cpu}%) et mémoire (${metrics.memory}MB) élevés`,
        severity: SEVERITY_LEVELS.HIGH,
        metrics: { cpu: metrics.cpu, memory: metrics.memory }
      });
    }

    return alerts;
  }

  /**
   * Détermine la sévérité de l'alerte
   * @private
   * @param {string} type - Type de métrique
   * @param {number} value - Valeur
   * @param {number} threshold - Seuil
   * @returns {string} Niveau de sévérité
   */
  _getSeverity(type, value, threshold) {
    const ratio = value / threshold;

    if (ratio > 2) return SEVERITY_LEVELS.CRITICAL;
    if (ratio > 1.5) return SEVERITY_LEVELS.HIGH;
    if (ratio > 1.2) return SEVERITY_LEVELS.MEDIUM;
    return SEVERITY_LEVELS.LOW;
  }

  /**
   * Génère le titre de l'alerte
   * @private
   * @param {string} type - Type de métrique
   * @param {number} value - Valeur
   * @returns {string} Titre
   */
  _getAlertTitle(type, value) {
    const titles = {
      cpu: `CPU élevé (${value}%)`,
      memory: `Mémoire élevée (${value}MB)`,
      responseTime: `Temps de réponse élevé (${value}ms)`,
      errorRate: `Taux d'erreur élevé (${value}/min)`,
      fps: `FPS bas (${value})`
    };

    return titles[type] || `Seuil dépassé: ${type} (${value})`;
  }

  /**
   * Génère le message de l'alerte
   * @private
   * @param {string} type - Type de métrique
   * @param {number} value - Valeur
   * @param {number} threshold - Seuil
   * @returns {string} Message
   */
  _getAlertMessage(type, value, threshold) {
    const messages = {
      cpu: `L'utilisation CPU (${value}%) dépasse le seuil de ${threshold}%`,
      memory: `L'utilisation mémoire (${value}MB) dépasse le seuil de ${threshold}MB`,
      responseTime: `Le temps de réponse (${value}ms) dépasse le seuil de ${threshold}ms`,
      errorRate: `Le taux d'erreur (${value}/min) dépasse le seuil de ${threshold}/min`,
      fps: `Les FPS (${value}) sont inférieurs au seuil de ${threshold}`
    };

    return messages[type] || `La métrique ${type} (${value}) dépasse le seuil de ${threshold}`;
  }

  /**
   * Met à jour un seuil
   * @param {string} type - Type de métrique
   * @param {number} value - Nouveau seuil
   */
  setThreshold(type, value) {
    this.options.thresholds[type] = value;
  }

  /**
   * Récupère tous les seuils
   * @returns {Object} Seuils
   */
  getThresholds() {
    return { ...this.options.thresholds };
  }

  /**
   * Réinitialise aux seuils par défaut
   */
  resetToDefaults() {
    this.options.thresholds = { ...THRESHOLDS };
  }
}

export default ThresholdAnalyzer;
