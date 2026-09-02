/**
 * Validateur de projets pour le module Vibe-Coding
 * 
 * Vérifie l'intégrité et la validité des projets
 * Fonctions:
 * - validateProjectStructure() : Structure de base
 * - validateProjectFiles() : Fichiers requis
 * - validateProjectConfig() : Configuration
 * - validateProjectDependencies() : Dépendances
 * - validateProjectAssets() : Assets
 */

// =============================
// CONFIGURATION
// =============================

// Extensions de fichiers autorisées par type
const ALLOWED_EXTENSIONS = {
  code: ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css'],
  asset: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.mp4', '.mp3'],
  config: ['.json', '.yml', '.yaml', '.env']
};

// Fichiers requis par type de projet
const REQUIRED_FILES = {
  react: ['package.json', 'src/App.js', 'src/index.js'],
  react_native: ['package.json', 'App.js', 'index.js'],
  node: ['package.json', 'index.js'],
  html: ['index.html']
};

// Structure de projet minimale
const MINIMUM_STRUCTURE = {
  directories: ['src', 'public', 'assets'],
  files: ['package.json', 'README.md']
};

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { parseId, isValidId } from './idGenerator';

// =============================
// VALIDATION DE BASE
// =============================

/**
 * Vérifie si une chaîne est un nom de projet valide
 * @param {string} name - Nom du projet
 * @returns {Object} - { isValid, errors }
 */
