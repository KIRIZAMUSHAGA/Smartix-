/**
 * KnowledgeBase
 * Base de connaissances des dépendances (versions, descriptions, alternatives)
 */

import EventEmitter from 'events';

export class KnowledgeBase extends EventEmitter {
  /**
   * Crée une instance de KnowledgeBase
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      autoUpdate: options.autoUpdate !== false,
      updateInterval: options.updateInterval || 86400000, // 24h
      ...options
    };

    this.packages = new Map();
    this.groups = new Map();
    this.conflicts = [];
    this.lastUpdate = null;
    this.updateTimer = null;
  }

  /**
   * Charge la base de connaissances
   */
  async load() {
    // Charger les packages par défaut
    this._loadDefaultPackages();
    
    // Charger les conflits par défaut
    this._loadDefaultConflicts();
    
    // Charger les groupes par défaut
    this._loadDefaultGroups();

    this.lastUpdate = Date.now();

    // Démarrer les mises à jour automatiques
    if (this.options.autoUpdate) {
      this._startAutoUpdates();
    }

    this.emit('loaded', { count: this.packages.size });
  }

  /**
   * Charge les packages par défaut
   * @private
   */
  _loadDefaultPackages() {
    const defaultPackages = {
      // React ecosystem
      'react': {
        latest: '18.2.0',
        description: 'Bibliothèque UI',
        group: 'react',
        alternatives: ['preact', 'inferno'],
        peerDependencies: {
          'react-dom': '^18.2.0'
        },
        tags: ['ui', 'frontend', 'components'],
        repository: 'facebook/react',
        license: 'MIT'
      },
      'react-dom': {
        latest: '18.2.0',
        description: 'Rendu React dans le DOM',
        group: 'react',
        peerDependencies: {
          'react': '^18.2.0'
        },
        tags: ['ui', 'frontend', 'dom'],
        repository: 'facebook/react'
      },
      'react-native': {
        latest: '0.72.0',
        description: 'Framework mobile',
        group: 'react',
        alternatives: ['expo'],
        peerDependencies: {
          'react': '18.2.0'
        },
        tags: ['mobile', 'ios', 'android'],
        repository: 'facebook/react-native'
      },
      'react-scripts': {
        latest: '5.0.1',
        description: 'Configuration CRA',
        group: 'build-tools',
        alternatives: ['vite', 'parcel', 'webpack'],
        tags: ['build', 'webpack', 'cra'],
        repository: 'facebook/create-react-app'
      },
      
      // State management
      'redux': {
        latest: '4.2.1',
        description: 'Gestion d\'état',
        group: 'state-management',
        alternatives: ['zustand', 'mobx', 'recoil'],
        peerDependencies: {
          'react-redux': '^8.0.0'
        },
        tags: ['state', 'store', 'flux'],
        repository: 'reduxjs/redux'
      },
      'zustand': {
        latest: '4.4.0',
        description: 'Gestion d\'état minimaliste',
        group: 'state-management',
        size: 'small',
        tags: ['state', 'hooks', 'small'],
        repository: 'pmndrs/zustand'
      },
      'mobx': {
        latest: '6.10.0',
        description: 'State management réactif',
        group: 'state-management',
        alternatives: ['redux', 'zustand'],
        tags: ['state', 'reactive', 'observable'],
        repository: 'mobxjs/mobx'
      },
      
      // Routing
      'react-router-dom': {
        latest: '6.14.0',
        description: 'Routing pour React',
        group: 'routing',
        alternatives: ['reach-router', 'wouter'],
        tags: ['router', 'navigation', 'spa'],
        repository: 'remix-run/react-router'
      },
      'vue-router': {
        latest: '4.2.0',
        description: 'Routing pour Vue',
        group: 'routing',
        tags: ['vue', 'router'],
        repository: 'vuejs/router'
      },
      
      // HTTP
      'axios': {
        latest: '1.4.0',
        description: 'Client HTTP',
        group: 'http-client',
        alternatives: ['fetch', 'got', 'superagent'],
        tags: ['http', 'ajax', 'api'],
        repository: 'axios/axios'
      },
      'got': {
        latest: '13.0.0',
        description: 'Client HTTP pour Node.js',
        group: 'http-client',
        tags: ['http', 'node', 'promise'],
        repository: 'sindresorhus/got'
      },
      
      // Forms
      'react-hook-form': {
        latest: '7.45.0',
        description: 'Gestion de formulaires',
        group: 'forms',
        alternatives: ['formik', 'final-form'],
        tags: ['forms', 'validation', 'hooks'],
        repository: 'react-hook-form/react-hook-form'
      },
      'formik': {
        latest: '2.4.0',
        description: 'Formulaires pour React',
        group: 'forms',
        tags: ['forms', 'validation'],
        repository: 'jaredpalmer/formik'
      },
      
      // UI Libraries
      '@mui/material': {
        latest: '5.14.0',
        description: 'Material-UI',
        group: 'ui',
        alternatives: ['antd', 'chakra-ui', 'tailwindcss'],
        tags: ['ui', 'material', 'components'],
        repository: 'mui/material-ui'
      },
      'antd': {
        latest: '5.8.0',
        description: 'Ant Design',
        group: 'ui',
        tags: ['ui', 'ant', 'components'],
        repository: 'ant-design/ant-design'
      },
      'chakra-ui': {
        latest: '2.7.0',
        description: 'Chakra UI',
        group: 'ui',
        tags: ['ui', 'accessible', 'components'],
        repository: 'chakra-ui/chakra-ui'
      },
      'tailwindcss': {
        latest: '3.3.0',
        description: 'Framework CSS utility-first',
        group: 'ui',
        alternatives: ['bootstrap', 'bulma'],
        tags: ['css', 'styling', 'utility'],
        repository: 'tailwindlabs/tailwindcss'
      },
      
      // Backend
      'express': {
        latest: '4.18.2',
        description: 'Framework web Node.js',
        group: 'node',
        alternatives: ['koa', 'fastify', 'nest.js'],
        tags: ['server', 'http', 'middleware'],
        repository: 'expressjs/express'
      },
      'fastify': {
        latest: '4.21.0',
        description: 'Framework web rapide',
        group: 'node',
        tags: ['server', 'http', 'performance'],
        repository: 'fastify/fastify'
      },
      'nestjs': {
        latest: '10.1.0',
        description: 'Framework Node.js progressif',
        group: 'node',
        tags: ['server', 'typescript', 'modular'],
        repository: 'nestjs/nest'
      },
      
      // Database
      'mongoose': {
        latest: '7.3.0',
        description: 'ODM MongoDB',
        group: 'database',
        alternatives: ['prisma', 'typeorm', 'sequelize'],
        tags: ['mongodb', 'odm', 'schema'],
        repository: 'Automattic/mongoose'
      },
      'prisma': {
        latest: '5.0.0',
        description: 'ORM Next-gen',
        group: 'database',
        tags: ['orm', 'typescript', 'database'],
        repository: 'prisma/prisma'
      },
      'typeorm': {
        latest: '0.3.17',
        description: 'ORM TypeScript',
        group: 'database',
        tags: ['orm', 'typescript', 'sql'],
        repository: 'typeorm/typeorm'
      },
      
      // Testing
      'jest': {
        latest: '29.5.0',
        description: 'Framework de test',
        group: 'testing',
        alternatives: ['mocha', 'jasmine', 'vitest'],
        tags: ['test', 'unit', 'snapshot'],
        repository: 'jestjs/jest'
      },
      'vitest': {
        latest: '0.33.0',
        description: 'Framework de test rapide',
        group: 'testing',
        tags: ['test', 'vite', 'esm'],
        repository: 'vitest-dev/vitest'
      },
      '@testing-library/react': {
        latest: '14.0.0',
        description: 'Tests React',
        group: 'testing',
        peerDependencies: {
          'jest': '^29.0.0'
        },
        tags: ['test', 'react', 'dom'],
        repository: 'testing-library/react-testing-library'
      },
      
      // Utilitaires
      'lodash': {
        latest: '4.17.21',
        description: 'Utilitaire JavaScript',
        group: 'utils',
        alternatives: ['ramda', 'date-fns'],
        tags: ['utility', 'functional'],
        repository: 'lodash/lodash'
      },
      'moment': {
        latest: '2.29.4',
        description: 'Manipulation de dates',
        group: 'utils',
        alternatives: ['date-fns', 'dayjs'],
        tags: ['date', 'time', 'calendar'],
        repository: 'moment/moment'
      },
      'date-fns': {
        latest: '2.30.0',
        description: 'Dates modernes',
        group: 'utils',
        tags: ['date', 'functional', 'tree-shaking'],
        repository: 'date-fns/date-fns'
      },
      
      // Build tools
      'vite': {
        latest: '4.4.0',
        description: 'Build tool rapide',
        group: 'build-tools',
        alternatives: ['webpack', 'parcel', 'rollup'],
        tags: ['build', 'dev-server', 'esm'],
        repository: 'vitejs/vite'
      },
      'webpack': {
        latest: '5.88.0',
        description: 'Module bundler',
        group: 'build-tools',
        tags: ['build', 'bundler', 'modules'],
        repository: 'webpack/webpack'
      },
      'esbuild': {
        latest: '0.18.0',
        description: 'Bundler extrêmement rapide',
        group: 'build-tools',
        tags: ['build', 'bundler', 'performance'],
        repository: 'evanw/esbuild'
      },
      
      // Linting
      'eslint': {
        latest: '8.45.0',
        description: 'Linter JavaScript',
        group: 'linting',
        alternatives: ['prettier', 'jshint'],
        tags: ['lint', 'code-quality'],
        repository: 'eslint/eslint'
      },
      'prettier': {
        latest: '3.0.0',
        description: 'Formatter de code',
        group: 'linting',
        tags: ['format', 'style'],
        repository: 'prettier/prettier'
      },
      
      // Types
      '@types/react': {
        latest: '18.2.0',
        description: 'Types TypeScript pour React',
        group: 'types',
        tags: ['typescript', 'types'],
        repository: 'DefinitelyTyped/DefinitelyTyped'
      },
      '@types/node': {
        latest: '20.4.0',
        description: 'Types TypeScript pour Node.js',
        group: 'types',
        tags: ['typescript', 'types'],
        repository: 'DefinitelyTyped/DefinitelyTyped'
      }
    };

    Object.entries(defaultPackages).forEach(([name, info]) => {
      this.packages.set(name, {
        name,
        ...info,
        added: Date.now()
      });
    });
  }

