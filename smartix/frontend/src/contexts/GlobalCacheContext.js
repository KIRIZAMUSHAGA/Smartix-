import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { useApiClient } from './ApiClientContext'; // ✅ Utiliser le client API
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config/api';
import PropTypes from 'prop-types';

const GlobalCacheContext = createContext();

// ========== CONFIGURATION ==========
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_NEWS_DETAIL = 100;
const MAX_SMARTCLIPS_CACHE = 50;  // Max 50 vidéos en cache
const MAX_USERS_IN_MEMORY = 3;
// ✅ Plus besoin de API_BASE car on utilise le client

/* ==========================
   UTILITIES
========================== */

const createEmptyUserCache = () => ({
  createdAt: Date.now(),
  
  // Feed principal (posts)
  feed: {
    posts: { byId: {}, allIds: [] },
    likedPosts: {},
    page: 1,
    hasMore: true,
    lastFetch: null,
    scrollOffset: 0
  },
  
  // News
  news: {
    list: [],
    page: 1,
    hasMore: true,
    lastFetch: null,
    scrollOffset: 0
  },
  newsDetail: new Map(),
  
  // SmartClips
  smartclips: {
    watchedVideos: new Set(),
    clips: [],
    offset: 0,
    lastFetch: null,
    scrollOffset: 0,
    currentIndex: 0
  },

  // Notifications { data: Array, timestamp: number } | null
  notifications: null,

  // Conversations { data: Array, timestamp: number } | null
  conversations: null,
  
  // Positions de scroll (pour tous les écrans)
  scrollPositions: {},
  
  // Pages (pour tous les écrans)
  pages: {}
});

/* ==========================
   PROVIDER
========================== */

