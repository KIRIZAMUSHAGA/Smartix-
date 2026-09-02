/**
 * gitService - Intégration Git pour le versionning (version PRO)
 * 
 * Rôle: Gérer les versions via Git
 * - Commits automatiques
 * - Stockage persistant (IndexedDB)
 * - Vrai diff ligne par ligne
 * - Merge intelligent
 * - Validation sécurité
 */

import { EventEmitter } from 'events';
import { crypto } from '../utils/crypto';

// =============================
// CONFIGURATION
// =============================

const MAX_COMMITS_PER_REPO = 1000;
const MAX_BRANCHES_PER_REPO = 50;
const MAX_TAGS_PER_REPO = 100;
const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

// Patterns de validation
const VALID_NAME = /^[a-zA-Z0-9_\-/]+$/;
const VALID_BRANCH = /^[a-zA-Z0-9_\-/]+$/;
const VALID_TAG = /^[a-zA-Z0-9_\-]+$/;

// =============================
// STORAGE MANAGER (IndexedDB)
// =============================

class StorageManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('GitService', 2);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Stores
        if (!db.objectStoreNames.contains('repositories')) {
          db.createObjectStore('repositories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('commits')) {
          const commitStore = db.createObjectStore('commits', { keyPath: 'hash' });
          commitStore.createIndex('projectId', 'projectId', { unique: false });
          commitStore.createIndex('branch', 'branch', { unique: false });
          commitStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('commitHash', 'commitHash', { unique: false });
          fileStore.createIndex('path', 'path', { unique: false });
        }
        if (!db.objectStoreNames.contains('branches')) {
          const branchStore = db.createObjectStore('branches', { keyPath: 'id' });
          branchStore.createIndex('projectId', 'projectId', { unique: false });
          branchStore.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.initialized = true;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async get(store, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([store], 'readonly');
      const request = tx.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(store, index = null, value = null) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([store], 'readonly');
      const objectStore = tx.objectStore(store);
      const request = index 
        ? objectStore.index(index).getAll(value)
        : objectStore.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(store, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([store], 'readwrite');
      const request = tx.objectStore(store).put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(store, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([store], 'readwrite');
      const request = tx.objectStore(store).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(store) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([store], 'readwrite');
      const request = tx.objectStore(store).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// =============================
// DIFF ENGINE
// =============================

class DiffEngine {
  /**
   * Calcule le diff entre deux versions
   */
  static compute(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const diff = [];
    let i = 0, j = 0;
    
    while (i < oldLines.length || j < newLines.length) {
      if (i >= oldLines.length) {
        diff.push({ type: 'add', line: j + 1, content: newLines[j] });
        j++;
      } else if (j >= newLines.length) {
        diff.push({ type: 'remove', line: i + 1, content: oldLines[i] });
        i++;
      } else if (oldLines[i] === newLines[j]) {
        diff.push({ type: 'same', line: i + 1, content: oldLines[i] });
        i++; j++;
      } else {
        // Chercher la prochaine correspondance
        const nextInOld = newLines.slice(j).findIndex(l => l === oldLines[i]);
        const nextInNew = oldLines.slice(i).findIndex(l => l === newLines[j]);
        
        if (nextInNew >= 0 && (nextInOld === -1 || nextInNew < nextInOld)) {
          diff.push({ type: 'add', line: j + 1, content: newLines[j] });
          j++;
        } else if (nextInOld >= 0) {
          diff.push({ type: 'remove', line: i + 1, content: oldLines[i] });
          i++;
        } else {
          diff.push({ type: 'replace', oldLine: i + 1, newLine: j + 1, 
                      oldContent: oldLines[i], newContent: newLines[j] });
          i++; j++;
        }
      }
    }
    
    return diff;
  }

  /**
   * Applique un diff
   */
  static apply(content, diff) {
    const lines = content.split('\n');
    const result = [];
    
    for (const change of diff) {
      switch (change.type) {
        case 'same':
          result.push(change.content);
          break;
        case 'add':
          result.push(change.content);
          break;
        case 'remove':
          // Ne rien ajouter
          break;
        case 'replace':
          result.push(change.newContent);
          break;
      }
    }
    
    return result.join('\n');
  }

  /**
   * Fusionne deux fichiers avec détection de conflits
   */
  static merge(baseContent, sourceContent, targetContent) {
    const sourceDiff = this.compute(baseContent, sourceContent);
    const targetDiff = this.compute(baseContent, targetContent);
    
    const conflicts = [];
    const merged = [];
    const baseLines = baseContent.split('\n');
    
    let sourceIdx = 0, targetIdx = 0;
    
    while (sourceIdx < sourceDiff.length || targetIdx < targetDiff.length) {
      const sourceChange = sourceDiff[sourceIdx];
      const targetChange = targetDiff[targetIdx];
      
      if (!sourceChange) {
        merged.push(targetChange);
        targetIdx++;
      } else if (!targetChange) {
        merged.push(sourceChange);
        sourceIdx++;
      } else if (sourceChange.type === 'same' && targetChange.type === 'same') {
        merged.push(sourceChange);
        sourceIdx++; targetIdx++;
      } else if (sourceChange.type !== 'same' && targetChange.type !== 'same') {
        // Conflit potentiel
        conflicts.push({
          line: sourceChange.line,
          source: sourceChange,
          target: targetChange
        });
        sourceIdx++; targetIdx++;
      } else {
        // Un seul côté a changé
        merged.push(sourceChange.type !== 'same' ? sourceChange : targetChange);
        sourceIdx++; targetIdx++;
      }
    }
    
    return { merged, conflicts };
  }
}

// =============================
// GIT SERVICE
// =============================

export class GitService extends EventEmitter {
  constructor() {
    super();
    this.available = true;
    this.storage = new StorageManager();
    this.stats = {
      totalCommits: 0,
      totalBranches: 0,
      totalTags: 0,
      activeRepos: 0
    };
  }

  /**
   * Initialise le service
   */
  async initialize() {
    await this.storage.initialize();
    await this._loadStats();
    console.log('✅ GitService initialisé');
  }

  /**
   * Vérifie si Git est disponible
   */
  isAvailable() {
    return this.available;
  }

  /**
   * Active le service
   */
  enable() {
    this.available = true;
    console.log('✅ GitService activé');
    this.emit('status-changed', { available: true });
  }

  /**
   * Désactive le service
   */
  disable() {
    this.available = false;
    console.log('⚠️ GitService désactivé');
    this.emit('status-changed', { available: false });
  }

  /**
   * Initialise un dépôt
   */
  async init(projectId, options = {}) {
    // Validation sécurité
    if (!VALID_NAME.test(projectId)) {
      throw new Error('Project ID invalide');
    }

    const {
      userId = 'system',
      defaultBranch = 'main',
      description = '',
      remote = null
    } = options;

    // Vérifier si le repo existe déjà
    const existing = await this.storage.get('repositories', projectId);
    if (existing) {
      return {
        success: true,
        projectId,
        message: 'Repository already exists'
      };
    }

    const timestamp = Date.now();
    const repo = {
      id: projectId,
      userId,
      created: timestamp,
      updated: timestamp,
      description: this._sanitize(description),
      defaultBranch,
      currentBranch: defaultBranch,
      branches: [{
        id: `${projectId}:${defaultBranch}`,
        projectId,
        name: defaultBranch,
        head: null,
        created: timestamp,
        files: []
      }],
      tags: [],
      remotes: remote ? { origin: remote } : {},
      stats: {
        commits: 0,
        branches: 1,
        tags: 0
      },
      metadata: options.metadata || {}
    };

    await this.storage.put('repositories', repo);
    
    // Ajouter la branche
    await this.storage.put('branches', repo.branches[0]);

    this.stats.activeRepos++;
    console.log(`📦 Repository initialisé pour ${projectId}`);
    this.emit('repository:init', { projectId, repo });

    return {
      success: true,
      projectId,
      defaultBranch,
      repository: this._sanitizeRepo(repo)
    };
  }

  /**
   * Crée un commit
   */
  async commit(projectId, message, options = {}) {
    if (!this.available) {
      throw new Error('Git service is not available');
    }

    // Validation sécurité
    this._validateInput({ projectId, message });

    const repo = await this._getRepo(projectId);
    const {
      userId = 'system',
      files = {},
      author = null,
      branch = repo.currentBranch,
      parent = null
    } = options;

    // Vérifier la limite
    const commits = await this.storage.getAll('commits', 'projectId', projectId);
    if (commits.length >= MAX_COMMITS_PER_REPO) {
      throw new Error('Maximum commits reached for this repository');
    }

    // Valider les fichiers
    for (const [path, content] of Object.entries(files)) {
      if (!VALID_NAME.test(path)) {
        throw new Error(`Invalid file path: ${path}`);
      }
      if (content.length > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${path}`);
      }
    }

    // Générer un hash unique
    const timestamp = Date.now();
    const random = crypto.randomToken(8);
    const hash = await this._generateCommitHash(projectId, message, timestamp, random);

    // Récupérer le parent
    const parentCommit = parent || repo.branches.find(b => b.name === branch)?.head;
    const parentCommitData = parentCommit 
      ? await this.getCommit(projectId, parentCommit)
      : null;

    // Calculer les stats
    const stats = await this._computeStats(parentCommitData, files);

    // Sauvegarder les fichiers
    const fileIds = [];
    for (const [path, content] of Object.entries(files)) {
      const fileId = `${hash}:${path}`;
      await this.storage.put('files', {
        id: fileId,
        commitHash: hash,
        path,
        content,
        size: content.length
      });
      fileIds.push(fileId);
    }

    // Créer le commit
    const commit = {
      hash,
      shortHash: hash.substring(0, 7),
      projectId,
      message: this._sanitize(message),
      author: {
        name: author?.name || 'Vibe-Coding',
        email: author?.email || 'system@vibecoding.dev',
        userId,
        timestamp
      },
      parent: parentCommit,
      branch,
      files: Object.keys(files),
      fileIds,
      stats,
      metadata: {
        automatic: options.automatic || false,
        source: options.source || 'user'
      },
      createdAt: timestamp
    };

    await this.storage.put('commits', commit);

    // Mettre à jour la branche
    const branchObj = repo.branches.find(b => b.name === branch);
    if (branchObj) {
      branchObj.head = hash;
      await this.storage.put('branches', branchObj);
    }

    // Mettre à jour le repo
    repo.updated = timestamp;
    repo.stats.commits++;
    await this.storage.put('repositories', repo);

    this.stats.totalCommits++;
    console.log(`📝 Commit créé: ${message} (${hash.substring(0, 7)})`);
    this.emit('commit:created', { projectId, commit });

    return {
      success: true,
      hash,
      shortHash: hash.substring(0, 7),
      message,
      branch,
      stats
    };
  }

  /**
   * Récupère un commit
   */
  async getCommit(projectId, commitHash) {
    const commit = await this.storage.get('commits', commitHash);
    if (!commit || commit.projectId !== projectId) return null;
    
    // Charger les fichiers
    const files = [];
    for (const fileId of commit.fileIds || []) {
      const file = await this.storage.get('files', fileId);
      if (file) files.push(file);
    }
    
    return { ...commit, files };
  }

  /**
   * Récupère le contenu d'un fichier à un commit
   */
  async getFileContent(projectId, commitHash, filePath) {
    const fileId = `${commitHash}:${filePath}`;
    const file = await this.storage.get('files', fileId);
    return file?.content || null;
  }

  /**
   * Récupère l'historique
   */
  async log(projectId, options = {}) {
    const {
      limit = 20,
      branch = null,
      author = null,
      since = null,
      until = null
    } = options;

    let commits = await this.storage.getAll('commits', 'projectId', projectId);

    // Filtrer par branche
    if (branch) {
      commits = commits.filter(c => c.branch === branch);
    }

    // Filtrer par auteur
    if (author) {
      commits = commits.filter(c => c.author.userId === author);
    }

    // Filtrer par date
    if (since) {
      commits = commits.filter(c => c.createdAt >= since);
    }
    if (until) {
      commits = commits.filter(c => c.createdAt <= until);
    }

    // Trier du plus récent au plus ancien
    commits.sort((a, b) => b.createdAt - a.createdAt);

    return commits.slice(0, limit).map(c => ({
      hash: c.hash,
      shortHash: c.shortHash,
      message: c.message,
      author: c.author.name,
      date: new Date(c.createdAt).toISOString(),
      branch: c.branch,
      stats: c.stats
    }));
  }

  /**
   * Diff entre deux commits
   */
  async diff(projectId, fromCommit, toCommit = null) {
    const from = await this.getCommit(projectId, fromCommit);
    if (!from) throw new Error(`Commit ${fromCommit} not found`);

    let to;
    if (toCommit) {
      to = await this.getCommit(projectId, toCommit);
      if (!to) throw new Error(`Commit ${toCommit} not found`);
    } else {
      // HEAD
      const repo = await this._getRepo(projectId);
      const headHash = repo.branches.find(b => b.name === repo.currentBranch)?.head;
      to = headHash ? await this.getCommit(projectId, headHash) : from;
    }

    const files = new Set([...from.files, ...to.files]);
    const diffs = [];

    for (const filePath of files) {
      const oldContent = await this.getFileContent(projectId, from.hash, filePath) || '';
      const newContent = await this.getFileContent(projectId, to.hash, filePath) || '';
      
      if (oldContent !== newContent) {
        diffs.push({
          file: filePath,
          type: !oldContent ? 'added' : !newContent ? 'deleted' : 'modified',
          diff: DiffEngine.compute(oldContent, newContent)
        });
      }
    }

    return {
      from: from.hash,
      to: to.hash,
      files: diffs,
      stats: {
        additions: diffs.reduce((acc, d) => acc + d.diff.filter(c => c.type === 'add').length, 0),
        deletions: diffs.reduce((acc, d) => acc + d.diff.filter(c => c.type === 'remove').length, 0),
        modified: diffs.filter(d => d.type === 'modified').length
      }
    };
  }

  /**
   * Crée une branche
   */
  async branch(projectId, branchName, options = {}) {
    // Validation
    if (!VALID_BRANCH.test(branchName)) {
      throw new Error(`Invalid branch name: ${branchName}`);
    }

    const repo = await this._getRepo(projectId);
    const {
      from = repo.currentBranch,
      checkout = false
    } = options;

    if (repo.branches.some(b => b.name === branchName)) {
      throw new Error(`Branch ${branchName} already exists`);
    }

    if (repo.branches.length >= MAX_BRANCHES_PER_REPO) {
      throw new Error('Maximum branches reached');
    }

    const sourceBranch = repo.branches.find(b => b.name === from);
    if (!sourceBranch) {
      throw new Error(`Source branch ${from} not found`);
    }

    const newBranch = {
      id: `${projectId}:${branchName}`,
      projectId,
      name: branchName,
      head: sourceBranch.head,
      created: Date.now()
    };

    repo.branches.push(newBranch);
    repo.stats.branches++;

    await this.storage.put('branches', newBranch);
    await this.storage.put('repositories', repo);

    if (checkout) {
      repo.currentBranch = branchName;
      await this.storage.put('repositories', repo);
    }

    this.stats.totalBranches++;
    console.log(`🌿 Branche créée: ${branchName}`);
    this.emit('branch:created', { projectId, branch: branchName });

    return {
      success: true,
      branch: branchName,
      from,
      current: checkout
    };
  }

  /**
   * Fusionne deux branches
   */
  async merge(projectId, sourceBranch, options = {}) {
    const repo = await this._getRepo(projectId);
    const {
      targetBranch = repo.currentBranch,
      message = `Merge branch '${sourceBranch}' into ${targetBranch}`,
      strategy = 'merge-commit'
    } = options;

    const source = repo.branches.find(b => b.name === sourceBranch);
    const target = repo.branches.find(b => b.name === targetBranch);

    if (!source) throw new Error(`Source branch ${sourceBranch} not found`);
    if (!target) throw new Error(`Target branch ${targetBranch} not found`);

    // Récupérer le point de divergence
    const base = await this._findMergeBase(projectId, source.head, target.head);
    
    // Récupérer les fichiers aux trois points
    const baseFiles = await this._getFilesAtCommit(projectId, base);
    const sourceFiles = await this._getFilesAtCommit(projectId, source.head);
    const targetFiles = await this._getFilesAtCommit(projectId, target.head);

    // Fusionner chaque fichier
    const mergedFiles = {};
    const conflicts = [];
    const allPaths = new Set([...Object.keys(baseFiles), ...Object.keys(sourceFiles), ...Object.keys(targetFiles)]);

    for (const path of allPaths) {
      const base = baseFiles[path] || '';
      const source = sourceFiles[path] || '';
      const target = targetFiles[path] || '';

      if (source === target) {
        // Les deux branches ont la même version
        mergedFiles[path] = source || target;
      } else if (source === base) {
        // Seule target a changé
        mergedFiles[path] = target;
      } else if (target === base) {
        // Seule source a changé
        mergedFiles[path] = source;
      } else {
            // Les deux ont changé
        const { merged, conflicts: fileConflicts } = DiffEngine.merge(base, source, target);
        
        if (fileConflicts.length > 0) {
          conflicts.push({ path, conflicts: fileConflicts });
          mergedFiles[path] = source; // Garder la version source en attendant résolution
        } else {
          mergedFiles[path] = DiffEngine.apply(base, merged);
        }
      }
    }

    // Créer le commit de merge
    const mergeCommit = await this.commit(projectId, message, {
      files: mergedFiles,
      branch: targetBranch,
      parent: source.head,
      metadata: {
        type: 'merge',
        source: sourceBranch,
        target: targetBranch,
        conflicts: conflicts.length
      }
    });

    this.emit('branch:merged', {
      projectId,
      source: sourceBranch,
      target: targetBranch,
      commit: mergeCommit,
      conflicts
    });

    return {
      success: true,
      mergeCommit,
      conflicts,
      files: mergedFiles
    };
  }

  /**
   * Charge les stats depuis le storage
   */
  async _loadStats() {
    const repos = await this.storage.getAll('repositories');
    const commits = await this.storage.getAll('commits');
    const branches = await this.storage.getAll('branches');
    const tags = await this.storage.getAll('tags');

    this.stats = {
      activeRepos: repos.length,
      totalCommits: commits.length,
      totalBranches: branches.length,
      totalTags: tags.length
    };
  }

  /**
   * Calcule les stats d'un commit
   */
  async _computeStats(parentCommit, files) {
    if (!parentCommit) {
      return {
        additions: Object.keys(files).length,
        deletions: 0,
        total: Object.keys(files).length
      };
    }

    const parentFiles = new Set(parentCommit.files || []);
    const currentFiles = new Set(Object.keys(files));

    let additions = 0;
    let deletions = 0;

    for (const file of currentFiles) {
      if (!parentFiles.has(file)) additions++;
    }

    for (const file of parentFiles) {
      if (!currentFiles.has(file)) deletions++;
    }

    return {
      additions,
      deletions,
      total: currentFiles.size
    };
  }

  /**
   * Trouve le point de divergence
   */
  async _findMergeBase(projectId, commitA, commitB) {
    const historyA = await this._getHistory(projectId, commitA);
    const historyB = await this._getHistory(projectId, commitB);

    const setA = new Set(historyA);
    for (const commit of historyB) {
      if (setA.has(commit)) return commit;
    }

    return null;
  }

  /**
   * Récupère l'historique jusqu'à un commit
   */
  async _getHistory(projectId, commitHash) {
    const history = [];
    let current = await this.getCommit(projectId, commitHash);

    while (current) {
      history.push(current.hash);
      current = current.parent ? await this.getCommit(projectId, current.parent) : null;
    }

    return history;
  }

  /**
   * Récupère tous les fichiers d'un commit
   */
  async _getFilesAtCommit(projectId, commitHash) {
    if (!commitHash) return {};

    const commit = await this.getCommit(projectId, commitHash);
    if (!commit) return {};

    const files = {};
    for (const fileId of commit.fileIds || []) {
      const file = await this.storage.get('files', fileId);
      if (file) files[file.path] = file.content;
    }

    return files;
  }

  /**
   * Récupère un repo avec gestion d'erreur
   */
  async _getRepo(projectId) {
    const repo = await this.storage.get('repositories', projectId);
    if (!repo) {
      throw new Error(`Repository ${projectId} not found`);
    }
    return repo;
  }

  /**
   * Génère un hash de commit
   */
  async _generateCommitHash(projectId, message, timestamp, random) {
    const data = `${projectId}:${message}:${timestamp}:${random}`;
    return await crypto.createHash(data);
  }

  /**
   * Nettoie les entrées pour éviter XSS
   */
  _sanitize(str) {
    if (!str) return str;
    return str
      .replace(/[<>]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Valide les entrées
   */
  _validateInput(input) {
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.includes('<script')) {
        throw new Error(`Invalid ${key}: contains script tag`);
      }
    }
  }

  /**
   * Nettoie un repo pour l'export
   */
  _sanitizeRepo(repo) {
    const { branches, tags, ...rest } = repo;
    return {
      ...rest,
      branches: branches.length,
      tags: tags.length
    };
  }
}

export const gitService = new GitService();
export default gitService;
