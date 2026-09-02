/**
 * UpdateManager
 * Gère les mises à jour des dépendances
 */

import EventEmitter from 'events';
import { VersionChecker } from './VersionChecker';
import { PackageDatabase } from './PackageDatabase';

export class UpdateManager extends EventEmitter {
  /**
   * Crée une instance de UpdateManager
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      checkInterval: options.checkInterval || 3600000, // 1 heure
      autoUpdate: options.autoUpdate || false,
      strategy: options.strategy || 'safe', // 'safe', 'latest', 'range'
      ...options
    };

    this.versionChecker = new VersionChecker(options);
    this.packageDatabase = new PackageDatabase(options);
    this.updates = new Map();
    this.history = [];
    this.checkTimer = null;
  }

  /**
   * Démarre la vérification automatique des mises à jour
   */
  startAutoCheck() {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(() => {
      this.checkAllUpdates().catch(console.error);
    }, this.options.checkInterval);
  }

  /**
   * Arrête la vérification automatique
   */
  stopAutoCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Vérifie les mises à jour pour toutes les dépendances
   * @param {Array} dependencies - Liste des dépendances
   * @returns {Promise<Array>} Mises à jour disponibles
   */
  async checkAllUpdates(dependencies = []) {
    const updates = [];

    for (const dep of dependencies) {
      try {
        const update = await this.checkUpdate(dep.name, dep.version);
        if (update.available) {
          updates.push(update);
          this.updates.set(dep.name, update);
        }
      } catch (error) {
        console.warn(`Erreur vérification ${dep.name}:`, error);
      }
    }

    this.emit('updates:checked', { count: updates.length, updates });
    return updates;
  }

  /**
   * Vérifie les mises à jour pour une dépendance
   * @param {string} name - Nom de la dépendance
   * @param {string} currentVersion - Version actuelle
   * @returns {Promise<Object>} Informations de mise à jour
   */
  async checkUpdate(name, currentVersion) {
    try {
      const info = await this.packageDatabase.getPackageInfo(name);
      const latestVersion = info['dist-tags']?.latest;

      if (!latestVersion) {
        return {
          name,
          current: currentVersion,
          available: false,
          reason: 'No latest version found'
        };
      }

      const isOutdated = this.versionChecker.isOutdated(currentVersion, latestVersion);
      const updateType = this.versionChecker.getUpdateType(currentVersion, latestVersion);

      return {
        name,
        current: currentVersion,
        latest: latestVersion,
        available: isOutdated,
        type: updateType,
        breaking: updateType === 'major',
        recommended: this._getRecommendedVersion(currentVersion, latestVersion, updateType),
        alternatives: await this._getAlternatives(name),
        published: info.time?.[latestVersion],
        description: info.description
      };

    } catch (error) {
      throw new Error(`Erreur vérification ${name}: ${error.message}`);
    }
  }

  /**
   * Effectue une mise à jour
   * @param {string} name - Nom de la dépendance
   * @param {string} targetVersion - Version cible
   * @returns {Promise<Object>} Résultat de la mise à jour
   */
  async update(name, targetVersion = 'latest') {
    this.emit('update:started', { name, target: targetVersion });

    try {
      // Obtenir les informations actuelles
      const current = await this._getCurrentInfo(name);
      
      // Déterminer la version cible
      const version = await this._resolveTargetVersion(name, targetVersion);
      
      // Simuler l'installation (dans la vraie vie, appeler npm/yarn)
      await this._performUpdate(name, version);

      const result = {
        name,
        from: current.version,
        to: version,
        timestamp: Date.now(),
        success: true
      };

      this.history.push(result);
      this.emit('update:completed', result);

      return result;

    } catch (error) {
      const result = {
        name,
        error: error.message,
        timestamp: Date.now(),
        success: false
      };

      this.history.push(result);
      this.emit('update:failed', result);

      throw error;
    }
  }

