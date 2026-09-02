/**
 * Module d'empaquetage pour le publishing
 * 
 * Rôle: Préparer le projet pour la publication
 * - Générer les fichiers de build
 * - Créer les archives (ZIP, TAR, GZ)
 * - Optimiser les assets (images, JS, CSS)
 * - Gérer les métadonnées de version
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useState, useEffect, useCallback } from "react";

import { projectManager } from "../core/projectManager";
import { buildService } from "../services/buildService";

// =============================
// CONFIGURATION
// =============================

const ARCHIVE_FORMATS = {
  ZIP: "zip",
  TAR: "tar",
  GZ: "gz",
};

const BUILD_TYPES = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  STAGING: "staging",
};

const IGNORED_EXTENSIONS = new Set([
  ".log",
  ".tmp",
  ".cache",
  ".DS_Store",
  ".pid",
]);

const IGNORED_FOLDERS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".cache",
  ".vscode",
  "coverage",
]);

const MAX_ASSET_SIZE = 10 * 1024 * 1024;

const MINIFIABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".json",
  ".xml",
]);

// =============================
// CLASSE PACKAGING
// =============================

class Packaging {
  constructor() {
    this.initialized = false;
    this.currentPackage = null;
    this.packageHistory = [];
    this.objectUrls = new Set();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.initialized = true;
      console.log("✅ Packaging module initialized");
    } catch (error) {
      console.error("❌ Packaging initialization failed:", error);
      throw error;
    }
  }

  /**
   * Création du package
   */
  async createPackage(projectId, userId, options = {}) {
    if (!projectId || !userId) {
      throw new Error("projectId et userId requis");
    }

    const startTime = Date.now();

    try {
      const {
        format = ARCHIVE_FORMATS.ZIP,
        buildType = BUILD_TYPES.PRODUCTION,
        includeSource = true,
        includeAssets = true,
        optimize = true,
        minify = true,
        maxSize = MAX_ASSET_SIZE,
      } = options;

      const project = await projectManager.getProjectById(projectId, userId);

      if (!project) {
        throw new Error("Projet non trouvé");
      }

      // utilisation du buildService
      if (buildService?.buildProject) {
        await buildService.buildProject(projectId, buildType);
      }

      console.log(`📦 Création du package pour ${project.name}`);

      const files = await this._prepareFiles(project, {
        includeSource,
        includeAssets,
        optimize,
        minify,
        maxSize,
        buildType,
      });

      const totalSize = files.reduce((sum, f) => sum + f.size, 0);

      if (totalSize > maxSize * 10) {
        throw new Error(
          `Package trop volumineux: ${this._formatSize(totalSize)} (max: ${this._formatSize(maxSize * 10)})`
        );
      }

      const metrics = this._calculateMetrics(files);

      const archive = await this._createArchive(files, format);

      const manifest = this._generateManifest(project, metrics, options);

      const packageData = {
        id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        projectName: project.name,
        version: project.version || "1.0.0",
        format,
        buildType,
        files: files.length,
        totalSize,
        compressedSize: archive.size,
        compression: archive.compression,
        manifest,
        createdAt: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      this.currentPackage = packageData;
      this.packageHistory.push(packageData);

      if (this.packageHistory.length > 50) {
        this.packageHistory.shift();
      }

      const downloadUrl = URL.createObjectURL(archive.blob);
      this.objectUrls.add(downloadUrl);

      return {
        ...packageData,
        archive: archive.blob,
        downloadUrl,
      };
    } catch (error) {
      console.error("❌ Erreur createPackage:", error);
      throw error;
    }
  }

  /**
   * Préparation des fichiers
   */
  async _prepareFiles(project, options) {
    const entries = Object.entries(project.files || {});

    const processed = await Promise.all(
      entries.map(([path, content]) =>
        this._processFile(path, content, options)
      )
    );

    return processed.filter(Boolean);
  }

  async _processFile(path, content, options) {
    try {
      if (!content) return null;

      const ext = path.substring(path.lastIndexOf("."));

      if (IGNORED_EXTENSIONS.has(ext)) return null;

      const parts = path.split("/");

      if (parts.some((p) => IGNORED_FOLDERS.has(p))) return null;

      const fileType = this._getFileType(ext);

      if (fileType === "asset" && !options.includeAssets) return null;
      if (fileType === "source" && !options.includeSource) return null;

      const realSize = new Blob([content]).size;

      if (realSize > options.maxSize) {
        console.warn(`⚠️ Fichier ignoré (trop volumineux): ${path} (${this._formatSize(realSize)})`);
        return null;
      }

      let processedContent = content;
      let processedPath = path;

      if (options.optimize) {
        processedContent = await this._optimizeFile(content, ext, path);
      }

      if (options.minify && MINIFIABLE_EXTENSIONS.has(ext)) {
        processedContent = await this._minifyFile(processedContent, ext, path);
      }

      if (options.buildType === BUILD_TYPES.PRODUCTION) {
        processedPath = this._transformPathForProduction(path);
      }

      return {
        path: processedPath,
        originalPath: path,
        content: processedContent,
        size: new Blob([processedContent]).size,
        type: fileType,
        extension: ext,
      };
    } catch (error) {
      console.warn(`⚠️ Erreur traitement ${path}:`, error.message);
      return null;
    }
  }

  async _optimizeFile(content, ext) {
    let optimized = content;

    try {
      switch (ext) {
        case ".js":
        case ".ts":
        case ".jsx":
        case ".tsx":
          optimized = optimized
            .replace(/\/\/.*$/gm, "")
            .replace(/\/\*[\s\S]*?\*\//g, "");
          break;

        case ".html":
          optimized = optimized.replace(/<!--[\s\S]*?-->/g, "");
          break;

        case ".css":
          optimized = optimized.replace(/\/\*[\s\S]*?\*\//g, "");
          break;

        case ".json":
          try {
            optimized = JSON.stringify(JSON.parse(optimized));
          } catch (jsonError) {
            console.warn(`⚠️ JSON invalide, optimisation ignorée:`, jsonError.message);
          }
          break;
      }

      return optimized
        .replace(/\s+/g, " ")
        .replace(/^\s*[\r\n]/gm, "")
        .trim();
    } catch (error) {
      console.warn(`⚠️ Erreur optimisation ${ext}:`, error.message);
      return content; // Retourner l'original en cas d'erreur
    }
  }

  async _minifyFile(content, ext) {
    let minified = content;

    try {
      switch (ext) {
        case ".js":
        case ".ts":
        case ".jsx":
        case ".tsx":
          minified = content
            .replace(/\s+/g, " ")
            .replace(/\s*([{}:;,])\s*/g, "$1")
            .replace(/;}/g, "}")
            .trim();
          break;

        case ".css":
          minified = content
            .replace(/\s+/g, " ")
            .replace(/\s*([{}:;,])\s*/g, "$1")
            .replace(/;}/g, "}")
            .trim();
          break;

        case ".html":
          minified = content
            .replace(/\s+/g, " ")
            .replace(/>\s+</g, "><")
            .trim();
          break;

        case ".json":
          minified = JSON.stringify(JSON.parse(content));
          break;
      }
    } catch (error) {
      console.warn(`⚠️ Erreur minification ${ext}:`, error.message);
      minified = content; // Garder l'original
    }

    return minified;
  }

  async _createArchive(files, format) {
    switch (format) {
      case ARCHIVE_FORMATS.ZIP:
        return this._createZipArchive(files);
      default:
        console.warn(`⚠️ Format ${format} non supporté, utilisation de ZIP`);
        return this._createZipArchive(files);
    }
  }

  async _createZipArchive(files) {
    const zip = new JSZip();

    files.forEach((file) => {
      const safePath = file.path.replace(/\.\.\//g, "");
      zip.file(safePath, file.content);
    });

    const blob = await zip.generateAsync(
      {
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      },
      (metadata) => {
        console.log(`📦 Compression ${metadata.percent.toFixed(2)}%`);
      }
    );

    return {
      blob,
      size: blob.size,
      compression: "DEFLATE level 9",
    };
  }

  _generateManifest(project, metrics, options) {
    return {
      name: project.name,
      version: project.version || "1.0.0",
      description: project.description || "",
      created: new Date().toISOString(),
      build: {
        type: options.buildType,
        format: options.format,
        optimized: options.optimize,
        minified: options.minify,
      },
      metrics: {
        files: metrics.totalFiles,
        size: this._formatSize(metrics.totalSize),
        lines: metrics.totalLines,
        languages: metrics.languages,
      },
    };
  }

  _getFileType(ext) {
    const map = {
      ".js": "source",
      ".jsx": "source",
      ".ts": "source",
      ".tsx": "source",
      ".css": "source",
      ".html": "source",
      ".json": "source",
      ".png": "asset",
      ".jpg": "asset",
      ".jpeg": "asset",
      ".svg": "asset",
      ".gif": "asset",
      ".ico": "asset",
      ".woff": "asset",
      ".woff2": "asset",
    };

    return map[ext] || "other";
  }

  _transformPathForProduction(path) {
    return path
      .replace(/^src\//, "dist/")
      .replace(/\.jsx?$/, ".js")
      .replace(/\.tsx?$/, ".js")
      .replace(/\.scss$/, ".css")
      .replace(/\.less$/, ".css");
  }

  _calculateMetrics(files) {
    let totalSize = 0;
    let totalLines = 0;
    const languages = {};

    files.forEach((file) => {
      totalSize += file.size;
      totalLines += file.content?.split("\n").length || 0;
      languages[file.extension] = (languages[file.extension] || 0) + 1;
    });

    return {
      totalFiles: files.length,
      totalSize,
      totalLines,
      languages,
    };
  }

  _formatSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  async savePackage(packageData, filename) {
    if (!packageData?.archive) {
      throw new Error("Données de package invalides");
    }

    const blob = packageData.archive;
    const name = filename || `project-${Date.now()}.zip`;

    saveAs(blob, name);

    return { success: true, filename: name };
  }

  listPackages(projectId) {
    return this.packageHistory
      .filter((p) => p.projectId === projectId)
      .map((p) => ({
        id: p.id,
        version: p.version,
        format: p.format,
        files: p.files,
        size: this._formatSize(p.totalSize),
        createdAt: p.createdAt,
      }));
  }

  getStats() {
    const total = this.packageHistory.length;

    const totalSize = this.packageHistory.reduce(
      (acc, p) => acc + p.totalSize,
      0
    );

    return {
      totalPackages: total,
      totalSize: this._formatSize(totalSize),
      averageSize: total ? this._formatSize(totalSize / total) : "0 B",
    };
  }

  cleanup() {
    this.objectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn(`⚠️ Erreur nettoyage URL:`, error.message);
      }
    });

    this.objectUrls.clear();
    this.currentPackage = null;
  }
}

// =============================
// HOOK REACT
// =============================

export const usePackaging = () => {
  const [packaging, setPackaging] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastPackage, setLastPackage] = useState(null);

  useEffect(() => {
    const pack = new Packaging();

    pack.initialize()
      .catch(err => console.error("Erreur init packaging:", err));

    setPackaging(pack);

    return () => pack.cleanup();
  }, []);

  const createPackage = useCallback(async (projectId, userId, options) => {
    if (!packaging) {
      throw new Error("Packaging non initialisé");
    }

    setLoading(true);
    setError(null);

    try {
      const result = await packaging.createPackage(projectId, userId, options);

      setLastPackage(result);

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [packaging]);

  const savePackage = useCallback(async (packageData, filename) => {
    if (!packaging) {
      throw new Error("Packaging non initialisé");
    }
    
    return packaging.savePackage(packageData, filename);
  }, [packaging]);

  return {
    loading,
    error,
    lastPackage,
    createPackage,
    savePackage,
    hasPackage: !!lastPackage,
  };
};

// =============================
// EXPORT
// =============================

export const packaging = new Packaging();
export default packaging;
