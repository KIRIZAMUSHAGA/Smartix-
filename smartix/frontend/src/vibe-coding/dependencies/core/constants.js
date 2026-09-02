/**
 * Constantes du module DependencyResolver
 * Définit les types, groupes et messages internationalisés
 */

// Groupes de dépendances
export const DEPENDENCY_GROUPS = {
  REACT: 'react',
  VUE: 'vue',
  ANGULAR: 'angular',
  NODE: 'node',
  UTILS: 'utils',
  UI: 'ui',
  STATE: 'state-management',
  ROUTING: 'routing',
  HTTP: 'http-client',
  FORMS: 'forms',
  TESTING: 'testing',
  DATABASE: 'database',
  BUILD: 'build-tools',
  LINTING: 'linting',
  TYPES: 'types'
};

// Méthodes d'installation
export const INSTALLATION_METHODS = {
  NPM: 'npm',
  YARN: 'yarn',
  PNPM: 'pnpm',
  CDN: 'cdn'
};

// Types de dépendances
export const DEPENDENCY_TYPES = {
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
  PEER: 'peer',
  OPTIONAL: 'optional',
  BUNDLED: 'bundled'
};

// Messages internationalisés
export const I18N = {
  fr: {
    // Titres
    dependencies: 'Dépendances',
    installed: 'Installées',
    available: 'Disponibles',
    updates: 'Mises à jour',
    conflicts: 'Conflits',
    
    // Actions
    install: 'Installer',
    uninstall: 'Désinstaller',
    update: 'Mettre à jour',
    search: 'Rechercher',
    analyze: 'Analyser',
    
    // Statuts
    installing: 'Installation en cours...',
    installed_success: 'Installation réussie',
    installed_failed: 'Échec de l\'installation',
    updating: 'Mise à jour en cours...',
    updated: 'Mis à jour',
    
    // Messages
    no_dependencies: 'Aucune dépendance trouvée',
    search_placeholder: 'Rechercher des packages...',
    version_latest: 'dernière version',
    version_outdated: 'mise à jour disponible',
    
    // Erreurs
    error_analyzing: 'Erreur lors de l\'analyse',
    error_installing: 'Erreur lors de l\'installation',
    error_updating: 'Erreur lors de la mise à jour',
    
    // Conflits
    conflict_detected: 'Conflit détecté',
    peer_missing: 'Dépendance peer manquante',
    version_mismatch: 'Incompatibilité de version',
    
    // Descriptions des groupes
    group_react: 'Écosystème React',
    group_vue: 'Écosystème Vue',
    group_angular: 'Écosystème Angular',
    group_node: 'Node.js',
    group_utils: 'Utilitaires',
    group_ui: 'Bibliothèques UI',
    group_state: 'Gestion d\'état',
    group_routing: 'Routage',
    group_http: 'Client HTTP',
    group_forms: 'Formulaires',
    group_testing: 'Tests',
    group_database: 'Base de données',
    group_build: 'Outils de build',
    group_linting: 'Linting/Formatting',
    group_types: 'Types TypeScript'
  },
  
  en: {
    // Titles
    dependencies: 'Dependencies',
    installed: 'Installed',
    available: 'Available',
    updates: 'Updates',
    conflicts: 'Conflicts',
    
    // Actions
    install: 'Install',
    uninstall: 'Uninstall',
    update: 'Update',
    search: 'Search',
    analyze: 'Analyze',
    
    // Status
    installing: 'Installing...',
    installed_success: 'Installation successful',
    installed_failed: 'Installation failed',
    updating: 'Updating...',
    updated: 'Updated',
    
    // Messages
    no_dependencies: 'No dependencies found',
    search_placeholder: 'Search packages...',
    version_latest: 'latest version',
    version_outdated: 'update available',
    
    // Errors
    error_analyzing: 'Error analyzing',
    error_installing: 'Error installing',
    error_updating: 'Error updating',
    
    // Conflicts
    conflict_detected: 'Conflict detected',
    peer_missing: 'Missing peer dependency',
    version_mismatch: 'Version mismatch',
    
    // Group descriptions
    group_react: 'React ecosystem',
    group_vue: 'Vue ecosystem',
    group_angular: 'Angular ecosystem',
    group_node: 'Node.js',
    group_utils: 'Utilities',
    group_ui: 'UI Libraries',
    group_state: 'State management',
    group_routing: 'Routing',
    group_http: 'HTTP client',
    group_forms: 'Forms',
    group_testing: 'Testing',
    group_database: 'Database',
    group_build: 'Build tools',
    group_linting: 'Linting/Formatting',
    group_types: 'TypeScript types'
  }
};

// Configuration par défaut
export const DEFAULTS = {
  CACHE_TTL: 3600000, // 1 heure
  INSTALL_TIMEOUT: 300000, // 5 minutes
  MAX_CONCURRENT_INSTALLS: 3,
  AUTO_ANALYZE: true,
  PREFER_INSTALL_METHOD: INSTALLATION_METHODS.NPM
};

// Extensions de fichiers à analyser
export const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte'];

// Packages natifs Node.js
export const NODE_BUILTINS = [
  'fs', 'path', 'http', 'https', 'url', 'crypto',
  'stream', 'events', 'util', 'os', 'buffer', 'child_process',
  'assert', 'dns', 'net', 'tls', 'zlib', 'punycode',
  'readline', 'repl', 'vm', 'querystring', 'string_decoder'
];
