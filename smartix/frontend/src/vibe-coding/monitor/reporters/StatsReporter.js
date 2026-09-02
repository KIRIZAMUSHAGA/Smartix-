/**
 * StatsReporter
 * Génère des rapports de statistiques à partir des données collectées
 */

export class StatsReporter {
  /**
   * Crée une instance de StatsReporter
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      decimalPlaces: options.decimalPlaces || 2,
      includeTimestamps: options.includeTimestamps !== false,
      ...options
    };
  }

  /**
   * Génère un rapport de statistiques
   * @param {Object} data - Données à analyser
   * @returns {Object} Rapport généré
   */
  generate(data) {
    const report = {
      generatedAt: Date.now(),
      period: this._formatPeriod(data.uptime),
      summary: this._generateSummary(data),
      metrics: this._generateMetricsReport(data.metrics),
      events: this._generateEventsReport(data.events),
      alerts: this._generateAlertsReport(data.alerts),
      performance: this._generatePerformanceReport(data),
      recommendations: this._generateRecommendations(data)
    };

    if (this.options.includeTimestamps) {
      report.timeline = this._generateTimeline(data);
    }

    return report;
  }

  /**
   * Génère un résumé
   * @private
   * @param {Object} data - Données
   * @returns {Object} Résumé
   */
  _generateSummary(data) {
    return {
      uptime: data.uptime,
      totalEvents: data.events?.total || 0,
      totalAlerts: data.alerts?.total || 0,
      activeAlerts: data.alerts?.active || 0,
      metricsCount: Object.keys(data.metrics || {}).length,
      startTime: data.startTime ? new Date(data.startTime).toISOString() : null,
      lastUpdate: data.lastUpdate ? new Date(data.lastUpdate).toISOString() : null
    };
  }

  /**
   * Génère un rapport des métriques
   * @private
   * @param {Object} metrics - Données des métriques
   * @returns {Object} Rapport des métriques
   */
  _generateMetricsReport(metrics) {
    if (!metrics) return {};

    const report = {};

    Object.entries(metrics).forEach(([name, data]) => {
      report[name] = {
        current: this._formatValue(data.current),
        average: this._formatValue(data.average),
        min: this._formatValue(data.min),
        max: this._formatValue(data.max),
        samples: data.samples || 0,
        unit: this._getMetricUnit(name),
        trend: this._calculateTrend(data)
      };
    });

    return report;
  }

  /**
   * Génère un rapport des événements
   * @private
   * @param {Object} events - Données des événements
   * @returns {Object} Rapport des événements
   */
  _generateEventsReport(events) {
    if (!events) return {};

    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;

    const lastHour = events.getInPeriod ? 
      events.getInPeriod(hourAgo, now).length : 0;
    const lastDay = events.getInPeriod ?
      events.getInPeriod(dayAgo, now).length : 0;

    return {
      total: events.total || 0,
      lastHour,
      lastDay,
      byType: events.byType || {},
      rate: this._calculateRate(lastHour, 60), // par minute
      lastEvent: events.lastEvent ? {
        type: events.lastEvent.type,
        time: new Date(events.lastEvent.timestamp).toISOString()
      } : null
    };
  }

  /**
   * Génère un rapport des alertes
   * @private
   * @param {Object} alerts - Données des alertes
   * @returns {Object} Rapport des alertes
   */
  _generateAlertsReport(alerts) {
    if (!alerts) return {};

    const now = Date.now();
    const hourAgo = now - 3600000;

    const lastHour = alerts.getInPeriod ?
      alerts.getInPeriod(hourAgo, now).length : 0;

    return {
      total: alerts.total || 0,
      active: alerts.active || 0,
      resolved: alerts.resolved || 0,
      lastHour,
      bySeverity: alerts.bySeverity || {},
      byType: alerts.byType || {},
      unacknowledged: alerts.unacknowledged || 0,
      resolutionRate: this._calculateResolutionRate(alerts)
    };
  }

