import React, { useState, useEffect, useCallback, useRef, Suspense, lazy, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Eye, Bell, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useWebSocketWithReconnect } from '../hooks/useWebSocketWithReconnect';
import { useImagePreloader } from '../hooks/useImagePreloader';

// Composants
import { SkeletonStories } from '../components/SkeletonComplete'; // ✅ Supprimé useSkeletonLoader inutilisé
import PropTypes from 'prop-types';

// Lazy load pour le composant StoriesFeed
const StoriesFeed = lazy(() => import('../components/StoriesFeed'));

// =============================
// CONSTANTES
// =============================
const STORIES_PER_PAGE = 10;
const STALE_TIME = 60 * 1000; // 1 minute
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const MAX_PAGES = 5; // Limite mémoire pour le scroll infini
const POLLING_INTERVAL = 30000; // 30 secondes (fallback si WebSocket down)
const WS_RECONNECT_ATTEMPTS = 10;
const WS_RECONNECT_INTERVAL = 3000;

// =============================
// FALLBACK STORIES (hors composant)
// =============================
const FALLBACK_STORIES = [
  {
    id: 'story_1',
    backgroundImage: 'https://picsum.photos/id/1/1080/1920',
    elements: [],
    music: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    user: { id: 'user_1', full_name: 'Smartix', avatar: null }
  },
  {
    id: 'story_2',
    backgroundImage: 'https://picsum.photos/id/2/1080/1920',
    elements: [],
    music: null,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    user: { id: 'user_1', full_name: 'Smartix', avatar: null }
  },
  {
    id: 'story_3',
    backgroundImage: 'https://picsum.photos/id/3/1080/1920',
    elements: [],
    music: { title: 'Fresh Beat', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration: 48 },
    created_at: new Date().toISOString(),
    user: { id: 'user_1', full_name: 'Smartix', avatar: null }
  }
];

