/**
 * VariableManager
 * Gère les variables d'environnement
 */

export class VariableManager {
  /**
   * Crée une instance de VariableManager
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      caseSensitive: options.caseSensitive || false,
      allowOverwrite: options.allowOverwrite !== false,
      validateTypes: options.validateTypes || false,
      ...options
    };

    this.variables = new Map();
    this.defaults = new Map();
    this.types = new Map();
    this.listeners = new Set();
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
  }

  /**
   * Définit une variable
   * @param {string} key - Clé de la variable
   * @param {any} value - Valeur
   * @param {Object} options - Options
   * @returns {boolean} true si réussi
   */
  set(key, value, options = {}) {
    const normalizedKey = this._normalizeKey(key);

    // Vérifier si la variable existe déjà
    if (this.variables.has(normalizedKey) && !this.options.allowOverwrite && !options.force) {
      throw new Error(`Variable ${key} existe déjà et ne peut pas être écrasée`);
    }

    // Valider le type si nécessaire
    if (this.options.validateTypes && this.types.has(normalizedKey)) {
      const expectedType = this.types.get(normalizedKey);
      const actualType = typeof value;
      if (actualType !== expectedType) {
        throw new Error(`Type invalide pour ${key}: attendu ${expectedType}, reçu ${actualType}`);
      }
    }

    const oldValue = this.variables.get(normalizedKey);
    
    // Sauvegarder dans l'historique
    this._addToHistory({
      type: 'set',
      key: normalizedKey,
      oldValue,
      newValue: value,
      timestamp: Date.now()
    });

    this.variables.set(normalizedKey, value);

    // Injecter dans window
    this._injectToWindow(normalizedKey, value);

    // Notifier les listeners
    this._notifyListeners('set', normalizedKey, value, oldValue);

    return true;
  }

  /**
   * Récupère une variable
   * @param {string} key - Clé de la variable
   * @param {any} defaultValue - Valeur par défaut
   * @returns {any} Valeur de la variable
   */
  get(key, defaultValue = null) {
    const normalizedKey = this._normalizeKey(key);
    
    if (this.variables.has(normalizedKey)) {
      return this.variables.get(normalizedKey);
    }

    if (this.defaults.has(normalizedKey)) {
      return this.defaults.get(normalizedKey);
    }

    return defaultValue;
  }

  /**
   * Supprime une variable
   * @param {string} key - Clé de la variable
   * @returns {boolean} true si supprimée
   */
  delete(key) {
    const normalizedKey = this._normalizeKey(key);
    
    if (!this.variables.has(normalizedKey)) {
      return false;
    }

    const oldValue = this.variables.get(normalizedKey);
    
    this._addToHistory({
      type: 'delete',
      key: normalizedKey,
      oldValue,
      timestamp: Date.now()
    });

    this.variables.delete(normalizedKey);

    // Retirer de window
    this._removeFromWindow(normalizedKey);

    this._notifyListeners('delete', normalizedKey, null, oldValue);

    return true;
  }

  /**
   * Définit une valeur par défaut
   * @param {string} key - Clé de la variable
   * @param {any} value - Valeur par défaut
   */
  setDefault(key, value) {
    const normalizedKey = this._normalizeKey(key);
    this.defaults.set(normalizedKey, value);
  }

  /**
   * Définit le type attendu d'une variable
   * @param {string} key - Clé de la variable
   * @param {string} type - Type attendu ('string', 'number', 'boolean', etc.)
   */
  setType(key, type) {
    const normalizedKey = this._normalizeKey(key);
    this.types.set(normalizedKey, type);
  }

  /**
   * Vérifie si une variable existe
   * @param {string} key - Clé de la variable
   * @returns {boolean} true si existe
   */
  has(key) {
    const normalizedKey = this._normalizeKey(key);
    return this.variables.has(normalizedKey);
  }

  /**
   * Récupère toutes les variables
   * @returns {Object} Toutes les variables
   */
  getAll() {
    const result = {};
    this.variables.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Récupère toutes les clés
   * @returns {Array} Liste des clés
   */
  keys() {
    return Array.from(this.variables.keys());
  }

  /**
   * Récupère toutes les valeurs
   * @returns {Array} Liste des valeurs
   */
  values() {
    return Array.from(this.variables.values());
  }

  /**
   * Nombre de variables
   * @returns {number} Nombre de variables
   */
  size() {
    return this.variables.size;
  }

  /**
   * Supprime toutes les variables
   */
  clear() {
    this._addToHistory({
      type: 'clear',
      oldValues: this.getAll(),
      timestamp: Date.now()
    });

    // Retirer de window
    this.variables.forEach((_, key) => {
      this._removeFromWindow(key);
    });

    this.variables.clear();
    this._notifyListeners('clear', null, null, null);
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
  _notifyListeners(type, key, newValue, oldValue) {
    this.listeners.forEach(listener => {
      try {
        listener({ type, key, newValue, oldValue, timestamp: Date.now() });
      } catch (error) {
        console.error('Erreur dans un listener VariableManager:', error);
      }
    });
  }

  /**
   * Normalise une clé
   * @private
   * @param {string} key - Clé à normaliser
   * @returns {string} Clé normalisée
   */
  _normalizeKey(key) {
    return this.options.caseSensitive ? key : key.toUpperCase();
  }

  /**
   * Injecte une variable dans window
   * @private
   * @param {string} key - Clé de la variable
   * @param {any} value - Valeur
   */
  _injectToWindow(key, value) {
    try {
      window[`ENV_${key}`] = value;
    } catch (error) {
      console.warn(`Erreur injection variable ${key}:`, error);
    }
  }

  /**
   * Retire une variable de window
   * @private
   * @param {string} key - Clé de la variable
   */
  _removeFromWindow(key) {
    try {
      delete window[`ENV_${key}`];
    } catch (error) {
      console.warn(`Erreur retrait variable ${key}:`, error);
    }
  }

  /**
   * Ajoute une entrée dans l'historique
   * @private
   * @param {Object} entry - Entrée d'historique
   */
  _addToHistory(entry) {
    this.history.push(entry);
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Récupère l'historique des changements
   * @param {number} limit - Nombre d'entrées
   * @returns {Array} Historique
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Importe des variables depuis un objet
   * @param {Object} variables - Variables à importer
   * @param {boolean} merge - Fusionner avec les existantes
   */
  import(variables, merge = false) {
    if (!merge) {
      this.clear();
    }

    Object.entries(variables).forEach(([key, value]) => {
      this.set(key, value, { force: true });
    });
  }

  /**
   * Exporte les variables vers un objet
   * @returns {Object} Variables exportées
   */
  export() {
    return this.getAll();
  }

  /**
   * Sérialise les variables pour l'URL
   * @returns {string} Paramètres URL
   */
  toQueryString() {
    const params = new URLSearchParams();
    this.variables.forEach((value, key) => {
      params.append(`env_${key}`, String(value));
    });
    return params.toString();
  }

  /**
   * Charge des variables depuis l'URL
   */
  fromQueryString(queryString) {
    const params = new URLSearchParams(queryString);
    
    params.forEach((value, key) => {
      if (key.startsWith('env_')) {
        const varKey = key.substring(4);
        this.set(varKey, value, { force: true });
      }
    });
  }
}

export default VariableManager;
