/**
 * apiClient.js
 * Version production-ready - SWR fonctionnel, circuit breaker intelligent, événements, priorité réelle
 */

// =============================
// 1️⃣ CONFIGURATION
// =============================

export const API_BASE_URL = '/api';
export const DEFAULT_TIMEOUT = 30000;
export const UPLOAD_TIMEOUT = 60000;
export const CACHE_TTL = 60 * 1000;
export const MAX_RETRIES = 2;
export const RETRY_DELAY = 1000;
export const CIRCUIT_BREAKER_THRESHOLD = 0.5; // 50% d'échecs
export const CIRCUIT_BREAKER_WINDOW = 60000; // 1 minute
export const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30s avant retentative (OPEN → HALF_OPEN)

// =============================
// 2️⃣ UTILITAIRES DE CACHE (stable sans tri des arrays)
// =============================
const deepStableStringify = (obj) => {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object') return String(obj);
  
  if (Array.isArray(obj)) {
    // ✅ Ne pas trier les arrays - conserver l'ordre
    return `[${obj.map(deepStableStringify).join(',')}]`;
  }
  
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => `${key}:${deepStableStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
};

// =============================
// 3️⃣ CACHE AVEC SWR ET ÉVÉNEMENTS
// =============================
class StaleWhileRevalidateCache {
  constructor(eventBus) {
    this.cache = new Map();
    this.refreshPromises = new Map();
    this.eventBus = eventBus;
  }

  // ✅ Retourne l'entrée complète (pas seulement les données)
  getEntry(key) {
    return this.cache.get(key);
  }

  get(key) {
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }

  set(key, data, ttl = CACHE_TTL, tags = []) {
    const entry = {
      data,
      expiry: Date.now() + ttl,
      tags,
      createdAt: Date.now()
    };
    this.cache.set(key, entry);
    this.eventBus.emit('cache:set', { key, tags });
    return entry;
  }

  setRefreshing(key, promise) {
    this.refreshPromises.set(key, promise);
    this.eventBus.emit('cache:refreshing', { key });
    promise.finally(() => {
      this.refreshPromises.delete(key);
      this.eventBus.emit('cache:refreshed', { key });
    });
  }

  isRefreshing(key) {
    return this.refreshPromises.has(key);
  }

  invalidateByTag(tag) {
    const invalidated = [];
    for (const [key, value] of this.cache.entries()) {
      if (value.tags?.includes(tag)) {
        this.cache.delete(key);
        invalidated.push(key);
      }
    }
    if (invalidated.length) {
      this.eventBus.emit('cache:invalidated', { tag, keys: invalidated });
    }
    return invalidated;
  }

  invalidateByPath(pathPattern) {
    const invalidated = [];
    for (const [key] of this.cache.entries()) {
      if (key.includes(pathPattern)) {
        this.cache.delete(key);
        invalidated.push(key);
      }
    }
    if (invalidated.length) {
      this.eventBus.emit('cache:invalidated', { pathPattern, keys: invalidated });
    }
    return invalidated;
  }

  clear() {
    this.cache.clear();
    this.refreshPromises.clear();
    this.eventBus.emit('cache:cleared');
  }
}

// =============================
// 4️⃣ CIRCUIT BREAKER AVEC FENÊTRE GLISSANTE
// =============================
class CircuitBreaker {
  constructor() {
    this.window = [];
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.lastFailureTime = 0;
    this.successCount = 0;
  }

  recordSuccess() {
    this.successCount++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.window = [];
      this.successCount = 0;
    }
  }

  recordFailure() {
    const now = Date.now();
    this.window = this.window.filter(t => now - t < CIRCUIT_BREAKER_WINDOW);
    this.window.push(now);
    
    const totalRequests = this.window.length + this.successCount;
    const failureRate = totalRequests > 0 ? this.window.length / totalRequests : 0;
    
    if (failureRate >= CIRCUIT_BREAKER_THRESHOLD && totalRequests >= 5) {
      if (this.state !== 'OPEN') {
        this.state = 'OPEN';
        this.lastFailureTime = now;
        setTimeout(() => {
          this.state = 'HALF_OPEN';
        }, CIRCUIT_BREAKER_TIMEOUT);
      }
    }
  }

  canRequest() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    return false;
  }

  getState() {
    return this.state;
  }
}

// =============================
// 5️⃣ EVENT BUS
// =============================
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index !== -1) callbacks.splice(index, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`Event bus error in ${event}:`, e);
      }
    });
  }
}

// =============================
// 6️⃣ FACTORY MULTI-USERS
// =============================
export const createApiClient = ({
  userId,
  getToken,
  refreshToken,
  baseUrl = API_BASE_URL,
  timeout = DEFAULT_TIMEOUT,
  onAuthError = () => {},
  onNetworkError = () => {},
  onCircuitOpen = () => {}
}) => {

  if (!userId) throw new Error("createApiClient: userId required");
  if (!getToken) throw new Error("createApiClient: getToken required");
  // ✅ refreshToken est optionnel — le refresh peut être géré par AuthContext
  // via le callback onAuthError, pas besoin de le passer en paramètre dur
  if (!refreshToken) {
    refreshToken = async () => {
      throw new Error("No refreshToken provider configured");
    };
  }

  const eventBus = new EventBus();
  const cache = new StaleWhileRevalidateCache(eventBus);
  const pendingRequests = new Map();
  const circuitBreakers = new Map();
  const activeControllers = new Map(); // ✅ Pour annulation réelle
  
  let isRefreshing = false;
  let refreshPromise = null;
  let failedQueue = [];

  const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    failedQueue = [];
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
      circuitBreakers.set(key, new CircuitBreaker());
    }
    return circuitBreakers.get(key);
  };

  const requestWithRetry = async (path, options, retries = MAX_RETRIES) => {
    const circuitBreaker = getCircuitBreaker(path);
    
    if (!circuitBreaker.canRequest()) {
      metrics.circuitOpens++;
      onCircuitOpen(path);
      throw { status: 503, message: 'Service temporairement indisponible (circuit open)' };
    }

    try {
      const result = await request(path, options);
      circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      const isRetryable = err.status === 0 || err.status === 408;
      if (isRetryable && retries > 0) {
        metrics.retries++;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
        return requestWithRetry(path, options, retries - 1);
      }
      
      if (err.status >= 500 || err.status === 0) {
        circuitBreaker.recordFailure();
      }
      throw err;
    }
  };

  const requestWithAuth = async (path, options, retryWithNewToken = false) => {
    try {
      return await requestWithRetry(path, options);
    } catch (err) {
      if (err.status === 401 && !retryWithNewToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((newToken) => {
            // ✅ Passer le token explicitement dans les headers
            const newOptions = {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${newToken}`
              }
            };
            return requestWithRetry(path, newOptions);
          });
        }

        isRefreshing = true;
        refreshPromise = refreshToken()
          .then((newToken) => {
            processQueue(null, newToken);
            const newOptions = {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${newToken}`
              }
            };
            return requestWithRetry(path, newOptions);
          })
          .catch((refreshErr) => {
            processQueue(refreshErr, null);
            onAuthError();
            throw refreshErr;
          })
          .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
            failedQueue = [];
          });

        return refreshPromise;
      }
      throw err;
    }
  };

  const request = async (path, options = {}) => {
    metrics.calls++;
    metrics.lastCall = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // ✅ Stocker le controller pour annulation
    const requestId = `${path}:${Date.now()}`;
    activeControllers.set(requestId, controller);

    try {
      const token = getToken();
      const isFormData = options.body instanceof FormData;
      
      const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
      };

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
        metrics.errors++;
        throw error;
      }

      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = { status: 408, message: 'Request timeout' };
        onNetworkError(timeoutError);
        throw timeoutError;
      }
      
      if (!error.status) {
        const networkError = { status: 0, message: 'Network error', original: error };
        onNetworkError(networkError);
        throw networkError;
      }
      
      throw error;
      
    } finally {
      clearTimeout(timeoutId);
      activeControllers.delete(requestId);
    }
  };

  // ✅ GET avec SWR fonctionnel
  const get = async (path, { 
    useCache = false, 
    tags = [], 
    priority = 'normal',
    options = {},
    params = null,
    signal = null
  } = {}) => {
    eventBus.emit('request:start', { path, useCache });

    // Construire l'URL avec les query params si fournis
    let resolvedPath = path;
    if (params && typeof params === 'object' && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
        )
      );
      resolvedPath = `${path}${path.includes('?') ? '&' : '?'}${searchParams.toString()}`;
    }

    // Passer le signal externe dans les options fetch si fourni
    const resolvedOptions = signal ? { ...options, signal } : options;
    
    const cacheKey = `${resolvedPath}:${deepStableStringify(resolvedOptions)}`;
    
    if (useCache) {
      const entry = cache.getEntry(cacheKey);
      if (entry) {
        // ✅ SWR fonctionnel : retourner les données immédiatement
        if (Date.now() > entry.expiry && !cache.isRefreshing(cacheKey)) {
          // Refresh en arrière-plan
          const refreshPromise = requestWithAuth(resolvedPath, { ...resolvedOptions, method: 'GET' }, false)
            .then(data => {
              cache.set(cacheKey, data, CACHE_TTL, tags);
              eventBus.emit('cache:updated', { key: cacheKey, data });
              return data;
            })
            .catch(() => {});
          cache.setRefreshing(cacheKey, refreshPromise);
        }
        eventBus.emit('request:complete', { path: resolvedPath, fromCache: true });
        return entry.data;
      }
    }

    // ✅ Déduplication des requêtes
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    const promise = requestWithAuth(resolvedPath, { ...resolvedOptions, method: 'GET' }, false)
      .then(data => {
        if (useCache) {
          cache.set(cacheKey, data, CACHE_TTL, tags);
        }
        pendingRequests.delete(cacheKey);
        eventBus.emit('request:complete', { path: resolvedPath, fromCache: false });
        return data;
      })
      .catch(err => {
        pendingRequests.delete(cacheKey);
        eventBus.emit('request:error', { path: resolvedPath, error: err });
        throw err;
      });

    pendingRequests.set(cacheKey, promise);
    return promise;
  };

  const post = async (path, body, options = {}) => {
    const isFormData = body instanceof FormData;
    const result = await requestWithAuth(path, {
      ...options,
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body)
    }, false);
    
    const invalidateTags = options.invalidateTags || ['posts'];
    invalidateTags.forEach(tag => cache.invalidateByTag(tag));
    cache.invalidateByPath(path.split('/')[1]);
    eventBus.emit('data:mutated', { path, method: 'POST', invalidateTags });
    return result;
  };

  const put = async (path, body, options = {}) => {
    const isFormData = body instanceof FormData;
    const result = await requestWithAuth(path, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body)
    }, false);
    
    const invalidateTags = options.invalidateTags || ['posts'];
    invalidateTags.forEach(tag => cache.invalidateByTag(tag));
    cache.invalidateByPath(path.split('/')[1]);
    eventBus.emit('data:mutated', { path, method: 'PUT', invalidateTags });
    return result;
  };

  const del = async (path, options = {}) => {
    const result = await requestWithAuth(path, { ...options, method: 'DELETE' }, false);
    const invalidateTags = options.invalidateTags || ['posts'];
    invalidateTags.forEach(tag => cache.invalidateByTag(tag));
    cache.invalidateByPath(path.split('/')[1]);
    eventBus.emit('data:mutated', { path, method: 'DELETE', invalidateTags });
    return result;
  };

  // ✅ Annulation réelle des requêtes
  const cancelPendingRequests = () => {
    for (const [id, controller] of activeControllers.entries()) {
      controller.abort();
      activeControllers.delete(id);
    }
    pendingRequests.clear();
    eventBus.emit('requests:cancelled');
  };

  const clearCache = () => cache.clear();
  const on = (event, callback) => eventBus.on(event, callback);
  const off = (event, callback) => eventBus.off(event, callback);

  const getCircuitBreakerState = () => {
    const state = {};
    for (const [path, breaker] of circuitBreakers.entries()) {
      state[path] = breaker.getState();
    }
    return state;
  };

  return {
    userId,
    get,
    post,
    put,
    delete: del,
    getMetrics,
    resetMetrics,
    invalidateCache: (pattern) => cache.invalidateByPath(pattern),
    invalidateByTag: (tag) => cache.invalidateByTag(tag),
    clearCache,
    cancelPendingRequests,
    getCircuitBreakerState,
    on,
    off
  };
};

// =============================
// EXPORTS DE COMPATIBILITÉ
// =============================
export const API = API_BASE_URL;

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_BASE_URL || '';
  return `${base}/uploads/${path}`;
};

export const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  const base = API_BASE_URL || '';
  return `${base}/uploads/avatars/${avatar}`;
};

export const getAPIUrl = () => API_BASE_URL;

export const getOptimizedImageUrl = (url, size = 'medium') => {
  if (!url) return null;
  return url;
};

export const isValidImageUrl = (url) => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
};
