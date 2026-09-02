/**
 * RuntimeMonitor
 * Classe principale orchestrant tous les sous-systèmes de surveillance
 */

import EventEmitter from 'events';
import { THRESHOLDS, DEFAULTS, SEVERITY_LEVELS } from '../monitor/core/constants';
import { MONITOR_EVENTS } from '../monitor/core/events';
import { CPUCollector } from '../monitor/collectors/CPUCollector';
import { MemoryCollector } from '../monitor/collectors/MemoryCollector';
import { FPSCollector } from '../monitor/collectors/FPSCollector';
import { NetworkCollector } from '../monitor/collectors/NetworkCollector';
import { ErrorCollector } from '../monitor/collectors/ErrorCollector';
import { ThresholdAnalyzer } from '../monitor/analyzers/ThresholdAnalyzer';
import { TrendAnalyzer } from '../monitor/analyzers/TrendAnalyzer';
import { AnomalyDetector } from '../monitor/analyzers/AnomalyDetector';
import { AlertManager } from '../monitor/alerts/AlertManager';
import { CooldownManager } from '../monitor/alerts/CooldownManager';
import { NotificationService } from '../monitor/alerts/NotificationService';
import { EventStore } from '../monitor/storage/EventStore';
import { MetricStore } from '../monitor/storage/MetricStore';
import { AlertStore } from '../monitor/storage/AlertStore';
import { ReportGenerator } from '../monitor/reporters/ReportGenerator';
import { StatsReporter } from '../monitor/reporters/StatsReporter';

export class RuntimeMonitor extends EventEmitter {
  /**
   * Crée une instance de RuntimeMonitor
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      projectId: null,
      ...DEFAULTS,
      ...options
    };

    this.initialized = false;
    this.projectId = this.options.projectId;
    
    // Initialiser les collecteurs
    this.collectors = {
      cpu: new CPUCollector(this.options),
      memory: new MemoryCollector(this.options),
      fps: new FPSCollector(this.options),
      network: new NetworkCollector(this.options),
      error: new ErrorCollector(this.options)
    };

    // Initialiser les analyseurs
    this.analyzers = {
      threshold: new ThresholdAnalyzer(this.options),
      trend: new TrendAnalyzer(this.options),
      anomaly: new AnomalyDetector(this.options)
    };

    // Initialiser la gestion des alertes
    this.alertManager = new AlertManager(this.options);
    this.cooldownManager = new CooldownManager(this.options);
    this.notificationService = new NotificationService(this.options);

    // Initialiser le stockage
    this.eventStore = new EventStore(this.options);
    this.metricStore = new MetricStore(this.options);
    this.alertStore = new AlertStore(this.options);

    // Initialiser les rapporteurs
    this.reportGenerator = new ReportGenerator(this.options);
    this.statsReporter = new StatsReporter(this.options);

    this.monitoringInterval = null;
    this.stats = {
      startTime: null,
      lastUpdate: null,
      totalEvents: 0,
      totalAlerts: 0
    };

    this._setupListeners();
  }

  /**
   * Configure les écouteurs internes
   * @private
   */
  _setupListeners() {
    // Relayer les événements des collecteurs
    Object.entries(this.collectors).forEach(([name, collector]) => {
      collector.on('metric', (metric) => {
        this.emit(MONITOR_EVENTS.METRIC_RECORDED, { collector: name, ...metric });
        this._processMetric(name, metric);
      });

      collector.on('error', (error) => {
        this.logError(error, { collector: name });
      });
    });

    // Écouter les alertes
    this.alertManager.on('alert', (alert) => {
      this.emit(MONITOR_EVENTS.ALERT_CREATED, alert);
      this.notificationService.notify(alert);
    });
  }

