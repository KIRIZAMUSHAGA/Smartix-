/**
 * ExportService
 * Service d'export des données de monitoring
 */

export class ExportService {
  /**
   * Crée une instance de ExportService
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      formats: options.formats || ['json', 'csv', 'html'],
      maxExportSize: options.maxExportSize || 10 * 1024 * 1024, // 10 MB
      ...options
    };
  }

  /**
   * Exporte les données
   * @param {Object} data - Données à exporter
   * @param {string} format - Format d'export
   * @returns {Promise<Object>} Résultat de l'export
   */
  async export(data, format = 'json') {
    if (!this.options.formats.includes(format)) {
      throw new Error(`Format non supporté: ${format}`);
    }

    switch (format) {
      case 'json':
        return this._exportJSON(data);
      case 'csv':
        return this._exportCSV(data);
      case 'html':
        return this._exportHTML(data);
      default:
        throw new Error(`Format inconnu: ${format}`);
    }
  }

  /**
   * Exporte en JSON
   * @private
   * @param {Object} data - Données
   * @returns {Object} Résultat
   */
  _exportJSON(data) {
    const json = JSON.stringify(data, null, 2);
    const size = new Blob([json]).size;

    if (size > this.options.maxExportSize) {
      throw new Error(`Données trop volumineuses (${this._formatSize(size)})`);
    }

    return {
      format: 'json',
      data: json,
      size,
      filename: `monitoring-export-${Date.now()}.json`,
      mimeType: 'application/json'
    };
  }

  /**
   * Exporte en CSV
   * @private
   * @param {Object} data - Données
   * @returns {Object} Résultat
   */
  _exportCSV(data) {
    let csv = this._generateCSVHeader();
    
    // Ajouter les métriques
    csv += this._generateMetricsCSV(data.metrics);
    
    // Ajouter les événements
    csv += this._generateEventsCSV(data.events);
    
    // Ajouter les alertes
    csv += this._generateAlertsCSV(data.alerts);

    const size = new Blob([csv]).size;

    return {
      format: 'csv',
      data: csv,
      size,
      filename: `monitoring-export-${Date.now()}.csv`,
      mimeType: 'text/csv'
    };
  }

  /**
   * Exporte en HTML
   * @private
   * @param {Object} data - Données
   * @returns {Object} Résultat
   */
  _exportHTML(data) {
    const html = this._generateHTML(data);
    const size = new Blob([html]).size;

    return {
      format: 'html',
      data: html,
      size,
      filename: `monitoring-report-${Date.now()}.html`,
      mimeType: 'text/html'
    };
  }

  /**
   * Génère l'en-tête CSV
   * @private
   * @returns {string} En-tête CSV
   */
  _generateCSVHeader() {
    return 'Type,Timestamp,Name,Value,Severity,Message\n';
  }

  /**
   * Génère la partie CSV des métriques
   * @private
   * @param {Object} metrics - Métriques
   * @returns {string} CSV
   */
  _generateMetricsCSV(metrics) {
    let csv = '';

    Object.entries(metrics || {}).forEach(([name, data]) => {
      if (data.history) {
        data.history.forEach(sample => {
          csv += `metric,${sample.timestamp},${name},${sample.value},,\n`;
        });
      }
    });

    return csv;
  }

  /**
   * Génère la partie CSV des événements
   * @private
   * @param {Object} events - Événements
   * @returns {string} CSV
   */
  _generateEventsCSV(events) {
    let csv = '';

    (events?.recent || []).forEach(event => {
      csv += `event,${event.timestamp},${event.type},,${event.severity || ''},${event.data?.message || ''}\n`;
    });

    return csv;
  }

  /**
   * Génère la partie CSV des alertes
   * @private
   * @param {Object} alerts - Alertes
   * @returns {string} CSV
   */
  _generateAlertsCSV(alerts) {
    let csv = '';

    (alerts?.active || []).forEach(alert => {
      csv += `alert,${alert.createdAt},${alert.title},,${alert.severity},${alert.message}\n`;
    });

    (alerts?.resolved || []).forEach(alert => {
      csv += `alert-resolved,${alert.resolvedAt},${alert.title},,${alert.severity},${alert.message}\n`;
    });

    return csv;
  }

