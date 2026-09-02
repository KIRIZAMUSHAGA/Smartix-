/**
 * PackageJsonGenerator
 * Génère un fichier package.json à partir des dépendances détectées
 */

export class PackageJsonGenerator {
  /**
   * Crée une instance de PackageJsonGenerator
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      indent: options.indent || 2,
      includeDefaults: options.includeDefaults !== false,
      sortDeps: options.sortDeps !== false,
      ...options
    };
  }

  /**
   * Génère un package.json
   * @param {Array} dependencies - Liste des dépendances
   * @param {Object} options - Options de génération
   * @returns {string} Contenu package.json
   */
  generate(dependencies, options = {}) {
    const pkg = {
      name: options.projectName || 'vibe-coding-project',
      version: options.version || '1.0.0',
      private: true,
      description: options.description || 'Projet généré par Vibe-Coding',
      ...this._getDefaultFields(options)
    };

    // Ajouter les dépendances
    const deps = this._organizeDependencies(dependencies, options);
    
    if (deps.production.length > 0) {
      pkg.dependencies = this._formatDependencies(deps.production);
    }

    if (deps.development.length > 0) {
      pkg.devDependencies = this._formatDependencies(deps.development);
    }

    if (deps.peer.length > 0) {
      pkg.peerDependencies = this._formatDependencies(deps.peer);
    }

    // Ajouter les scripts par défaut
    pkg.scripts = this._generateScripts(deps, options);

    // Ajouter les métadonnées
    if (options.includeMetadata) {
      pkg.keywords = options.keywords || ['vibe-coding'];
      pkg.author = options.author || '';
      pkg.license = options.license || 'MIT';
      pkg.repository = options.repository || {};
    }

    // Ajouter les engines
    if (options.engines) {
      pkg.engines = options.engines;
    } else if (this.options.includeDefaults) {
      pkg.engines = {
        node: '>=16.0.0'
      };
    }

    // Ajouter les champs supplémentaires
    if (options.fields) {
      Object.assign(pkg, options.fields);
    }

    // Trier les clés
    const sorted = this._sortPackageJson(pkg);

    return JSON.stringify(sorted, null, this.options.indent);
  }

  /**
   * Obtient les champs par défaut
   * @private
   * @param {Object} options - Options
   * @returns {Object} Champs par défaut
   */
  _getDefaultFields(options) {
    if (!this.options.includeDefaults) return {};

    return {
      main: options.main || 'src/index.js',
      type: options.type || 'module',
      homepage: options.homepage || '',
      bugs: {
        url: ''
      }
    };
  }

  /**
   * Organise les dépendances par type
   * @private
   * @param {Array} dependencies - Dépendances
   * @param {Object} options - Options
   * @returns {Object} Dépendances organisées
   */
  _organizeDependencies(dependencies, options) {
    const organized = {
      production: [],
      development: [],
      peer: []
    };

    dependencies.forEach(dep => {
      const type = dep.type || this._inferType(dep, options);
      
      if (type === 'production') {
        organized.production.push(dep);
      } else if (type === 'development') {
        organized.development.push(dep);
      } else if (type === 'peer') {
        organized.peer.push(dep);
      }
    });

    if (this.options.sortDeps) {
      organized.production.sort((a, b) => a.name.localeCompare(b.name));
      organized.development.sort((a, b) => a.name.localeCompare(b.name));
      organized.peer.sort((a, b) => a.name.localeCompare(b.name));
    }

    return organized;
  }

  /**
   * Infère le type d'une dépendance
   * @private
   * @param {Object} dep - Dépendance
   * @param {Object} options - Options
   * @returns {string} Type inféré
   */
  _inferType(dep, options) {
    // Dépendances de build typiquement en dev
    const buildDeps = ['webpack', 'vite', 'esbuild', 'rollup', 'parcel', 
      'babel', 'typescript', 'eslint', 'prettier', 'jest'];

    if (buildDeps.includes(dep.name)) {
      return 'development';
    }

    // Par défaut, production
    return 'production';
  }

  /**
   * Formate les dépendances pour package.json
   * @private
   * @param {Array} deps - Dépendances
   * @returns {Object} Objet dépendances
   */
  _formatDependencies(deps) {
    const result = {};

    deps.forEach(dep => {
      const version = dep.suggestedVersion || dep.latest || 'latest';
      result[dep.name] = version;
    });

    return result;
  }

