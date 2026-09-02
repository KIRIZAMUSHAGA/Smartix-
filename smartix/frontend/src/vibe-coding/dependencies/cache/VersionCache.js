/**
 * VersionCache
 * Cache spécialisé pour les versions des packages
 */

import { DependencyCache } from './DependencyCache';

export class VersionCache extends DependencyCache {
  /**
   * Crée une instance de VersionCache
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super({
      ttl: options.ttl || 86400000, // 24h pour les versions
      maxSize: options.maxSize || 500,
      ...options
    });

    this.versionConstraints = new Map();
  }

  /**
   * Stocke une version
   * @param {string} packageName - Nom du package
   * @param {string} version - Version
   * @param {Object} metadata - Métadonnées supplémentaires
   */
  setVersion(packageName, version, metadata = {}) {
    const key = `version:${packageName}`;
    
    this.set(key, {
      version,
      ...metadata,
      cachedAt: Date.now()
    }, {
      metadata: {
        packageName,
        version,
        ...metadata
      }
    });

    // Stocker aussi par version spécifique
    const versionKey = `version:${packageName}:${version}`;
    this.set(versionKey, metadata, { ttl: 30 * 86400000 }); // 30 jours
  }

  /**
   * Récupère la dernière version connue
   * @param {string} packageName - Nom du package
   * @returns {Object|null} Informations de version
   */
  getLatestVersion(packageName) {
    const key = `version:${packageName}`;
    return this.get(key);
  }

  /**
   * Récupère une version spécifique
   * @param {string} packageName - Nom du package
   * @param {string} version - Version
   * @returns {Object|null} Informations de version
   */
  getVersion(packageName, version) {
    const key = `version:${packageName}:${version}`;
    return this.get(key);
  }

  /**
   * Stocke une contrainte de version (^1.0.0, ~1.0.0, etc.)
   * @param {string} packageName - Nom du package
   * @param {string} constraint - Contrainte
   */
  setConstraint(packageName, constraint) {
    this.versionConstraints.set(packageName, {
      constraint,
      updatedAt: Date.now()
    });
  }

  /**
   * Récupère la contrainte de version
   * @param {string} packageName - Nom du package
   * @returns {string|null} Contrainte
   */
  getConstraint(packageName) {
    return this.versionConstraints.get(packageName)?.constraint || null;
  }

  /**
   * Vérifie si une version est dans le cache
   * @param {string} packageName - Nom du package
   * @param {string} version - Version
   * @returns {boolean} true si en cache
   */
  hasVersion(packageName, version) {
    const key = `version:${packageName}:${version}`;
    return this.has(key);
  }

  /**
   * Récupère toutes les versions en cache pour un package
   * @param {string} packageName - Nom du package
   * @returns {Array} Versions en cache
   */
  getAllVersions(packageName) {
    const prefix = `version:${packageName}:`;
    const keys = this.keysWithPrefix(prefix);
    
    return keys
      .map(key => {
        const version = key.split(':')[2];
        const data = this.get(key);
        return { version, ...data };
      })
      .filter(v => v.version);
  }

  /**
   * Nettoie les anciennes versions d'un package
   * @param {string} packageName - Nom du package
   * @param {number} keepCount - Nombre de versions à garder
   */
  cleanupOldVersions(packageName, keepCount = 5) {
    const versions = this.getAllVersions(packageName)
      .sort((a, b) => {
        // Trier par date décroissante
        return (b.cachedAt || 0) - (a.cachedAt || 0);
      });

    if (versions.length > keepCount) {
      const toDelete = versions.slice(keepCount);
      toDelete.forEach(v => {
        const key = `version:${packageName}:${v.version}`;
        this.delete(key);
      });

      this.emit('cleanup-versions', {
        packageName,
        deleted: toDelete.length,
        kept: keepCount
      });
    }
  }

  /**
   * Vérifie si une version est obsolète
   * @param {string} packageName - Nom du package
   * @param {string} version - Version à vérifier
   * @returns {boolean} true si obsolète
   */
  isOutdated(packageName, version) {
    const latest = this.getLatestVersion(packageName);
    if (!latest) return false;

    // Comparaison simple des versions
    const vParts = version.split('.').map(Number);
    const lParts = latest.version.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if ((vParts[i] || 0) < (lParts[i] || 0)) return true;
      if ((vParts[i] || 0) > (lParts[i] || 0)) return false;
    }

    return false;
  }

  /**
   * Récupère les statistiques du cache de versions
   * @returns {Object} Statistiques
   */
  getVersionStats() {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      packagesWithVersions: this.keysWithPrefix('version:')
        .filter(k => !k.includes(':'))
        .length,
      totalVersions: this.keysWithPrefix('version:').length,
      constraintsCount: this.versionConstraints.size
    };
  }

  /**
   * Préchauffe le cache avec des versions courantes
   */
  prewarm() {
    const commonPackages = [
      'react', 'react-dom', 'vue', 'angular', 
      'lodash', 'axios', 'express', 'typescript'
    ];

    commonPackages.forEach(pkg => {
      // Simuler quelques versions
      ['18.2.0', '18.1.0', '18.0.0'].forEach(version => {
        this.setVersion(pkg, version, {
          published: Date.now() - Math.random() * 30 * 86400000
        });
      });
    });

    this.emit('prewarmed', { count: commonPackages.length * 3 });
  }

  /**
   * Exporte le cache de versions
   * @returns {Object} Données exportées
   */
  exportVersions() {
    const data = {
      versions: {},
      constraints: {},
      exportedAt: Date.now()
    };

    // Exporter les versions
    for (const key of this.keys()) {
      if (key.startsWith('version:')) {
        const parts = key.split(':');
        if (parts.length === 2) {
          const pkg = parts[1];
          data.versions[pkg] = this.get(key);
        } else if (parts.length === 3) {
          const [_, pkg, version] = parts;
          if (!data.versions[pkg]) data.versions[pkg] = {};
          data.versions[pkg][version] = this.get(key);
        }
      }
    }

    // Exporter les contraintes
    this.versionConstraints.forEach((value, key) => {
      data.constraints[key] = value;
    });

    return data;
  }

  /**
   * Importe des versions
   * @param {Object} data - Données à importer
   */
  importVersions(data) {
    if (data.versions) {
      Object.entries(data.versions).forEach(([pkg, versions]) => {
        if (typeof versions === 'object' && versions.version) {
          // Version simple
          this.setVersion(pkg, versions.version, versions);
        } else {
          // Multiple versions
          Object.entries(versions).forEach(([version, info]) => {
            this.setVersion(pkg, version, info);
          });
        }
      });
    }

    if (data.constraints) {
      Object.entries(data.constraints).forEach(([pkg, constraint]) => {
        this.versionConstraints.set(pkg, constraint);
      });
    }

    this.emit('imported', {
      versions: Object.keys(data.versions || {}).length,
      constraints: Object.keys(data.constraints || {}).length
    });
  }
}

export default VersionCache;
