/**
 * ConflictDetector
 * Détecte les conflits entre dépendances
 */

import EventEmitter from 'events';
import semver from 'semver';

export class ConflictDetector extends EventEmitter {
  /**
   * Crée une instance de ConflictDetector
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      strictMode: options.strictMode || false,
      checkPeerDeps: options.checkPeerDeps !== false,
      ...options
    };
  }

  /**
   * Détecte les conflits dans une liste de dépendances
   * @param {Array} dependencies - Liste des dépendances
   * @param {Object} options - Options de détection
   * @returns {Promise<Array>} Conflits détectés
   */
  async detect(dependencies, options = {}) {
    const startTime = Date.now();
    const conflicts = [];

    // Détecter les versions multiples
    conflicts.push(...this._detectMultipleVersions(dependencies));

    // Détecter les incompatibilités de versions
    conflicts.push(...this._detectVersionIncompatibilities(dependencies));

    // Détecter les conflits de peer dependencies
    if (this.options.checkPeerDeps) {
      conflicts.push(...this._detectPeerConflicts(dependencies));
    }

    // Détecter les packages dépréciés
    conflicts.push(...this._detectDeprecated(dependencies));

    // Vérifier les conflits connus
    if (options.knownConflicts) {
      conflicts.push(...this._checkKnownConflicts(dependencies, options.knownConflicts));
    }

    const result = conflicts.map(conflict => ({
      ...conflict,
      id: `conflict-${Date.now()}-${Math.random().toString(36)}`,
      detected: Date.now()
    }));

    this.emit('detection:completed', {
      conflicts: result,
      count: result.length,
      duration: Date.now() - startTime
    });

    return result;
  }

  /**
   * Détecte les versions multiples d'un même package
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Array} Conflits
   */
  _detectMultipleVersions(dependencies) {
    const conflicts = [];
    const versionMap = new Map();

    // Grouper par nom
    dependencies.forEach(dep => {
      if (!versionMap.has(dep.name)) {
        versionMap.set(dep.name, []);
      }
      versionMap.get(dep.name).push(dep);
    });

    // Vérifier les versions multiples
    versionMap.forEach((versions, name) => {
      if (versions.length > 1) {
        const uniqueVersions = [...new Set(versions.map(v => v.version))];
        
        if (uniqueVersions.length > 1) {
          conflicts.push({
            type: 'multiple-versions',
            name,
            severity: 'warning',
            message: `Version multiple de ${name}: ${uniqueVersions.join(', ')}`,
            versions: uniqueVersions,
            locations: versions.map(v => v.source || 'unknown')
          });
        }
      }
    });

    return conflicts;
  }

  /**
   * Détecte les incompatibilités de versions
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Array} Conflits
   */
  _detectVersionIncompatibilities(dependencies) {
    const conflicts = [];

    // Vérifier les incohérences majeures
    const reactDeps = dependencies.filter(d => 
      d.name === 'react' || d.name === 'react-dom'
    );

    if (reactDeps.length === 2) {
      const react = reactDeps.find(d => d.name === 'react');
      const reactDom = reactDeps.find(d => d.name === 'react-dom');

      if (react && reactDom && react.version !== reactDom.version) {
        conflicts.push({
          type: 'version-mismatch',
          name: 'react/react-dom',
          severity: 'error',
          message: 'React et React DOM doivent avoir la même version',
          packages: ['react', 'react-dom'],
          versions: {
            react: react.version,
            'react-dom': reactDom.version
          },
          suggestion: `Utiliser react@${react.version} et react-dom@${react.version}`
        });
      }
    }

    // Vérifier les versions de React Native
    const rn = dependencies.find(d => d.name === 'react-native');
    const react = dependencies.find(d => d.name === 'react');

    if (rn && react) {
      const rnVersion = rn.version;
      const reactVersion = react.version;

      // React Native 0.72 nécessite React 18
      if (rnVersion.startsWith('0.72') && !reactVersion.startsWith('18')) {
        conflicts.push({
          type: 'incompatible',
          name: 'react-native/react',
          severity: 'error',
          message: 'React Native 0.72 nécessite React 18',
          packages: ['react-native', 'react'],
          versions: {
            'react-native': rnVersion,
            react: reactVersion
          },
          suggestion: 'Mettre à jour React vers la version 18'
        });
      }
    }

    return conflicts;
  }

  /**
   * Détecte les conflits de peer dependencies
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Array} Conflits
   */
  _detectPeerConflicts(dependencies) {
    const conflicts = [];

    // Mapping des peer dependencies connues
    const peerDepsMap = {
      'react-dom': { peer: 'react', version: '*' },
      'react-redux': { peer: 'redux', version: '*' },
      '@mui/material': { peer: '@emotion/react', version: '^11' },
      '@testing-library/react': { peer: 'react-dom', version: '*' }
    };

    dependencies.forEach(dep => {
      const peerInfo = peerDepsMap[dep.name];
      if (peerInfo) {
        const hasPeer = dependencies.some(d => d.name === peerInfo.peer);
        
        if (!hasPeer) {
          conflicts.push({
            type: 'peer-missing',
            name: dep.name,
            severity: 'error',
            message: `${dep.name} nécessite ${peerInfo.peer}`,
            package: dep.name,
            peer: peerInfo.peer,
            version: peerInfo.version,
            suggestion: `npm install ${peerInfo.peer}`
          });
        }
      }
    });

    return conflicts;
  }

