/**
 * apiClient.js
 * Version production-ready - Cache par instance, retry intelligent, circuit breaker
 */

// =============================
// 1️⃣ CONFIGURATION
// =============================

const isReplitEnv = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('repl.co') || hostname.includes('replit.dev');
};

const getEnvApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (isReplitEnv()) return '/api';
  if (process.env.NODE_ENV === 'production') return '/api';
  return 'http://localhost:8000';
};

const normalizeBaseUrl = (url) => {
  if (!url) return 'http://localhost:8000';
  return url.replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeBaseUrl(getEnvApiUrl());
export const DEFAULT_TIMEOUT = 30000;
export const CACHE_TTL = 60 * 1000;
export const MAX_RETRIES = 2;
export const RETRY_DELAY = 1000;
export const CIRCUIT_BREAKER_THRESHOLD = 5;
export const CIRCUIT_BREAKER_TIMEOUT = 30000;

// =============================
// 2️⃣ UTILITAIRES
// =============================
const deepStableStringify = (obj) => {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object') return String(obj);
  
  if (Array.isArray(obj)) {
    return `[${obj.map(deepStableStringify).join(',')}]`;
  }
  
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => `${key}:${deepStableStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
};

// =============================
// 3️⃣ CIRCUIT BREAKER AVEC ÉVÉNEMENTS
// =============================
class CircuitBreaker {
  constructor(path) {
    this.path = path;
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
    this.emit = null; // Sera injecté
  }

  setEmit(emitFn) {
    this.emit = emitFn;
  }

  recordFailure() {
    this.failures++;
    if (this.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.state = 'OPEN';
      if (this.emit) {
        this.emit('circuit:updated', { path: this.path, state: this.state, failures: this.failures });
      }
      setTimeout(() => {
        this.state = 'HALF_OPEN';
        if (this.emit) {
          this.emit('circuit:updated', { path: this.path, state: this.state, failures: this.failures });
        }
      }, CIRCUIT_BREAKER_TIMEOUT);
    }
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      if (this.emit) {
        this.emit('circuit:updated', { path: this.path, state: this.state, failures: 0 });
      }
    } else if (this.state === 'CLOSED') {
      this.failures = 0;
    }
  }

  canRequest() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    return false;
  }
}

// =============================
// 4️⃣ FACTORY MULTI-USERS AVEC EVENT SYSTEM
// =============================
export const createApiClient = ({
  userId,
  getToken,           // ✅ fonction (pas token fixe)
  baseUrl = API_BASE_URL,
  timeout = DEFAULT_TIMEOUT,
  onAuthError = () => {},      // ✅ callback pour 401
  onNetworkError = () => {},
  onCircuitOpen = () => {}
}) => {

  if (!userId) throw new Error("createApiClient: userId required");
  if (!getToken) throw new Error("createApiClient: getToken required");

  // Cache par instance
  const cache = new Map();
  const pendingRequests = new Map();
  const circuitBreakers = new Map();
  const activeControllers = new Map();

  // ✅ EVENT SYSTEM
  const listeners = new Map();

  const on = (event, callback) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
  };

  const off = (event, callback) => {
    const arr = listeners.get(event);
    if (!arr) return;
    listeners.set(event, arr.filter(fn => fn !== callback));
  };

  const emit = (event, data) => {
    const callbacks = listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try { 
          cb(data); 
        } catch (e) { 
          console.error(`Event error in ${event}:`, e); 
        }
      });
    }
  };

  let metrics = {
    calls: 0,
    errors: 0,
    retries: 0,
    circuitOpens: 0,
    lastCall: null
  };

  const getMetrics = () => ({ ...metrics });
  const resetMetrics = () => {
    metrics = { calls: 0, errors: 0, retries: 0, circuitOpens: 0, lastCall: null };
    emit('metrics:updated', metrics);
  };

  const buildUrl = (path = '') => {
    if (!path) return baseUrl;
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  };

  const getCircuitBreaker = (path) => {
    const key = path.split('?')[0];
    if (!circuitBreakers.has(key)) {
      const cb = new CircuitBreaker(key);
      cb.setEmit(emit);
      circuitBreakers.set(key, cb);
    }
    return circuitBreakers.get(key);
  };

  const setCache = (key, data, ttl, tags = []) => {
    cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      tags
    });
    // ✅ Émettre événement cache updated
    emit('cache:updated', { key, tags });
  };

  const requestWithRetry = async (path, options, retries = MAX_RETRIES) => {
    const circuitBreaker = getCircuitBreaker(path);
    
    if (!circuitBreaker.canRequest()) {
      metrics.circuitOpens++;
      onCircuitOpen(path);
      emit('circuit:open', { path, state: circuitBreaker.state });
      throw { status: 503, message: 'Service temporairement indisponible' };
    }

    try {
      const result = await request(path, options);
      circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      const isRetryable = err.status === 0 || err.status === 408;
      if (isRetryable && retries > 0) {
        metrics.retries++;
        emit('request:retry', { path, retriesLeft: retries - 1 });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
        return requestWithRetry(path, options, retries - 1);
      }
      
      if (err.status >= 500 || err.status === 0) {
        circuitBreaker.recordFailure();
      }
      throw err;
    }
  };

  const request = async (path, options = {}) => {
    metrics.calls++;
    metrics.lastCall = Date.now();

    // ✅ Utiliser le signal passé en paramètre ou en créer un nouveau
    const externalSignal = options.signal;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Si un signal externe est fourni, l'utiliser avec le controller interne
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Aborted', 'AbortError');
      }
      externalSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
    
    const requestId = `${path}:${Date.now()}`;
    activeControllers.set(requestId, controller);

    try {
      const token = getToken();  // ✅ lecture dynamique
      const isFormData = options.body instanceof FormData;
      
      const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
      };

      emit('request:start', { path, method: options.method || 'GET' });

      const response = await fetch(buildUrl(path), {
        ...options,
        headers,
        signal: controller.signal
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const error = {
          status: response.status,
          message: data?.message || data?.detail || data?.error || `API error ${response.status}`,
          data: data
        };
        
        // ✅ Appel onAuthError pour 401 (sans refresh ici)
        if (response.status === 401) {
          onAuthError();
          emit('auth:error', error);
        }
        
        metrics.errors++;
        emit('request:error', { path, method: options.method || 'GET', error });
        throw error;
      }

      emit('request:complete', { path, method: options.method || 'GET', status: response.status });
      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = { status: 408, message: 'Request timeout' };
        onNetworkError(timeoutError);
        emit('request:timeout', { path, method: options.method || 'GET' });
        throw timeoutError;
      }
      
      if (!error.status) {
        const networkError = { status: 0, message: 'Network error', original: error };
        onNetworkError(networkError);
        emit('network:error', networkError);
        throw networkError;
      }
      
      throw error;
      
    } finally {
      clearTimeout(timeoutId);
      activeControllers.delete(requestId);
    }
  };

  // ✅ GET avec signal au premier niveau
  const get = async (path, { useCache = false, tags = [], signal, ...options } = {}) => {
    const cacheKey = `${path}:${deepStableStringify(options)}`;
    
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        emit('cache:hit', { key: cacheKey, path });
        return cached.data;
      }
      emit('cache:miss', { key: cacheKey, path });
    }

    if (pendingRequests.has(cacheKey)) {
      emit('request:deduplicated', { key: cacheKey, path });
      return pendingRequests.get(cacheKey);
    }

    const promise = requestWithRetry(path, { ...options, method: 'GET', signal })
      .then(data => {
        if (useCache) {
          setCache(cacheKey, data, CACHE_TTL, tags);
        }
        pendingRequests.delete(cacheKey);
        emit('request:success', { path, method: 'GET' });
        return data;
      })
      .catch(err => {
        pendingRequests.delete(cacheKey);
        throw err;
      });

    pendingRequests.set(cacheKey, promise);
    return promise;
  };

  // ✅ POST avec signal au premier niveau
  const post = async (path, body, { signal, ...options } = {}) => {
    const isFormData = body instanceof FormData;
    emit('request:start', { path, method: 'POST' });
    
    const result = await requestWithRetry(path, {
      ...options,
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
      signal
    });
    
    // Invalider le cache
    const invalidateTags = options.invalidateTags || ['posts'];
    let invalidatedKeys = [];
    invalidateTags.forEach(tag => {
      for (const [key, value] of cache.entries()) {
        if (value.tags?.includes(tag)) {
          cache.delete(key);
          invalidatedKeys.push(key);
        }
      }
    });
    
    if (invalidatedKeys.length > 0) {
      emit('cache:invalidated', { keys: invalidatedKeys, tags: invalidateTags });
    }
    
    emit('request:complete', { path, method: 'POST' });
    return result;
  };

  // ✅ PUT avec signal au premier niveau
  const put = async (path, body, { signal, ...options } = {}) => {
    const isFormData = body instanceof FormData;
    emit('request:start', { path, method: 'PUT' });
    
    const result = await requestWithRetry(path, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
      signal
    });
    
    const invalidateTags = options.invalidateTags || ['posts'];
    let invalidatedKeys = [];
    invalidateTags.forEach(tag => {
      for (const [key, value] of cache.entries()) {
        if (value.tags?.includes(tag)) {
          cache.delete(key);
          invalidatedKeys.push(key);
        }
      }
    });
    
    if (invalidatedKeys.length > 0) {
      emit('cache:invalidated', { keys: invalidatedKeys, tags: invalidateTags });
    }
    
    emit('request:complete', { path, method: 'PUT' });
    return result;
  };

  // ✅ DELETE avec signal au premier niveau
  const del = async (path, { signal, ...options } = {}) => {
    emit('request:start', { path, method: 'DELETE' });
    
    const result = await requestWithRetry(path, { ...options, method: 'DELETE', signal });
    
    const invalidateTags = options.invalidateTags || ['posts'];
    let invalidatedKeys = [];
    invalidateTags.forEach(tag => {
      for (const [key, value] of cache.entries()) {
        if (value.tags?.includes(tag)) {
          cache.delete(key);
          invalidatedKeys.push(key);
        }
      }
    });
    
    if (invalidatedKeys.length > 0) {
      emit('cache:invalidated', { keys: invalidatedKeys, tags: invalidateTags });
    }
    
    emit('request:complete', { path, method: 'DELETE' });
    return result;
  };

  const clearCache = () => {
    cache.clear();
    emit('cache:cleared', {});
  };
  
  const cancelPendingRequests = () => {
    for (const [id, controller] of activeControllers.entries()) {
      controller.abort();
    }
    pendingRequests.clear();
    emit('requests:cancelled', { count: activeControllers.size });
  };

  const isCached = (key) => cache.has(key);
  
  // ✅ getCacheEntry pour accéder aux entrées du cache
  const getCacheEntry = (key) => {
    const entry = cache.get(key);
    return entry || null;
  };

  const getApiUrl = (endpoint) => {
    return `${baseUrl}/${endpoint.replace(/^\/+/, '')}`;
  };

  return {
    userId,
    get,
    post,
    put,
    delete: del,
    getMetrics,
    resetMetrics,
    clearCache,
    cancelPendingRequests,
    isCached,
    getCacheEntry,  // ✅ Exposée
    getApiUrl,
    // ✅ Méthodes d'événements
    on,
    off,
    emit
  };
};

// =============================
// 5️⃣ GESTION DES IMAGES (AMÉLIORÉE)
// =============================

// ✅ Whitelist des domaines autorisés pour les images externes
const ALLOWED_IMAGE_DOMAINS = [
  'your-cdn.com',
  'your-api.com',
  'localhost',
  '127.0.0.1',
  'storage.googleapis.com',
  'images.unsplash.com',
  'cdn.pixabay.com',
  'cdn.pexels.com'
];

const FALLBACK_IMAGES = {
  posts: '/placeholder-post.jpg',
  avatars: '/default-avatar.png',
  uploads: '/placeholder-image.jpg',
  default: '/placeholder-image.jpg'
};

const sanitizePath = (path) => {
  if (!path) return '';
  return path
    .replace(/^\/+/, '')
    .replace(/\.\.\//g, '')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '');
};

// ✅ Vérification des URLs HTTP sécurisées
const isSafeHttpUrl = (url) => {
  if (!url) return false;
  if (!url.startsWith('http')) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    return ALLOWED_IMAGE_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
};

/**
 * ✅ Validation stricte des URLs d'images
 */
export const isValidImageUrl = (url) => {
  if (!url) return false;
  
  // URLs relatives (uploadées) sont autorisées
  if (url.startsWith('/uploads/')) return true;
  
  try {
    const parsed = new URL(url);
    
    // Vérifier le protocole
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('🚫 Protocole non autorisé:', parsed.protocol);
      return false;
    }
    
    // Vérifier le domaine
    const hostname = parsed.hostname;
    const isAllowed = ALLOWED_IMAGE_DOMAINS.some(domain => hostname.includes(domain));
    
    if (!isAllowed) {
      console.warn('🚫 Domaine non autorisé:', hostname);
    }
    
    return isAllowed;
  } catch (error) {
    console.warn('🚫 URL invalide:', url);
    return false;
  }
};

/**
 * ✅ Validation basique d'URL
 */
export const isValidUrl = (url) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * ✅ Génère une URL d'image optimisée pour le feed
 * @param {string} path - Chemin de l'image
 * @param {string} size - 'small' (400w), 'medium' (1080w), 'large' (original)
 * @returns {string|null} URL optimisée ou null si invalide
 */
export const getOptimizedImageUrl = (path, size = 'medium') => {
  if (!path) return null;
  
  // Valider l'URL
  if (!isValidImageUrl(path)) {
    return null;
  }
  
  // Si déjà URL complète et autorisée, la retourner
  if (path.startsWith('http')) return path;
  
  // Nettoyer le chemin
  const base = `${API_BASE_URL}/uploads`;
  const cleanPath = sanitizePath(path);
  
  if (!cleanPath) return FALLBACK_IMAGES.default;
  
  // Enlever l'extension pour ajouter .webp
  const nameWithoutExt = cleanPath.replace(/\.[^/.]+$/, '');
  
  // Format: /uploads/posts/optimized/size/filename.webp
  return `${base}/posts/optimized/${size}/${nameWithoutExt}.webp`;
};

/**
 * ✅ Version pour les avatars (taille plus petite)
 */
export const getOptimizedAvatarUrl = (avatarPath) => {
  return getOptimizedImageUrl(avatarPath, 'small') || getAvatarUrl(avatarPath);
};

/**
 * ✅ Version pour les images de posts (taille medium par défaut)
 */
export const getOptimizedPostImageUrl = (imagePath) => {
  return getOptimizedImageUrl(imagePath, 'medium') || getPostImageUrl(imagePath);
};

/**
 * ✅ Version pour les stories (taille spécifique)
 * @param {string} path - Chemin de l'image
 * @returns {string|null} URL optimisée
 */
export const getStoryImageUrl = (path) => {
  if (!path) return null;
  
  // Valider l'URL
  if (!isValidImageUrl(path)) {
    return null;
  }
  
  // Si déjà URL complète et autorisée
  if (path.startsWith('http')) {
    // Optimiser via CDN si possible (ex: Unsplash)
    if (path.includes('unsplash.com')) {
      return `${path}&w=500&h=900&fit=crop`; // Paramètres Unsplash
    }
    return path;
  }
  
  const base = `${API_BASE_URL}/uploads`;
  const cleanPath = sanitizePath(path);
  if (!cleanPath) return FALLBACK_IMAGES.default;
  
  // Format spécifique pour les stories
  return `${base}/stories/optimized/${cleanPath.replace(/\.[^/.]+$/, '')}.webp`;
};

/**
 * ✅ Fonction principale pour les images (avec fallback)
 */
export const getImageUrl = (path, type = 'uploads') => {
  if (!path) return FALLBACK_IMAGES[type] || FALLBACK_IMAGES.default;

  if (isSafeHttpUrl(path)) return path;

  const cleanPath = sanitizePath(path);
  if (!cleanPath) return FALLBACK_IMAGES[type] || FALLBACK_IMAGES.default;

  const base = `${API_BASE_URL}/uploads`;

  switch (type) {
    case 'posts':
      return `${base}/posts/${cleanPath}`;
    case 'avatars':
      return `${base}/avatars/${cleanPath}`;
    case 'uploads':
    default:
      return `${base}/${cleanPath}`;
  }
};

export const getAvatarUrl = (avatarPath) => {
  return getImageUrl(avatarPath, 'avatars');
};

export const getPostImageUrl = (imagePath) => {
  return getImageUrl(imagePath, 'posts');
};

// =============================
// 6️⃣ CONSTANTES API
// =============================
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me'
  },
  POSTS: {
    LIST: '/posts',
    CREATE: '/posts',
    GET: (id) => `/posts/${id}`,
    UPDATE: (id) => `/posts/${id}`,
    DELETE: (id) => `/posts/${id}`,
    LIKE: (id) => `/posts/${id}/like`
  },
  USERS: {
    PROFILE: (id) => `/users/${id}`,
    UPDATE: (id) => `/users/${id}`,
    FOLLOW: (id) => `/users/${id}/follow`
  },
  UPLOADS: {
    IMAGE: '/uploads/image',
    AVATAR: '/uploads/avatar'
  }
};

export default {
  API_BASE_URL,
  createApiClient,
  getApiUrl,
  getImageUrl,
  getAvatarUrl,
  getPostImageUrl,
  getOptimizedImageUrl,
  getOptimizedAvatarUrl,
  getOptimizedPostImageUrl,
  getStoryImageUrl,
  isValidImageUrl,
  isValidUrl,
  API_ENDPOINTS,
  FALLBACK_IMAGES
};
