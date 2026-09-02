

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG = {
  MAX_COMMENT_LENGTH: 500,
  MAX_REPLY_LENGTH: 200,
  SPAM_WINDOW_MS: 10000, // 10 secondes
  MAX_COMMENTS_PER_WINDOW: 3,
  SORT_ORDER: 'desc', // 'desc' ou 'asc'
  SORT_BY: 'created_at', // 'created_at', 'likes', 'replies_count'
  MAX_DEPTH: 5,
  CACHE_TTL: 60000, // 1 minute
  CACHE_MAX_SIZE: 50,
  EDIT_WINDOW_MINUTES: 5
};

// =============================
// 1️⃣ UTILITAIRES DE BASE
// =============================

/**
 * Sanitize le HTML pour éviter XSS
 * @param {string} str - Chaîne à sanitizer
 * @returns {string}
 */
const sanitize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Génère un ID temporaire unique
 * @returns {string}
 */
const generateTempId = () => {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Extrait le timestamp d'une date (optimisation)
 * @param {string} dateString - Date ISO
 * @returns {number}
 */
const getTimestamp = (dateString) => {
  if (!dateString) return 0;
  if (typeof dateString === 'number') return dateString;
  return new Date(dateString).getTime();
};

// =============================
// 2️⃣ ORGANISATION DES COMMENTAIRES (OPTIMISÉE)
// =============================

/**
 * Trie les commentaires selon les critères spécifiés
 * @param {Array} comments - Tableau de commentaires
 * @param {string} sortBy - Critère de tri ('created_at', 'likes', 'replies_count')
 * @param {string} order - Ordre ('asc' ou 'desc')
 * @returns {Array}
 */
const sortComments = (comments, sortBy = DEFAULT_CONFIG.SORT_BY, order = DEFAULT_CONFIG.SORT_ORDER) => {
  return [...comments].sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case 'likes':
        valueA = a.likes || 0;
        valueB = b.likes || 0;
        break;
      case 'replies_count':
        valueA = a.replies_count || 0;
        valueB = b.replies_count || 0;
        break;
      default:
        // Utiliser les timestamps pré-calculés pour optimisation
        valueA = a._timestamp || getTimestamp(a.created_at);
        valueB = b._timestamp || getTimestamp(b.created_at);
    }
    
    if (order === 'desc') {
      return valueB - valueA;
    }
    return valueA - valueB;
  });
};

/**
 * Calcule récursivement le nombre total de réponses (post-order)
 * @param {Array} comments - Tableau de commentaires
 * @returns {number}
 */
const computeRepliesCount = (comments) => {
  let total = 0;
  for (const comment of comments) {
    // Calcule d'abord pour les enfants
    const childrenCount = computeRepliesCount(comment.replies || []);
    comment.replies_count = comment.replies?.length || 0;
    comment.total_replies_count = childrenCount;
    total += 1 + childrenCount;
  }
  return total;
};

/**
 * Organise les commentaires plats en structure arborescente (threads)
 * @param {Array} flatComments - Tableau des commentaires plats
 * @param {Object} options - Options d'organisation
 * @param {string} options.sortBy - Critère de tri
 * @param {string} options.order - Ordre de tri
 * @param {number} options.maxDepth - Profondeur maximale
 * @returns {Array} - Commentaires organisés avec leurs réponses
 */
export const organizeComments = (flatComments, options = {}) => {
  if (!Array.isArray(flatComments)) return [];
  
  const {
    sortBy = DEFAULT_CONFIG.SORT_BY,
    order = DEFAULT_CONFIG.SORT_ORDER,
    maxDepth = DEFAULT_CONFIG.MAX_DEPTH
  } = options;
  
  const commentMap = new Map();
  const rootComments = [];
  
  // Premier passage : indexation et pré-calcul des timestamps
  flatComments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
      replies_count: 0,
      total_replies_count: 0,
      depth: 0,
      _timestamp: getTimestamp(comment.created_at),
      isEdited: !!comment.edited_at,
      edited_at: comment.edited_at
    });
  });
  
  // Deuxième passage : construction de l'arbre avec limite de profondeur
  flatComments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id);
    if (!commentWithReplies) return;
    
    if (comment.parent_id && commentMap.has(comment.parent_id)) {
      const parent = commentMap.get(comment.parent_id);
      commentWithReplies.depth = parent.depth + 1;
      
      // Limiter la profondeur pour éviter les threads infinis
      if (commentWithReplies.depth <= maxDepth) {
        parent.replies.push(commentWithReplies);
      } else {
        // Si trop profond, marquer comme masqué
        commentWithReplies.isCollapsed = true;
        parent.replies.push(commentWithReplies);
      }
    } else {
      rootComments.push(commentWithReplies);
    }
  });
  
  // Calcul des compteurs de réponses (une seule passe post-order)
  computeRepliesCount(rootComments);
  
  // Tri récursif
  const sortRecursively = (comments) => {
    const sorted = sortComments(comments, sortBy, order);
    for (const comment of sorted) {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies = sortRecursively(comment.replies);
      }
    }
    return sorted;
  };
  
  return sortRecursively(rootComments);
};

