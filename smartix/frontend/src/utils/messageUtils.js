
import DOMPurify from 'dompurify';

// Constantes
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Types de fichiers autorisés (validation frontend - UX uniquement)
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Extensions autorisées pour fallback (UX uniquement)
export const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.pdf', '.doc', '.docx'];

// Patterns pour la détection de spam
const REPETITION_PATTERN = /(.)\1{9,}/; // 10+ répétitions du même caractère
const SPAM_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?(?:bit\.ly|tinyurl\.com|shorturl\.at)\/\S+/i, // URL shorteners
  /(?:à|a) vendre|(?:à|a) gagner|(?:cliquez|click) ici/i, // Spam français
  /\b(?:free|gift|prize|winner|lottery)\b/i // Spam anglais
];

/**
 * Nettoie un texte des caractères indésirables et des tentatives XSS
 * @param {string} text - Texte à nettoyer
 * @returns {string} - Texte nettoyé
 */
export const sanitizeMessage = (text) => {
  if (!text) return '';
  
  // Nettoyage avancé avec DOMPurify (sécurité XSS)
  const cleanText = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // Pas de balises HTML autorisées
    ALLOWED_ATTR: [], // Pas d'attributs autorisés
    ALLOW_DATA_ATTR: false
  });
  
  return cleanText
    .replace(/javascript:/gi, '') // Suppression des protocoles malveillants
    .replace(/vbscript:/gi, '')
    .replace(/on\w+=/gi, '') // Suppression des event handlers
    .replace(/&lt;script/gi, '') // Évasion HTML
    .replace(/&#x3C;script/gi, '')
    .trim();
};

/**
 * Détecte si un message contient du spam potentiel
 * @param {string} text - Message à analyser
 * @returns {boolean}
 */
