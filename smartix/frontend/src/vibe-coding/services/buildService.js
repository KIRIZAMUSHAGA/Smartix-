/**
 * Service de build pour le module Vibe-Coding
 * 
 * Rôle: Compiler, bundler et optimiser les projets
 * - Build pour différents frameworks (React, React Native, Node, static)
 * - Gestion des dépendances
 * - Compilation TypeScript/JSX
 * - Optimisation et minification
 */

import { useState, useEffect, useCallback } from "react";
import { projectManager } from '../core/projectManager';
import { dependencyResolver } from '../runtime/dependencyResolver';
import { generateBuildId } from '../utils/idGenerator';
import { projectValidator } from '../utils/projectValidator';
import { crypto } from '../utils/crypto';

// =============================
// CONFIGURATION
// =============================

export const BUILD_TYPES = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  ANALYZE: 'analyze'
};

export const TARGET_ENVS = {
  WEB: 'web',
  NODE: 'node',
  REACT_NATIVE: 'react-native'
};

export const BUILD_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  INSTALLING: 'installing',
  COMPILING: 'compiling',
  BUNDLING: 'bundling',
  OPTIMIZING: 'optimizing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const PROJECT_CONFIG = {
  react: {
    entry: 'src/index.js',
    output: 'build',
    framework: 'react',
    bundler: 'webpack',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.css']
  },
  'react-native': {
    entry: 'index.js',
    output: 'build',
    framework: 'react-native',
    bundler: 'metro',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  },
  node: {
    entry: 'index.js',
    output: 'dist',
    framework: 'node',
    bundler: 'esbuild',
    extensions: ['.js', '.ts', '.json']
  },
  html: {
    entry: 'index.html',
    output: 'dist',
    framework: 'static',
    bundler: 'copy',
    extensions: ['.html', '.css', '.js']
  },
  vue: {
    entry: 'src/main.js',
    output: 'dist',
    framework: 'vue',
    bundler: 'vite',
    extensions: ['.js', '.vue', '.css']
  },
  angular: {
    entry: 'src/main.ts',
    output: 'dist',
    framework: 'angular',
    bundler: 'webpack',
    extensions: ['.ts', '.html', '.css']
  }
};

const MAX_BUILD_HISTORY = 50;
const BUILD_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// =============================
// CLASSE BUILD SERVICE
// =============================

class BuildService {
  constructor() {
    this.initialized = false;
    this.activeBuilds = new Map(); // projectId -> build
    this.buildHistory = [];
    this.cancellationTokens = new Map(); // projectId -> boolean
  }

  /**
   * Initialise le service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await crypto.initialize();
      await this._loadBuildHistory();
      this.initialized = true;
      console.log("✅ BuildService initialized");
    } catch (error) {
      console.error("❌ BuildService initialization failed:", error);
      throw error;
    }
  }

  /**
   * Démarre un build
   */
  async startBuild(projectId, userId, options = {}) {
    if (!this.initialized) {
      throw new Error('BuildService non initialisé');
    }

    // Vérifier le projet
    const project = await projectManager.getProjectById(projectId, userId);
    if (!project) {
      throw new Error("Projet introuvable");
    }

    // Valider le projet
    const validation = projectValidator.validateProject(project);
    if (!validation.valid) {
      throw new Error(`Projet invalide: ${validation.errors.join(', ')}`);
    }

    // Vérifier si un build est déjà en cours
    if (this.activeBuilds.has(projectId)) {
      const existing = this.activeBuilds.get(projectId);
      if (existing.status !== BUILD_STATUS.COMPLETED && 
          existing.status !== BUILD_STATUS.FAILED &&
          existing.status !== BUILD_STATUS.CANCELLED) {
        throw new Error("Un build est déjà en cours pour ce projet");
      }
    }

    // Déterminer le type de projet
    const projectType = this._detectProjectType(project);
    const config = PROJECT_CONFIG[projectType] || PROJECT_CONFIG.html;

    const buildId = generateBuildId();
    const build = {
      id: buildId,
      projectId,
      userId,
      projectType,
      config,
      status: BUILD_STATUS.PENDING,
      progress: 0,
      logs: [],
      errors: [],
      warnings: [],
      startTime: Date.now(),
      endTime: null,
      duration: null,
      options: {
        type: options.type || BUILD_TYPES.PRODUCTION,
        target: options.target || TARGET_ENVS.WEB,
        minify: options.minify !== false,
        sourceMaps: options.sourceMaps || false,
        analyze: options.analyze || false,
        ...options
      },
      output: null,
      stats: null
    };

    this.activeBuilds.set(projectId, build);
    this.cancellationTokens.set(projectId, false);

    // Lancer le build en arrière-plan
    this._runBuild(project, build).catch(error => {
      this._handleBuildError(projectId, buildId, error);
    });

    return {
      buildId,
      status: BUILD_STATUS.PENDING,
      projectType
    };
  }

