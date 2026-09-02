/**
 * EnvironmentManager
 * Gère les environnements (development, staging, production) et leur configuration
 */

import EventEmitter from 'events';
import { VariableManager } from './VariableManager';
import { FeatureFlags } from './FeatureFlags';

export class EnvironmentManager extends EventEmitter {
  /**
   * Crée une instance de EnvironmentManager
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      persist: options.persist !== false,
      storageKey: options.storageKey || 'vibe_current_env',
      ...options
    };

    this.environments = new Map();
    this.currentEnv = null;
    this.variableManager = new VariableManager();
    this.featureFlags = new FeatureFlags();
    
    this._loadPersistedEnvironment();
    this._setupDefaultEnvironments();
  }

  /**
   * Charge l'environnement persistant
   * @private
   */
  _loadPersistedEnvironment() {
    if (!this.options.persist) return;

    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (saved) {
        this.currentEnv = saved;
      }
    } catch (error) {
      console.warn('Erreur chargement environnement persistant:', error);
    }
  }

  /**
   * Sauvegarde l'environnement courant
   * @private
   */
  _persistCurrentEnvironment() {
    if (!this.options.persist || !this.currentEnv) return;

    try {
      localStorage.setItem(this.options.storageKey, this.currentEnv);
    } catch (error) {
      console.warn('Erreur sauvegarde environnement:', error);
    }
  }

  /**
   * Crée les environnements par défaut
   * @private
   */
  _setupDefaultEnvironments() {
    // Environnement de développement
    this.createEnvironment('development', {
      name: 'Development',
      color: '#28a745',
      icon: '🛠️',
      variables: {
        NODE_ENV: 'development',
        API_URL: 'http://localhost:3000/api',
        DEBUG: 'true',
        LOG_LEVEL: 'debug'
      },
      features: ['hot-reload', 'debug-tools', 'performance-monitor', 'error-boundary'],
      buildConfig: {
        minify: false,
        sourceMaps: true,
        optimize: false
      }
    });

    // Environnement de staging
    this.createEnvironment('staging', {
      name: 'Staging',
      color: '#ffc107',
      icon: '🧪',
      variables: {
        NODE_ENV: 'staging',
        API_URL: 'https://staging-api.example.com',
        DEBUG: 'false',
        LOG_LEVEL: 'info'
      },
      features: ['analytics', 'error-reporting'],
      buildConfig: {
        minify: true,
        sourceMaps: true,
        optimize: true
      }
    });

    // Environnement de production
    this.createEnvironment('production', {
      name: 'Production',
      color: '#dc3545',
      icon: '🚀',
      variables: {
        NODE_ENV: 'production',
        API_URL: 'https://api.example.com',
        DEBUG: 'false',
        LOG_LEVEL: 'error'
      },
      features: ['analytics', 'error-reporting', 'performance-monitoring'],
      buildConfig: {
        minify: true,
        sourceMaps: false,
        optimize: true,
        gzip: true
      }
    });

    // Environnement de test
    this.createEnvironment('test', {
      name: 'Test',
      color: '#6f42c1',
      icon: '🧪',
      variables: {
        NODE_ENV: 'test',
        API_URL: 'http://localhost:3001/api',
        DEBUG: 'true',
        LOG_LEVEL: 'debug'
      },
      features: ['test-tools', 'coverage'],
      buildConfig: {
        minify: false,
        sourceMaps: true,
        optimize: false
      }
    });
  }

  /**
   * Crée un nouvel environnement
   * @param {string} id - Identifiant de l'environnement
   * @param {Object} config - Configuration de l'environnement
   * @returns {Object} Environnement créé
   */
  createEnvironment(id, config) {
    const environment = {
      id,
      name: config.name || id,
      color: config.color || '#888',
      icon: config.icon || '🌍',
      variables: new Map(Object.entries(config.variables || {})),
      features: new Set(config.features || []),
      buildConfig: config.buildConfig || {},
      created: Date.now(),
      lastUsed: null,
      metadata: config.metadata || {}
    };

    this.environments.set(id, environment);
    this.emit('environment-created', { id, environment });

    return environment;
  }

  /**
   * Supprime un environnement
   * @param {string} id - Identifiant de l'environnement
   */
  deleteEnvironment(id) {
    if (!this.environments.has(id)) {
      throw new Error(`Environnement ${id} non trouvé`);
    }

    if (this.currentEnv === id) {
      this.switchToEnvironment('development');
    }

    this.environments.delete(id);
    this.emit('environment-deleted', { id });
  }

  /**
   * Bascule vers un environnement
   * @param {string} id - Identifiant de l'environnement
   * @returns {Promise<Object>} Environnement activé
   */
  async switchToEnvironment(id) {
    if (!this.environments.has(id)) {
      throw new Error(`Environnement ${id} non trouvé`);
    }

    const previousEnv = this.currentEnv;
    const env = this.environments.get(id);
    
    this.currentEnv = id;
    env.lastUsed = Date.now();

    // Mettre à jour les variables
    this.variableManager.clear();
    env.variables.forEach((value, key) => {
      this.variableManager.set(key, value);
    });

    // Mettre à jour les feature flags
    this.featureFlags.clear();
    env.features.forEach(feature => {
      this.featureFlags.enable(feature);
    });

    // Persister
    this._persistCurrentEnvironment();

    // Émettre l'événement
    this.emit('environment-changed', {
      from: previousEnv,
      to: id,
      environment: this.getCurrentEnvironment()
    });

    return this.getCurrentEnvironment();
  }

  /**
   * Récupère l'environnement courant
   * @returns {Object|null} Environnement courant
   */
  getCurrentEnvironment() {
    if (!this.currentEnv) return null;
    
    const env = this.environments.get(this.currentEnv);
    return {
      ...env,
      variables: Object.fromEntries(env.variables),
      features: Array.from(env.features)
    };
  }

  /**
   * Récupère un environnement par son ID
   * @param {string} id - Identifiant de l'environnement
   * @returns {Object|null} Environnement
   */
  getEnvironment(id) {
    const env = this.environments.get(id);
    if (!env) return null;

    return {
      ...env,
      variables: Object.fromEntries(env.variables),
      features: Array.from(env.features)
    };
  }

  /**
   * Liste tous les environnements
   * @returns {Array} Liste des environnements
   */
  listEnvironments() {
    return Array.from(this.environments.entries()).map(([id, env]) => ({
      id,
      name: env.name,
      color: env.color,
      icon: env.icon,
      variableCount: env.variables.size,
      featureCount: env.features.size,
      lastUsed: env.lastUsed,
      current: id === this.currentEnv
    }));
  }

  /**
   * Met à jour la configuration d'un environnement
   * @param {string} id - Identifiant de l'environnement
   * @param {Object} updates - Mises à jour
   */
  updateEnvironment(id, updates) {
    if (!this.environments.has(id)) {
      throw new Error(`Environnement ${id} non trouvé`);
    }

    const env = this.environments.get(id);

    if (updates.name) env.name = updates.name;
    if (updates.color) env.color = updates.color;
    if (updates.icon) env.icon = updates.icon;
    
    if (updates.variables) {
      env.variables.clear();
      Object.entries(updates.variables).forEach(([k, v]) => env.variables.set(k, v));
    }

    if (updates.features) {
      env.features.clear();
      updates.features.forEach(f => env.features.add(f));
    }
    
    if (updates.buildConfig) {
      env.buildConfig = { ...env.buildConfig, ...updates.buildConfig };
    }

    this.emit('environment-updated', { id, updates });

    // Si c'est l'environnement courant, recharger
    if (id === this.currentEnv) {
      this.switchToEnvironment(id);
    }
  }

  /**
   * Ajoute une variable à l'environnement courant
   * @param {string} key - Clé de la variable
   * @param {any} value - Valeur
   */
  setVariable(key, value) {
    this.variableManager.set(key, value);
    
    // Sauvegarder dans l'environnement courant
    if (this.currentEnv) {
      const env = this.environments.get(this.currentEnv);
      env.variables.set(key, value);
    }

    this.emit('variable-changed', { key, value });
  }

  /**
   * Récupère une variable de l'environnement courant
   * @param {string} key - Clé de la variable
   * @param {any} defaultValue - Valeur par défaut
   * @returns {any} Valeur de la variable
   */
  getVariable(key, defaultValue = null) {
    return this.variableManager.get(key, defaultValue);
  }

  /**
   * Active une feature dans l'environnement courant
   * @param {string} feature - Nom de la feature
   */
  enableFeature(feature) {
    this.featureFlags.enable(feature);
    
    if (this.currentEnv) {
      const env = this.environments.get(this.currentEnv);
      env.features.add(feature);
    }

    this.emit('feature-changed', { feature, enabled: true });
  }

  /**
   * Désactive une feature dans l'environnement courant
   * @param {string} feature - Nom de la feature
   */
  disableFeature(feature) {
    this.featureFlags.disable(feature);
    
    if (this.currentEnv) {
      const env = this.environments.get(this.currentEnv);
      env.features.delete(feature);
    }

    this.emit('feature-changed', { feature, enabled: false });
  }

  /**
   * Vérifie si une feature est active
   * @param {string} feature - Nom de la feature
   * @returns {boolean} true si active
   */
  isFeatureEnabled(feature) {
    return this.featureFlags.isEnabled(feature);
  }

  /**
   * Clone un environnement
   * @param {string} sourceId - ID de l'environnement source
   * @param {string} newId - ID du nouvel environnement
   * @param {Object} overrides - Configurations à surcharger
   * @returns {Object} Nouvel environnement
   */
  cloneEnvironment(sourceId, newId, overrides = {}) {
    if (!this.environments.has(sourceId)) {
      throw new Error(`Environnement source ${sourceId} non trouvé`);
    }

    const source = this.environments.get(sourceId);
    
    const clone = {
      ...source,
      id: newId,
      name: `${source.name} (Copie)`,
      variables: new Map(source.variables),
      features: new Set(source.features),
      created: Date.now(),
      lastUsed: null,
      ...overrides
    };

    this.environments.set(newId, clone);
    this.emit('environment-cloned', { sourceId, newId });

    return this.getEnvironment(newId);
  }

  /**
   * Exporte la configuration des environnements
   * @returns {Object} Configuration exportée
   */
  exportConfig() {
    const config = {};

    this.environments.forEach((env, id) => {
      config[id] = {
        name: env.name,
        color: env.color,
        icon: env.icon,
        variables: Object.fromEntries(env.variables),
        features: Array.from(env.features),
        buildConfig: env.buildConfig,
        metadata: env.metadata
      };
    });

    return config;
  }

  /**
   * Importe une configuration d'environnements
   * @param {Object} config - Configuration à importer
   * @param {boolean} merge - Fusionner avec les existants
   */
  importConfig(config, merge = false) {
    if (!merge) {
      this.environments.clear();
    }

    Object.entries(config).forEach(([id, envConfig]) => {
      this.createEnvironment(id, envConfig);
    });

    this.emit('config-imported', { count: Object.keys(config).length });
  }

  /**
   * Réinitialise aux environnements par défaut
   */
  resetToDefaults() {
    this.environments.clear();
    this._setupDefaultEnvironments();
    this.switchToEnvironment('development');
    this.emit('reset');
  }

  /**
   * Obtient des statistiques sur les environnements
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      total: this.environments.size,
      current: this.currentEnv,
      variableCount: this.variableManager.size(),
      featureCount: this.featureFlags.size(),
      lastUsed: this.currentEnv ? this.environments.get(this.currentEnv).lastUsed : null
    };
  }
}

export default EnvironmentManager;
