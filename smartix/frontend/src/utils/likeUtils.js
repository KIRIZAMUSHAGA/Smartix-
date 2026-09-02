

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG = {
  TIMEOUT_MS: 3000,
  SPAM_WINDOW_MS: 5000, // 5 secondes
  MAX_LIKES_PER_WINDOW: 1, // 1 like toutes les 5 secondes
  MAX_PENDING_LIKES: 50,
  MAX_LIKES_PER_CLIP: 1000, // Limite par clip
  PENDING_EXPIRATION_MS: 10000, // 10 secondes
  BATCH_CONCURRENCY: 5, // Nombre de requêtes parallèles en batch
  RETRY_COUNT: 3,
  RETRY_DELAY_BASE: 1000,
  OFFLINE_QUEUE_KEY: 'offline_likes',
  DEBUG: process.env.NODE_ENV === 'development'
};

/**
 * Génère une clé de stockage unique pour un utilisateur
 * @param {string} userId
 * @returns {string}
 */
const getStorageKey = (userId) => `like_times_${userId}`;

/**
 * Génère une clé pour la queue offline
 * @returns {string}
 */
const getOfflineQueueKey = () => DEFAULT_CONFIG.OFFLINE_QUEUE_KEY;

// =============================
// CLASSE LIKE MANAGER (AVEC TIMESTAMP)
// =============================
export class LikeManager {
  constructor(config = {}) {
    this.pendingLikes = new Map(); // clipId -> timestamp
    this.offlineQueue = [];
    this.retryQueue = [];
    this.config = {
      timeoutMs: config.timeoutMs || DEFAULT_CONFIG.TIMEOUT_MS,
      debug: config.debug !== undefined ? config.debug : DEFAULT_CONFIG.DEBUG,
      toast: config.toast || null,
      navigate: config.navigate || null,
      apiClient: config.apiClient || null,
      isOnline: config.isOnline !== undefined ? config.isOnline : true
    };
    
    // Charger la queue offline depuis localStorage
    this._loadOfflineQueue();
    
    // Écouter les événements de connexion
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this._syncOfflineQueue());
    }
  }

  /**
   * Log conditionnel
   */
  _log(...args) {
    if (this.config.debug) {
      console.log('[LikeManager]', ...args);
    }
  }

  /**
   * Charge la queue offline depuis localStorage
   */
  _loadOfflineQueue() {
    try {
      const saved = localStorage.getItem(getOfflineQueueKey());
      if (saved) {
        this.offlineQueue = JSON.parse(saved);
        this._log('Queue offline chargée:', this.offlineQueue.length);
      }
    } catch (e) {
      console.error('Erreur chargement queue offline:', e);
    }
  }

  /**
   * Sauvegarde la queue offline dans localStorage
   */
  _saveOfflineQueue() {
    try {
      localStorage.setItem(getOfflineQueueKey(), JSON.stringify(this.offlineQueue));
    } catch (e) {
      console.error('Erreur sauvegarde queue offline:', e);
    }
  }

  /**
   * Nettoie les likes en cours trop anciens
   */
  clearOldPending() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [clipId, time] of this.pendingLikes.entries()) {
      if (now - time > DEFAULT_CONFIG.PENDING_EXPIRATION_MS) {
        this.pendingLikes.delete(clipId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this._log(`Nettoyé ${cleaned} likes en cours expirés`);
    }
  }

  /**
   * Vérifie si un like est déjà en cours pour un clip
   * @param {string} clipId
   * @returns {boolean}
   */
  isPending(clipId) {
    // Nettoyer d'abord les expirés
    this.clearOldPending();
    return this.pendingLikes.has(clipId);
  }

  /**
   * Ajoute un clip aux likes en cours (avec expiration)
   * @param {string} clipId
   * @returns {boolean} - True si ajouté, False si trop de pending
   */
  addPending(clipId) {
    this.clearOldPending();
    
    if (this.pendingLikes.size >= DEFAULT_CONFIG.MAX_PENDING_LIKES) {
      this._log('Trop de likes en cours');
      return false;
    }
    
    this.pendingLikes.set(clipId, Date.now());
    this._log('Like en cours:', clipId);
    return true;
  }

  /**
   * Retire un clip des likes en cours
   * @param {string} clipId
   */
  removePending(clipId) {
    this.pendingLikes.delete(clipId);
    this._log('Like terminé:', clipId);
  }

  /**
   * Nettoie tous les likes en cours
   */
  clearAllPending() {
    this.pendingLikes.clear();
    this._log('Tous les likes en cours ont été nettoyés');
  }

  /**
   * Ajoute un like à la queue offline
   * @param {string} clipId
   * @param {Function} likeFunction
   */
  addToOfflineQueue(clipId, likeFunction) {
    this.offlineQueue.push({
      clipId,
      likeFunction,
      timestamp: Date.now()
    });
    this._saveOfflineQueue();
    this._log('Like ajouté à la queue offline:', clipId);
  }

  /**
   * Synchronise la queue offline quand la connexion revient
   */
  async _syncOfflineQueue() {
    if (!this.config.isOnline || this.offlineQueue.length === 0) return;
    
    this._log(`Synchronisation de ${this.offlineQueue.length} likes offline...`);
    
    const queueCopy = [...this.offlineQueue];
    this.offlineQueue = [];
    this._saveOfflineQueue();
    
    for (const item of queueCopy) {
      try {
        await item.likeFunction();
        this._log(`Like offline synchronisé: ${item.clipId}`);
      } catch (err) {
        this._log(`Échec synchronisation offline: ${item.clipId}`, err);
        // Réajouter à la queue
        this.offlineQueue.push(item);
      }
    }
    
    this._saveOfflineQueue();
  }

  /**
   * Ajoute un retry à la queue
   * @param {string} clipId
   * @param {Function} likeFunction
   * @param {number} attempt
   */
  addToRetryQueue(clipId, likeFunction, attempt = 1) {
    this.retryQueue.push({
      clipId,
      likeFunction,
      attempt,
      timestamp: Date.now()
    });
    this._log(`Retry ajouté pour ${clipId} (tentative ${attempt})`);
    
    // Démarrer le traitement des retries
    this._processRetryQueue();
  }

  /**
   * Traite la queue des retries
   */
  async _processRetryQueue() {
    if (this._processingRetry) return;
    this._processingRetry = true;
    
    while (this.retryQueue.length > 0) {
      const item = this.retryQueue.shift();
      const delay = DEFAULT_CONFIG.RETRY_DELAY_BASE * Math.pow(2, item.attempt - 1);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        await item.likeFunction();
        this._log(`Retry réussi pour ${item.clipId}`);
      } catch (err) {
        if (item.attempt < DEFAULT_CONFIG.RETRY_COUNT) {
          this.addToRetryQueue(item.clipId, item.likeFunction, item.attempt + 1);
        } else {
          this._log(`Retry échoué pour ${item.clipId} après ${item.attempt} tentatives`);
          this.handleLikeError(err);
        }
      }
    }
    
    this._processingRetry = false;
  }

  /**
   * Crée une copie de l'état actuel d'un clip pour rollback
   * @param {Object} clip
   * @returns {Object}
   */
  createSnapshot(clip) {
    // Deep clone simple et scalable
    return JSON.parse(JSON.stringify(clip));
  }

  /**
   * Applique un like optimiste (incrémente ou décrémente)
   * @param {Object} clip
   * @returns {Object} - Nouvel état du clip
   */
  applyOptimisticLike(clip) {
    const wasLiked = clip.liked;
    let newLikes = clip.liked ? clip.likes - 1 : clip.likes + 1;
    
    // Limiter les likes par clip
    newLikes = Math.min(Math.max(0, newLikes), DEFAULT_CONFIG.MAX_LIKES_PER_CLIP);
    
    return {
      ...clip,
      liked: !wasLiked,
      likes: newLikes
    };
  }

  /**
   * Gère les erreurs de like avec messages appropriés
   * @param {Error} error
   * @param {Function} customNavigate - Fonction de navigation (optionnelle)
   */
  handleLikeError(error, customNavigate = null) {
    const toast = this.config.toast;
    const navigate = customNavigate || this.config.navigate;
    
    this._log('Erreur like:', error);
    
    if (!toast) {
      console.error('Toast non disponible:', error);
      return;
    }
    
    if (error.name === 'AbortError') {
      toast.error('Requête trop lente, réessayez');
    } else if (error.response?.status === 429) {
      toast.error('Trop de likes, ralentissez !');
    } else if (error.response?.status === 401) {
      toast.error('Session expirée');
      if (navigate) navigate('/login');
    } else if (error.response?.status === 403) {
      toast.error('Action non autorisée');
    } else if (!this.config.isOnline) {
      toast.info('Like ajouté à la file d\'attente (réseau instable)');
    } else if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    } else {
      toast.error('Erreur lors du like');
    }
  }

  /**
   * Crée un AbortController avec timeout
   * @returns {Object} - { controller, timeoutId }
   */
  createTimeoutController() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    return { controller, timeoutId };
  }

  /**
   * Nettoie un timeout
   * @param {number} timeoutId
   */
  clearTimeout(timeoutId) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Met à jour l'état de connexion
   * @param {boolean} isOnline
   */
  setOnlineStatus(isOnline) {
    this.config.isOnline = isOnline;
    if (isOnline) {
      this._syncOfflineQueue();
    }
  }
}

