/**
 * FileWatcher
 * Surveille les modifications de fichiers
 */

import EventEmitter from 'events';

export class FileWatcher extends EventEmitter {
  /**
   * Crée une instance de FileWatcher
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      debounceTime: options.debounceTime || 300,
      ignorePatterns: options.ignorePatterns || [
        /node_modules/,
        /\.git/,
        /\.cache/,
        /\.DS_Store/
      ],
      ...options
    };

    this.watchedFiles = new Map();
    this.projects = new Map();
    this.timeouts = new Map();
    this.stats = {
      totalWatches: 0,
      activeProjects: 0,
      changes: 0
    };
  }

  /**
   * Surveille un fichier
   * @param {string} projectId - ID du projet
   * @param {string} path - Chemin du fichier
   * @param {string} content - Contenu initial
   */
  watch(projectId, path, content) {
    const key = `${projectId}:${path}`;

    // Vérifier si le fichier doit être ignoré
    if (this._shouldIgnore(path)) {
      return;
    }

    const file = {
      path,
      projectId,
      content,
      lastModified: Date.now(),
      hash: this._computeHash(content),
      watchers: new Set()
    };

    this.watchedFiles.set(key, file);

    if (!this.projects.has(projectId)) {
      this.projects.set(projectId, new Set());
    }
    this.projects.get(projectId).add(key);

    this.stats.totalWatches++;
    this.stats.activeProjects = this.projects.size;
  }

  /**
   * Arrête de surveiller un fichier
   * @param {string} projectId - ID du projet
   * @param {string} path - Chemin du fichier
   */
  unwatch(projectId, path) {
    const key = `${projectId}:${path}`;
    
    if (this.watchedFiles.delete(key)) {
      this.stats.totalWatches--;

      const projectFiles = this.projects.get(projectId);
      if (projectFiles) {
        projectFiles.delete(key);
        if (projectFiles.size === 0) {
          this.projects.delete(projectId);
          this.stats.activeProjects = this.projects.size;
        }
      }
    }
  }

  /**
   * Met à jour le contenu d'un fichier
   * @param {string} projectId - ID du projet
   * @param {string} path - Chemin du fichier
   * @param {string} newContent - Nouveau contenu
   */
  update(projectId, path, newContent) {
    const key = `${projectId}:${path}`;
    const file = this.watchedFiles.get(key);

    if (!file) {
      this.watch(projectId, path, newContent);
      return;
    }

    const newHash = this._computeHash(newContent);

    if (newHash !== file.hash) {
      const oldContent = file.content;
      
      file.content = newContent;
      file.hash = newHash;
      file.lastModified = Date.now();

      this.stats.changes++;

      // Débouncer l'émission de l'événement
      this._debounceEmit(key, () => {
        this.emit('file-changed', {
          projectId,
          path,
          content: newContent,
          oldContent,
          hash: newHash,
          timestamp: Date.now()
        });
      });
    }
  }

  /**
   * Vérifie si un fichier doit être ignoré
   * @private
   * @param {string} path - Chemin du fichier
   * @returns {boolean} true si doit être ignoré
   */
  _shouldIgnore(path) {
    return this.options.ignorePatterns.some(pattern => 
      pattern.test(path)
    );
  }

  /**
   * Calcule un hash simple du contenu
   * @private
   * @param {string} content - Contenu
   * @returns {string} Hash
   */
  _computeHash(content) {
    if (!content) return '';
    
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Débounce l'émission d'un événement
   * @private
   * @param {string} key - Clé du fichier
   * @param {Function} fn - Fonction à exécuter
   */
  _debounceEmit(key, fn) {
    const existing = this.timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      fn();
      this.timeouts.delete(key);
    }, this.options.debounceTime);

    this.timeouts.set(key, timeout);
  }

  /**
   * Récupère un fichier surveillé
   * @param {string} projectId - ID du projet
   * @param {string} path - Chemin du fichier
   * @returns {Object|null} Fichier
   */
  getWatchedFile(projectId, path) {
    const key = `${projectId}:${path}`;
    return this.watchedFiles.get(key) || null;
  }

  /**
   * Récupère tous les fichiers surveillés
   * @returns {Array} Liste des fichiers
   */
  getAllWatchedFiles() {
    return Array.from(this.watchedFiles.values());
  }

  /**
   * Récupère les fichiers surveillés pour un projet
   * @param {string} projectId - ID du projet
   * @returns {Array} Liste des fichiers
   */
  getProjectFiles(projectId) {
    const files = [];
    const projectFiles = this.projects.get(projectId);
    
    if (projectFiles) {
      projectFiles.forEach(key => {
        const file = this.watchedFiles.get(key);
        if (file) files.push(file);
      });
    }

    return files;
  }

  /**
   * Nombre de fichiers surveillés
   * @returns {number} Nombre de fichiers
   */
  getWatchedCount() {
    return this.watchedFiles.size;
  }

  /**
   * Vérifie si un fichier est surveillé
   * @param {string} projectId - ID du projet
   * @param {string} path - Chemin du fichier
   * @returns {boolean} true si surveillé
   */
  isWatched(projectId, path) {
    const key = `${projectId}:${path}`;
    return this.watchedFiles.has(key);
  }

  /**
   * Nettoie les ressources pour un projet
   * @param {string} projectId - ID du projet
   */
  clearProject(projectId) {
    const projectFiles = this.projects.get(projectId);
    
    if (projectFiles) {
      projectFiles.forEach(key => {
        this.watchedFiles.delete(key);
        const timeout = this.timeouts.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.timeouts.delete(key);
        }
      });
      
      this.projects.delete(projectId);
      this.stats.totalWatches -= projectFiles.size;
      this.stats.activeProjects = this.projects.size;
    }
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      pendingTimeouts: this.timeouts.size
    };
  }

  /**
   * Nettoie toutes les ressources
   */
  destroy() {
    // Nettoyer tous les timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();

    // Vider les maps
    this.watchedFiles.clear();
    this.projects.clear();

    this.stats = {
      totalWatches: 0,
      activeProjects: 0,
      changes: 0
    };
  }
}

export default FileWatcher;
