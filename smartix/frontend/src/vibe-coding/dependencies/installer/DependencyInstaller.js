/**
 * DependencyInstaller
 * Gère l'installation des dépendances via différents gestionnaires de paquets
 */

import EventEmitter from 'events';
import { NPMInstaller } from './NPMInstaller';
import { YarnInstaller } from './YarnInstaller';
import { PNPMInstaller } from './PNPMInstaller';
import { CDNInstaller } from './CDNInstaller';

export class DependencyInstaller extends EventEmitter {
  /**
   * Crée une instance de DependencyInstaller
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      method: options.method || 'npm',
      timeout: options.timeout || 300000,
      concurrency: options.concurrency || 3,
      ...options
    };

    // Initialiser les installateurs
    this.installers = {
      npm: new NPMInstaller(options),
      yarn: new YarnInstaller(options),
      pnpm: new PNPMInstaller(options),
      cdn: new CDNInstaller(options)
    };

    this.installed = new Map();
    this.pending = new Map();
    this.queue = [];
    this.processing = false;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      cached: 0
    };
  }

  /**
   * Installe des dépendances
   * @param {Array} dependencies - Liste des dépendances
   * @param {Object} options - Options d'installation
   * @returns {Promise<Object>} Résultat de l'installation
   */
  async install(dependencies, options = {}) {
    const startTime = Date.now();
    const method = options.method || this.options.method;
    const installer = this.installers[method];

    if (!installer) {
      throw new Error(`Méthode d'installation non supportée: ${method}`);
    }

    this.stats.total += dependencies.length;
    
    this.emit('install:started', {
      count: dependencies.length,
      method,
      dependencies: dependencies.map(d => d.name)
    });

    try {
      // Filtrer les dépendances déjà installées
      const toInstall = dependencies.filter(dep => 
        !this.installed.has(dep.name) || options.force
      );

      if (toInstall.length === 0) {
        return {
          success: true,
          installed: [],
          cached: dependencies.length,
          failed: [],
          stats: this.stats
        };
      }

      // Installer avec le gestionnaire choisi
      const result = await installer.install(toInstall, {
        ...options,
        onProgress: (progress) => {
          this.emit('install:progress', progress);
        }
      });

      // Enregistrer les installations réussies
      result.installed.forEach(dep => {
        this.installed.set(dep.name, {
          ...dep,
          installedAt: Date.now(),
          method
        });
        this.stats.success++;
      });

      // Enregistrer les échecs
      result.failed.forEach(dep => {
        this.stats.failed++;
      });

      this.emit('install:completed', {
        ...result,
        duration: Date.now() - startTime,
        stats: this.stats
      });

      return result;

    } catch (error) {
      this.emit('install:failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Installe une seule dépendance
   * @param {Object} dependency - Dépendance à installer
   * @param {Object} options - Options d'installation
   * @returns {Promise<Object>} Résultat
   */
  async installOne(dependency, options = {}) {
    const result = await this.install([dependency], options);
    return {
      ...result,
      dependency: result.installed[0] || result.failed[0]
    };
  }

  /**
   * Installe en mode développement
   * @param {Array} dependencies - Dépendances
   * @returns {Promise<Object>} Résultat
   */
  async installDev(dependencies) {
    return this.install(dependencies, { dev: true });
  }

  /**
   * Installe en mode production
   * @param {Array} dependencies - Dépendances
   * @returns {Promise<Object>} Résultat
   */
  async installProd(dependencies) {
    return this.install(dependencies, { prod: true });
  }

  /**
   * Désinstalle des dépendances
   * @param {Array} names - Noms des dépendances
   * @param {Object} options - Options
   * @returns {Promise<Object>} Résultat
   */
  async uninstall(names, options = {}) {
    const method = options.method || this.options.method;
    const installer = this.installers[method];

    if (!installer) {
      throw new Error(`Méthode non supportée: ${method}`);
    }

    this.emit('uninstall:started', { names });

    try {
      const result = await installer.uninstall(names, options);

      // Supprimer du registre
      names.forEach(name => {
        this.installed.delete(name);
      });

      this.emit('uninstall:completed', result);
      return result;

    } catch (error) {
      this.emit('uninstall:failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Met à jour des dépendances
   * @param {Array} updates - Liste des mises à jour
   * @returns {Promise<Array>} Résultats
   */
  async update(updates) {
    const results = [];

    for (const update of updates) {
      try {
        const result = await this.installOne({
          name: update.name,
          version: update.target
        }, { force: true });

        results.push({
          name: update.name,
          from: update.current,
          to: update.target,
          success: result.success
        });

      } catch (error) {
        results.push({
          name: update.name,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Vérifie si une dépendance est installée
   * @param {string} name - Nom de la dépendance
   * @returns {boolean} true si installée
   */
  isInstalled(name) {
    return this.installed.has(name);
  }

  /**
   * Récupère une dépendance installée
   * @param {string} name - Nom de la dépendance
   * @returns {Object|null} Dépendance
   */
  getInstalled(name) {
    return this.installed.get(name) || null;
  }

  /**
   * Récupère toutes les dépendances installées
   * @returns {Array} Liste des dépendances
   */
  getInstalled() {
    return Array.from(this.installed.values());
  }

  /**
   * Enregistre manuellement une dépendance comme installée
   * @param {Object} dep - Dépendance
   */
  recordInstalled(dep) {
    this.installed.set(dep.name, {
      ...dep,
      recorded: true,
      installedAt: Date.now()
    });
  }

  /**
   * Réessaie les installations échouées
   * @returns {Promise<Array>} Résultats
   */
  async retryFailed() {
    // TODO: Implémenter la récupération des échecs
    return [];
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      installedCount: this.installed.size,
      pendingCount: this.pending.size,
      queueLength: this.queue.length
    };
  }

  /**
   * Nettoie le registre
   */
  clear() {
    this.installed.clear();
    this.pending.clear();
    this.queue = [];
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      cached: 0
    };
  }

  /**
   * Change la méthode d'installation par défaut
   * @param {string} method - Nouvelle méthode
   */
  setMethod(method) {
    if (!this.installers[method]) {
      throw new Error(`Méthode non supportée: ${method}`);
    }
    this.options.method = method;
  }
}

export default DependencyInstaller;
