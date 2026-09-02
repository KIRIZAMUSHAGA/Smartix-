/**
 * DependencyCache
 * Gestion du cache des dépendances pour optimiser les performances
 */

import EventEmitter from 'events';

export class DependencyCache extends EventEmitter {
  /**
   * Crée une instance de DependencyCache
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      ttl: options.ttl || 3600000, // 1 heure par défaut
      maxSize: options.maxSize || 1000, // Nombre max d'entrées
      ...options
    };

    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expirations: 0
    };
  }

  /**
   * Récupère une valeur du cache
   * @param {string} key - Clé
   * @returns {any|null} Valeur ou null
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.emit('miss', { key });
      return null;
    }

    // Vérifier l'expiration
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      this.emit('expired', { key });
      return null;
    }

    // Mettre à jour le dernier accès
    item.lastAccessed = Date.now();
    this.stats.hits++;
    this.emit('hit', { key });

    return item.value;
  }

  /**
   * Stocke une valeur dans le cache
   * @param {string} key - Clé
   * @param {any} value - Valeur
   * @param {Object} options - Options
   * @returns {boolean} true si stocké
   */
  set(key, value, options = {}) {
    // Vérifier la taille
    if (this.cache.size >= this.options.maxSize) {
      this._evictLeastUsed();
    }

    const ttl = options.ttl || this.options.ttl;
    
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      lastAccessed: Date.now(),
      accessCount: 0,
      metadata: options.metadata || {}
    });

    this.stats.sets++;
    this.emit('set', { key, size: this.cache.size });

    return true;
  }

  /**
   * Vérifie si une clé existe et n'est pas expirée
   * @param {string} key - Clé
   * @returns {boolean} true si existe
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }
    
    return true;
  }

  /**
   * Supprime une entrée du cache
   * @param {string} key - Clé
   * @returns {boolean} true si supprimé
   */
  delete(key) {
    const existed = this.cache.delete(key);
    if (existed) {
      this.stats.deletes++;
      this.emit('delete', { key });
    }
    return existed;
  }

  /**
   * Vide le cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expirations: 0
    };
    this.emit('clear', { clearedSize: size });
  }

  /**
   * Récupère toutes les clés
   * @returns {Array} Liste des clés
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Récupère toutes les valeurs
   * @returns {Array} Liste des valeurs
   */
  values() {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  /**
   * Taille du cache
   * @returns {number} Nombre d'entrées
   */
  size() {
    return this.cache.size;
  }

  /**
   * Nettoie les entrées expirées
   * @returns {number} Nombre d'entrées nettoyées
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.expirations += cleaned;
      this.emit('cleanup', { cleaned });
    }

    return cleaned;
  }

  /**
   * Récupère les métadonnées d'une entrée
   * @param {string} key - Clé
   * @returns {Object|null} Métadonnées
   */
  getMetadata(key) {
    const item = this.cache.get(key);
    return item ? item.metadata : null;
  }

  /**
   * Met à jour les métadonnées
   * @param {string} key - Clé
   * @param {Object} metadata - Métadonnées
   */
  updateMetadata(key, metadata) {
    const item = this.cache.get(key);
    if (item) {
      item.metadata = { ...item.metadata, ...metadata };
      this.emit('metadata-updated', { key });
    }
  }

  /**
   * Récupère les statistiques du cache
   * @returns {Object} Statistiques
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      utilization: (this.cache.size / this.options.maxSize) * 100
    };
  }

  /**
   * Évince l'entrée la moins utilisée
   * @private
   */
  _evictLeastUsed() {
    let leastUsedKey = null;
    let leastUsedCount = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.accessCount < leastUsedCount) {
        leastUsedCount = item.accessCount;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.emit('evicted', { key: leastUsedKey, reason: 'least-used' });
    }
  }

  /**
   * Sauvegarde le cache dans le localStorage
   * @param {string} storageKey - Clé de stockage
   */
  persist(storageKey = 'vibe_dependency_cache') {
    try {
      const data = {
        cache: Array.from(this.cache.entries()),
        stats: this.stats,
        timestamp: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
      this.emit('persisted', { storageKey });
    } catch (error) {
      console.warn('Erreur persistance cache:', error);
    }
  }

  /**
   * Restaure le cache depuis le localStorage
   * @param {string} storageKey - Clé de stockage
   */
  restore(storageKey = 'vibe_dependency_cache') {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        this.cache = new Map(data.cache);
        this.stats = data.stats;
        this.emit('restored', { 
          storageKey, 
          size: this.cache.size 
        });
      }
    } catch (error) {
      console.warn('Erreur restauration cache:', error);
    }
  }

  /**
   * Récupère les clés par préfixe
   * @param {string} prefix - Préfixe
   * @returns {Array} Clés correspondantes
   */
  keysWithPrefix(prefix) {
    return Array.from(this.cache.keys()).filter(key => 
      key.startsWith(prefix)
    );
  }

  /**
   * Supprime les entrées par préfixe
   * @param {string} prefix - Préfixe
   * @returns {number} Nombre supprimé
   */
  deleteWithPrefix(prefix) {
    let deleted = 0;
    for (const key of this.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    if (deleted > 0) {
      this.stats.deletes += deleted;
      this.emit('delete-prefix', { prefix, count: deleted });
    }
    return deleted;
  }
}

export default DependencyCache;
