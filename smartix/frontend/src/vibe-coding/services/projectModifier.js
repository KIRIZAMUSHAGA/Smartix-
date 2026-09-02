/**
 * projectModifier - Service de modification des fichiers projet (version PRO)
 * 
 * Rôle: Modifier les fichiers du projet en toute sécurité
 * - Backups persistants (IndexedDB)
 * - Historique par projet
 * - Contrôle de concurrence
 * - Validation multi-niveaux
 * - Patches au lieu de fichiers complets
 * - Snapshot projet
 * - Sécurité renforcée
 * - Intégration avec linter et securityAnalyzer
 */

import { EventEmitter } from 'events';
import { projectManager } from '../core/projectManager';
import { linter } from './linter';
import { securityAnalyzer } from './securityAnalyzer';
import { gitService } from './gitService';
import { parser } from './parser';
import { crypto } from '../utils/crypto';

// =============================
// CONFIGURATION
// =============================

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const MAX_BACKUPS_PER_FILE = 10;
const MAX_HISTORY_PER_PROJECT = 100;
const MAX_SNAPSHOTS_PER_PROJECT = 20;
const AI_CHANGE_THRESHOLD = 0.8; // 80% = seuil d'alerte

// Fichiers sensibles (nécessitent validation supplémentaire)
const SENSITIVE_FILES = [
  /auth\.js$/,
  /crypto\.js$/,
  /database\.js$/,
  /config\.js$/,
  /\.env$/,
  /passport/i,
  /security/i
];

// =============================
// INDEXEDDB STORAGE MANAGER
// =============================

class StorageManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ProjectModifier', 2);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Stores
        if (!db.objectStoreNames.contains('backups')) {
          const backupStore = db.createObjectStore('backups', { keyPath: 'id' });
          backupStore.createIndex('projectId', 'projectId', { unique: false });
          backupStore.createIndex('filePath', 'filePath', { unique: false });
          backupStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id' });
          historyStore.createIndex('projectId', 'projectId', { unique: false });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' });
          snapshotStore.createIndex('projectId', 'projectId', { unique: false });
          snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('locks')) {
          db.createObjectStore('locks', { keyPath: 'projectId' });
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
// QUEUE IMPLEMENTATION
// =============================

class SimpleQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.queue = [];
    this.running = 0;
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._next();
    });
  }

  async _next() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    this.running++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this._next();
    }
  }

  clear() {
    this.queue = [];
  }

  get size() {
    return this.queue.length;
  }
}

// =============================
// PATCH ENGINE
// =============================

class PatchEngine {
  /**
   * Applique un patch à un contenu
   */
  static apply(content, patch) {
    const { startLine, endLine, replacement } = patch;
    const lines = content.split('\n');
    
    // Valider les indices
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      throw new Error('Patch invalide: lignes hors limites');
    }

    // Remplacer les lignes
    const newLines = [
      ...lines.slice(0, startLine - 1),
      replacement,
      ...lines.slice(endLine)
    ];

    return newLines.join('\n');
  }

  /**
   * Génère un diff entre deux contenus
   */
  static generateDiff(oldContent, newContent) {
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
          diff.push({ 
            type: 'replace', 
            oldLine: i + 1, 
            newLine: j + 1, 
            oldContent: oldLines[i], 
            newContent: newLines[j] 
          });
          i++; j++;
        }
      }
    }
    
    return diff;
  }

  /**
   * Crée un patch depuis un diff
   */
  static createPatch(content, diff) {
    const lines = content.split('\n');
    const patches = [];
    let offset = 0;

    for (const change of diff) {
      switch (change.type) {
        case 'replace':
          patches.push({
            startLine: change.oldLine + offset,
            endLine: change.oldLine + offset,
            replacement: change.newContent
          });
          break;
        case 'add':
          patches.push({
            startLine: change.line + offset,
            endLine: change.line + offset - 1,
            replacement: change.content
          });
          offset++;
          break;
        case 'remove':
          patches.push({
            startLine: change.line + offset,
            endLine: change.line + offset,
            replacement: ''
          });
          offset--;
          break;
      }
    }

    return patches;
  }
}

// =============================
// MAIN CLASS
// =============================

export class ProjectModifier extends EventEmitter {
  constructor() {
    super();
    this.storage = new StorageManager();
    this.queue = new SimpleQueue(1);
    this.locks = new Map();
    this.projectVersions = new Map();
    this.stats = {
      totalModifications: 0,
      totalBackups: 0,
      totalSnapshots: 0,
      activeLocks: 0
    };
  }

  /**
   * Initialise le service
   */
  async initialize() {
    await this.storage.initialize();
    await this._loadStats();
    console.log('✅ ProjectModifier initialisé');
  }

