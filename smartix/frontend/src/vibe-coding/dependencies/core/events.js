/**
 * Énumérations des événements du module DependencyResolver
 */

export const DEPENDENCY_EVENTS = {
  // Analyse
  ANALYSIS_STARTED: 'analysis:started',
  ANALYSIS_COMPLETED: 'analysis:completed',
  ANALYSIS_FAILED: 'analysis:failed',
  
  // Installation
  INSTALL_STARTED: 'install:started',
  INSTALL_PROGRESS: 'install:progress',
  INSTALL_COMPLETED: 'install:completed',
  INSTALL_FAILED: 'install:failed',
  
  // Mise à jour
  UPDATE_STARTED: 'update:started',
  UPDATE_COMPLETED: 'update:completed',
  UPDATE_FAILED: 'update:failed',
  
  // Désinstallation
  UNINSTALL_STARTED: 'uninstall:started',
  UNINSTALL_COMPLETED: 'uninstall:completed',
  
  // Cache
  CACHE_HIT: 'cache:hit',
  CACHE_MISS: 'cache:miss',
  CACHE_CLEARED: 'cache:cleared',
  
  // Conflits
  CONFLICT_DETECTED: 'conflict:detected',
  CONFLICT_RESOLVED: 'conflict:resolved',
  
  // Base de connaissances
  KNOWLEDGE_UPDATED: 'knowledge:updated',
  KNOWLEDGE_SYNCED: 'knowledge:synced',
  
  // Version
  VERSION_CHECKED: 'version:checked',
  VERSION_OUTDATED: 'version:outdated',
  
  // Import
  IMPORT_DETECTED: 'import:detected',
  IMPORT_MISSING: 'import:missing'
};

// Niveaux de conflit
export const CONFLICT_LEVELS = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Types de conflits
export const CONFLICT_TYPES = {
  PEER_MISSING: 'peer-missing',
  VERSION_MISMATCH: 'version-mismatch',
  DUPLICATE: 'duplicate',
  INCOMPATIBLE: 'incompatible',
  DEPRECATED: 'deprecated'
};

// Statuts d'installation
export const INSTALL_STATUS = {
  PENDING: 'pending',
  INSTALLING: 'installing',
  INSTALLED: 'installed',
  FAILED: 'failed',
  UPDATING: 'updating',
  UNINSTALLING: 'uninstalling'
};

// Sources d'information
export const INFO_SOURCES = {
  NPM_REGISTRY: 'npm-registry',
  CACHE: 'cache',
  KNOWLEDGE_BASE: 'knowledge-base',
  USER_DEFINED: 'user-defined'
};
