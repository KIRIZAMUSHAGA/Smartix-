/**
 * Gestionnaire de fichiers pour le module Vibe-Coding
 */

import { projectManager } from '../core/projectManager';
import { generateFileId } from '../utils/idGenerator';

// =============================
// CONFIGURATION
// =============================

const FORBIDDEN_EXTENSIONS = ['.exe', '.sh', '.bat', '.cmd', '.bin'];

const MAX_FILE_SIZE = {
  '.js': 5 * 1024 * 1024,
  '.jsx': 5 * 1024 * 1024,
  '.ts': 5 * 1024 * 1024,
  '.tsx': 5 * 1024 * 1024,
  '.json': 2 * 1024 * 1024,
  '.html': 1 * 1024 * 1024,
  '.css': 1 * 1024 * 1024,
  '.md': 1 * 1024 * 1024,
  default: 1 * 1024 * 1024
};

// =============================
// CLASSE FILE MANAGER
// =============================

class FileManager {
  constructor() {
    this.initialized = false;
    this.fileCache = new Map();
    this.recentFiles = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('✅ FileManager initialized');
  }

  // =============================
  // VALIDATION
  // =============================

  validateFileName(fileName) {
    const errors = [];

    if (!fileName || fileName.trim() === '') {
      errors.push('Le nom du fichier est requis');
      return { isValid: false, errors };
    }

    if (fileName.startsWith('.')) {
      errors.push("Les fichiers cachés ne sont pas autorisés");
    }

    if (fileName.includes('/') || fileName.includes('\\')) {
      errors.push('Le nom ne peut pas contenir de slash');
    }

    if (fileName.includes('..')) {
      errors.push('Le nom ne peut pas contenir ".."');
    }

    if (fileName.length > 255) {
      errors.push('Le nom est trop long');
    }

    const forbiddenChars = /[<>:"|?*]/;
    if (forbiddenChars.test(fileName)) {
      errors.push('Caractères interdits');
    }

    const ext = fileName.substring(fileName.lastIndexOf('.'));
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      errors.push(`Extension ${ext} interdite`);
    }

    return { isValid: errors.length === 0, errors };
  }

  validatePath(path) {
    const errors = [];

    if (!path || path.trim() === '') {
      errors.push('Chemin requis');
      return { isValid: false, errors };
    }

    if (path.includes('//')) {
      errors.push('Double slash détecté');
    }

    return { isValid: errors.length === 0, errors };
  }

  validateContent(content, fileName) {
    const errors = [];

    const size = new TextEncoder().encode(content).length;

    const ext = fileName.substring(fileName.lastIndexOf('.'));
    const maxSize = MAX_FILE_SIZE[ext] || MAX_FILE_SIZE.default;

    if (size > maxSize) {
      errors.push(`Fichier trop volumineux`);
    }

    return { isValid: errors.length === 0, errors, size };
  }

  // =============================
  // DÉTECTION LANGAGE MONACO
  // =============================

  detectLanguage(fileName) {
    const ext = fileName.split('.').pop();

    const map = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      css: 'css',
      md: 'markdown'
    };