  /**
   * Lit le contenu d'un fichier
   */
  async readFile(filePath, options = {}) {
    const { userId, projectId } = options;

    if (!projectId || !userId) {
      throw new Error('projectId et userId requis');
    }

    const project = await this._getProject(projectId, userId);
    if (!project) {
      throw new Error('Projet non trouvé');
    }

    const content = project.files?.[filePath];

    return {
      content,
      version: this.projectVersions.get(projectId) || 1,
      exists: content !== undefined
    };
  }

  /**
   * Met à jour un fichier avec patch (recommandé)
   */
  async patchFile(filePath, patch, options = {}) {
    const {
      userId,
      projectId,
      description = 'Patch automatique',
      expectedVersion,
      autoCommit = true,
      skipValidation = false,
      skipSecurity = false
    } = options;

    if (!projectId || !userId) {
      throw new Error('projectId et userId requis');
    }

    return this.queue.add(async () => {
      // 1. Vérifier le verrou
      if (this.locks.get(projectId)) {
        throw new Error('Projet verrouillé');
      }
      this.locks.set(projectId, true);
      this.stats.activeLocks++;

      try {
        // 2. Récupérer le projet et vérifier la version
        const project = await this._getProject(projectId, userId);
        if (!project) {
          throw new Error('Projet non trouvé');
        }

        const currentVersion = this.projectVersions.get(projectId) || 1;
        if (expectedVersion && currentVersion !== expectedVersion) {
          throw new Error(`Conflit de version: attendu ${expectedVersion}, reçu ${currentVersion}`);
        }

        // 3. Lire l'ancien contenu
        const oldContent = project.files?.[filePath];
        if (!oldContent && !options.allowCreate) {
          throw new Error(`Fichier ${filePath} non trouvé`);
        }

        // 4. Vérifier la taille du patch
        if (patch.replacement && patch.replacement.length > MAX_FILE_SIZE) {
          throw new Error(`Patch trop volumineux: ${patch.replacement.length} > ${MAX_FILE_SIZE}`);
        }

        // 5. Appliquer le patch
        const newContent = oldContent 
          ? PatchEngine.apply(oldContent, patch)
          : patch.replacement;

        // 6. Vérifier le taux de changement (protection IA)
        if (oldContent) {
          const changeRate = this._calculateChangeRate(oldContent, newContent);
          if (changeRate > AI_CHANGE_THRESHOLD) {
            throw new Error(`Changement trop important (${Math.round(changeRate * 100)}%)`);
          }
        }

        // 7. Validation multi-niveaux
        if (!skipValidation) {
          await this._validateContent(newContent, filePath, project);
        }

        // 8. Vérifier la sécurité (fichiers sensibles)
        if (!skipSecurity && this._isSensitiveFile(filePath)) {
          await this._validateSecurity(newContent, filePath);
        }

        // 9. Créer backup
        const backupId = await this._createBackup(projectId, filePath, oldContent || '');

        // 10. Mettre à jour le projet
        const updatedFiles = {
          ...project.files,
          [filePath]: newContent
        };

        const updatedProject = await this._updateProject(projectId, updatedFiles, userId);

        // 11. Mettre à jour la version
        const newVersion = currentVersion + 1;
        this.projectVersions.set(projectId, newVersion);

        // 12. Générer le diff
        const diff = oldContent 
          ? PatchEngine.generateDiff(oldContent, newContent)
          : [{ type: 'add', line: 1, content: newContent }];

        // 13. Analyser avec le parser (optionnel)
        let parseResult = null;
        try {
          parseResult = await parser.parseFile(newContent, filePath);
        } catch (e) {
          // Ignorer les erreurs de parsing
        }

        // 14. Enregistrer dans l'historique
        const historyEntry = await this._addToHistory(projectId, {
          id: `hist_${Date.now()}_${crypto.randomToken(6)}`,
          timestamp: Date.now(),
          filePath,
          type: oldContent ? 'patch' : 'create',
          size: newContent.length,
          backupId,
          userId,
          description,
          diff: diff.slice(0, 50), // Limiter pour stockage
          version: newVersion,
          patch,
          metrics: parseResult?.metrics
        });

        this.stats.totalModifications++;

        // 15. Commit Git si demandé
        if (autoCommit && gitService.isAvailable()) {
          await gitService.commit(projectId, `[Vibe-Coding] ${description}`, {
            files: { [filePath]: newContent },
            userId,
            automatic: true
          }).catch(e => console.warn('Git commit failed:', e.message));
        }

        this.emit('file:patched', {
          projectId,
          filePath,
          description,
          version: newVersion,
          backupId
        });

        return {
          project: updatedProject,
          backupId,
          historyId: historyEntry.id,
          newVersion,
          diff,
          parseResult
        };

      } finally {
        this.locks.delete(projectId);
        this.stats.activeLocks--;
      }
    });
  }