export const validateProjectName = (name) => {
  const errors = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Le nom du projet est requis');
    return { isValid: false, errors };
  }
  
  if (name.length < 3) {
    errors.push('Le nom du projet doit contenir au moins 3 caractères');
  }
  
  if (name.length > 50) {
    errors.push('Le nom du projet ne peut pas dépasser 50 caractères');
  }
  
  // Caractères autorisés : lettres, chiffres, espaces, tirets, underscores
  const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
  if (!validNameRegex.test(name)) {
    errors.push('Le nom contient des caractères non autorisés (utilisez lettres, chiffres, espaces, - ou _)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Vérifie la structure de base d'un projet
 * @param {Object} project - Objet projet
 * @returns {Object} - { isValid, errors, warnings }
 */
export const validateProjectStructure = (project) => {
  const errors = [];
  const warnings = [];
  
  if (!project) {
    errors.push('Le projet est requis');
    return { isValid: false, errors, warnings };
  }
  
  // Vérifier l'ID
  if (!project.id) {
    errors.push('L\'ID du projet est requis');
  } else if (!isValidId(project.id, 'proj')) {
    errors.push('L\'ID du projet est invalide');
  }
  
  // Vérifier le nom
  const nameValidation = validateProjectName(project.name);
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  }
  
  // Vérifier la date de création
  if (!project.createdAt) {
    errors.push('La date de création est requise');
  } else if (isNaN(new Date(project.createdAt).getTime())) {
    errors.push('La date de création est invalide');
  }
  
  // Vérifier la date de mise à jour (optionnelle)
  if (project.updatedAt && isNaN(new Date(project.updatedAt).getTime())) {
    errors.push('La date de mise à jour est invalide');
  }
  
  // Vérifier le type de projet
  const validTypes = ['react', 'react_native', 'node', 'html', 'unknown'];
  if (!project.type || !validTypes.includes(project.type)) {
    warnings.push('Type de projet non spécifié ou invalide');
  }
  
  // Vérifier l'état
  const validStates = ['draft', 'generated', 'editing', 'running', 'published', 'archived'];
  if (!project.state || !validStates.includes(project.state)) {
    warnings.push('État du projet non spécifié ou invalide');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// =============================
// VALIDATION DES FICHIERS
// =============================

/**
 * Vérifie la structure des fichiers
 * @param {Object} files - Objet avec les fichiers
 * @param {string} projectType - Type de projet
 * @returns {Object} - { isValid, missingFiles, extraFiles }
 */
export const validateProjectFiles = (files, projectType = 'react') => {
  const missingFiles = [];
  const extraFiles = [];
  const invalidExtensions = [];
  
  if (!files || typeof files !== 'object') {
    return {
      isValid: false,
      missingFiles: ['Aucun fichier fourni'],
      extraFiles: [],
      invalidExtensions: []
    };
  }
  
  const fileList = Object.keys(files);
  
  // Vérifier les fichiers requis
  const required = REQUIRED_FILES[projectType] || REQUIRED_FILES.react;
  required.forEach(requiredFile => {
    if (!fileList.includes(requiredFile)) {
      missingFiles.push(requiredFile);
    }
  });
  
  // Vérifier les extensions
  fileList.forEach(file => {
    const ext = file.substring(file.lastIndexOf('.'));
    if (ext && !ALLOWED_EXTENSIONS.code.includes(ext) && 
        !ALLOWED_EXTENSIONS.asset.includes(ext) && 
        !ALLOWED_EXTENSIONS.config.includes(ext)) {
      invalidExtensions.push(file);
    }
  });
  
  return {
    isValid: missingFiles.length === 0 && invalidExtensions.length === 0,
    missingFiles,
    extraFiles,
    invalidExtensions
  };
};

// =============================
// VALIDATION DE LA CONFIGURATION
// =============================

/**
 * Vérifie la configuration du projet
 * @param {Object} config - Configuration
 * @returns {Object} - { isValid, errors }
 */
export const validateProjectConfig = (config) => {
  const errors = [];
  
  if (!config) {
    errors.push('La configuration est requise');
    return { isValid: false, errors };
  }
  
  // Vérifier package.json
  if (config.packageJson) {
    try {
      const pkg = typeof config.packageJson === 'string' 
        ? JSON.parse(config.packageJson) 
        : config.packageJson;
      
      if (!pkg.name) {
        errors.push('package.json: "name" est requis');
      }
      
      if (!pkg.version) {
        errors.push('package.json: "version" est requise');
      }
      
      if (!pkg.dependencies && !pkg.devDependencies) {
        errors.push('package.json: aucune dépendance trouvée');
      }
    } catch (e) {
      errors.push('package.json: format JSON invalide');
    }
  } else {
    errors.push('package.json est requis');
  }
  
  // Vérifier app.json pour React Native
  if (config.appJson) {
    try {
      const app = typeof config.appJson === 'string'
        ? JSON.parse(config.appJson)
        : config.appJson;
      
      if (!app.name) {
        errors.push('app.json: "name" est requis');
      }
      
      if (!app.displayName) {
        errors.push('app.json: "displayName" est requis');
      }
    } catch (e) {
      errors.push('app.json: format JSON invalide');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// =============================
// VALIDATION DES DÉPENDANCES
// =============================

/**
 * Vérifie les dépendances du projet
 * @param {Object} dependencies - Dépendances
 * @returns {Object} - { isValid, missing, conflicts }
 */
export const validateProjectDependencies = (dependencies) => {
  const missing = [];
  const conflicts = [];
  
  if (!dependencies) {
    return {
      isValid: false,
      missing: ['Aucune dépendance fournie'],
      conflicts: []
    };
  }
  
  // Dépendances minimales par type
  const minimalDeps = {
    react: ['react', 'react-dom'],
    react_native: ['react', 'react-native'],
    node: []
  };
  
  const projectType = dependencies._type || 'react';
  const minimal = minimalDeps[projectType] || [];
  
  minimal.forEach(dep => {
    if (!dependencies[dep]) {
      missing.push(dep);
    }
  });
  
  // Vérifier les conflits de versions (exemple simple)
  if (dependencies.react && dependencies['react-native'] && 
      dependencies.react.version && dependencies['react-native'].version) {
    // Vérifier compatibilité React/React Native
    const reactVersion = dependencies.react.version;
    const rnVersion = dependencies['react-native'].version;
    
    if (reactVersion.startsWith('18') && rnVersion.startsWith('0.7')) {
      conflicts.push('React 18 nécessite React Native 0.71+');
    }
  }
  
  return {
    isValid: missing.length === 0 && conflicts.length === 0,
    missing,
    conflicts
  };
};

// =============================
// VALIDATION DES ASSETS
// =============================

/**
 * Vérifie les assets du projet
 * @param {Object} assets - Assets
 * @returns {Object} - { isValid, errors }
 */
export const validateProjectAssets = (assets) => {
  const errors = [];
  
  if (!assets) {
    return { isValid: true, errors: [] }; // Les assets sont optionnels
  }
  
  Object.entries(assets).forEach(([key, asset]) => {
    if (!asset.url && !asset.data) {
      errors.push(`Asset "${key}": contenu manquant`);
    }
    
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      errors.push(`Asset "${key}": trop volumineux (max 10MB)`);
    }
    
    if (asset.type && !asset.type.startsWith('image/') && 
        !asset.type.startsWith('video/') && !asset.type.startsWith('audio/')) {
      errors.push(`Asset "${key}": type non supporté`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// =============================
// VALIDATION COMPLÈTE
// =============================

/**
 * Validation complète d'un projet
 * @param {Object} project - Projet complet
 * @returns {Object} - Rapport de validation détaillé
 */
export const validateProject = (project) => {
  const report = {
    isValid: false,
    structure: { isValid: false, errors: [], warnings: [] },
    files: { isValid: false, missingFiles: [], extraFiles: [], invalidExtensions: [] },
    config: { isValid: false, errors: [] },
    dependencies: { isValid: false, missing: [], conflicts: [] },
    assets: { isValid: true, errors: [] },
    timestamp: new Date().toISOString(),
    projectId: project?.id || null
  };
  
  // Valider la structure
  report.structure = validateProjectStructure(project);
  
  // Valider les fichiers si présents
  if (project.files) {
    report.files = validateProjectFiles(project.files, project.type);
  } else {
    report.files.isValid = false;
    report.files.missingFiles = ['Aucun fichier fourni'];
  }
  
  // Valider la configuration
  if (project.config) {
    report.config = validateProjectConfig(project.config);
  } else {
    report.config.isValid = false;
    report.config.errors = ['Configuration manquante'];
  }
  
  // Valider les dépendances
  if (project.dependencies) {
    report.dependencies = validateProjectDependencies(project.dependencies);
  } else {
    report.dependencies.isValid = false;
    report.dependencies.missing = ['Dépendances manquantes'];
  }
  
  // Valider les assets (optionnel)
  if (project.assets) {
    report.assets = validateProjectAssets(project.assets);
  }
  
  // Score global
  report.isValid = 
    report.structure.isValid &&
    report.files.isValid &&
    report.config.isValid &&
    report.dependencies.isValid &&
    report.assets.isValid;
  
  // Score de qualité (0-100)
  let score = 0;
  if (report.structure.isValid) score += 30;
  if (report.files.isValid) score += 25;
  if (report.config.isValid) score += 20;
  if (report.dependencies.isValid) score += 15;
  if (report.assets.isValid) score += 10;
  
  report.qualityScore = score;
  report.qualityLabel = score >= 80 ? 'Excellent' :
                        score >= 60 ? 'Bon' :
                        score >= 40 ? 'Moyen' :
                        score >= 20 ? 'Faible' : 'Critique';
  
  return report;
};

// =============================
// VALIDATION RAPIDE
// =============================

/**
 * Validation rapide pour les opérations courantes
 * @param {Object} project - Projet
 * @returns {boolean} - True si le projet est valide pour l'exécution
 */
export const isProjectRunnable = (project) => {
  if (!project) return false;
  
  // Vérifications minimales pour lancer le projet
  const hasPackageJson = project.files && project.files['package.json'];
  const hasEntryPoint = project.type === 'react' ? 
    (project.files && (project.files['src/App.js'] || project.files['src/index.js'])) :
    (project.files && project.files['index.js']);
  
  return !!(project.id && project.name && hasPackageJson && hasEntryPoint);
};

/**
 * Validation rapide pour la publication
 * @param {Object} project - Projet
 * @returns {boolean} - True si le projet peut être publié
 */
export const isProjectPublishable = (project) => {
  if (!project) return false;
  
  // Un projet publiable doit avoir une version et une description
  const hasVersion = project.version && project.version !== '0.0.0';
  const hasDescription = project.description && project.description.length > 10;
  const hasConfig = project.config && project.config.packageJson;
  
  return !!(project.id && project.name && hasVersion && hasDescription && hasConfig);
};

// =============================
// EXPORT PAR DÉFAUT
// =============================
export default {
  validateProjectName,
  validateProjectStructure,
  validateProjectFiles,
  validateProjectConfig,
  validateProjectDependencies,
  validateProjectAssets,
  validateProject,
  isProjectRunnable,
  isProjectPublishable
};

export const projectValidator = { validateProject, validateProjectName, validateProjectStructure, validateProjectFiles, validateProjectConfig, validateProjectDependencies, validateProjectAssets, isProjectRunnable, isProjectPublishable };
