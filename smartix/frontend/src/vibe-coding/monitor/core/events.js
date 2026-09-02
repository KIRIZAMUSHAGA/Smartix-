/**
 * Énumérations des événements du module Monitor
 */

// Événements du moniteur
export const MONITOR_EVENTS = {
  // Initialisation
  INITIALIZED: 'initialized',
  SHUTDOWN: 'shutdown',
  
  // Événements
  EVENT_ADDED: 'event:added',
  EVENT_CLEANED: 'event:cleaned',
  
  // Alertes
  ALERT_CREATED: 'alert:created',
  ALERT_ACKNOWLEDGED: 'alert:acknowledged',
  ALERT_RESOLVED: 'alert:resolved',
  
  // Métriques
  METRIC_RECORDED: 'metric:recorded',
  METRIC_THRESHOLD_CROSSED: 'metric:threshold_crossed',
  
  // Analyse
  ANOMALY_DETECTED: 'anomaly:detected',
  TREND_DETECTED: 'trend:detected',
  
  // Collecteurs
  COLLECTOR_STARTED: 'collector:started',
  COLLECTOR_STOPPED: 'collector:stopped',
  COLLECTOR_ERROR: 'collector:error',
  
  // Rapport
  REPORT_GENERATED: 'report:generated',
  REPORT_EXPORTED: 'report:exported'
};

// Statuts des collecteurs
export const COLLECTOR_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error'
};

// Types de tendances
export const TREND_TYPES = {
  INCREASING: 'increasing',
  DECREASING: 'decreasing',
  STABLE: 'stable',
  VOLATILE: 'volatile',
  CYCLICAL: 'cyclical'
};

// Types d'anomalies
export const ANOMALY_TYPES = {
  SPIKE: 'spike',
  DROP: 'drop',
  OUTLIER: 'outlier',
  PATTERN_BREAK: 'pattern_break',
  THRESHOLD_BREACH: 'threshold_breach'
};

// Priorités d'alerte
export const ALERT_PRIORITIES = {
  IMMEDIATE: 'immediate',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};
