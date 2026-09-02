

// =============================
// 0️⃣ TYPES (Optionnel - pour TypeScript)
// =============================

export interface ApiEndpoints {
  CLIPS_ENDPOINT: string;
  POST_ENDPOINT: string;
  COMMENTS_ENDPOINT: string;
  COMMENT_ENDPOINT: string;
  COMMENT_REACT_ENDPOINT: string;
  COMMENT_PIN_ENDPOINT: string;
  LIKE_ENDPOINT: string;
  SAVE_ENDPOINT: string;
  FOLLOW_ENDPOINT: string;
}

export interface PaginationConfig {
  CLIPS_PER_PAGE: number;
  COMMENTS_PER_PAGE: number;
  REPLIES_PER_PAGE: number;
  MAX_CLIPS_STORED: number;
  MAX_COMMENTS_STORED: number;
  INFINITE_SCROLL_THRESHOLD: number;
}

export interface VideoConfig {
  PRELOAD_COUNT: number;
  CLEANUP_DISTANCE: number;
  MAX_RETRIES: number;
  RETRY_DELAY_BASE: number;
  RETRY_JITTER_MAX: number;
  BUFFER_INDICATOR_DELAY: number;
  FREEZE_DETECTION_INTERVAL: number;
  PROGRESS_THROTTLE_MS: number;
  TIME_CHANGE_THRESHOLD: number;
  CONCURRENT_PRELOADS: number;
  METADATA_TIMEOUT: number;
}

export interface CommentsConfig {
  MAX_LENGTH: number;
  MAX_REPLY_LENGTH: number;
  WARNING_THRESHOLD: number;
  ANTI_SPAM_WINDOW_MS: number;
  ANTI_SPAM_MAX: number;
  MAX_DEPTH: number;
  MAX_VISIBLE_REPLIES: number;
  EDIT_WINDOW_MS: number;
  CACHE_TTL_MS: number;
  CACHE_MAX_SIZE: number;
}

export interface AntiSpamConfig {
  DEFAULT_WINDOW_MS: number;
  DEFAULT_MAX: number;
  LIKE_WINDOW_MS: number;
  LIKE_MAX: number;
  COMMENT_WINDOW_MS: number;
  COMMENT_MAX: number;
  DOWNLOAD_WINDOW_MS: number;
  DOWNLOAD_MAX: number;
}

export interface DownloadsConfig {
  RATE_LIMIT_PER_MINUTE: number;
  RATE_LIMIT_WINDOW_MS: number;
  TIMEOUT_MS: number;
  MAX_RETRIES: number;
  RETRY_DELAY_MS: number;
  HISTORY_RETENTION_DAYS: number;
  MAX_HISTORY_ENTRIES: number;
  MAX_CONCURRENT: number;
}

export interface GesturesConfig {
  LONG_PRESS_DURATION: number;
  TAP_MAX_DURATION: number;
  TAP_MAX_DISTANCE: number;
  SWIPE_MIN_DISTANCE: number;
  SWIPE_DIRECTION_RATIO: number;
  MOVEMENT_TOLERANCE: number;
  VIBRATION_THROTTLE_MS: number;
}

export interface UIConfig {
  IMMERSIVE_MODE_TOAST_DURATION: number;
  OFFLINE_TOAST_DURATION: number;
  ONLINE_TOAST_DURATION: number;
  TOAST_DEBOUNCE_MS: number;
  SKELETON_COUNT: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  SCREEN_BREAKPOINTS: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface ValidationConfig {
  URL_PROTOCOLS: string[];
  VALID_VIDEO_EXTENSIONS: string[];
  FILENAME_SANITIZE_REGEX: RegExp;
  MAX_URL_LENGTH: number;
}

export interface LoadingConfig {
  MIN_LOADING_TIME_MS: number;
  MAX_LOADING_TIME_MS: number;
  SKELETON_COUNT: number;
  SHIMMER_DURATION_MS: number;
}

export interface CacheConfig {
  STORIES_TTL_MS: number;
  COMMENTS_TTL_MS: number;
  USER_DATA_TTL_MS: number;
  MAX_ENTRIES: number;
}

export interface PerformanceConfig {
  SCROLL_THROTTLE_MS: number;
  VISIBILITY_CACHE_TTL_MS: number;
  RAF_THROTTLE_FPS: number;
  VIRTUALIZATION_THRESHOLD: number;
}

export interface NetworkConfig {
  CONNECTION_TYPES: {
    SLOW: string[];
    MEDIUM: string[];
    FAST: string[];
  };
  PING_URL: string;
  PING_TIMEOUT_MS: number;
  OFFLINE_CHECK_INTERVAL_MS: number;
}

// =============================
// 1️⃣ ENVIRONNEMENT
// =============================

/**
 * URL de base de l'API (dev/prod)
 */
export const BASE_URL = '/api';

/**
 * Construire l'URL d'un endpoint avec paramètres (sécurisé)
 * @param endpoint - Endpoint avec placeholders (:param)
 * @param params - Paramètres à remplacer
 * @returns URL complète
 * @throws Error si un paramètre requis est manquant
 */
export const buildUrl = (endpoint: string, params: Record<string, string | number> = {}): string => {
  let missingParams: string[] = [];
  
  const result = endpoint.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
    if (!(key in params)) {
      missingParams.push(key);
      return `:${key}`;
    }
    return encodeURIComponent(String(params[key]));
  });
  
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }
  
  // Ajouter le BASE_URL si l'endpoint ne commence pas par http
  if (!result.startsWith('http')) {
    return `${BASE_URL}${result.startsWith('/') ? result : `/${result}`}`;
  }
  
  return result;
};