export const GlobalCacheProvider = ({ children, currentUserId }) => {
  // ✅ Récupérer le client API
  const { client: apiClient, isReady: isApiReady } = useApiClient();
  const { token } = useAuth();
  
  const userCaches = useRef({});
  const [newsState, setNewsState] = useState({ list: [], page: 1, hasMore: true });
  const [smartclipsState, setSmartclipsState] = useState({ 
    clips: [], 
    offset: 0, 
    currentIndex: 0,
    watchedCount: 0 
  });

  // ── FEED STATE ──
  const feedPageRef = useRef(1);
  const [feedState, setFeedState] = useState({ posts: [], hasMore: true });

  const loadFeedPosts = useCallback(async (reset = false) => {
    if (reset) feedPageRef.current = 1;
    const page = feedPageRef.current;

    let data;

    if (apiClient && isApiReady) {
      data = await apiClient.get(`/community/posts?page=${page}&limit=20`);
    } else {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = `${API_BASE_URL}/community/posts?page=${page}&limit=20`;
      let response;
      try {
        response = await fetch(url, { headers });
      } catch (networkErr) {
        throw new Error(`Erreur réseau: ${networkErr.message}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      try {
        data = await response.json();
      } catch (parseErr) {
        throw new Error(`Réponse invalide du serveur (${url})`);
      }
    }

    const newPosts = data?.items || data?.posts || (Array.isArray(data) ? data : []);
    const hasMore = newPosts.length === 20;
    feedPageRef.current = page + 1;
    setFeedState(prev => ({
      posts: reset ? newPosts : [...prev.posts, ...newPosts],
      hasMore,
    }));
  }, [apiClient, isApiReady, token]);

  const prependNewPosts = useCallback((newPosts) => {
    if (!Array.isArray(newPosts)) return;
    setFeedState(prev => ({
      ...prev,
      posts: [...newPosts, ...prev.posts],
    }));
  }, []);

  /* ==========================
     PERSISTANCE
  ========================== */
  
  const saveToStorage = useCallback((userId, data) => {
    try {
      // Convertir Maps et Sets en objets pour le stockage
      const newsDetailObj = {};
      data.newsDetail.forEach((value, key) => {
        newsDetailObj[key] = value;
      });
      
      const watchedVideosArray = Array.from(data.smartclips.watchedVideos);
      
      sessionStorage.setItem(`cache_${userId}`, JSON.stringify({
        news: data.news,
        newsDetail: newsDetailObj,
        smartclips: {
          ...data.smartclips,
          watchedVideos: watchedVideosArray  // Set converti en Array
        },
        scrollPositions: data.scrollPositions,
        pages: data.pages,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignorer (safari private mode)
    }
  }, []);

  const loadFromStorage = useCallback((userId) => {
    try {
      const saved = sessionStorage.getItem(`cache_${userId}`);
      if (saved) {
        const data = JSON.parse(saved);
        // Vérifier si le cache n'est pas trop vieux (24h max)
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          // Reconstruire la Map pour newsDetail
          const newsDetailMap = new Map();
          if (data.newsDetail) {
            Object.entries(data.newsDetail).forEach(([key, value]) => {
              newsDetailMap.set(key, value);
            });
          }
          
          // Reconstruire le Set pour watchedVideos
          const watchedVideosSet = new Set(data.smartclips?.watchedVideos || []);
          
          return {
            news: data.news || { list: [], page: 1, hasMore: true, lastFetch: null, scrollOffset: 0 },
            newsDetail: newsDetailMap,
            smartclips: {
              watchedVideos: watchedVideosSet,
              clips: data.smartclips?.clips || [],
              offset: data.smartclips?.offset || 0,
              lastFetch: data.smartclips?.lastFetch || null,
              scrollOffset: data.smartclips?.scrollOffset || 0,
              currentIndex: data.smartclips?.currentIndex || 0
            },
            scrollPositions: data.scrollPositions || {},
            pages: data.pages || {}
          };
        }
      }
    } catch (e) {
      console.warn('Error loading from storage:', e);
    }
    return null;
  }, []);

  /* ==========================
     USER CACHE ACCESS
  ========================== */

  const getUserCache = useCallback(() => {
    if (!currentUserId) return null;

    if (!userCaches.current[currentUserId]) {
      // Essayer de charger depuis sessionStorage
      const saved = loadFromStorage(currentUserId);
      
      if (saved) {
        userCaches.current[currentUserId] = {
          createdAt: Date.now(),
          ...saved
        };
      } else {
        // Limiter le nombre d'utilisateurs en mémoire
        const userIds = Object.keys(userCaches.current);
        if (userIds.length >= MAX_USERS_IN_MEMORY) {
          const oldest = userIds.sort(
            (a, b) => userCaches.current[a].createdAt - userCaches.current[b].createdAt
          )[0];
          delete userCaches.current[oldest];
        }

        userCaches.current[currentUserId] = createEmptyUserCache();
      }
    }

    return userCaches.current[currentUserId];
  }, [currentUserId, loadFromStorage]);

  // Sauvegarde automatique après modifications
  useEffect(() => {
    if (currentUserId && userCaches.current[currentUserId]) {
      saveToStorage(currentUserId, userCaches.current[currentUserId]);
    }
  }, [currentUserId, newsState, smartclipsState, saveToStorage]);

  /* ==========================
     NEWS CACHE
  ========================== */

  const isNewsCacheValid = useCallback(() => {
    const cache = getUserCache();
    if (!cache?.news?.lastFetch) return false;
    return Date.now() - cache.news.lastFetch < CACHE_TTL;
  }, [getUserCache]);

  const updateNewsCache = useCallback((newsList, page, hasMore) => {
    const cache = getUserCache();
    if (!cache) return;
    
    cache.news = {
      list: newsList,
      page,
      hasMore,
      lastFetch: Date.now(),
      scrollOffset: cache.news?.scrollOffset || 0
    };
    
    setNewsState(cache.news);
  }, [getUserCache]);

  const getNewsCache = useCallback(() => {
    const cache = getUserCache();
    return cache?.news || { list: [], page: 1, hasMore: true, lastFetch: null, scrollOffset: 0 };
  }, [getUserCache]);

  const updateNewsItemInCache = useCallback((id, updates) => {
    const cache = getUserCache();
    if (!cache?.news) return;
    
    cache.news.list = cache.news.list.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    
    setNewsState(cache.news);
    
    // Mettre à jour aussi dans newsDetail si présent
    if (cache.newsDetail.has(id)) {
      const detail = cache.newsDetail.get(id);
      cache.newsDetail.set(id, {
        ...detail,
        article: { ...detail.article, ...updates }
      });
    }
  }, [getUserCache]);

  /**
   * Récupère un article depuis la liste des news
   */
  const getNewsItem = useCallback((newsId) => {
    const cache = getUserCache();
    if (!cache) return null;
    
    // Chercher d'abord dans la liste
    const fromList = cache.news?.list?.find(item => item.id === newsId);
    if (fromList) return fromList;
    
    // Sinon dans le détail
    const detailEntry = cache.newsDetail.get(newsId);
    return detailEntry?.article || null;
  }, [getUserCache]);

  /**
   * Invalide le cache des news (force le rechargement)
   */
  const invalidateNewsCache = useCallback(() => {
    const cache = getUserCache();
    if (!cache) return;
    
    cache.news.lastFetch = null;
    cache.news.list = [];
    cache.news.page = 1;
    setNewsState({ list: [], page: 1, hasMore: true });
    
    // Sauvegarder immédiatement
    if (currentUserId) {
      saveToStorage(currentUserId, cache);
    }
  }, [getUserCache, currentUserId, saveToStorage]);

  /* ==========================
     NEWS DETAIL LRU
  ========================== */

  const cacheNewsDetail = useCallback((id, article) => {
    const cache = getUserCache();
    if (!cache) return;

    const newsMap = cache.newsDetail;

    // LRU: supprimer la plus ancienne si plein
    if (newsMap.size >= MAX_NEWS_DETAIL) {
      const firstKey = newsMap.keys().next().value;
      newsMap.delete(firstKey);
    }

    newsMap.set(id, {
      article,
      cachedAt: Date.now()
    });
  }, [getUserCache]);

  /**
   * Récupère un article du cache détail avec option de fetch automatique
   * @param {string} id - ID de l'article
   * @param {boolean} fetchIfMissing - Si true, va chercher l'article via API si pas en cache
   */
  const getNewsDetailCache = useCallback(async (id, fetchIfMissing = false) => {
    const cache = getUserCache();
    if (!cache) return null;

    const entry = cache.newsDetail.get(id);
    if (entry) {
      // Vérifier TTL
      if (Date.now() - entry.cachedAt <= CACHE_TTL) {
        return entry.article;
      } else {
        cache.newsDetail.delete(id);
      }
    }

    // ✅ Si demandé, aller chercher l'article via le client API (pas axios direct)
    if (fetchIfMissing && isApiReady && apiClient) {
      try {
        // ✅ Utiliser le client API avec les bons paramètres
        const article = await apiClient.get(`/news/${id}`, { useCache: true, tags: ['news'] });
        cacheNewsDetail(id, article);
        return article;
      } catch (error) {
        console.error('Error fetching missing article:', error);
        return null;
      }
    }

    return null;
  }, [getUserCache, cacheNewsDetail, apiClient, isApiReady]);

  /* ==========================
     SMARTCLIPS CACHE
  ========================== */

  /**
   * Marquer une vidéo comme regardée
   */
  const markVideoWatched = useCallback((videoId) => {
    const cache = getUserCache();
    if (!cache) return;
    
    cache.smartclips.watchedVideos.add(videoId);
    
    setSmartclipsState(prev => ({
      ...prev,
      watchedCount: cache.smartclips.watchedVideos.size
    }));
    
    // Sauvegarde dans sessionStorage
    saveToStorage(currentUserId, cache);
  }, [getUserCache, currentUserId, saveToStorage]);

  /**
   * Vérifier si une vidéo a été regardée
   */
  const isVideoWatched = useCallback((videoId) => {
    const cache = getUserCache();
    return cache?.smartclips?.watchedVideos.has(videoId) || false;
  }, [getUserCache]);

  /**
   * Récupérer la liste des vidéos regardées
   */
  const getWatchedVideos = useCallback(() => {
    const cache = getUserCache();
    return cache?.smartclips?.watchedVideos ? Array.from(cache.smartclips.watchedVideos) : [];
  }, [getUserCache]);

  /**
   * Mettre à jour le cache des clips SmartClips
   */
  const updateSmartclipsCache = useCallback((clips, offset, hasMore) => {
    const cache = getUserCache();
    if (!cache) return;
    
    // Garder seulement les MAX_SMARTCLIPS_CACHE clips les plus récents
    const allClips = [...(cache.smartclips.clips || []), ...clips];
    const uniqueClips = [];
    const seenIds = new Set();
    
    // Éviter les doublons
    for (const clip of allClips) {
      if (!seenIds.has(clip.id) && uniqueClips.length < MAX_SMARTCLIPS_CACHE) {
        seenIds.add(clip.id);
        uniqueClips.push(clip);
      }
    }
    
    cache.smartclips = {
      ...cache.smartclips,
      clips: uniqueClips,
      offset,
      hasMore,
      lastFetch: Date.now()
    };
    
    setSmartclipsState(prev => ({
      ...prev,
      clips: uniqueClips,
      offset
    }));
  }, [getUserCache]);

  /**
   * Récupérer le cache SmartClips
   */
  const getSmartclipsCache = useCallback(() => {
    const cache = getUserCache();
    return cache?.smartclips || { 
      clips: [], 
      offset: 0, 
      hasMore: true, 
      lastFetch: null,
      watchedVideos: new Set(),
      scrollOffset: 0,
      currentIndex: 0
    };
  }, [getUserCache]);

  /**
   * Vérifier si le cache SmartClips est valide
   */
  const isSmartclipsCacheValid = useCallback(() => {
    const cache = getUserCache();
    if (!cache?.smartclips?.lastFetch) return false;
    return Date.now() - cache.smartclips.lastFetch < CACHE_TTL;
  }, [getUserCache]);

  /**
   * Mettre à jour l'index courant
   */
  const setSmartclipsCurrentIndex = useCallback((index) => {
    const cache = getUserCache();
    if (!cache) return;
    
    cache.smartclips.currentIndex = index;
    setSmartclipsState(prev => ({ ...prev, currentIndex: index }));
  }, [getUserCache]);

  /**
   * Récupérer l'index courant
   */
  const getSmartclipsCurrentIndex = useCallback(() => {
    const cache = getUserCache();
    return cache?.smartclips?.currentIndex || 0;
  }, [getUserCache]);

  /**
   * Effacer l'historique des vidéos regardées
   */
  const clearWatchedHistory = useCallback(() => {
    const cache = getUserCache();
    if (!cache) return;
    
    cache.smartclips.watchedVideos.clear();
    setSmartclipsState(prev => ({ ...prev, watchedCount: 0 }));
    saveToStorage(currentUserId, cache);
  }, [getUserCache, currentUserId, saveToStorage]);

  /**
   * Récupérer un clip SmartClips par son ID
   */
  const getSmartclipsClip = useCallback((clipId) => {
    const cache = getUserCache();
    if (!cache) return null;
    
    const clip = cache.smartclips.clips.find(c => c.id === clipId);
    if (clip) return clip;
    
    // Chercher dans les pages suivantes si nécessaire
    return null;
  }, [getUserCache]);

  /**
   * Précharger les vidéos adjacentes
   */
  const preloadSmartclips = useCallback((direction = 'next') => {
    const cache = getUserCache();
    if (!cache) return;
    
    const currentIndex = cache.smartclips.currentIndex || 0;
    const clips = cache.smartclips.clips || [];
    
    if (direction === 'next' && currentIndex < clips.length - 2) {
      // Précharger la vidéo suivante
      const nextClip = clips[currentIndex + 1];
      if (nextClip?.thumbnail_url) {
        const img = new Image();
        img.src = nextClip.thumbnail_url;
      }
    } else if (direction === 'prev' && currentIndex > 0) {
      // Précharger la vidéo précédente
      const prevClip = clips[currentIndex - 1];
      if (prevClip?.thumbnail_url) {
        const img = new Image();
        img.src = prevClip.thumbnail_url;
      }
    }
  }, [getUserCache]);

  /**
   * Récupérer le nombre de vidéos regardées
   */
  const getSmartclipsWatchedCount = useCallback(() => {
    const cache = getUserCache();
    return cache?.smartclips?.watchedVideos?.size || 0;
  }, [getUserCache]);

  /**
   * Récupérer la progression dans les SmartClips
   */
  const getSmartclipsProgress = useCallback(() => {
    const cache = getUserCache();
    if (!cache) return { watched: 0, total: 0, percentage: 0 };
    
    const watched = cache.smartclips.watchedVideos?.size || 0;
    const total = cache.smartclips.clips?.length || 0;
    
    return {
      watched,
      total,
      percentage: total > 0 ? Math.round((watched / total) * 100) : 0
    };
  }, [getUserCache]);

  /* ==========================
     FEED CACHE (AJOUTÉ)
  ========================== */

  /**
   * Récupère le cache du feed pour l'utilisateur courant
   */
  const getFeedCache = useCallback(() => {
    const cache = getUserCache();
    if (!cache?.feed) return { posts: [], page: 1, hasMore: true, lastFetch: null, scrollOffset: 0 };
    
    // Convertir le format { byId, allIds } en tableau simple pour faciliter l'utilisation
    const postsArray = cache.feed.posts?.allIds?.map(id => cache.feed.posts.byId[id]) || [];
    
    return {
      posts: postsArray,
      page: cache.feed.page || 1,
      hasMore: cache.feed.hasMore ?? true,
      lastFetch: cache.feed.lastFetch,
      scrollOffset: cache.feed.scrollOffset || 0,
      likedPosts: cache.feed.likedPosts || {}
    };
  }, [getUserCache]);

  /**
   * Met à jour le cache du feed
   * @param {Object} feedData - Données du feed
   * @param {Array} feedData.posts - Liste des posts (format tableau)
   * @param {number} feedData.page - Page actuelle
   * @param {boolean} feedData.hasMore - S'il y a plus de posts
   * @param {number} feedData.scrollOffset - Position de scroll
   */
  const updateFeedCache = useCallback((feedData) => {
    const cache = getUserCache();
    if (!cache) return;
    
    // Convertir le tableau de posts en format { byId, allIds }
    const byId = {};
    const allIds = [];
    
    if (feedData.posts && Array.isArray(feedData.posts)) {
      feedData.posts.forEach(post => {
        if (post?.id) {
          byId[post.id] = post;
          if (!allIds.includes(post.id)) {
            allIds.push(post.id);
          }
        }
      });
    }
    
    cache.feed = {
      ...cache.feed,
      posts: { byId, allIds },
      page: feedData.page ?? cache.feed?.page ?? 1,
      hasMore: feedData.hasMore ?? cache.feed?.hasMore ?? true,
      lastFetch: Date.now(),
      scrollOffset: feedData.scrollOffset ?? cache.feed?.scrollOffset ?? 0
    };
    
    // Mettre à jour l'état local si nécessaire (optionnel)
    // setFeedState(cache.feed);
  }, [getUserCache]);

  /**
   * Vide le cache du feed
   */
  const clearFeedCache = useCallback(() => {
    const cache = getUserCache();
    if (!cache) return;
    
    cache.feed = {
      posts: { byId: {}, allIds: [] },
      likedPosts: {},
      page: 1,
      hasMore: true,
      lastFetch: null,
      scrollOffset: 0
    };
  }, [getUserCache]);

  /**
   * Met à jour les likes dans le cache du feed
   * @param {string} postId - ID du post
   * @param {boolean} liked - État du like
   */
  const updateFeedLike = useCallback((postId, liked) => {
    const cache = getUserCache();
    if (!cache?.feed) return;
    
    // Mettre à jour likedPosts
    cache.feed.likedPosts = cache.feed.likedPosts || {};
    cache.feed.likedPosts[postId] = liked;
    
    // Mettre à jour le post dans byId si présent
    if (cache.feed.posts?.byId?.[postId]) {
      cache.feed.posts.byId[postId].likedByCurrentUser = liked;
      cache.feed.posts.byId[postId].likes_count = 
        (cache.feed.posts.byId[postId].likes_count || 0) + (liked ? 1 : -1);
    }
  }, [getUserCache]);

  /**
   * Ajoute un nouveau post au début du feed (optimistic update)
   * @param {Object} newPost - Nouveau post
   */
  const prependNewPost = useCallback((newPost) => {
    const cache = getUserCache();
    if (!cache?.feed || !newPost?.id) return;
    
    // S'assurer que les structures existent
    if (!cache.feed.posts) {
      cache.feed.posts = { byId: {}, allIds: [] };
    }
    
    // Ajouter le post
    cache.feed.posts.byId[newPost.id] = newPost;
    cache.feed.posts.allIds = [newPost.id, ...(cache.feed.posts.allIds || [])];
    
    // Mettre à jour le nombre total
    cache.feed.page = cache.feed.page || 1;
  }, [getUserCache]);

  /* ==========================
     SCROLL OFFSET
  ========================== */

  const setScrollOffset = useCallback((key, offset) => {
    const cache = getUserCache();
    if (!cache) return;
    
    if (!cache.scrollPositions) {
      cache.scrollPositions = {};
    }
    cache.scrollPositions[key] = offset;
  }, [getUserCache]);

  const getScrollOffset = useCallback((key) => {
    const cache = getUserCache();
    return cache?.scrollPositions?.[key] || 0;
  }, [getUserCache]);

  // Aliases pour compatibilité
  const setNewsScrollOffset = useCallback((key, offset) => setScrollOffset(`news_${key}`, offset), [setScrollOffset]);
  const getNewsScrollOffset = useCallback((key) => getScrollOffset(`news_${key}`), [getScrollOffset]);
  const setSmartclipsScrollOffset = useCallback((offset) => setScrollOffset('smartclips', offset), [setScrollOffset]);
  const getSmartclipsScrollOffset = useCallback(() => getScrollOffset('smartclips'), [getScrollOffset]);

  /* ==========================
     PAGE
  ========================== */

  const setPage = useCallback((key, page) => {
    const cache = getUserCache();
    if (!cache) return;
    
    if (!cache.pages) {
      cache.pages = {};
    }
    cache.pages[key] = page;
  }, [getUserCache]);

  const getPage = useCallback((key) => {
    const cache = getUserCache();
    return cache?.pages?.[key] || 1;
  }, [getUserCache]);

 // Aliases pour compatibilité
  const setNewsPage = useCallback((key, page) => setPage(`news_${key}`, page), [setPage]);
  const getNewsPage = useCallback((key) => getPage(`news_${key}`), [getPage]);
  const setSmartclipsPage = useCallback((page) => setPage('smartclips', page), [setPage]);
  const getSmartclipsPage = useCallback(() => getPage('smartclips'), [getPage]);

  /* ==========================
     NETTOYAGE
  ========================== */

  const cleanupExpiredCache = useCallback(() => {
    const cache = getUserCache();
    if (!cache) return;
    
    const now = Date.now();
    let deleted = 0;
    
    // Nettoyer newsDetail expirés
    for (const [id, entry] of cache.newsDetail.entries()) {
      if (now - entry.cachedAt > CACHE_TTL) {
        cache.newsDetail.delete(id);
        deleted++;
      }
    }
    
    // Nettoyer clips SmartClips expirés
    if (cache.smartclips.lastFetch && now - cache.smartclips.lastFetch > CACHE_TTL) {
      cache.smartclips.clips = [];
      cache.smartclips.offset = 0;
      cache.smartclips.lastFetch = null;
      deleted++;
    }
    
    if (deleted > 0) {
      console.log(`🧹 Nettoyage: ${deleted} entrées expirées`);
    }
  }, [getUserCache]);

  // Nettoyage périodique
  useEffect(() => {
    const interval = setInterval(cleanupExpiredCache, CACHE_TTL);
    return () => clearInterval(interval);
  }, [cleanupExpiredCache]);

  /* ==========================
     NOTIFICATIONS CACHE
  ========================== */

  const getNotificationsCache = useCallback(() => {
    const cache = getUserCache();
    return cache?.notifications || null;
  }, [getUserCache]);

  const updateNotificationsCache = useCallback((entry) => {
    const cache = getUserCache();
    if (!cache) return;
    cache.notifications = entry;
  }, [getUserCache]);

  /* ==========================
     CONVERSATIONS CACHE
  ========================== */

  const getConversationsCache = useCallback(() => {
    const cache = getUserCache();
    return cache?.conversations || null;
  }, [getUserCache]);

  const updateConversationsCache = useCallback((entry) => {
    const cache = getUserCache();
    if (!cache) return;
    cache.conversations = entry;
  }, [getUserCache]);

  /* ==========================
     GENERIC KEYED CACHE
     (Birthday, Blocked, Favorites, Profile, Drafts, Subscription, Group, SavedPosts)
  ========================== */

  const genericCacheRef = useRef(new Map());

  const _genericGet = useCallback((ns, key) =>
    genericCacheRef.current.get(`${ns}:${String(key)}`) || null,
  []);

  const _genericSet = useCallback((ns, key, data) => {
    genericCacheRef.current.set(`${ns}:${String(key)}`, data);
  }, []);

  const getBirthdayCache     = useCallback((uid) => _genericGet('birthday', uid),         [_genericGet]);
  const updateBirthdayCache  = useCallback((uid, d) => _genericSet('birthday', uid, d),   [_genericSet]);

  const getBlockedCache      = useCallback((uid) => _genericGet('blocked', uid),           [_genericGet]);
  const updateBlockedCache   = useCallback((uid, d) => _genericSet('blocked', uid, d),     [_genericSet]);

  const getFavoritesCache    = useCallback((key) => _genericGet('favorites', key),         [_genericGet]);
  const updateFavoritesCache = useCallback((key, d) => _genericSet('favorites', key, d),  [_genericSet]);

  const getProfileCache      = useCallback((uid) => _genericGet('profile', uid),           [_genericGet]);
  const updateProfileCache   = useCallback((uid, d) => _genericSet('profile', uid, d),     [_genericSet]);

  const getDraftsCache       = useCallback((uid) => _genericGet('drafts', uid),            [_genericGet]);
  const updateDraftsCache    = useCallback((uid, d) => _genericSet('drafts', uid, d),      [_genericSet]);

  const getSubscriptionCache    = useCallback((uid) => _genericGet('subscription', uid),        [_genericGet]);
  const updateSubscriptionCache = useCallback((uid, d) => _genericSet('subscription', uid, d),  [_genericSet]);

  const getGroupCache      = useCallback((gid) => _genericGet('group', gid),          [_genericGet]);
  const updateGroupCache   = useCallback((gid, d) => _genericSet('group', gid, d),    [_genericSet]);

  const getSavedPostsCache    = useCallback((uid) => _genericGet('savedposts', uid),         [_genericGet]);
  const updateSavedPostsCache = useCallback((uid, d) => _genericSet('savedposts', uid, d),  [_genericSet]);

  const clearUserCache = useCallback((uid) => {
    const suffix = `:${String(uid)}`;
    for (const key of genericCacheRef.current.keys()) {
      if (key.endsWith(suffix)) genericCacheRef.current.delete(key);
    }
  }, []);

  /* ==========================
     GROUPS STATE CACHE (object, no key)
  ========================== */

  const [groupsCache, setGroupsCache] = useState(null);
  const updateGroupsCache = useCallback((data) => setGroupsCache(data), []);

  /* ==========================
     FEATURES CACHE (ref, no key)
  ========================== */

  const featuresCacheRef = useRef(null);
  const getFeaturesCache  = useCallback(() => featuresCacheRef.current, []);
  const updateFeaturesCache = useCallback((data) => { featuresCacheRef.current = data; }, []);

  /* ==========================
     STORIES PREPEND
  ========================== */

  const prependNewStories = useCallback((_newStories) => {
    // Signal — stories feed components manage their own display state.
    // This hook exists for API compatibility; extend when stories feed is centralized.
  }, []);

  /* ==========================
     FRIENDS DATA (state + async fetch)
  ========================== */

  const [friendsData, setFriendsData] = useState({
    friends: [],
    requests: [],
    suggestions: [],
    hasMoreSuggestions: true,
    isInitialLoading: false,
    lastFetched: null,
  });
  const friendsSuggestionsOffsetRef = useRef(0);

  const fetchFriendsData = useCallback(async (force = false) => {
    if (!apiClient || !isApiReady) return;
    if (!force && friendsData.lastFetched && Date.now() - friendsData.lastFetched < 5 * 60 * 1000) return;

    setFriendsData(prev => ({ ...prev, isInitialLoading: true }));
    try {
      const [friendsRes, requestsRes] = await Promise.allSettled([
        apiClient.get('/friends'),
        apiClient.get('/friends/requests'),
      ]);
      const suggestionsRaw = await apiClient.get('/friends/suggestions?offset=0&limit=20').catch(() => null);
      const suggestions = suggestionsRaw?.suggestions || (Array.isArray(suggestionsRaw) ? suggestionsRaw : []);
      const hasMoreSuggestions = suggestions.length >= 20;
      friendsSuggestionsOffsetRef.current = suggestions.length;

      setFriendsData({
        friends:
          friendsRes.status === 'fulfilled'
            ? (friendsRes.value?.friends || (Array.isArray(friendsRes.value) ? friendsRes.value : []))
            : [],
        requests:
          requestsRes.status === 'fulfilled'
            ? (requestsRes.value?.requests || (Array.isArray(requestsRes.value) ? requestsRes.value : []))
            : [],
        suggestions,
        hasMoreSuggestions,
        isInitialLoading: false,
        lastFetched: Date.now(),
      });
    } catch {
      setFriendsData(prev => ({ ...prev, isInitialLoading: false }));
    }
  }, [apiClient, isApiReady, friendsData.lastFetched]);

  const fetchMoreSuggestions = useCallback(async () => {
    if (!apiClient || !isApiReady) return;
    const offset = friendsSuggestionsOffsetRef.current;
    try {
      const res = await apiClient.get(`/friends/suggestions?offset=${offset}&limit=20`);
      const newSugs = res?.suggestions || (Array.isArray(res) ? res : []);
      const hasMoreSuggestions = newSugs.length >= 20;
      friendsSuggestionsOffsetRef.current = offset + newSugs.length;
      setFriendsData(prev => ({
        ...prev,
        suggestions: [...(prev.suggestions || []), ...newSugs],
        hasMoreSuggestions,
      }));
    } catch { }
  }, [apiClient, isApiReady]);

  const updateFriendsData = useCallback((updater) => {
    setFriendsData(typeof updater === 'function' ? updater : () => updater);
  }, []);

  /* ==========================
     INVALIDATION
  ========================== */

  const clearCurrentUserCache = useCallback(() => {
    if (!currentUserId) return;
    
    try {
      sessionStorage.removeItem(`cache_${currentUserId}`);
    } catch (e) {}
    
    delete userCaches.current[currentUserId];
    setNewsState({ list: [], page: 1, hasMore: true });
    setSmartclipsState({ clips: [], offset: 0, currentIndex: 0, watchedCount: 0 });
  }, [currentUserId]);

  const clearAllCaches = useCallback(() => {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}
    
    userCaches.current = {};
    setNewsState({ list: [], page: 1, hasMore: true });
    setSmartclipsState({ clips: [], offset: 0, currentIndex: 0, watchedCount: 0 });
  }, []);

  /* ==========================
     PROVIDER VALUE
  ========================== */

  const value = {
    // États
    newsState,
    smartclipsState,
    
    // News cache
    isNewsCacheValid,
    updateNewsCache,
    getNewsCache,
    updateNewsItemInCache,
    cacheNewsDetail,
    getNewsDetailCache,
    getNewsItem,
    invalidateNewsCache,
    // SmartClips cache
    markVideoWatched,
    isVideoWatched,
    getWatchedVideos,
    updateSmartclipsCache,
    getSmartclipsCache,
    isSmartclipsCacheValid,
    setSmartclipsCurrentIndex,
    getSmartclipsCurrentIndex,
    clearWatchedHistory,
    getSmartclipsClip,
    preloadSmartclips,
    getSmartclipsWatchedCount,
    getSmartclipsProgress,
    
    // ── FEED (état réactif + actions) ──
    feedState,
    loadFeedPosts,
    prependNewPosts,

    // ✅ FEED CACHE (NOUVEAU)
    feedCache: getFeedCache(),
    getFeedCache,
    updateFeedCache,
    clearFeedCache,
    updateFeedLike,
    prependNewPost,
    
    // Scroll
    setScrollOffset,
    getScrollOffset,
    setNewsScrollOffset,
    getNewsScrollOffset,
    setSmartclipsScrollOffset,
    getSmartclipsScrollOffset,
    
    // Page
    setPage,
    getPage,
    setNewsPage,
    getNewsPage,
    setSmartclipsPage,
    getSmartclipsPage,
    
    // Notifications cache
    getNotificationsCache,
    updateNotificationsCache,

    // Conversations cache
    getConversationsCache,
    updateConversationsCache,

    // Generic keyed caches
    getBirthdayCache,
    updateBirthdayCache,
    getBlockedCache,
    updateBlockedCache,
    getFavoritesCache,
    updateFavoritesCache,
    getProfileCache,
    updateProfileCache,
    getDraftsCache,
    updateDraftsCache,
    getSubscriptionCache,
    updateSubscriptionCache,
    getGroupCache,
    updateGroupCache,
    getSavedPostsCache,
    updateSavedPostsCache,
    clearUserCache,

    // Groups state cache
    groupsCache,
    updateGroupsCache,

    // Features cache
    getFeaturesCache,
    updateFeaturesCache,

    // Stories
    prependNewStories,

    // Friends data
    friendsData,
    fetchFriendsData,
    fetchMoreSuggestions,
    updateFriendsData,

    // Invalidation
    clearCurrentUserCache,
    clearAllCaches,
  };

  return (
    <GlobalCacheContext.Provider value={value}>
      {children}
    </GlobalCacheContext.Provider>
  );
};

export const useGlobalCache = () => {
  const ctx = useContext(GlobalCacheContext);
  if (!ctx) {
    throw new Error('useGlobalCache must be used within GlobalCacheProvider');
  }
  return ctx;
};
GlobalCacheProvider.propTypes = {
  children: PropTypes.node.isRequired,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