  /**
   * Génère le rapport HTML
   * @private
   * @param {Object} data - Données
   * @returns {string} HTML
   */
  _generateHTML(data) {
    const styles = this._getStyles();
    const scripts = this._getScripts();

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport de Monitoring</title>
    ${styles}
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>📊 Rapport de Monitoring</h1>
            <p class="timestamp">Généré le ${new Date().toLocaleString()}</p>
        </header>

        <div class="summary-cards">
            ${this._generateSummaryCards(data)}
        </div>

        <div class="section">
            <h2>📈 Métriques</h2>
            <div class="metrics-grid">
                ${this._generateMetricsHTML(data.metrics)}
            </div>
        </div>

        <div class="section">
            <h2>⚠️ Alertes</h2>
            <div class="alerts-list">
                ${this._generateAlertsHTML(data.alerts)}
            </div>
        </div>

        <div class="section">
            <h2>📋 Événements récents</h2>
            <table class="events-table">
                <thead>
                    <tr>
                        <th>Heure</th>
                        <th>Type</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody>
                    ${this._generateEventsHTML(data.events)}
                </tbody>
            </table>
        </div>
    </div>
    ${scripts}
</body>
</html>
    `;
  }

  /**
   * Génère les cartes de résumé HTML
   * @private
   * @param {Object} data - Données
   * @returns {string} Cartes HTML
   */
  _generateSummaryCards(data) {
    const stats = data.stats || {};
    
    return `
        <div class="card">
            <div class="card-title">Score de santé</div>
            <div class="card-value">${stats.health?.score || 0}%</div>
            <div class="card-label">${stats.health?.status || 'unknown'}</div>
        </div>
        <div class="card">
            <div class="card-title">Alertes actives</div>
            <div class="card-value">${stats.alerts?.active || 0}</div>
        </div>
        <div class="card">
            <div class="card-title">Événements</div>
            <div class="card-value">${stats.events?.total || 0}</div>
        </div>
        <div class="card">
            <div class="card-title">Uptime</div>
            <div class="card-value">${data.uptime || 'N/A'}</div>
        </div>
    `;
  }

  /**
   * Génère la partie HTML des métriques
   * @private
   * @param {Object} metrics - Métriques
   * @returns {string} HTML
   */
  _generateMetricsHTML(metrics) {
    if (!metrics) return '<p>Aucune métrique</p>';

    return Object.entries(metrics).map(([name, data]) => `
        <div class="metric-card">
            <div class="metric-name">${name}</div>
            <div class="metric-value">${data.current || 0}</div>
            <div class="metric-details">
                <span>min: ${data.min || 0}</span>
                <span>max: ${data.max || 0}</span>
                <span>avg: ${data.average || 0}</span>
            </div>
        </div>
    `).join('');
  }

  /**
   * Génère la partie HTML des alertes
   * @private
   * @param {Object} alerts - Alertes
   * @returns {string} HTML
   */
  _generateAlertsHTML(alerts) {
    if (!alerts?.active?.length) {
      return '<p class="no-data">Aucune alerte active</p>';
    }

    return alerts.active.map(alert => `
        <div class="alert-item alert-${alert.severity}">
            <strong>${alert.title}</strong><br>
            ${alert.message}<br>
            <small>${new Date(alert.createdAt).toLocaleString()}</small>
        </div>
    `).join('');
  }

  /**
   * Génère la partie HTML des événements
   * @private
   * @param {Object} events - Événements
   * @returns {string} HTML
   */
  _generateEventsHTML(events) {
    if (!events?.recent?.length) {
      return '<tr><td colspan="3" class="no-data">Aucun événement</td></tr>';
    }

    return events.recent.slice(0, 20).map(event => `
        <tr>
            <td>${new Date(event.timestamp).toLocaleString()}</td>
            <td><span class="event-type event-${event.type}">${event.type}</span></td>
            <td>${event.data?.message || ''}</td>
        </tr>
    `).join('');
  }

  /**
   * Obtient les styles CSS
   * @private
   * @returns {string} Styles
   */
  _getStyles() {
    return `
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
    .timestamp {
        color: #888;
        margin: 5px 0 0;
    }
    .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    .card {
        background: #2d2d2d;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
    }
    .card-title {
        color: #888;
        font-size: 14px;
        margin-bottom: 10px;
    }
    .card-value {
        font-size: 32px;
        font-weight: bold;
        color: #007bff;
    }
    .card-label {
        color: #888;
        font-size: 12px;
        margin-top: 5px;
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
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
    }
    .metric-card {
        background: #1e1e1e;
        padding: 15px;
        border-radius: 6px;
    }
    .metric-name {
        color: #888;
        font-size: 12px;
        margin-bottom: 5px;
    }
    .metric-value {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 5px;
    }
    .metric-details {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #888;
    }
    .alerts-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .alert-item {
        padding: 10px;
        border-left: 4px solid;
        background: #1e1e1e;
    }
    .alert-critical { border-color: #dc3545; }
    .alert-high { border-color: #f48771; }
    .alert-medium { border-color: #ffd93e; }
    .alert-low { border-color: #17a2b8; }
    .alert-info { border-color: #6c757d; }
    .events-table {
        width: 100%;
        border-collapse: collapse;
    }
    .events-table th {
        text-align: left;
        padding: 8px;
        color: #888;
        border-bottom: 1px solid #3e3e3e;
    }
    .events-table td {
        padding: 8px;
        border-bottom: 1px solid #2d2d2d;
    }
    .event-type {
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
    }
    .event-error { background: #5a2e2e; color: #f48771; }
    .event-warning { background: #5a4e2e; color: #ffd93e; }
    .event-info { background: #1e3a5f; color: #007bff; }
    .no-data {
        text-align: center;
        color: #888;
        padding: 40px;
    }
</style>
    `;
  }

  /**
   * Obtient les scripts JS
   * @private
   * @returns {string} Scripts
   */
  _getScripts() {
    return `
<script>
    // Ajouter des fonctionnalités d'export si nécessaire
    console.log('Rapport de monitoring chargé');
</script>
    `;
  }

  /**
   * Formate la taille
   * @private
   * @param {number} bytes - Octets
   * @returns {string} Taille formatée
   */
  _formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Télécharge un fichier
   * @param {Object} exportResult - Résultat de l'export
   */
  download(exportResult) {
    const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }
}

export default ExportService;
