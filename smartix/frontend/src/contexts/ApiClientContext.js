/**
 * ApiClientContext.js - Version production avec architecture propre
 * - Client exposé directement
 * - Un seul event bus
 * - API cache propre
 * - Support réel d'AbortController
 * - ✅ Le refresh est géré par AuthContext (pas par apiClient)
 * - ✅ Ajout des méthodes d'export vidéo */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createApiClient } from '../config/apiClient';
import { useAuth } from '../hooks/useAuth';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ EVENT BUS UNIFIÉ (singleton)
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

  clear() {
    this.listeners.clear();
  }
}

// Event bus global (unique pour l'application)
const globalEventBus = new EventBus();

// =============================
// CONTEXTE
// =============================
const ApiClientContext = createContext(undefined);

// =============================
// 2️⃣ PROVIDER
// =============================
export const ApiClientProvider = ({ children, timeout = 30000 }) => {
  const { user, token, refreshToken, logout } = useAuth();

  // ✅ tokenRef toujours à jour — élimine la stale closure sur getToken
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // ✅ Stockage du client (useRef pour persistance + state pour réactivité)
  const clientRef = useRef(null);
  const [clientInstance, setClientInstance] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [clientError, setClientError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ Création du client — recréé uniquement si userId change
  useEffect(() => {
    console.log('[API_CLIENT_PROVIDER][EFFECT] client creation effect fired', {
      hasExistingClient: !!clientRef.current,
      existingClientUserId: clientRef.current?.userId,
      currentUserId: user?.id,
      hasToken: !!token,
    });

    if (!user || !token) {
      console.log('[API_CLIENT_PROVIDER][BLOCKING RETURN] user or token missing → clearing client', { hasUser: !!user, hasToken: !!token });
      clientRef.current = null;
      setClientInstance(null);
      setIsReady(false);
      setClientError(null);
      return;
    }

    // Ne pas recréer si déjà initialisé avec le même userId
    // Le token est lu depuis tokenRef.current — toujours à jour sans recréation
    if (clientRef.current && clientRef.current.userId === user?.id) {
      console.log('[API_CLIENT_PROVIDER][EFFECT] same userId, client reused (token via ref)', { userId: user?.id });
      return;
    }

    try {
      console.log('[API_CLIENT_PROVIDER][EFFECT] creating new API client for userId:', user.id);
      const client = createApiClient({
        userId: user.id,
        getToken: () => tokenRef.current,         // ✅ toujours le token courant
        timeout: timeout,
        onAuthError: () => {
          // ✅ Appel au refreshToken du contexte
          refreshToken().catch(() => {
            // Si refresh échoue, on logout
            logout();
          });
          globalEventBus.emit('auth:error');
        },
        onNetworkError: (error) => {
          globalEventBus.emit('network:error', error);
        },
        onCircuitOpen: (path) => {
          globalEventBus.emit('circuit:open', path);
        }
      });

      // ✅ Ajout des méthodes d'export vidéo au client
      client.exportStoryAsVideo = async (storyId, options = {}) => {
        return client.post(`/stories/${storyId}/export/video`, {
          image_url: options.imageUrl,
          music_url: options.musicUrl,
          duration: options.duration,
          filters: options.filters,
          elements: options.elements,
          text_style: options.textStyle,
          quality: options.quality || 'high',
          output_format: options.outputFormat || 'mp4'
        });
      };

      client.getExportStatus = async (taskId) => {
        return client.get(`/stories/export/status/${taskId}`);
      };

      client.cancelVideoExport = async (taskId) => {
        return client.delete(`/stories/export/${taskId}`);
      };

      clientRef.current = client;
      setClientInstance(client);
      setIsReady(true);
      setClientError(null);
      console.log('[API_CLIENT_PROVIDER][EFFECT] ✅ client created, isReady=true', { userId: user.id });

    } catch (error) {
      console.error('[API_CLIENT_PROVIDER][EFFECT] ❌ client creation FAILED:', error);
      setClientError(error.message);
      clientRef.current = null;
      setIsReady(false);
    }
  }, [user?.id, token, refreshToken, timeout, logout]);

  // ✅ Métriques via événements
  useEffect(() => {
    if (!clientRef.current) return;

    const handleMetricsUpdate = (newMetrics) => {
      setMetrics(newMetrics);
    };

    globalEventBus.on('metrics:updated', handleMetricsUpdate);
    setMetrics(clientRef.current.getMetrics?.() || null);

    return () => {
      globalEventBus.off('metrics:updated', handleMetricsUpdate);
    };
  }, []);

  // ✅ Nettoyage à la déconnexion
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.clearCache?.();
        clientRef.current.cancelPendingRequests?.();
      }
    };
  }, []);

  // =============================
  // 3️⃣ MÉTHODES DU CLIENT (stables)
  // =============================
  const get = useCallback(async (path, options = {}) => {
    if (!clientRef.current) throw new Error('Client non initialisé');
    return clientRef.current.get(path, options);
  }, []);

  const post = useCallback(async (path, body, options = {}) => {
    if (!clientRef.current) throw new Error('Client non initialisé');
    return clientRef.current.post(path, body, options);
  }, []);

  const put = useCallback(async (path, body, options = {}) => {
    if (!clientRef.current) throw new Error('Client non initialisé');
    return clientRef.current.put(path, body, options);
  }, []);

  const del = useCallback(async (path, options = {}) => {
    if (!clientRef.current) throw new Error('Client non initialisé');
    return clientRef.current.delete(path, options);
  }, []);

  const clearCache = useCallback(() => {
    clientRef.current?.clearCache?.();
  }, []);

  const cancelPendingRequests = useCallback(() => {
    clientRef.current?.cancelPendingRequests?.();
  }, []);

  const getMetrics = useCallback(() => {
    return clientRef.current?.getMetrics?.() || null;
  }, []);

  const getCircuitBreakerState = useCallback(() => {
    return clientRef.current?.getCircuitBreakerState?.() || {};
  }, []);

  const invalidateCache = useCallback((pattern) => {
    clientRef.current?.invalidateCache?.(pattern);
  }, []);

  const invalidateByTag = useCallback((tag) => {
    clientRef.current?.invalidateByTag?.(tag);
  }, []);

  // ✅ API cache propre (pas d'accès interne)
  const isCached = useCallback((key) => {
    return clientRef.current?.isCached?.(key) || false;
  }, []);

  const getCacheEntry = useCallback((key) => {
    return clientRef.current?.getCacheEntry?.(key) || null;
  }, []);

  // =============================
  // 4️⃣ ÉVÉNEMENTS (unifiés)
  // =============================
  const on = useCallback((event, callback) => {
    globalEventBus.on(event, callback);
  }, []);

  const off = useCallback((event, callback) => {
    globalEventBus.off(event, callback);
  }, []);

  const emit = useCallback((event, data) => {
    globalEventBus.emit(event, data);
  }, []);

  // =============================
  // 🆕 MÉTHODES D'EXPORT VIDÉO (exposées directement)
  // =============================
  const exportStoryAsVideo = useCallback(async (storyId, options = {}) => {
    if (!clientRef.current) throw new Error('Client non initialisé');
    return clientRef.current.exportStoryAsVideo(storyId, options);
  }, []);

  const getExportStatus = useCallback(async (taskId) => {
    if (!clientRef.current) throw new Error('Client non initialisé');
    return clientRef.current.getExportStatus(taskId);
  }, []);

  const cancelVideoExport = useCallback(async (taskId) => {
    if (!clientRef.current) throw new Error('Client non initialisé');
    return clientRef.current.cancelVideoExport(taskId);
  }, []);

  // =============================
  // 5️⃣ VALEUR DU CONTEXTE
  // =============================
  const value = useMemo(() => ({
    // État
    isReady,
    error: clientError,
    metrics,
    
    // ✅ Client exposé via state (réactif, pas ref)
    client: clientInstance,
    
    // Méthodes HTTP
    get,
    post,
    put,
    delete: del,
    
    // Utilitaires
    clearCache,
    cancelPendingRequests,
    getMetrics,
    getCircuitBreakerState,
    invalidateCache,
    invalidateByTag,
    isCached,
    getCacheEntry,
    
    // Événements (unifiés)
    on,
    off,
    emit,
    
    // 🆕 Méthodes d'export vidéo
    exportStoryAsVideo,
    getExportStatus,
    cancelVideoExport
    
  }), [
    isReady, clientInstance, clientError, metrics,
    get, post, put, del,
    clearCache, cancelPendingRequests, getMetrics,
    getCircuitBreakerState, invalidateCache, invalidateByTag,
    isCached, getCacheEntry,
    on, off, emit,
    exportStoryAsVideo, getExportStatus, cancelVideoExport
  ]);

  return (
    <ApiClientContext.Provider value={value}>
      {children}
    </ApiClientContext.Provider>
  );
};