  /**
   * Exécute le build (privé)
   */
  async _runBuild(project, build) {
    const projectId = project.id;
    const buildId = build.id;

    try {
      // Vérifier annulation
      if (this._isCancelled(projectId)) {
        return this._cancelBuild(projectId, buildId);
      }

      // Étape 1: Préparation
      await this._updateBuildStatus(projectId, BUILD_STATUS.PREPARING, 10);
      this._addBuildLog(projectId, "Préparation du build...");
      await this._sleep(100);

      // Étape 2: Installation des dépendances
      if (this._isCancelled(projectId)) return;
      await this._updateBuildStatus(projectId, BUILD_STATUS.INSTALLING, 25);
      this._addBuildLog(projectId, "Installation des dépendances...");
      
      const deps = await dependencyResolver.resolveProjectDependencies(project);
      const installResult = await this._installDependencies(deps);
      if (!installResult.success) {
        throw new Error("Échec de l'installation des dépendances");
      }

      // Étape 3: Compilation
      if (this._isCancelled(projectId)) return;
      await this._updateBuildStatus(projectId, BUILD_STATUS.COMPILING, 45);
      this._addBuildLog(projectId, "Compilation des fichiers...");

      const compilation = await this._compileProject(project, build);
      if (!compilation.success) {
        compilation.errors.forEach(e => this._addBuildError(projectId, e));
        throw new Error("Échec de la compilation");
      }

      // Étape 4: Bundling
      if (this._isCancelled(projectId)) return;
      await this._updateBuildStatus(projectId, BUILD_STATUS.BUNDLING, 70);
      this._addBuildLog(projectId, "Bundling des fichiers...");

      const bundle = await this._bundleProject(project, compilation.files, build);
      if (!bundle.success) {
        throw new Error("Échec du bundling");
      }

      // Étape 5: Optimisation
      if (this._isCancelled(projectId)) return;
      await this._updateBuildStatus(projectId, BUILD_STATUS.OPTIMIZING, 90);
      this._addBuildLog(projectId, "Optimisation du bundle...");

      const output = await this._optimizeOutput(bundle, build);

      // Étape 6: Finalisation
      build.output = output;
      build.progress = 100;
      build.status = BUILD_STATUS.COMPLETED;
      build.endTime = Date.now();
      build.duration = build.endTime - build.startTime;
      build.stats = this._generateBuildStats(build);

      this._addBuildLog(projectId, `✅ Build terminé en ${(build.duration / 1000).toFixed(1)}s`);

      this._addToHistory(build);
      this.activeBuilds.delete(projectId);
      this.cancellationTokens.delete(projectId);

    } catch (error) {
      this._handleBuildError(projectId, buildId, error);
    }
  }

