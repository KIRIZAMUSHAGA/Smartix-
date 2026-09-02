/**
 * contextBuilder - Constructeur de contexte projet pour les requêtes IA
 * Sprint 2 : envoie un résumé structuré du projet à chaque requête IA
 *
 * Stratégie :
 * - Structure des dossiers (arbre léger)
 * - Résumé de chaque fichier (premières lignes + exports)
 * - Cache TTL pour éviter de reconstruire à chaque requête
 * - Troncature intelligente pour respecter les limites de tokens
 */

// =============================
// CONFIGURATION
// =============================

const CACHE_TTL_MS = 30_000; // 30 secondes
const MAX_CONTEXT_CHARS = 6000;
const MAX_FILE_PREVIEW_CHARS = 200;
const MAX_FILES_IN_CONTEXT = 20;

// Extensions textuelles à inclure dans le contexte
const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.rs', '.java',
  '.php', '.cpp', '.c', '.cs', '.css', '.scss', '.html', '.json',
  '.md', '.txt', '.yaml', '.yml', '.env.example',
]);

// Dossiers à ignorer
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.cache', 'coverage', '__pycache__',
  '.next', '.nuxt', 'vendor', 'target', '.venv', 'venv',
]);

// =============================
// CACHE
// =============================

const cache = new Map(); // projectId → { context, timestamp }

// =============================
// DÉTECTION DU TYPE DE FICHIER
// =============================

const getExtension = (path) => {
  const dot = path.lastIndexOf('.');
  return dot !== -1 ? path.slice(dot).toLowerCase() : '';
};

const isTextFile = (path) => {
  return TEXT_EXTENSIONS.has(getExtension(path));
};

// =============================
// RÉSUMÉ D'UN FICHIER
// =============================

const summarizeFile = (path, content) => {
  if (!content || !isTextFile(path)) return null;

  const lines = content.split('\n');
  const preview = lines.slice(0, 8).join('\n').substring(0, MAX_FILE_PREVIEW_CHARS);

  // Extraire les exports/fonctions principales
  const exports = [];
  const exportPatterns = [
    /^export\s+(default\s+)?(function|class|const|let|var)\s+(\w+)/m,
    /^module\.exports\s*=/m,
    /^def\s+(\w+)\s*\(/gm,
    /^class\s+(\w+)/gm,
    /^func\s+(\w+)/gm,
  ];

  for (const pattern of exportPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const name = match[3] || match[1];
      if (name && !exports.includes(name)) {
        exports.push(name);
        if (exports.length >= 5) break;
      }
    }
  }

  return {
    path,
    lines: lines.length,
    size: content.length,
    preview,
    exports: exports.slice(0, 5),
  };
};

// =============================
// CONSTRUCTION DE L'ARBRE
// =============================

const buildFileTree = (files) => {
  const dirs = new Set();
  const fileList = [];

  for (const path of Object.keys(files)) {
    // Ignorer les dossiers système
    const parts = path.split('/');
    if (parts.some(p => IGNORED_DIRS.has(p))) continue;

    // Ajouter les dossiers parents
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
    fileList.push(path);
  }

  return { dirs: Array.from(dirs).sort(), files: fileList.sort() };
};

// =============================
// BUILD CONTEXT
// =============================

/**
 * Construit un résumé de contexte pour le projet.
 * @param {string} projectId
 * @param {object} files - { path: content }
 * @param {string} currentFile - Fichier actuellement ouvert
 * @returns {string} - Texte de contexte à envoyer à l'IA
 */
export const buildProjectContext = (projectId, files, currentFile = null) => {
  // Vérifier le cache
  const cached = cache.get(projectId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.context;
  }

  const { dirs, files: fileList } = buildFileTree(files);

  let context = '=== CONTEXTE DU PROJET ===\n\n';

  // Structure de l'arbre
  context += '## Structure des fichiers\n';
  const displayFiles = fileList.slice(0, 40);
  context += displayFiles.map(f => `  ${f}`).join('\n');
  if (fileList.length > 40) {
    context += `\n  ... et ${fileList.length - 40} fichiers supplémentaires`;
  }
  context += '\n\n';

  // Résumés des fichiers
  context += '## Résumés des fichiers\n';
  let fileCount = 0;
  const fileEntries = Object.entries(files);

  // Prioriser le fichier courant
  if (currentFile && files[currentFile]) {
    const summary = summarizeFile(currentFile, files[currentFile]);
    if (summary) {
      context += formatFileSummary(summary, true);
      fileCount++;
    }
  }

  // Ajouter les autres fichiers textuels
  for (const [path, content] of fileEntries) {
    if (fileCount >= MAX_FILES_IN_CONTEXT) break;
    if (path === currentFile) continue;

    const summary = summarizeFile(path, content);
    if (!summary) continue;

    const formatted = formatFileSummary(summary, false);
    if (context.length + formatted.length > MAX_CONTEXT_CHARS) break;

    context += formatted;
    fileCount++;
  }

  context += '\n=== FIN DU CONTEXTE ===\n';

  // Stocker dans le cache
  cache.set(projectId, { context, timestamp: Date.now() });

  return context;
};

const formatFileSummary = (summary, isCurrent) => {
  let text = `\n### ${isCurrent ? '📍 ' : ''}${summary.path} (${summary.lines} lignes)\n`;
  if (summary.exports.length > 0) {
    text += `Exports : ${summary.exports.join(', ')}\n`;
  }
  text += `${summary.preview}\n`;
  return text;
};

// =============================
// INVALIDATION DU CACHE
// =============================

export const invalidateContext = (projectId) => {
  cache.delete(projectId);
};

export const clearAllContextCache = () => {
  cache.clear();
};

// =============================
// HOOK REACT
// =============================

import { useCallback, useRef } from 'react';

export const useProjectContext = (projectId) => {
  const filesRef = useRef({});

  const updateFiles = useCallback((files) => {
    filesRef.current = files;
    invalidateContext(projectId);
  }, [projectId]);

  const getContext = useCallback((currentFile = null) => {
    return buildProjectContext(projectId, filesRef.current, currentFile);
  }, [projectId]);

  return { updateFiles, getContext };
};

export default buildProjectContext;