  /**
   * Génère un rapport de performance
   * @private
   * @param {Object} data - Données
   * @returns {Object} Rapport de performance
   */
  _generatePerformanceReport(data) {
    const metrics = data.metrics || {};
    
    return {
      health: this._calculateHealthScore(data),
      bottlenecks: this._detectBottlenecks(metrics),
      trends: this._analyzeTrends(metrics)
    };
  }

  /**
   * Génère des recommandations
   * @private
   * @param {Object} data - Données
   * @returns {Array} Recommandations
   */
  _generateRecommendations(data) {
    const recommendations = [];

    // Recommandations basées sur les alertes
    if (data.alerts?.active > 5) {
      recommendations.push({
        priority: 'high',
        category: 'alerts',
        message: `${data.alerts.active} alertes actives à traiter`,
        action: 'review-alerts'
      });
    }

    // Recommandations basées sur les métriques
    const metrics = data.metrics || {};
    if (metrics.cpu?.current > 80) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        message: `CPU élevé (${metrics.cpu.current}%)`,
        action: 'optimize-cpu'
      });
    }

    if (metrics.memory?.current > 200) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: `Mémoire élevée (${metrics.memory.current}MB)`,
        action: 'check-memory-leak'
      });
    }

    // Recommandations basées sur les événements
    const events = data.events;
    if (events?.byType?.error > 10) {
      recommendations.push({
        priority: 'high',
        category: 'errors',
        message: `${events.byType.error} erreurs détectées`,
        action: 'investigate-errors'
      });
    }

    return recommendations.sort((a, b) => 
      this._priorityWeight(b.priority) - this._priorityWeight(a.priority)
    );
  }

  /**
   * Génère une timeline
   * @private
   * @param {Object} data - Données
   * @returns {Object} Timeline
   */
  _generateTimeline(data) {
    const timeline = {};
    const now = Date.now();

    // Dernière heure (par minute)
    timeline.lastHour = [];
    for (let i = 0; i < 60; i++) {
      const time = now - (i + 1) * 60000;
      timeline.lastHour.unshift({
        time: new Date(time).toISOString(),
        events: data.events?.getInPeriod?.(time, time + 60000).length || 0,
        alerts: data.alerts?.getInPeriod?.(time, time + 60000).length || 0
      });
    }

    // Dernier jour (par heure)
    timeline.lastDay = [];
    for (let i = 0; i < 24; i++) {
      const time = now - (i + 1) * 3600000;
      timeline.lastDay.unshift({
        time: new Date(time).toISOString().slice(0, 13),
        events: data.events?.getInPeriod?.(time, time + 3600000).length || 0,
        alerts: data.alerts?.getInPeriod?.(time, time + 3600000).length || 0
      });
    }

    return timeline;
  }

  /**
   * Formate une période
   * @private
   * @param {string} uptime - Durée formatée
   * @returns {string} Période formatée
   */
  _formatPeriod(uptime) {
    const periods = {
      's': 'secondes',
      'm': 'minutes',
      'h': 'heures',
      'j': 'jours'
    };

    return uptime.replace(/(\d+)([smhj])/, (_, num, unit) => 
      `${num} ${periods[unit]}`
    );
  }

  /**
   * Formate une valeur
   * @private
   * @param {number} value - Valeur
   * @returns {string} Valeur formatée
   */
  _formatValue(value) {
    if (value === undefined || value === null) return 'N/A';
    return Number(value).toFixed(this.options.decimalPlaces);
  }

  /**
   * Obtient l'unité d'une métrique
   * @private
   * @param {string} metric - Nom de la métrique
   * @returns {string} Unité
   */
  _getMetricUnit(metric) {
    const units = {
      cpu: '%',
      memory: 'MB',
      fps: 'fps',
      responseTime: 'ms',
      networkLatency: 'ms',
      networkSize: 'KB'
    };
    return units[metric] || '';
  }

  /**
   * Calcule le taux
   * @private
   * @param {number} count - Nombre
   * @param {number} minutes - Minutes
   * @returns {string} Taux formaté
   */
  _calculateRate(count, minutes) {
    const rate = count / minutes;
    return this._formatValue(rate);
  }

  /**
   * Calcule le taux de résolution
   * @private
   * @param {Object} alerts - Données des alertes
   * @returns {string} Taux de résolution
   */
  _calculateResolutionRate(alerts) {
    const total = alerts.total || 0;
    if (total === 0) return '0%';
    
    const rate = ((alerts.resolved || 0) / total) * 100;
    return `${this._formatValue(rate)}%`;
  }

  /**
   * Calcule la tendance
   * @private
   * @param {Object} data - Données de métrique
   * @returns {Object} Tendance
   */
  _calculateTrend(data) {
    if (!data.history || data.history.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const first = data.history[0];
    const last = data.history[data.history.length - 1];
    const change = last - first;
    const percentChange = (change / first) * 100;

    let direction = 'stable';
    if (Math.abs(percentChange) > 5) {
      direction = percentChange > 0 ? 'up' : 'down';
    }

    return {
      direction,
      change: this._formatValue(change),
      percentChange: this._formatValue(percentChange)
    };
  }

  /**
   * Calcule le score de santé
   * @private
   * @param {Object} data - Données
   * @returns {Object} Score de santé
   */
  _calculateHealthScore(data) {
    let score = 100;

    // Pénalités basées sur les alertes
    score -= (data.alerts?.active || 0) * 5;
    
    // Pénalités basées sur les métriques
    const metrics = data.metrics || {};
    if (metrics.cpu?.current > 80) score -= 15;
    if (metrics.memory?.current > 200) score -= 15;
    if (metrics.errorRate > 5) score -= 20;

    // Pénalités basées sur les événements
    const events = data.events;
    if (events?.byType?.error > 50) score -= 20;
    if (events?.byType?.warning > 100) score -= 10;

    // S'assurer que le score reste entre 0 et 100
    score = Math.max(0, Math.min(100, score));

    let status = 'excellent';
    if (score < 50) status = 'critical';
    else if (score < 70) status = 'poor';
    else if (score < 85) status = 'fair';
    else if (score < 95) status = 'good';

    return {
      score,
      status,
      details: {
        alerts: data.alerts?.active || 0,
        cpu: metrics.cpu?.current || 0,
        memory: metrics.memory?.current || 0,
        errors: events?.byType?.error || 0
      }
    };
  }

  /**
   * Détecte les goulots d'étranglement
   * @private
   * @param {Object} metrics - Métriques
   * @returns {Array} Goulots d'étranglement
   */
  _detectBottlenecks(metrics) {
    const bottlenecks = [];

    if (metrics.cpu?.current > 90) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'critical',
        message: 'CPU proche de la saturation'
      });
    } else if (metrics.cpu?.current > 75) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'warning',
        message: 'CPU élevé'
      });
    }

    if (metrics.memory?.current > 400) {
      bottlenecks.push({
        type: 'memory',
        severity: 'critical',
        message: 'Mémoire proche de la limite'
      });
    } else if (metrics.memory?.current > 300) {
      bottlenecks.push({
        type: 'memory',
        severity: 'warning',
        message: 'Mémoire élevée'
      });
    }

    if (metrics.responseTime?.current > 1000) {
      bottlenecks.push({
        type: 'response-time',
        severity: 'critical',
        message: 'Temps de réponse trop élevé'
      });
    }

    return bottlenecks;
  }

  /**
   * Analyse les tendances
   * @private
   * @param {Object} metrics - Métriques
   * @returns {Object} Tendances
   */
  _analyzeTrends(metrics) {
    const trends = {};

    Object.entries(metrics).forEach(([name, data]) => {
      if (data.history && data.history.length > 5) {
        const recent = data.history.slice(-5);
        const older = data.history.slice(0, 5);
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;

        trends[name] = {
          direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
          change: this._formatValue(change),
          recentAvg: this._formatValue(recentAvg),
          olderAvg: this._formatValue(olderAvg)
        };
      }
    });

    return trends;
  }

  /**
   * Poids pour le tri des priorités
   * @private
   * @param {string} priority - Priorité
   * @returns {number} Poids
   */
  _priorityWeight(priority) {
    const weights = {
      'high': 3,
      'medium': 2,
      'low': 1
    };
    return weights[priority] || 0;
  }
}

export default StatsReporter;
