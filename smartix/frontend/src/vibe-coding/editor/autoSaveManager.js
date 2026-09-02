import { useState, useEffect, useCallback } from 'react';

/**
 * Gestionnaire d'auto-sauvegarde pour le module Vibe-Coding
 */

import { projectManager } from '../core/projectManager';
import { fileManager } from './fileManager';

const DEFAULT_INTERVAL = 30000;
const MAX_HISTORY_SIZE = 50;
const AUTOSAVE_KEY = 'vibe_coding_autosave';

class AutoSaveManager {
  constructor() {
    this.intervals = new Map();
    this.dirtyFiles = new Map();
    this.history = new Map();
    this.pendingSaves = new Map();
    this.lastSaveTime = new Map();
    this.enabled = true;
    this.intervalTime = DEFAULT_INTERVAL;
    this.recoveryData = null;
    this.localSaveDebounce = new Map();
  }

  async initialize() {
    try {
      this._loadRecoveryData();
      console.log('✅ AutoSaveManager initialized');
    } catch (error) {
      console.error('❌ AutoSaveManager initialization failed:', error);
      throw error;
    }
  }

  startAutoSave(projectId, userId) {

    if (!this.enabled) return;

    if (this.intervals.has(projectId)) {
      return;
    }

    const interval = setInterval(() => {
      this._saveDirtyFiles(projectId, userId);
    }, this.intervalTime);

    this.intervals.set(projectId, {
      interval,
      userId,
      startTime: Date.now()
    });

    console.log(`✅ Auto-save started for project ${projectId}`);
  }

  stopAutoSave(projectId) {
    const data = this.intervals.get(projectId);
    if (data) {
      clearInterval(data.interval);
      this.intervals.delete(projectId);
      console.log(`✅ Auto-save stopped for project ${projectId}`);
    }
  }

  markDirty(projectId, filePath, content) {

    if (!this.dirtyFiles.has(projectId)) {
      this.dirtyFiles.set(projectId, new Map());
    }

    const projectDirty = this.dirtyFiles.get(projectId);

    const previousContent = projectDirty.get(filePath)?.content;

    projectDirty.set(filePath, {
      content,
      timestamp: Date.now(),
      previousContent
    });

    const debounceKey = `${projectId}:${filePath}`;

    clearTimeout(this.localSaveDebounce.get(debounceKey));

    const timeout = setTimeout(() => {
      this._saveToLocalStorage(projectId, filePath, content);
    }, 1000);

    this.localSaveDebounce.set(debounceKey, timeout);

    console.log(`📝 File marked dirty: ${filePath}`);
  }

  markClean(projectId, filePath) {

    const projectDirty = this.dirtyFiles.get(projectId);

    if (projectDirty) {

      projectDirty.delete(filePath);

      if (projectDirty.size === 0) {
        this.dirtyFiles.delete(projectId);
      }

    }

    this._removeFromLocalStorage(projectId, filePath);
  }

  isDirty(projectId, filePath) {
    return this.dirtyFiles.get(projectId)?.has(filePath) || false;
  }

  getDirtyFiles(projectId) {

    const projectDirty = this.dirtyFiles.get(projectId);

    if (!projectDirty) return [];

    return Array.from(projectDirty.entries()).map(([path, data]) => ({
      path,
      ...data
    }));

  }

  addToHistory(projectId, filePath, content, message = 'Auto-save') {

    const key = `${projectId}:${filePath}`;

    if (!this.history.has(key)) {
      this.history.set(key, []);
    }

    const fileHistory = this.history.get(key);

    fileHistory.push({
      content,
      timestamp: Date.now(),
      message,
      version: fileHistory.length + 1
    });

    if (fileHistory.length > MAX_HISTORY_SIZE) {
      fileHistory.shift();
    }

  }

  getHistory(projectId, filePath) {

    const key = `${projectId}:${filePath}`;

    return this.history.get(key) || [];

  }

  restoreVersion(projectId, filePath, version) {

    const key = `${projectId}:${filePath}`;

    const fileHistory = this.history.get(key);

    if (!fileHistory) return null;

    const versionData = fileHistory.find(v => v.version === version);

    return versionData?.content || null;

  }

  setInterval(ms) {

    this.intervalTime = ms;

    this.intervals.forEach((data, projectId) => {

      this.stopAutoSave(projectId);

      this.startAutoSave(projectId, data.userId);

    });

  }