  /**
   * Version legacy pour compatibilité
   */
  async updateFile(filePath, newContent, options = {}) {
    const lines = (newContent.match(/\n/g) || []).length + 1;
    return this.patchFile(filePath, {
      startLine: 1,
      endLine: lines,
      replacement: newContent
    }, options);
  }

  /**
   * Crée un snapshot complet du projet
   */
  async createSnapshot(projectId, userId, description = 'Snapshot') {
    const project = await this._getProject(projectId, userId);
    if (!project) {
      throw new Error('Projet non trouvé');
    }

    // Vérifier la limite
    const snapshots = await this.storage.getAll('snapshots', 'projectId', projectId);
    if (snapshots.length >= MAX_SNAPSHOTS_PER_PROJECT) {
      // Supprimer le plus ancien
      const oldest = snapshots.sort((a, b) => a.timestamp - b.timestamp)[0];
      await this.storage.delete('snapshots', oldest.id);
    }

    const snapshotId = `snap_${Date.now()}_${crypto.randomToken(8)}`;
    const snapshot = {
      id: snapshotId,
      projectId,
      userId,
      description,
      files: project.files || {},
      timestamp: Date.now(),
      metadata: {
        version: this.projectVersions.get(projectId) || 1,
        fileCount: Object.keys(project.files || {}).length
      }
    };

    await this.storage.put('snapshots', snapshot);
    this.stats.totalSnapshots++;

    this.emit('snapshot:created', { projectId, snapshotId, description });

    return {
      success: true,
      snapshotId,
      description,
      timestamp: snapshot.timestamp
    };
  }

  /**
   * Restaure un snapshot
   */
  async restoreSnapshot(projectId, snapshotId, userId) {
    const snapshot = await this.storage.get('snapshots', snapshotId);
    
    if (!snapshot || snapshot.projectId !== projectId) {
      throw new Error('Snapshot non trouvé');
    }

    // Créer un backup avant restauration
    const project = await this._getProject(projectId, userId);
    if (project) {
      await this.createSnapshot(projectId, userId, 'Auto-backup avant restauration');
    }

    // Restaurer les fichiers
    const updatedProject = await this._updateProject(projectId, snapshot.files, userId);

    this.emit('snapshot:restored', { projectId, snapshotId });

    return {
      success: true,
      project: updatedProject,
      snapshot: {
        description: snapshot.description,
        timestamp: snapshot.timestamp
      }
    };
  }

  /**
   * Liste les snapshots d'un projet
   */
  async listSnapshots(projectId, limit = 20) {
    const snapshots = await this.storage.getAll('snapshots', 'projectId', projectId);
    
    return snapshots
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(s => ({
        id: s.id,
        description: s.description,
        timestamp: s.timestamp,
        fileCount: s.metadata?.fileCount,
        version: s.metadata?.version
      }));
  }

  /**
   * Récupère l'historique des modifications
   */
  async getModificationHistory(projectId, limit = 20) {
    const history = await this.storage.getAll('history', 'projectId', projectId);
    
    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(h => ({
        id: h.id,
        filePath: h.filePath,
        type: h.type,
        description: h.description,
        timestamp: h.timestamp,
        version: h.version,
        size: h.size,
        metrics: h.metrics
      }));
  }

  /**
   * Récupère les backups d'un fichier
   */
  async getBackups(projectId, filePath) {
    const allBackups = await this.storage.getAll('backups', 'projectId', projectId);
    
    return allBackups
      .filter(b => b.filePath === filePath)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(b => ({
        id: b.id,
        timestamp: b.timestamp,
        size: b.size,
        version: b.version
      }));
  }

  /**
   * Restaure un backup
   */
  async restoreBackup(projectId, filePath, backupId, userId) {
    const backup = await this.storage.get('backups', backupId);
    
    if (!backup || backup.projectId !== projectId || backup.filePath !== filePath) {
      throw new Error('Backup non trouvé');
    }

    return this.updateFile(filePath, backup.content, {
      userId,
      projectId,
      description: `Restauration du backup du ${new Date(backup.timestamp).toLocaleString()}`,
      skipValidation: true // Le backup est déjà validé
    });
  }

  /**
   * Annule la dernière modification
   */
  async undoLastModification(projectId, userId) {
    const history = await this.storage.getAll('history', 'projectId', projectId);
    
    if (history.length === 0) {
      throw new Error('Aucune modification à annuler');
    }

    const lastMod = history.sort((a, b) => b.timestamp - a.timestamp)[0];
    
    if (lastMod.backupId) {
      return this.restoreBackup(projectId, lastMod.filePath, lastMod.backupId, userId);
    }

    throw new Error('Impossible d\'annuler cette modification (pas de backup)');
  }