  /**
   * Charge les conflits par défaut
   * @private
   */
  _loadDefaultConflicts() {
    this.conflicts = [
      {
        packages: ['react', 'react-dom'],
        message: 'React et React DOM doivent avoir la même version',
        severity: 'error',
        check: (deps) => {
          const react = deps.find(d => d.name === 'react');
          const reactDom = deps.find(d => d.name === 'react-dom');
          if (react && reactDom && react.version !== reactDom.version) {
            return {
              type: 'version-mismatch',
              packages: ['react', 'react-dom'],
              current: { react: react.version, 'react-dom': reactDom.version },
              suggested: react.version
            };
          }
          return null;
        }
      },
      {
        packages: ['react-native', 'react'],
        message: 'React Native nécessite une version spécifique de React',
        severity: 'warning',
        check: (deps) => {
          const rn = deps.find(d => d.name === 'react-native');
          const react = deps.find(d => d.name === 'react');
          if (rn && react && !react.version.startsWith('18.')) {
            return {
              type: 'incompatible',
              packages: ['react-native', 'react'],
              message: 'React Native 0.72+ nécessite React 18'
            };
          }
          return null;
        }
      },
      {
        packages: ['redux', 'react-redux'],
        message: 'React Redux nécessite Redux',
        severity: 'error',
        check: (deps) => {
          const reactRedux = deps.find(d => d.name === 'react-redux');
          const redux = deps.find(d => d.name === 'redux');
          if (reactRedux && !redux) {
            return {
              type: 'peer-missing',
              package: 'react-redux',
              peer: 'redux',
              message: 'react-redux nécessite redux'
            };
          }
          return null;
        }
      },
      {
        packages: ['@mui/material', '@emotion/react'],
        message: 'Material-UI nécessite Emotion',
        severity: 'error',
        check: (deps) => {
          const mui = deps.find(d => d.name === '@mui/material');
          const emotion = deps.find(d => d.name === '@emotion/react');
          if (mui && !emotion) {
            return {
              type: 'peer-missing',
              package: '@mui/material',
              peer: '@emotion/react',
              message: '@mui/material nécessite @emotion/react'
            };
          }
          return null;
        }
      },
      {
        packages: ['webpack', 'webpack-cli'],
        message: 'Webpack CLI recommandé pour les scripts',
        severity: 'info',
        check: (deps) => {
          const webpack = deps.find(d => d.name === 'webpack');
          const cli = deps.find(d => d.name === 'webpack-cli');
          if (webpack && !cli) {
            return {
              type: 'recommended',
              package: 'webpack',
              recommended: 'webpack-cli',
              message: 'webpack-cli recommandé pour utiliser webpack en ligne de commande'
            };
          }
          return null;
        }
      }
    ];
  }

