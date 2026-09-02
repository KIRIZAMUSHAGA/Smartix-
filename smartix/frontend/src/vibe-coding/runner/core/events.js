/**
 * Énumérations des événements du module Runner
 * Centralise tous les types d'événements pour éviter les erreurs de typo
 */

export const RUNNER_EVENTS = {
  // Événements de cycle de vie
  INITIALIZED: 'initialized',
  DESTROYED: 'destroyed',
  
  // Événements d'application
  APP_STARTED: 'appStarted',
  APP_STOPPED: 'appStopped',
  APP_RESTARTED: 'appRestarted',
  APP_ERROR: 'appError',
  
  // Événements de build
  BUILD_STARTED: 'buildStarted',
  BUILD_PROGRESS: 'buildProgress',
  BUILD_COMPLETED: 'buildCompleted',
  BUILD_FAILED: 'buildFailed',
  
  // Événements de hot reload
  HOT_RELOAD: 'hotReload',
  HOT_RELOAD_STARTED: 'hotReloadStarted',
  HOT_RELOAD_COMPLETED: 'hotReloadCompleted',
  HOT_RELOAD_FAILED: 'hotReloadFailed',
  FILE_CHANGED: 'fileChanged',
  
  // Événements de sandbox
  SANDBOX_READY: 'sandboxReady',
  SANDBOX_ERROR: 'sandboxError',
  SANDBOX_MESSAGE: 'sandboxMessage',
  
  // Événements de log
  NEW_LOG: 'newLog',
  LOGS_CLEARED: 'logsCleared',
  
  // Événements de performance
  METRICS_UPDATED: 'metricsUpdated',
  PERFORMANCE_WARNING: 'performanceWarning',
  LONG_TASK_DETECTED: 'longTaskDetected',
  
  // Événements d'environnement
  ENVIRONMENT_CHANGED: 'environmentChanged',
  VARIABLE_CHANGED: 'variableChanged',
  FEATURE_CHANGED: 'featureChanged',
  
  // Événements d'erreur
  ERROR_CAPTURED: 'errorCaptured',
  ERROR_IGNORED: 'errorIgnored',
  
  // Événements de dépendances
  DEPENDENCY_INSTALL_STARTED: 'dependencyInstallStarted',
  DEPENDENCY_INSTALL_PROGRESS: 'dependencyInstallProgress',
  DEPENDENCY_INSTALL_COMPLETED: 'dependencyInstallCompleted',
  DEPENDENCY_INSTALL_FAILED: 'dependencyInstallFailed'
};

// Types de logs
export const LOG_TYPES = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success',
  DEBUG: 'debug'
};

// États des processus
export const PROCESS_STATES = {
  IDLE: 'idle',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error'
};

// États de build
export const BUILD_STATES = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Types de fichiers pour hot reload
export const HOT_RELOAD_TYPES = {
  CSS: 'css',
  JS: 'js',
  JSX: 'jsx',
  TS: 'ts',
  TSX: 'tsx',
  HTML: 'html',
  VUE: 'vue',
  SVELTE: 'svelte'
};
