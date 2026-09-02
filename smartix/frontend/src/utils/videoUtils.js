

/**
 * Extensions vidéo valides (supportées nativement par les navigateurs modernes)
 */
const VALID_VIDEO_EXTENSIONS = [
  '.mp4', '.webm', '.ogg', '.mov', '.m4v'
];

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG = {
  preloadCount: 2,
  cleanupDistance: 3,
  maxRetries: 3,
  visibilityThreshold: 0.5,
  metadataTimeout: 5000,
  concurrentPreloads: 2,
  retryBackoffBase: 100,
  retryMaxDelay: 2000,
  visibilityCacheTTL: 100
};

// =============================
// 1️⃣ VALIDATION DES URLs
// =============================

/**
 * Vérifie si une URL a une extension vidéo valide
 * @param {string} url - L'URL à vérifier
 * @returns {boolean}
 */
const hasValidVideoExtension = (url) => {
  try {
    const pathname = new URL(url).pathname;
    const lowerPath = pathname.toLowerCase();
    return VALID_VIDEO_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
  } catch {
    return false;
  }
};

/**
 * Valide si une URL est une URL vidéo valide
 * @param {string} url - L'URL à valider
 * @returns {boolean} - True si l'URL est valide
 */
export const isValidVideoUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('blob:')) return true;
  if (url.startsWith('data:')) return true;
  
  try {
    const urlObj = new URL(url);
    const isValidProtocol = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    
    // Accepte les URLs CDN sans extension ou avec paramètres
    if (!isValidProtocol) return false;
    
    // Vérifier l'extension ou la présence d'indices vidéo
    const pathname = urlObj.pathname.toLowerCase();
    const hasVideoExt = VALID_VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
    const hasVideoKeyword = pathname.includes('/video/') || pathname.includes('/stream/');
    
    return hasVideoExt || hasVideoKeyword;
  } catch {
    return false;
  }
};

// =============================
// 2️⃣ PRÉCHARGEMENT SÉQUENTIEL AVEC ABORTCONTROLLER
// =============================

let activePreloads = 0;
let preloadQueue = [];
let preloadElements = new WeakMap(); // Stocke les AbortController
let isProcessingQueue = false;
let globalAbortController = null;

/**
 * Vérifie si une vidéo est déjà en cours de chargement
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @returns {boolean}
 */
const isVideoLoading = (video) => {
  return video && video.readyState < 2 && video.src && video.src.length > 0;
};

/**
 * Annule tous les préchargements en cours
 */
export const cancelAllPreloads = () => {
  if (globalAbortController) {
    globalAbortController.abort();
    globalAbortController = null;
  }
  
  for (const [video, controller] of preloadElements) {
    if (controller) controller.abort();
    if (video) {
      video.src = '';
      video.load();
    }
  }
  
  preloadElements.clear();
  preloadQueue = [];
  activePreloads = 0;
  isProcessingQueue = false;
};

/**
 * Précharge une vidéo individuelle avec AbortController
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @param {AbortSignal} signal - Signal d'annulation
 * @returns {Promise<boolean>}
 */
const preloadSingleVideo = (video, signal) => {
  return new Promise((resolve) => {
    if (!video) {
      resolve(false);
      return;
    }
    
    // Si déjà chargé ou en cours de chargement
    if (video.readyState >= 2) {
      resolve(true);
      return;
    }
    
    if (isVideoLoading(video)) {
      resolve(false);
      return;
    }
    
    // Vérifier si annulé
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    
    const abortHandler = () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      resolve(false);
    };
    
    if (signal) signal.addEventListener('abort', abortHandler, { once: true });
    
    const onCanPlay = () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      if (signal) signal.removeEventListener('abort', abortHandler);
      resolve(true);
    };
    
    const onError = () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      if (signal) signal.removeEventListener('abort', abortHandler);
      resolve(false);
    };
    
    video.addEventListener('canplay', onCanPlay, { once: true });
    video.addEventListener('error', onError, { once: true });
    
    try {
      video.load();
    } catch (err) {
      console.warn('Preload error:', err);
      resolve(false);
    }
  });
};

/**
 * Traite la file d'attente de préchargement (avec lock)
 */
const processPreloadQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  while (preloadQueue.length > 0 && activePreloads < DEFAULT_CONFIG.concurrentPreloads) {
    const { video, resolve, signal } = preloadQueue.shift();
    
    if (signal?.aborted) {
      resolve(false);
      continue;
    }
    
    activePreloads++;
    
    const result = await preloadSingleVideo(video, signal);
    
    activePreloads--;
    resolve(result);
  }
  
  isProcessingQueue = false;
};

/**
 * Précharge les vidéos suivantes de manière séquentielle
 * @param {Array} videoRefs - Références des éléments vidéo
 * @param {number} currentIndex - Index de la vidéo actuelle
 * @param {number} count - Nombre de vidéos à précharger (défaut: 2)
 * @returns {Promise<void>}
 */
export const preloadNextVideos = async (videoRefs, currentIndex, count = DEFAULT_CONFIG.preloadCount) => {
  // Annuler les préchargements précédents
  cancelAllPreloads();
  
  // Créer un nouvel AbortController pour ce batch
  globalAbortController = new AbortController();
  const signal = globalAbortController.signal;
  
  const promises = [];
  
  for (let i = 1; i <= count; i++) {
    const nextVideo = videoRefs[currentIndex + i];
    if (nextVideo && !preloadElements.has(nextVideo) && nextVideo.readyState < 2) {
      preloadElements.set(nextVideo, globalAbortController);
      
      promises.push(new Promise((resolve) => {
        preloadQueue.push({ video: nextVideo, resolve, signal });
        processPreloadQueue();
      }));
    }
  }
  
  await Promise.all(promises);
};

// =============================
// 3️⃣ NETTOYAGE DES VIDÉOS (SANS CASSER LES REFS)
// =============================

/**
 * Nettoie les vidéos éloignées pour libérer de la mémoire
 * @param {Array} videoRefs - Références des éléments vidéo
 * @param {number} currentIndex - Index de la vidéo actuelle
 * @param {number} distance - Distance au-delà de laquelle nettoyer (défaut: 3)
 */
export const cleanupDistantVideos = (videoRefs, currentIndex, distance = DEFAULT_CONFIG.cleanupDistance) => {
  videoRefs.forEach((video, idx) => {
    if (Math.abs(idx - currentIndex) > distance && video && video.src) {
      // Nettoyer sans remplacer le node pour préserver les refs React
      video.pause();
      video.removeAttribute('src');
      video.load();
      
      // Nettoyer les écouteurs d'événements si nécessaire
      if (video.cleanupListeners) {
        video.cleanupListeners();
        video.cleanupListeners = null;
      }
    }
  });
};

// =============================
// 4️⃣ TYPES D'ERREUR DE LECTURE
// =============================

export const PlaybackErrorType = {
  SUCCESS: 'success',
  NOT_ALLOWED: 'not_allowed',
  NETWORK: 'network',
  DECODE: 'decode',
  ABORTED: 'aborted',
  NOT_SUPPORTED: 'not_supported',
  UNKNOWN: 'unknown'
};

/**
 * Gère la lecture automatique avec gestion des erreurs et retry
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @param {Object} options - Options de lecture
 * @param {number} options.maxRetries - Nombre maximum de tentatives (défaut: 3)
 * @param {boolean} options.muted - Couper le son pour le retry (défaut: false)
 * @returns {Promise<{success: boolean, error: string, message?: string}>}
 */
