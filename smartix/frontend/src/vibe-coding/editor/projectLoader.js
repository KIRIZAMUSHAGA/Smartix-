/**
 * Chargeur de projet pour le module Vibe-Coding
 * 
 * Rôle: Charger et préparer un projet pour l'édition
 * - Charger les fichiers du projet
 * - Initialiser l'arbre de fichiers
 * - Restaurer l'état de session
 * - Gérer les fichiers ouverts récents
 * - Versionning et gestion des conflits
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { useState, useEffect, useCallback, useRef } from 'react';
import EventEmitter from 'events';
import { projectManager } from '../core/projectManager';
import { fileManager } from './fileManager';

// =============================
// CONFIGURATION
// =============================

// Clés pour le stockage local
const STORAGE_KEYS = {
  OPEN_FILES: 'vibe_coding_open_files',
  ACTIVE_FILE: 'vibe_coding_active_file',
  EXPANDED_FOLDERS: 'vibe_coding_expanded_folders',
  EDITOR_STATE: 'vibe_coding_editor_state',
  FILE_HISTORY: 'vibe_coding_file_history',
  SESSIONS: 'vibe_coding_sessions'
};

// Constantes de configuration
const MAX_RECENT_FILES = 10;
const MAX_OPEN_FILES = 20;
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const CHUNK_SIZE = 1024 * 1024; // 1 MB pour le chargement progressif
const MAX_HISTORY_VERSIONS = 50;

// Messages d'erreur internationalisés
const ERROR_MESSAGES = {
  fr: {
    PROJECT_NOT_FOUND: 'Projet non trouvé',
    NOT_INITIALIZED: 'Chargeur de projet non initialisé',
    FILE_NOT_FOUND: 'Fichier non trouvé',
    SESSION_INVALID: 'État de session invalide',
    CONCURRENT_EDIT: (file) => `Le fichier ${file} est déjà ouvert dans une autre session`,
    LARGE_FILE: (size) => `Ce fichier est volumineux (${size} MB). Voulez-vous l\'ouvrir ?`,
    LOADING_CHUNK: (current, total) => `Chargement... ${current}/${total} MB`,
    CONFLICT_DETECTED: 'Conflit détecté avec une version plus récente',
    SAVE_CONFIRM: 'Ce fichier a été modifié ailleurs. Voulez-vous sauvegarder ?'
  },
  en: {
    PROJECT_NOT_FOUND: 'Project not found',
    NOT_INITIALIZED: 'Project loader not initialized',
    FILE_NOT_FOUND: 'File not found',
    SESSION_INVALID: 'Invalid session state',
    CONCURRENT_EDIT: (file) => `File ${file} is already open in another session`,
    LARGE_FILE: (size) => `This file is large (${size} MB). Do you want to open it?`,
    LOADING_CHUNK: (current, total) => `Loading... ${current}/${total} MB`,
    CONFLICT_DETECTED: 'Conflict detected with newer version',
    SAVE_CONFIRM: 'This file has been modified elsewhere. Do you want to save?'
  }
};

// =============================
// GESTIONNAIRE DE SESSIONS
// =============================

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this._loadSessions();
  }

  createSession(projectId, userId, metadata = {}) {
    const sessionId = `${userId}-${projectId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      projectId,
      userId,
      openFiles: new Set(),
      lastActive: Date.now(),
      metadata: {
        userAgent: metadata.userAgent,
        tabId: metadata.tabId,
        ...metadata
      },
      createdAt: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    this._saveSessions();
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
      this._saveSessions();
    }
  }

  addOpenFile(sessionId, filePath) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.openFiles.add(filePath);
      this._saveSessions();
    }
  }

  removeOpenFile(sessionId, filePath) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.openFiles.delete(filePath);
      this._saveSessions();
    }
  }

  getSessionsForFile(projectId, filePath) {
    const sessions = [];
    for (const session of this.sessions.values()) {
      if (session.projectId === projectId && session.openFiles.has(filePath)) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  async mergeSessions(session1Id, session2Id) {
    const session1 = this.sessions.get(session1Id);
    const session2 = this.sessions.get(session2Id);

    if (!session1 || !session2) {
      throw new Error('Session non trouvée');
    }

    // Fusionner les fichiers ouverts
    const mergedOpenFiles = new Set([...session1.openFiles, ...session2.openFiles]);
    
    // Créer une nouvelle session fusionnée
    const mergedSession = {
      id: `merged-${session1Id}-${session2Id}`,
      projectId: session1.projectId,
      userId: session1.userId,
      openFiles: mergedOpenFiles,
      lastActive: Date.now(),
      metadata: {
        ...session1.metadata,
        ...session2.metadata,
        merged: true,
        originalSessions: [session1Id, session2Id]
      },
      createdAt: Date.now()
    };

    this.sessions.set(mergedSession.id, mergedSession);
    
    // Supprimer les anciennes sessions
    this.sessions.delete(session1Id);
    this.sessions.delete(session2Id);
    
    this._saveSessions();
    return mergedSession;
  }

  cleanupInactiveSessions(maxAge = 24 * 60 * 60 * 1000) { // 24h par défaut
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActive > maxAge) {
        this.sessions.delete(id);
      }
    }
    this._saveSessions();
  }

  _loadSessions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([id, session]) => {
          session.openFiles = new Set(session.openFiles);
          this.sessions.set(id, session);
        });
      }
    } catch (error) {
      console.warn('Erreur chargement sessions:', error);
    }
  }

  _saveSessions() {
    try {
      const toSave = {};
      this.sessions.forEach((session, id) => {
        toSave[id] = {
          ...session,
          openFiles: Array.from(session.openFiles)
        };
      });
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(toSave));
    } catch (error) {
      console.warn('Erreur sauvegarde sessions:', error);
    }
  }
}

// =============================
// GESTIONNAIRE DE VERSIONS
// =============================

class VersionManager {
  constructor() {
    this.history = new Map();
    this._loadHistory();
  }

  addVersion(filePath, content, metadata = {}) {
    if (!this.history.has(filePath)) {
      this.history.set(filePath, []);
    }

    const versions = this.history.get(filePath);
    const version = {
      id: `v${versions.length + 1}`,
      content,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        size: content?.length || 0
      }
    };

    versions.push(version);

    // Limiter le nombre de versions
    if (versions.length > MAX_HISTORY_VERSIONS) {
      versions.shift();
    }

    this._saveHistory();
    return version;
  }

  getVersion(filePath, versionId) {
    const versions = this.history.get(filePath);
    if (!versions) return null;
    
    if (versionId === 'latest') {
      return versions[versions.length - 1];
    }

    return versions.find(v => v.id === versionId);
  }

  getVersions(filePath) {
    return this.history.get(filePath) || [];
  }

  restoreVersion(filePath, versionId) {
    const version = this.getVersion(filePath, versionId);
    if (!version) return null;

    // Créer une nouvelle version avec le contenu restauré
    return this.addVersion(filePath, version.content, {
      ...version.metadata,
      restoredFrom: versionId
    });
  }

  compareVersions(filePath, version1Id, version2Id) {
    const v1 = this.getVersion(filePath, version1Id);
    const v2 = this.getVersion(filePath, version2Id);

    if (!v1 || !v2) return null;

    return {
      additions: this._countDiff(v2.content, v1.content),
      deletions: this._countDiff(v1.content, v2.content),
      timestamp: Date.now()
    };
  }

  _countDiff(str1, str2) {
    // Implémentation simple - à améliorer avec un vrai diff
    const lines1 = (str1 || '').split('\n');
    const lines2 = (str2 || '').split('\n');
    
    let additions = 0;
    let deletions = 0;

    for (let i = 0; i < Math.max(lines1.length, lines2.length); i++) {
      if (i >= lines1.length) additions++;
      else if (i >= lines2.length) deletions++;
      else if (lines1[i] !== lines2[i]) {
        additions++;
        deletions++;
      }
    }

    return { additions, deletions };
  }

  _loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FILE_HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([path, versions]) => {
          this.history.set(path, versions);
        });
      }
    } catch (error) {
      console.warn('Erreur chargement historique:', error);
    }
  }

  _saveHistory() {
    try {
      const toSave = {};
      this.history.forEach((versions, path) => {
        toSave[path] = versions;
      });
      localStorage.setItem(STORAGE_KEYS.FILE_HISTORY, JSON.stringify(toSave));
    } catch (error) {
      console.warn('Erreur sauvegarde historique:', error);
    }
  }
}

// =============================
// CLASSE PROJECT LOADER
// =============================

export class ProjectLoader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.currentProject = null;
    this.currentUserId = null;
    this.currentSessionId = null;
    this.openFiles = [];
    this.activeFile = null;
    this.expandedFolders = new Set();
    this.recentFiles = [];
    this.editorStates = new Map();
    this.fileCache = new Map();
    this.loadingChunks = new Map();
    
    this.sessionManager = new SessionManager();
    this.versionManager = new VersionManager();
    
    this.language = options.language || 'fr';
    this.maxOpenFiles = options.maxOpenFiles || MAX_OPEN_FILES;
    
    this.on('fileOpened', this._handleFileOpened.bind(this));
    this.on('fileClosed', this._handleFileClosed.bind(this));
    this.on('fileChanged', this._handleFileChanged.bind(this));
  }

  /**
   * Initialise le chargeur
   */
  async initialize(projectId, userId, metadata = {}) {
    if (this.initialized && this.currentProject?.id === projectId) return;

    try {
      // Nettoyer les anciennes sessions
      this.sessionManager.cleanupInactiveSessions();

      // Créer une nouvelle session
      this.currentSessionId = this.sessionManager.createSession(projectId, userId, {
        userAgent: navigator.userAgent,
        tabId: metadata.tabId || `tab-${Date.now()}`,
        ...metadata
      }).id;

      // Charger le projet
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error(this._t('PROJECT_NOT_FOUND'));
      }

      this.currentProject = project;
      this.currentUserId = userId;

      // Restaurer l'état de session
      await this._restoreSessionState(projectId);

      // Initialiser le fileManager
      await fileManager.initialize(projectId, userId);

      this.initialized = true;
      
      this.emit('initialized', { projectId, userId });
      console.log(`✅ ProjectLoader initialisé pour le projet ${projectId}`);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Charge les fichiers du projet
   */
  async loadProjectFiles() {
    if (!this.initialized) {
      throw new Error(this._t('NOT_INITIALIZED'));
    }

    const files = this.currentProject.files || {};
    const fileList = [];

    Object.entries(files).forEach(([path, content]) => {
      const filename = path.split('/').pop();
      const ext = path.substring(path.lastIndexOf('.'));
      
      fileList.push({
        path,
        name: filename,
        extension: ext,
        size: content?.length || 0,
        language: this._getLanguageFromExt(ext),
        lastModified: this._getFileMetadata(path)?.lastModified || Date.now()
      });
    });

    return {
      files: fileList.sort((a, b) => a.path.localeCompare(b.path)),
      totalFiles: fileList.length,
      totalSize: fileList.reduce((sum, f) => sum + f.size, 0),
      projectName: this.currentProject.name,
      projectId: this.currentProject.id
    };
  }

  /**
   * Ouvre un fichier
   */
  async openFile(path, options = {}) {
    if (!this.initialized) {
      throw new Error(this._t('NOT_INITIALIZED'));
    }

    const { force = false, chunked = true } = options;

    try {
      // Vérifier les sessions concurrentes
      const concurrentSessions = this.sessionManager.getSessionsForFile(
        this.currentProject.id,
        path
      ).filter(s => s.id !== this.currentSessionId);

      if (concurrentSessions.length > 0 && !force) {
        const shouldContinue = await this._showConflictDialog(path, concurrentSessions);
        if (!shouldContinue) return null;
      }

      // Vérifier la taille du fichier
      const fileSize = this.currentProject.files[path]?.length || 0;
      if (fileSize > LARGE_FILE_THRESHOLD && !force) {
        const shouldOpen = await this._confirmOpenLargeFile(fileSize);
        if (!shouldOpen) return null;
      }

      // Lire le fichier (avec cache ou chunked)
      let file;
      if (chunked && fileSize > LARGE_FILE_THRESHOLD) {
        file = await this._openLargeFileInChunks(path);
      } else {
        file = await this._readFileWithCache(path);
      }

      if (!file) {
        throw new Error(this._t('FILE_NOT_FOUND'));
      }

      // Ajouter aux fichiers ouverts
      this._addToOpenFiles(path);

      // Définir comme fichier actif
      this.activeFile = path;

      // Ajouter aux récents
      this._addToRecentFiles(path);

      // Enregistrer dans la session
      this.sessionManager.addOpenFile(this.currentSessionId, path);

      // Sauvegarder l'état
      await this._saveSessionState();

      this.emit('fileOpened', { path, size: fileSize });

      return {
        ...file,
        size: fileSize,
        version: this.versionManager.getVersion(path, 'latest')?.id
      };

    } catch (error) {
      this.emit('error', { error, context: 'openFile' });
      throw error;
    }
  }

  /**
   * Ferme un fichier
   */
  async closeFile(path, options = {}) {
    if (!this.initialized) return;

    const { saveState = true } = options;

    try {
      // Sauvegarder l'état de l'éditeur
      if (saveState) {
        this._saveEditorState(path);
      }

      // Nettoyer le cache
      this.fileCache.delete(path);
      this.loadingChunks.delete(path);

      // Retirer des fichiers ouverts
      this.openFiles = this.openFiles.filter(p => p !== path);

      // Retirer de la session
      this.sessionManager.removeOpenFile(this.currentSessionId, path);

      // Si c'était le fichier actif, choisir un autre
      if (this.activeFile === path) {
        this.activeFile = this.openFiles[0] || null;
      }

      // Sauvegarder l'état
      await this._saveSessionState();

      this.emit('fileClosed', { path });

      return { success: true };
    } catch (error) {
      this.emit('error', { error, context: 'closeFile' });
      throw error;
    }
  }

  /**
   * Sauvegarde un fichier
   */
  async saveFile(path, content, options = {}) {
    if (!this.initialized) return;

    const { createVersion = true, metadata = {} } = options;

    try {
      // Vérifier les conflits
      const latestVersion = this.versionManager.getVersion(path, 'latest');
      if (latestVersion && latestVersion.content !== this.fileCache.get(path)?.content) {
        const shouldSave = await this._confirmSaveConflict(path);
        if (!shouldSave) return null;
      }

      // Sauvegarder via fileManager
      await fileManager.writeFile(path, content);

      // Mettre à jour le cache
      this.fileCache.set(path, {
        content,
        timestamp: Date.now()
      });

      // Créer une version
      if (createVersion) {
        this.versionManager.addVersion(path, content, {
          ...metadata,
          userId: this.currentUserId,
          sessionId: this.currentSessionId
        });
      }

      // Mettre à jour le projet
      this.currentProject.files[path] = content;

      this.emit('fileSaved', { path, size: content.length });

      return { success: true, version: this.versionManager.getVersion(path, 'latest') };
    } catch (error) {
      this.emit('error', { error, context: 'saveFile' });
      throw error;
    }
  }

  /**
   * Ferme tous les fichiers
   */
  async closeAllFiles() {
    if (!this.initialized) return;

    // Sauvegarder tous les états
    this.openFiles.forEach(path => {
      this._saveEditorState(path);
    });

    this.openFiles = [];
    this.activeFile = null;
    this.fileCache.clear();
    this.loadingChunks.clear();

    await this._saveSessionState();

    this.emit('allFilesClosed');

    return { success: true };
  }

  /**
   * Obtient le fichier actif
   */
  getActiveFile() {
    if (!this.activeFile) return null;
    return {
      path: this.activeFile,
      ...this.openFiles.find(p => p === this.activeFile)
    };
  }

  /**
   * Liste les fichiers ouverts
   */
  getOpenFiles() {
    return this.openFiles.map(path => ({
      path,
      name: path.split('/').pop(),
      isActive: path === this.activeFile,
      isDirty: this._isFileDirty(path),
      version: this.versionManager.getVersion(path, 'latest')?.id
    }));
  }

  /**
   * Liste les fichiers récents
   */
  getRecentFiles() {
    return this.recentFiles.map(path => ({
      path,
      name: path.split('/').pop(),
      lastOpened: this._getFileMetadata(path)?.lastOpened
    }));
  }

  /**
   * Définit l'état de l'éditeur pour un fichier
   */
  setEditorState(path, state) {
    this.editorStates.set(path, {
      ...state,
      timestamp: Date.now()
    });
    this._saveEditorState(path);
  }

  /**
   * Récupère l'état de l'éditeur pour un fichier
   */
  getEditorState(path) {
    return this.editorStates.get(path) || {
      cursorPosition: { line: 0, column: 0 },
      scrollPosition: { top: 0, left: 0 },
      selections: [],
      folds: []
    };
  }

  /**
   * Définit les dossiers expandés
   */
  setExpandedFolders(folders) {
    this.expandedFolders = new Set(folders);
    this._saveSessionState();
  }

  /**
   * Vérifie si un dossier est expandé
   */
  isFolderExpanded(path) {
    return this.expandedFolders.has(path);
  }

  /**
   * Recharge le projet
   */
  async reloadProject() {
    if (!this.initialized) return;

    try {
      // Recharger le projet depuis projectManager
      const project = await projectManager.getProjectById(
        this.currentProject.id,
        this.currentUserId
      );

      this.currentProject = project;

      // Recharger les fichiers ouverts
      const openFilesContent = [];
      for (const path of this.openFiles) {
        if (project.files[path]) {
          const content = await this._readFileWithCache(path, true);
          openFilesContent.push({
            path,
            content,
            version: this.versionManager.getVersion(path, 'latest')
          });
        }
      }

      this.emit('projectReloaded', { 
        projectId: this.currentProject.id,
        openFilesCount: openFilesContent.length 
      });

      return {
        success: true,
        openFiles: openFilesContent
      };

    } catch (error) {
      this.emit('error', { error, context: 'reloadProject' });
      throw error;
    }
  }

  /**
   * Obtient l'historique des versions d'un fichier
   */
  getFileVersions(path) {
    return this.versionManager.getVersions(path);
  }

    /**
   * Restaure une version d'un fichier
   */
  async restoreFileVersion(path, versionId) {
    const version = this.versionManager.restoreVersion(path, versionId);
    if (version) {
      await this.saveFile(path, version.content, {
        createVersion: true,
        metadata: { restored: true, fromVersion: versionId }
      });
    }
    return version;
  }

  /**
   * Compare deux versions d'un fichier
   */
  compareFileVersions(path, version1, version2) {
    return this.versionManager.compareVersions(path, version1, version2);
  }
    // =============================
  // FONCTIONS PRIVÉES
  // =============================

  /**
   * Traduction
   */
  _t(key, ...args) {
    const message = ERROR_MESSAGES[this.language]?.[key] || ERROR_MESSAGES.fr[key];
    if (typeof message === 'function') {
      return message(...args);
    }
    return message || key;
  }

  /**
   * Ajoute un fichier aux fichiers ouverts
   */
  _addToOpenFiles(path) {
    if (!this.openFiles.includes(path)) {
      this.openFiles.push(path);
      
      // Limiter le nombre de fichiers ouverts
      while (this.openFiles.length > this.maxOpenFiles) {
        const removed = this.openFiles.shift();
        this._saveEditorState(removed);
        this.fileCache.delete(removed);
      }
    }
  }

  /**
   * Ajoute un fichier aux récents
   */
  _addToRecentFiles(path) {
    this.recentFiles = this.recentFiles.filter(p => p !== path);
    this.recentFiles.unshift(path);
    
    if (this.recentFiles.length > MAX_RECENT_FILES) {
      this.recentFiles.pop();
    }

    // Sauvegarder les métadonnées
    this._updateFileMetadata(path, { lastOpened: Date.now() });
  }

  /**
   * Sauvegarde l'état de session
   */
  async _saveSessionState() {
    try {
      const state = {
        openFiles: this.openFiles,
        activeFile: this.activeFile,
        expandedFolders: Array.from(this.expandedFolders),
        recentFiles: this.recentFiles,
        timestamp: Date.now(),
        sessionId: this.currentSessionId
      };

      // Valider l'état
      this._validateSessionState(state);

      localStorage.setItem(
        `${STORAGE_KEYS.EDITOR_STATE}_${this.currentProject.id}`,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn('Erreur sauvegarde état session:', error);
    }
  }

  /**
   * Valide l'état de session
   */
  _validateSessionState(state) {
    const required = ['openFiles', 'activeFile', 'expandedFolders', 'recentFiles'];
    for (const field of required) {
      if (!(field in state)) {
        throw new Error(this._t('SESSION_INVALID'));
      }
    }

    // Filtrer les fichiers qui n'existent plus
    state.openFiles = state.openFiles.filter(path => 
      this.currentProject?.files?.[path] !== undefined
    );

    if (state.activeFile && !this.currentProject?.files?.[state.activeFile]) {
      state.activeFile = state.openFiles[0] || null;
    }

    return state;
  }

  /**
   * Restaure l'état de session
   */
  async _restoreSessionState(projectId) {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEYS.EDITOR_STATE}_${projectId}`);
      
      if (saved) {
        const state = JSON.parse(saved);
        const validated = this._validateSessionState(state);
        
        this.openFiles = validated.openFiles || [];
        this.activeFile = validated.activeFile || null;
        this.expandedFolders = new Set(validated.expandedFolders || []);
        this.recentFiles = validated.recentFiles || [];
        
        // Restaurer les états des éditeurs
        await this._restoreEditorStates(projectId);
        
        console.log('✅ État de session restauré');
      }
    } catch (error) {
      console.warn('Erreur restauration état session:', error);
    }
  }

  /**
   * Restaure les états des éditeurs
   */
  async _restoreEditorStates(projectId) {
    try {
      const allStates = JSON.parse(
        localStorage.getItem(`${STORAGE_KEYS.EDITOR_STATE}_${projectId}_editors`) || '{}'
      );

      Object.entries(allStates).forEach(([path, state]) => {
        if (this.currentProject?.files?.[path]) {
          this.editorStates.set(path, state);
        }
      });
    } catch (error) {
      console.warn('Erreur restauration états éditeurs:', error);
    }
      }
       /**
   * Sauvegarde l'état d'un éditeur
   */
  _saveEditorState(path) {
    try {
      const editorState = this.editorStates.get(path);
      if (!editorState) return;

      const allStates = JSON.parse(
        localStorage.getItem(`${STORAGE_KEYS.EDITOR_STATE}_${this.currentProject.id}_editors`) || '{}'
      );

      allStates[path] = editorState;

      localStorage.setItem(
        `${STORAGE_KEYS.EDITOR_STATE}_${this.currentProject.id}_editors`,
        JSON.stringify(allStates)
      );
    } catch (error) {
      console.warn('Erreur sauvegarde état éditeur:', error);
    }
  }

  /**
   * Lit un fichier avec cache
   */
  async _readFileWithCache(path, forceRefresh = false) {
    const cached = this.fileCache.get(path);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TIMEOUT) {
      return cached.content;
    }

    const content = await fileManager.readFile(path);
    this.fileCache.set(path, {
      content,
      timestamp: Date.now()
    });

    return content;
  }

  /**
   * Ouvre un gros fichier par chunks
   */
  async _openLargeFileInChunks(path) {
    const totalSize = this.currentProject.files[path]?.length || 0;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    
    this.loadingChunks.set(path, {
      loaded: 0,
      total: totalChunks,
      content: ''
    });

    const emitProgress = () => {
      const progress = this.loadingChunks.get(path);
      this.emit('fileLoadingProgress', {
        path,
        loaded: progress.loaded * CHUNK_SIZE,
        total: totalSize,
        percentage: (progress.loaded / progress.total) * 100,
        message: this._t('LOADING_CHUNK', progress.loaded, progress.total)
      });
    };

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        
        // Simuler le chargement par chunks - à adapter selon l'API
        const chunk = await fileManager.readFileChunk(path, start, end);
        
        const progress = this.loadingChunks.get(path);
        progress.loaded = i + 1;
        progress.content += chunk;
        
        emitProgress();
      }

      const finalContent = this.loadingChunks.get(path).content;
      this.fileCache.set(path, {
        content: finalContent,
        timestamp: Date.now()
      });

      this.loadingChunks.delete(path);
      
      return finalContent;

    } catch (error) {
      this.loadingChunks.delete(path);
      throw error;
    }
  }

  /**
   * Vérifie si un fichier a été modifié
   */
  _isFileDirty(path) {
    const cached = this.fileCache.get(path);
    const original = this.currentProject.files[path];
    return cached && cached.content !== original;
  }

  /**
   * Met à jour les métadonnées d'un fichier
   */
  _updateFileMetadata(path, metadata) {
    if (!this.currentProject.metadata) {
      this.currentProject.metadata = {};
    }
    if (!this.currentProject.metadata.files) {
      this.currentProject.metadata.files = {};
    }
    
    this.currentProject.metadata.files[path] = {
      ...(this.currentProject.metadata.files[path] || {}),
      ...metadata,
      updatedAt: Date.now()
    };
  }

  /**
   * Récupère les métadonnées d'un fichier
   */
  _getFileMetadata(path) {
    return this.currentProject?.metadata?.files?.[path];
  }

  /**
   * Affiche une boîte de dialogue pour les conflits
   */
  async _showConflictDialog(path, sessions) {
    // À implémenter selon l'UI
    return window.confirm(
      this._t('CONCURRENT_EDIT', path) + '\n' +
      `Sessions: ${sessions.map(s => s.metadata.userAgent).join(', ')}`
    );
  }

  /**
   * Confirme l'ouverture d'un gros fichier
   */
  async _confirmOpenLargeFile(size) {
    return window.confirm(
      this._t('LARGE_FILE', (size / (1024 * 1024)).toFixed(1))
    );
  }

  /**
   * Confirme la sauvegarde en cas de conflit
   */
  async _confirmSaveConflict(path) {
    return window.confirm(this._t('SAVE_CONFIRM'));
  }

  /**
   * Gestionnaire d'événement : fichier ouvert
   */
  _handleFileOpened({ path }) {
    console.log(`📄 Fichier ouvert: ${path}`);
  }

  /**
   * Gestionnaire d'événement : fichier fermé
   */
  _handleFileClosed({ path }) {
    console.log(`📄 Fichier fermé: ${path}`);
  }

  /**
   * Gestionnaire d'événement : fichier modifié
   */
  _handleFileChanged({ path }) {
    // Mettre à jour les dépendances, etc.
  }

  /**
   * Détermine le langage depuis l'extension
   */
  _getLanguageFromExt(ext) {
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.json': 'json',
      '.html': 'html',
      '.css': 'css',
      '.md': 'markdown',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };

    return languageMap[ext] || 'text';
  }
  }
// =============================
// HOOK PERSONNALISÉ
// =============================
export const useProjectLoader = (projectId, userId, options = {}) => {
  const [loader, setLoader] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectFiles, setProjectFiles] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(null);
  
  const loaderRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const loaderInstance = new ProjectLoader(options);
        
        // Écouter les événements de progression
        loaderInstance.on('fileLoadingProgress', setLoadingProgress);
        loaderInstance.on('error', ({ error }) => setError(error.message));
        
        await loaderInstance.initialize(projectId, userId, {
          tabId: options.tabId
        });
        
        const files = await loaderInstance.loadProjectFiles();
        
        loaderRef.current = loaderInstance;
        setLoader(loaderInstance);
        setProjectFiles(files.files || []);
        setOpenFiles(loaderInstance.getOpenFiles());
        setActiveFile(loaderInstance.getActiveFile());
        setRecentFiles(loaderInstance.getRecentFiles());
        
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (projectId && userId) {
      init();
    }

    return () => {
      if (loaderRef.current) {
        loaderRef.current.closeAllFiles().catch(console.error);
        loaderRef.current.removeAllListeners();
      }
    };
  }, [projectId, userId, options.language]);

  const openFile = useCallback(async (path, fileOptions = {}) => {
    if (!loaderRef.current) return;
    try {
      const file = await loaderRef.current.openFile(path, fileOptions);
      setOpenFiles(loaderRef.current.getOpenFiles());
      setActiveFile(loaderRef.current.getActiveFile());
      setRecentFiles(loaderRef.current.getRecentFiles());
      return file;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const saveFile = useCallback(async (path, content, saveOptions = {}) => {
    if (!loaderRef.current) return;
    try {
      const result = await loaderRef.current.saveFile(path, content, saveOptions);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const closeFile = useCallback(async (path, closeOptions = {}) => {
    if (!loaderRef.current) return;
    try {
      await loaderRef.current.closeFile(path, closeOptions);
      setOpenFiles(loaderRef.current.getOpenFiles());
      setActiveFile(loaderRef.current.getActiveFile());
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const closeAllFiles = useCallback(async () => {
    if (!loaderRef.current) return;
    try {
      await loaderRef.current.closeAllFiles();
      setOpenFiles([]);
      setActiveFile(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const setEditorState = useCallback((path, state) => {
    if (!loaderRef.current) return;
    loaderRef.current.setEditorState(path, state);
  }, []);

  const getEditorState = useCallback((path) => {
    if (!loaderRef.current) return null;
    return loaderRef.current.getEditorState(path);
  }, []);

  const reloadProject = useCallback(async () => {
    if (!loaderRef.current) return;
    try {
      const result = await loaderRef.current.reloadProject();
      
      // Mettre à jour les fichiers
      const files = await loaderRef.current.loadProjectFiles();
      setProjectFiles(files.files || []);
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getFileVersions = useCallback((path) => {
    if (!loaderRef.current) return [];
    return loaderRef.current.getFileVersions(path);
  }, []);

  const restoreFileVersion = useCallback(async (path, versionId) => {
    if (!loaderRef.current) return;
    try {
      return await loaderRef.current.restoreFileVersion(path, versionId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const compareFileVersions = useCallback((path, version1, version2) => {
    if (!loaderRef.current) return null;
    return loaderRef.current.compareFileVersions(path, version1, version2);
  }, []);

  return {
    // États
    loading,
    error,
    loadingProgress,
    projectFiles,
    openFiles,
    activeFile,
    recentFiles,
    
    // Actions principales
    openFile,
    saveFile,
    closeFile,
    closeAllFiles,
    reloadProject,
    
    // Éditeur
    setEditorState,
    getEditorState,
    
    // Versioning
    getFileVersions,
    restoreFileVersion,
    compareFileVersions,
    
    // Métadonnées
    totalFiles: projectFiles.length,
    totalSize: projectFiles.reduce((sum, f) => sum + f.size, 0)
  };
};

// =============================
// EXPORT
// =============================
export const projectLoader = new ProjectLoader();
export default projectLoader;
