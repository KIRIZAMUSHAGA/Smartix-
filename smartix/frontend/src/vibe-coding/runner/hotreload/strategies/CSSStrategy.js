/**
 * CSSStrategy
 * Stratégie de hot reload pour les fichiers CSS
 */

export class CSSStrategy {
  /**
   * Crée une instance de CSSStrategy
   * @param {HotReloader} reloader - Instance du hot reloader
   */
  constructor(reloader) {
    this.reloader = reloader;
    this.name = 'css';
    this.injectedStyles = new Map();
  }

  /**
   * Applique le hot reload pour un fichier CSS
   * @param {string} path - Chemin du fichier
   * @param {string} content - Nouveau contenu
   * @param {string} oldContent - Ancien contenu
   * @returns {Object} Résultat de l'application
   */
  apply(path, content, oldContent) {
    const startTime = Date.now();

    try {
      // Analyser les changements
      const changes = this._analyzeChanges(content, oldContent);
      
      // Trouver ou créer la balise style
      const styleId = this._getStyleId(path);
      let style = document.getElementById(styleId);

      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.setAttribute('data-hmr', 'true');
        style.setAttribute('data-path', path);
        document.head.appendChild(style);
      }

      // Mettre à jour le contenu
      style.textContent = content;

      // Enregistrer l'injection
      this.injectedStyles.set(path, {
        element: style,
        content,
        lastUpdate: Date.now()
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        type: 'css',
        path,
        duration,
        changes,
        injected: true
      };

    } catch (error) {
      return {
        success: false,
        type: 'css',
        path,
        error: error.message
      };
    }
  }

  /**
   * Analyse les changements entre deux versions
   * @private
   * @param {string} newContent - Nouveau contenu
   * @param {string} oldContent - Ancien contenu
   * @returns {Object} Analyse des changements
   */
  _analyzeChanges(newContent, oldContent) {
    if (!oldContent) {
      return { type: 'new', additions: newContent?.length || 0 };
    }

    const changes = {
      type: 'modified',
      additions: 0,
      deletions: 0,
      selectors: []
    };

    // Analyse simple des sélecteurs
    const selectorRegex = /([.#]?[a-zA-Z0-9_-]+)\s*\{/g;
    let match;

    const oldSelectors = new Set();
    const newSelectors = new Set();

    while ((match = selectorRegex.exec(oldContent)) !== null) {
      oldSelectors.add(match[1]);
    }

    while ((match = selectorRegex.exec(newContent)) !== null) {
      newSelectors.add(match[1]);
    }

    // Sélecteurs ajoutés
    newSelectors.forEach(selector => {
      if (!oldSelectors.has(selector)) {
        changes.selectors.push({ selector, type: 'added' });
      }
    });

    // Sélecteurs supprimés
    oldSelectors.forEach(selector => {
      if (!newSelectors.has(selector)) {
        changes.selectors.push({ selector, type: 'removed' });
      }
    });

    changes.additions = newContent.length - (oldContent?.length || 0);
    changes.deletions = (oldContent?.length || 0) - newContent.length;

    return changes;
  }

  /**
   * Génère un ID unique pour une balise style
   * @private
   * @param {string} path - Chemin du fichier
   * @returns {string} ID unique
   */
  _getStyleId(path) {
    return `hmr-style-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  /**
   * Récupère une balise style injectée
   * @param {string} path - Chemin du fichier
   * @returns {Object|null} Style injecté
   */
  getInjectedStyle(path) {
    return this.injectedStyles.get(path) || null;
  }

  /**
   * Supprime une balise style injectée
   * @param {string} path - Chemin du fichier
   */
  removeInjectedStyle(path) {
    const injected = this.injectedStyles.get(path);
    if (injected && injected.element.parentNode) {
      injected.element.parentNode.removeChild(injected.element);
      this.injectedStyles.delete(path);
    }
  }

  /**
   * Nettoie toutes les balises injectées
   */
  cleanup() {
    this.injectedStyles.forEach((style, path) => {
      this.removeInjectedStyle(path);
    });
  }

  /**
   * Vérifie si le fichier est supporté
   * @param {string} path - Chemin du fichier
   * @returns {boolean} true si supporté
   */
  supports(path) {
    return path.endsWith('.css') || 
           path.endsWith('.scss') || 
           path.endsWith('.less');
  }
}

export default CSSStrategy;
