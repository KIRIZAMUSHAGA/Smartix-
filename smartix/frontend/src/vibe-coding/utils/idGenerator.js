/**
 * Générateur d'identifiants uniques pour le module Vibe-Coding
 * 
 * Fonctions:
 * - generateProjectId() : ID pour les projets
 * - generateFileId() : ID pour les fichiers
 * - generateAssetId() : ID pour les assets
 * - generateBuildId() : ID pour les builds
 * - generateVersionId() : ID pour les versions
 */

// =============================
// CONFIGURATION
// =============================

// Préfixes pour chaque type d'ID
const PREFIXES = {
  PROJECT: 'proj',
  FILE: 'file',
  ASSET: 'ast',
  BUILD: 'bld',
  VERSION: 'ver',
  TEMPLATE: 'tmp'
};

// Longueur des IDs (sans le préfixe)
const ID_LENGTH = 12;

// Alphabet pour les IDs aléatoires (sans caractères ambigus)
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Cache des IDs générés récemment (pour éviter collisions)
const recentIds = new Set();
const MAX_CACHE_SIZE = 1000;

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Génère une chaîne aléatoire de longueur donnée
 * @param {number} length - Longueur de la chaîne
 * @returns {string} - Chaîne aléatoire
 */
const generateRandomString = (length = ID_LENGTH) => {
  let result = '';
  const alphabetLength = ALPHABET.length;
  
  // Utiliser crypto si disponible (plus sécurisé)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += ALPHABET[randomValues[i] % alphabetLength];
    }
  } else {
    // Fallback pour Node.js ou environnements sans crypto
    for (let i = 0; i < length; i++) {
      result += ALPHABET[Math.floor(Math.random() * alphabetLength)];
    }
  }
  
  return result;
};

/**
 * Nettoie le cache des IDs récents
 */
const cleanRecentIds = () => {
  if (recentIds.size > MAX_CACHE_SIZE) {
    // Supprimer les plus anciens (les premiers)
    const toDelete = Array.from(recentIds).slice(0, 100);
    toDelete.forEach(id => recentIds.delete(id));
  }
};

/**
 * Génère un ID unique avec préfixe
 * @param {string} prefix - Préfixe de l'ID
 * @param {number} length - Longueur de la partie aléatoire
 * @returns {string} - ID unique
 */
const generateUniqueId = (prefix, length = ID_LENGTH) => {
  let id;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    id = `${prefix}_${generateRandomString(length)}`;
    attempts++;
  } while (recentIds.has(id) && attempts < maxAttempts);
  
  // Ajouter au cache
  recentIds.add(id);
  cleanRecentIds();
  
  return id;
};

// =============================
// API PUBLIQUE
// =============================

/**
 * Génère un ID unique pour un projet
 * @param {string} [customPrefix] - Préfixe personnalisé (optionnel)
 * @returns {string} - ID du projet (ex: proj_aB3dF7kL9mN2)
 */
export const generateProjectId = (customPrefix) => {
  const prefix = customPrefix || PREFIXES.PROJECT;
  return generateUniqueId(prefix);
};

/**
 * Génère un ID unique pour un fichier
 * @param {string} [customPrefix] - Préfixe personnalisé (optionnel)
 * @returns {string} - ID du fichier (ex: file_xYz8Pq3rT5uW)
 */
export const generateFileId = (customPrefix) => {
  const prefix = customPrefix || PREFIXES.FILE;
  return generateUniqueId(prefix);
};

/**
 * Génère un ID unique pour un asset
 * @param {string} [customPrefix] - Préfixe personnalisé (optionnel)
 * @returns {string} - ID de l'asset (ex: ast_Lk9jH4gF2dS1)
 */
export const generateAssetId = (customPrefix) => {
  const prefix = customPrefix || PREFIXES.ASSET;
  return generateUniqueId(prefix);
};

/**
 * Génère un ID unique pour un build
 * @param {string} [customPrefix] - Préfixe personnalisé (optionnel)
 * @returns {string} - ID du build (ex: bld_Rt5yU8iK9oL2)
 */
export const generateBuildId = (customPrefix) => {
  const prefix = customPrefix || PREFIXES.BUILD;
  return generateUniqueId(prefix);
};

