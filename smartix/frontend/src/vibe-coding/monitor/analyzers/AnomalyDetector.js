/**
 * AnomalyDetector
 * Détecte les anomalies dans les métriques
 */

import { SEVERITY_LEVELS, ANOMALY_TYPES } from '../core/constants';

export class AnomalyDetector {
  /**
   * Crée une instance de AnomalyDetector
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      sensitivity: options.sensitivity || 2.5, // Écarts-types
      minSamples: options.minSamples || 30,
      enableML: options.enableML || false,
      ...options
    };

    this.models = new Map();
    this.baselines = new Map();
  }

  /**
   * Analyse les anomalies dans les métriques
   * @param {Object} history - Historique des métriques
   * @returns {Array} Anomalies détectées
   */
  analyze(history) {
    const anomalies = [];

    Object.entries(history).forEach(([type, samples]) => {
      if (samples.length >= this.options.minSamples) {
        const detected = this._detectAnomalies(type, samples);
        anomalies.push(...detected);
      }
    });

    return anomalies;
  }

  /**
   * Détecte les anomalies dans une série
   * @private
   * @param {string} type - Type de métrique
   * @param {Array} samples - Échantillons
   * @returns {Array} Anomalies
   */
  _detectAnomalies(type, samples) {
    const anomalies = [];
    const values = samples.map(s => s.value);
    const timestamps = samples.map(s => s.timestamp);

    // Calculer la baseline
    const baseline = this._calculateBaseline(values);
    this.baselines.set(type, baseline);

    // Détecter les pics
    const spikes = this._detectSpikes(values, baseline);
    spikes.forEach(index => {
      anomalies.push(this._createAnomaly(
        type,
        ANOMALY_TYPES.SPIKE,
        samples[index],
        baseline
      ));
    });

    // Détecter les chutes
    const drops = this._detectDrops(values, baseline);
    drops.forEach(index => {
      anomalies.push(this._createAnomaly(
        type,
        ANOMALY_TYPES.DROP,
        samples[index],
        baseline
      ));
    });

    // Détecter les ruptures de pattern
    const breaks = this._detectPatternBreaks(values);
    breaks.forEach(index => {
      anomalies.push(this._createAnomaly(
        type,
        ANOMALY_TYPES.PATTERN_BREAK,
        samples[index],
        baseline
      ));
    });

    return anomalies;
  }