// =============================
// 3️⃣ VALIDATION ET ANTI-SPAM
// =============================

/**
 * Vérifie si l'utilisateur peut ajouter un commentaire (anti-spam)
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {Object} - { allowed: boolean, remainingTime: number, error: string|null }
 */
export const canAddComment = (userId = null) => {
  const storageKey = userId ? `comment_times_${userId}` : 'comment_times_anonymous';
  const commentTimes = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const now = Date.now();
  
  // Trier pour garantir l'ordre
  const validComments = commentTimes
    .filter(t => now - t < DEFAULT_CONFIG.SPAM_WINDOW_MS)
    .sort((a, b) => a - b);
  
  if (validComments.length >= DEFAULT_CONFIG.MAX_COMMENTS_PER_WINDOW) {
    const oldestTime = validComments[0];
    const remainingTime = DEFAULT_CONFIG.SPAM_WINDOW_MS - (now - oldestTime);
    return {
      allowed: false,
      remainingTime,
      error: `Trop de commentaires. Attendez ${Math.ceil(remainingTime / 1000)} secondes.`
    };
  }
  
  return { allowed: true, remainingTime: 0, error: null };
};

/**
 * Enregistre un nouveau commentaire dans l'historique anti-spam
 * @param {string} userId - ID de l'utilisateur (optionnel)
 */
export const recordCommentTime = (userId = null) => {
  const storageKey = userId ? `comment_times_${userId}` : 'comment_times_anonymous';
  const commentTimes = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const now = Date.now();
  
  commentTimes.push(now);
  
  // Garder uniquement les commentaires dans la fenêtre
  const validComments = commentTimes
    .filter(t => now - t < DEFAULT_CONFIG.SPAM_WINDOW_MS)
    .sort((a, b) => a - b);
  
  localStorage.setItem(storageKey, JSON.stringify(validComments.slice(-DEFAULT_CONFIG.MAX_COMMENTS_PER_WINDOW)));
};

/**
 * Valide le contenu d'un commentaire
 * @param {string} content - Contenu du commentaire
 * @param {boolean} isReply - Indique si c'est une réponse
 * @returns {Object} - { valid: boolean, error: string | null, sanitized: string }
 */
export const validateComment = (content, isReply = false) => {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Le commentaire ne peut pas être vide', sanitized: '' };
  }
  
  const trimmed = content.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Le commentaire ne peut pas être vide', sanitized: '' };
  }
  
  const maxLength = isReply ? DEFAULT_CONFIG.MAX_REPLY_LENGTH : DEFAULT_CONFIG.MAX_COMMENT_LENGTH;
  
  if (trimmed.length > maxLength) {
    return { 
      valid: false, 
      error: `Maximum ${maxLength} caractères`, 
      sanitized: sanitize(trimmed.slice(0, maxLength))
    };
  }
  
  return { valid: true, error: null, sanitized: sanitize(trimmed) };
};

// =============================
// 4️⃣ COMMENTAIRES TEMPORAIRES (OPTIMISTIC UPDATE)
// =============================

/**
 * Crée un commentaire temporaire pour l'optimistic update
 * @param {string} content - Contenu du commentaire
 * @param {Object} user - Utilisateur courant
 * @param {string|null} replyingTo - ID du commentaire parent (si réponse)
 * @param {Object|null} parentComment - Commentaire parent (si réponse)
 * @returns {Object} - Commentaire temporaire
 */
export const createTempComment = (content, user, replyingTo = null, parentComment = null) => {
  const now = new Date().toISOString();
  const sanitizedContent = sanitize(content);
  
  return {
    id: generateTempId(),
    content: sanitizedContent,
    author: {
      id: user?.id,
      full_name: user?.full_name || user?.username || 'Utilisateur',
      avatar: user?.avatar
    },
    created_at: now,
    _timestamp: Date.now(),
    likes: 0,
    liked: false,
    parent_id: replyingTo,
    parent_author: parentComment?.author,
    isTemp: true,
    replies: [],
    replies_count: 0,
    total_replies_count: 0,
    depth: parentComment ? (parentComment.depth || 0) + 1 : 0
  };
};

// =============================
// 5️⃣ STATISTIQUES DES COMMENTAIRES
// =============================

/**
 * Calcule le nombre total de commentaires (y compris les réponses)
 * @param {Array} comments - Tableau de commentaires
 * @returns {number}
 */