  /**
   * Résout la version cible
   * @private
   * @param {string} name - Nom de la dépendance
   * @param {string} target - Version cible
   * @returns {Promise<string>} Version résolue
   */
  async _resolveTargetVersion(name, target) {
    if (target === 'latest') {
      const info = await this.packageDatabase.getPackageInfo(name);
      return info['dist-tags']?.latest;
    }

    if (target === 'next') {
      const info = await this.packageDatabase.getPackageInfo(name);
      return info['dist-tags']?.next || info['dist-tags']?.latest;
    }

    return target;
  }

  /**
   * Obtient la version recommandée
   * @private
   * @param {string} current - Version actuelle
   * @param {string} latest - Dernière version
   * @param {string} type - Type de mise à jour
   * @returns {string} Version recommandée
   */
  _getRecommendedVersion(current, latest, type) {
    switch (this.options.strategy) {
      case 'safe':
        // Mise à jour non-breaking uniquement
        if (type === 'major') {
          return current;
        }
        return latest;

      case 'latest':
        // Toujours la dernière version
        return latest;

      case 'range':
        // Mise à jour dans la même plage majeure
        if (type === 'major') {
          return this.versionChecker.suggestNextVersion(current, 'minor');
        }
        return latest;

      default:
        return latest;
    }
  }

  /**
   * Obtient des alternatives à la mise à jour
   * @private
   * @param {string} name - Nom de la dépendance
   * @returns {Promise<Array>} Alternatives
   */
  async _getAlternatives(name) {
    // TODO: Implémenter la recherche d'alternatives
    return [];
  }

  /**
   * Obtient les informations actuelles
   * @private
   * @param {string} name - Nom de la dépendance
   * @returns {Promise<Object>} Informations
   */
  async _getCurrentInfo(name) {
    // TODO: Récupérer depuis l'installation
    return {
      version: '1.0.0',
      installed: true
    };
  }

  /**
   * Effectue la mise à jour
   * @private
   * @param {string} name - Nom de la dépendance
   * @param {string} version - Version cible
   */
  async _performUpdate(name, version) {
    // Simuler l'installation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // TODO: Appeler le vrai gestionnaire de paquets
    // npm install ${name}@${version}
    // yarn add ${name}@${version}
  }

  /**
   * Met à jour toutes les dépendances
   * @param {Array} dependencies - Liste des dépendances
   * @returns {Promise<Array>} Résultats des mises à jour
   */
  async updateAll(dependencies) {
    const results = [];

    for (const dep of dependencies) {
      try {
        const result = await this.update(dep.name);
        results.push(result);
      } catch (error) {
        results.push({
          name: dep.name,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Annule une mise à jour
   * @param {string} name - Nom de la dépendance
   * @param {string} previousVersion - Version précédente
   * @returns {Promise<Object>} Résultat
   */
  async rollback(name, previousVersion) {
    this.emit('rollback:started', { name, target: previousVersion });

    try {
      await this._performUpdate(name, previousVersion);

      const result = {
        name,
        to: previousVersion,
        timestamp: Date.now(),
        success: true,
        rolledBack: true
      };

      this.history.push(result);
      this.emit('rollback:completed', result);

      return result;

    } catch (error) {
      const result = {
        name,
        error: error.message,
        success: false
      };

      this.history.push(result);
      this.emit('rollback:failed', result);

      throw error;
    }
  }

  /**
   * Récupère l'historique des mises à jour
   * @param {number} limit - Nombre d'entrées
   * @returns {Array} Historique
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    const successful = this.history.filter(h => h.success).length;
    const failed = this.history.filter(h => !h.success).length;

    return {
      total: this.history.length,
      successful,
      failed,
      successRate: this.history.length ? (successful / this.history.length) * 100 : 0,
      pendingUpdates: this.updates.size
    };
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.stopAutoCheck();
    this.updates.clear();
    this.history = [];
    this.removeAllListeners();
  }
}

export default UpdateManager;
