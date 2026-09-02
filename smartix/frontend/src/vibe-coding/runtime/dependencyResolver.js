/**
 * Classe principale DependencyResolver
 * Orchestre tous les sous-systèmes pour la gestion des dépendances
 */

import EventEmitter from 'events';
import { DEPENDENCY_EVENTS } from '../dependencies/core/events';
import { DEFAULTS, INSTALLATION_METHODS } from '../runner/core/constants';
import { KnowledgeBase } from '../dependencies/database/KnowledgeBase';
import { PackageDatabase } from '../dependencies/database/PackageDatabase';
import { VersionChecker } from '../dependencies/database/VersionChecker';
import { UpdateManager } from '../dependencies/database/UpdateManager';
import { PackageAnalyzer } from '../dependencies/analyzer/PackageAnalyzer';
import { ImportAnalyzer } from '../dependencies/analyzer/ImportAnalyzer';
import { ConflictDetector } from '../dependencies/analyzer/ConflictDetector';
import { PackageJsonGenerator } from '../dependencies/analyzer/generators/PackageJsonGenerator';
import { DependencyInstaller } from '../runner/dependencies/DependencyInstaller';
import { DependencyCache } from '../dependencies/cache/DependencyCache';
import { PersistentStorage } from '../dependencies/cache/PersistentStorage';

export class DependencyResolver extends EventEmitter {
  /**
   * Crée une instance de DependencyResolver
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      cacheTTL: options.cacheTTL || DEFAULTS.CACHE_TTL,
      installTimeout: options.installTimeout || DEFAULTS.INSTALL_TIMEOUT,
      preferMethod: options.preferMethod || DEFAULTS.PREFER_INSTALL_METHOD,
      language: options.language || 'fr',
      ...options
    };

    // Initialiser les sous-systèmes
    this._initializeSubsystems();
    
    this.initialized = false;
    this.stats = {
      totalAnalyses: 0,
      totalInstalls: 0,
      totalUpdates: 0,
      conflictsFound: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Initialise les sous-systèmes
   * @private
   */
  _initializeSubsystems() {
    this.knowledgeBase = new KnowledgeBase(this.options);
    this.packageDatabase = new PackageDatabase(this.options);
    this.versionChecker = new VersionChecker(this.options);
    this.updateManager = new UpdateManager(this.options);
    
    this.packageAnalyzer = new PackageAnalyzer(this.options);
    this.importAnalyzer = new ImportAnalyzer(this.options);
    this.conflictDetector = new ConflictDetector(this.options);
    this.packageJsonGenerator = new PackageJsonGenerator(this.options);
    
    this.dependencyInstaller = new DependencyInstaller(this.options);
    this.cache = new DependencyCache(this.options);
    this.storage = new PersistentStorage(this.options);
  }

