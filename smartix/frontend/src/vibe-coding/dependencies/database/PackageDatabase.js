/**
 * PackageDatabase
 * Interface avec le registre npm pour récupérer les informations des packages
 */

import EventEmitter from 'events';

export class PackageDatabase extends EventEmitter {
  /**
   * Crée une instance de PackageDatabase
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      registryUrl: options.registryUrl || 'https://registry.npmjs.org',
      searchUrl: options.searchUrl || 'https://api.npms.io/v2/search',
      timeout: options.timeout || 10000,
      retries: options.retries || 2,
      ...options
    };

    this.registryCache = new Map();
    this.searchCache = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Récupère les informations d'un package
   * @param {string} name - Nom du package
   * @returns {Promise<Object>} Informations du package
   */
  async getPackageInfo(name) {
    // Vérifier le cache
    const cached = this.registryCache.get(name);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 heure
      this.emit('cache:hit', { name, source: 'registry' });
      return cached.data;
    }

    // Vérifier si déjà en cours
    if (this.pendingRequests.has(name)) {
      return this.pendingRequests.get(name);
    }

    const promise = this._fetchPackageInfo(name);
    this.pendingRequests.set(name, promise);

    try {
      const data = await promise;
      this.registryCache.set(name, {
        data,
        timestamp: Date.now()
      });
      this.emit('cache:miss', { name, source: 'registry' });
      return data;
    } finally {
      this.pendingRequests.delete(name);
    }
  }

  /**
   * Récupère les informations depuis le registre
   * @private
   * @param {string} name - Nom du package
   * @returns {Promise<Object>} Informations du package
   */
  async _fetchPackageInfo(name) {
    let attempts = 0;
    const url = `${this.options.registryUrl}/${encodeURIComponent(name)}`;

    while (attempts <= this.options.retries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        return {
          name: data.name,
          version: data['dist-tags']?.latest,
          description: data.description,
          'dist-tags': data['dist-tags'],
          versions: Object.keys(data.versions || {}),
          time: data.time,
          homepage: data.homepage,
          repository: data.repository,
          license: data.license,
          keywords: data.keywords,
          author: data.author,
          maintainers: data.maintainers
        };

      } catch (error) {
        attempts++;
        
        if (attempts > this.options.retries) {
          throw new Error(`Échec récupération ${name}: ${error.message}`);
        }
        
        // Attendre avant de réessayer
        await new Promise(resolve => 
          setTimeout(resolve, 1000 * Math.pow(2, attempts))
        );
      }
    }
  }

  /**
   * Recherche des packages
   * @param {string} query - Terme de recherche
   * @param {Object} options - Options de recherche
   * @returns {Promise<Array>} Résultats de la recherche
   */
  async search(query, options = {}) {
    const cacheKey = `${query}:${JSON.stringify(options)}`;
    
    // Vérifier le cache
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 1800000) { // 30 minutes
      this.emit('cache:hit', { query, source: 'search' });
      return cached.data;
    }

    try {
      const params = new URLSearchParams({
        q: query,
        size: options.size || 20,
        from: options.from || 0,
        ...options
      });

      const url = `${this.options.searchUrl}?${params}`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      const results = (data.results || []).map(result => ({
        name: result.package.name,
        version: result.package.version,
        description: result.package.description,
        keywords: result.package.keywords,
        date: result.package.date,
        links: result.package.links,
        publisher: result.package.publisher,
        score: result.score,
        searchScore: result.searchScore
      }));

      this.searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      this.emit('search:completed', { query, count: results.length });

      return results;

    } catch (error) {
      this.emit('search:failed', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Récupère les versions d'un package
   * @param {string} name - Nom du package
   * @returns {Promise<Array>} Liste des versions
   */
  async getVersions(name) {
    const info = await this.getPackageInfo(name);
    return info.versions || [];
  }

  /**
   * Récupère la dernière version d'un package
   * @param {string} name - Nom du package
   * @returns {Promise<string>} Dernière version
   */
  async getLatestVersion(name) {
    const info = await this.getPackageInfo(name);
    return info['dist-tags']?.latest || info.version;
  }

  /**
   * Récupère les statistiques d'un package
   * @param {string} name - Nom du package
   * @returns {Promise<Object>} Statistiques
   */
  async getPackageStats(name) {
    try {
      const url = `https://api.npmjs.org/downloads/point/last-month/${name}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        downloads: data.downloads,
        start: data.start,
        end: data.end
      };

    } catch (error) {
      console.warn(`Erreur récupération stats ${name}:`, error);
      return null;
    }
  }

  /**
   * Vérifie si un package existe
   * @param {string} name - Nom du package
   * @returns {Promise<boolean>} true si existe
   */
  async exists(name) {
    try {
      await this.getPackageInfo(name);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère des suggestions de packages
   * @param {string} partial - Début du nom
   * @returns {Promise<Array>} Suggestions
   */
  async getSuggestions(partial) {
    if (!partial || partial.length < 2) return [];

    try {
      const url = `https://api.npms.io/v2/search/suggestions?q=${encodeURIComponent(partial)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return data.map(item => ({
        name: item.package.name,
        version: item.package.version,
        description: item.package.description,
        score: item.score?.final || 0
      }));

    } catch (error) {
      console.warn('Erreur suggestions:', error);
      return [];
    }
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.registryCache.clear();
    this.searchCache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Récupère la taille du cache
   * @returns {Object} Taille du cache
   */
  getCacheSize() {
    return {
      registry: this.registryCache.size,
      search: this.searchCache.size,
      pending: this.pendingRequests.size
    };
  }

  /**
   * Nettoie le cache expiré
   */
  cleanupCache() {
    const now = Date.now();
    
    // Nettoyer le cache registre (1 heure)
    for (const [key, value] of this.registryCache) {
      if (now - value.timestamp > 3600000) {
        this.registryCache.delete(key);
      }
    }

    // Nettoyer le cache recherche (30 minutes)
    for (const [key, value] of this.searchCache) {
      if (now - value.timestamp > 1800000) {
        this.searchCache.delete(key);
      }
    }
  }
}

export default PackageDatabase;
