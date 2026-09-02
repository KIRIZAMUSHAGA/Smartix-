/**
 * YarnInstaller
 * Installation via Yarn
 */

import EventEmitter from 'events';

export class YarnInstaller extends EventEmitter {
  /**
   * Crée une instance de YarnInstaller
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      registry: options.registry || 'https://registry.yarnpkg.com',
      timeout: options.timeout || 300000,
      ...options
    };
  }

  /**
   * Installe des dépendances via yarn
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
          status: 'installing'
        });

        const result = await this._installPackage(dep, options);
        
        installed.push({
          name: dep.name,
          version: result.version,
          location: result.location
        });

        this.emit('install:progress', {
          current: i + 1,
          total: dependencies.length,
          name: dep.name,
          status: 'completed'
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
   * Installe un package spécifique avec yarn
   * @private
   * @param {Object} dep - Dépendance
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async _installPackage(dep, options) {
    const packageSpec = dep.version && dep.version !== 'latest' 
      ? `${dep.name}@${dep.version}`
      : dep.name;

    const flags = [];
    if (options.dev) flags.push('--dev');
    if (options.prod) flags.push('--prod');
    if (options.optional) flags.push('--optional');
    if (options.exact) flags.push('--exact');
    if (options.global) flags.push('global');

    // Simuler l'installation yarn
    console.log(`[yarn] Adding ${packageSpec} ${flags.join(' ')}`);
    
    await this._simulateInstall(dep.name);

    return {
      name: dep.name,
      version: dep.version || 'latest',
      location: `node_modules/${dep.name}`,
      installed: true
    };
  }

  /**
   * Désinstalle des packages via yarn
   * @param {Array} names - Noms des packages
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async uninstall(names, options = {}) {
    const uninstalled = [];
    const failed = [];

    for (const name of names) {
      try {
        console.log(`[yarn] Removing ${name}`);
        await this._simulateUninstall(name);
        
        uninstalled.push({
          name,
          removed: true
        });

      } catch (error) {
        failed.push({
          name,
          error: error.message
        });
      }
    }

    return {
      uninstalled,
      failed,
      success: failed.length === 0
    };
  }

  /**
   * Vérifie la version de yarn
   * @returns {Promise<string>} Version
   */
  async getVersion() {
    // Simuler la vérification
    return '3.6.0';
  }

  /**
   * Vérifie si yarn est disponible
   * @returns {Promise<boolean>} true si disponible
   */
  async isAvailable() {
    try {
      const version = await this.getVersion();
      return !!version;
    } catch {
      return false;
    }
  }

  /**
   * Nettoie le cache yarn
   * @returns {Promise<void>}
   */
  async cleanCache() {
    console.log('[yarn] Cleaning cache');
    await this._simulateTask(1000);
  }

  /**
   * Lance yarn upgrade
   * @returns {Promise<void>}
   */
  async upgrade() {
    console.log('[yarn] Upgrading dependencies');
    await this._simulateTask(2000);
  }

  /**
   * Simule une installation
   * @private
   * @param {string} name - Nom du package
   */
  async _simulateInstall(name) {
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 400));
    
    if (Math.random() < 0.03) {
      throw new Error(`Yarn failed to install ${name}`);
    }
  }

  /**
   * Simule une désinstallation
   * @private
   * @param {string} name - Nom du package
   */
  async _simulateUninstall(name) {
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));
  }

  /**
   * Simule une tâche
   * @private
   * @param {number} ms - Durée
   */
  async _simulateTask(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default YarnInstaller;