  /**
   * Validation multi-niveaux
   */
  async _validateContent(content, filePath, project) {
    // 1. Linter
    const lintResult = await linter.check(content, filePath);
    if (!lintResult.valid) {
      throw new Error(`Validation linter échouée:\n${lintResult.errors.join('\n')}`);
    }

    // 2. Parser (vérification syntaxique)
    try {
      await parser.parseFile(content, filePath);
    } catch (error) {
      throw new Error(`Erreur de syntaxe: ${error.message}`);
    }
  }

   /**
   * Validation sécurité pour fichiers sensibles
   */
  async _validateSecurity(content, filePath) {
    const issues = await securityAnalyzer.analyze(content, filePath);
    
    if (issues.critical.length > 0) {
      throw new Error(`Problèmes de sécurité critiques:\n${issues.critical.join('\n')}`);
    }
  }

  /**
   * Vérifie si le fichier est sensible
   */
  _isSensitiveFile(filePath) {
    return SENSITIVE_FILES.some(pattern => pattern.test(filePath));
  }

  /**
   * Calcule le taux de changement
   */
  _calculateChangeRate(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const maxLines = Math.max(oldLines.length, newLines.length);
    if (maxLines === 0) return 0;
    
    let changes = 0;
    
    for (let i = 0; i < maxLines; i++) {
      if (oldLines[i] !== newLines[i]) changes++;
    }
    
    return changes / maxLines;
  }

  /**
   * Crée un backup persistant
   */
  async _createBackup(projectId, filePath, content) {
    const backupId = `backup_${Date.now()}_${crypto.randomToken(8)}`;
    
    const backup = {
      id: backupId,
      projectId,
      filePath,
      content,
      timestamp: Date.now(),
      size: content.length,
      version: this.projectVersions.get(projectId) || 1
    };

    await this.storage.put('backups', backup);
    this.stats.totalBackups++;

    return backupId;
  }

  /**
   * Ajoute à l'historique
   */
  async _addToHistory(projectId, entry) {
    // Limiter la taille de l'historique
    const history = await this.storage.getAll('history', 'projectId', projectId);
    
    if (history.length >= MAX_HISTORY_PER_PROJECT) {
      const oldest = history.sort((a, b) => a.timestamp - b.timestamp)[0];
      await this.storage.delete('history', oldest.id);
    }

    await this.storage.put('history', entry);
    return entry;
  }

  /**
   * Récupère un projet (à surcharger)
   */
  async _getProject(projectId, userId) {
    // Utilise le projectManager réel
    return projectManager.getProjectById(projectId, userId);
  }

  /**
   * Met à jour un projet (à surcharger)
   */
  async _updateProject(projectId, files, userId) {
    // Utilise le projectManager réel
    return projectManager.updateProject(projectId, { files }, userId);
  }

  /**
   * Charge les stats depuis le storage
   */
  async _loadStats() {
    const backups = await this.storage.getAll('backups');
    const history = await this.storage.getAll('history');
    const snapshots = await this.storage.getAll('snapshots');

    this.stats = {
      totalModifications: history.length,
      totalBackups: backups.length,
      totalSnapshots: snapshots.length,
      activeLocks: 0
    };
  }

  /**
   * Récupère les statistiques
   */
  async getStats(projectId = null) {
    if (projectId) {
      const backups = await this.storage.getAll('backups', 'projectId', projectId);
      const history = await this.storage.getAll('history', 'projectId', projectId);
      const snapshots = await this.storage.getAll('snapshots', 'projectId', projectId);

      return {
        modifications: history.length,
        backups: backups.length,
        snapshots: snapshots.length,
        currentVersion: this.projectVersions.get(projectId) || 1,
        isLocked: this.locks.get(projectId) || false
      };
    }

    return {
      ...this.stats,
      queueSize: this.queue.size
    };
  }

  /**
   * Nettoie les anciens backups
   */
  async cleanup(olderThan = 30 * 24 * 60 * 60 * 1000) { // 30 jours
    const cutoff = Date.now() - olderThan;
    const backups = await this.storage.getAll('backups');
    
    let cleaned = 0;
    for (const backup of backups) {
      if (backup.timestamp < cutoff) {
        await this.storage.delete('backups', backup.id);
        cleaned++;
      }
    }

    this.stats.totalBackups -= cleaned;
    console.log(`🧹 ${cleaned} anciens backups nettoyés`);

    return cleaned;
  }

  /**
   * Nettoie toutes les ressources
   */
  cleanup() {
    this.locks.clear();
    this.projectVersions.clear();
    this.queue.clear();
    console.log('🧹 ProjectModifier nettoyé');
  }
}

export const projectModifier = new ProjectModifier();
export default projectModifier;
