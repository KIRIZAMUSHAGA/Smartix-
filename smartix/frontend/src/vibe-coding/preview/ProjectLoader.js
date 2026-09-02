/**
 * ProjectLoader - Chargement des projets
 */

import fs from 'fs/promises';
import path from 'path';

export default class ProjectLoader {
  constructor(projectId) {
    this.projectId = projectId;
    this.projectPath = path.join(process.cwd(), 'projects', projectId);
    this.cache = new Map();
  }

  async load() {
    try {
      // Charger la configuration
      const config = await this._loadConfig();
      
      // Charger les fichiers
      const files = await this._loadFiles();
      
      return {
        id: this.projectId,
        path: this.projectPath,
        config,
        files,
        dependencies: config.dependencies || {},
        scripts: config.scripts || {}
      };
      
    } catch (error) {
      throw new Error(`Impossible de charger le projet: ${error.message}`);
    }
  }

  async _loadConfig() {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        name: this.projectId,
        version: '1.0.0',
        dependencies: {},
        scripts: {}
      };
    }
  }

  async _loadFiles(dir = this.projectPath, basePath = '') {
    const files = {};
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          if (!this._shouldIgnore(entry.name)) {
            Object.assign(files, await this._loadFiles(fullPath, relativePath));
          }
        } else {
          if (!this._shouldIgnore(entry.name)) {
            const content = await fs.readFile(fullPath, 'utf-8');
            files[relativePath] = content;
          }
        }
      }
    } catch (error) {
      console.warn(`Erreur chargement fichiers: ${error.message}`);
    }
    
    return files;
  }

  _shouldIgnore(name) {
    const ignored = ['node_modules', '.git', 'dist', 'build', '.cache'];
    return ignored.includes(name) || name.startsWith('.');
  }
}