  /**
   * Récupère le statut d'un build
   */
  getBuildStatus(projectId) {
    const build = this.activeBuilds.get(projectId);
    if (!build) {
      // Chercher dans l'historique
      const historyBuild = this.buildHistory.find(b => b.projectId === projectId);
      if (historyBuild) {
        return {
          exists: true,
          status: historyBuild.status,
          completed: true,
          build: historyBuild
        };
      }
      return { exists: false };
    }

    return {
      exists: true,
      status: build.status,
      progress: build.progress,
      logs: build.logs.slice(-10),
      errors: build.errors,
      warnings: build.warnings,
      build
    };
  }

  /**
   * Annule un build en cours
   */
  async cancelBuild(projectId) {
    if (!this.activeBuilds.has(projectId)) {
      throw new Error("Aucun build actif pour ce projet");
    }

    const build = this.activeBuilds.get(projectId);
    if (build.status === BUILD_STATUS.COMPLETED || 
        build.status === BUILD_STATUS.FAILED ||
        build.status === BUILD_STATUS.CANCELLED) {
      throw new Error("Ce build est déjà terminé");
    }

    this.cancellationTokens.set(projectId, true);
    
    return { success: true, message: "Annulation en cours..." };
  }

  /**
   * Annule un build (interne)
   */
  async _cancelBuild(projectId, buildId) {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    build.status = BUILD_STATUS.CANCELLED;
    build.progress = 0;
    build.endTime = Date.now();
    build.duration = build.endTime - build.startTime;
    
    this._addBuildLog(projectId, "⛔ Build annulé");

    this._addToHistory(build);
    this.activeBuilds.delete(projectId);
    this.cancellationTokens.delete(projectId);

    return { success: true };
  }

  /**
   * Vérifie si un build est annulé
   */
  _isCancelled(projectId) {
    return this.cancellationTokens.get(projectId) === true;
  }

  /**
   * Met à jour le statut d'un build
   */
  async _updateBuildStatus(projectId, status, progress) {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    build.status = status;
    build.progress = progress;
    build.lastUpdate = Date.now();

    // Timeout
    if (build.startTime && Date.now() - build.startTime > BUILD_TIMEOUT) {
      throw new Error("Build timeout dépassé");
    }

    await this._sleep(50); // Petit délai pour éviter de bloquer
  }

  /**
   * Détecte le type de projet
   */
  _detectProjectType(project) {
    const files = project.files || {};

    if (files['package.json']) {
      try {
        const pkg = JSON.parse(files['package.json']);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['react'] && deps['react-native']) return 'react-native';
        if (deps['react'] || deps['react-dom']) return 'react';
        if (deps['vue']) return 'vue';
        if (deps['@angular/core']) return 'angular';
        if (deps['express'] || deps['koa']) return 'node';
      } catch {
        // Ignorer
      }
    }

    if (files['index.html']) return 'html';
    if (files['App.vue']) return 'vue';
    if (files['main.ts'] && files['app.module.ts']) return 'angular';

