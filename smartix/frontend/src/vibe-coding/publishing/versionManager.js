/**
 * Gestionnaire de versions pour le module Vibe-Coding
 * 
 * Rôle: Gérer les versions des applications
 * - Création de versions (semver)
 * - Historique des versions
 * - Tags (stable, beta, alpha)
 * - Rollback
 * - Comparaison de versions
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { projectManager } from "../core/projectManager";
import { generateVersionId } from "../utils/idGenerator";

// =============================
// CONSTANTES
// =============================

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const VERSION_TYPES = {
  MAJOR: "major",
  MINOR: "minor",
  PATCH: "patch",
  PRE_RELEASE: "prerelease",
};

const VERSION_TAGS = {
  STABLE: "stable",
  BETA: "beta",
  ALPHA: "alpha",
  RC: "rc",
  LATEST: "latest",
};

const VALID_TAGS = new Set(Object.values(VERSION_TAGS));
const VALID_TYPES = new Set(Object.values(VERSION_TYPES));

const MAX_VERSIONS = 200;
const MAX_DESCRIPTION_LENGTH = 500;

// =============================
// CLASSE VERSION MANAGER
// =============================

class VersionManager {
  constructor() {
    this.initialized = false;
    this.currentProject = null;
    this.currentUserId = null;
    this.versions = [];
    this.versionIndex = new Map();
    this.currentVersion = null;
    this.tags = new Map();
  }

  /**
   * Initialise le gestionnaire
   */
  async initialize(projectId, userId) {
    try {
      if (this.initialized && this.currentProject?.id === projectId) return;

      const project = await projectManager.getProjectById(projectId, userId);

      if (!project) throw new Error("Projet non trouvé");

      this.currentProject = project;
      this.currentUserId = userId;

      this.versions = project.versions || [];
      this.currentVersion = project.version || "0.1.0";

      // Valider les versions existantes
      this.versions = this.versions.filter(v => this.validateVersion(v.version).valid);

      this.tags = new Map(Object.entries(project.versionTags || {}));

      this._buildVersionIndex();

      this.initialized = true;

      console.log(`✅ VersionManager initialisé pour ${projectId}`);
    } catch (error) {
      console.error("❌ Erreur initialisation VersionManager:", error);
      throw error;
    }
  }

  /**
   * Construit l'index des versions
   * @private
   */
  _buildVersionIndex() {
    this.versionIndex.clear();
    this.versions.forEach(v => {
      this.versionIndex.set(v.version, v);
    });
  }

  /**
   * Valide une version semver
   */
  validateVersion(version) {
    if (!version || typeof version !== "string") {
      return { valid: false, error: "Version requise" };
    }

    if (!SEMVER_REGEX.test(version)) {
      return { valid: false, error: "Format semver invalide. Utilisez x.y.z (ex: 1.2.3)" };
    }

    return { valid: true };
  }

  /**
   * Compare deux versions semver
   */
  compareSemver(v1, v2) {
    const parse = (v) => {
      const parts = v.split(".");
      return {
        major: parseInt(parts[0]) || 0,
        minor: parseInt(parts[1]) || 0,
        patch: parseInt(parts[2]) || 0
      };
    };

    const a = parse(v1);
    const b = parse(v2);

    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;

    return 0;
  }

  /**
   * Incrémente une version
   */
  incrementVersion(currentVersion, type = VERSION_TYPES.PATCH, preRelease = null) {
    if (!VALID_TYPES.has(type)) {
      throw new Error(`Type d'incrémentation invalide: ${type}`);
    }

    const match = currentVersion.match(SEMVER_REGEX);
    if (!match) throw new Error("Version actuelle invalide");

    let [, major, minor, patch, pre] = match;

    major = parseInt(major);
    minor = parseInt(minor);
    patch = parseInt(patch);

    let newVersion;

    switch (type) {
      case VERSION_TYPES.MAJOR:
        newVersion = `${major + 1}.0.0`;
        break;

      case VERSION_TYPES.MINOR:
        newVersion = `${major}.${minor + 1}.0`;
        break;

      case VERSION_TYPES.PATCH:
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;

      case VERSION_TYPES.PRE_RELEASE:
        if (!pre) {
          const preTag = preRelease || "alpha";
          newVersion = `${major}.${minor}.${patch}-${preTag}.1`;
        } else {
          const parts = pre.split(".");
          const num = parseInt(parts[parts.length - 1]) || 0;
          parts[parts.length - 1] = num + 1;
          newVersion = `${major}.${minor}.${patch}-${parts.join(".")}`;
        }
        break;
    }

    return newVersion;
  }

  /**
   * Valide les options de création
   * @private
   */
  _validateCreateOptions(options) {
    const errors = [];

    if (options.type && !VALID_TYPES.has(options.type)) {
      errors.push(`Type invalide: ${options.type}`);
    }

    if (options.tag && !VALID_TAGS.has(options.tag)) {
      errors.push(`Tag invalide: ${options.tag}`);
    }

    if (options.description && options.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description trop longue (max ${MAX_DESCRIPTION_LENGTH} caractères)`);
    }

    if (options.files && typeof options.files !== "object") {
      errors.push("Les fichiers doivent être un objet");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Crée une nouvelle version
   */
  async createVersion(options = {}) {
    if (!this.initialized) throw new Error("VersionManager non initialisé");

    // Valider les options
    const validation = this._validateCreateOptions(options);
    if (!validation.valid) {
      throw new Error(`Options invalides: ${validation.errors.join(", ")}`);
    }

    const {
      type = VERSION_TYPES.PATCH,
      tag = VERSION_TAGS.LATEST,
      description = "",
      files = null,
      changes = [],
      metadata = {}
    } = options;

    const newVersion = this.incrementVersion(this.currentVersion, type, options.preRelease);

    const versionValidation = this.validateVersion(newVersion);
    if (!versionValidation.valid) throw new Error(versionValidation.error);

    if (this.versionIndex.has(newVersion)) {
      throw new Error(`Version ${newVersion} existe déjà`);
    }

    const versionEntry = {
      id: generateVersionId(),
      version: newVersion,
      tag,
      description: description.trim(),
      createdAt: new Date().toISOString(),
      createdBy: this.currentUserId,
      files: files || this.currentProject.files,
      size: this._calculateSize(files || this.currentProject.files),
      changes: changes.slice(0, 50), // Limiter le nombre de changements
      status: "active",
      metadata: {
        buildId: metadata.buildId || null,
        commitHash: metadata.commitHash || null,
        environment: metadata.environment || "development",
        ...metadata
      }
    };

    this.versions.unshift(versionEntry);
    this.versionIndex.set(newVersion, versionEntry);

    // Limiter le nombre de versions
    if (this.versions.length > MAX_VERSIONS) {
      const removed = this.versions.pop();
      this.versionIndex.delete(removed.version);
    }

    // Trier les versions (plus récente en premier)
    this.versions.sort((a, b) => this.compareSemver(b.version, a.version));

    this.currentVersion = newVersion;
    this.tags.set(tag, newVersion);

    await this._saveVersions();

    return versionEntry;
  }

  /**
   * Récupère une version
   */
  async getVersion(version) {
    if (!this.initialized) throw new Error("VersionManager non initialisé");

    const entry = this.versionIndex.get(version);
    if (!entry) throw new Error(`Version ${version} non trouvée`);

    return { ...entry }; // Retourner une copie
  }

  /**
   * Récupère la version courante
   */
  getCurrentVersion() {
    return this.getVersion(this.currentVersion);
  }

  /**
   * Liste toutes les versions
   */
  listVersions(options = {}) {
    let versions = [...this.versions];

    if (options.tag) {
      versions = versions.filter(v => v.tag === options.tag);
    }

    if (options.limit) {
      versions = versions.slice(0, options.limit);
    }

    if (options.includeFiles === false) {
      versions = versions.map(({ files, ...rest }) => rest);
    }

    return versions;
  }

  /**
   * Effectue un rollback vers une version
   */
  async rollback(version) {
    if (!this.initialized) throw new Error("VersionManager non initialisé");

    const versionEntry = await this.getVersion(version);

    if (!versionEntry.files) {
      throw new Error("Fichiers indisponibles pour rollback");
    }

    try {
      const updatedProject = await projectManager.updateProject(
        this.currentProject.id,
        {
          files: versionEntry.files,
          version: versionEntry.version,
          previousVersion: this.currentVersion,
          lastRollback: new Date().toISOString()
        },
        this.currentUserId
      );

      this.currentProject = updatedProject;
      this.currentVersion = versionEntry.version;

      return {
        success: true,
        rolledBackTo: version,
        previousVersion: versionEntry.version,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Échec du rollback: ${error.message}`);
    }
  }

  /**
   * Compare le contenu de deux versions
   */
  async compareVersionsContent(v1, v2) {
    const version1 = await this.getVersion(v1);
    const version2 = await this.getVersion(v2);

    const files1 = version1.files || {};
    const files2 = version2.files || {};

    const added = [];
    const removed = [];
    const modified = [];

    const paths = new Set([...Object.keys(files1), ...Object.keys(files2)]);

    paths.forEach(path => {
      const c1 = files1[path];
      const c2 = files2[path];

      if (!c1 && c2) added.push(path);
      else if (c1 && !c2) removed.push(path);
      else if (c1 !== c2) modified.push(path);
    });

    return {
      v1,
      v2,
      stats: {
        added: added.length,
        removed: removed.length,
        modified: modified.length,
        total: added.length + removed.length + modified.length
      },
      details: { added, removed, modified },
      semverDiff: this.compareSemver(v1, v2),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Ajoute un tag à une version
   */
  async tagVersion(version, tag) {
    if (!VALID_TAGS.has(tag)) {
      throw new Error(`Tag invalide: ${tag}`);
    }

    const entry = await this.getVersion(version);

    // Mettre à jour le tag
    entry.tag = tag;
    this.tags.set(tag, version);

    await this._saveVersions();

    return { version, tag, updated: true };
  }

  /**
   * Supprime une version
   */
  async deleteVersion(version) {
    const index = this.versions.findIndex(v => v.version === version);

    if (index === -1) throw new Error("Version non trouvée");

    if (version === this.currentVersion) {
      throw new Error("Impossible de supprimer la version courante");
    }

    const removed = this.versions.splice(index, 1)[0];
    this.versionIndex.delete(version);

    // Nettoyer les tags pointant vers cette version
    for (const [tag, v] of this.tags.entries()) {
      if (v === version) this.tags.delete(tag);
    }

    await this._saveVersions();

    return { ...removed, deleted: true };
  }

  /**
   * Recherche des versions
   */
  searchVersions(query) {
    if (!query) return [];

    const lowerQuery = query.toLowerCase();

    return this.versions.filter(v => 
      v.version.includes(query) ||
      v.description?.toLowerCase().includes(lowerQuery) ||
      v.tag?.includes(lowerQuery)
    );
  }

  /**
   * Obtient la dernière version par tag
   */
  getLatestVersion(tag = VERSION_TAGS.LATEST) {
    const version = this.tags.get(tag);
    if (!version) return null;
    return this.versionIndex.get(version) || null;
  }

  /**
   * Sauvegarde les versions dans le projet
   * @private
   */
  async _saveVersions() {
    const tags = {};
    for (const [k, v] of this.tags.entries()) {
      tags[k] = v;
    }

    await projectManager.updateProject(
      this.currentProject.id,
      {
        versions: this.versions,
        version: this.currentVersion,
        versionTags: tags
      },
      this.currentUserId
    );
  }

  /**
   * Calcule la taille des fichiers
   * @private
   */
  _calculateSize(files) {
    if (!files) return 0;
    
    // Optimisation: utiliser reduce avec comptage approximatif
    return Object.values(files).reduce((total, content) => {
      return total + (content?.length || 0) * 2; // Approximation UTF-16
    }, 0);
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    const byTag = {};
    const byMonth = {};

    this.versions.forEach(v => {
      // Par tag
      byTag[v.tag] = (byTag[v.tag] || 0) + 1;

      // Par mois
      const month = v.createdAt.substring(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    return {
      totalVersions: this.versions.length,
      currentVersion: this.currentVersion,
      tags: Object.fromEntries(this.tags),
      distribution: {
        byTag,
        byMonth
      },
      oldestVersion: this.versions[this.versions.length - 1]?.version,
      newestVersion: this.versions[0]?.version
    };
  }

  /**
   * Vérifie si une version est stable
   */
  isStable(version) {
    const entry = this.versionIndex.get(version);
    return entry?.tag === VERSION_TAGS.STABLE;
  }

  /**
   * Vérifie si une mise à jour est disponible
   */
  hasUpdate(currentVersion = this.currentVersion) {
    const latestStable = this.getLatestVersion(VERSION_TAGS.STABLE);
    if (!latestStable) return false;

    return this.compareSemver(latestStable.version, currentVersion) > 0;
  }

  /**
   * Nettoie les anciennes versions
   */
  cleanup(keepCount = 50) {
    if (this.versions.length <= keepCount) return 0;

    const toRemove = this.versions.slice(keepCount);
    toRemove.forEach(v => {
      this.versionIndex.delete(v.version);
    });

    this.versions = this.versions.slice(0, keepCount);
    
    return toRemove.length;
  }
}

// =============================
// HOOK REACT
// =============================

export const useVersionManager = (projectId, userId) => {
  const [manager, setManager] = useState(null);
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialisation
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const vm = new VersionManager();
        await vm.initialize(projectId, userId);

        setManager(vm);
        setVersions(vm.listVersions());
        setCurrentVersion(await vm.getCurrentVersion());

      } catch (err) {
        setError(err.message);
        console.error("Erreur useVersionManager:", err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId && userId) init();
  }, [projectId, userId]);

  // Fonctions d'aide pour mettre à jour l'état
  const refreshVersions = useCallback(async () => {
    if (!manager) return;
    setVersions(manager.listVersions());
    setCurrentVersion(await manager.getCurrentVersion());
  }, [manager]);

  // Actions exposées
  const createVersion = useCallback(async (options) => {
    if (!manager) throw new Error("Manager non initialisé");
    
    try {
      setError(null);
      const version = await manager.createVersion(options);
      await refreshVersions();
      return version;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, refreshVersions]);

  const rollback = useCallback(async (version) => {
    if (!manager) throw new Error("Manager non initialisé");
    
    try {
      setError(null);
      const result = await manager.rollback(version);
      await refreshVersions();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, refreshVersions]);

  const deleteVersion = useCallback(async (version) => {
    if (!manager) throw new Error("Manager non initialisé");
    
    try {
      setError(null);
      const result = await manager.deleteVersion(version);
      await refreshVersions();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, refreshVersions]);

  const tagVersion = useCallback(async (version, tag) => {
    if (!manager) throw new Error("Manager non initialisé");
    
    try {
      setError(null);
      const result = await manager.tagVersion(version, tag);
      await refreshVersions();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [manager, refreshVersions]);

  const compareVersions = useCallback(async (v1, v2) => {
    if (!manager) throw new Error("Manager non initialisé");
    return manager.compareVersionsContent(v1, v2);
  }, [manager]);

  const search = useCallback((query) => {
    if (!manager) return [];
    return manager.searchVersions(query);
  }, [manager]);

  const stats = useMemo(() => {
    return manager?.getStats() || null;
  }, [manager, versions]);

  return {
    // État
    loading,
    error,
    versions,
    currentVersion,
    stats,
    
    // Actions CRUD
    createVersion,
    rollback,
    deleteVersion,
    tagVersion,
    
    // Utilitaires
    compareVersions,
    search,
    hasUpdate: useCallback(() => manager?.hasUpdate() || false, [manager]),
    isStable: useCallback((v) => manager?.isStable(v) || false, [manager]),
    
    // Rafraîchissement
    refresh: refreshVersions
  };
};

// =============================
// EXPORT
// =============================
export const versionManager = new VersionManager();
export default versionManager;