export const countTotalComments = (comments) => {
  if (!Array.isArray(comments)) return 0;
  
  let count = comments.length;
  for (const comment of comments) {
    if (comment.replies && comment.replies.length > 0) {
      count += countTotalComments(comment.replies);
    }
  }
  return count;
};

/**
 * Calcule le nombre de niveaux maximum dans un thread
 * @param {Array} comments - Tableau de commentaires
 * @returns {number}
 */
export const getMaxDepth = (comments) => {
  if (!Array.isArray(comments) || comments.length === 0) return 0;
  
  let maxDepth = 0;
  for (const comment of comments) {
    const depth = comment.depth || 0;
    maxDepth = Math.max(maxDepth, depth);
    if (comment.replies && comment.replies.length > 0) {
      maxDepth = Math.max(maxDepth, getMaxDepth(comment.replies));
    }
  }
  return maxDepth;
};

/**
 * Extrait les commentaires épinglés (premier niveau)
 * @param {Array} comments - Tableau de commentaires
 * @returns {Array}
 */
export const getPinnedComments = (comments) => {
  if (!Array.isArray(comments)) return [];
  return comments.filter(comment => comment.isPinned === true);
};

// =============================
// 6️⃣ UTILITAIRES SUPPLÉMENTAIRES
// =============================

/**
 * Formate la date relative d'un commentaire (internationalisable)
 * @param {string} dateString - Date ISO
 * @param {Function} t - Fonction de traduction (optionnel)
 * @returns {string}
 */
export const formatRelativeTime = (dateString, t = (key) => key) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return t('just_now');
  if (diffMin < 60) return t('minutes_ago', { count: diffMin });
  if (diffHour < 24) return t('hours_ago', { count: diffHour });
  if (diffDay === 1) return t('yesterday');
  if (diffDay < 7) return t('days_ago', { count: diffDay });
  
  return date.toLocaleDateString();
};

/**
 * Vérifie si un commentaire peut être modifié
 * @param {Object} comment - Commentaire
 * @param {string} currentUserId - ID de l'utilisateur courant
 * @param {number} editWindowMinutes - Fenêtre d'édition en minutes
 * @returns {boolean}
 */
export const canEditComment = (comment, currentUserId, editWindowMinutes = DEFAULT_CONFIG.EDIT_WINDOW_MINUTES) => {
  if (!comment || !currentUserId) return false;
  if (comment.author?.id !== currentUserId) return false;
  if (comment.isTemp) return true;
  
  const commentDate = new Date(comment.created_at);
  const now = new Date();
  const diffMinutes = (now - commentDate) / 1000 / 60;
  
  return diffMinutes <= editWindowMinutes;
};

/**
 * Vérifie si un commentaire peut être supprimé
 * @param {Object} comment - Commentaire
 * @param {string} currentUserId - ID de l'utilisateur courant
 * @param {boolean} isAdmin - Est-ce que l'utilisateur est admin
 * @returns {boolean}
 */
export const canDeleteComment = (comment, currentUserId, isAdmin = false) => {
  if (!comment || !currentUserId) return false;
  if (isAdmin) return true;
  return comment.author?.id === currentUserId;
};

// =============================
// 7️⃣ CACHE LRU POUR LES COMMENTAIRES
// =============================

class LRUCache {
  constructor(maxSize = DEFAULT_CONFIG.CACHE_MAX_SIZE, ttl = DEFAULT_CONFIG.CACHE_TTL) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  /**
   * Récupère un élément du cache (met à jour le LRU)
   * @param {string} key - Clé de cache
   * @returns {any|null}
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Vérifier l'expiration
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Mettre à jour le LRU (déplacer en fin)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.data;
  }
  
  /**
   * Stocke un élément dans le cache
   * @param {string} key - Clé de cache
   * @param {any} data - Données à stocker
   */
  set(key, data) {
    // Si la clé existe déjà, la supprimer pour la remettre en fin
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Éviction si trop d'éléments
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Vérifie si une clé existe et n'est pas expirée
   * @param {string} key - Clé de cache
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Supprime un élément du cache
   * @param {string} key - Clé de cache
   */
  delete(key) {
    this.cache.delete(key);
  }
  
  /**
   * Vide le cache
   */
  clear() {
    this.cache.clear();
  }
  
  /**
   * Retourne la taille du cache
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

// Instance unique du cache
export const commentCache = new LRUCache();

// =============================
// 8️⃣ EXPORT PAR DÉFAUT
// =============================

export default {
  organizeComments,
  canAddComment,
  recordCommentTime,
  validateComment,
  createTempComment,
  countTotalComments,
  getMaxDepth,
  getPinnedComments,
  formatRelativeTime,
  canEditComment,
  canDeleteComment,
  commentCache,
  LRUCache
};
