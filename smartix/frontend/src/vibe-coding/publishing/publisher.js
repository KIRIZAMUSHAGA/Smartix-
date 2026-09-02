/**
 * Gestionnaire de publication pour le module Vibe-Coding
 * 
 * Rôle: Publier les projets vers différents canaux
 * - Publication sur marketplace interne
 * - Export en ZIP
 * - Déploiement sur services externes
 * - Gestion des versions et validation
 * - Analytics et webhooks
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { useState, useCallback, useEffect, useRef } from 'react';
import { projectManager } from '../core/projectManager';
import { versionManager } from './versionManager';
import { packaging } from './packaging';
import { storePublisher } from './storePublisher';
import { visibilityManager } from './visibilityManager';
import { ProjectLoader } from '../editor/projectLoader';
import EventEmitter from 'events';
import PropTypes from 'prop-types';

// =============================
// CONFIGURATION
// =============================

// Plateformes de publication supportées
export const PLATFORMS = {
  MARKETPLACE: 'marketplace',
  GITHUB: 'github',
  NETLIFY: 'netlify',
  VERCEL: 'vercel',
  ZIP: 'zip',
  NPM: 'npm'
};

// Statuts de publication
export const PUBLISH_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  VALIDATING: 'validating',
  BUILDING: 'building',
  UPLOADING: 'uploading',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  UPDATED: 'updated'
};

// Configuration par plateforme
const PLATFORM_CONFIGS = {
  [PLATFORMS.MARKETPLACE]: {
    name: 'VibeCoding Marketplace',
    icon: '🏪',
    maxSize: 100 * 1024 * 1024, // 100 MB
    requiredFiles: ['package.json', 'README.md'],
    requiredFields: ['name', 'version', 'description'],
    allowedVisibility: ['public', 'private', 'unlisted'],
    features: ['analytics', 'comments', 'ratings', 'versions'],
    buildRequired: true,
    assetsSupport: true,
    maxAssets: 50,
    pricing: {
      free: true,
      paid: true,
      minPrice: 0.99
    }
  },
  [PLATFORMS.GITHUB]: {
    name: 'GitHub',
    icon: '🐙',
    maxSize: Infinity,
    requiredFiles: ['.gitignore', 'README.md', 'LICENSE'],
    requiredFields: ['githubToken', 'username', 'repoName'],
    features: ['actions', 'pages', 'discussions', 'wiki'],
    buildRequired: false,
    assetsSupport: true,
    maxAssets: Infinity,
    pricing: {
      free: true,
      paid: false
    }
  },
  [PLATFORMS.NETLIFY]: {
    name: 'Netlify',
    icon: '🌐',
    maxSize: 200 * 1024 * 1024,
    requiredFiles: ['netlify.toml', 'package.json'],
    requiredFields: ['netlifyToken', 'siteName'],
    features: ['forms', 'functions', 'split-testing', 'analytics'],
    buildRequired: true,
    buildCommand: 'npm run build',
    publishDir: 'build',
    assetsSupport: true,
    maxAssets: 1000,
    pricing: {
      free: true,
      paid: true,
      plans: ['starter', 'pro', 'business']
    }
  },
  [PLATFORMS.VERCEL]: {
    name: 'Vercel',
    icon: '▲',
    maxSize: 200 * 1024 * 1024,
    requiredFiles: ['vercel.json', 'package.json'],
    requiredFields: ['vercelToken', 'projectName'],
    features: ['serverless', 'edge', 'analytics', 'previews'],
    buildRequired: true,
    buildCommand: 'npm run build',
    publishDir: 'dist',
    assetsSupport: true,
    maxAssets: 1000,
    pricing: {
      free: true,
      paid: true,
      plans: ['hobby', 'pro', 'enterprise']
    }
  },
  [PLATFORMS.ZIP]: {
    name: 'Archive ZIP',
    icon: '📦',
    maxSize: 500 * 1024 * 1024,
    requiredFiles: [],
    features: ['download', 'share'],
    buildRequired: false,
    assetsSupport: true,
    maxAssets: Infinity,
    pricing: {
      free: true
    }
  },
  [PLATFORMS.NPM]: {
    name: 'npm Registry',
    icon: '📦',
    maxSize: 50 * 1024 * 1024,
    requiredFiles: ['package.json', 'README.md'],
    requiredFields: ['npmToken', 'packageName'],
    features: ['versions', 'dependencies', 'scripts'],
    buildRequired: true,
    buildCommand: 'npm run build',
    assetsSupport: false,
    maxAssets: 0,
    pricing: {
      free: true,
      paid: false
    }
  }
};

// Messages internationalisés
const I18N = {
  fr: {
    publish: 'Publier',
    update: 'Mettre à jour',
    unpublish: 'Dépublier',
    platform: 'Plateforme',
    version: 'Version',
    status: 'Statut',
    duration: 'Durée',
    errors: 'Erreurs',
    warnings: 'Avertissements',
    success: 'Succès',
    failed: 'Échec',
    inProgress: 'En cours',
    projectNotFound: 'Projet non trouvé',
    permissionDenied: 'Vous n\'avez pas les droits de publication',
    platformNotSupported: 'Plateforme non supportée',
    validationFailed: 'Validation échouée',
    buildFailed: 'Échec du build',
    uploadFailed: 'Échec de l\'upload',
    publishSuccess: 'Publication réussie !',
    publishFailed: 'Échec de la publication',
    requiredField: (field) => `Champ requis manquant : ${field}`,
    requiredFile: (file) => `Fichier requis manquant : ${file}`,
    fileTooLarge: (size, max) => `Fichier trop volumineux : ${size} > ${max}`,
    confirmUnpublish: 'Êtes-vous sûr de vouloir dépublier ce projet ?',
    confirmUpdate: 'Une nouvelle version va être créée. Continuer ?'
  },
  en: {
    publish: 'Publish',
    update: 'Update',
    unpublish: 'Unpublish',
    platform: 'Platform',
    version: 'Version',
    status: 'Status',
    duration: 'Duration',
    errors: 'Errors',
    warnings: 'Warnings',
    success: 'Success',
    failed: 'Failed',
    inProgress: 'In progress',
    projectNotFound: 'Project not found',
    permissionDenied: 'You do not have publishing rights',
    platformNotSupported: 'Platform not supported',
    validationFailed: 'Validation failed',
    buildFailed: 'Build failed',
    uploadFailed: 'Upload failed',
    publishSuccess: 'Publish successful!',
    publishFailed: 'Publish failed',
    requiredField: (field) => `Missing required field: ${field}`,
    requiredFile: (file) => `Missing required file: ${file}`,
    fileTooLarge: (size, max) => `File too large: ${size} > ${max}`,
    confirmUnpublish: 'Are you sure you want to unpublish this project?',
    confirmUpdate: 'A new version will be created. Continue?'
  }
};

// =============================
// GESTIONNAIRE DE SECRETS
// =============================

class SecretManager {
  constructor() {
    this.secrets = new Map();
    this.encryptionKey = null;
    this.initialized = false;
  }

  async initialize(userId) {
    if (this.initialized) return;
    this.userId = userId;

    try {
      // Générer ou récupérer la clé de chiffrement
      const storedKey = localStorage.getItem(`vibe_encryption_key_${userId}`);
      if (storedKey) {
        this.encryptionKey = new Uint8Array(JSON.parse(storedKey));
      } else {
        this.encryptionKey = crypto.getRandomValues(new Uint8Array(32));
        localStorage.setItem(`vibe_encryption_key_${userId}`, JSON.stringify(Array.from(this.encryptionKey)));
      }

      // Charger les secrets sauvegardés
      const savedSecrets = localStorage.getItem(`vibe_secrets_${userId}`);
      if (savedSecrets) {
        const parsed = JSON.parse(savedSecrets);
        for (const [platform, secrets] of Object.entries(parsed)) {
          const platformMap = new Map();
          for (const [key, secret] of Object.entries(secrets)) {
            platformMap.set(key, secret);
          }
          this.secrets.set(platform, platformMap);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Erreur initialisation SecretManager:', error);
      throw error;
    }
  }

  async setSecret(platform, key, value) {
    if (!this.initialized) throw new Error('SecretManager non initialisé');

    const encrypted = await this._encrypt(value);
    
    if (!this.secrets.has(platform)) {
      this.secrets.set(platform, new Map());
    }
    
    this.secrets.get(platform).set(key, {
      value: encrypted,
      createdAt: Date.now(),
      lastUsed: null
    });

    await this._persistSecrets();
  }

  async getSecret(platform, key) {
    if (!this.initialized) throw new Error('SecretManager non initialisé');

    const platformSecrets = this.secrets.get(platform);
    if (!platformSecrets) return null;

    const secret = platformSecrets.get(key);
    if (!secret) return null;

    // Mettre à jour lastUsed
    secret.lastUsed = Date.now();
    await this._persistSecrets();

    return this._decrypt(secret.value);
  }

  async deleteSecret(platform, key) {
    const platformSecrets = this.secrets.get(platform);
    if (platformSecrets) {
      platformSecrets.delete(key);
      await this._persistSecrets();
    }
  }

  async _encrypt(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const key = await crypto.subtle.importKey(
      'raw',
      this.encryptionKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    };
  }

  async _decrypt(encrypted) {
    const key = await crypto.subtle.importKey(
      'raw',
      this.encryptionKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
      key,
      new Uint8Array(encrypted.data)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  async _persistSecrets() {
    const toSave = {};
    this.secrets.forEach((platformSecrets, platform) => {
      toSave[platform] = {};
      platformSecrets.forEach((secret, key) => {
        toSave[platform][key] = secret;
      });
    });
    localStorage.setItem(`vibe_secrets_${this.userId}`, JSON.stringify(toSave));
  }
}

// =============================
// GESTIONNAIRE D'ASSETS
// =============================

class AssetManager {
  constructor() {
    this.assets = new Map();
    this.cdnUrl = 'https://cdn.vibecoding.dev';
    this.uploadQueue = [];
    this.uploading = false;
  }

  async uploadAssets(project, version, platform) {
    const assets = this._extractAssets(project);
    const uploaded = [];
    const failed = [];

    this.uploadQueue = assets.map(asset => ({
      asset,
      attempts: 0,
      maxAttempts: 3
    }));

    this.uploading = true;

    while (this.uploadQueue.length > 0 && this.uploading) {
      const item = this.uploadQueue.shift();
      
      try {
        const url = await this._uploadToCDN(item.asset, project, version, platform);
        uploaded.push({
          ...item.asset,
          url,
          uploadedAt: Date.now()
        });
      } catch (error) {
        item.attempts++;
        
        if (item.attempts < item.maxAttempts) {
          // Réessayer plus tard
          setTimeout(() => {
            this.uploadQueue.push(item);
          }, 1000 * Math.pow(2, item.attempts));
        } else {
          failed.push({
            ...item.asset,
            error: error.message
          });
        }
      }
    }

    this.uploading = false;

    return {
      uploaded,
      failed,
      total: assets.length,
      success: uploaded.length,
      failed: failed.length
    };
  }

  _extractAssets(project) {
    const assets = [];
    
    Object.entries(project.files).forEach(([path, content]) => {
      // Images
      if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(path)) {
        assets.push({
          path,
          type: 'image',
          content,
          size: content?.length || 0,
          mime: this._getMimeType(path)
        });
      }
      
      // Polices
      if (/\.(woff|woff2|ttf|eot|otf)$/i.test(path)) {
        assets.push({
          path,
          type: 'font',
          content,
          size: content?.length || 0,
          mime: this._getMimeType(path)
        });
      }

      // CSS/JS statiques
      if (/\.(css|js|json)$/i.test(path) && !path.includes('node_modules')) {
        assets.push({
          path,
          type: 'static',
          content,
          size: content?.length || 0,
          mime: this._getMimeType(path)
        });
      }
    });

    return assets;
  }

  _getMimeType(path) {
    const mimes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json'
    };
    
    const ext = path.substring(path.lastIndexOf('.'));
    return mimes[ext] || 'application/octet-stream';
  }

  async _uploadToCDN(asset, project, version, platform) {
    // Simuler l'upload vers CDN
    const filename = `${project.id}/${version.version}/${asset.path}`;
    const url = `${this.cdnUrl}/${filename}`;
    
    // TODO: Implémenter l'upload réel avec fetch
    console.log(`📤 Uploading ${filename} (${this._formatSize(asset.size)})`);
    
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return url;
  }

  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  cancelUploads() {
    this.uploading = false;
    this.uploadQueue = [];
  }

  getUploadProgress() {
    if (this.uploadQueue.length === 0) return null;
    
    const total = this.uploadQueue.length;
    const remaining = this.uploadQueue.length;
    
    return {
      total,
      remaining,
      percentage: ((total - remaining) / total) * 100
    };
  }
}

// =============================
// OPTIMISEUR DE BUILD
// =============================

class BuildOptimizer {
  constructor() {
    this.optimizations = new Map();
  }

  async optimizeForPlatform(project, platform) {
    const startTime = Date.now();
    const report = {
      platform,
      optimizations: [],
      stats: {},
      duration: 0
    };

    // Minification JavaScript
    if (project.files) {
      const jsFiles = Object.keys(project.files).filter(f => f.endsWith('.js'));
      if (jsFiles.length > 0) {
        const jsResult = await this._minifyJavaScript(project, jsFiles);
        report.optimizations.push({
          type: 'minify-js',
          files: jsFiles.length,
          saved: jsResult.saved
        });
      }
    }

    // Minification CSS
    if (platform !== PLATFORMS.GITHUB) {
      const cssFiles = Object.keys(project.files).filter(f => f.endsWith('.css'));
      if (cssFiles.length > 0) {
        const cssResult = await this._minifyCSS(project, cssFiles);
        report.optimizations.push({
          type: 'minify-css',
          files: cssFiles.length,
          saved: cssResult.saved
        });
      }
    }

    // Optimisation des images
    if (PLATFORM_CONFIGS[platform].assetsSupport) {
      const imageFiles = Object.keys(project.files).filter(f => 
        /\.(png|jpg|jpeg|gif|svg)$/i.test(f)
      );
      
      if (imageFiles.length > 0) {
        const imageResult = await this._optimizeImages(project, imageFiles);
        report.optimizations.push({
          type: 'optimize-images',
          files: imageFiles.length,
          saved: imageResult.saved
        });
      }
    }

    // Tree shaking
    if (platform === PLATFORMS.VERCEL || platform === PLATFORMS.NETLIFY) {
      const treeShakingResult = await this._treeShaking(project);
      report.optimizations.push({
        type: 'tree-shaking',
        removed: treeShakingResult.removed,
        saved: treeShakingResult.saved
      });
    }

    // Source maps
    if (platform === PLATFORMS.MARKETPLACE) {
      await this._generateSourceMaps(project);
      report.optimizations.push({
        type: 'source-maps',
        generated: true
      });
    }

    report.duration = Date.now() - startTime;
    report.stats = this._calculateStats(project);

    return report;
  }

  async _minifyJavaScript(project, files) {
    let originalSize = 0;
    let optimizedSize = 0;

    for (const file of files) {
      const content = project.files[file];
      originalSize += content?.length || 0;

      // Minification simple (suppression des commentaires et espaces)
      const minified = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Supprimer les commentaires multi-lignes
        .replace(/\/\/.*/g, '') // Supprimer les commentaires mono-ligne
        .replace(/\s+/g, ' ') // Réduire les espaces
        .replace(/\s*([{}():;,])\s*/g, '$1') // Supprimer espaces autour des symboles
        .trim();

      project.files[file] = minified;
      optimizedSize += minified.length;
    }

    return {
      saved: originalSize - optimizedSize,
      original: originalSize,
      optimized: optimizedSize
    };
  }

  async _minifyCSS(project, files) {
    let originalSize = 0;
    let optimizedSize = 0;

    for (const file of files) {
      const content = project.files[file];
      originalSize += content?.length || 0;

      // Minification CSS basique
      const minified = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Supprimer les commentaires
        .replace(/\s+/g, ' ') // Réduire les espaces
        .replace(/\s*([{}:;,])\s*/g, '$1') // Supprimer espaces autour des symboles
        .replace(/;}/g, '}') // Supprimer les ; inutiles
        .trim();

      project.files[file] = minified;
      optimizedSize += minified.length;
    }

    return {
      saved: originalSize - optimizedSize,
      original: originalSize,
      optimized: optimizedSize
    };
  }

  async _optimizeImages(project, files) {
    let originalSize = 0;
    let optimizedSize = 0;

    for (const file of files) {
      const content = project.files[file];
      originalSize += content?.length || 0;

      // TODO: Implémenter l'optimisation réelle des images
      // Pour l'instant, on simule une réduction de 30%
      const optimized = content; // Remplacer par l'image optimisée
      const simulatedSize = Math.floor(content?.length * 0.7);

      project.files[file] = optimized;
      optimizedSize += simulatedSize;
    }

    return {
      saved: originalSize - optimizedSize,
      original: originalSize,
      optimized: optimizedSize
    };
  }

  async _treeShaking(project) {
    // Analyse simple des dépendances
    const removed = [];
    const saved = 0;

    // Identifier les fichiers non utilisés
    const usedFiles = new Set(['index.js', 'App.js', 'main.js']);
    
    Object.keys(project.files).forEach(file => {
      if (!usedFiles.has(file) && file.endsWith('.js')) {
        if (!project.files[file].includes('export')) {
          removed.push(file);
          // delete project.files[file];
        }
      }
    });

    return { removed, saved };
  }

  async _generateSourceMaps(project) {
    // Générer les sourcemaps pour les fichiers JS
    Object.keys(project.files).forEach(file => {
      if (file.endsWith('.js')) {
        const content = project.files[file];
        // Simuler la création d'une sourcemap
        const sourceMap = {
          version: 3,
          file: file,
          sources: [file],
          names: [],
          mappings: ''
        };
        
        project.files[`${file}.map`] = JSON.stringify(sourceMap);
      }
    });
  }

  _calculateStats(project) {
    let totalSize = 0;
    let fileCount = 0;

    Object.entries(project.files).forEach(([path, content]) => {
      totalSize += content?.length || 0;
      fileCount++;
    });

    return {
      totalSize,
      fileCount,
      averageSize: totalSize / fileCount
    };
  }
}