/**
 * Génère un ID unique pour une version
 * @param {string} [customPrefix] - Préfixe personnalisé (optionnel)
 * @returns {string} - ID de la version (ex: ver_3qW5eR8tY2uI)
 */
export const generateVersionId = (customPrefix) => {
  const prefix = customPrefix || PREFIXES.VERSION;
  return generateUniqueId(prefix);
};

/**
 * Génère un ID unique pour un template
 * @param {string} [customPrefix] - Préfixe personnalisé (optionnel)
 * @returns {string} - ID du template (ex: tmp_J7hG4fD2sA5l)
 */
export const generateTemplateId = (customPrefix) => {
  const prefix = customPrefix || PREFIXES.TEMPLATE;
  return generateUniqueId(prefix);
};

/**
 * Vérifie si un ID est valide selon le format
 * @param {string} id - ID à vérifier
 * @param {string} expectedPrefix - Préfixe attendu (optionnel)
 * @returns {boolean} - True si l'ID est valide
 */
export const isValidId = (id, expectedPrefix = null) => {
  if (!id || typeof id !== 'string') return false;
  
  // Format attendu: prefix_randomString
  const parts = id.split('_');
  if (parts.length !== 2) return false;
  
  const [prefix, random] = parts;
  
  // Vérifier le préfixe si spécifié
  if (expectedPrefix && prefix !== expectedPrefix) return false;
  
  // Vérifier que le préfixe est valide
  const validPrefixes = Object.values(PREFIXES);
  if (!validPrefixes.includes(prefix)) return false;
  
  // Vérifier que la partie aléatoire contient uniquement des caractères autorisés
  const validChars = new RegExp(`^[${ALPHABET}]+$`);
  if (!validChars.test(random)) return false;
  
  // Vérifier la longueur
  if (random.length !== ID_LENGTH) return false;
  
  return true;
};

/**
 * Extrait les informations d'un ID
 * @param {string} id - ID à analyser
 * @returns {Object|null} - { prefix, random, type } ou null si invalide
 */
export const parseId = (id) => {
  if (!isValidId(id)) return null;
  
  const [prefix, random] = id.split('_');
  
  // Déterminer le type à partir du préfixe
  let type = 'unknown';
  switch (prefix) {
    case PREFIXES.PROJECT: type = 'project'; break;
    case PREFIXES.FILE: type = 'file'; break;
    case PREFIXES.ASSET: type = 'asset'; break;
    case PREFIXES.BUILD: type = 'build'; break;
    case PREFIXES.VERSION: type = 'version'; break;
    case PREFIXES.TEMPLATE: type = 'template'; break;
  }
  
  return {
    prefix,
    random,
    type,
    full: id
  };
};

/**
 * Génère un ID basé sur le timestamp (pour ordre chronologique)
 * @param {string} prefix - Préfixe de l'ID
 * @returns {string} - ID chronologique (ex: proj_20250306123456_abc)
 */
export const generateTimestampId = (prefix = PREFIXES.PROJECT) => {
  const timestamp = Date.now();
  const random = generateRandomString(6); // Plus court pour les IDs timestamp
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * Extrait le timestamp d'un ID généré par generateTimestampId
 * @param {string} id - ID à analyser
 * @returns {number|null} - Timestamp ou null
 */
export const getTimestampFromId = (id) => {
  if (!id || typeof id !== 'string') return null;
  
  const parts = id.split('_');
  if (parts.length !== 3) return null;
  
  const timestamp = parseInt(parts[1], 10);
  return isNaN(timestamp) ? null : timestamp;
};

/**
 * Vide le cache des IDs récents (pour les tests)
 */
export const clearRecentIdsCache = () => {
  recentIds.clear();
};

/**
 * Obtient la taille du cache
 * @returns {number} - Nombre d'IDs en cache
 */
export const getCacheSize = () => recentIds.size;

// =============================
// EXPORT PAR DÉFAUT
// =============================
export default {
  generateProjectId,
  generateFileId,
  generateAssetId,
  generateBuildId,
  generateVersionId,
  generateTemplateId,
  isValidId,
  parseId,
  generateTimestampId,
  getTimestampFromId,
  clearRecentIdsCache,
  getCacheSize
};