  /**
   * Génère les scripts npm
   * @private
   * @param {Object} deps - Dépendances organisées
   * @param {Object} options - Options
   * @returns {Object} Scripts
   */
  _generateScripts(deps, options) {
    const scripts = {};

    // Scripts selon les frameworks détectés
    if (this._hasReact(deps)) {
      scripts.start = 'react-scripts start';
      scripts.build = 'react-scripts build';
      scripts.test = 'react-scripts test';
      scripts.eject = 'react-scripts eject';
    } else if (this._hasVue(deps)) {
      scripts.serve = 'vue-cli-service serve';
      scripts.build = 'vue-cli-service build';
    } else if (this._hasAngular(deps)) {
      scripts.ng = 'ng';
      scripts.start = 'ng serve';
      scripts.build = 'ng build';
    } else if (this._hasNode(deps)) {
      scripts.start = 'node index.js';
      scripts.dev = 'nodemon index.js';
    } else {
      // Scripts génériques
      scripts.start = 'npm run dev';
      scripts.dev = 'npx serve';
      scripts.build = 'echo "Build not configured"';
    }

    // Scripts supplémentaires
    if (this._hasTypeScript(deps)) {
      scripts.typecheck = 'tsc --noEmit';
    }

    if (this._hasEslint(deps)) {
      scripts.lint = 'eslint src';
      scripts.lint = 'eslint src --fix';
    }

    if (this._hasPrettier(deps)) {
      scripts.format = 'prettier --write "src/**/*.{js,jsx,ts,tsx}"';
    }

    // Ajouter les scripts personnalisés
    if (options.customScripts) {
      Object.assign(scripts, options.customScripts);
    }

    // Trier les scripts
    const sorted = {};
    Object.keys(scripts).sort().forEach(key => {
      sorted[key] = scripts[key];
    });

    return sorted;
  }

  /**
   * Vérifie la présence de React
   * @private
   * @param {Object} deps - Dépendances
   * @returns {boolean} true si React présent
   */
  _hasReact(deps) {
    return deps.production.some(d => d.name === 'react') ||
           deps.development.some(d => d.name === 'react');
  }

  /**
   * Vérifie la présence de Vue
   * @private
   * @param {Object} deps - Dépendances
   * @returns {boolean} true si Vue présent
   */
  _hasVue(deps) {
    return deps.production.some(d => d.name === 'vue') ||
           deps.development.some(d => d.name === 'vue');
  }

  /**
   * Vérifie la présence d'Angular
   * @private
   * @param {Object} deps - Dépendances
   * @returns {boolean} true si Angular présent
   */
  _hasAngular(deps) {
    return deps.production.some(d => d.name.startsWith('@angular/'));
  }

  /**
   * Vérifie la présence de Node.js
   * @private
   * @param {Object} deps - Dépendances
   * @returns {boolean} true si Node.js présent
   */
  _hasNode(deps) {
    return deps.production.some(d => ['express', 'koa', 'fastify'].includes(d.name));
  }

  /**
   * Vérifie la présence de TypeScript
   * @private
   * @param {Object} deps - Dépendances
   * @returns {boolean} true si TypeScript présent
   */
  _hasTypeScript(deps) {
    return deps.development.some(d => d.name === 'typescript') ||
           deps.production.some(d => d.name === 'typescript');
  }

  /**
   * Vérifie la présence d'ESLint
   * @private
   * @param {Object} deps - Dépendances
   * @returns {boolean} true si ESLint présent
   */
  _hasEslint(deps) {
    return deps.development.some(d => d.name === 'eslint');
  }

  /**
   * Vérifie la présence de Prettier
   * @private
   * @param {Object} deps - Dépendances
   * @returns {boolean} true si Prettier présent
   */
  _hasPrettier(deps) {
    return deps.development.some(d => d.name === 'prettier');
  }

  /**
   * Trie les clés du package.json
   * @private
   * @param {Object} pkg - Package.json
   * @returns {Object} Package.json trié
   */
  _sortPackageJson(pkg) {
    const order = [
      'name', 'version', 'description', 'private',
      'main', 'module', 'browser', 'types',
      'scripts', 'dependencies', 'devDependencies',
      'peerDependencies', 'optionalDependencies',
      'engines', 'keywords', 'author', 'license',
      'repository', 'homepage', 'bugs'
    ];

    const sorted = {};
    
    order.forEach(key => {
      if (pkg[key] !== undefined) {
        sorted[key] = pkg[key];
      }
    });

    // Ajouter les clés restantes
    Object.keys(pkg)
      .sort()
      .forEach(key => {
        if (!order.includes(key)) {
          sorted[key] = pkg[key];
        }
      });

    return sorted;
  }

  /**
   * Met à jour un package.json existant
   * @param {Object} existing - Package.json existant
   * @param {Array} dependencies - Nouvelles dépendances
   * @param {Object} options - Options
   * @returns {Object} Package.json mis à jour
   */
  update(existing, dependencies, options = {}) {
    const updated = { ...existing };

    // Mettre à jour les dépendances
    const deps = this._organizeDependencies(dependencies, options);

    if (deps.production.length > 0) {
      updated.dependencies = {
        ...updated.dependencies,
        ...this._formatDependencies(deps.production)
      };
    }

    if (deps.development.length > 0) {
      updated.devDependencies = {
        ...updated.devDependencies,
        ...this._formatDependencies(deps.development)
      };
    }

    if (deps.peer.length > 0) {
      updated.peerDependencies = {
        ...updated.peerDependencies,
        ...this._formatDependencies(deps.peer)
      };
    }

    // Trier les dépendances
    if (updated.dependencies) {
      updated.dependencies = Object.keys(updated.dependencies)
        .sort()
        .reduce((acc, key) => {
          acc[key] = updated.dependencies[key];
          return acc;
        }, {});
    }

    if (updated.devDependencies) {
      updated.devDependencies = Object.keys(updated.devDependencies)
        .sort()
        .reduce((acc, key) => {
          acc[key] = updated.devDependencies[key];
          return acc;
        }, {});
    }

    return updated;
  }
}

export default PackageJsonGenerator;