  /**
   * Initialise le résolveur
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Charger la base de connaissances
      await this.knowledgeBase.load();
      
      // Charger le cache persistant
      await this.storage.load();
      
      // Restaurer les dépendances installées
      const saved = this.storage.get('installed') || [];
      saved.forEach(dep => {
        this.dependencyInstaller.recordInstalled(dep);
      });

      this.initialized = true;
      this.emit(DEPENDENCY_EVENTS.ANALYSIS_STARTED, { status: 'initialized' });
      
      console.log('✅ DependencyResolver initialized');
    } catch (error) {
      this.emit(DEPENDENCY_EVENTS.ANALYSIS_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Analyse les dépendances d'un projet
   * @param {Object} files - Fichiers du projet
   * @param {Object} options - Options d'analyse
   * @returns {Promise<Object>} Résultat de l'analyse
   */
  async analyzeProject(files, options = {}) {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();
    this.stats.totalAnalyses++;
    
    this.emit(DEPENDENCY_EVENTS.ANALYSIS_STARTED, { files: Object.keys(files).length });

    try {
      // Analyser package.json
      const packageAnalysis = await this.packageAnalyzer.analyze(files['package.json']);
      
      // Analyser les imports dans le code
      const importAnalysis = await this.importAnalyzer.analyze(files, {
        knownDependencies: packageAnalysis.dependencies.map(d => d.name)
      });

      // Fusionner les résultats
      const dependencies = this._mergeAnalyses(packageAnalysis, importAnalysis);
      
      // Vérifier les versions récentes
      await this._checkLatestVersions(dependencies);
      
      // Détecter les conflits
      const conflicts = await this.conflictDetector.detect(dependencies, {
        knownConflicts: this.knowledgeBase.getConflicts()
      });

      if (conflicts.length > 0) {
        this.stats.conflictsFound += conflicts.length;
        this.emit(DEPENDENCY_EVENTS.CONFLICT_DETECTED, { conflicts });
      }

      const result = {
        dependencies,
        conflicts,
        stats: {
          total: dependencies.length,
          fromPackageJson: packageAnalysis.dependencies.length,
          fromImports: importAnalysis.missing.length,
          conflicts: conflicts.length,
          duration: Date.now() - startTime
        }
      };

      this.emit(DEPENDENCY_EVENTS.ANALYSIS_COMPLETED, result);
      
      return result;

    } catch (error) {
      this.emit(DEPENDENCY_EVENTS.ANALYSIS_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Fusionne les analyses package.json et imports
   * @private
   * @param {Object} packageAnalysis - Analyse package.json
   * @param {Object} importAnalysis - Analyse imports
   * @returns {Array} Dépendances fusionnées
   */
  _mergeAnalyses(packageAnalysis, importAnalysis) {
    const dependencyMap = new Map();

    // Ajouter les dépendances de package.json
    packageAnalysis.dependencies.forEach(dep => {
      dependencyMap.set(dep.name, {
        ...dep,
        source: 'package.json',
        used: false
      });
    });

    // Ajouter ou marquer les imports
    importAnalysis.missing.forEach(imp => {
      if (dependencyMap.has(imp.name)) {
        dependencyMap.get(imp.name).used = true;
      } else {
        dependencyMap.set(imp.name, {
          name: imp.name,
          version: 'latest',
          suggested: true,
          source: 'import',
          used: true,
          importLocations: imp.locations
        });
      }
    });

    // Ajouter les informations de la base de connaissances
    const result = Array.from(dependencyMap.values());
    result.forEach(dep => {
      const info = this.knowledgeBase.get(dep.name);
      if (info) {
        dep.description = info.description;
        dep.group = info.group;
        dep.alternatives = info.alternatives;
        dep.latest = info.latest;
        dep.deprecated = info.deprecated;
        dep.peerDependencies = info.peerDependencies;
      }
    });

    return result;
  }

  /**
   * Vérifie les dernières versions
   * @private
   * @param {Array} dependencies - Dépendances à vérifier
   */
  async _checkLatestVersions(dependencies) {
    const promises = dependencies.map(async dep => {
      try {
        // Vérifier le cache d'abord
        const cached = await this.cache.get(`version:${dep.name}`);
        if (cached) {
          this.stats.cacheHits++;
          dep.latest = cached.version;
          dep.outdated = this.versionChecker.isOutdated(dep.version, cached.version);
          return;
        }

        this.stats.cacheMisses++;
        
        // Requête à la base de données
        const info = await this.packageDatabase.getPackageInfo(dep.name);
        
        if (info) {
          dep.latest = info['dist-tags']?.latest || dep.version;
          dep.outdated = this.versionChecker.isOutdated(dep.version, dep.latest);
          
          // Mettre en cache
          await this.cache.set(`version:${dep.name}`, {
            version: dep.latest,
            timestamp: Date.now()
          });

          this.emit(DEPENDENCY_EVENTS.VERSION_CHECKED, {
            name: dep.name,
            current: dep.version,
            latest: dep.latest,
            outdated: dep.outdated
          });
        }
      } catch (error) {
        console.warn(`Erreur vérification version ${dep.name}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Installe des dépendances
   * @param {Array} dependencies - Dépendances à installer
   * @param {Object} options - Options d'installation
   * @returns {Promise<Object>} Résultat de l'installation
   */
  async installDependencies(dependencies, options = {}) {
    if (!this.initialized) await this.initialize();

    this.stats.totalInstalls++;
    
    this.emit(DEPENDENCY_EVENTS.INSTALL_STARTED, {
      count: dependencies.length,
      method: options.method || this.options.preferMethod
    });

    try {
      const result = await this.dependencyInstaller.install(dependencies, {
        ...options,
        method: options.method || this.options.preferMethod
      });

      // Sauvegarder dans le stockage persistant
      if (result.installed.length > 0) {
        const installed = this.dependencyInstaller.getInstalled();
        await this.storage.set('installed', installed);
      }

      this.emit(DEPENDENCY_EVENTS.INSTALL_COMPLETED, result);
      
      return result;

    } catch (error) {
      this.emit(DEPENDENCY_EVENTS.INSTALL_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Met à jour une dépendance
   * @param {string} name - Nom de la dépendance
   * @param {string} version - Version cible
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  async updateDependency(name, version = 'latest') {
    if (!this.initialized) await this.initialize();

    this.stats.totalUpdates++;
    
    this.emit(DEPENDENCY_EVENTS.UPDATE_STARTED, { name, version });

    try {
      const result = await this.updateManager.update(name, version);
      
      // Mettre à jour le stockage
      const installed = this.dependencyInstaller.getInstalled();
      await this.storage.set('installed', installed);

      this.emit(DEPENDENCY_EVENTS.UPDATE_COMPLETED, result);
      
      return result;

    } catch (error) {
      this.emit(DEPENDENCY_EVENTS.UPDATE_FAILED, { name, error: error.message });
      throw error;
    }
  }

  /**
   * Recherche des dépendances
   * @param {string} query - Terme de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Array>} Résultats de la recherche
   */
  async searchDependencies(query, options = {}) {
    if (!this.initialized) await this.initialize();

    // Recherche dans la base de connaissances d'abord
    const knowledgeResults = this.knowledgeBase.search(query);
    
    // Recherche dans le registre npm
    const registryResults = await this.packageDatabase.search(query, {
      size: options.size || 20,
      ...options
    });

    // Fusionner et dédupliquer
    const results = this._mergeSearchResults(knowledgeResults, registryResults);
    
    return results;
  }

  /**
   * Fusionne les résultats de recherche
   * @private
   * @param {Array} knowledgeResults - Résultats base connaissances
   * @param {Array} registryResults - Résultats registre
   * @returns {Array} Résultats fusionnés
   */
  _mergeSearchResults(knowledgeResults, registryResults) {
    const map = new Map();

    // Ajouter les résultats de la base de connaissances
    knowledgeResults.forEach(r => map.set(r.name, { ...r, source: 'knowledge' }));

    // Ajouter ou enrichir avec les résultats du registre
    registryResults.forEach(r => {
      if (map.has(r.name)) {
        map.set(r.name, {
          ...map.get(r.name),
          ...r,
          source: 'both'
        });
      } else {
        map.set(r.name, { ...r, source: 'registry' });
      }
    });

    return Array.from(map.values());
  }

  /**
   * Génère un package.json
   * @param {Array} dependencies - Dépendances à inclure
   * @param {Object} options - Options de génération
   * @returns {string} Contenu package.json
   */
  generatePackageJson(dependencies, options = {}) {
    return this.packageJsonGenerator.generate(dependencies, {
      projectName: options.projectName,
      includeDevDeps: options.includeDevDeps !== false,
      ...options
    });
  }

  /**
   * Vérifie les mises à jour disponibles
   * @returns {Promise<Array>} Mises à jour disponibles
   */
  async checkForUpdates() {
    if (!this.initialized) await this.initialize();

    const installed = this.dependencyInstaller.getInstalled();
    const updates = [];

    for (const dep of installed) {
      try {
        const info = await this.packageDatabase.getPackageInfo(dep.name);
        const latest = info['dist-tags']?.latest;
        
        if (latest && this.versionChecker.isOutdated(dep.version, latest)) {
          updates.push({
            name: dep.name,
            current: dep.version,
            latest,
            description: dep.description
          });
        }
      } catch (error) {
        console.warn(`Erreur vérification ${dep.name}:`, error);
      }
    }

    return updates;
  }

  /**
   * Obtient les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      installedCount: this.dependencyInstaller.getInstalled().length,
      cacheSize: this.cache.size(),
      knowledgeBaseSize: this.knowledgeBase.size()
    };
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.cache.clear();
    this.emit(DEPENDENCY_EVENTS.CACHE_CLEARED);
  }

  /**
   * Sauvegarde l'état
   */
  async persist() {
    await this.storage.set('stats', this.stats);
    await this.storage.set('installed', this.dependencyInstaller.getInstalled());
  }

  /**
   * Charge l'état
   */
  async load() {
    const stats = await this.storage.get('stats');
    if (stats) this.stats = stats;
  }
}

export const dependencyResolver = new DependencyResolver();
export default dependencyResolver;