export const playVideoSafely = async (video, options = {}) => {
  const { maxRetries = DEFAULT_CONFIG.maxRetries, muted = false } = options;
  
  if (!video) {
    return { success: false, error: PlaybackErrorType.UNKNOWN, message: 'No video element' };
  }
  
  // Configuration essentielle pour l'autoplay mobile
  video.playsInline = true;
  if (muted) video.muted = true;
  
  const originalMuted = video.muted;
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
        
        // Restaurer l'état du son si nécessaire
        if (muted && !originalMuted) {
          video.muted = originalMuted;
        }
        
        return { success: true, error: PlaybackErrorType.SUCCESS };
      }
    } catch (err) {
      lastError = err;
      
      // Ne pas retenter sur NotAllowedError (autoplay bloqué)
      if (err.name === 'NotAllowedError') {
        if (muted && !originalMuted) video.muted = originalMuted;
        return { success: false, error: PlaybackErrorType.NOT_ALLOWED, message: err.message };
      }
      
      // Ne pas retenter sur AbortError
      if (err.name === 'AbortError') {
        if (muted && !originalMuted) video.muted = originalMuted;
        return { success: false, error: PlaybackErrorType.ABORTED, message: err.message };
      }
      
      // Ne pas retenter sur NotSupportedError
      if (err.name === 'NotSupportedError') {
        if (muted && !originalMuted) video.muted = originalMuted;
        return { success: false, error: PlaybackErrorType.NOT_SUPPORTED, message: err.message };
      }
      
      if (attempt < maxRetries) {
        // Backoff exponentiel avec jitter pour éviter la congestion
        const baseDelay = DEFAULT_CONFIG.retryBackoffBase * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 100;
        const delay = Math.min(baseDelay + jitter, DEFAULT_CONFIG.retryMaxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Restaurer l'état du son
  if (muted && !originalMuted) {
    video.muted = originalMuted;
  }
  
  return { 
    success: false, 
    error: PlaybackErrorType.NETWORK, 
    message: lastError?.message || 'Échec de lecture après plusieurs tentatives'
  };
};

// =============================
// 5️⃣ GESTION DES RÉFÉRENCES VIDÉO
// =============================

/**
 * WeakMap pour le nettoyage automatique (évite les fuites mémoire)
 */
const videoCleanupRegistry = new WeakMap();

/**
 * Crée une référence de vidéo avec gestion mémoire
 * @param {Function} onCleanup - Callback de nettoyage
 * @returns {Object} - { ref, cleanup }
 */
export const createVideoRef = (onCleanup) => {
  let videoElement = null;
  
  const ref = (element) => {
    if (videoElement === element) return;
    
    // Nettoyer l'ancienne
    if (videoElement && videoCleanupRegistry.get(videoElement)) {
      const cleanup = videoCleanupRegistry.get(videoElement);
      if (cleanup) cleanup();
    }
    
    videoElement = element;
    
    if (videoElement && onCleanup) {
      videoCleanupRegistry.set(videoElement, () => onCleanup(videoElement));
    }
  };
  
  const cleanup = () => {
    if (videoElement) {
      const registeredCleanup = videoCleanupRegistry.get(videoElement);
      if (registeredCleanup) registeredCleanup();
      videoCleanupRegistry.delete(videoElement);
      videoElement = null;
    }
  };
  
  return { ref, cleanup };
};

// =============================
// 6️⃣ PRÉCHARGEMENT DES MÉTADONNÉES
// =============================

/**
 * Précharge les métadonnées de la vidéo avec timeout
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @param {number} timeoutMs - Timeout en millisecondes (défaut: 5000)
 * @returns {Promise<HTMLVideoElement>}
 */
export const preloadVideoMetadata = (video, timeoutMs = DEFAULT_CONFIG.metadataTimeout) => {
  return new Promise((resolve, reject) => {
    if (!video) return reject(new Error('No video element'));
    
    // Vérifier si déjà chargé
    if (video.src && video.readyState >= 1) {
      return resolve(video);
    }
    
    const timeoutId = setTimeout(() => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      reject(new Error(`Timeout: chargement des métadonnées > ${timeoutMs}ms`));
    }, timeoutMs);
    
    const onLoadedMetadata = () => {
      clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      resolve(video);
    };
    
    const onError = (e) => {
      clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      reject(e);
    };
    
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    video.addEventListener('error', onError, { once: true });
    
    video.load();
  });
};

// =============================
// 7️⃣ PROGRESSION ET CONTRÔLE
// =============================

/**
 * Calcule la progression de la vidéo
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @returns {Object} - { currentTime, duration, progress }
 */
export const getVideoProgress = (video) => {
  if (!video || !video.duration || isNaN(video.duration)) {
    return { currentTime: 0, duration: 0, progress: 0 };
  }
  const currentTime = video.currentTime;
  const duration = video.duration;
  return {
    currentTime,
    duration,
    progress: duration > 0 ? (currentTime / duration) * 100 : 0
  };
};

/**
 * Définit la progression de la vidéo
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @param {number} progress - Pourcentage (0-100)
 */
export const setVideoProgress = (video, progress) => {
  if (!video || !video.duration || isNaN(video.duration)) return;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const newTime = (clampedProgress / 100) * video.duration;
  video.currentTime = Math.min(Math.max(newTime, 0), video.duration);
};

/**
 * Formate la durée en mm:ss ou hh:mm:ss
 * @param {number} seconds - Durée en secondes
 * @returns {string}
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// =============================
// 8️⃣ UTILITAIRES SUPPLÉMENTAIRES
// =============================

/**
 * Met en pause toutes les vidéos sauf celle à l'index courant
 * @param {Array} videoRefs - Références des éléments vidéo
 * @param {number} currentIndex - Index de la vidéo à garder en lecture
 */
export const pauseOtherVideos = (videoRefs, currentIndex) => {
  videoRefs.forEach((video, idx) => {
    if (idx !== currentIndex && video && !video.paused) {
      video.pause();
      video.currentTime = 0;
    }
  });
};

/**
 * Vérifie si la vidéo est prête à être lue
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @returns {boolean}
 */
export const isVideoReady = (video) => {
  return video && video.readyState >= 2 && video.src;
};

/**
 * Crée un gestionnaire d'IntersectionObserver pour les vidéos
 * @param {Function} onVisible - Callback quand la vidéo devient visible
 * @param {Function} onHidden - Callback quand la vidéo devient cachée
 * @param {number} threshold - Seuil de visibilité
 * @returns {IntersectionObserver}
 */
export const createVideoVisibilityObserver = (onVisible, onHidden, threshold = DEFAULT_CONFIG.visibilityThreshold) => {
  return new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          onVisible(entry.target);
        } else {
          onHidden(entry.target);
        }
      });
    },
    { threshold }
  );
};

