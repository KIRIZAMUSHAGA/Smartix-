/**
 * CDNInstaller
 * Installation via CDN pour les projets frontend
 */

import EventEmitter from 'events';

export class CDNInstaller extends EventEmitter {
  /**
   * Crée une instance de CDNInstaller
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      prefer: options.prefer || ['unpkg', 'jsdelivr', 'skypack'],
      timeout: options.timeout || 10000,
      ...options
    };

    this.cdnProviders = {
      unpkg: {
        name: 'unpkg',
        url: (name, version) => `https://unpkg.com/${name}@${version}`,
        priority: 1
      },
      jsdelivr: {
        name: 'jsdelivr',
        url: (name, version) => `https://cdn.jsdelivr.net/npm/${name}@${version}`,
        priority: 2
      },
      skypack: {
        name: 'skypack',
        url: (name, version) => `https://cdn.skypack.dev/${name}@${version}`,
        priority: 3
      },
      esm: {
        name: 'esm.sh',
        url: (name, version) => `https://esm.sh/${name}@${version}`,
        priority: 4
      }
    };
  }

  /**
   * Installe des dépendances via CDN
   * @param {Array} dependencies - Dépendances à installer
   * @param {Object} options - Options d'installation
   * @returns {Promise<Object>} Résultat
   */
  async install(dependencies, options = {}) {
    const installed = [];
    const failed = [];

    this.emit('install:started', { count: dependencies.length });

    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      
      try {
        this.emit('install:progress', {
          current: i + 1,
          total: dependencies.length,
          name: dep.name,
          status: 'loading'
        });

        const result = await this._loadFromCDN(dep, options);
        
        installed.push({
          name: dep.name,
          version: result.version,
          url: result.url,
          provider: result.provider
        });

        this.emit('install:progress', {
          current: i + 1,
          total: dependencies.length,
          name: dep.name,
          status: 'loaded'
        });

      } catch (error) {
        failed.push({
          name: dep.name,
          error: error.message
        });

        this.emit('install:progress', {
          current: i + 1,
          total: dependencies.length,
          name: dep.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      installed,
      failed,
      success: failed.length === 0
    };
  }

  /**
   * Charge une dépendance depuis un CDN
   * @private
   * @param {Object} dep - Dépendance
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async _loadFromCDN(dep, options) {
    const version = dep.version || 'latest';
    const providers = this._getProvidersOrder();

    let lastError = null;

    for (const provider of providers) {
      try {
        const url = provider.url(dep.name, version);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
          // Charger le script dans la page
          await this._injectScript(url, dep.name);

          return {
            name: dep.name,
            version,
            url,
            provider: provider.name,
            success: true
          };
        }

        lastError = new Error(`HTTP ${response.status}`);

      } catch (error) {
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error(`Aucun CDN disponible pour ${dep.name}`);
  }

  /**
   * Obtient l'ordre des providers selon les préférences
   * @private
   * @returns {Array} Providers ordonnés
   */
  _getProvidersOrder() {
    const providers = [];
    
    // Ajouter selon les préférences
    this.options.prefer.forEach(name => {
      if (this.cdnProviders[name]) {
        providers.push(this.cdnProviders[name]);
      }
    });

    // Ajouter les autres par priorité
    Object.values(this.cdnProviders)
      .filter(p => !this.options.prefer.includes(p.name))
      .sort((a, b) => a.priority - b.priority)
      .forEach(p => providers.push(p));

    return providers;
  }

  /**
   * Injecte un script dans la page
   * @private
   * @param {string} url - URL du script
   * @param {string} name - Nom du package
   * @returns {Promise<void>}
   */
  async _injectScript(url, name) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.setAttribute('data-package', name);
      script.setAttribute('data-cdn', 'true');
      
      script.onload = () => {
        console.log(`✅ Chargé depuis CDN: ${name}`);
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error(`Échec chargement ${name} depuis ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Vérifie si un package est disponible sur CDN
   * @param {string} name - Nom du package
   * @param {string} version - Version
   * @returns {Promise<boolean>} true si disponible
   */
  async isAvailable(name, version = 'latest') {
    try {
      await this._loadFromCDN({ name, version }, { checkOnly: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère l'URL CDN d'un package
   * @param {string} name - Nom du package
   * @param {string} version - Version
   * @returns {string} URL
   */
  getCDNUrl(name, version = 'latest') {
    // Préférer unpkg par défaut
    return `https://unpkg.com/${name}@${version}`;
  }

  /**
   * Génère une balise script pour inclusion HTML
   * @param {string} name - Nom du package
   * @param {string} version - Version
   * @returns {string} Balise script
   */
  generateScriptTag(name, version = 'latest') {
    const url = this.getCDNUrl(name, version);
    return `<script src="${url}"></script>`;
  }

  /**
   * Liste les providers CDN disponibles
   * @returns {Array} Liste des providers
   */
  listProviders() {
    return Object.values(this.cdnProviders).map(p => ({
      name: p.name,
      priority: p.priority,
      example: p.url('react', '18.2.0')
    }));
  }
}

export default CDNInstaller;