// =============================
// BATCH LIKE AVEC LIMITE DE CONCURRENCE
// =============================

/**
 * Traite des promesses avec une limite de concurrence
 * @param {Array} tasks - Liste de fonctions retournant une promesse
 * @param {number} concurrency - Nombre maximum de tâches simultanées
 * @returns {Promise<Array>}
 */
const runWithConcurrency = async (tasks, concurrency = DEFAULT_CONFIG.BATCH_CONCURRENCY) => {
  const results = [];
  const executing = new Set();
  
  for (const [index, task] of tasks.entries()) {
    const promise = task().then(result => ({ index, result, status: 'fulfilled' }))
      .catch(error => ({ index, error, status: 'rejected' }));
    
    results.push(promise);
    executing.add(promise);
    
    if (executing.size >= concurrency) {
      await Promise.race(executing);
      executing.delete(Array.from(executing)[0]);
    }
  }
  
  const settled = await Promise.all(results);
  
  // Réorganiser dans l'ordre original
  const ordered = new Array(tasks.length);
  for (const item of settled) {
    ordered[item.index] = item;
  }
  
  return ordered;
};

/**
 * Gère les likes en batch (pour plusieurs clips)
 * @param {Array} clipIds - IDs des clips à liker
 * @param {Function} likeFunction - Fonction de like
 * @param {number} concurrency - Limite de concurrence
 * @returns {Promise<Array>}
 */
