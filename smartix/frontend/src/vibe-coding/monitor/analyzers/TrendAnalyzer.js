/**
 * TrendAnalyzer
 * Analyse les tendances des métriques dans le temps
 */

import { SEVERITY_LEVELS, TREND_TYPES } from '../core/constants';

export class TrendAnalyzer {
  /**
   * Crée une instance de TrendAnalyzer
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      minSamples: options.minSamples || 10,
      sensitivity: options.sensitivity || 0.1,
      ...options
    };
  }

  /**
   * Analyse les tendances des métriques
   * @param {Object} history - Historique des métriques
   * @returns {Array} Alertes de tendance
   */
  analyze(history) {
    const alerts = [];

    Object.entries(history).forEach(([type, samples]) => {
      if (samples.length >= this.options.minSamples) {
        const trend = this._analyzeTrend(samples);
        if (trend.significant) {
          alerts.push(this._createTrendAlert(type, trend));
        }
      }
    });

    return alerts;
  }

  /**
   * Analyse la tendance d'une série de métriques
   * @private
   * @param {Array} samples - Échantillons
   * @returns {Object} Analyse de tendance
   */
  _analyzeTrend(samples) {
    const values = samples.map(s => s.value);
    const timestamps = samples.map(s => s.timestamp);

    // Calculer la régression linéaire
    const regression = this._linearRegression(timestamps, values);
    const slope = regression.slope;
    
    // Calculer la volatilité
    const volatility = this._calculateVolatility(values);
    
    // Déterminer le type de tendance
    let type = TREND_TYPES.STABLE;
    let significant = false;

    if (Math.abs(slope) > this.options.sensitivity) {
      significant = true;
      type = slope > 0 ? TREND_TYPES.INCREASING : TREND_TYPES.DECREASING;
    }

    if (volatility > 0.3) {
      type = TREND_TYPES.VOLATILE;
    }

    // Détecter la cyclicité
    const cyclical = this._detectCyclical(values);
    if (cyclical) {
      type = TREND_TYPES.CYCLICAL;
    }

    return {
      type,
      slope,
      volatility,
      significant,
      cyclical,
      current: values[values.length - 1],
      average: values.reduce((a, b) => a + b, 0) / values.length
    };
  }

  /**
   * Calcule la régression linéaire
   * @private
   * @param {Array} x - Valeurs X (temps)
   * @param {Array} y - Valeurs Y (métriques)
   * @returns {Object} Pente et intercept
   */
  _linearRegression(x, y) {
    const n = x.length;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, _, i) => a + x[i] * y[i], 0);
    const sumXX = x.reduce((a, _, i) => a + x[i] * x[i], 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Calcule la volatilité (coefficient de variation)
   * @private
   * @param {Array} values - Valeurs
   * @returns {number} Volatilité
   */
  _calculateVolatility(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;

    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }

  /**
   * Détecte si la série est cyclique
   * @private
   * @param {Array} values - Valeurs
   * @returns {boolean} true si cyclique
   */
  _detectCyclical(values) {
    if (values.length < 20) return false;

    // Autocorrélation simple
    const correlations = [];
    for (let lag = 1; lag < 10; lag++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < values.length - lag; i++) {
        sum += values[i] * values[i + lag];
        count++;
      }
      correlations.push(sum / count);
    }

    // Vérifier si la corrélation est significative
    const maxCorr = Math.max(...correlations);
    const meanCorr = correlations.reduce((a, b) => a + b, 0) / correlations.length;

    return maxCorr > meanCorr * 1.5;
  }

  /**
   * Crée une alerte de tendance
   * @private
   * @param {string} type - Type de métrique
   * @param {Object} trend - Analyse de tendance
   * @returns {Object} Alerte
   */
  _createTrendAlert(type, trend) {
    const severity = this._getTrendSeverity(trend);
    const direction = trend.slope > 0 ? 'hausse' : 'baisse';

    return {
      type: 'trend_detected',
      metric: type,
      trend: trend.type,
      slope: trend.slope,
      volatility: trend.volatility,
      title: `Tendance à la ${direction} détectée`,
      message: `La métrique ${type} ${direction} de ${Math.abs(trend.slope).toFixed(2)} par heure`,
      severity,
      timestamp: Date.now(),
      data: trend
    };
  }

  /**
   * Détermine la sévérité de la tendance
   * @private
   * @param {Object} trend - Analyse de tendance
   * @returns {string} Niveau de sévérité
   */
  _getTrendSeverity(trend) {
    if (trend.type === TREND_TYPES.VOLATILE) {
      return SEVERITY_LEVELS.HIGH;
    }

    if (trend.type === TREND_TYPES.INCREASING) {
      const magnitude = Math.abs(trend.slope) / trend.average;
      if (magnitude > 0.5) return SEVERITY_LEVELS.HIGH;
      if (magnitude > 0.2) return SEVERITY_LEVELS.MEDIUM;
    }

    return SEVERITY_LEVELS.LOW;
  }

  /**
   * Prédit la prochaine valeur
   * @param {Array} samples - Échantillons
   * @param {number} steps - Nombre d'étapes futures
   * @returns {Array} Prédictions
   */
  predict(samples, steps = 5) {
    if (samples.length < this.options.minSamples) return [];

    const values = samples.map(s => s.value);
    const timestamps = samples.map(s => s.timestamp);
    const regression = this._linearRegression(timestamps, values);
    
    const lastTime = timestamps[timestamps.length - 1];
    const predictions = [];

    for (let i = 1; i <= steps; i++) {
      const futureTime = lastTime + i * 60000; // +1 minute
      const predictedValue = regression.slope * futureTime + regression.intercept;
      
      predictions.push({
        timestamp: futureTime,
        value: Math.max(0, predictedValue),
        confidence: 1 - (i / (steps + 1)) // Confiance décroissante
      });
    }

    return predictions;
  }

  /**
   * Détecte les points aberrants
   * @param {Array} samples - Échantillons
   * @returns {Array} Points aberrants
   */
  detectOutliers(samples) {
    const values = samples.map(s => s.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length);

    const outliers = [];
    samples.forEach((sample, i) => {
      const zScore = Math.abs(sample.value - mean) / stdDev;
      if (zScore > 3) { // Plus de 3 écarts-types
        outliers.push({
          index: i,
          ...sample,
          zScore
        });
      }
    });

    return outliers;
  }
}

export default TrendAnalyzer;