    return 'html';
  }

  /**
   * Installe les dépendances (simulé pour l'instant)
   */
  async _installDependencies(deps) {
    // TODO: Remplacer par vraie installation npm/yarn/pnpm
    this._addBuildLog('global', `Installation de ${deps.length} dépendances...`);
    await this._sleep(2000);
    return { success: true };
  }

  /**
   * Compile le projet
   */
  async _compileProject(project, build) {
    const files = project.files || {};
    const compiled = {};
    const errors = [];
    const warnings = [];

    const extensions = build.config.extensions || ['.js'];

    for (const [path, content] of Object.entries(files)) {
      try {
        const ext = path.substring(path.lastIndexOf('.'));
        
        if (!extensions.includes(ext)) {
          compiled[path] = content;
          continue;
        }

        let compiledContent = content;

        // Compilation TypeScript
        if (ext === '.ts' || ext === '.tsx') {
          compiledContent = await this._compileTypeScript(content, path);
        }

        // Compilation JSX
        if (ext === '.jsx' || ext === '.tsx') {
          compiledContent = await this._compileJSX(content, path);
        }

        // Compilation SCSS/LESS
        if (ext === '.scss' || ext === '.less') {
          compiledContent = await this._compileCSS(content, ext);
        }

        // Minification (si demandé)
        if (build.options.minify && this._isMinifiable(ext)) {
          compiledContent = await this._minifyContent(compiledContent, ext);
        }

        compiled[path] = compiledContent;

      } catch (err) {
        errors.push({
          file: path,
          message: err.message,
          line: err.line || 0
        });
      }
    }

    return {
      success: errors.length === 0,
      files: compiled,
      errors,
      warnings
    };
  }

  /**
   * Compile TypeScript (simulé)
   */
  async _compileTypeScript(content, path) {
    // TODO: Intégrer un vrai compilateur TypeScript
    // Pour l'instant, on enlève juste les types
    return content
      .replace(/:\s*[^;=,)\n]+/g, '')
      .replace(/interface\s+\w+\s*\{[^}]+\}/g, '')
      .replace(/type\s+\w+\s*=[^;]+;/g, '');
  }

  /**
   * Compile JSX (simulé)
   */
  async _compileJSX(content, path) {
    // TODO: Intégrer un vrai compilateur JSX
    return content
      .replace(/className=/g, 'class=');
  }

  /**
   * Compile CSS préprocesseurs (simulé)
   */
  async _compileCSS(content, ext) {
    // TODO: Intégrer vrai compilateur SCSS/LESS
    return content;
  }

  /**
   * Minifie du contenu (simulé)
   */
  async _minifyContent(content, ext) {
    // TODO: Intégrer terser, cssnano, etc.
    return content
      .replace(/\s+/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s*([{}:;,])\s*/g, '$1')
      .trim();
  }

  /**
   * Vérifie si un fichier peut être minifié
   */
  _isMinifiable(ext) {
    const minifiable = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json'];
    return minifiable.includes(ext);
  }

  /**
   * Bundle le projet
   */
  async _bundleProject(project, compiledFiles, build) {
    const entry = build.config.entry;
    
    if (!compiledFiles[entry]) {
      // Chercher un point d'entrée alternatif
      const alternatives = ['src/index.js', 'index.js', 'main.js'];
      const found = alternatives.find(alt => compiledFiles[alt]);
      
      if (!found) {
        return {
          success: false,
          error: `Fichier d'entrée non trouvé (cherché: ${entry})`
        };
      }
    }

    const dependencies = this._analyzeDependencies(compiledFiles, entry);
    
    return {
      success: true,
      entry: found || entry,
      dependencies,
      files: compiledFiles
    };
  }

  /**
   * Analyse les dépendances d'un fichier
   */
  _analyzeDependencies(files, entry) {
    const deps = new Set();
    const content = files[entry] || "";

    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    let match;

    while ((match = importRegex.exec(content))) {
      const dep = match[1].split('/')[0];
      if (!dep.startsWith('.')) deps.add(dep);
    }

    while ((match = requireRegex.exec(content))) {
      const dep = match[1].split('/')[0];
      if (!dep.startsWith('.')) deps.add(dep);
    }

    return Array.from(deps);
  }

  /**
   * Optimise le bundle
   */
  async _optimizeOutput(bundle, build) {
    const output = {};

    // Générer le bundle principal
    output['bundle.js'] = await this._generateBundleJS(bundle, build);

    // Générer la source map si demandé
    if (build.options.sourceMaps) {
      output['bundle.js.map'] = await this._generateSourceMap(bundle);
    }

    // Générer les assets
    for (const [path, content] of Object.entries(bundle.files)) {
      if (this._isAsset(path)) {
        output[path] = content;
      }
    }

    // Générer le rapport d'analyse si demandé
    if (build.options.analyze) {
      output['report.html'] = await this._generateAnalyzeReport(bundle, build);
    }

    return output;
  }

  /**
   * Génère le bundle JS
   */
  async _generateBundleJS(bundle, build) {
    const timestamp = Date.now();
    const deps = bundle.dependencies || [];
    
    return `/**
 * Build ${build.id}
 * Generated: ${new Date(timestamp).toISOString()}
 * Type: ${build.projectType}
 * Mode: ${build.options.type}
 * Dependencies: ${deps.length}
 */

(function() {
  console.log("🚀 Build ready");
  
  const modules = ${JSON.stringify(Object.keys(bundle.files))};
  
  // Module system simulé
  const __modules__ = {};
  
  modules.forEach((module, i) => {
    __modules__[module] = function() {
      console.log("Loading module:", module);
    };
  });
  
  // Point d'entrée
  console.log("✅ Bundle chargé avec succès");
})();
`;
  }

  /**
   * Génère une source map (simulée)
   */
  async _generateSourceMap(bundle) {
    return JSON.stringify({
      version: 3,
      file: "bundle.js",
      sources: Object.keys(bundle.files),
      mappings: ""
    }, null, 2);
  }

  /**
   * Génère un rapport d'analyse
   */
  async _generateAnalyzeReport(bundle, build) {
    const files = Object.entries(bundle.files || {});
    const totalSize = files.reduce((acc, [_, c]) => acc + (c?.length || 0), 0);

    return `<!DOCTYPE html>
<html>
<head>
  <title>Analyse de build - ${build.id}</title>
  <style>
    body { font-family: sans-serif; background: #1e1e1e; color: #d4d4d4; padding: 20px; }
    .stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
    .card { background: #2d2d2d; padding: 20px; border-radius: 8px; }
    .value { font-size: 24px; font-weight: bold; color: #007bff; }
  </style>
</head>
<body>
  <h1>📊 Analyse de build</h1>
  <div class="stats">
    <div class="card">
      <div>Fichiers</div>
      <div class="value">${files.length}</div>
    </div>
    <div class="card">
      <div>Taille totale</div>
      <div class="value">${(totalSize / 1024).toFixed(2)} KB</div>
    </div>
    <div class="card">
      <div>Dépendances</div>
      <div class="value">${bundle.dependencies?.length || 0}</div>
    </div>
  </div>
  <h2>Détails</h2>
  <pre>${JSON.stringify(build, null, 2)}</pre>
</body>
</html>`;
  }

  /**
   * Vérifie si un fichier est un asset
   */
  _isAsset(path) {
    const assetExts = ['.png', '.jpg', '.svg', '.gif', '.ico', '.woff', '.ttf'];
    const ext = path.substring(path.lastIndexOf('.'));
    return assetExts.includes(ext);
  }

  /**
   * Génère les statistiques de build
   */
  _generateBuildStats(build) {
    const output = build.output || {};
    const files = Object.entries(output);
    
    return {
      totalFiles: files.length,
      totalSize: files.reduce((acc, [_, c]) => acc + (c?.length || 0), 0),
      errorsCount: build.errors.length,
      warningsCount: build.warnings.length,
      logsCount: build.logs.length,
      dependenciesCount: build.stats?.dependenciesCount || 0
    };
  }

  /**
   * Ajoute un log
   */
  _addBuildLog(projectId, message) {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    build.logs.push({
      timestamp: Date.now(),
      level: "info",
      message
    });
  }

  /**
   * Ajoute une erreur
   */
  _addBuildError(projectId, error) {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    build.errors.push({
      timestamp: Date.now(),
      level: "error",
      ...error
    });
  }

