/**
 * CDNLoader
 * Charge les dépendances depuis les CDN (unpkg, jsdelivr, etc.)
 */

export class CDNLoader {
  /**
   * Crée une instance de CDNLoader
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      cacheTTL: options.cacheTTL || 3600000,
      timeout: options.timeout || 10000,
      retries: options.retries || 2,
      prefer: options.prefer || ['unpkg', 'jsdelivr', 'skypack'],
      ...options
    };

    this.cache = new Map();
    this.providers = this._initializeProviders();
  }

  /**
   * Initialise les providers CDN
   * @private
   * @returns {Object} Providers
   */
  _initializeProviders() {
    return {
      unpkg: {
        name: 'unpkg',
        url: (name, version, path) => 
          `https://unpkg.com/${name}@${version}/${path || this._getMainPath(name)}`,
        priority: 1
      },
      jsdelivr: {
        name: 'jsdelivr',
        url: (name, version, path) => 
          `https://cdn.jsdelivr.net/npm/${name}@${version}/${path || this._getMainPath(name)}`,
        priority: 2
      },
      skypack: {
        name: 'skypack',
        url: (name, version) => 
          `https://cdn.skypack.dev/${name}@${version}`,
        priority: 3
      },
      esm: {
        name: 'esm.sh',
        url: (name, version) => 
          `https://esm.sh/${name}@${version}`,
        priority: 4
      }
    };
  }

  /**
   * Initialise le loader
   */
  async initialize() {
    // Pré-charger les providers courants
    await Promise.all([
      this._testProvider('unpkg'),
      this._testProvider('jsdelivr'),
      this._testProvider('skypack')
    ]);
  }

  /**
   * Teste un provider
   * @private
   * @param {string} provider - Nom du provider
   */
  async _testProvider(provider) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.providers[provider].url('react', '18.2.0', 'package.json'), {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeout);

      this.providers[provider].available = response.ok;
    } catch {
      this.providers[provider].available = false;
    }
  }

  /**
   * Charge une dépendance depuis le CDN
   * @param {string} name - Nom du package
   * @param {string} version - Version
   * @returns {Promise<Object>} Résultat du chargement
   */
  async load(name, version = 'latest') {
    // Vérifier le cache
    const cacheKey = `${name}@${version}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.options.cacheTTL) {
      return {
        ...cached,
        cached: true
      };
    }

    // Résoudre la version si nécessaire
    const resolvedVersion = await this._resolveVersion(name, version);

    // Trier les providers par priorité et disponibilité
    const availableProviders = Object.values(this.providers)
      .filter(p => p.available !== false)
      .sort((a, b) => a.priority - b.priority);

    let lastError = null;

    // Essayer chaque provider
    for (const provider of availableProviders) {
      try {
        const result = await this._loadFromProvider(name, resolvedVersion, provider);
        
        // Mettre en cache
        this.cache.set(cacheKey, {
          ...result,
          timestamp: Date.now()
        });

        return result;

      } catch (error) {
        lastError = error;
        continue;
      }
    }

    throw new Error(`Impossible de charger ${name}@${version}: ${lastError?.message || 'Aucun provider disponible'}`);
  }

  /**
   * Charge depuis un provider spécifique
   * @private
   * @param {string} name - Nom du package
   * @param {string} version - Version
   * @param {Object} provider - Provider
   * @returns {Promise<Object>} Résultat
   */
  async _loadFromProvider(name, version, provider) {
    const url = provider.url(name, version);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/javascript, application/json'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.text();
      const contentType = response.headers.get('content-type') || '';

      return {
        success: true,
        name,
        version,
        provider: provider.name,
        url,
        content,
        size: content.length,
        type: contentType.includes('json') ? 'json' : 'javascript',
        headers: {
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified')
        }
      };

    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Résout une version de package
   * @private
   * @param {string} name - Nom du package
   * @param {string} version - Version demandée
   * @returns {Promise<string>} Version résolue
   */
  async _resolveVersion(name, version) {
    if (version !== 'latest' && version !== 'next') {
      return version;
    }

    try {
      // Utiliser jsdelivr pour obtenir les infos du package
      const url = `https://data.jsdelivr.com/v1/package/npm/${name}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return version === 'latest' ? data.version : data.tags?.[version] || data.version;
      }
    } catch (error) {
      console.warn('Erreur résolution version:', error);
    }

    return version;
  }

  /**
   * Obtient le chemin principal d'un package
   * @private
   * @param {string} name - Nom du package
   * @returns {string} Chemin principal
   */
  _getMainPath(name) {
    const mains = {
      'react': 'umd/react.development.js',
      'react-dom': 'umd/react-dom.development.js',
      'vue': 'dist/vue.global.js',
      'vue-router': 'dist/vue-router.global.js',
      'pinia': 'dist/pinia.iife.js',
      'axios': 'dist/axios.js',
      'lodash': 'lodash.js',
      'moment': 'moment.js',
      'jquery': 'dist/jquery.js'
    };

    return mains[name] || 'index.js';
  }

  /**
   * Charge plusieurs dépendances en parallèle
   * @param {Array} dependencies - Liste des dépendances
   * @returns {Promise<Array>} Résultats
   */
  async loadMultiple(dependencies) {
    const results = await Promise.allSettled(
      dependencies.map(dep => 
        this.load(dep.name, dep.version)
      )
    );

    return results.map((result, index) => ({
      name: dependencies[index].name,
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * Vérifie si un package est disponible
   * @param {string} name - Nom du package
   * @returns {Promise<boolean>} true si disponible
   */
  async isAvailable(name) {
    try {
      const url = `https://data.jsdelivr.com/v1/package/npm/${name}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Obtient les versions disponibles d'un package
   * @param {string} name - Nom du package
   * @returns {Promise<Array>} Liste des versions
   */
  async getVersions(name) {
    try {
      const url = `https://data.jsdelivr.com/v1/package/npm/${name}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return {
          latest: data.version,
          tags: data.tags || {},
          versions: data.versions || []
        };
      }
    } catch (error) {
      console.warn('Erreur récupération versions:', error);
    }

    return {
      latest: 'latest',
      tags: {},
      versions: []
    };
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Récupère la taille du cache
   * @returns {number} Nombre d'entrées en cache
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    const providers = {};
    
    Object.values(this.providers).forEach(p => {
      providers[p.name] = {
        available: p.available || false,
        priority: p.priority
      };
    });

    return {
      cacheSize: this.cache.size,
      providers
    };
  }
}

export default CDNLoader;