// =============================
// DÉDUPLICATION DES STORIES
// =============================
const deduplicateStories = (stories) => {
  const uniqueMap = new Map();
  stories.forEach(story => {
    if (!uniqueMap.has(story.id) || new Date(story.created_at) > new Date(uniqueMap.get(story.id).created_at)) {
      uniqueMap.set(story.id, story);
    }
  });
  return Array.from(uniqueMap.values()).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

// =============================
// NORMALISATION DES STORIES
// =============================
const normalizeStories = (rawStories) => {
  if (!Array.isArray(rawStories)) return [];
  
  return rawStories.map(story => ({
    id: story.id || story._id,
    storyId: story.id || story._id,
    media_url: story.backgroundImage || story.media_url,
    backgroundImage: story.backgroundImage,
    elements: story.elements || [],
    music: story.music || null,
    created_at: story.created_at || story.createdAt || new Date().toISOString(),
    user: {
      id: story.user_id || story.user?.id || 'unknown',
      full_name: story.user?.full_name || story.user_name || 'Utilisateur',
      avatar: story.user?.avatar || story.user_avatar || null
    }
  }));
};

// =============================
// LIMITATION DE MÉMOIRE (PAGES)
// =============================
const limitPages = (pages) => {
  if (pages.length <= MAX_PAGES) return pages;
  return pages.slice(0, MAX_PAGES);
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const StoriesFeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [newStoriesCount, setNewStoriesCount] = useState(0);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(() => {
    const saved = localStorage.getItem('last_stories_view');
    return saved || new Date().toISOString();
  });
  
  const isFetchingRef = useRef(false);
  const lastElementRef = useRef(null);
  // ✅ Supprimé preloaderRef inutilisé

  // =============================
  // REACT QUERY : FETCH STORIES
  // =============================
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: ['stories', user?.id],
    queryFn: async ({ pageParam = 1 }) => {
      if (!user) throw new Error('Not authenticated');
      
      const response = await client.get(`/stories?page=${pageParam}&limit=${STORIES_PER_PAGE}`);
      const rawStories = response.data || [];
      return {
        stories: normalizeStories(rawStories),
        page: pageParam,
        hasMore: rawStories.length === STORIES_PER_PAGE
      };
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 1,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!user,
    select: (data) => {
      const limitedPages = limitPages(data.pages);
      const allStories = limitedPages.flatMap(page => page.stories);
      return {
        pages: limitedPages,
        stories: deduplicateStories(allStories)
      };
    }
  });

  const allStories = data?.stories || [];
  const isLoadingStories = isLoading || (isFetchingNextPage && !allStories.length);
  const isRefreshing = isRefetching && !isFetchingNextPage;

  // =============================
  // WEBSOCKET AVEC RECONNEXION
  // =============================
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'new_story' && data.story) {
      const normalizedStory = normalizeStories([data.story])[0];
      if (normalizedStory) {
        queryClient.setQueryData(['stories', user?.id], (oldData) => {
          if (!oldData) return oldData;
          
          const newPages = oldData.pages.map((page, index) => {
            if (index === 0) {
              const existingIds = new Set(page.stories.map(s => s.id));
              if (!existingIds.has(normalizedStory.id)) {
                const newStories = deduplicateStories([normalizedStory, ...page.stories]);
                return { ...page, stories: newStories };
              }
            }
            return page;
          });
          
          return {
            ...oldData,
            pages: newPages
          };
        });
        
        setNewStoriesCount(prev => prev + 1);
        toast.info(`📱 Nouvelle story de ${normalizedStory.user?.full_name || 'un ami'}`, {
          icon: <Eye className="w-4 h-4" />,
          duration: 4000
        });
      }
    }
  }, [queryClient, user?.id]);

  const { isConnected, reconnectAttempt } = useWebSocketWithReconnect({
    url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/stories`,
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      console.warn('WebSocket error:', error);
      toast.warning('Connexion en temps réel instable', { duration: 3000 });
    },
    reconnect: true,
    maxReconnectAttempts: WS_RECONNECT_ATTEMPTS,
    reconnectInterval: WS_RECONNECT_INTERVAL,
    authToken: user?.token
  });

  // =============================
  // FALLBACK POLLING (si WebSocket down)
  // =============================
  useEffect(() => {
    if (!user) return;
    
    let intervalId;
    
    if (!isConnected) {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && !isRefreshing && !isFetchingNextPage) {
          refetch();
        }
      }, POLLING_INTERVAL);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isConnected, user, refetch, isRefreshing, isFetchingNextPage]);

  // =============================
  // PRÉCHARGEMENT DES IMAGES
  // =============================
  const imageUrls = useMemo(() => {
    return allStories.slice(0, 6).flatMap(story => [
      story.backgroundImage,
      story.media_url
    ]).filter(Boolean);
  }, [allStories]);

  const { preload, cancelAll, isPreloading } = useImagePreloader();

  useEffect(() => {
    if (imageUrls.length > 0 && !isPreloading) {
      preload(imageUrls);
    }
    
    return () => {
      cancelAll();
    };
  }, [imageUrls, preload, cancelAll, isPreloading]);

  // =============================
  // MISE À JOUR DU COMPTEUR DE NOUVEAUTÉS
  // =============================
  useEffect(() => {
    const newCount = allStories.filter(s => new Date(s.created_at) > new Date(lastSeenTimestamp)).length;
    setNewStoriesCount(newCount);
  }, [allStories, lastSeenTimestamp]);

  // =============================
  // SAUVEGARDE DE LA DERNIÈRE VISUALISATION
  // =============================
  const markStoriesAsSeen = useCallback(() => {
    const now = new Date().toISOString();
    setLastSeenTimestamp(now);
    localStorage.setItem('last_stories_view', now);
    setNewStoriesCount(0);
  }, []);

  // =============================
  // OBSERVER POUR LE SCROLL INFINI
  // =============================
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isLoadingStories) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingRef.current && hasNextPage && !isFetchingNextPage) {
          isFetchingRef.current = true;
          fetchNextPage().finally(() => {
            isFetchingRef.current = false;
          });
        }
      },
      { threshold: 0.5 }
    );
    
    if (lastElementRef.current) {
      observer.observe(lastElementRef.current);
    }
    
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isLoadingStories, fetchNextPage]);

  // =============================
  // RAFRAÎCHISSEMENT MANUEL
  // =============================
  const handleRefresh = useCallback(() => {
    if (isRefreshing || isFetchingNextPage) return;
    refetch();
  }, [refetch, isRefreshing, isFetchingNextPage]);

  // =============================
  // RETOUR EN HAUT
  // =============================
  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    markStoriesAsSeen();
  }, [markStoriesAsSeen]);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // RENDU
  // =============================
  if (!user) return null;

  if (isLoadingStories && !allStories.length) {
    return (
      <div className="min-h-screen bg-black">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="h-8 w-32 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <SkeletonStories count={3} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Retour"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">📱 Stories Smartix</h1>
            {newStoriesCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-cyan-500 text-white rounded-full animate-pulse">
                +{newStoriesCount}
              </span>
            )}
            {!isConnected && reconnectAttempt > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                <WifiOff className="w-3 h-3" />
                Hors ligne
              </span>
            )}
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Rafraîchir"
          >
            <RefreshCw className={`w-5 h-5 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {newStoriesCount > 0 && (
          <div className="px-4 pb-2">
            <button
              onClick={handleScrollToTop}
              className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-cyan-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4" />
              {newStoriesCount} nouvelle{newStoriesCount > 1 ? 's' : ''} story{newStoriesCount > 1 ? 's' : ''} à découvrir
            </button>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto py-6 px-4">
        {isError && allStories.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">😕</span>
            </div>
            <p className="text-white/60 mb-4">{error?.message || 'Impossible de charger les stories'}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full hover:from-cyan-600 hover:to-blue-600 transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : allStories.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">📭</span>
            </div>
            <p className="text-white/60">Aucune story pour le moment</p>
            <p className="text-white/40 text-sm mt-2">Reviens plus tard !</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Actualiser
            </button>
          </div>
        ) : (
          <>
            <Suspense fallback={<SkeletonStories count={3} />}>
              <StoriesFeed stories={allStories} onStoryView={markStoriesAsSeen} />
            </Suspense>
            
            {hasNextPage && (
              <div ref={lastElementRef} className="h-10 flex items-center justify-center py-4">
                {isFetchingNextPage ? (
                  <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                ) : (
                  <div className="w-6 h-6" />
                )}
              </div>
            )}
            
            {!hasNextPage && allStories.length > 0 && (
              <div className="text-center py-8">
                <p className="text-white/40 text-sm">✨ C'est tout pour le moment ✨</p>
                <p className="text-white/30 text-xs mt-1">Reviens plus tard pour plus de stories</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

StoriesFeedPage.propTypes = {};

export default StoriesFeedPage;
