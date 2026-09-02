/**
 * PackageAnalyzer
 * Analyse package.json et les dépendances d'un projet
 */

export class PackageAnalyzer {
  /**
   * Crée une instance de PackageAnalyzer
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      validateVersions: options.validateVersions !== false,
      checkConflicts: options.checkConflicts !== false,
      maxDepth: options.maxDepth || 3,
      ...options
    };

    this.knownPackages = new Map();
    this.conflicts = new Map();
    this.vulnerabilities = new Map();
  }

  /**
   * Analyse les dépendances d'un projet
   * @param {Object} project - Projet à analyser
   * @returns {Promise<Object>} Résultat de l'analyse
   */
  async analyze(project) {
    const errors = [];
    const warnings = [];
    const dependencies = [];

    if (!project.files || !project.files['package.json']) {
      errors.push('package.json manquant');
      return { dependencies: [], errors, warnings };
    }

    try {
      const packageJson = JSON.parse(project.files['package.json']);
      
      // Analyser les dépendances de production
      if (packageJson.dependencies) {
        const deps = await this._analyzeDependencies(
          packageJson.dependencies, 
          'production'
        );
        dependencies.push(...deps);
      }

      // Analyser les dépendances de développement
      if (packageJson.devDependencies) {
        const deps = await this._analyzeDependencies(
          packageJson.devDependencies, 
          'development'
        );
        dependencies.push(...deps);
      }

      // Analyser les peer dépendances
      if (packageJson.peerDependencies) {
        const deps = await this._analyzeDependencies(
          packageJson.peerDependencies, 
          'peer'
        );
        dependencies.push(...deps);
      }

      // Vérifier les conflits
      if (this.options.checkConflicts) {
        const conflicts = this._checkConflicts(dependencies);
        warnings.push(...conflicts);
      }

      // Vérifier les vulnérabilités
      const vulns = await this._checkVulnerabilities(dependencies);
      warnings.push(...vulns);

      // Valider les versions
      if (this.options.validateVersions) {
        const versionIssues = this._validateVersions(dependencies);
        warnings.push(...versionIssues);
      }

      return {
        dependencies,
        errors,
        warnings,
        summary: this._generateSummary(dependencies)
      };

    } catch (error) {
      errors.push(`Erreur analyse package.json: ${error.message}`);
      return { dependencies: [], errors, warnings };
    }
  }

  /**
   * Analyse un groupe de dépendances
   * @private
   * @param {Object} deps - Dépendances
   * @param {string} type - Type ('production', 'development', 'peer')
   * @returns {Promise<Array>} Dépendances analysées
   */
  async _analyzeDependencies(deps, type) {
    const results = [];

    for (const [name, version] of Object.entries(deps)) {
      const dependency = {
        name,
        version: this._normalizeVersion(version),
        originalVersion: version,
        type,
        required: type === 'production' || type === 'peer',
        size: await this._estimateSize(name),
        popularity: await this._getPopularity(name),
        latest: await this._getLatestVersion(name)
      };

      // Vérifier si déjà connu
      if (this.knownPackages.has(name)) {
        const existing = this.knownPackages.get(name);
        dependency.aliases = existing.aliases || [];
      } else {
        this.knownPackages.set(name, dependency);
      }

      results.push(dependency);
    }

    return results;
  }

  /**
   * Normalise une version
   * @private
   * @param {string} version - Version à normaliser
   * @returns {string} Version normalisée
   */
  _normalizeVersion(version) {
    // Enlever les symboles (^, ~, >, <, etc.)
    return version.replace(/[^0-9.]/g, '');
  }

  /**
   * Estime la taille d'un package
   * @private
   * @param {string} name - Nom du package
   * @returns {Promise<number>} Taille estimée en bytes
   */
  async _estimateSize(name) {
    // Taille estimée basée sur des valeurs connues
    const sizes = {
      'react': 130000,
      'react-dom': 130000,
      'vue': 100000,
      'angular': 500000,
      'lodash': 70000,
      'axios': 40000,
      'moment': 50000,
      'jquery': 90000
    };

    return sizes[name] || 50000; // Taille par défaut 50KB
  }

  /**
   * Obtient la popularité d'un package
   * @private
   * @param {string} name - Nom du package
   * @returns {Promise<number>} Score de popularité (0-100)
   */
  async _getPopularity(name) {
    // Simuler la popularité basée sur des données connues
    const popular = [
      'react', 'react-dom', 'vue', 'angular', 
      'lodash', 'axios', 'moment', 'express'
    ];

    if (popular.includes(name)) return 90 + Math.floor(Math.random() * 10);
    if (name.startsWith('@')) return 50 + Math.floor(Math.random() * 30);
    return 30 + Math.floor(Math.random() * 40);
  }

  /**
   * Obtient la dernière version d'un package
   * @private
   * @param {string} name - Nom du package
   * @returns {Promise<string>} Dernière version
   */
  async _getLatestVersion(name) {
    const versions = {
      'react': '18.2.0',
      'react-dom': '18.2.0',
      'vue': '3.3.0',
      'angular': '16.0.0',
      'lodash': '4.17.21',
      'axios': '1.4.0',
      'moment': '2.29.4',
      'express': '4.18.2'
    };

    return versions[name] || '1.0.0';
  }