    return map[ext] || 'plaintext';
  }

  // =============================
  // CRÉATION FICHIER
  // =============================

  async createFile(projectId, fileName, content = '', userId) {
    const nameValidation = this.validateFileName(fileName);
    if (!nameValidation.isValid) {
      throw new Error(nameValidation.errors.join(', '));
    }

    const project = await projectManager.getProjectById(projectId, userId);
    if (!project) throw new Error('Projet non trouvé');

    const filePath = this._normalizePath(fileName);

    if (project.files?.[filePath]) {
      throw new Error('Fichier déjà existant');
    }

    const contentValidation = this.validateContent(content, fileName);

    const fileId = generateFileId();

    const fileData = {
      id: fileId,
      name: fileName,
      path: filePath,
      content,
      size: contentValidation.size,
      language: this.detectLanguage(fileName),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await projectManager.updateProject(projectId, {
      files: {
        ...project.files,
        [filePath]: fileData
      }
    }, userId);

    this._addToRecent(userId, fileData);

    return fileData;
  }

  // =============================
  // LECTURE
  // =============================

  async readFile(projectId, filePath, userId) {
    const cacheKey = `${projectId}:${filePath}`;

    if (this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey);
    }

    const project = await projectManager.getProjectById(projectId, userId);

    const normalizedPath = this._normalizePath(filePath);

    const file = project.files?.[normalizedPath];

    if (!file) throw new Error('Fichier non trouvé');

    this.fileCache.set(cacheKey, file.content);

    return file.content;
  }

  // =============================
  // UPDATE
  // =============================

  async updateFile(projectId, filePath, content, userId) {
    const project = await projectManager.getProjectById(projectId, userId);

    const normalizedPath = this._normalizePath(filePath);

    const file = project.files?.[normalizedPath];

    if (!file) throw new Error('Fichier non trouvé');

    const validation = this.validateContent(content, file.name);

    const updated = {
      ...file,
      content,
      size: validation.size,
      updatedAt: new Date().toISOString()
    };

    await projectManager.updateProject(projectId, {
      files: {
        ...project.files,
        [normalizedPath]: updated
      }
    }, userId);

    this.fileCache.delete(`${projectId}:${normalizedPath}`);

    return updated;
  }

  // =============================
  // DELETE
  // =============================

  async deleteFile(projectId, filePath, userId) {
    const project = await projectManager.getProjectById(projectId, userId);

    const normalizedPath = this._normalizePath(filePath);

    const { [normalizedPath]: removed, ...remaining } = project.files;

    await projectManager.updateProject(projectId, {
      files: remaining
    }, userId);

    this.fileCache.delete(`${projectId}:${normalizedPath}`);

    return true;
  }

  // =============================
  // RENAME
  // =============================

  async renameFile(projectId, oldPath, newName, userId) {
    const project = await projectManager.getProjectById(projectId, userId);

    const normalizedOldPath = this._normalizePath(oldPath);

    const file = project.files[normalizedOldPath];

    const directory = normalizedOldPath.substring(
      0,
      normalizedOldPath.lastIndexOf('/') + 1
    );

    const newPath = `${directory}${newName}`;

    const newFile = {
      ...file,
      name: newName,
      path: newPath,
      updatedAt: new Date().toISOString()
    };

    const { [normalizedOldPath]: removed, ...rest } = project.files;

    await projectManager.updateProject(projectId, {
      files: {
        ...rest,
        [newPath]: newFile
      }
    }, userId);

    this.fileCache.delete(`${projectId}:${normalizedOldPath}`);

    return newFile;
  }

  // =============================
  // MOVE FILE
  // =============================

  async moveFile(projectId, oldPath, newPath, userId) {
    const project = await projectManager.getProjectById(projectId, userId);

    const file = project.files[oldPath];

    if (!file) throw new Error('Fichier introuvable');

    const updated = {
      ...file,
      path: newPath,
      updatedAt: new Date().toISOString()
    };

    const { [oldPath]: removed, ...rest } = project.files;

    await projectManager.updateProject(projectId, {
      files: {
        ...rest,
        [newPath]: updated
      }
    }, userId);

    this.fileCache.delete(`${projectId}:${oldPath}`);

    return updated;
  }

  // =============================
  // DUPLICATE FILE
  // =============================

  async duplicateFile(projectId, path, userId) {
    const project = await projectManager.getProjectById(projectId, userId);

    const file = project.files[path];

    const newName = `copy-${file.name}`;
    const newPath = path.replace(file.name, newName);

    const copy = {
      ...file,
      id: generateFileId(),
      name: newName,
      path: newPath,
      createdAt: new Date().toISOString()
    };

    await projectManager.updateProject(projectId, {
      files: {
        ...project.files,
        [newPath]: copy
      }
    }, userId);

    return copy;
  }

  // =============================
  // LIST FILES
  // =============================

  async listFiles(projectId, userId) {
    const project = await projectManager.getProjectById(projectId, userId);

    return Object.values(project.files || {});
  }

  // =============================
  // SEARCH
  // =============================

  async searchFiles(projectId, query, userId) {
    const files = await this.listFiles(projectId, userId);

    const lower = query.toLowerCase();

    return files.filter(
      f =>
        f.name.toLowerCase().includes(lower) ||
        f.path.toLowerCase().includes(lower)
    );
  }

  // =============================
  // CACHE
  // =============================

  clearCache() {
    this.fileCache.clear();
  }

  // =============================
  // PRIVATE
  // =============================

  _normalizePath(path) {
    return path
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\/+/g, '/');
  }

  _addToRecent(userId, file) {
    if (!this.recentFiles.has(userId)) {
      this.recentFiles.set(userId, []);
    }

    const recent = this.recentFiles.get(userId);

    const index = recent.findIndex(f => f.path === file.path);
    if (index !== -1) recent.splice(index, 1);

    recent.unshift(file);

    if (recent.length > 50) recent.pop();
  }
}

export const fileManager = new FileManager();

if (typeof window !== 'undefined') {
  fileManager.initialize().catch(console.error);
}

export default fileManager;