  /**
   * Charge les groupes par défaut
   * @private
   */
  _loadDefaultGroups() {
    const groups = {
      'react': {
        name: 'React Ecosystem',
        description: 'Bibliothèques pour React',
        icon: '⚛️',
        color: '#61dafb'
      },
      'vue': {
        name: 'Vue Ecosystem',
        description: 'Bibliothèques pour Vue',
        icon: '🟢',
        color: '#42b883'
      },
      'angular': {
        name: 'Angular Ecosystem',
        description: 'Bibliothèques pour Angular',
        icon: '🔺',
        color: '#dd0031'
      },
      'state-management': {
        name: 'State Management',
        description: 'Gestion d\'état',
        icon: '📊',
        color: '#ff6b6b'
      },
      'routing': {
        name: 'Routing',
        description: 'Gestion du routage',
        icon: '🛣️',
        color: '#4ecdc4'
      },
      'http-client': {
        name: 'HTTP Clients',
        description: 'Clients pour requêtes HTTP',
        icon: '🌐',
        color: '#45b7d1'
      },
      'forms': {
        name: 'Forms',
        description: 'Gestion de formulaires',
        icon: '📝',
        color: '#96ceb4'
      },
      'ui': {
        name: 'UI Libraries',
        description: 'Bibliothèques de composants UI',
        icon: '🎨',
        color: '#feca57'
      },
      'node': {
        name: 'Node.js',
        description: 'Outils pour Node.js',
        icon: '🟢',
        color: '#90be6d'
      },
      'database': {
        name: 'Database',
        description: 'ORM et ODM',
        icon: '🗄️',
        color: '#577590'
      },
      'testing': {
        name: 'Testing',
        description: 'Frameworks de test',
        icon: '🧪',
        color: '#f9c74f'
      },
      'utils': {
        name: 'Utilities',
        description: 'Utilitaires divers',
        icon: '🔧',
        color: '#a0a0a0'
      },
      'build-tools': {
        name: 'Build Tools',
        description: 'Outils de build',
        icon: '🏗️',
        color: '#6c5ce7'
      },
      'linting': {
        name: 'Linting & Formatting',
        description: 'Outils de qualité de code',
        icon: '🔍',
        color: '#f9844a'
      },
      'types': {
        name: 'TypeScript Types',
        description: 'Définitions de types',
        icon: '📘',
        color: '#3178c6'
      }
    };

    Object.entries(groups).forEach(([id, info]) => {
      this.groups.set(id, info);
    });
  }