export const isSpamMessage = (text) => {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  // Vérification des répétitions excessives
  if (REPETITION_PATTERN.test(text)) {
    return true;
  }
  
  // Vérification des patterns de spam
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Valide le contenu d'un message
 * @param {string} content - Contenu du message
 * @returns {Object} - { valid, error }
 */
export const validateMessage = (content) => {
  if (!content || !content.trim()) {
    return { valid: false, error: 'Le message ne peut pas être vide' };
  }
  
  if (content.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Maximum ${MAX_MESSAGE_LENGTH} caractères` };
  }
  
  // Détection de spam
  if (isSpamMessage(content)) {
    return { valid: false, error: 'Message détecté comme spam' };
  }
  
  return { valid: true, error: null };
};

/**
 * Valide un fichier avant upload (UX uniquement - sécurité backend requise)
 * @param {File} file - Le fichier à valider
 * @returns {Object} - { valid, error }
 */
export const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'Aucun fichier sélectionné' };
  }
  
  // Vérification de la taille
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `Fichier trop volumineux (max ${formatFileSize(MAX_FILE_SIZE)})` 
    };
  }
  
  // ⚠️ Ces vérifications sont pour l'UX uniquement
  // La sécurité réelle doit être implémentée côté backend
  
  // Vérification du type MIME
  const isTypeAllowed = ALLOWED_FILE_TYPES.some(type => file.type === type);
  
  // Fallback sur l'extension
  const extension = '.' + file.name.split('.').pop().toLowerCase();
  const isExtensionAllowed = ALLOWED_FILE_EXTENSIONS.includes(extension);
  
  if (!isTypeAllowed && !isExtensionAllowed) {
    return { 
      valid: false, 
      error: 'Type de fichier non autorisé (images, vidéos, PDF, documents)' 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * Formate la taille d'un fichier en format lisible (localisé)
 * @param {number} bytes - Taille en bytes
 * @param {string} locale - Locale (fr, en)
 * @returns {string} - Taille formatée
 */
export const formatFileSize = (bytes, locale = 'fr') => {
  if (bytes === 0) return '0 B';
  
  const units = {
    fr: ['o', 'Ko', 'Mo', 'Go', 'To'],
    en: ['B', 'KB', 'MB', 'GB', 'TB']
  };
  
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unit = units[locale] || units.en;
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  
  return `${size} ${unit[i]}`;
};

/**
 * Détecte les URLs dans un texte
 * @param {string} text - Texte à analyser
 * @returns {Array} - Tableau des URLs trouvées
 */
export const extractUrls = (text) => {
  if (!text) return [];
  
  // Regex robuste pour les URLs
  const urlRegex = /(https?:\/\/[^\s<>[\]{}|\\^`]+[^\s.,<>[\]{}|\\^`])|(www\.[^\s<>[\]{}|\\^`]+[^\s.,<>[\]{}|\\^`])/gi;
  const urls = [];
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[0];
    // Ajouter https:// si absent pour www.
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    urls.push(url);
  }
  
  return [...new Set(urls)]; // Unicité
};

/**
 * Parse un texte en segments (texte et URLs)
 * @param {string} text - Texte à analyser
 * @returns {Array} - Tableau des parties
 */
export const parseUrls = (text) => {
  if (!text) return [{ type: 'text', content: '' }];
  
  const urlRegex = /(https?:\/\/[^\s<>[\]{}|\\^`]+[^\s.,<>[\]{}|\\^`])|(www\.[^\s<>[\]{}|\\^`]+[^\s.,<>[\]{}|\\^`])/gi;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    // Texte avant l'URL
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // L'URL elle-même
    let url = match[0];
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    
    parts.push({
      type: 'url',
      content: url
    });
    
    lastIndex = urlRegex.lastIndex;
  }
  
  // Texte après la dernière URL
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return parts;
};

/**
 * Génère un ID temporaire unique pour un message optimiste
 * @returns {string} - ID temporaire unique
 */
export const generateTempId = () => {
  // Utilisation de crypto.randomUUID() pour une unicité garantie
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `temp_${crypto.randomUUID()}`;
  }
  // Fallback pour les navigateurs plus anciens
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Extrait les mentions d'un texte
 * @param {string} text - Message à analyser
 * @returns {Array} - Tableau des utilisateurs mentionnés
 */
export const extractMentions = (text) => {
  if (!text) return [];
  
  // Support des usernames avec points, tirets, underscores
  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)];
};

/**
 * Tronque un message intelligemment (sans couper les mots)
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - Texte tronqué
 */
export const truncateMessage = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  // Si pas d'espace, couper brutalement
  if (lastSpaceIndex === -1) {
    return truncated + '...';
  }
  
  return truncated.substring(0, lastSpaceIndex) + '...';
};

/**
 * Normalise un timestamp pour la comparaison (format ISO strict)
 * @param {string|Date} date - Date à normaliser
 * @returns {number} - Timestamp en millisecondes
 */
export const normalizeTimestamp = (date) => {
  if (!date) return 0;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.getTime();
  } catch {
    return 0;
  }
};

/**
 * Vérifie si deux messages sont consécutifs (même auteur, intervalle < 5min)
 * @param {Object} msg1 - Premier message
 * @param {Object} msg2 - Deuxième message
 * @returns {boolean}
 */
export const areConsecutiveMessages = (msg1, msg2) => {
  if (!msg1 || !msg2) return false;
  if (msg1.sender_id !== msg2.sender_id) return false;
  
  const time1 = normalizeTimestamp(msg1.created_at);
  const time2 = normalizeTimestamp(msg2.created_at);
  const diffMinutes = Math.abs(time2 - time1) / (1000 * 60);
  
  return diffMinutes < 5;
};

/**
 * Regroupe les messages par date (pour les séparateurs)
 * @param {Array} messages - Liste des messages
 * @returns {Object} - Messages groupés par date
 */
export const groupMessagesByDate = (messages) => {
  const groups = {};
  
  messages.forEach(msg => {
    const date = new Date(msg.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
  });
  
  return groups;
};

/**
 * Formate une date pour l'affichage dans le chat
 * @param {string} dateStr - Date ISO
 * @returns {string} - Date formatée
 */
export const formatChatDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Aujourd'hui";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Hier";
  } else {
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
};
