/**
 * HTMLStrategy
 * Stratégie de hot reload pour les fichiers HTML
 */

export class HTMLStrategy {
  /**
   * Crée une instance de HTMLStrategy
   * @param {HotReloader} reloader - Instance du hot reloader
   */
  constructor(reloader) {
    this.reloader = reloader;
    this.name = 'html';
    this.lastContent = null;
    this.pendingReload = false;
  }

  /**
   * Applique le hot reload pour un fichier HTML
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
      
      // Vérifier si un rechargement complet est nécessaire
      if (this._needsFullReload(changes)) {
        return this._performFullReload(path, content, changes, startTime);
      }

      // Appliquer les changements partiels
      const result = this._applyPartialUpdates(content, oldContent, changes);

      const duration = Date.now() - startTime;

      return {
        success: true,
        type: 'html',
        path,
        duration,
        changes,
        partial: true,
        ...result
      };

    } catch (error) {
      return {
        success: false,
        type: 'html',
        path,
        error: error.message
      };
    }
  }

  /**
   * Analyse les changements entre deux versions HTML
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
      head: { changes: false },
      body: { changes: false },
      scripts: [],
      styles: [],
      images: []
    };

    // Analyser les changements dans head
    const oldHead = this._extractSection(oldContent, 'head');
    const newHead = this._extractSection(newContent, 'head');
    
    if (oldHead !== newHead) {
      changes.head.changes = true;
      changes.head.old = oldHead;
      changes.head.new = newHead;
    }

    // Analyser les changements dans body
    const oldBody = this._extractSection(oldContent, 'body');
    const newBody = this._extractSection(newContent, 'body');
    
    if (oldBody !== newBody) {
      changes.body.changes = true;
      changes.body.old = oldBody;
      changes.body.new = newBody;
    }

    // Analyser les scripts
    this._analyzeTags(newContent, oldContent, 'script', changes.scripts);
    
    // Analyser les styles
    this._analyzeTags(newContent, oldContent, 'link[rel="stylesheet"]', changes.styles);
    
    // Analyser les images
    this._analyzeTags(newContent, oldContent, 'img', changes.images);

    changes.additions = newContent.length - oldContent.length;
    changes.deletions = oldContent.length - newContent.length;

    return changes;
  }

  /**
   * Extrait une section du HTML
   * @private
   * @param {string} content - Contenu HTML
   * @param {string} section - Section à extraire (head/body)
   * @returns {string} Contenu de la section
   */
  _extractSection(content, section) {
    const regex = new RegExp(`<${section}[^>]*>([\\s\\S]*?)<\/${section}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Analyse les changements dans les tags
   * @private
   * @param {string} newContent - Nouveau contenu
   * @param {string} oldContent - Ancien contenu
   * @param {string} tag - Tag à analyser
   * @param {Array} target - Tableau cible
   */
  _analyzeTags(newContent, oldContent, tag, target) {
    const tagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
    
    const oldMatches = oldContent.match(tagRegex) || [];
    const newMatches = newContent.match(tagRegex) || [];

    const oldSet = new Set(oldMatches);
    const newSet = new Set(newMatches);

    // Tags ajoutés
    newSet.forEach(match => {
      if (!oldSet.has(match)) {
        target.push({ type: 'added', tag: match });
      }
    });

    // Tags supprimés
    oldSet.forEach(match => {
      if (!newSet.has(match)) {
        target.push({ type: 'removed', tag: match });
      }
    });
  }

  /**
   * Vérifie si un rechargement complet est nécessaire
   * @private
   * @param {Object} changes - Analyse des changements
   * @returns {boolean} true si rechargement complet nécessaire
   */
  _needsFullReload(changes) {
    return changes.head.changes || 
           changes.scripts.length > 0 ||
           changes.styles.length > 0;
  }

  /**
   * Applique les mises à jour partielles
   * @private
   * @param {string} newContent - Nouveau contenu
   * @param {string} oldContent - Ancien contenu
   * @param {Object} changes - Analyse des changements
   * @returns {Object} Résultat des mises à jour
   */
  _applyPartialUpdates(newContent, oldContent, changes) {
    const updates = [];

    // Mettre à jour le body
    if (changes.body.changes) {
      const newBody = this._extractSection(newContent, 'body');
      document.body.innerHTML = newBody;
      updates.push({ type: 'body-updated' });
    }

    // Mettre à jour le titre
    const newTitle = newContent.match(/<title>([^<]*)<\/title>/i);
    if (newTitle && document.title !== newTitle[1]) {
      document.title = newTitle[1];
      updates.push({ type: 'title-updated', title: newTitle[1] });
    }

    return { updates };
  }

  /**
   * Effectue un rechargement complet
   * @private
   * @param {string} path - Chemin du fichier
   * @param {string} content - Nouveau contenu
   * @param {Object} changes - Analyse des changements
   * @param {number} startTime - Temps de début
   * @returns {Object} Résultat
   */
  _performFullReload(path, content, changes, startTime) {
    // Éviter les rechargements multiples
    if (this.pendingReload) {
      return {
        success: true,
        type: 'html',
        path,
        duration: Date.now() - startTime,
        changes,
        reload: 'pending'
      };
    }

    this.pendingReload = true;

    // Planifier le rechargement
    setTimeout(() => {
      window.location.reload();
    }, 100);

    return {
      success: true,
      type: 'html',
      path,
      duration: Date.now() - startTime,
      changes,
      reload: 'scheduled'
    };
  }

  /**
   * Injecte le client de hot reload dans le HTML
   * @param {string} html - Contenu HTML original
   * @param {number} port - Port du serveur HMR
   * @returns {string} HTML avec client injecté
   */
  injectClient(html, port = 8080) {
    const clientScript = `
      <!-- Hot Reload Client -->
      <script>
        (function() {
          const socket = new WebSocket('ws://localhost:${port}');
          
          socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
              case 'reload':
                window.location.reload();
                break;
              case 'update-css':
                updateCSS(data.href);
                break;
            }
          };

          function updateCSS(href) {
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            links.forEach(link => {
              if (link.href.includes(href)) {
                const newLink = document.createElement('link');
                newLink.rel = 'stylesheet';
                newLink.href = href + '?t=' + Date.now();
                link.parentNode.replaceChild(newLink, link);
              }
            });
          }

          socket.onopen = () => console.log('[HMR] Connected');
          socket.onclose = () => console.log('[HMR] Disconnected');
        })();
      </script>
    `;

    // Injecter avant la fermeture de body
    return html.replace('</body>', clientScript + '\n</body>');
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    this.lastContent = null;
    this.pendingReload = false;
  }

  /**
   * Vérifie si le fichier est supporté
   * @param {string} path - Chemin du fichier
   * @returns {boolean} true si supporté
   */
  supports(path) {
    return path.endsWith('.html') || path.endsWith('.htm');
  }
}

export default HTMLStrategy;