// =============================
// 6️⃣ HOOKS (inchangés)
// =============================

export const useApiClient = () => {
  const context = useContext(ApiClientContext);
  if (context === undefined) {
    throw new Error('useApiClient must be used within an ApiClientProvider');
  }
  return context;
};

export const useApiRequest = () => {
  const { client, isReady } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const abortControllerRef = useRef(null);

  const execute = useCallback(async (method, ...args) => {
    if (!isReady || !client) {
      const err = 'Client API non prêt';
      setError(err);
      return { error: err };
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);

    try {
      const result = await client[method](...args, {
        signal: abortControllerRef.current.signal
      });
      setData(result);
      return { data: result };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { cancelled: true };
      }
      const errorMessage = err.message || err.status?.toString() || 'Erreur inconnue';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isReady, client]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { loading, error, data, execute, cancel, reset };
};

export const useQuery = ({
  key,
  queryFn,
  enabled = true,
  staleTime = 0,
  refetchOnFocus = false,
  refetchOnReconnect = false,
  retry = 0,
  retryDelay = 1000
}) => {
  const { client, on, off, isCached, getCacheEntry, isReady } = useApiClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef(null);

  const cacheKey = typeof key === 'string' ? key : JSON.stringify(key);
  const isCachedData = isCached(cacheKey);
  const cachedEntry = getCacheEntry(cacheKey);

  // ✅ Correction: Gestion correcte du staleTime
  useEffect(() => {
    if (cachedEntry?.expiry && staleTime > 0) {
      const isExpired = Date.now() > cachedEntry.expiry;
      setIsStale(isExpired);
    } else if (staleTime === 0) {
      setIsStale(false);
    }
  }, [cachedEntry, staleTime]);

  const fetchData = useCallback(async (skipRetry = false) => {
    if (!enabled || !isReady) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      // ✅ Correction: Signature correcte de queryFn
      const result = await queryFn({
        client,
        signal: abortControllerRef.current.signal
      });
      setData(result);
      setError(null);
      retryCountRef.current = 0;
      return result;
    } catch (err) {
      if (err.name === 'AbortError') return;
      
      if (!skipRetry && retry > 0 && retryCountRef.current < retry) {
        retryCountRef.current++;
        const delay = retryDelay * Math.pow(2, retryCountRef.current - 1);
        setTimeout(() => fetchData(true), delay);
        return;
      }
      
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, isReady, queryFn, client, retry, retryDelay]);

  useEffect(() => {
    if (!refetchOnFocus) return;
    
    const handleFocus = () => {
      if (isStale) fetchData();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnFocus, isStale, fetchData]);

  useEffect(() => {
    if (!refetchOnReconnect) return;
    
    const handleOnline = () => {
      if (isStale) fetchData();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, isStale, fetchData]);

  useEffect(() => {
    if (!enabled || !isReady) return;
    
    if (isCachedData && staleTime === 0) {
      setData(cachedEntry?.data);
      setLoading(false);
      setIsStale(false);
    } else {
      fetchData();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, isReady, cacheKey, isCachedData, staleTime, fetchData]);

  useEffect(() => {
    const handleInvalidation = ({ keys }) => {
      if (keys?.includes(cacheKey) || keys?.some(k => cacheKey.includes(k))) {
        fetchData();
      }
    };
    
    on('cache:invalidated', handleInvalidation);
    return () => off('cache:invalidated', handleInvalidation);
  }, [cacheKey, on, off, fetchData]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  return { data, loading, error, isStale, refetch };
};

export const useCachedGet = (path, options = {}) => {
  const { client, isReady, isCached, getCacheEntry } = useApiClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const abortControllerRef = useRef(null);

  const cacheKey = options.cacheKey || path;
  const useCache = options.useCache !== false;
  const tags = options.tags || [];

  const fetchData = useCallback(async () => {
    if (!isReady || !client) {
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const result = await client.get(path, {
        useCache,
        tags,
        signal: abortControllerRef.current.signal
      });
      
      setData(result);
      setError(null);
      setFromCache(isCached(cacheKey));
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [path, isReady, client, useCache, tags, cacheKey, isCached]);

  useEffect(() => {
    if (!isReady) return;

    const handleCacheUpdate = ({ key }) => {
      if (key === cacheKey || key?.includes(cacheKey)) {
        fetchData();
      }
    };

    globalEventBus.on('cache:updated', handleCacheUpdate);
    
    return () => globalEventBus.off('cache:updated', handleCacheUpdate);
  }, [isReady, cacheKey, fetchData]);

  useEffect(() => {
    fetchData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [path, useCache, JSON.stringify(options)]);

  return { data, loading, error, fromCache, refresh: fetchData };
};

export const useApiMetrics = () => {
  const { metrics } = useApiClient();
  return metrics;
};

export const useCircuitBreakerState = () => {
  const { getCircuitBreakerState, on, off } = useApiClient();
  const [state, setState] = useState({});

  useEffect(() => {
    const updateState = () => setState(getCircuitBreakerState());
    updateState();
    
    globalEventBus.on('circuit:updated', updateState);
    return () => globalEventBus.off('circuit:updated', updateState);
  }, [getCircuitBreakerState]);
  
  return state;
};

export const useNetworkEvents = () => {
  const [lastError, setLastError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleNetworkError = (error) => setLastError(error);
    const handleAuthError = () => setLastError({ type: 'auth' });
    
    globalEventBus.on('network:error', handleNetworkError);
    globalEventBus.on('auth:error', handleAuthError);
    
    return () => {
      globalEventBus.off('network:error', handleNetworkError);
      globalEventBus.off('auth:error', handleAuthError);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { lastError, isOnline };
};

// 🆕 Hook personnalisé pour l'export vidéo
export const useVideoExport = (storyId, options = {}) => {
  const { exportStoryAsVideo, getExportStatus, cancelVideoExport } = useApiClient();
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef(null);

  const startExport = useCallback(async (exportOptions = {}) => {
    try {
      setStatus('starting');
      setError(null);
      
      const response = await exportStoryAsVideo(storyId, { ...options, ...exportOptions });
      const newTaskId = response.task_id;
      setTaskId(newTaskId);
      setStatus('processing');
      setProgress(0);
      
      // Commencer le polling
      setIsPolling(true);
      
      return newTaskId;
    } catch (err) {
      setStatus('failed');
      setError(err.message);
      throw err;
    }
  }, [storyId, options, exportStoryAsVideo]);

  const cancel = useCallback(async () => {
    if (!taskId) return;
    
    try {
      await cancelVideoExport(taskId);
      setStatus('cancelled');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsPolling(false);
    } catch (err) {
      console.error('Error cancelling export:', err);
    }
  }, [taskId, cancelVideoExport]);

  // Polling automatique
  useEffect(() => {
    if (!taskId || status !== 'processing') return;

    const poll = async () => {
      try {
        const data = await getExportStatus(taskId);
        
        setProgress(data.progress);
        
        if (data.status === 'completed') {
          setStatus('completed');
          setVideoUrl(data.video_url);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsPolling(false);
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.error || 'Export échoué');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsPolling(false);
        } else if (data.status === 'cancelled') {
          setStatus('cancelled');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        setError(err.message);
        setStatus('failed');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsPolling(false);
      }
    };

    pollIntervalRef.current = setInterval(poll, 2000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [taskId, status, getExportStatus]);

  // Nettoyage final
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  return {
    startExport,
    cancel,
    status,
    progress,
    videoUrl,
    error,
    isPolling,
    taskId
  };
};

ApiClientProvider.propTypes = {
  children: PropTypes.node.isRequired,
  timeout: PropTypes.number,
};

export default ApiClientProvider;
