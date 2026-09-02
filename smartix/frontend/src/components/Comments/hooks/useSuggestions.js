import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';
import { useApiClient } from '../../../contexts/ApiClientContext';

// =============================
// CONSTANTES
// =============================
const DEBOUNCE_DELAY = 200;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200; // Évite la croissance infinie

// =============================
// LRU CACHE AVEC TTL
// =============================
class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE, ttl = CACHE_TTL) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Vérifier TTL
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
    // Éviction si trop grand
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

const suggestionCache = new LRUCache();

// =============================
// FONCTIONS DE RECHERCHE AVEC ABORT CONTROLLER
// =============================

/**
 * Recherche d'utilisateurs pour les mentions @
 */
const fetchMentions = async (client, query, signal) => {
  if (!query || query.length < 2) return [];
  
  const cacheKey = `mentions:${query}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await client.get('/friends/users/search', {
      params: { q: query, limit: 10 },
      signal // ✅ Support d'annulation
    });
    
    const users = response.data?.data || [];
    const results = users.map(user => ({
      type: 'mention',
      value: `@${user.username}`,
      label: user.full_name,
      id: user.id,
      avatar: user.avatar,
      role: user.role,
      is_friend: user.is_friend || false
    }));
    
    suggestionCache.set(cacheKey, results);
    return results;
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'CanceledError') {
      return []; // Annulation silencieuse
    }
    console.error('Error fetching mentions:', error);
    return [];
  }
};

/**
 * Recherche de hashtags pour les suggestions #
 */
const fetchHashtags = async (client, query, signal) => {
  if (!query || query.length < 2) return [];
  
  const cacheKey = `hashtags:${query}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await client.get('/friends/tags/search', {
      params: { q: query, limit: 10 },
      signal // ✅ Support d'annulation
    });
    
    const tags = response.data?.data || [];
    const results = tags.map(tag => ({
      type: 'hashtag',
      value: `#${tag.name}`,
      label: tag.display_name,
      id: tag.id,
      post_count: tag.post_count,
      trending: tag.trending,
      category: tag.category
    }));
    
    suggestionCache.set(cacheKey, results);
    return results;
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'CanceledError') {
      return []; // Annulation silencieuse
    }
    console.error('Error fetching hashtags:', error);
    return getDefaultHashtags(query);
  }
};

/**
 * Tags par défaut en cas d'erreur réseau
 */
const getDefaultHashtags = (query) => {
  const defaultTags = [
    { name: 'comptabilite', display_name: '#comptabilité', post_count: 1234, trending: true, category: 'business' },
    { name: 'maths', display_name: '#maths', post_count: 987, trending: true, category: 'science' },
    { name: 'physique', display_name: '#physique', post_count: 876, trending: false, category: 'science' },
    { name: 'informatique', display_name: '#informatique', post_count: 765, trending: true, category: 'tech' },
    { name: 'python', display_name: '#Python', post_count: 543, trending: true, category: 'programming' }
  ];
  
  if (query) {
    return defaultTags
      .filter(t => t.name.includes(query.toLowerCase()))
      .map(t => ({
        type: 'hashtag',
        value: `#${t.name}`,
        label: t.display_name,
        id: t.name,
        post_count: t.post_count,
        trending: t.trending,
        category: t.category
      }));
  }
  return defaultTags.map(t => ({
    type: 'hashtag',
    value: `#${t.name}`,
    label: t.display_name,
    id: t.name,
    post_count: t.post_count,
    trending: t.trending,
    category: t.category
  }));
};