  /**
   * Démarre les mises à jour automatiques
   * @private
   */
  _startAutoUpdates() {
    this.updateTimer = setInterval(() => {
      this.update().catch(console.error);
    }, this.options.updateInterval);
  }

  /**
   * Met à jour la base de connaissances
   */
  async update() {
    // TODO: Implémenter la mise à jour depuis une API
    this.lastUpdate = Date.now();
    this.emit('updated', { timestamp: this.lastUpdate });
  }

  /**
   * Récupère les informations d'un package
   * @param {string} name - Nom du package
   * @returns {Object|null} Informations du package
   */
  get(name) {
    return this.packages.get(name) || null;
  }

  /**
   * Ajoute ou met à jour un package
   * @param {string} name - Nom du package
   * @param {Object} info - Informations du package
   */
  set(name, info) {
    this.packages.set(name, {
      name,
      ...info,
      updated: Date.now()
    });
    this.emit('package:updated', { name, info });
  }

  /**
   * Recherche des packages
   * @param {string} query - Terme de recherche
   * @returns {Array} Résultats de la recherche
   */
  search(query) {
    if (!query) return Array.from(this.packages.values());

    const searchLower = query.toLowerCase();
    const results = [];

    this.packages.forEach((pkg, name) => {
      if (name.toLowerCase().includes(searchLower) ||
          (pkg.description && pkg.description.toLowerCase().includes(searchLower)) ||
          (pkg.tags && pkg.tags.some(t => t.includes(searchLower)))) {
        results.push(pkg);
      }
    });

    return results;
  }

  /**
   * Récupère les packages d'un groupe
   * @param {string} group - Nom du groupe
   * @returns {Array} Packages du groupe
   */
  getByGroup(group) {
    const results = [];
    this.packages.forEach(pkg => {
      if (pkg.group === group) {
        results.push(pkg);
      }
    });
    return results;
  }

  /**
   * Récupère les conflits connus
   * @returns {Array} Liste des conflits
   */
  getConflicts() {
    return this.conflicts;
  }

  /**
   * Récupère les informations d'un groupe
   * @param {string} groupId - ID du groupe
   * @returns {Object|null} Informations du groupe
   */
  getGroupInfo(groupId) {
    return this.groups.get(groupId) || null;
  }

  /**
   * Récupère tous les groupes
   * @returns {Object} Tous les groupes
   */
  getAllGroups() {
    const groups = {};
    this.groups.forEach((info, id) => {
      groups[id] = info;
    });
    return groups;
  }

  /**
   * Suggère des alternatives pour un package
   * @param {string} name - Nom du package
   * @returns {Array} Liste d'alternatives
   */
  getAlternatives(name) {
    const pkg = this.packages.get(name);
    if (!pkg || !pkg.alternatives) return [];

    return pkg.alternatives
      .map(alt => this.packages.get(alt))
      .filter(Boolean);
  }

  /**
   * Vérifie si un package est déprécié
   * @param {string} name - Nom du package
   * @returns {boolean} true si déprécié
   */
  isDeprecated(name) {
    const pkg = this.packages.get(name);
    return pkg?.deprecated || false;
  }

  /**
   * Nombre de packages dans la base
   * @returns {number} Nombre de packages
   */
  size() {
    return this.packages.size;
  }

  /**
   * Arrête les mises à jour automatiques
   */
  destroy() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.removeAllListeners();
  }
}

export default KnowledgeBase;
