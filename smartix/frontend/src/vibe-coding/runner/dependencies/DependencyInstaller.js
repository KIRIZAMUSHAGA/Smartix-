/**
 * DependencyInstaller
 * Gère l'installation et le chargement des dépendances
 */

import EventEmitter from 'events';
import { CDNLoader } from './CDNLoader';
import { PackageAnalyzer } from './PackageAnalyzer';

export class DependencyInstaller extends EventEmitter {
  /**
   * Crée une instance de DependencyInstaller
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      cacheTTL: options.cacheTTL || 3600000, // 1 heure
      concurrent: options.concurrent || 3,
      timeout: options.timeout || 30000,
      retries: options.retries || 2,
      ...options
    };

    this.cdnLoader = new CDNLoader(this.options);
    this.packageAnalyzer = new PackageAnalyzer();
    
    this.installed = new Map();
    this.pending = new Map();
    this.failed = new Map();
    this.queue = [];
    this.processing = false;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      cached: 0
    };
  }

  /**
   * Initialise l'installateur
   */
  async initialize() {
    await this.cdnLoader.initialize();
    this.emit('initialized');
  }

  /**
   * Installe les dépendances d'un projet
   * @param {Object} project - Projet
   * @param {Object} options - Options d'installation
   * @returns {Promise<Object>} Résultat de l'installation
   */
  async install(project, options = {}) {
    const startTime = Date.now();
    
    try {
      // Analyser les dépendances
      const analysis = await this.packageAnalyzer.analyze(project);
      
      if (analysis.errors.length > 0) {
        return {
          success: false,
          errors: analysis.errors,
          warnings: analysis.warnings
        };
      }

      const dependencies = analysis.dependencies;
      const results = [];
      const errors = [];

      this.emit('install-start', {
        total: dependencies.length,
        dependencies: dependencies.map(d => d.name)
      });

      // Installer les dépendances
      for (const dep of dependencies) {
        try {
          const result = await this.installDependency(dep, options);
          results.push(result);
          this.stats.success++;
        } catch (error) {
          errors.push({ name: dep.name, error: error.message });
          this.stats.failed++;
        }

        this.emit('install-progress', {
          current: results.length + errors.length,
          total: dependencies.length,
          success: results.length,
          failed: errors.length
        });
      }

      const duration = Date.now() - startTime;

      const result = {
        success: errors.length === 0,
        installed: results,
        errors,
        total: dependencies.length,
        duration,
        stats: { ...this.stats }
      };

      this.emit('install-complete', result);

      return result;

    } catch (error) {
      this.emit('install-error', { error: error.message });
      throw error;
    }
  }

  /**
   * Installe une dépendance
   * @param {Object} dependency - Dépendance à installer
   * @param {Object} options - Options d'installation
   * @returns {Promise<Object>} Résultat de l'installation
   */
  async installDependency(dependency, options = {}) {
    const { name, version, type } = dependency;

    // Vérifier le cache
    const cached = this.installed.get(name);
    if (cached && Date.now() - cached.timestamp < this.options.cacheTTL) {
      this.stats.cached++;
      return {
        name,
        version: cached.version,
        loaded: true,
        cached: true,
        source: cached.source
      };
    }

    // Vérifier si déjà en cours
    if (this.pending.has(name)) {
      return this.pending.get(name);
    }

    // Créer la promesse d'installation
    const installPromise = this._performInstall(dependency, options);
    this.pending.set(name, installPromise);

    try {
      const result = await installPromise;
      this.installed.set(name, {
        ...result,
        timestamp: Date.now()
      });
      return result;
    } finally {
      this.pending.delete(name);
    }
  }