// =============================
// GESTIONNAIRE DE DÉPENDANCES
// =============================

class DependencyManager {
  async analyzeDependencies(project) {
    const dependencies = new Map();
    const issues = [];

    // Analyser package.json
    if (project.files && project.files['package.json']) {
      try {
        const pkg = JSON.parse(project.files['package.json']);
        
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies
        };

        for (const [name, version] of Object.entries(allDeps)) {
          const dep = {
            name,
            version,
            type: this._getDependencyType(name, pkg),
            required: this._isRequired(name, project)
          };

          dependencies.set(name, dep);

          // Vérifier les vulnérabilités
          const vulns = await this._checkVulnerabilities(name, version);
          if (vulns.length > 0) {
            issues.push({
              type: 'warning',
              message: `${name} a des vulnérabilités connues`,
              details: vulns
            });
          }
        }
      } catch (error) {
        issues.push({
          type: 'error',
          message: 'package.json invalide',
          error: error.message
        });
      }
    }

    // Analyser les imports dans les fichiers
    const imports = this._extractImports(project);
    for (const imp of imports) {
      if (!dependencies.has(imp.package)) {
        issues.push({
          type: 'warning',
          message: `Dépendance manquante dans package.json: ${imp.package}`,
          files: imp.files
        });
      }
    }