// =============================
// 2️⃣ API ENDPOINTS
// =============================

export const API = {
  // Endpoints de base
  CLIPS_ENDPOINT: '/smartclips',
  POST_ENDPOINT: '/posts/:postId',
  
  // Commentaires
  COMMENTS_ENDPOINT: '/smartclips/:clipId/comments',
  COMMENT_ENDPOINT: '/comments/:commentId',
  COMMENT_REACT_ENDPOINT: '/comments/:commentId/react',
  COMMENT_PIN_ENDPOINT: '/comments/:commentId/pin',
  
  // Interactions
  LIKE_ENDPOINT: '/smartclips/:clipId/like',
  SAVE_ENDPOINT: '/smartclips/:clipId/save',
  FOLLOW_ENDPOINT: '/users/:userId/follow',
  
  // Fonctions utilitaires
  buildUrl
};

// =============================
// 3️⃣ PAGINATION
// =============================
export const PAGINATION: PaginationConfig = {
  CLIPS_PER_PAGE: 10,
  COMMENTS_PER_PAGE: 20,
  REPLIES_PER_PAGE: 10,
  MAX_CLIPS_STORED: 50,
  MAX_COMMENTS_STORED: 200,
  INFINITE_SCROLL_THRESHOLD: 2 // en nombre d'écrans
};

// =============================
// 4️⃣ VIDÉO (valeurs optimisées)
// =============================
export const VIDEO: VideoConfig = {
  PRELOAD_COUNT: 2,
  CLEANUP_DISTANCE: 3,
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  RETRY_JITTER_MAX: 300,
  BUFFER_INDICATOR_DELAY: 2000,
  FREEZE_DETECTION_INTERVAL: 1000, // 1 seconde (au lieu de 2)
  PROGRESS_THROTTLE_MS: 100,
  TIME_CHANGE_THRESHOLD: 0.25,
  CONCURRENT_PRELOADS: 2,
  METADATA_TIMEOUT: 5000
};

// =============================
// 5️⃣ ANTI-SPAM (centralisé)
// =============================
export const ANTI_SPAM: AntiSpamConfig = {
  DEFAULT_WINDOW_MS: 5000,
  DEFAULT_MAX: 5,
  LIKE_WINDOW_MS: 5000,
  LIKE_MAX: 5,
  COMMENT_WINDOW_MS: 10000,
  COMMENT_MAX: 3,
  DOWNLOAD_WINDOW_MS: 60000,
  DOWNLOAD_MAX: 3
};

// =============================
// 6️⃣ COMMENTAIRES
// =============================
export const COMMENTS: CommentsConfig = {
  MAX_LENGTH: 500,
  MAX_REPLY_LENGTH: 200,
  WARNING_THRESHOLD: 450,
  ANTI_SPAM_WINDOW_MS: ANTI_SPAM.COMMENT_WINDOW_MS,
  ANTI_SPAM_MAX: ANTI_SPAM.COMMENT_MAX,
  MAX_DEPTH: 10,
  MAX_VISIBLE_REPLIES: 5,
  EDIT_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  CACHE_TTL_MS: 60000,
  CACHE_MAX_SIZE: 50
};