/**
 * Cache pour les calculs de visibilité (optimisation)
 */
let visibilityCache = new WeakMap();
let lastScrollTime = 0;
let pendingInvalidation = false;

/**
 * Invalide le cache de visibilité (efface tout)
 */
export const invalidateVisibilityCache = () => {
  visibilityCache = new WeakMap();
};

/**
 * Vérifie si une vidéo est visible dans le viewport
 * Utilise IntersectionObserver en priorité, fallback au calcul manuel
 * @param {HTMLVideoElement} video - L'élément vidéo
 * @param {number} threshold - Seuil de visibilité (0-1)
 * @param {IntersectionObserver} observer - Observer optionnel pour la détection
 * @returns {boolean}
 */
export const isVideoVisible = (video, threshold = DEFAULT_CONFIG.visibilityThreshold, observer = null) => {
  if (!video) return false;
  
  // Si un observer est fourni, l'utiliser en priorité
  if (observer) {
    const cached = visibilityCache.get(video);
    if (cached && Date.now() - cached.timestamp < DEFAULT_CONFIG.visibilityCacheTTL) {
      return cached.visible;
    }
    
    // Simuler la visibilité via l'observateur (dans un vrai cas, on utiliserait entry.isIntersecting)
    // Cette partie est laissée à l'implémentation de l'observateur
  }
  
  // Fallback au calcul manuel avec throttling
  const now = Date.now();
  if (now - lastScrollTime < DEFAULT_CONFIG.visibilityCacheTTL) {
    const cached = visibilityCache.get(video);
    if (cached) return cached.visible;
  }
  
  lastScrollTime = now;
  
  const rect = video.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;
  
  const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
  const visibleWidth = Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);
  
  const visibleArea = Math.max(0, visibleHeight) * Math.max(0, visibleWidth);
  const totalArea = rect.height * rect.width;
  
  const visible = totalArea > 0 ? visibleArea / totalArea >= threshold : false;
  
  visibilityCache.set(video, { visible, timestamp: now });
  
  return visible;
};

/**
 * Nettoie le cache de visibilité pour une vidéo
 * @param {HTMLVideoElement} video - L'élément vidéo
 */
export const clearVisibilityCache = (video) => {
  if (video) visibilityCache.delete(video);
};

// =============================
// 9️⃣ EXPORT PAR DÉFAUT
// =============================

export default {
  isValidVideoUrl,
  preloadNextVideos,
  cancelAllPreloads,
  cleanupDistantVideos,
  playVideoSafely,
  PlaybackErrorType,
  createVideoRef,
  preloadVideoMetadata,
  getVideoProgress,
  setVideoProgress,
  formatDuration,
  pauseOtherVideos,
  isVideoReady,
  createVideoVisibilityObserver,
  isVideoVisible,
  clearVisibilityCache,
  invalidateVisibilityCache
};
