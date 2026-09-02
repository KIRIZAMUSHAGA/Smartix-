/**
 * VersionChecker
 * Vérifie et compare les versions de packages
 */

import semver from 'semver';

export class VersionChecker {
  /**
   * Crée une instance de VersionChecker
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      allowPrerelease: options.allowPrerelease || false,
      includeCaret: options.includeCaret !== false,
      includeTilde: options.includeTilde !== false,
      ...options
    };
  }

  /**
   * Vérifie si une version est obsolète
   * @param {string} current - Version actuelle
   * @param {string} latest - Dernière version
   * @returns {boolean} true si obsolète
   */
  isOutdated(current, latest) {
    if (!current || !latest) return false;

    try {
      const cleanCurrent = this._cleanVersion(current);
      const cleanLatest = this._cleanVersion(latest);

      // Ignorer les versions pré-release si non autorisées
      if (!this.options.allowPrerelease && semver.prerelease(cleanLatest)) {
        return false;
      }

      return semver.lt(cleanCurrent, cleanLatest);

    } catch (error) {
      console.warn('Erreur comparaison versions:', error);
      return false;
    }
  }

  /**
   * Vérifie si une version est satisfaite par une contrainte
   * @param {string} version - Version à vérifier
   * @param {string} range - Contrainte (^1.0.0, ~1.0.0, etc.)
   * @returns {boolean} true si satisfaite
   */
  satisfies(version, range) {
    if (!version || !range) return false;

    try {
      const cleanVersion = this._cleanVersion(version);
      return semver.satisfies(cleanVersion, range);
    } catch {
      return false;
    }
  }

  /**
   * Compare deux versions
   * @param {string} v1 - Première version
   * @param {string} v2 - Deuxième version
   * @returns {number} -1 si v1 < v2, 0 si égal, 1 si v1 > v2
   */
  compare(v1, v2) {
    try {
      const cleanV1 = this._cleanVersion(v1);
      const cleanV2 = this._cleanVersion(v2);
      return semver.compare(cleanV1, cleanV2);
    } catch {
      return 0;
    }
  }

  /**
   * Calcule le type de mise à jour (major, minor, patch)
   * @param {string} current - Version actuelle
   * @param {string} latest - Dernière version
   * @returns {string} Type de mise à jour
   */
  getUpdateType(current, latest) {
    try {
      const cleanCurrent = this._cleanVersion(current);
      const cleanLatest = this._cleanVersion(latest);

      if (semver.major(cleanLatest) > semver.major(cleanCurrent)) {
        return 'major';
      }
      if (semver.minor(cleanLatest) > semver.minor(cleanCurrent)) {
        return 'minor';
      }
      if (semver.patch(cleanLatest) > semver.patch(cleanCurrent)) {
        return 'patch';
      }
      return 'none';

    } catch {
      return 'unknown';
    }
  }

  /**
   * Valide une version
   * @param {string} version - Version à valider
   * @returns {boolean} true si valide
   */
  isValid(version) {
    try {
      const cleanVersion = this._cleanVersion(version);
      return semver.valid(cleanVersion) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Nettoie une version (enlève ^, ~, etc.)
   * @private
   * @param {string} version - Version brute
   * @returns {string} Version nettoyée
   */
  _cleanVersion(version) {
    if (!version) return '0.0.0';
    
    // Enlever les symboles
    let clean = version.replace(/[\^~]/, '');
    
    // Remplacer 'x' par '0' pour les versions partielles
    clean = clean.replace(/x/g, '0');
    
    // Ajouter les parties manquantes
    const parts = clean.split('.');
    while (parts.length < 3) {
      parts.push('0');
    }
    
    return parts.join('.');
  }

  /**
   * Suggère la prochaine version
   * @param {string} current - Version actuelle
   * @param {string} type - Type de mise à jour
   * @returns {string} Version suggérée
   */
  suggestNextVersion(current, type = 'patch') {
    try {
      const cleanCurrent = this._cleanVersion(current);
      
      switch (type) {
        case 'major':
          return semver.inc(cleanCurrent, 'major');
        case 'minor':
          return semver.inc(cleanCurrent, 'minor');
        case 'patch':
          return semver.inc(cleanCurrent, 'patch');
        default:
          return cleanCurrent;
      }
    } catch {
      return current;
    }
  }

  /**
   * Vérifie la compatibilité entre deux versions
   * @param {string} v1 - Première version
   * @param {string} v2 - Deuxième version
   * @returns {Object} Rapport de compatibilité
   */
  checkCompatibility(v1, v2) {
    try {
      const cleanV1 = this._cleanVersion(v1);
      const cleanV2 = this._cleanVersion(v2);

      const major1 = semver.major(cleanV1);
      const major2 = semver.major(cleanV2);

      return {
        compatible: major1 === major2,
        breaking: major1 !== major2,
        type: this.getUpdateType(v1, v2),
        current: cleanV1,
        target: cleanV2
      };

    } catch (error) {
      return {
        compatible: false,
        error: error.message
      };
    }
  }

  /**
   * Trie un tableau de versions
   * @param {Array} versions - Liste des versions
   * @param {boolean} ascending - Ordre croissant
   * @returns {Array} Versions triées
   */
  sortVersions(versions, ascending = true) {
    const validVersions = versions
      .map(v => ({
        original: v,
        clean: this._cleanVersion(v)
      }))
      .filter(v => semver.valid(v.clean))
      .sort((a, b) => {
        const comparison = semver.compare(a.clean, b.clean);
        return ascending ? comparison : -comparison;
      });

    return validVersions.map(v => v.original);
  }

  /**
   * Obtient la version la plus récente
   * @param {Array} versions - Liste des versions
   * @returns {string} Version la plus récente
   */
  getLatestVersion(versions) {
    const sorted = this.sortVersions(versions, false);
    return sorted[0] || null;
  }

  /**
   * Filtre les versions selon des critères
   * @param {Array} versions - Liste des versions
   * @param {Object} criteria - Critères de filtre
   * @returns {Array} Versions filtrées
   */
  filterVersions(versions, criteria = {}) {
    return versions.filter(v => {
      try {
        const clean = this._cleanVersion(v);

        if (criteria.major && semver.major(clean) !== criteria.major) {
          return false;
        }

        if (criteria.minor && semver.minor(clean) !== criteria.minor) {
          return false;
        }

        if (criteria.patch && semver.patch(clean) !== criteria.patch) {
          return false;
        }

        if (criteria.prerelease === false && semver.prerelease(clean)) {
          return false;
        }

        return true;

      } catch {
        return false;
      }
    });
  }

  /**
   * Formate une version pour l'affichage
   * @param {string} version - Version à formater
   * @returns {string} Version formatée
   */
  formatVersion(version) {
    try {
      const clean = this._cleanVersion(version);
      const prerelease = semver.prerelease(clean);
      
      if (prerelease) {
        return `${semver.major(clean)}.${semver.minor(clean)}.${semver.patch(clean)}-${prerelease.join('.')}`;
      }
      
      return clean;

    } catch {
      return version;
    }
  }
}

export default VersionChecker;