// =============================
// 7️⃣ LIKES ET RÉACTIONS (valeurs optimisées)
// =============================
export const LIKES = {
  ANTI_SPAM_WINDOW_MS: ANTI_SPAM.LIKE_WINDOW_MS,
  ANTI_SPAM_MAX: ANTI_SPAM.LIKE_MAX,
  REQUEST_TIMEOUT_MS: 5000,
  DEBOUNCE_DELAY_MS: 300 // 300ms (au lieu de 1000)
};

// =============================
// 8️⃣ TÉLÉCHARGEMENTS
// =============================
export const DOWNLOADS: DownloadsConfig = {
  RATE_LIMIT_PER_MINUTE: ANTI_SPAM.DOWNLOAD_MAX,
  RATE_LIMIT_WINDOW_MS: ANTI_SPAM.DOWNLOAD_WINDOW_MS,
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  HISTORY_RETENTION_DAYS: 7,
  MAX_HISTORY_ENTRIES: 100,
  MAX_CONCURRENT: 2 // 2 au lieu de 1
};

// =============================
// 9️⃣ GESTES TACTILES
// =============================
export const GESTURES: GesturesConfig = {
  LONG_PRESS_DURATION: 500,
  TAP_MAX_DURATION: 300,
  TAP_MAX_DISTANCE: 15,
  SWIPE_MIN_DISTANCE: 50,
  SWIPE_DIRECTION_RATIO: 1.5,
  MOVEMENT_TOLERANCE: 10,
  VIBRATION_THROTTLE_MS: 500
};

// =============================
// 🔟 UI
// =============================
export const UI: UIConfig = {
  IMMERSIVE_MODE_TOAST_DURATION: 1000,
  OFFLINE_TOAST_DURATION: 4000,
  ONLINE_TOAST_DURATION: 2000,
  TOAST_DEBOUNCE_MS: 2000,
  SKELETON_COUNT: {
    mobile: 2,
    tablet: 3,
    desktop: 4
  },
  SCREEN_BREAKPOINTS: {
    mobile: 640,
    tablet: 768,
    desktop: 1024
  }
};

// =============================
// 1️⃣1️⃣ VALIDATION
// =============================
export const VALIDATION: ValidationConfig = {
  URL_PROTOCOLS: ['http:', 'https:'],
  VALID_VIDEO_EXTENSIONS: ['.mp4', '.webm', '.ogg', '.mov', '.m4v'],
  FILENAME_SANITIZE_REGEX: /[^a-z0-9._-]/gi,
  MAX_URL_LENGTH: 2000
};

// =============================
// 1️⃣2️⃣ LOADING
// =============================
export const LOADING: LoadingConfig = {
  MIN_LOADING_TIME_MS: 800,
  MAX_LOADING_TIME_MS: 5000,
  SKELETON_COUNT: 3,
  SHIMMER_DURATION_MS: 1500
};

// =============================
// 1️⃣3️⃣ CACHE
// =============================
export const CACHE: CacheConfig = {
  STORIES_TTL_MS: 60000,
  COMMENTS_TTL_MS: 300000,
  USER_DATA_TTL_MS: 300000,
  MAX_ENTRIES: 100
};

// =============================
// 1️⃣4️⃣ PERFORMANCE
// =============================
export const PERFORMANCE: PerformanceConfig = {
  SCROLL_THROTTLE_MS: 16,
  VISIBILITY_CACHE_TTL_MS: 100,
  RAF_THROTTLE_FPS: 30,
  VIRTUALIZATION_THRESHOLD: 50
};

// =============================
// 1️⃣5️⃣ RÉSEAU
// =============================
export const NETWORK: NetworkConfig = {
  CONNECTION_TYPES: {
    SLOW: ['2g', 'slow-2g'],
    MEDIUM: ['3g'],
    FAST: ['4g', '5g', 'wifi']
  },
  PING_URL: '/ping',
  PING_TIMEOUT_MS: 5000,
  OFFLINE_CHECK_INTERVAL_MS: 30000
};

// =============================
// 1️⃣6️⃣ EXPORT PAR DÉFAUT
// =============================
export default {
  BASE_URL,
  buildUrl,
  API,
  PAGINATION,
  VIDEO,
  ANTI_SPAM,
  COMMENTS,
  LIKES,
  DOWNLOADS,
  GESTURES,
  UI,
  VALIDATION,
  LOADING,
  CACHE,
  PERFORMANCE,
  NETWORK
};
