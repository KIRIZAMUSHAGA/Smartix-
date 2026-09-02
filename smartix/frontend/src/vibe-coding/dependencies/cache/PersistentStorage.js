/**
 * PersistentStorage
 * Stockage persistant des données dans localStorage/indexedDB
 */

import EventEmitter from 'events';

export class PersistentStorage extends EventEmitter {
  /**
   * Crée une instance de PersistentStorage
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      prefix: options.prefix || 'vibe_deps_',
      storage: options.storage || 'localStorage', // ou 'indexedDB'
      version: options.version || '1.0.0',
      ...options
    };

    this.ready = false;
    this.db = null;
  }

  /**
   * Initialise le stockage
   */
  async initialize() {
    if (this.options.storage === 'indexedDB') {
      await this._initIndexedDB();
    } else {
      this._initLocalStorage();
    }
    this.ready = true;
    this.emit('initialized', { storage: this.options.storage });
  }

  /**
   * Initialise localStorage
   * @private
   */
  _initLocalStorage() {
    try {
      // Vérifier si localStorage est disponible
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch (error) {
      throw new Error('localStorage non disponible');
    }
  }

  /**
   * Initialise IndexedDB
   * @private
   */
  async _initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.prefix + 'db', 1);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Créer les object stores
        if (!db.objectStoreNames.contains('dependencies')) {
          db.createObjectStore('dependencies');
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      };
    });
  }

  /**
   * Stocke une valeur
   * @param {string} key - Clé
   * @param {any} value - Valeur
   */
  async set(key, value) {
    const fullKey = this.options.prefix + key;

    if (this.options.storage === 'indexedDB') {
      await this._setIndexedDB(fullKey, value);
    } else {
      this._setLocalStorage(fullKey, value);
    }

    this.emit('set', { key, size: this._getSize(value) });
  }

  /**
   * Stocke dans localStorage
   * @private
   * @param {string} key - Clé
   * @param {any} value - Valeur
   */
  _setLocalStorage(key, value) {
    try {
      const serialized = JSON.stringify({
        value,
        timestamp: Date.now(),
        version: this.options.version
      });
      localStorage.setItem(key, serialized);
    } catch (error) {
      throw new Error(`Erreur écriture localStorage: ${error.message}`);
    }
  }

  /**
   * Stocke dans IndexedDB
   * @private
   * @param {string} key - Clé
   * @param {any} value - Valeur
   */
  async _setIndexedDB(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dependencies'], 'readwrite');
      const store = transaction.objectStore('dependencies');
      
      const request = store.put({
        value,
        timestamp: Date.now(),
        version: this.options.version
      }, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère une valeur
   * @param {string} key - Clé
   * @returns {Promise<any>} Valeur
   */
  async get(key) {
    const fullKey = this.options.prefix + key;

    if (this.options.storage === 'indexedDB') {
      return this._getIndexedDB(fullKey);
    } else {
      return this._getLocalStorage(fullKey);
    }
  }

  /**
   * Récupère depuis localStorage
   * @private
   * @param {string} key - Clé
   * @returns {any} Valeur
   */
  _getLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      
      // Vérifier la version
      if (parsed.version !== this.options.version) {
        this.remove(key);
        return null;
      }

      return parsed.value;

    } catch {
      return null;
    }
  }

  /**
   * Récupère depuis IndexedDB
   * @private
   * @param {string} key - Clé
   * @returns {Promise<any>} Valeur
   */
  async _getIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dependencies'], 'readonly');
      const store = transaction.objectStore('dependencies');
      const request = store.get(key);

      request.onsuccess = () => {
        const data = request.result;
        if (!data) {
          resolve(null);
        } else if (data.version !== this.options.version) {
          this.remove(key);
          resolve(null);
        } else {
          resolve(data.value);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprime une valeur
   * @param {string} key - Clé
   */
  async remove(key) {
    const fullKey = this.options.prefix + key;

    if (this.options.storage === 'indexedDB') {
      await this._removeIndexedDB(fullKey);
    } else {
      this._removeLocalStorage(fullKey);
    }

    this.emit('remove', { key });
  }

  /**
   * Supprime depuis localStorage
   * @private
   * @param {string} key - Clé
   */
  _removeLocalStorage(key) {
    localStorage.removeItem(key);
  }

  /**
   * Supprime depuis IndexedDB
   * @private
   * @param {string} key - Clé
   */
  async _removeIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dependencies'], 'readwrite');
      const store = transaction.objectStore('dependencies');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Vide tout le stockage
   */
  async clear() {
    if (this.options.storage === 'indexedDB') {
      await this._clearIndexedDB();
    } else {
      this._clearLocalStorage();
    }
    this.emit('clear');
  }

  /**
   * Vide localStorage
   * @private
   */
  _clearLocalStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.options.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Vide IndexedDB
   * @private
   */
  async _clearIndexedDB() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dependencies'], 'readwrite');
      const store = transaction.objectStore('dependencies');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère toutes les clés
   * @returns {Array} Liste des clés
   */
  async keys() {
    if (this.options.storage === 'indexedDB') {
      return this._keysIndexedDB();
    } else {
      return this._keysLocalStorage();
    }
  }

  /**
   * Récupère les clés depuis localStorage
   * @private
   * @returns {Array} Clés
   */
  _keysLocalStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.options.prefix)) {
        keys.push(key.substring(this.options.prefix.length));
      }
    }
    return keys;
  }

  /**
   * Récupère les clés depuis IndexedDB
   * @private
   * @returns {Promise<Array>} Clés
   */
  async _keysIndexedDB() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dependencies'], 'readonly');
      const store = transaction.objectStore('dependencies');
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result.map(key => 
          key.substring(this.options.prefix.length)
        );
        resolve(keys);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Vérifie si une clé existe
   * @param {string} key - Clé
   * @returns {Promise<boolean>} true si existe
   */
  async has(key) {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Calcule la taille d'une valeur
   * @private
   * @param {any} value - Valeur
   * @returns {number} Taille en bytes
   */
  _getSize(value) {
    try {
      const str = JSON.stringify(value);
      return new Blob([str]).size;
    } catch {
      return 0;
    }
  }

  /**
   * Récupère l'espace utilisé
   * @returns {Promise<number>} Espace utilisé en bytes
   */
  async getUsedSpace() {
    let total = 0;
    const keys = await this.keys();
    
    for (const key of keys) {
      const value = await this.get(key);
      total += this._getSize(value);
    }

    return total;
  }

  /**
   * Vérifie si le stockage est disponible
   * @returns {boolean} true si disponible
   */
  isAvailable() {
    return this.ready;
  }
}

export default PersistentStorage;