  /**
   * Effectue l'installation réelle
   * @private
   * @param {Object} dependency - Dépendance
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async _performInstall(dependency, options) {
    const { name, version } = dependency;
    let attempts = 0;
    const maxAttempts = options.retries || this.options.retries;

    while (attempts <= maxAttempts) {
      try {
        // Essayer de charger depuis le CDN
        const cdnResult = await this.cdnLoader.load(name, version);
        
        if (cdnResult.success) {
          return {
            name,
            version: cdnResult.version,
            loaded: true,
            source: 'cdn',
            url: cdnResult.url,
            size: cdnResult.size
          };
        }

        // Fallback vers npm si CDN échoue
        const npmResult = await this._loadFromNPM(name, version);
        
        return {
          name,
          version: npmResult.version,
          loaded: true,
          source: 'npm',
          ...npmResult
        };

      } catch (error) {
        attempts++;
        
        if (attempts > maxAttempts) {
          throw new Error(`Échec installation ${name} après ${attempts} tentatives: ${error.message}`);
        }

        // Attendre avant de réessayer
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * Math.pow(2, attempts))
        );
      }
    }
  }

  /**
   * Charge depuis npm
   * @private
   * @param {string} name - Nom du package
   * @param {string} version - Version
   * @returns {Promise<Object>} Résultat
   */
  async _loadFromNPM(name, version) {
    // Simuler le chargement depuis npm
    // Dans un environnement réel, on utiliserait unpkg ou jsdelivr
    
    const urls = [
      `https://unpkg.com/${name}@${version}/dist/index.js`,
      `https://cdn.jsdelivr.net/npm/${name}@${version}/dist/index.js`,
      `https://cdn.jsdelivr.net/npm/${name}@${version}/dist/${name}.js`
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
          const content = await response.text();
          
          // Injecter dans la page
          this._injectScript(content, name);

          return {
            success: true,
            version,
            url,
            size: content.length,
            content
          };
        }
      } catch (error) {
        // Essayer l'URL suivante
        continue;
      }
    }

    throw new Error(`Impossible de charger ${name} depuis npm`);
  }

  /**
   * Injecte un script dans la page
   * @private
   * @param {string} content - Contenu du script
   * @param {string} name - Nom du module
   */
  _injectScript(content, name) {
    try {
      const script = document.createElement('script');
      script.textContent = content;
      script.setAttribute('data-module', name);
      script.setAttribute('data-installed', Date.now());
      document.head.appendChild(script);
    } catch (error) {
      console.warn(`Erreur injection script ${name}:`, error);
    }
  }

  /**
   * Vérifie si une dépendance est installée
   * @param {string} name - Nom de la dépendance
   * @returns {boolean} true si installée
   */
  isInstalled(name) {
    return this.installed.has(name);
  }

  /**
   * Récupère une dépendance installée
   * @param {string} name - Nom de la dépendance
   * @returns {Object|null} Dépendance
   */
  getInstalled(name) {
    return this.installed.get(name) || null;
  }

  /**
   * Récupère toutes les dépendances installées
   * @returns {Array} Dépendances installées
   */
  getInstalledDependencies() {
    return Array.from(this.installed.entries()).map(([name, info]) => ({
      name,
      ...info
    }));
  }

  /**
   * Récupère les dépendances en échec
   * @returns {Array} Dépendances en échec
   */
  getFailedDependencies() {
    return Array.from(this.failed.entries()).map(([name, error]) => ({
      name,
      error
    }));
  }

  /**
   * Réessaie d'installer les dépendances en échec
   * @returns {Promise<Array>} Résultats
   */
  async retryFailed() {
    const failed = Array.from(this.failed.keys());
    const results = [];

    for (const name of failed) {
      try {
        const dependency = { name, version: 'latest' };
        const result = await this.installDependency(dependency);
        results.push(result);
        this.failed.delete(name);
      } catch (error) {
        results.push({ name, error: error.message });
      }
    }

    return results;
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.installed.clear();
    this.cdnLoader.clearCache();
    this.emit('cache-cleared');
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      installed: this.installed.size,
      pending: this.pending.size,
      failed: this.failed.size,
      cacheSize: this.cdnLoader.getCacheSize()
    };
  }

  /**
   * Arrête l'installateur
   */
  destroy() {
    this.queue = [];
    this.processing = false;
    this.removeAllListeners();
  }
}

export default DependencyInstaller;
