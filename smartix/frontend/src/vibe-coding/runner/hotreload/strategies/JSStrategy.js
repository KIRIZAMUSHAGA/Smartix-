/**
 * JSStrategy
 * Stratégie de hot reload pour les fichiers JavaScript
 */

export class JSStrategy {
  /**
   * Crée une instance de JSStrategy
   * @param {HotReloader} reloader - Instance du hot reloader
   */
  constructor(reloader) {
    this.reloader = reloader;
    this.name = 'javascript';
    this.injectedScripts = new Map();
    this.moduleRegistry = new Map();
  }

  /**
   * Applique le hot reload pour un fichier JavaScript
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
      
      // Déterminer le type de module
      const moduleType = this._detectModuleType(content);
      
      // Préparer le code pour l'injection
      const preparedCode = this._prepareCode(content, path, moduleType);

      // Trouver ou créer la balise script
      const scriptId = this._getScriptId(path);
      let script = document.getElementById(scriptId);

      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.setAttribute('data-hmr', 'true');
        script.setAttribute('data-path', path);
        script.setAttribute('data-module-type', moduleType);
        document.head.appendChild(script);
      }

      // Sauvegarder l'ancien module
      const oldModule = this.moduleRegistry.get(path);

      // Mettre à jour le contenu
      script.textContent = preparedCode;

      // Exécuter le nouveau code
      this._executeScript(script, path);

      // Nettoyer l'ancien module
      if (oldModule) {
        this._cleanupModule(oldModule, path);
      }

      // Enregistrer l'injection
      this.injectedScripts.set(path, {
        element: script,
        content,
        moduleType,
        lastUpdate: Date.now()
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        type: 'javascript',
        path,
        duration,
        changes,
        moduleType,
        exports: this._getExports(path)
      };

    } catch (error) {
      return {
        success: false,
        type: 'javascript',
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
      functions: [],
      exports: []
    };

    // Analyse simple des fonctions
    const functionRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
    const exportRegex = /export\s+(?:default\s+)?(?:function|const|let|var|class)\s+([a-zA-Z0-9_]+)/g;

    let match;

    while ((match = functionRegex.exec(newContent)) !== null) {
      changes.functions.push({ name: match[1], type: 'defined' });
    }

    while ((match = exportRegex.exec(newContent)) !== null) {
      changes.exports.push({ name: match[1], type: 'exported' });
    }

    changes.additions = newContent.length - (oldContent?.length || 0);
    changes.deletions = (oldContent?.length || 0) - newContent.length;

    return changes;
  }

  /**
   * Détecte le type de module
   * @private
   * @param {string} content - Contenu du fichier
   * @returns {string} Type de module ('esm', 'commonjs', 'global')
   */
  _detectModuleType(content) {
    if (content.includes('import ') || content.includes('export ')) {
      return 'esm';
    }
    if (content.includes('require(') || content.includes('module.exports')) {
      return 'commonjs';
    }
    return 'global';
  }

  /**
   * Prépare le code pour l'injection
   * @private
   * @param {string} content - Contenu original
   * @param {string} path - Chemin du fichier
   * @param {string} moduleType - Type de module
   * @returns {string} Code préparé
   */
  _prepareCode(content, path, moduleType) {
    // Ajouter des métadonnées
    const wrapped = `
      // HMR: ${path}
      // Timestamp: ${Date.now()}
      // Type: ${moduleType}
      
      (function() {
        const __HMR_PATH__ = '${path}';
        const __HMR_MODULE__ = { exports: {} };
        
        try {
          ${content}
          
          // Enregistrer le module
          if (typeof window.__HMR_REGISTRY__ === 'undefined') {
            window.__HMR_REGISTRY__ = {};
          }
          window.__HMR_REGISTRY__[__HMR_PATH__] = __HMR_MODULE__.exports;
          
        } catch (error) {
          console.error('[HMR] Error in ${path}:', error);
          throw error;
        }
      })();
    `;

    return wrapped;
  }

  /**
   * Exécute un script
   * @private
   * @param {HTMLScriptElement} script - Élément script
   * @param {string} path - Chemin du fichier
   */
  _executeScript(script, path) {
    try {
      // Évaluer le script
      const execute = new Function(script.textContent);
      execute();

      // Sauvegarder le module
      const exports = window.__HMR_REGISTRY__?.[path];
      if (exports) {
        this.moduleRegistry.set(path, {
          exports,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error(`[HMR] Execution error in ${path}:`, error);
      throw error;
    }
  }

  /**
   * Nettoie un ancien module
   * @private
   * @param {Object} module - Ancien module
   * @param {string} path - Chemin du fichier
   */
  _cleanupModule(module, path) {
    // Appeler dispose handler si existant
    if (module.exports && module.exports.__hmrDispose) {
      try {
        module.exports.__hmrDispose();
      } catch (error) {
        console.warn(`[HMR] Dispose error in ${path}:`, error);
      }
    }

    // Nettoyer le registry
    if (window.__HMR_REGISTRY__) {
      delete window.__HMR_REGISTRY__[path];
    }
  }

  /**
   * Génère un ID unique pour une balise script
   * @private
   * @param {string} path - Chemin du fichier
   * @returns {string} ID unique
   */
  _getScriptId(path) {
    return `hmr-script-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  /**
   * Récupère les exports d'un module
   * @private
   * @param {string} path - Chemin du fichier
   * @returns {Object} Exports du module
   */
  _getExports(path) {
    const module = this.moduleRegistry.get(path);
    return module ? module.exports : {};
  }

  /**
   * Récupère un script injecté
   * @param {string} path - Chemin du fichier
   * @returns {Object|null} Script injecté
   */
  getInjectedScript(path) {
    return this.injectedScripts.get(path) || null;
  }

  /**
   * Supprime un script injecté
   * @param {string} path - Chemin du fichier
   */
  removeInjectedScript(path) {
    const injected = this.injectedScripts.get(path);
    if (injected && injected.element.parentNode) {
      injected.element.parentNode.removeChild(injected.element);
      this.injectedScripts.delete(path);
    }
    this.moduleRegistry.delete(path);
  }

  /**
   * Nettoie tous les scripts injectés
   */
  cleanup() {
    this.injectedScripts.forEach((script, path) => {
      this.removeInjectedScript(path);
    });
  }

  /**
   * Vérifie si le fichier est supporté
   * @param {string} path - Chemin du fichier
   * @returns {boolean} true si supporté
   */
  supports(path) {
    return path.endsWith('.js') || 
           path.endsWith('.jsx') || 
           path.endsWith('.ts') || 
           path.endsWith('.tsx');
  }
}

export default JSStrategy;