  /**
   * Détecte les packages dépréciés
   * @private
   * @param {Array} dependencies - Dépendances
   * @returns {Array} Conflits
   */
  _detectDeprecated(dependencies) {
    const conflicts = [];

    // Liste des packages dépréciés connus
    const deprecated = {
      'moment': { 
        alternative: 'date-fns', 
        reason: 'Moment.js est en maintenance, préférer date-fns' 
      },
      'request': { 
        alternative: 'axios', 
        reason: 'Request est déprécié' 
      },
      'react-create-class': { 
        alternative: 'ES6 classes', 
        reason: 'Utiliser les classes ES6 à la place' 
      }
    };

    dependencies.forEach(dep => {
      const depInfo = deprecated[dep.name];
      if (depInfo) {
        conflicts.push({
          type: 'deprecated',
          name: dep.name,
          severity: 'warning',
          message: `${dep.name} est déprécié: ${depInfo.reason}`,
          alternative: depInfo.alternative,
          suggestion: `Remplacer par ${depInfo.alternative}`
        });
      }
    });

    return conflicts;
  }

  /**
   * Vérifie les conflits connus
   * @private
   * @param {Array} dependencies - Dépendances
   * @param {Array} knownConflicts - Liste des conflits connus
   * @returns {Array} Conflits
   */
  _checkKnownConflicts(dependencies, knownConflicts) {
    const conflicts = [];

    knownConflicts.forEach(rule => {
      const present = rule.packages.filter(p => 
        dependencies.some(d => d.name === p)
      );

      if (present.length === 1 && this.options.strictMode) {
        conflicts.push({
          type: rule.type || 'known-conflict',
          severity: rule.severity || 'warning',
          message: rule.message,
          packages: rule.packages,
          present,
          missing: rule.packages.filter(p => !present.includes(p))
        });
      }
    });

    return conflicts;
  }

  /**
   * Suggère une résolution pour un conflit
   * @param {Object} conflict - Conflit à résoudre
   * @returns {Object} Suggestion de résolution
   */
  suggestResolution(conflict) {
    switch (conflict.type) {
      case 'multiple-versions':
        return {
          action: 'unify',
          command: `npm install ${conflict.name}@latest`,
          description: `Utiliser la même version de ${conflict.name} pour tous les packages`
        };

      case 'version-mismatch':
        return {
          action: 'align',
          command: conflict.suggestion,
          description: 'Aligner les versions des packages'
        };

      case 'peer-missing':
        return {
          action: 'install',
          command: conflict.suggestion,
          description: `Installer la peer dependency manquante`
        };

      case 'deprecated':
        return {
          action: 'replace',
          command: `npm uninstall ${conflict.name} && npm install ${conflict.alternative}`,
          description: `Remplacer ${conflict.name} par ${conflict.alternative}`
        };

      default:
        return {
          action: 'review',
          description: 'Vérifier manuellement la configuration'
        };
    }
  }

  /**
   * Vérifie la compatibilité entre deux packages
   * @param {string} package1 - Premier package
   * @param {string} package2 - Deuxième package
   * @returns {Promise<Object>} Rapport de compatibilité
   */
  async checkCompatibility(package1, package2) {
    // TODO: Implémenter la vérification réelle
    return {
      compatible: true,
      packages: [package1, package2],
      notes: []
    };
  }

  /**
   * Génère un rapport de conflits
   * @param {Array} conflicts - Conflits détectés
   * @returns {Object} Rapport
   */
  generateReport(conflicts) {
    const bySeverity = conflicts.reduce((acc, c) => {
      acc[c.severity] = (acc[c.severity] || 0) + 1;
      return acc;
    }, {});

    const byType = conflicts.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});

    return {
      summary: {
        total: conflicts.length,
        errors: bySeverity.error || 0,
        warnings: bySeverity.warning || 0,
        info: bySeverity.info || 0
      },
      bySeverity,
      byType,
      conflicts: conflicts.map(c => ({
        ...c,
        resolution: this.suggestResolution(c)
      })),
      recommendations: this._generateRecommendations(conflicts)
    };
  }

  /**
   * Génère des recommandations
   * @private
   * @param {Array} conflicts - Conflits
   * @returns {Array} Recommandations
   */
  _generateRecommendations(conflicts) {
    const recommendations = [];

    // Prioriser les erreurs
    const errors = conflicts.filter(c => c.severity === 'error');
    if (errors.length > 0) {
      recommendations.push({
        priority: 'high',
        message: `${errors.length} erreur(s) à corriger en priorité`,
        action: 'resolve-errors'
      });
    }

    // Recommandations par type
    const versionConflicts = conflicts.filter(c => c.type === 'multiple-versions');
    if (versionConflicts.length > 0) {
      recommendations.push({
        priority: 'medium',
        message: 'Uniformiser les versions des packages',
        action: 'unify-versions'
      });
    }

    const peerConflicts = conflicts.filter(c => c.type === 'peer-missing');
    if (peerConflicts.length > 0) {
      recommendations.push({
        priority: 'high',
        message: `${peerConflicts.length} peer dependencie(s) manquante(s)`,
        action: 'install-peers'
      });
    }

    return recommendations;
  }
}

export default ConflictDetector;