    return {
      dependencies: Array.from(dependencies.values()),
      issues,
      total: dependencies.size
    };
  }

  async checkPlatformCompatibility(dependencies, platform) {
    const compatibility = {
      compatible: true,
      issues: []
    };

    for (const dep of dependencies) {
      // Vérifier si la dépendance est compatible avec Node.js
      if (platform === PLATFORMS.NETLIFY || platform === PLATFORMS.VERCEL) {
        if (dep.name.includes('fs') || dep.name.includes('path')) {
          compatibility.issues.push({
            type: 'warning',
            message: `${dep.name} peut ne pas fonctionner dans un environnement serverless`
          });
        }
      }

      // Vérifier la taille
      if (dep.size && dep.size > 1024 * 1024) {
        compatibility.issues.push({
          type: 'info',
          message: `${dep.name} est volumineux (${this._formatSize(dep.size)})`
        });
      }
    }

    compatibility.compatible = compatibility.issues.filter(i => i.type === 'error').length === 0;
    return compatibility;
  }

  _getDependencyType(name, pkg) {
    if (pkg.dependencies && pkg.dependencies[name]) return 'production';
    if (pkg.devDependencies && pkg.devDependencies[name]) return 'development';
    if (pkg.peerDependencies && pkg.peerDependencies[name]) return 'peer';
    return 'unknown';
  }

  _isRequired(name, project) {
    // Vérifier si la dépendance est réellement utilisée
    const files = Object.values(project.files || {});
    
    for (const content of files) {
      if (content && (content.includes(`require('${name}')`) || 
          content.includes(`from '${name}'`) ||
          content.includes(`import ${name}`))) {
        return true;
      }
    }
    
    return false;
  }

  _extractImports(project) {
    const imports = [];
    const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;

    Object.entries(project.files || {}).forEach(([path, content]) => {
      if (path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.tsx')) {
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const imp = match[1];
          // Ignorer les imports relatifs
          if (!imp.startsWith('.') && !imp.startsWith('/')) {
            const packageName = imp.split('/')[0];
            imports.push({
              package: packageName,
              file: path
            });
          }
        }
      }
    });

    return imports;
  }

  async _checkVulnerabilities(name, version) {
    // Simuler une vérification de vulnérabilités
    // Dans la réalité, appeler une API comme npm audit ou snyk
    const vulnerabilities = [];
    
    const knownVulnerabilities = {
      'lodash': ['4.17.20'],
      'express': ['4.16.0'],
      'moment': ['2.29.0']
    };

    if (knownVulnerabilities[name] && knownVulnerabilities[name].includes(version)) {
      vulnerabilities.push({
        severity: 'high',
        description: `Version ${version} de ${name} a des vulnérabilités connues`
      });
    }

    return vulnerabilities;
  }

  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
        }
