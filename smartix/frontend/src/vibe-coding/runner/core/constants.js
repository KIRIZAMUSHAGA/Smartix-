/**
 * Constantes du module Runner
 * Définit les types de projets, ports et messages internationalisés
 */

// Types de projets supportés
export const PROJECT_TYPES = {
  REACT: 'react',
  REACT_NATIVE: 'react_native',
  NODE: 'node',
  HTML: 'html',
  STATIC: 'static',
  VUE: 'vue',
  ANGULAR: 'angular',
  SVELTE: 'svelte',
  TYPESCRIPT: 'typescript',
  NEXT: 'next',
  GATSBY: 'gatsby',
  ELEVENTY: 'eleventy'
};

// Ports par défaut pour chaque type de projet
export const DEFAULT_PORTS = {
  [PROJECT_TYPES.REACT]: 3000,
  [PROJECT_TYPES.REACT_NATIVE]: 8081,
  [PROJECT_TYPES.NODE]: 3000,
  [PROJECT_TYPES.HTML]: 5000,
  [PROJECT_TYPES.STATIC]: 5000,
  [PROJECT_TYPES.VUE]: 8080,
  [PROJECT_TYPES.ANGULAR]: 4200,
  [PROJECT_TYPES.SVELTE]: 5000,
  [PROJECT_TYPES.TYPESCRIPT]: 3000,
  [PROJECT_TYPES.NEXT]: 3000,
  [PROJECT_TYPES.GATSBY]: 8000,
  [PROJECT_TYPES.ELEVENTY]: 8080
};

// Extensions de fichiers par type de projet
export const FILE_EXTENSIONS = {
  [PROJECT_TYPES.REACT]: ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss'],
  [PROJECT_TYPES.VUE]: ['.vue', '.js', '.ts', '.css'],
  [PROJECT_TYPES.ANGULAR]: ['.ts', '.html', '.css', '.scss'],
  [PROJECT_TYPES.SVELTE]: ['.svelte', '.js', '.ts', '.css'],
  [PROJECT_TYPES.NODE]: ['.js', '.ts', '.json'],
  [PROJECT_TYPES.HTML]: ['.html', '.css', '.js'],
  [PROJECT_TYPES.STATIC]: ['.html', '.css', '.js', '.jpg', '.png']
};

// Messages internationalisés
export const I18N = {
  fr: {
    // Statuts
    starting: 'Démarrage...',
    running: 'En cours d\'exécution',
    stopped: 'Arrêté',
    building: 'Build en cours...',
    buildSuccess: 'Build terminé avec succès',
    buildFailed: 'Échec du build',
    
    // Types de logs
    error: 'Erreur',
    warning: 'Avertissement',
    info: 'Information',
    success: 'Succès',
    
    // Messages d'erreur
    projectNotFound: 'Projet non trouvé',
    prerequisitesMissing: 'Prérequis manquants',
    sandboxError: 'Erreur dans le sandbox',
    dependencyError: 'Erreur d\'installation des dépendances',
    
    // Actions
    reload: 'Recharger',
    ignore: 'Ignorer',
    clear: 'Effacer',
    stop: 'Arrêter',
    start: 'Démarrer',
    
    // UI
    logs: 'Logs',
    statistics: 'Statistiques',
    console: 'Console',
    environment: 'Environnement',
    performance: 'Performance',
    errors: 'Erreurs',
    
    // Performance
    fps: 'FPS',
    memory: 'Mémoire',
    network: 'Réseau',
    requests: 'Requêtes',
    
    // Suggestions d'erreur
    undefinedFunction: {
      title: 'Fonction non définie',
      description: 'Vous essayez d\'appeler une fonction qui n\'existe pas.',
      fix: 'Vérifiez que la variable est bien une fonction avant de l\'appeler.',
      example: 'if (typeof maFonction === "function") { maFonction(); }'
    },
    undefinedProperty: {
      title: 'Propriété inexistante',
      description: 'Vous essayez d\'accéder à une propriété d\'un objet non défini.',
      fix: 'Vérifiez que l\'objet existe avant d\'accéder à ses propriétés.',
      example: 'if (monObjet && monObjet.maPropriete) { ... }'
    },
    undefinedVariable: {
      title: 'Variable non définie',
      description: 'Vous utilisez une variable qui n\'a pas été déclarée.',
      fix: 'Déclarez la variable avant de l\'utiliser.',
      example: 'let maVariable; // ou const, var'
    },
    syntaxError: {
      title: 'Erreur de syntaxe',
      description: 'Il y a une erreur de syntaxe dans votre code.',
      fix: 'Vérifiez les parenthèses, crochets et virgules.',
      example: 'Vérifiez que toutes les parenthèses sont correctement fermées.'
    }
  },
  
  en: {
    // Status
    starting: 'Starting...',
    running: 'Running',
    stopped: 'Stopped',
    building: 'Building...',
    buildSuccess: 'Build successful',
    buildFailed: 'Build failed',
    
    // Log types
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
    success: 'Success',
    
    // Error messages
    projectNotFound: 'Project not found',
    prerequisitesMissing: 'Prerequisites missing',
    sandboxError: 'Sandbox error',
    dependencyError: 'Dependency installation error',
    
    // Actions
    reload: 'Reload',
    ignore: 'Ignore',
    clear: 'Clear',
    stop: 'Stop',
    start: 'Start',
    
    // UI
    logs: 'Logs',
    statistics: 'Statistics',
    console: 'Console',
    environment: 'Environment',
    performance: 'Performance',
    errors: 'Errors',
    
    // Performance
    fps: 'FPS',
    memory: 'Memory',
    network: 'Network',
    requests: 'Requests',
    
    // Error suggestions
    undefinedFunction: {
      title: 'Undefined function',
      description: 'You are trying to call a function that does not exist.',
      fix: 'Check that the variable is actually a function before calling it.',
      example: 'if (typeof myFunction === "function") { myFunction(); }'
    },
    undefinedProperty: {
      title: 'Undefined property',
      description: 'You are trying to access a property of an undefined object.',
      fix: 'Check that the object exists before accessing its properties.',
      example: 'if (myObject && myObject.myProperty) { ... }'
    },
    undefinedVariable: {
      title: 'Undefined variable',
      description: 'You are using a variable that has not been declared.',
      fix: 'Declare the variable before using it.',
      example: 'let myVariable; // or const, var'
    },
    syntaxError: {
      title: 'Syntax error',
      description: 'There is a syntax error in your code.',
      fix: 'Check parentheses, brackets and commas.',
      example: 'Make sure all parentheses are properly closed.'
    }
  }
};

// Niveaux de log
export const LOG_LEVELS = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success',
  DEBUG: 'debug'
};

// Configuration par défaut
export const DEFAULTS = {
  MAX_LOGS: 1000,
  METRICS_INTERVAL: 1000,
  HOT_RELOAD_PORT: 8080,
  SANDBOX_TIMEOUT: 5000,
  DEPENDENCY_CACHE_TTL: 3600000 // 1 heure
};