// =============================
// DÉTECTION CORRECTE DU MOT AU CURSEUR
// =============================
const getWordAtCursor = (text, cursorPosition) => {
  if (!text || cursorPosition === undefined) return null;
  
  // Trouver le début du mot (recherche en arrière)
  let start = cursorPosition;
  while (start > 0 && !/[#@\s]/.test(text[start - 1])) {
    start--;
  }
  
  // Vérifier si on a un déclencheur valide (@ ou #)
  if (start === 0 || !/[#@]/.test(text[start - 1])) {
    return null;
  }
  
  // ✅ RÈGLE CRITIQUE: Le trigger doit être au début de ligne ou après un espace
  if (start > 0 && !/\s/.test(text[start - 1])) {
    // Vérifier le caractère avant le trigger
    if (start > 1 && !/\s/.test(text[start - 2])) {
      return null;
    }
  }
  
  const trigger = text[start - 1];
  const word = text.substring(start, cursorPosition);
  
  // Ignorer les mots vides ou trop courts
  if (!word || word.length < 1) {
    return null;
  }
  
  return {
    start: start - 1,
    end: cursorPosition,
    trigger,
    word,
    fullText: text.substring(start - 1, cursorPosition)
  };
};

// =============================
// HOOK PRINCIPAL
// =============================

export const useSuggestions = (text, cursorPosition = null) => {
  const { client } = useApiClient();
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [currentWord, setCurrentWord] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  
  // ✅ Dépendances stables (uniquement word et trigger, pas l'objet entier)
  const debouncedQuery = useDebounce(currentWord?.word || '', DEBOUNCE_DELAY);
  const trigger = currentWord?.trigger;

  // =============================
  // DÉTECTION DU MOT AU CURSEUR
  // =============================
  useEffect(() => {
    const pos = cursorPosition !== null ? cursorPosition : text.length;
    const word = getWordAtCursor(text, pos);
    setCurrentWord(word);
    
    if (!word) {
      setShowSuggestions(false);
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }, [text, cursorPosition]);

  // =============================
  // ANNULATION DES REQUÊTES EN COURS
  // =============================
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // =============================
  // RECHERCHE DES SUGGESTIONS AVEC ABORT CONTROLLER
  // =============================
  useEffect(() => {
    if (!debouncedQuery || !trigger) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    
    // ✅ Annuler la requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const fetchSuggestions = async () => {
      setIsLoading(true);
      
      try {
        let results = [];
        if (trigger === '@') {
          results = await fetchMentions(client, debouncedQuery, signal);
        } else if (trigger === '#') {
          results = await fetchHashtags(client, debouncedQuery, signal);
        }
        
        // Ignorer si une requête plus récente est en cours
        if (requestId !== requestIdRef.current) return;
        
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        // ✅ Correction: initialiser correctement l'index actif
        setActiveIndex(results.length > 0 ? 0 : -1);
      } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
          // Annulation normale, ignorer
          return;
        }
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSuggestions();
    
    return () => {
      requestIdRef.current++;
    };
  }, [debouncedQuery, trigger, client]); // ✅ Dépendances stables

  // =============================
  // SÉLECTION D'UNE SUGGESTION
  // =============================
  const selectSuggestion = useCallback((suggestion) => {
    if (!currentWord) return text;
    
    const newWord = suggestion.value;
    const before = text.substring(0, currentWord.start);
    const after = text.substring(currentWord.end);
    
    return before + newWord + ' ' + after;
  }, [text, currentWord]);

  // =============================
  // NAVIGATION CLAVIER
  // =============================
  const navigate = useCallback((direction) => {
    if (!showSuggestions || suggestions.length === 0) return;
    
    setActiveIndex(prev => {
      if (direction === 'down') {
        return (prev + 1) % suggestions.length;
      }
      if (direction === 'up') {
        return (prev - 1 + suggestions.length) % suggestions.length;
      }
      return prev;
    });
  }, [showSuggestions, suggestions.length]);

  // =============================
  // RÉINITIALISATION
  // =============================
  const reset = useCallback(() => {
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    setCurrentWord(null);
    requestIdRef.current++;
    
    // ✅ Annuler toute requête en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    suggestions,
    showSuggestions,
    activeIndex,
    isLoading,
    currentWord,
    selectSuggestion,
    navigate,
    reset
  };
};
