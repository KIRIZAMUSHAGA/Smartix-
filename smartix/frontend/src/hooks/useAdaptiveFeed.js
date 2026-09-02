import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { toast } from 'sonner';

// =============================
// CONSTANTES
// =============================
const BASE_LIMIT = 5;
const MAX_LIMIT = 20;
const MIN_LIMIT = 5;
const FAST_THRESHOLD = 200; // ms
const SLOW_THRESHOLD = 800; // ms
const EMA_ALPHA = 0.3;
const MAX_RETRIES = 2;
const BACKOFF_BASE = 500; // ms
const OFFLINE_TIMEOUT = 5000; // 5s avant de considérer hors-ligne

export const useAdaptiveFeed = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const { feedCache, updateFeedCache } = useGlobalCache();

  // =============================
  // ÉTATS
  // =============================
  const [posts, setPosts] = useState(() => feedCache?.posts || []);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState({
    createdAt: feedCache?.nextCursor?.createdAt || null,
    id: feedCache?.nextCursor?.id || null
  });
  const [hasMore, setHasMore] = useState(feedCache?.hasMore ?? true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // =============================
  // REFS
  // =============================
  const limitRef = useRef(BASE_LIMIT);
  const smoothedRTTRef = useRef(400);
  const abortControllerRef = useRef(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const offlineTimerRef = useRef(null);

  // =============================
  // DÉTECTION HORS-LIGNE
  // =============================
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connexion rétablie');
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mode hors-ligne');
      offlineTimerRef.current = setTimeout(() => {
        toast.error('Toujours hors-ligne, vérifiez votre connexion');
      }, OFFLINE_TIMEOUT);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  }, []);

  // =============================
  // NETTOYAGE
  // =============================
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // =============================
  // DÉDUPLICATION
  // =============================
  const deduplicatePosts = (postsArray) => {
    const map = new Map();
    postsArray.forEach(post => map.set(post.id, post));
    return Array.from(map.values());
  };

  // =============================
  // FONCTION PRINCIPALE
  // =============================
  const fetchFeed = useCallback(async (reset = false) => {
    // Vérifications préalables
    if (!user) {
      toast.error('Connectez-vous pour voir le feed');
      return;
    }

    if (!isOnline) {
      toast.warning('Mode hors-ligne, impossible de charger');
      return;
    }

    if ((!reset && (loading || loadingMore || !hasMore))) return;

    if (reset) {
      setLoading(true);
      setPosts([]);
      setCursor({ createdAt: null, id: null });
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    const startTime = performance.now();

    // Annulation requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      // Construction des paramètres
      const params = new URLSearchParams({
        limit: limitRef.current.toString()
      });

      if (cursor.createdAt) params.append('cursor_created_at', cursor.createdAt);
      if (cursor.id) params.append('cursor_id', cursor.id);
      if (user?.id) params.append('user_id', user.id);

      // Requête API
      const response = await client.get(`/api/feed?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
        timeout: 10000 // Timeout global 10s
      });

      const endTime = performance.now();
      const currentRTT = endTime - startTime;

      // EMA Smoothing
      smoothedRTTRef.current =
        (1 - EMA_ALPHA) * smoothedRTTRef.current +
        EMA_ALPHA * currentRTT;

      // Adaptation dynamique
      if (smoothedRTTRef.current < FAST_THRESHOLD) {
        limitRef.current = Math.min(MAX_LIMIT, limitRef.current + 2);
      } else if (smoothedRTTRef.current > SLOW_THRESHOLD) {
        limitRef.current = Math.max(MIN_LIMIT, limitRef.current - 1);
      }

      retryCountRef.current = 0;

      const data = response.data;

      if (isMountedRef.current) {
        setPosts(prev => {
          const mergedPosts = reset
            ? data.posts
            : deduplicatePosts([...prev, ...data.posts]);

          // Mise à jour du cache global
          updateFeedCache({
            posts: mergedPosts,
            nextCursor: {
              createdAt: data.next_cursor_created_at,
              id: data.next_cursor_id
            },
            hasMore: data.has_more ?? data.posts.length >= limitRef.current
          });

          return mergedPosts;
        });

        // Mise à jour curseur
        setCursor({
          createdAt: data.next_cursor_created_at || null,
          id: data.next_cursor_id || null
        });

        // Mise à jour hasMore
        setHasMore(
          data.has_more ?? data.posts.length >= limitRef.current
        );
      }

    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        console.error('Adaptive Feed Hook Error:', error);

        // Retry 503 avec backoff exponentiel
        if (error.response?.status === 503 && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          const backoff = Math.pow(2, retryCountRef.current) * BACKOFF_BASE;

          toast.warning(
            `Service temporairement indisponible, nouvelle tentative dans ${backoff / 1000}s`
          );

          setTimeout(() => {
            if (isMountedRef.current) {
              setLoading(false);
              setLoadingMore(false);
              fetchFeed(reset);
            }
          }, backoff);

          return;
        }

        // Messages utilisateur
        if (error.response?.status === 401) {
          toast.error('Session expirée, reconnectez-vous');
        } else if (error.response?.status === 429) {
          toast.error('Trop de requêtes, patientez');
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          toast.error('Connexion trop lente, réessayez');
        } else {
          toast.error('Erreur de chargement du feed');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [
    user,
    client,
    cursor,
    loading,
    loadingMore,
    hasMore,
    updateFeedCache,
    isOnline
  ]);

  // =============================
  // FONCTIONS DÉRIVÉES
  // =============================
  const resetFeed = useCallback(() => fetchFeed(true), [fetchFeed]);
  const loadMore = useCallback(() => fetchFeed(false), [fetchFeed]);

  const clearFeed = useCallback(() => {
    setPosts([]);
    setCursor({ createdAt: null, id: null });
    setHasMore(true);
    limitRef.current = BASE_LIMIT;
    retryCountRef.current = 0;
    updateFeedCache({
      posts: [],
      nextCursor: { createdAt: null, id: null },
      hasMore: true
    });
  }, [updateFeedCache]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    fetchFeed: loadMore,
    resetFeed,
    clearFeed,
    currentLimit: limitRef.current,
    currentRTT: smoothedRTTRef.current,
    isOnline
  };
};