// =============================
// GESTIONNAIRE DE WEBHOOKS
// =============================

class WebhookManager extends EventEmitter {
  constructor() {
    super();
    this.webhooks = new Map();
    this.deliveryQueue = [];
    this.processing = false;
  }

  async registerWebhook(projectId, url, events = ['publish.success', 'publish.failed'], options = {}) {
    if (!this.webhooks.has(projectId)) {
      this.webhooks.set(projectId, []);
    }

    const webhook = {
      id: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      events,
      options: {
        retries: options.retries || 3,
        timeout: options.timeout || 10000,
        headers: options.headers || {},
        ...options
      },
      createdAt: Date.now(),
      lastTriggered: null,
      failures: 0,
      stats: {
        total: 0,
        success: 0,
        failed: 0,
        avgResponseTime: 0
      }
    };

    this.webhooks.get(projectId).push(webhook);
    this.emit('webhook:registered', webhook);
    
    return webhook;
  }

  async unregisterWebhook(projectId, webhookId) {
    const projectWebhooks = this.webhooks.get(projectId);
    if (projectWebhooks) {
      const index = projectWebhooks.findIndex(w => w.id === webhookId);
      if (index !== -1) {
        const removed = projectWebhooks.splice(index, 1)[0];
        this.emit('webhook:unregistered', removed);
        return removed;
      }
    }
    return null;
  }

  async triggerWebhooks(projectId, event, data) {
    const projectWebhooks = this.webhooks.get(projectId) || [];
    
    const deliveries = projectWebhooks
      .filter(w => w.events.includes(event))
      .map(webhook => ({
        webhook,
        event,
        data,
        attempts: 0,
        maxAttempts: webhook.options.retries
      }));

    this.deliveryQueue.push(...deliveries);
    
    if (!this.processing) {
      this._processQueue();
    }

    return deliveries.length;
  }

  async _processQueue() {
    this.processing = true;

    while (this.deliveryQueue.length > 0) {
      const delivery = this.deliveryQueue.shift();
      
      try {
        const startTime = Date.now();
        const response = await this._callWebhook(delivery);
        const duration = Date.now() - startTime;

        // Mettre à jour les stats
        delivery.webhook.lastTriggered = Date.now();
        delivery.webhook.failures = 0;
        delivery.webhook.stats.total++;
        delivery.webhook.stats.success++;
        delivery.webhook.stats.avgResponseTime = 
          (delivery.webhook.stats.avgResponseTime * (delivery.webhook.stats.total - 1) + duration) / 
          delivery.webhook.stats.total;

        this.emit('webhook:delivered', {
          webhook: delivery.webhook,
          event: delivery.event,
          response,
          duration
        });

      } catch (error) {
        delivery.webhook.failures++;
        
        if (delivery.attempts < delivery.maxAttempts) {
          // Réessayer avec un délai exponentiel
          const delay = 1000 * Math.pow(2, delivery.attempts);
          setTimeout(() => {
            this.deliveryQueue.push(delivery);
          }, delay);
        } else {
          delivery.webhook.stats.total++;
          delivery.webhook.stats.failed++;
          
          this.emit('webhook:failed', {
            webhook: delivery.webhook,
            event: delivery.event,
            error: error.message,
            attempts: delivery.attempts + 1
          });
        }
      }
    }

    this.processing = false;
  }

  async _callWebhook(delivery) {
    const { webhook, event, data } = delivery;
    delivery.attempts++;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), webhook.options.timeout);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VibeCoding-Publisher/1.0',
          'X-Webhook-Event': event,
          'X-Webhook-ID': webhook.id,
          ...webhook.options.headers
        },
        body: JSON.stringify({
          event,
          timestamp: Date.now(),
          data,
          webhook: {
            id: webhook.id,
            version: '1.0'
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        throw new Error('Timeout dépassé');
      }
      
      throw error;
    }
  }

  getWebhooks(projectId) {
    return this.webhooks.get(projectId) || [];
  }

  getStats() {
    const stats = {
      totalWebhooks: 0,
      totalDeliveries: 0,
      successRate: 0,
      avgResponseTime: 0
    };

    for (const webhooks of this.webhooks.values()) {
      for (const webhook of webhooks) {
        stats.totalWebhooks++;
        stats.totalDeliveries += webhook.stats.total;
        stats.successRate += webhook.stats.success;
        stats.avgResponseTime += webhook.stats.avgResponseTime * webhook.stats.total;
      }
    }

    if (stats.totalDeliveries > 0) {
      stats.successRate = (stats.successRate / stats.totalDeliveries) * 100;
      stats.avgResponseTime = stats.avgResponseTime / stats.totalDeliveries;
    }

    return stats;
  }
        }
// =============================
// CLASSE PUBLISHER PRINCIPALE
// =============================

