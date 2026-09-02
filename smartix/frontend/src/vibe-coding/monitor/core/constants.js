
/**
 * Constantes du module Monitor
 * Définit les seuils, types d'événements et configuration
 */

// Seuils d'alerte par défaut
export const THRESHOLDS = {
  /** Seuil CPU en pourcentage */
  cpu: 80,
  
  /** Seuil mémoire en MB */
  memory: 200,
  
  /** Seuil temps de réponse en ms */
  responseTime: 1000,
  
  /** Seuil taux d'erreur par minute */
  errorRate: 5,
  
  /** Seuil FPS minimum */
  fps: 30,
  
  /** Seuil utilisation mémoire en pourcentage */
  memoryPercentage: 80,
  
  /** Seuil latence réseau en ms */
  networkLatency: 500,
  
  /** Seuil taille requête réseau en KB */
  networkSize: 1024
};

// Types d'événements
export const EVENT_TYPES = {
  /** Erreur d'exécution */
  ERROR: 'error',
  
  /** Avertissement */
  WARNING: 'warning',
  
  /** Information */
  INFO: 'info',
  
  /** Métrique de performance */
  PERFORMANCE: 'performance',
  
  /** Métrique mémoire */
  MEMORY: 'memory',
  
  /** Métrique réseau */
  NETWORK: 'network',
  
  /** Métrique de rendu */
  RENDER: 'render',
  
  /** Métrique CPU */
  CPU: 'cpu',
  
  /** Métrique FPS */
  FPS: 'fps',
  
  /** Événement utilisateur */
  USER: 'user',
  
  /** Événement système */
  SYSTEM: 'system'
};

// Niveaux de sévérité
export const SEVERITY_LEVELS = {
  /** Critique - nécessite une action immédiate */
  CRITICAL: 'critical',
  
  /** Élevé - à surveiller de près */
  HIGH: 'high',
  
  /** Moyen - peut nécessiter une attention */
  MEDIUM: 'medium',
  
  /** Bas - informationnel */
  LOW: 'low',
  
  /** Information simple */
  INFO: 'info'
};

// Configuration par défaut
export const DEFAULTS = {
  /** Nombre maximum d'événements en mémoire */
  maxEvents: 1000,
  
  /** Intervalle de surveillance (ms) */
  monitoringInterval: 5000,
  
  /** Durée de conservation des événements (ms) */
  eventRetention: 3600000, // 1 heure
  
  /** Durée de conservation des métriques (ms) */
  metricRetention: 86400000, // 24 heures
  
  /** Nombre maximum d'alertes par minute */
  maxAlertsPerMinute: 10,
  
  /** Cooldown entre alertes similaires (ms) */
  alertCooldown: 15000,
  
  /** Activer la détection d'anomalies */
  enableAnomalyDetection: true,
  
  /** Activer les notifications */
  enableNotifications: true,
  
  /** Seuil de sensibilité des anomalies (0-1) */
  anomalySensitivity: 0.8
};

// Périodes de rapport
export const REPORT_PERIODS = {
  /** Dernière heure */
  LAST_HOUR: '1h',
  
  /** Dernières 6 heures */
  LAST_6_HOURS: '6h',
  
  /** Dernières 24 heures */
  LAST_24_HOURS: '24h',
  
  /** 7 derniers jours */
  LAST_7_DAYS: '7d',
  
  /** 30 derniers jours */
  LAST_30_DAYS: '30d'
};

// Formats d'export
export const EXPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv',
  HTML: 'html',
  PDF: 'pdf'
};

// Unités de métriques
export const METRIC_UNITS = {
  cpu: '%',
  memory: 'MB',
  fps: 'fps',
  responseTime: 'ms',
  networkLatency: 'ms',
  networkSize: 'KB',
  diskUsage: 'GB',
  temperature: '°C'
};

// Couleurs par sévérité (pour UI)
export const SEVERITY_COLORS = {
  [SEVERITY_LEVELS.CRITICAL]: '#dc3545',
  [SEVERITY_LEVELS.HIGH]: '#f48771',
  [SEVERITY_LEVELS.MEDIUM]: '#ffd93e',
  [SEVERITY_LEVELS.LOW]: '#17a2b8',
  [SEVERITY_LEVELS.INFO]: '#6c757d'
};

// Types d'anomalies
export const ANOMALY_TYPES = {
  /** Pic anormal vers le haut */
  SPIKE: 'spike',
  /** Chute anormale vers le bas */
  DROP: 'drop',
  /** Valeur hors norme isolée */
  OUTLIER: 'outlier',
  /** Rupture de pattern */
  PATTERN_BREAK: 'pattern_break'
};

// Types de tendances
export const TREND_TYPES = {
  /** Tendance stable */
  STABLE: 'stable',
  /** Tendance à la hausse */
  INCREASING: 'increasing',
  /** Tendance à la baisse */
  DECREASING: 'decreasing',
  /** Comportement volatile */
  VOLATILE: 'volatile',
  /** Comportement cyclique */
  CYCLICAL: 'cyclical'
};

// Icônes par type d'événement (pour UI)
export const EVENT_ICONS = {
  [EVENT_TYPES.ERROR]: '❌',
  [EVENT_TYPES.WARNING]: '⚠️',
  [EVENT_TYPES.INFO]: 'ℹ️',
  [EVENT_TYPES.PERFORMANCE]: '⚡',
  [EVENT_TYPES.MEMORY]: '💾',
  [EVENT_TYPES.NETWORK]: '🌐',
  [EVENT_TYPES.RENDER]: '🎨',
  [EVENT_TYPES.CPU]: '⚙️',
  [EVENT_TYPES.FPS]: '🎮',
  [EVENT_TYPES.USER]: '👤',
  [EVENT_TYPES.SYSTEM]: '🖥️'
};
