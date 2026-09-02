/**
 * FeatureFlags
 * Gère les feature flags pour activer/désactiver des fonctionnalités
 */

export class FeatureFlags {
  /**
   * Crée une instance de FeatureFlags
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      persist: options.persist !== false,
      storageKey: options.storageKey || 'vibe_features',
      ...options
    };

    this.flags = new Map();
    this.groups = new Map();
    this.dependencies = new Map();
    this.listeners = new Set();
    this.history = [];

    this._loadPersistedFlags();
    this._setupDefaultFlags();
  }

  /**
   * Charge les flags persistants
   * @private
   */
  _loadPersistedFlags() {
    if (!this.options.persist) return;

    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (saved) {
        const flags = JSON.parse(saved);
        Object.entries(flags).forEach(([name, enabled]) => {
          this.flags.set(name, { enabled, persisted: true });
        });
      }
    } catch (error) {
      console.warn('Erreur chargement feature flags:', error);
    }
  }

  /**
   * Sauvegarde les flags
   * @private
   */
  _persistFlags() {
    if (!this.options.persist) return;

    try {
      const toSave = {};
      this.flags.forEach((value, key) => {
        if (value.persisted) {
          toSave[key] = value.enabled;
        }
      });
      localStorage.setItem(this.options.storageKey, JSON.stringify(toSave));
    } catch (error) {
      console.warn('Erreur sauvegarde feature flags:', error);
    }
  }

  /**
   * Crée les flags par défaut
   * @private
   */
  _setupDefaultFlags() {
    // Features de base
    this.register('hot-reload', {
      description: 'Rechargement à chaud des fichiers',
      default: true,
      group: 'development'
    });

    this.register('debug-tools', {
      description: 'Outils de débogage',
      default: true,
      group: 'development'
    });

    this.register('performance-monitor', {
      description: 'Moniteur de performance',
      default: true,
      group: 'development'
    });

    this.register('error-boundary', {
      description: 'Boundary d\'erreurs',
      default: true,
      group: 'core'
    });

    // Features de production
    this.register('analytics', {
      description: 'Collecte de données analytics',
      default: false,
      group: 'production'
    });

    this.register('error-reporting', {
      description: 'Rapports d\'erreurs',
      default: false,
      group: 'production'
    });

    this.register('performance-monitoring', {
      description: 'Monitoring des performances',
      default: false,
      group: 'production'
    });

    // Features de test
    this.register('test-tools', {
      description: 'Outils de test',
      default: false,
      group: 'testing'
    });

    this.register('coverage', {
      description: 'Couverture de code',
      default: false,
      group: 'testing'
    });

    // Groupe de features
    this.createGroup('development', {
      name: 'Développement',
      description: 'Outils pour le développement',
      icon: '🛠️'
    });

    this.createGroup('production', {
      name: 'Production',
      description: 'Features de production',
      icon: '🚀'
    });

    this.createGroup('testing', {
      name: 'Test',
      description: 'Outils de test',
      icon: '🧪'
    });

    this.createGroup('core', {
      name: 'Core',
      description: 'Fonctionnalités de base',
      icon: '⚙️'
    });
  }

  /**
   * Enregistre un nouveau feature flag
   * @param {string} name - Nom du flag
   * @param {Object} config - Configuration
   */
  register(name, config = {}) {
    if (this.flags.has(name)) {
      throw new Error(`Feature flag ${name} déjà enregistré`);
    }

    this.flags.set(name, {
      name,
      enabled: config.default || false,
      description: config.description || '',
      group: config.group || 'default',
      dependencies: config.dependencies || [],
      persisted: config.persisted !== false,
      metadata: config.metadata || {},
      registered: Date.now()
    });

    if (config.dependencies) {
      this.dependencies.set(name, new Set(config.dependencies));
    }
  }

  /**
   * Crée un groupe de features
   * @param {string} id - ID du groupe
   * @param {Object} config - Configuration du groupe
   */
  createGroup(id, config) {
    this.groups.set(id, {
      id,
      name: config.name || id,
      description: config.description || '',
      icon: config.icon || '📦',
      color: config.color || '#888'
    });
  }

  /**
   * Active un flag
   * @param {string} name - Nom du flag
   * @param {Object} options - Options
   * @returns {boolean} true si activé
   */
  enable(name, options = {}) {
    if (!this.flags.has(name)) {
      if (!options.create) {
        throw new Error(`Feature flag ${name} non trouvé`);
      }
      this.register(name, { default: true, ...options });
    }

    const flag = this.flags.get(name);
    
    // Vérifier les dépendances
    if (this.dependencies.has(name)) {
      const deps = this.dependencies.get(name);
      for (const dep of deps) {
        if (!this.isEnabled(dep)) {
          throw new Error(`Dépendance manquante: ${dep} doit être activé avant ${name}`);
        }
      }
    }

    if (!flag.enabled) {
      this._addToHistory({
        type: 'enable',
        name,
        timestamp: Date.now()
      });

      flag.enabled = true;
      flag.lastChanged = Date.now();

      this._notifyListeners('enable', name);
      this._persistFlags();

      // Activer les flags du même groupe si demandé
      if (options.enableGroup) {
        this._enableGroup(flag.group);
      }
    }

    return true;
  }

  /**
   * Désactive un flag
   * @param {string} name - Nom du flag
   */
  disable(name) {
    if (!this.flags.has(name)) {
      throw new Error(`Feature flag ${name} non trouvé`);
    }

    const flag = this.flags.get(name);
    
    if (flag.enabled) {
      // Vérifier si d'autres flags dépendent de celui-ci
      const dependents = this._findDependents(name);
      if (dependents.length > 0) {
        throw new Error(`Impossible de désactiver ${name}: utilisé par ${dependents.join(', ')}`);
      }

      this._addToHistory({
        type: 'disable',
        name,
        timestamp: Date.now()
      });

      flag.enabled = false;
      flag.lastChanged = Date.now();

      this._notifyListeners('disable', name);
      this._persistFlags();
    }
  }

  /**
   * Bascule un flag
   * @param {string} name - Nom du flag
   */
  toggle(name) {
    if (this.isEnabled(name)) {
      this.disable(name);
    } else {
      this.enable(name);
    }
  }

  /**
   * Vérifie si un flag est activé
   * @param {string} name - Nom du flag
   * @returns {boolean} true si activé
   */
  isEnabled(name) {
    const flag = this.flags.get(name);
    return flag ? flag.enabled : false;
  }

  /**
   * Vérifie si plusieurs flags sont activés
   * @param {Array} names - Liste des flags
   * @param {string} mode - 'all' ou 'any'
   * @returns {boolean} true si condition remplie
   */
  allEnabled(names, mode = 'all') {
    if (mode === 'all') {
      return names.every(name => this.isEnabled(name));
    } else {
      return names.some(name => this.isEnabled(name));
    }
  }

  /**
   * Récupère un flag
   * @param {string} name - Nom du flag
   * @returns {Object|null} Flag
   */
  get(name) {
    return this.flags.get(name) || null;
  }

  /**
   * Récupère tous les flags
   * @returns {Object} Tous les flags
   */
  getAll() {
    const result = {};
    this.flags.forEach((value, key) => {
      result[key] = {
        ...value,
        enabled: value.enabled
      };
    });
    return result;
  }

  /**
   * Récupère les flags d'un groupe
   * @param {string} group - Nom du groupe
   * @returns {Array} Flags du groupe
   */
  getByGroup(group) {
    const result = [];
    this.flags.forEach((flag, name) => {
      if (flag.group === group) {
        result.push({ name, ...flag });
      }
    });
    return result;
  }

  /**
   * Récupère tous les groupes
   * @returns {Object} Groupes
   */
  getGroups() {
    const result = {};
    this.groups.forEach((group, id) => {
      result[id] = {
        ...group,
        flags: this.getByGroup(id)
      };
    });
    return result;
  }

  /**
   * Réinitialise tous les flags
   */
  reset() {
    this.flags.forEach(flag => {
      flag.enabled = flag.default || false;
    });
    this._notifyListeners('reset', null);
    this._persistFlags();
  }

  /**
   * Ajoute un listener
   * @param {Function} listener - Fonction à appeler
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Supprime un listener
   * @param {Function} listener - Fonction à supprimer
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notifie les listeners
   * @private
   */
  _notifyListeners(type, name) {
    this.listeners.forEach(listener => {
      try {
        listener({ type, name, timestamp: Date.now() });
      } catch (error) {
        console.error('Erreur dans un listener FeatureFlags:', error);
      }
    });
  }

  /**
   * Ajoute une entrée dans l'historique
   * @private
   * @param {Object} entry - Entrée d'historique
   */
  _addToHistory(entry) {
    this.history.push(entry);
    
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  /**
   * Trouve les flags qui dépendent d'un flag
   * @private
   * @param {string} name - Nom du flag
   * @returns {Array} Flags dépendants
   */
  _findDependents(name) {
    const dependents = [];
    this.dependencies.forEach((deps, flag) => {
      if (deps.has(name)) {
        dependents.push(flag);
      }
    });
    return dependents;
  }

  /**
   * Active tous les flags d'un groupe
   * @private
   * @param {string} group - Nom du groupe
   */
  _enableGroup(group) {
    this.flags.forEach((flag, name) => {
      if (flag.group === group && !flag.enabled) {
        this.enable(name);
      }
    });
  }

  /**
   * Récupère l'historique
   * @param {number} limit - Nombre d'entrées
   * @returns {Array} Historique
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Nombre de flags
   * @returns {number} Nombre de flags
   */
  size() {
    return this.flags.size;
  }

  /**
   * Exporte la configuration
   * @returns {Object} Configuration exportée
   */
  export() {
    const config = {
      flags: {},
      groups: {}
    };

    this.flags.forEach((flag, name) => {
      config.flags[name] = {
        enabled: flag.enabled,
        description: flag.description,
        group: flag.group,
        metadata: flag.metadata
      };
    });

    this.groups.forEach((group, id) => {
      config.groups[id] = group;
    });

    return config;
  }

  /**
   * Importe une configuration
   * @param {Object} config - Configuration à importer
   */
  import(config) {
    if (config.flags) {
      Object.entries(config.flags).forEach(([name, flagConfig]) => {
        this.register(name, flagConfig);
        if (flagConfig.enabled) {
          this.enable(name);
        }
      });
    }

    if (config.groups) {
      Object.entries(config.groups).forEach(([id, groupConfig]) => {
        this.createGroup(id, groupConfig);
      });
    }
  }
}

export default FeatureFlags;