export const batchLike = async (clipIds, likeFunction, concurrency = DEFAULT_CONFIG.BATCH_CONCURRENCY) => {
  const tasks = clipIds.map(id => () => likeFunction(id));
  const results = await runWithConcurrency(tasks, concurrency);
  
  return results.map((result, index) => ({
    clipId: clipIds[index],
    success: result.status === 'fulfilled',
    error: result.status === 'rejected' ? result.error : null
  }));
};

// =============================
// ANTI-SPAM FRONTEND (Avec localStorage)
// =============================

/**
 * Vérifie si l'utilisateur peut liker (anti-spam frontend)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} - { allowed: boolean, remainingTime: number, error: string|null }
 */
export const canLike = (userId) => {
  if (!userId) {
    return { allowed: true, remainingTime: 0, error: null };
  }
  
  const storageKey = getStorageKey(userId);
  const likeTimes = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const now = Date.now();
  
  // Trier pour garantir l'ordre
  const validLikes = likeTimes
    .filter(t => now - t < DEFAULT_CONFIG.SPAM_WINDOW_MS)
    .sort((a, b) => a - b);
  
  if (validLikes.length >= DEFAULT_CONFIG.MAX_LIKES_PER_WINDOW) {
    const oldestTime = validLikes[0];
    const remainingTime = DEFAULT_CONFIG.SPAM_WINDOW_MS - (now - oldestTime);
    return {
      allowed: false,
      remainingTime,
      error: `Trop de likes. Attendez ${Math.ceil(remainingTime / 1000)} secondes.`
    };
  }
  
  return { allowed: true, remainingTime: 0, error: null };
};