  /**
   * Initialise le moniteur
   * @param {string} projectId - ID du projet
   * @returns {Promise<void>}
   */
  async initialize(projectId) {
    if (this.initialized) return;

    try {
      this.projectId = projectId || this.projectId;
      if (!this.projectId) {
        throw new Error('Project ID requis');
      }

      this.stats.startTime = Date.now();

      // Démarrer tous les collecteurs
      await Promise.all(
        Object.values(this.collectors).map(c => c.start())
      );

      // Démarrer la surveillance périodique
      this._startMonitoring();

      this.initialized = true;
      this.emit(MONITOR_EVENTS.INITIALIZED, { projectId: this.projectId });

      this.logInfo('Moniteur initialisé', { projectId });

    } catch (error) {
      this.emit(MONITOR_EVENTS.COLLECTOR_ERROR, { error: error.message });
      throw error;
    }
  }

  /**
   * Arrête le moniteur
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Arrêter tous les collecteurs
    Object.values(this.collectors).forEach(c => c.stop());

    this.initialized = false;
    this.emit(MONITOR_EVENTS.SHUTDOWN);
    this.logInfo('Moniteur arrêté');
  }

  /**
   * Démarre la surveillance périodique
   * @private
   */
  _startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this._performMonitoringCheck();
    }, this.options.monitoringInterval);
  }

  /**
   * Effectue les vérifications périodiques
   * @private
   */
  _performMonitoringCheck() {
    // Analyser les seuils
    const thresholdAlerts = this.analyzers.threshold.analyze(
      this.metricStore.getAll()
    );

    // Analyser les tendances
    const trendAlerts = this.analyzers.trend.analyze(
      this.metricStore.getHistory()
    );

    // Analyser les anomalies
    const anomalyAlerts = this.analyzers.anomaly.analyze(
      this.metricStore.getHistory()
    );

    // Créer les alertes avec gestion du cooldown
    [...thresholdAlerts, ...trendAlerts, ...anomalyAlerts].forEach(alert => {
      if (this.cooldownManager.canSend(alert.type)) {
        this.createAlert(alert);
      }
    });

    // Nettoyer les anciennes données
    this._cleanupOldData();
  }

  /**
   * Nettoie les anciennes données
   * @private
   */
  _cleanupOldData() {
    const cutoff = Date.now() - this.options.eventRetention;
    this.eventStore.cleanup(cutoff);
    this.metricStore.cleanup(cutoff);
  }

  /**
   * Traite une nouvelle métrique
   * @private
   * @param {string} name - Nom de la métrique
   * @param {Object} metric - Métrique
   */
  _processMetric(name, metric) {
    this.metricStore.add(name, metric);
    this.stats.lastUpdate = Date.now();

    // Vérifier les seuils en temps réel
    const threshold = THRESHOLDS[name];
    if (threshold && metric.value > threshold) {
      this.createAlert({
        type: 'threshold_crossed',
        title: `Seuil ${name} dépassé`,
        message: `${name} = ${metric.value} (seuil: ${threshold})`,
        severity: SEVERITY_LEVELS.HIGH,
        data: { metric: name, value: metric.value, threshold }
      });
    }
  }

  /**
   * Enregistre un événement
   * @param {string} type - Type d'événement
   * @param {any} data - Données
   * @param {string} severity - Niveau de sévérité
   * @returns {Object} Événement créé
   */
  logEvent(type, data, severity = SEVERITY_LEVELS.INFO) {
    const event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      data,
      timestamp: Date.now(),
      projectId: this.projectId
    };

    this.eventStore.add(event);
    this.stats.totalEvents++;
    this.emit(MONITOR_EVENTS.EVENT_ADDED, event);

    return event;
  }

  /**
   * Enregistre une erreur
   * @param {Error|string} error - Erreur
   * @param {Object} context - Contexte
   * @returns {Object} Événement créé
   */
  logError(error, context = {}) {
    const message = error?.message || String(error);
    const stack = error?.stack || null;

    return this.logEvent(
      'error',
      { message, stack, ...context },
      SEVERITY_LEVELS.HIGH
    );
  }

  /**
   * Enregistre un avertissement
   * @param {string} message - Message
   * @param {Object} context - Contexte
   * @returns {Object} Événement créé
   */
  logWarning(message, context = {}) {
    return this.logEvent(
      'warning',
      { message, ...context },
      SEVERITY_LEVELS.MEDIUM
    );
  }

  /**
   * Enregistre une information
   * @param {string} message - Message
   * @param {Object} context - Contexte
   * @returns {Object} Événement créé
   */
  logInfo(message, context = {}) {
    return this.logEvent(
      'info',
      { message, ...context },
      SEVERITY_LEVELS.INFO
    );
  }

  /**
   * Enregistre une métrique
   * @param {string} name - Nom de la métrique
   * @param {number} value - Valeur
   */
  recordMetric(name, value) {
    if (this.collectors[name]) {
      this.collectors[name].record(value);
    } else {
      this.metricStore.add(name, { value, timestamp: Date.now() });
    }
  }

  /**
   * Crée une alerte
   * @param {Object} alert - Alerte
   * @returns {Object} Alerte créée
   */
  createAlert(alert) {
    const newAlert = this.alertManager.create({
      ...alert,
      timestamp: Date.now(),
      projectId: this.projectId
    });

    this.stats.totalAlerts++;
    return newAlert;
  }

  /**
   * Acquitte une alerte
   * @param {string} alertId - ID de l'alerte
   * @returns {boolean} Succès
   */
  acknowledgeAlert(alertId) {
    const acknowledged = this.alertManager.acknowledge(alertId);
    if (acknowledged) {
      this.emit(MONITOR_EVENTS.ALERT_ACKNOWLEDGED, { alertId });
    }
    return acknowledged;
  }

  /**
   * Obtient les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return this.statsReporter.generate({
      ...this.stats,
      events: this.eventStore.getStats(),
      metrics: this.metricStore.getStats(),
      alerts: this.alertStore.getStats(),
      uptime: this._formatDuration(Date.now() - this.stats.startTime)
    });
  }

  /**
   * Obtient les événements récents
   * @param {number} limit - Nombre maximum
   * @param {string} type - Type d'événement (optionnel)
   * @returns {Array} Événements
   */
  getRecentEvents(limit = 100, type = null) {
    return this.eventStore.getRecent(limit, type);
  }

  /**
   * Obtient les alertes non acquittées
   * @returns {Array} Alertes
   */
  getUnacknowledgedAlerts() {
    return this.alertStore.getUnacknowledged();
  }

  /**
   * Génère un rapport
   * @param {Object} options - Options
   * @returns {Object} Rapport
   */
  generateReport(options = {}) {
    const report = this.reportGenerator.generate({
      projectId: this.projectId,
      period: options.period || '24h',
      events: this.eventStore.getAll(),
      metrics: this.metricStore.getAll(),
      alerts: this.alertStore.getAll(),
      ...options
    });

    this.emit(MONITOR_EVENTS.REPORT_GENERATED, report);
    return report;
  }

  /**
   * Exporte les données
   * @param {string} format - Format d'export
   * @returns {string} Données exportées
   */
  exportData(format = 'json') {
    const data = {
      projectId: this.projectId,
      generatedAt: Date.now(),
      stats: this.getStats(),
      events: this.eventStore.getAll(),
      metrics: this.metricStore.getAll(),
      alerts: this.alertStore.getAll()
    };

    return this.reportGenerator.export(data, format);
  }

  /**
   * Formate une durée
   * @private
   * @param {number} ms - Millisecondes
   * @returns {string} Durée formatée
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Vérifie si le moniteur est initialisé
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Réinitialise le moniteur
   */
  reset() {
    this.shutdown();
    this.eventStore.clear();
    this.metricStore.clear();
    this.alertStore.clear();
    this.stats = {
      startTime: null,
      lastUpdate: null,
      totalEvents: 0,
      totalAlerts: 0
    };
  }
}

export const runtimeMonitor = new RuntimeMonitor();
export default runtimeMonitor;