  /**
   * Vérifie les conflits entre dépendances
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Array} Avertissements de conflit
   */
  _checkConflicts(dependencies) {
    const warnings = [];
    const versionMap = new Map();

    // Grouper par nom
    dependencies.forEach(dep => {
      if (!versionMap.has(dep.name)) {
        versionMap.set(dep.name, []);
      }
      versionMap.get(dep.name).push(dep);
    });

    // Vérifier les versions multiples
    versionMap.forEach((versions, name) => {
      if (versions.length > 1) {
        const uniqueVersions = new Set(versions.map(v => v.version));
        
        if (uniqueVersions.size > 1) {
          warnings.push({
            type: 'conflict',
            name,
            message: `Version multiple de ${name}: ${Array.from(uniqueVersions).join(', ')}`,
            severity: 'warning'
          });
        }
      }
    });

    // Vérifier les conflits connus
    const knownConflicts = [
      { packages: ['react', 'react-dom'], message: 'React et ReactDOM doivent avoir la même version' },
      { packages: ['@angular/core', '@angular/common'], message: 'Les packages Angular doivent avoir la même version' }
    ];

    knownConflicts.forEach(conflict => {
      const packages = conflict.packages
        .map(name => dependencies.find(d => d.name === name))
        .filter(Boolean);

      if (packages.length === conflict.packages.length) {
        const versions = new Set(packages.map(p => p.version));
        if (versions.size > 1) {
          warnings.push({
            type: 'known-conflict',
            message: conflict.message,
            packages: conflict.packages,
            versions: Array.from(versions),
            severity: 'error'
          });
        }
      }
    });

    return warnings;
  }

  /**
   * Vérifie les vulnérabilités connues
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Promise<Array>} Avertissements de vulnérabilité
   */
  async _checkVulnerabilities(dependencies) {
    const warnings = [];

    // Base de données simulée de vulnérabilités
    const vulnerabilities = {
      'lodash': ['4.17.20'],
      'moment': ['2.29.0'],
      'axios': ['0.21.0']
    };

    dependencies.forEach(dep => {
      const vulnVersions = vulnerabilities[dep.name];
      if (vulnVersions && vulnVersions.includes(dep.version)) {
        warnings.push({
          type: 'vulnerability',
          name: dep.name,
          version: dep.version,
          message: `Version ${dep.version} de ${dep.name} a des vulnérabilités connues`,
          severity: 'warning'
        });
      }
    });

    return warnings;
  }

  /**
   * Valide les versions
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Array} Avertissements de version
   */
  _validateVersions(dependencies) {
    const warnings = [];

    dependencies.forEach(dep => {
      // Vérifier si une mise à jour majeure est disponible
      const currentMajor = parseInt(dep.version.split('.')[0]);
      const latestMajor = parseInt(dep.latest.split('.')[0]);

      if (latestMajor > currentMajor + 1) {
        warnings.push({
          type: 'outdated',
          name: dep.name,
          current: dep.version,
          latest: dep.latest,
          message: `${dep.name} a plusieurs versions majeures de retard`,
          severity: 'info'
        });
      } else if (latestMajor > currentMajor) {
        warnings.push({
          type: 'update-available',
          name: dep.name,
          current: dep.version,
          latest: dep.latest,
          message: `Mise à jour disponible pour ${dep.name}`,
          severity: 'info'
        });
      }

      // Vérifier si la version est trop ancienne
      if (currentMajor < 1) {
        warnings.push({
          type: 'pre-release',
          name: dep.name,
          version: dep.version,
          message: `${dep.name} est en version pré-release (${dep.version})`,
          severity: 'info'
        });
      }
    });

    return warnings;
  }

  /**
   * Génère un résumé des dépendances
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Object} Résumé
   */
  _generateSummary(dependencies) {
    const summary = {
      total: dependencies.length,
      byType: {},
      byScope: {},
      totalSize: 0,
      uniquePackages: new Set()
    };

    dependencies.forEach(dep => {
      // Par type
      summary.byType[dep.type] = (summary.byType[dep.type] || 0) + 1;
      
      // Par scope
      const scope = dep.name.startsWith('@') ? 'scoped' : 'unscoped';
      summary.byScope[scope] = (summary.byScope[scope] || 0) + 1;
      
      // Taille totale
      summary.totalSize += dep.size || 0;
      
      // Packages uniques
      summary.uniquePackages.add(dep.name);
    });

    summary.uniqueCount = summary.uniquePackages.size;
    summary.uniquePackages = Array.from(summary.uniquePackages);

    return summary;
  }

  /**
   * Vérifie si un package est compatible avec une plateforme
   * @param {string} name - Nom du package
   * @param {string} platform - Plateforme cible
   * @returns {Promise<boolean>} true si compatible
   */
  async checkCompatibility(name, platform) {
    // Packages incompatibles avec certaines plateformes
    const incompatibilities = {
      'fs': ['browser', 'netlify', 'vercel'],
      'path': ['browser', 'netlify', 'vercel'],
      'os': ['browser', 'netlify', 'vercel'],
      'crypto': ['browser']
    };

    const incompatible = incompatibilities[name] || [];
    return !incompatible.includes(platform);
  }

  /**
   * Obtient la licence d'un package
   * @param {string} name - Nom du package
   * @returns {Promise<string>} Licence
   */
  async getLicense(name) {
    const licenses = {
      'react': 'MIT',
      'react-dom': 'MIT',
      'vue': 'MIT',
      'angular': 'MIT',
      'lodash': 'MIT',
      'axios': 'MIT',
      'moment': 'MIT',
      'express': 'MIT'
    };

    return licenses[name] || 'UNKNOWN';
  }

  /**
   * Réinitialise l'analyseur
   */
  reset() {
    this.knownPackages.clear();
    this.conflicts.clear();
    this.vulnerabilities.clear();
  }
}

export default PackageAnalyzer;