class Publisher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.publishHistory = [];
    this.currentPublish = null;
    this.language = options.language || 'fr';
    
    // Initialiser les gestionnaires
    this.secretManager = new SecretManager();
    this.assetManager = new AssetManager();
    this.buildOptimizer = new BuildOptimizer();
    this.dependencyManager = new DependencyManager();
    this.webhookManager = new WebhookManager();
    
    // Écouter les événements des webhooks
    this.webhookManager.on('webhook:delivered', (data) => {
      this.emit('webhookDelivered', data);
    });
    
    this.webhookManager.on('webhook:failed', (data) => {
      this.emit('webhookFailed', data);
    });
  }

  /**
   * Initialise le publisher pour un utilisateur
   */
  async initialize(userId) {
    await this.secretManager.initialize(userId);
    this.emit('initialized', { userId });
  }

  /**
   * Publie un projet
   */
  async publishProject(projectId, userId, platform = PLATFORMS.MARKETPLACE, options = {}) {
    const startTime = Date.now();
    
    try {
      // Initialiser si nécessaire
      await this.initialize(userId);

      // Charger le projet
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error(this._t('projectNotFound'));
      }

      // Vérifier les permissions
      if (!visibilityManager.canPublish(project, userId)) {
        throw new Error(this._t('permissionDenied'));
      }

      // Vérifier la plateforme
      if (!PLATFORM_CONFIGS[platform]) {
        throw new Error(this._t('platformNotSupported'));
      }

      // Créer l'objet de publication
      this.currentPublish = {
        id: `publish-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        userId,
        platform,
        status: PUBLISH_STATUS.PENDING,
        startTime,
        options,
        steps: []
      };

      this.emit('publish:started', this.currentPublish);

      // Étape 1: Validation
      await this._updateStatus(PUBLISH_STATUS.VALIDATING, 'Validation du projet...');
      const validation = await this._validateProject(project, platform, options);
      
      if (!validation.valid) {
        throw new Error(`${this._t('validationFailed')}: ${validation.errors.join(', ')}`);
      }

      // Étape 2: Création de version
      const version = await versionManager.createVersion(projectId, userId, {
        type: options.versionType || 'minor',
        description: options.versionDescription || `Publication sur ${PLATFORM_CONFIGS[platform].name}`,
        metadata: {
          platform,
          ...options.metadata
        }
      });

      // Étape 3: Optimisation
      if (PLATFORM_CONFIGS[platform].buildRequired) {
        await this._updateStatus(PUBLISH_STATUS.BUILDING, 'Optimisation du build...');
        const buildReport = await this.buildOptimizer.optimizeForPlatform(project, platform);
        this.currentPublish.steps.push({ name: 'build', ...buildReport });
      }

      // Étape 4: Upload des assets
      if (PLATFORM_CONFIGS[platform].assetsSupport) {
        await this._updateStatus(PUBLISH_STATUS.UPLOADING, 'Upload des assets...');
        const assetResult = await this.assetManager.uploadAssets(project, version, platform);
        this.currentPublish.steps.push({ name: 'assets', ...assetResult });
      }

      // Étape 5: Publication
      await this._updateStatus(PUBLISH_STATUS.PUBLISHING, `Publication sur ${PLATFORM_CONFIGS[platform].name}...`);
      const publishResult = await this._publishToPlatform(platform, project, version, options);

      // Étape 6: Finalisation
      this.currentPublish.status = PUBLISH_STATUS.PUBLISHED;
      this.currentPublish.endTime = Date.now();
      this.currentPublish.result = publishResult;

      // Enregistrer dans l'historique
      this.publishHistory.push({ ...this.currentPublish });

      // Mettre à jour le projet
      await projectManager.updateProject(projectId, {
        published: true,
        publishedAt: new Date().toISOString(),
        publishedVersion: version.version,
        publishedPlatform: platform,
        publishUrl: publishResult.url,
        publishMetadata: publishResult.metadata
      }, userId);

      // Déclencher les webhooks
      await this.webhookManager.triggerWebhooks(projectId, 'publish.success', {
        project: {
          id: projectId,
          name: project.name,
          version: version.version
        },
        platform,
        result: publishResult,
        duration: this.currentPublish.endTime - this.currentPublish.startTime
      });

      this.emit('publish:completed', this.currentPublish);

      return {
        success: true,
        platform,
        version: version.version,
        url: publishResult.url,
        timestamp: new Date().toISOString(),
        duration: this.currentPublish.endTime - this.currentPublish.startTime,
        steps: this.currentPublish.steps
      };

    } catch (error) {
      if (this.currentPublish) {
        this.currentPublish.status = PUBLISH_STATUS.FAILED;
        this.currentPublish.error = error.message;
        this.currentPublish.endTime = Date.now();
        
        this.emit('publish:failed', {
          publish: this.currentPublish,
          error
        });

        // Déclencher les webhooks d'échec
        await this.webhookManager.triggerWebhooks(projectId, 'publish.failed', {
          project: { id: projectId },
          platform,
          error: error.message,
          duration: Date.now() - startTime
        });
      }

      console.error('❌ Erreur publication:', error);
      throw error;
    }
  }

  /**
   * Valide un projet avant publication
   */
  async _validateProject(project, platform, options) {
    const config = PLATFORM_CONFIGS[platform];
    const errors = [];
    const warnings = [];

    // Vérifier les fichiers requis
    for (const requiredFile of config.requiredFiles) {
      if (!project.files || !project.files[requiredFile]) {
        errors.push(this._t('requiredFile', requiredFile));
      }
    }

    // Vérifier les champs requis
    if (project.files && project.files['package.json']) {
      try {
        const pkg = JSON.parse(project.files['package.json']);
        
        for (const field of config.requiredFields) {
          if (!pkg[field] && !options[field]) {
            if (field === 'version' && pkg.version) continue;
            errors.push(this._t('requiredField', field));
          }
        }
      } catch {
        errors.push('package.json invalide');
      }
    }

    // Vérifier la taille
    const totalSize = this._calculateProjectSize(project);
    if (totalSize > config.maxSize) {
      errors.push(this._t('fileTooLarge', 
        this._formatSize(totalSize), 
        this._formatSize(config.maxSize)
      ));
    }

    // Analyser les dépendances
    const deps = await this.dependencyManager.analyzeDependencies(project);
    deps.issues.forEach(issue => {
      if (issue.type === 'error') errors.push(issue.message);
      else warnings.push(issue.message);
    });

    // Vérifier la compatibilité des dépendances
    const compatibility = await this.dependencyManager.checkPlatformCompatibility(deps.dependencies, platform);
    compatibility.issues.forEach(issue => {
      if (issue.type === 'error') errors.push(issue.message);
      else warnings.push(issue.message);
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalSize,
        fileCount: Object.keys(project.files || {}).length,
        dependencyCount: deps.total
      }
    };
  }

  /**
   * Publie sur une plateforme spécifique
   */
  async _publishToPlatform(platform, project, version, options) {
    switch (platform) {
      case PLATFORMS.MARKETPLACE:
        return this._publishToMarketplace(project, version, options);
      
      case PLATFORMS.GITHUB:
        return this._publishToGithub(project, version, options);
      
      case PLATFORMS.NETLIFY:
        return this._publishToNetlify(project, version, options);
      
      case PLATFORMS.VERCEL:
        return this._publishToVercel(project, version, options);
      
      case PLATFORMS.ZIP:
        return this._publishToZip(project, version, options);
      
      case PLATFORMS.NPM:
        return this._publishToNpm(project, version, options);
      
      default:
        throw new Error(this._t('platformNotSupported'));
    }
  }

  /**
   * Publication sur le marketplace interne
   */
  async _publishToMarketplace(project, version, options) {
    // Créer le package
    const packageData = await packaging.createPackage(project, version, {
      format: 'marketplace',
      includeSource: options.includeSource !== false,
      includeAssets: true,
      optimize: true
    });

    // Publier sur le store
    const result = await storePublisher.publish(project, version, packageData, {
      visibility: options.visibility || 'public',
      categories: options.categories || [],
      tags: options.tags || [],
      price: options.price,
      license: options.license || 'MIT',
      screenshots: options.screenshots
    });

    return {
      url: result.url,
      packageUrl: result.packageUrl,
      downloadCount: 0,
      metadata: {
        storeId: result.id,
        visibility: options.visibility || 'public'
      }
    };
  }

  /**
   * Publication sur GitHub
   */
  async _publishToGithub(project, version, options) {
    const token = options.githubToken || await this.secretManager.getSecret(PLATFORMS.GITHUB, 'token');
    if (!token) {
      throw new Error('Token GitHub requis');
    }

    // Créer le repository
    const repoResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        name: options.repoName || project.name,
        description: project.description,
        private: options.private || false,
        auto_init: true,
        license_template: options.license || 'mit',
        gitignore_template: 'Node'
      })
    });

    if (!repoResponse.ok) {
      throw new Error(`Erreur création repository: ${await repoResponse.text()}`);
    }

    const repo = await repoResponse.json();

    // Créer le package pour GitHub
    const packageData = await packaging.createPackage(project, version, {
      format: 'github',
      includeSource: true,
      includeReadme: true,
      includeGit: true
    });

    // TODO: Push les fichiers vers le repository

    return {
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      metadata: {
        repoId: repo.id,
        defaultBranch: repo.default_branch
      }
    };
  }

  /**
   * Publication sur Netlify
   */
  async _publishToNetlify(project, version, options) {
    const token = options.netlifyToken || await this.secretManager.getSecret(PLATFORMS.NETLIFY, 'token');
    if (!token) {
      throw new Error('Token Netlify requis');
    }

    // Créer le build
    const buildResult = await packaging.createBuild(project, version, {
      target: 'netlify',
      minify: true,
      optimize: true,
      generateSitemap: true
    });

    // Déployer sur Netlify
    const deployResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: options.siteName || project.name,
        custom_domain: options.customDomain,
        password: options.password,
        build_settings: {
          cmd: options.buildCommand || 'npm run build',
          dir: options.publishDir || 'build',
          functions_dir: options.functionsDir || 'netlify/functions'
        }
      })
    });

    if (!deployResponse.ok) {
      throw new Error(`Erreur déploiement Netlify: ${await deployResponse.text()}`);
    }

    const site = await deployResponse.json();

    // Upload des fichiers
    // TODO: Implémenter l'upload des fichiers déployés

    return {
      url: site.ssl_url || site.url,
      adminUrl: site.admin_url,
      siteId: site.id,
      metadata: {
        siteName: site.name,
        buildId: site.build_id
      }
    };
  }

  /**
   * Publication sur Vercel
   */
  async _publishToVercel(project, version, options) {
    const token = options.vercelToken || await this.secretManager.getSecret(PLATFORMS.VERCEL, 'token');
    if (!token) {
      throw new Error('Token Vercel requis');
    }

    // Créer le build
    const buildResult = await packaging.createBuild(project, version, {
      target: 'vercel',
      minify: true,
      optimize: true,
      generateSourceMaps: true
    });

    // Déployer sur Vercel
    const deployResponse = await fetch('https://api.vercel.com/v1/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: options.projectName || project.name,
        project: options.projectId,
        target: options.production ? 'production' : 'staging',
        files: Object.entries(project.files).map(([file, content]) => ({
          file,
          data: content
        })),
        builds: [{
          src: 'package.json',
          use: '@vercel/static-build',
          config: {
            distDir: options.publishDir || 'dist'
          }
        }],
        routes: options.routes || []
      })
    });

    if (!deployResponse.ok) {
      throw new Error(`Erreur déploiement Vercel: ${await deployResponse.text()}`);
    }

    const deployment = await deployResponse.json();

    return {
      url: `https://${deployment.url}`,
      previewUrl: deployment.inspectorUrl,
      deploymentId: deployment.id,
      metadata: {
        projectId: deployment.projectId,
        target: deployment.target
      }
    };
        }
    /**
   * Export en ZIP
   */
  async _publishToZip(project, version, options) {
    // Créer le ZIP
    const zipData = await packaging.createPackage(project, version, {
      format: 'zip',
      includeSource: true,
      includeAssets: true,
      includeReadme: true,
      includeGit: true,
      includeNodeModules: options.includeNodeModules || false,
      compress: true
    });

    // Générer une URL de téléchargement temporaire
    const downloadUrl = await this._createDownloadUrl(zipData, project.name);

    return {
      url: downloadUrl,
      filename: `${project.name}-${version.version}.zip`,
      size: zipData.size,
      expiresIn: 5 * 60 * 1000, // 5 minutes
      metadata: {
        format: 'zip',
        compressed: true,
        fileCount: Object.keys(project.files).length
      }
    };
  }

  /**
   * Publication sur npm
   */
  async _publishToNpm(project, version, options) {
    const token = options.npmToken || await this.secretManager.getSecret(PLATFORMS.NPM, 'token');
    if (!token) {
      throw new Error('Token npm requis');
    }

    // Préparer le package
    const packageData = await packaging.createPackage(project, version, {
      format: 'npm',
      includeSource: true,
      includeReadme: true,
      includeTypes: true,
      minify: true
    });

    // Publier sur npm
    // TODO: Implémenter l'API npm
    // npm publish --access public

    return {
      url: `https://www.npmjs.com/package/${options.packageName || project.name}`,
      packageName: options.packageName || project.name,
      version: version.version,
      metadata: {
        access: options.access || 'public',
        registry: 'https://registry.npmjs.org'
      }
    };
  }

  /**
   * Met à jour un projet publié
   */
  async updatePublishedProject(projectId, userId, options = {}) {
    try {
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error(this._t('projectNotFound'));
      }

      if (!project.published) {
        throw new Error('Le projet n\'est pas publié');
      }

      // Créer une nouvelle version
      const version = await versionManager.createVersion(projectId, userId, {
        type: options.versionType || 'patch',
        description: options.versionDescription || 'Mise à jour',
        metadata: {
          previousVersion: project.publishedVersion
        }
      });

      // Republier sur la même plateforme
      const result = await this.publishProject(projectId, userId, project.publishedPlatform, {
        ...options,
        versionType: 'patch',
        isUpdate: true
      });

      this.emit('project:updated', {
        projectId,
        version: version.version,
        result
      });

      return result;

    } catch (error) {
      console.error('Erreur mise à jour:', error);
      throw error;
    }
  }

  /**
   * Dépublie un projet
   */
  async unpublishProject(projectId, userId) {
    try {
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error(this._t('projectNotFound'));
      }

      if (!project.published) {
        throw new Error('Le projet n\'est pas publié');
      }

      // Dépublier selon la plateforme
      switch (project.publishedPlatform) {
        case PLATFORMS.MARKETPLACE:
          await storePublisher.unpublish(projectId);
          break;
        case PLATFORMS.GITHUB:
          // Rendre le repository privé ou le supprimer
          break;
        case PLATFORMS.NETLIFY:
          // Désactiver le site Netlify
          break;
        case PLATFORMS.VERCEL:
          // Supprimer le déploiement Vercel
          break;
      }

      // Mettre à jour le projet
      await projectManager.updateProject(projectId, {
        published: false,
        unpublishedAt: new Date().toISOString()
      }, userId);

      // Déclencher les webhooks
      await this.webhookManager.triggerWebhooks(projectId, 'project.unpublished', {
        project: {
          id: projectId,
          name: project.name,
          version: project.publishedVersion
        },
        platform: project.publishedPlatform
      });

      this.emit('project:unpublished', {
        projectId,
        platform: project.publishedPlatform
      });

      return { success: true };

    } catch (error) {
      console.error('Erreur dépublication:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un projet peut être publié
   */
  async canPublish(projectId, userId) {
    try {
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) return false;

      // Vérifier les prérequis de base
      const hasPackageJson = project.files && project.files['package.json'];
      const hasEntryPoint = project.files && (
        project.files['src/App.js'] || 
        project.files['src/index.js'] || 
        project.files['index.js'] ||
        project.files['main.js']
      );

      return !!(hasPackageJson && hasEntryPoint);

    } catch {
      return false;
    }
  }

  /**
   * Obtient le statut de publication
   */
  getPublishStatus() {
    if (!this.currentPublish) return null;
    
    const duration = this.currentPublish.endTime 
      ? this.currentPublish.endTime - this.currentPublish.startTime
      : Date.now() - this.currentPublish.startTime;

    return {
      ...this.currentPublish,
      duration: Math.round(duration / 1000), // en secondes
      progress: this._calculateProgress()
    };
  }

  /**
   * Liste l'historique des publications
   */
  getPublishHistory(limit = 10) {
    return this.publishHistory
      .slice(-limit)
      .reverse()
      .map(p => ({
        id: p.id,
        version: p.version,
        platform: p.platform,
        status: p.status,
        timestamp: new Date(p.startTime).toISOString(),
        duration: p.endTime ? Math.round((p.endTime - p.startTime) / 1000) : null,
        url: p.result?.url,
        steps: p.steps?.length || 0
      }));
  }
   /**
   * Calcule la progression de la publication
   */
  _calculateProgress() {
    if (!this.currentPublish) return 0;
    
    const steps = {
      [PUBLISH_STATUS.VALIDATING]: 20,
      [PUBLISH_STATUS.BUILDING]: 40,
      [PUBLISH_STATUS.UPLOADING]: 60,
      [PUBLISH_STATUS.PUBLISHING]: 80,
      [PUBLISH_STATUS.PUBLISHED]: 100
    };

    return steps[this.currentPublish.status] || 0;
  }

  /**
   * Met à jour le statut
   */
  async _updateStatus(status, message) {
    if (this.currentPublish) {
      this.currentPublish.status = status;
      this.currentPublish.message = message;
      this.emit('publish:status', this.currentPublish);
    }
  }

  /**
   * Calcule la taille totale du projet
   */
  _calculateProjectSize(project) {
    let total = 0;
    if (project.files) {
      Object.values(project.files).forEach(content => {
        total += content?.length || 0;
      });
    }
    return total;
  }

  /**
   * Crée une URL de téléchargement temporaire
   */
  async _createDownloadUrl(data, filename) {
    const blob = new Blob([data], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    
    // Nettoyer après 5 minutes
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    
    return url;
  }

  /**
   * Formate la taille
   */
  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Traduction
   */
  _t(key, ...args) {
    const message = I18N[this.language]?.[key] || I18N.fr[key];
    if (typeof message === 'function') {
      return message(...args);
    }
    return message || key;
  }
}

// =============================
// COMPOSANTS UI
// =============================

/**
 * Composant de sélection de plateforme
 */
const PlatformSelector = ({ onSelect, selected }) => (
  <div className="platform-selector">
    <h3>Choisir une plateforme de publication</h3>
    <div className="platform-grid">
      {Object.entries(PLATFORM_CONFIGS).map(([key, config]) => (
        <button
          key={key}
          className={`platform-card ${selected === key ? 'selected' : ''}`}
          onClick={() => onSelect(key)}
        >
          <div className="platform-icon">{config.icon}</div>
          <div className="platform-name">{config.name}</div>
          <div className="platform-features">
            {config.features.slice(0, 3).map(f => (
              <span key={f} className="feature-tag">{f}</span>
            ))}
          </div>
        </button>
      ))}
    </div>
    <style jsx>{`
      .platform-selector {
        padding: 20px;
      }
      .platform-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      .platform-card {
        background: #2d2d2d;
        border: 2px solid transparent;
        border-radius: 8px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.2s;
        color: #d4d4d4;
        text-align: left;
      }
      .platform-card:hover {
        background: #3e3e3e;
        transform: translateY(-2px);
      }
      .platform-card.selected {
        border-color: #007bff;
        background: #1e3a5f;
      }
      .platform-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }
      .platform-name {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 8px;
      }
      .platform-features {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .feature-tag {
        background: #4e4e4e;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }
    `}</style>
  </div>
);

/**
 * Composant de rapport de validation
 */
const ValidationReport = ({ validation }) => {
  if (!validation) return null;

  return (
    <div className="validation-report">
      <h3>Rapport de validation</h3>
      
      <div className="stats">
        <div className="stat-item">
          <span className="stat-label">Taille totale</span>
          <span className="stat-value">{validation.stats.totalSize}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Fichiers</span>
          <span className="stat-value">{validation.stats.fileCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Dépendances</span>
          <span className="stat-value">{validation.stats.dependencyCount}</span>
        </div>
      </div>

      {validation.errors.length > 0 && (
        <div className="errors">
          <h4>❌ Erreurs</h4>
          <ul>
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="warnings">
          <h4>⚠️ Avertissements</h4>
          <ul>
            {validation.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .validation-report {
          padding: 20px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin: 20px 0;
        }
        .stat-item {
          background: #2d2d2d;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-label {
          display: block;
          color: #888;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
        }
        .errors, .warnings {
          margin-top: 20px;
        }
        .errors h4, .warnings h4 {
          margin-bottom: 8px;
        }
        .errors ul, .warnings ul {
          list-style: none;
          padding: 0;
        }
        .errors li {
          color: #ff6b6b;
          padding: 8px;
          background: #5a2e2e;
          border-radius: 4px;
          margin-bottom: 4px;
        }
        .warnings li {
          color: #ffd93e;
          padding: 8px;
          background: #5a4e2e;
          border-radius: 4px;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};

/**
 * Composant de progression
 */
const PublishProgress = ({ status }) => {
  if (!status) return null;

  const getStatusIcon = (status) => {
    const icons = {
      [PUBLISH_STATUS.PENDING]: '⏳',
      [PUBLISH_STATUS.VALIDATING]: '🔍',
      [PUBLISH_STATUS.BUILDING]: '🏗️',
      [PUBLISH_STATUS.UPLOADING]: '📤',
      [PUBLISH_STATUS.PUBLISHING]: '🚀',
      [PUBLISH_STATUS.PUBLISHED]: '✅',
      [PUBLISH_STATUS.FAILED]: '❌'
    };
    return icons[status] || '⏳';
  };

  return (
    <div className="publish-progress">
      <div className="progress-header">
        <span className="status-icon">{getStatusIcon(status.status)}</span>
        <span className="status-message">{status.message || status.status}</span>
      </div>

      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${status.progress}%` }}
        />
      </div>

      <div className="progress-details">
        <div>Durée: {status.duration}s</div>
        {status.steps?.length > 0 && (
          <div>Étapes: {status.steps.length}</div>
        )}
      </div>

      <style jsx>{`
        .publish-progress {
          padding: 20px;
          background: #2d2d2d;
          border-radius: 8px;
          margin-top: 20px;
        }
        .progress-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .status-icon {
          font-size: 24px;
        }
        .status-message {
          font-size: 16px;
          font-weight: bold;
        }
        .progress-bar {
          height: 8px;
          background: #3e3e3e;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
        }
        .progress-details {
          display: flex;
          gap: 16px;
          color: #888;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};
    /**
 * Assistant de publication complet
 */
export const PublishWizard = ({ projectId, userId, onComplete, language = 'fr' }) => {
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState(null);
  const [config, setConfig] = useState({});
  const [validation, setValidation] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState(null);
  const [publisher] = useState(() => new Publisher({ language }));

  useEffect(() => {
    publisher.on('publish:status', setStatus);
    publisher.on('publish:completed', (data) => {
      setPublishing(false);
      onComplete?.(data);
    });
    publisher.on('publish:failed', () => setPublishing(false));

    return () => {
      publisher.removeAllListeners();
    };
  }, [publisher, onComplete]);

  const steps = [
    {
      title: 'Choisir une plateforme',
      component: PlatformSelector,
      props: {
        onSelect: setPlatform,
        selected: platform
      },
      validate: () => platform !== null
    },
    {
      title: 'Configuration',
      component: () => (
        <div className="config-placeholder">
          <h3>Configuration pour {PLATFORM_CONFIGS[platform]?.name}</h3>
          <p>Configuration spécifique à implémenter...</p>
        </div>
      ),
      validate: () => true
    },
    {
      title: 'Validation',
      component: ValidationReport,
      props: { validation },
      validate: () => validation?.valid
    },
    {
      title: 'Publication',
      component: () => (
        <div>
          <PublishProgress status={status} />
          {status?.status === PUBLISH_STATUS.PUBLISHED && (
            <div className="publish-success">
              <h3>✅ Publication réussie !</h3>
              <p>Votre projet est disponible à l'adresse :</p>
              <a href={status.result?.url} target="_blank" rel="noopener noreferrer">
                {status.result?.url}
              </a>
            </div>
          )}
        </div>
      ),
      validate: () => true
    }
  ];

  const handleNext = async () => {
    if (step === 2) {
      // Valider avant la dernière étape
      try {
        const project = await projectManager.getProjectById(projectId, userId);
        const validationResult = await publisher._validateProject(project, platform, config);
        setValidation(validationResult);
      } catch (error) {
        console.error('Erreur validation:', error);
      }
    }

    if (step === steps.length) {
      setPublishing(true);
      try {
        await publisher.publishProject(projectId, userId, platform, config);
      } catch (error) {
        console.error('Erreur publication:', error);
        setPublishing(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const CurrentStep = steps[step - 1].component;

  return (
    <div className="publish-wizard">
      <div className="wizard-header">
        <h2>Publier le projet</h2>
        <div className="step-indicator">
          {steps.map((s, i) => (
            <div 
              key={i} 
              className={`step ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'completed' : ''}`}
            >
              <span className="step-number">{i + 1}</span>
              <span className="step-title">{s.title}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="wizard-content">
        <CurrentStep {...steps[step - 1].props} />
      </div>

      <div className="wizard-footer">
        <button 
          className="btn-secondary"
          disabled={step === 1 || publishing}
          onClick={() => setStep(step - 1)}
        >
          Précédent
        </button>
        
        <button 
          className="btn-primary"
          disabled={!steps[step - 1].validate() || publishing}
          onClick={handleNext}
        >
          {step === steps.length ? 'Publier' : 'Suivant'}
        </button>
      </div>

      <style jsx>{`
        .publish-wizard {
          background: #252525;
          color: #d4d4d4;
          border-radius: 8px;
          overflow: hidden;
        }
        .wizard-header {
          padding: 20px;
          border-bottom: 1px solid #3e3e3e;
        }
        .wizard-header h2 {
          margin: 0 0 20px 0;
          color: #fff;
        }
        .step-indicator {
          display: flex;
          gap: 8px;
        }
        .step {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #2d2d2d;
          border-radius: 4px;
          opacity: 0.5;
        }
        .step.active {
          opacity: 1;
          background: #1e3a5f;
        }
        .step.completed {
          opacity: 1;
          background: #1e5f3a;
        }
        .step-number {
          width: 24px;
          height: 24px;
          background: #3e3e3e;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        .step-title {
          font-size: 14px;
        }
        .wizard-content {
          padding: 20px;
          min-height: 300px;
        }
        .wizard-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid #3e3e3e;
        }
        .btn-primary, .btn-secondary {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .btn-primary {
          background: #007bff;
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }
        .btn-secondary {
          background: #2d2d2d;
          color: #d4d4d4;
          border: 1px solid #3e3e3e;
        }
        .btn-secondary:hover:not(:disabled) {
          background: #3e3e3e;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .publish-success {
          text-align: center;
          padding: 20px;
        }
        .publish-success a {
          color: #007bff;
          text-decoration: none;
        }
        .publish-success a:hover {
          text-decoration: underline;
        }
        .config-placeholder {
          padding: 40px;
          text-align: center;
          color: #888;
        }
      `}</style>
    </div>
  );
};

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

export const publisher = { getStats: async () => ({}) };
PlatformSelector.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selected: PropTypes.bool.isRequired,
};
ValidationReport.propTypes = {
  validation: PropTypes.any.isRequired,
};
PublishProgress.propTypes = {
  status: PropTypes.string.isRequired,
};
PublishWizard.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onComplete: PropTypes.func.isRequired,
  language: PropTypes.any,
};