  setEnabled(enabled) {

    this.enabled = enabled;

    if (!enabled) {

      this.intervals.forEach((data, projectId) => {

        this.stopAutoSave(projectId);

      });

    }

  }

  async saveNow(projectId, userId) {

    await this._saveDirtyFiles(projectId, userId, true);

  }

  getRecoveryData() {

    return this.recoveryData;

  }

  clearRecoveryData() {

    this.recoveryData = null;

    localStorage.removeItem(AUTOSAVE_KEY);

  }

  async _saveDirtyFiles(projectId, userId, force = false) {

    if (!this.enabled && !force) return;

    const projectDirty = this.dirtyFiles.get(projectId);

    if (!projectDirty || projectDirty.size === 0) return;

    try {

      const project = await projectManager.getProjectById(projectId, userId);

      if (!project) return;

      const updates = {};

      const promises = [];

      for (const [filePath, data] of projectDirty.entries()) {

        if (this.pendingSaves.has(filePath)) continue;

        const lastSave = this.lastSaveTime.get(filePath) || 0;

        if (!force && Date.now() - lastSave < 1000) continue;

        updates[filePath] = data.content;

        this.lastSaveTime.set(filePath, Date.now());

        this.addToHistory(projectId, filePath, data.content);

        const savePromise = fileManager.saveFile(projectId, filePath, data.content)
          .finally(() => {
            this.pendingSaves.delete(filePath);
          });

        this.pendingSaves.set(filePath, savePromise);

        promises.push(savePromise);

      }

      if (Object.keys(updates).length === 0) return;

      await projectManager.updateProject(projectId, {
        files: {
          ...project.files,
          ...updates
        }
      }, userId);

      await Promise.all(promises);

      Object.keys(updates).forEach(filePath => {
        this.markClean(projectId, filePath);
      });

      console.log(`✅ Auto-saved ${Object.keys(updates).length} files for project ${projectId}`);

    } catch (error) {
      console.error('❌ Auto-save error:', error);
    }

  }

  _saveToLocalStorage(projectId, filePath, content) {

    try {

      const key = `${AUTOSAVE_KEY}:${projectId}:${filePath}`;

      const payload = {
        content,
        timestamp: Date.now(),
        projectId,
        filePath
      };

      const json = JSON.stringify(payload);

      if (json.length > 4000000) return;

      localStorage.setItem(key, json);

      this.recoveryData = {
        ...this.recoveryData,
        [projectId]: {
          ...this.recoveryData?.[projectId],
          [filePath]: {
            content,
            timestamp: Date.now()
          }
        }
      };

    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }

  }

  _removeFromLocalStorage(projectId, filePath) {

    try {

      const key = `${AUTOSAVE_KEY}:${projectId}:${filePath}`;

      localStorage.removeItem(key);

      if (this.recoveryData?.[projectId]) {

        delete this.recoveryData[projectId][filePath];

        if (Object.keys(this.recoveryData[projectId]).length === 0) {
          delete this.recoveryData[projectId];
        }

      }

    } catch (error) {

      console.warn('Failed to remove from localStorage:', error);

    }

  }

  _loadRecoveryData() {

    try {

      const recovery = {};

      for (let i = 0; i < localStorage.length; i++) {

        const key = localStorage.key(i);

        if (key?.startsWith(AUTOSAVE_KEY)) {

          try {

            const data = JSON.parse(localStorage.getItem(key));

            if (data && data.projectId && data.filePath) {

              if (!recovery[data.projectId]) {
                recovery[data.projectId] = {};
              }

              recovery[data.projectId][data.filePath] = {
                content: data.content,
                timestamp: data.timestamp
              };

            }

          } catch (e) {}

        }

      }

      this.recoveryData = recovery;

    } catch (error) {

      console.warn('Failed to load recovery data:', error);

    }

  }

  cleanupOldRecoveryData(maxAge = 7 * 24 * 60 * 60 * 1000) {

    const now = Date.now();

    for (let i = localStorage.length - 1; i >= 0; i--) {

      const key = localStorage.key(i);

      if (key?.startsWith(AUTOSAVE_KEY)) {

        try {

          const data = JSON.parse(localStorage.getItem(key));

          if (now - data.timestamp > maxAge) {

            localStorage.removeItem(key);

          }

        } catch (error) {}

      }

    }

  }

}

export const autoSaveManager = new AutoSaveManager();

export default autoSaveManager;