/**
 * Enregistre un like dans l'historique anti-spam
 * @param {string} userId - ID de l'utilisateur
 */
export const recordLikeTime = (userId) => {
  if (!userId) return;
  
  const storageKey = getStorageKey(userId);
  const likeTimes = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const now = Date.now();
  
  likeTimes.push(now);
  
  // Garder seulement les likes dans la fenêtre
  const validLikes = likeTimes
    .filter(t => now - t < DEFAULT_CONFIG.SPAM_WINDOW_MS)
    .sort((a, b) => a - b);
  
  localStorage.setItem(storageKey, JSON.stringify(validLikes.slice(-DEFAULT_CONFIG.MAX_LIKES_PER_WINDOW)));
};

/**
 * Nettoie l'historique des likes pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 */
export const clearLikeHistory = (userId = null) => {
  if (userId) {
    localStorage.removeItem(getStorageKey(userId));
  } else {
    // Nettoyer tous les historiques
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('like_times_')) {
        localStorage.removeItem(key);
      }
    });
  }
};

/**
 * Nettoie les historiques expirés (à appeler périodiquement)
 */
export const cleanupExpiredLikeHistory = () => {
  const now = Date.now();
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('like_times_')) {
      const likeTimes = JSON.parse(localStorage.getItem(key) || '[]');
      const validLikes = likeTimes.filter(t => now - t < DEFAULT_CONFIG.SPAM_WINDOW_MS);
      if (validLikes.length === 0) {
        localStorage.removeItem(key);
      } else if (validLikes.length !== likeTimes.length) {
        localStorage.setItem(key, JSON.stringify(validLikes));
      }
    }
  });
};

// =============================
// INSTANCE UNIQUE (Avec toast injectable)
// =============================

// Créer une instance sans toast par défaut (sera injectée plus tard)
export const likeManager = new LikeManager();

/**
 * Initialise le likeManager avec les dépendances
 * @param {Object} deps - Dépendances (toast, navigate, apiClient, isOnline)
 */
export const initLikeManager = (deps) => {
  if (deps.toast) likeManager.config.toast = deps.toast;
  if (deps.navigate) likeManager.config.navigate = deps.navigate;
  if (deps.apiClient) likeManager.config.apiClient = deps.apiClient;
  if (deps.isOnline !== undefined) likeManager.setOnlineStatus(deps.isOnline);
  if (deps.debug !== undefined) likeManager.config.debug = deps.debug;
};

/**
 * Met à jour l'état de connexion du likeManager
 * @param {boolean} isOnline
 */
export const setLikeManagerOnline = (isOnline) => {
  likeManager.setOnlineStatus(isOnline);
};

// =============================
// EXPORT PAR DÉFAUT
// =============================

export default {
  LikeManager,
  likeManager,
  initLikeManager,
  setLikeManagerOnline,
  canLike,
  recordLikeTime,
  clearLikeHistory,
  cleanupExpiredLikeHistory,
  batchLike
};
