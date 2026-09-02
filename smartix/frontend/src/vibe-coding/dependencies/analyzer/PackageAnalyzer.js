/**
 * PackageAnalyzer
 * Analyse le contenu de package.json
 */

import EventEmitter from 'events';
import semver from 'semver';

export class PackageAnalyzer extends EventEmitter {
  /**
   * Crée une instance de PackageAnalyzer
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      validateVersions: options.validateVersions !== false,
      detectConflicts: options.detectConflicts !== false,
      ...options
    };
  }

  /**
   * Analyse un fichier package.json
   * @param {string|Object} packageJson - Contenu du package.json
   * @returns {Promise<Object>} Résultat de l'analyse
   */
  async analyze(packageJson) {
    const startTime = Date.now();
    
    try {
      if (!packageJson) {
        return {
          dependencies: [],
          scripts: {},
          errors: ['package.json manquant'],
          warnings: []
        };
      }

      // Parser le JSON
      const pkg = typeof packageJson === 'string' 
        ? JSON.parse(packageJson) 
        : packageJson;

      // Analyser les différentes sections
      const dependencies = await this._analyzeDependencies(pkg);
      const scripts = this._analyzeScripts(pkg);
      const metadata = this._analyzeMetadata(pkg);
      const issues = this._validatePackage(pkg);

      const result = {
        dependencies,
        scripts,
        metadata,
        errors: issues.errors,
        warnings: issues.warnings,
        stats: {
          totalDeps: dependencies.length,
          totalScripts: Object.keys(scripts).length,
          duration: Date.now() - startTime
        }
      };

      this.emit('analysis:completed', result);
      return result;

    } catch (error) {
      this.emit('analysis:failed', { error: error.message });
      return {
        dependencies: [],
        scripts: {},
        errors: [`Erreur analyse package.json: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Analyse les dépendances
   * @private
   * @param {Object} pkg - Package.json parsé
   * @returns {Array} Liste des dépendances
   */
  async _analyzeDependencies(pkg) {
    const dependencies = [];

    // Dépendances de production
    if (pkg.dependencies) {
      Object.entries(pkg.dependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: this._cleanVersion(version),
          originalVersion: version,
          type: 'production',
          source: 'package.json'
        });
      });
    }

    // Dépendances de développement
    if (pkg.devDependencies) {
      Object.entries(pkg.devDependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: this._cleanVersion(version),
          originalVersion: version,
          type: 'development',
          source: 'package.json'
        });
      });
    }

    // Peer dependencies
    if (pkg.peerDependencies) {
      Object.entries(pkg.peerDependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: this._cleanVersion(version),
          originalVersion: version,
          type: 'peer',
          source: 'package.json',
          optional: pkg.peerDependenciesMeta?.[name]?.optional
        });
      });
    }

    // Optional dependencies
    if (pkg.optionalDependencies) {
      Object.entries(pkg.optionalDependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: this._cleanVersion(version),
          originalVersion: version,
          type: 'optional',
          source: 'package.json'
        });
      });
    }

    return dependencies;
  }

  /**
   * Analyse les scripts
   * @private
   * @param {Object} pkg - Package.json parsé
   * @returns {Object} Scripts analysés
   */
  _analyzeScripts(pkg) {
    const scripts = pkg.scripts || {};

    return Object.entries(scripts).map(([name, command]) => ({
      name,
      command,
      description: this._getScriptDescription(name, command),
      type: this._getScriptType(name)
    }));
  }

  /**
   * Analyse les métadonnées
   * @private
   * @param {Object} pkg - Package.json parsé
   * @returns {Object} Métadonnées
   */
  _analyzeMetadata(pkg) {
    return {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      license: pkg.license,
      repository: pkg.repository,
      homepage: pkg.homepage,
      bugs: pkg.bugs,
      keywords: pkg.keywords || [],
      engines: pkg.engines,
      main: pkg.main,
      module: pkg.module,
      browser: pkg.browser,
      types: pkg.types || pkg.typings
    };
  }

  /**
   * Valide le package.json
   * @private
   * @param {Object} pkg - Package.json parsé
   * @returns {Object} Issues détectées
   */
  _validatePackage(pkg) {
    const errors = [];
    const warnings = [];

    // Vérifier le nom
    if (!pkg.name) {
      warnings.push('name manquant');
    } else if (!this._isValidPackageName(pkg.name)) {
      warnings.push('nom de package invalide (caractères spéciaux)');
    }

    // Vérifier la version
    if (!pkg.version) {
      warnings.push('version manquante');
    } else if (!semver.valid(pkg.version)) {
      warnings.push('version invalide');
    }

    // Vérifier les scripts essentiels
    if (pkg.scripts) {
      if (!pkg.scripts.start && !pkg.scripts.dev) {
        warnings.push('script "start" ou "dev" manquant');
      }
      if (!pkg.scripts.build) {
        warnings.push('script "build" manquant (recommandé)');
      }
    }

    // Vérifier les dépendances circulaires potentielles
    if (pkg.dependencies && pkg.devDependencies) {
      const common = Object.keys(pkg.dependencies).filter(
        dep => pkg.devDependencies[dep]
      );
      if (common.length > 0) {
        warnings.push(`dépendances présentes en prod et dev: ${common.join(', ')}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Nettoie une version
   * @private
   * @param {string} version - Version brute
   * @returns {string} Version nettoyée
   */
  _cleanVersion(version) {
    if (!version) return 'latest';
    
    // Extraire la version des symboles (^, ~, etc.)
    const match = version.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : 'latest';
  }

  /**
   * Vérifie si un nom de package est valide
   * @private
   * @param {string} name - Nom à vérifier
   * @returns {boolean} true si valide
   */
  _isValidPackageName(name) {
    const regex = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    return regex.test(name);
  }

  /**
   * Obtient la description d'un script
   * @private
   * @param {string} name - Nom du script
   * @param {string} command - Commande
   * @returns {string} Description
   */
  _getScriptDescription(name, command) {
    const descriptions = {
      start: 'Démarre l\'application',
      dev: 'Démarre en mode développement',
      build: 'Compile pour la production',
      test: 'Exécute les tests',
      lint: 'Vérifie le code',
      format: 'Formate le code',
      preview: 'Prévisualise le build',
      deploy: 'Déploie l\'application'
    };

    return descriptions[name] || command.substring(0, 50);
  }

  /**
   * Détermine le type de script
   * @private
   * @param {string} name - Nom du script
   * @returns {string} Type
   */
  _getScriptType(name) {
    const types = {
      start: 'serve',
      dev: 'serve',
      build: 'build',
      test: 'test',
      lint: 'lint',
      format: 'format',
      preview: 'preview',
      deploy: 'deploy'
    };

    return types[name] || 'custom';
  }

  /**
   * Extrait les dépendances d'un script
   * @param {string} script - Commande du script
   * @returns {Array} Dépendances utilisées
   */
  extractScriptDependencies(script) {
    const deps = new Set();
    
    // Chercher les commandes type 'react-scripts', 'vite', etc.
    const buildTools = ['react-scripts', 'vite', 'webpack', 'parcel', 'rollup', 'esbuild'];
    buildTools.forEach(tool => {
      if (script.includes(tool)) {
        deps.add(tool);
      }
    });

    // Chercher les exécutables (npx, etc.)
    const npxMatch = script.match(/npx\s+([a-z-]+)/);
    if (npxMatch) {
      deps.add(npxMatch[1]);
    }

    return Array.from(deps);
  }

  /**
   * Compare deux package.json
   * @param {Object} oldPkg - Ancien package.json
   * @param {Object} newPkg - Nouveau package.json
   * @returns {Object} Différences
   */
  diff(oldPkg, newPkg) {
    const changes = {
      added: [],
      removed: [],
      upgraded: [],
      downgraded: []
    };

    const oldDeps = { ...oldPkg.dependencies, ...oldPkg.devDependencies };
    const newDeps = { ...newPkg.dependencies, ...newPkg.devDependencies };

    // Dépendances ajoutées
    Object.keys(newDeps).forEach(name => {
      if (!oldDeps[name]) {
        changes.added.push({ name, version: newDeps[name] });
      }
    });

    // Dépendances supprimées
    Object.keys(oldDeps).forEach(name => {
      if (!newDeps[name]) {
        changes.removed.push({ name, version: oldDeps[name] });
      }
    });

    // Dépendances modifiées
    Object.keys(newDeps).forEach(name => {
      if (oldDeps[name] && oldDeps[name] !== newDeps[name]) {
        const oldVersion = this._cleanVersion(oldDeps[name]);
        const newVersion = this._cleanVersion(newDeps[name]);

        if (semver.gt(newVersion, oldVersion)) {
          changes.upgraded.push({
            name,
            from: oldDeps[name],
            to: newDeps[name]
          });
        } else {
          changes.downgraded.push({
            name,
            from: oldDeps[name],
            to: newDeps[name]
          });
        }
      }
    });

    return changes;
  }
}

export default PackageAnalyzer;
