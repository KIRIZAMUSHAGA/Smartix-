/**
 * ReportGenerator
 * Génère des rapports détaillés au format JSON, HTML, etc.
 */

export class ReportGenerator {
  /**
   * Crée une instance de ReportGenerator
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      includeCharts: options.includeCharts || false,
      includeRawData: options.includeRawData || false,
      maxPoints: options.maxPoints || 100,
      ...options
    };
  }

  /**
   * Génère un rapport complet
   * @param {Object} data - Données du rapport
   * @returns {Object} Rapport généré
   */
  generate(data) {
    const report = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: Date.now(),
      projectId: data.projectId,
      period: data.period || '24h',
      summary: this._generateSummary(data),
      metrics: this._generateMetricsSection(data.metrics),
      events: this._generateEventsSection(data.events),
      alerts: this._generateAlertsSection(data.alerts),
      performance: this._generatePerformanceSection(data),
      recommendations: this._generateRecommendations(data)
    };

    if (this.options.includeRawData) {
      report.rawData = this._generateRawData(data);
    }

    return report;
  }

  /**
   * Génère un rapport HTML
   * @param {Object} data - Données du rapport
   * @returns {string} Rapport HTML
   */
  generateHTML(data) {
    const report = this.generate(data);
    
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport de Monitoring - ${new Date(report.generatedAt).toLocaleString()}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: #2d2d2d;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            color: #007bff;
        }
        .header p {
            color: #888;
            margin: 5px 0 0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #2d2d2d;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px;
            color: #888;
            font-size: 14px;
        }
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #007bff;
        }
        .section {
            background: #2d2d2d;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .section h2 {
            margin: 0 0 20px;
            color: #007bff;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        .metric-item {
            background: #1e1e1e;
            padding: 15px;
            border-radius: 6px;
        }
        .metric-item h4 {
            margin: 0 0 10px;
            color: #888;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
        }
        .metric-trend {
            margin-top: 5px;
            font-size: 12px;
        }
        .trend-up { color: #f48771; }
        .trend-down { color: #b5cea8; }
        .trend-stable { color: #888; }
        .alert-item {
            padding: 10px;
            border-left: 4px solid;
            margin-bottom: 5px;
            background: #1e1e1e;
        }
        .alert-critical { border-color: #dc3545; }
        .alert-high { border-color: #f48771; }
        .alert-medium { border-color: #ffd93e; }
        .alert-low { border-color: #17a2b8; }
        .recommandation {
            padding: 10px;
            background: #1e3a5f;
            border-radius: 4px;
            margin-bottom: 5px;
        }
        .recommandation.priority-high { border-left: 4px solid #dc3545; }
        .recommandation.priority-medium { border-left: 4px solid #ffd93e; }
        .recommandation.priority-low { border-left: 4px solid #17a2b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Rapport de Monitoring</h1>
            <p>Généré le ${new Date(report.generatedAt).toLocaleString()}</p>
            <p>Période: ${report.period}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Score de santé</h3>
                <div class="value">${report.summary.health.score}%</div>
                <div>${report.summary.health.status}</div>
            </div>
            <div class="summary-card">
                <h3>Alertes actives</h3>
                <div class="value">${report.summary.alerts.active}</div>
            </div>
            <div class="summary-card">
                <h3>Événements</h3>
                <div class="value">${report.summary.events.total}</div>
            </div>
            <div class="summary-card">
                <h3>Uptime</h3>
                <div class="value">${report.summary.uptime}</div>
            </div>
        </div>

        <div class="section">
            <h2>📈 Métriques</h2>
            <div class="metric-grid">
                ${Object.entries(report.metrics).map(([name, metric]) => `
                    <div class="metric-item">
                        <h4>${name}</h4>
                        <div class="metric-value">${metric.current}</div>
                        <div>min: ${metric.min} | max: ${metric.max}</div>
                        <div class="metric-trend trend-${metric.trend.direction}">
                            ${metric.trend.direction === 'up' ? '▲' : metric.trend.direction === 'down' ? '▼' : '◆'}
                            ${metric.trend.change}%
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <h2>⚠️ Alertes actives</h2>
            ${report.alerts.active.map(alert => `
                <div class="alert-item alert-${alert.severity}">
                    <strong>${alert.title}</strong><br>
                    ${alert.message}<br>
                    <small>${new Date(alert.createdAt).toLocaleString()}</small>
                </div>
            `).join('')}
            ${report.alerts.active.length === 0 ? '<p>Aucune alerte active</p>' : ''}
        </div>

        <div class="section">
            <h2>💡 Recommandations</h2>
            ${report.recommendations.map(rec => `
                <div class="recommandation priority-${rec.priority}">
                    <strong>${rec.category}</strong><br>
                    ${rec.message}<br>
                    <small>Action: ${rec.action}</small>
                </div>
            `).join('')}
            ${report.recommendations.length === 0 ? '<p>Aucune recommandation</p>' : ''}
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Exporte le rapport dans différents formats
   * @param {Object} data - Données du rapport
   * @param {string} format - Format d'export (json, html, csv)
   * @returns {string} Rapport exporté
   */
  export(data, format = 'json') {
    switch (format) {
      case 'html':
        return this.generateHTML(data);
      case 'csv':
        return this._generateCSV(data);
      default:
        return JSON.stringify(this.generate(data), null, 2);
    }
  }

  /**
   * Génère un résumé
   * @private
   * @param {Object} data - Données
   * @returns {Object} Résumé
   */
  _generateSummary(data) {
    return {
      uptime: data.uptime || 'N/A',
      health: data.health || { score: 0, status: 'unknown' },
      events: {
        total: data.events?.total || 0,
        lastHour: data.events?.lastHour || 0
      },
      alerts: {
        total: data.alerts?.total || 0,
        active: data.alerts?.active || 0
      },
      period: data.period || '24h'
    };
  }

  /**
   * Génère la section métriques
   * @private
   * @param {Object} metrics - Métriques
   * @returns {Object} Section métriques
   */
  _generateMetricsSection(metrics) {
    if (!metrics) return {};

    const section = {};
    
    Object.entries(metrics).forEach(([name, data]) => {
      section[name] = {
        current: this._formatValue(data.current),
        average: this._formatValue(data.average),
        min: this._formatValue(data.min),
        max: this._formatValue(data.max),
        samples: data.samples || 0,
        trend: data.trend || { direction: 'stable', change: 0 }
      };
    });

    return section;
  }

  /**
   * Génère la section événements
   * @private
   * @param {Object} events - Événements
   * @returns {Object} Section événements
   */
  _generateEventsSection(events) {
    if (!events) return { total: 0, byType: {}, recent: [] };

    return {
      total: events.total || 0,
      byType: events.byType || {},
      recent: (events.recent || []).slice(0, 10).map(e => ({
        type: e.type,
        time: new Date(e.timestamp).toISOString(),
        message: e.data?.message || ''
      }))
    };
  }

  /**
   * Génère la section alertes
   * @private
   * @param {Object} alerts - Alertes
   * @returns {Object} Section alertes
   */
  _generateAlertsSection(alerts) {
    if (!alerts) return { active: [], resolved: [] };

    return {
      active: (alerts.active || []).slice(0, 20).map(a => ({
        id: a.id,
        title: a.title,
        message: a.message,
        severity: a.severity,
        createdAt: a.createdAt
      })),
      resolved: (alerts.resolved || []).slice(0, 10).map(a => ({
        title: a.title,
        resolvedAt: a.resolvedAt,
        reason: a.resolvedReason
      })),
      stats: {
        total: alerts.total || 0,
        bySeverity: alerts.bySeverity || {}
      }
    };
  }

  /**
   * Génère la section performance
   * @private
   * @param {Object} data - Données
   * @returns {Object} Section performance
   */
  _generatePerformanceSection(data) {
    return {
      bottlenecks: data.bottlenecks || [],
      trends: data.trends || {},
      health: data.health || { score: 0, status: 'unknown' }
    };
  }

  /**
   * Génère les recommandations
   * @private
   * @param {Object} data - Données
   * @returns {Array} Recommandations
   */
  _generateRecommendations(data) {
    return (data.recommendations || []).map(rec => ({
      ...rec,
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }));
  }

  /**
   * Génère les données brutes
   * @private
   * @param {Object} data - Données
   * @returns {Object} Données brutes
   */
  _generateRawData(data) {
    // Limiter le nombre de points pour éviter des fichiers trop gros
    const raw = { ...data };

    if (raw.metrics) {
      Object.keys(raw.metrics).forEach(key => {
        if (raw.metrics[key].history && raw.metrics[key].history.length > this.options.maxPoints) {
          raw.metrics[key].history = raw.metrics[key].history.slice(-this.options.maxPoints);
        }
      });
    }

    return raw;
  }

  /**
   * Génère un CSV
   * @private
   * @param {Object} data - Données
   * @returns {string} CSV
   */
  _generateCSV(data) {
    let csv = 'Timestamp,Type,Metric,Value\n';

    // Ajouter les métriques
    Object.entries(data.metrics || {}).forEach(([name, metric]) => {
      if (metric.history) {
        metric.history.forEach(sample => {
          csv += `${sample.timestamp},metric,${name},${sample.value}\n`;
        });
      }
    });

    // Ajouter les événements
    (data.events?.recent || []).forEach(event => {
      csv += `${event.timestamp},event,${event.type},${event.data?.message || ''}\n`;
    });

    return csv;
  }

  /**
   * Formate une valeur
   * @private
   * @param {number} value - Valeur
   * @returns {string} Valeur formatée
   */
  _formatValue(value) {
    if (value === undefined || value === null) return 'N/A';
    return Number(value).toFixed(2);
  }
}

export default ReportGenerator;
