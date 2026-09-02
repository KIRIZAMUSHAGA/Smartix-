import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useStoryViewer } from '../contexts/StoryViewerContext';
import { storyRanking } from '../utils/storyRanking';
import { getOptimizedImageUrl } from '../config/apiClient';
import { toast } from 'sonner';
import StoryCarousel from '../components/StoryCarousel';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const MAX_PRELOAD_CONCURRENCY = 3; // Limite de préchargement simultané
const STORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// =============================
// COMPOSANT PRINCIPAL
// =============================
const StoriesFeed = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { openViewer } = useStoryViewer();

  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preloadedImages, setPreloadedImages] = useState(new Set());
  const [cacheTimestamp, setCacheTimestamp] = useState(null);

  // =============================
  // CHARGEMENT DES STORIES
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const loadAndRankStories = async () => {
      try {
        setLoading(true);
        setError(null);

        // Vérifier le cache
        const cached = sessionStorage.getItem('stories_cache');
        const cachedData = cached ? JSON.parse(cached) : null;
        
        if (cachedData && Date.now() - cachedData.timestamp < STORY_CACHE_TTL) {
          setUserGroups(cachedData.groups);
          setCacheTimestamp(cachedData.timestamp);
          setLoading(false);
          return;
        }

        const response = await client.get('/stories');
        const allStories = response.data;

        const validStories = storyRanking.aggregateStories(allStories);
        const grouped = storyRanking.groupByUser(validStories);
        
        // Récupérer le profil utilisateur pour le classement
        const userProfile = {
          friends: [], // À remplacer par les vrais amis
          closeFriends: [] // À remplacer par les vrais amis proches
        };
        
        const ranked = storyRanking.rankStories(grouped, userProfile);

        setUserGroups(ranked);
        setCacheTimestamp(Date.now());

        // Sauvegarder dans le cache
        sessionStorage.setItem('stories_cache', JSON.stringify({
          groups: ranked,
          timestamp: Date.now()
        }));

      } catch (error) {
        console.error('Erreur chargement stories:', error);
        setError('Impossible de charger les stories');
        
        // Fallback stories
        const fallbackGroups = [
          {
            userId: 'user1',
            userName: 'Alice',
            userAvatar: 'https://i.pravatar.cc/60?img=1',
            stories: [
              {
                id: 's1',
                backgroundImage: 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=500&h=900',
                createdAt: new Date().toISOString(),
                music: { title: 'Top Vibes', duration: 45 }
              }
            ],
            isViewed: false
          },
          {
            userId: 'user2',
            userName: 'Bob',
            userAvatar: 'https://i.pravatar.cc/60?img=2',
            stories: [
              {
                id: 's2',
                backgroundImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&h=900',
                createdAt: new Date(Date.now() - 3600000).toISOString()
              }
            ],
            isViewed: true
          }
        ];
        
        setUserGroups(fallbackGroups);
        
        // Message utilisateur
        if (error.response?.status === 401) {
          toast.error('Session expirée, reconnectez-vous');
          navigate('/auth');
        } else if (error.response?.status === 429) {
          toast.error('Trop de requêtes, patientez');
        } else {
          toast.warning('Utilisation des stories de démonstration');
        }
      } finally {
        setLoading(false);
      }
    };

    loadAndRankStories();
  }, [user, navigate, client]);

  // =============================
  // PRÉCHARGEMENT OPTIMISÉ
  // =============================
  const preloadStory = useCallback(async (story) => {
    if (!story?.backgroundImage || preloadedImages.has(story.backgroundImage)) return;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        setPreloadedImages(prev => new Set([...prev, story.backgroundImage]));
        resolve();
      };
      img.onerror = () => resolve(); // Ignorer les erreurs
      img.src = getOptimizedImageUrl(story.backgroundImage, 'story');
    });
  }, [preloadedImages]);

  const handlePreload = useCallback(async (group) => {
    if (!group?.stories?.length) return;

    // Limiter le préchargement à MAX_PRELOAD_CONCURRENCY
    const storiesToPreload = group.stories.slice(0, MAX_PRELOAD_CONCURRENCY);
    
    try {
      await Promise.all(storiesToPreload.map(story => preloadStory(story)));
    } catch (error) {
      console.warn('Erreur préchargement:', error);
    }
  }, [preloadStory]);

  // =============================
  // SÉLECTION D'UNE STORY
  // =============================
  const handleStorySelect = useCallback((group) => {
    if (!group?.stories?.length) return;

    storyRanking.markAsViewed(group);
    storyRanking.trackView(group.userId);
    
    // Mettre à jour l'état local
    setUserGroups(prev => 
      prev.map(g => 
        g.userId === group.userId ? { ...g, isViewed: true } : g
      )
    );

    // Ouvrir le viewer
    openViewer(group.stories, 0);
  }, [openViewer]);

  // =============================
  // FORCER LE RAFFRAÎCHISSEMENT
  // =============================
  const handleRefresh = useCallback(() => {
    sessionStorage.removeItem('stories_cache');
    setCacheTimestamp(null);
    setUserGroups([]);
    
    // Recharger
    const load = async () => {
      try {
        setLoading(true);
        const response = await client.get('/stories');
        const allStories = response.data;
        const validStories = storyRanking.aggregateStories(allStories);
        const grouped = storyRanking.groupByUser(validStories);
        const userProfile = { friends: [], closeFriends: [] };
        const ranked = storyRanking.rankStories(grouped, userProfile);
        setUserGroups(ranked);
      } catch (error) {
        console.error('Erreur rafraîchissement:', error);
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [client]);

  // =============================
  // MÉMOÏSATION DU CONTENU
  // =============================
  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <p className="text-white/80">Chargement des stories...</p>
          </div>
        </div>
      );
    }

    if (error && userGroups.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black">
          <div className="text-center max-w-md px-4">
            <div className="text-red-500 text-6xl mb-4">😕</div>
            <h2 className="text-white text-xl font-bold mb-2">Oups !</h2>
            <p className="text-white/60 mb-6">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-cyan-500 text-white rounded-full hover:bg-cyan-600 transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-black min-h-screen">
        {/* En-tête */}
        <div className="sticky top-0 bg-black/80 backdrop-blur-sm z-10 px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <h1 className="text-white font-bold text-lg">Stories</h1>
            <div className="flex items-center gap-3">
              {cacheTimestamp && (
                <span className="text-xs text-white/40">
                  Mis à jour {new Date(cacheTimestamp).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleRefresh}
                className="p-2 text-white/60 hover:text-white transition-colors"
                aria-label="Rafraîchir"
              >
                ↻
              </button>
            </div>
          </div>
        </div>

        {/* Carousel */}
        <StoryCarousel 
          userGroups={userGroups}
          onStorySelect={handleStorySelect}
          onPreload={handlePreload}
        />
      </div>
    );
  }, [loading, error, userGroups, cacheTimestamp, handleStorySelect, handlePreload, handleRefresh]);

  if (!user) return null;

  return content;
};

StoriesFeed.propTypes = {};

export default StoriesFeed;