/**
   * Gère une erreur de build
   */
  _handleBuildError(projectId, buildId, error) {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    build.status = BUILD_STATUS.FAILED;
    build.endTime = Date.now();
    build.duration = build.endTime - build.startTime;
    
    this._addBuildError(projectId, { 
      message: error.message,
      stack: error.stack 
    });

    this._addBuildLog(projectId, `❌ Build échoué: ${error.message}`);

    this._addToHistory(build);
    this.activeBuilds.delete(projectId);
    this.cancellationTokens.delete(projectId);
  }

  /**
   * Ajoute à l'historique
   */
  _addToHistory(build) {
    this.buildHistory.unshift({
      id: build.id,
      projectId: build.projectId,
      projectType: build.projectType,
      status: build.status,
      startTime: build.startTime,
      endTime: build.endTime,
      duration: build.duration,
      errors: build.errors.length,
      warnings: build.warnings.length,
      stats: build.stats
    });

    if (this.buildHistory.length > MAX_BUILD_HISTORY) {
      this.buildHistory.pop();
    }

    this._saveBuildHistory();
  }

  /**
   * Sauvegarde l'historique
   */
  _saveBuildHistory() {
    try {
      localStorage.setItem("vibe_build_history", JSON.stringify(this.buildHistory));
    } catch {
      // Ignorer les erreurs de stockage
    }
  }

  /**
   * Charge l'historique
   */
  async _loadBuildHistory() {
    try {
      const saved = localStorage.getItem("vibe_build_history");
      if (saved) {
        this.buildHistory = JSON.parse(saved);
      }
    } catch {
      // Ignorer les erreurs de chargement
    }
  }

  /**
   * Récupère l'historique
   */
  getBuildHistory(limit = 20) {
    return this.buildHistory.slice(0, limit);
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const completed = this.buildHistory.filter(b => b.status === BUILD_STATUS.COMPLETED);
    const failed = this.buildHistory.filter(b => b.status === BUILD_STATUS.FAILED);
    
    return {
      totalBuilds: this.buildHistory.length,
      completedBuilds: completed.length,
      failedBuilds: failed.length,
      successRate: this.buildHistory.length > 0 
        ? (completed.length / this.buildHistory.length * 100).toFixed(1)
        : 0,
      averageDuration: completed.length > 0
        ? completed.reduce((acc, b) => acc + (b.duration || 0), 0) / completed.length
        : 0
    };
  }

  /**
   * Simule un délai
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================
// HOOK PERSONNALISÉ
// =============================

export const useBuildService = () => {
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBuilds, setActiveBuilds] = useState([]);
  const [buildHistory, setBuildHistory] = useState([]);

  useEffect(() => {
    const init = async () => {
      const instance = new BuildService();
      await instance.initialize();
      setService(instance);
      setBuildHistory(instance.getBuildHistory());
      setLoading(false);
    };

    init();

    const interval = setInterval(() => {
      if (service) {
        // Mettre à jour la liste des builds actifs
        const active = Array.from(service.activeBuilds.values());
        setActiveBuilds(active);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [service]);

  const startBuild = useCallback(async (projectId, userId, options) => {
    if (!service) throw new Error("Service non initialisé");
    const result = await service.startBuild(projectId, userId, options);
    setBuildHistory(service.getBuildHistory());
    return result;
  }, [service]);

  const getBuildStatus = useCallback((projectId) => {
    if (!service) return { exists: false };
    return service.getBuildStatus(projectId);
  }, [service]);

  const cancelBuild = useCallback(async (projectId) => {
    if (!service) throw new Error("Service non initialisé");
    return service.cancelBuild(projectId);
  }, [service]);

  const getBuildHistory = useCallback((limit) => {
    if (!service) return [];
    return service.getBuildHistory(limit);
  }, [service]);

  return {
    loading,
    service,
    activeBuilds,
    buildHistory,
    startBuild,
    getBuildStatus,
    cancelBuild,
    getBuildHistory,
    BUILD_STATUS,
    BUILD_TYPES,
    TARGET_ENVS
  };
};

// =============================
// EXPORT
// =============================

export const buildService = new BuildService();
export default buildService;
