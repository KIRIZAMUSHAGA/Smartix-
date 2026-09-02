import { useState, useCallback, useRef, useEffect } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';
import { useApiClient } from '../../../contexts/ApiClientContext';

// =============================
// CONSTANTES
// =============================
const GIF_SEARCH_DEBOUNCE = 300;
const MAX_GIFS_PER_REQUEST = 20;
const GIF_SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

// =============================
// LRU CACHE POUR LES RECHERCHES GIF
// =============================
class GifCache {
  constructor(maxSize = MAX_CACHE_SIZE, ttl = GIF_SEARCH_CACHE_TTL) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Mettre à jour l'ordre (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

const gifCache = new GifCache();

// =============================
// FALLBACK GIFS EN CAS D'ERREUR RÉSEAU
// =============================
const getFallbackGifs = (query) => {
  const fallbacks = [
    { id: 'fallback-1', title: 'No results', images: { fixed_height: { url: '/placeholder-gif.gif' } } },
    { id: 'fallback-2', title: 'Try another search', images: { fixed_height: { url: '/placeholder-gif.gif' } } }
  ];
  
  if (query) {
    return fallbacks.map(g => ({
      ...g,
      title: `Aucun résultat pour "${query}"`
    }));
  }
  return fallbacks;
};

// =============================
// FORMATAGE DES GIFS
// =============================
const formatGif = (gif) => ({
  id: gif.id,
  title: gif.title || 'GIF',
  url: gif.images?.fixed_height?.url || gif.images?.original?.url,
  preview: gif.images?.fixed_height_small?.url || gif.images?.downsized?.url,
  width: gif.images?.fixed_height?.width || 200,
  height: gif.images?.fixed_height?.height || 200,
  source: gif.source || '',
  username: gif.username || ''
});

// =============================
// HOOK PRINCIPAL
// =============================
export const useGifSearch = () => {
  const { client } = useApiClient();
  const [gifs, setGifs] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  const abortControllerRef = useRef(null);
  const lastQueryRef = useRef(null);
  const requestIdRef = useRef(0);
  
  // Debounce pour la recherche
  const debouncedQuery = useDebounce(query, GIF_SEARCH_DEBOUNCE);

  // =============================
  // FONCTION DE RECHERCHE PRINCIPALE
  // =============================
  const performSearch = useCallback(async (searchQuery, pageNum = 1, append = false) => {
    if (!searchQuery || searchQuery.length < 2) {
      setGifs([]);
      setHasMore(true);
      setPage(1);
      return;
    }

    const requestId = ++requestIdRef.current;
    const cacheKey = `${searchQuery}:${pageNum}`;
    
    // Vérifier le cache
    if (pageNum === 1 && !append) {
      const cached = gifCache.get(cacheKey);
      if (cached) {
        setGifs(cached);
        setHasMore(cached.length === MAX_GIFS_PER_REQUEST);
        setError(null);
        return;
      }
    }
    
    // Annuler la requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setIsSearching(true);
    setError(null);
    lastQueryRef.current = searchQuery;

    try {
      const response = await client.get('/gifs/search', {
        params: {
          q: searchQuery,
          limit: MAX_GIFS_PER_REQUEST,
          offset: (pageNum - 1) * MAX_GIFS_PER_REQUEST
        },
        signal
      });
      
      // Ignorer si une requête plus récente est en cours
      if (requestId !== requestIdRef.current) return;
      
      const data = response.data;
      const newGifs = (data.data || []).map(formatGif);
      const more = newGifs.length === MAX_GIFS_PER_REQUEST;
      
      setGifs(prev => append ? [...prev, ...newGifs] : newGifs);
      setHasMore(more);
      setPage(pageNum);
      
      // Mettre en cache la première page
      if (pageNum === 1 && newGifs.length > 0) {
        gifCache.set(cacheKey, newGifs);
      }
      
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return; // Annulation normale
      }
      
      console.error('GIF search error:', err);
      setError(err.message || 'Erreur lors de la recherche');
      
      // Fallback en cas d'erreur réseau
      if (!append) {
        setGifs(getFallbackGifs(searchQuery));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [client]);

  // =============================
  // RECHERCHE AVEC DEBOUNCE
  // =============================
  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery, 1, false);
    } else {
      setGifs([]);
      setHasMore(true);
      setPage(1);
      setError(null);
    }
  }, [debouncedQuery, performSearch]);

  // =============================
  // CHARGER PLUS DE GIFS (PAGINATION)
  // =============================
  const loadMore = useCallback(() => {
    if (!isSearching && hasMore && debouncedQuery) {
      performSearch(debouncedQuery, page + 1, true);
    }
  }, [isSearching, hasMore, debouncedQuery, page, performSearch]);

  // =============================
  // DÉFINIR LA REQUÊTE (avec debounce intégré)
  // =============================
  const setSearchQuery = useCallback((q) => {
    setQuery(q);
    setError(null);
    setPage(1);
    setHasMore(true);
  }, []);

  // =============================
  // NETTOYAGE
  // =============================
  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setGifs([]);
    setIsSearching(false);
    setQuery('');
    setError(null);
    setHasMore(true);
    setPage(1);
    lastQueryRef.current = null;
    requestIdRef.current++;
  }, []);

  // =============================
  // NETTOYAGE AU DÉMONTAGE
  // =============================
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    gifs,
    isSearching,
    query,
    error,
    hasMore,
    search: setSearchQuery,
    loadMore,
    clear
  };
};