  /**
   * Calcule la baseline statistique
   * @private
   * @param {Array} values - Valeurs
   * @returns {Object} Baseline
   */
  _calculateBaseline(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      median: this._median(values),
      q1: this._percentile(values, 25),
      q3: this._percentile(values, 75)
    };
  }

  /**
   * Calcule la médiane
   * @private
   * @param {Array} values - Valeurs
   * @returns {number} Médiane
   */
  _median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calcule un percentile
   * @private
   * @param {Array} values - Valeurs
   * @param {number} p - Percentile (0-100)
   * @returns {number} Valeur au percentile
   */
  _percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Détecte les pics
   * @private
   * @param {Array} values - Valeurs
   * @param {Object} baseline - Baseline
   * @returns {Array} Indices des pics
   */
  _detectSpikes(values, baseline) {
    const spikes = [];

    values.forEach((value, i) => {
      const zScore = (value - baseline.mean) / baseline.stdDev;
      if (zScore > this.options.sensitivity) {
        spikes.push(i);
      }
    });

    return spikes;
  }

  /**
   * Détecte les chutes
   * @private
   * @param {Array} values - Valeurs
   * @param {Object} baseline - Baseline
   * @returns {Array} Indices des chutes
   */
  _detectDrops(values, baseline) {
    const drops = [];

    values.forEach((value, i) => {
      const zScore = (baseline.mean - value) / baseline.stdDev;
      if (zScore > this.options.sensitivity) {
        drops.push(i);
      }
    });

    return drops;
  }

  /**
   * Détecte les ruptures de pattern
   * @private
   * @param {Array} values - Valeurs
   * @returns {Array} Indices des ruptures
   */
  _detectPatternBreaks(values) {
    const breaks = [];
    
    if (values.length < 20) return breaks;

    // Utiliser la fenêtre glissante
    const windowSize = 10;
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const window1 = values.slice(i - windowSize, i);
      const window2 = values.slice(i, i + windowSize);

      const mean1 = window1.reduce((a, b) => a + b, 0) / windowSize;
      const mean2 = window2.reduce((a, b) => a + b, 0) / windowSize;
      const diff = Math.abs(mean2 - mean1) / mean1;

      if (diff > 0.5) { // Changement de 50%
        breaks.push(i);
      }
    }

    return breaks;
  }

  /**
   * Crée une anomalie
   * @private
   * @param {string} metric - Type de métrique
   * @param {string} type - Type d'anomalie
   * @param {Object} sample - Échantillon
   * @param {Object} baseline - Baseline
   * @returns {Object} Anomalie
   */
  _createAnomaly(metric, type, sample, baseline) {
    const severity = this._getAnomalySeverity(sample.value, baseline);
    const deviation = Math.abs(sample.value - baseline.mean) / baseline.stdDev;

    return {
      type: 'anomaly',
      anomalyType: type,
      metric,
      value: sample.value,
      timestamp: sample.timestamp,
      deviation: deviation.toFixed(2),
      baseline: {
        mean: baseline.mean.toFixed(2),
        stdDev: baseline.stdDev.toFixed(2),
        expected: baseline.mean
      },
      title: this._getAnomalyTitle(type, metric),
      message: this._getAnomalyMessage(type, metric, sample.value, deviation),
      severity
    };
  }

  /**
   * Détermine la sévérité d'une anomalie
   * @private
   * @param {number} value - Valeur
   * @param {Object} baseline - Baseline
   * @returns {string} Sévérité
   */
  _getAnomalySeverity(value, baseline) {
    const zScore = Math.abs(value - baseline.mean) / baseline.stdDev;

    if (zScore > 4) return SEVERITY_LEVELS.CRITICAL;
    if (zScore > 3) return SEVERITY_LEVELS.HIGH;
    if (zScore > 2.5) return SEVERITY_LEVELS.MEDIUM;
    return SEVERITY_LEVELS.LOW;
  }

  /**
   * Génère le titre de l'anomalie
   * @private
   * @param {string} type - Type d'anomalie
   * @param {string} metric - Métrique
   * @returns {string} Titre
   */
  _getAnomalyTitle(type, metric) {
    const titles = {
      [ANOMALY_TYPES.SPIKE]: `Pic de ${metric} détecté`,
      [ANOMALY_TYPES.DROP]: `Chute de ${metric} détectée`,
      [ANOMALY_TYPES.OUTLIER]: `Valeur aberrante pour ${metric}`,
      [ANOMALY_TYPES.PATTERN_BREAK]: `Rupture de pattern pour ${metric}`
    };

    return titles[type] || `Anomalie détectée pour ${metric}`;
  }

  /**
   * Génère le message de l'anomalie
   * @private
   * @param {string} type - Type d'anomalie
   * @param {string} metric - Métrique
   * @param {number} value - Valeur
   * @param {number} deviation - Écart-type
   * @returns {string} Message
   */
  _getAnomalyMessage(type, metric, value, deviation) {
    const messages = {
      [ANOMALY_TYPES.SPIKE]: `Valeur anormalement élevée: ${value} (${deviation.toFixed(1)}σ)`,
      [ANOMALY_TYPES.DROP]: `Valeur anormalement basse: ${value} (${deviation.toFixed(1)}σ)`,
      [ANOMALY_TYPES.OUTLIER]: `Valeur hors norme: ${value} (${deviation.toFixed(1)}σ)`,
      [ANOMALY_TYPES.PATTERN_BREAK]: `Changement soudain dans le comportement de ${metric}`
    };

    return messages[type] || `Anomalie statistique détectée (${deviation.toFixed(1)}σ)`;
  }

  /**
   * Apprend un nouveau modèle (ML)
   * @param {string} type - Type de métrique
   * @param {Array} samples - Échantillons
   */
  learn(type, samples) {
    if (!this.options.enableML) return;

    // TODO: Implémenter l'apprentissage automatique
    // Réseau de neurones simple, isolation forest, etc.
  }

  /**
   * Met à jour la sensibilité
   * @param {number} sensitivity - Nouvelle sensibilité
   */
  setSensitivity(sensitivity) {
    this.options.sensitivity = sensitivity;
  }

  /**
   * Obtient les baselines actuelles
   * @returns {Object} Baselines
   */
  getBaselines() {
    const baselines = {};
    this.baselines.forEach((baseline, metric) => {
      baselines[metric] = baseline;
    });
    return baselines;
  }
}

export default AnomalyDetector;
