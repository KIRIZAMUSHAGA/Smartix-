import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Star, 
  Search, 
  Trash2, 
  Share2, 
  Filter, 
  ChevronDown,
  BookOpen,
  MessageCircle,
  User,
  Layout,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import PropTypes from 'prop-types';

// =============================
// HOOK PERSONNALISÉ
// =============================
const usePaginatedFavorites = (user, client, activeFilter, sortBy) => {
  const { getFavoritesCache, updateFavoritesCache } = useGlobalCache();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  const fetchFavorites = useCallback(async (reset = false, customPage = null) => {
    if (!user?.id) return;

    const currentPage = customPage !== null ? customPage : (reset ? 1 : page);
    const cacheKey = `${user.id}_${activeFilter}_${sortBy}_${currentPage}`;

    try {
      if (reset) {
        const cached = getFavoritesCache(cacheKey);
        if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
          setFavorites(cached.data);
          setHasMore(cached.hasMore ?? true);
          setTotal(cached.total ?? 0);
          setLoading(false);
          return;
        }
        setLoading(true);
        setPage(1);
        setFavorites([]);
      } else {
        setLoadingMore(true);
      }

      const response = await client.get('/favorites', {
        params: {
          page: currentPage,
          limit: 20,
          type: activeFilter !== 'all' ? activeFilter : undefined,
          sort: sortBy
        }
      });

      const newFavorites = response.data?.items || [];
      const more = newFavorites.length === 20;
      const totalItems = response.data?.total || 0;

      setFavorites(prev => {
        if (reset) return newFavorites;
        
        const ids = new Set(prev.map(f => f.id || f._id));
        const merged = [...prev];
        
        newFavorites.forEach(f => {
          const id = f.id || f._id;
          if (!ids.has(id)) merged.push(f);
        });
        
        return merged;
      });
      
      setHasMore(more);
      setTotal(totalItems);

      if (reset) {
        updateFavoritesCache(cacheKey, {
          data: newFavorites,
          hasMore: more,
          total: totalItems,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, client, page, activeFilter, sortBy, getFavoritesCache, updateFavoritesCache]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setPage(prev => {
        const nextPage = prev + 1;
        fetchFavorites(false, nextPage);
        return nextPage;
      });
    }
  }, [loadingMore, hasMore, fetchFavorites]);

  // Préfetch page suivante
  useEffect(() => {
    if (hasMore && !loading && !loadingMore && favorites.length > 0) {
      const timeout = setTimeout(() => {
        fetchFavorites(false, page + 1);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [hasMore, loading, loadingMore, page, favorites.length, fetchFavorites]);

  const removeFavorite = useCallback(async (favId) => {
    if (!user?.id) return;

    const removedItem = favorites.find(f => (f.id || f._id) === favId);
    if (!removedItem) return;

    // Optimistic update
    setFavorites(prev => prev.filter(f => (f.id || f._id) !== favId));
    setTotal(prev => prev - 1);

    const toastId = toast.success('Retiré des favoris', {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          setFavorites(prev => {
            const restored = [...prev, removedItem];
            return restored.sort((a, b) => {
              const dateA = new Date(a.created_at);
              const dateB = new Date(b.created_at);
              return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
            });
          });
          setTotal(prev => prev + 1);
          toast.dismiss(toastId);
        }
      }
    });

    try {
      await client.delete(`/favorites/${favId}`);
      
      // Mettre à jour le cache
      const cacheKey = `${user.id}_${activeFilter}_${sortBy}_${page}`;
      const cached = getFavoritesCache(cacheKey);
      if (cached) {
        updateFavoritesCache(cacheKey, {
          ...cached,
          data: favorites.filter(f => (f.id || f._id) !== favId),
          total: total - 1,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      setFavorites(prev => [...prev, removedItem]);
      setTotal(prev => prev + 1);
      toast.error('Erreur lors de la suppression');
    }
  }, [user, favorites, client, sortBy, activeFilter, page, getFavoritesCache, updateFavoritesCache, total]);

  return {
    favorites,
    loading,
    loadingMore,
    hasMore,
    total,
    error,
    loadMore,
    removeFavorite,
    refetch: () => fetchFavorites(true)
  };
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Favorites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();

  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const observerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);

  const {
    favorites,
    loading,
    loadingMore,
    hasMore,
    total,
    loadMore,
    removeFavorite
  } = usePaginatedFavorites(user, client, activeFilter, sortBy);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    );

    if (loadMoreTriggerRef.current) {
      observer.observe(loadMoreTriggerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  // =============================
  // MÉMOÏSATION DES ICÔNES
  // =============================
  const getIcon = useMemo(() => {
    const icons = {
      publication: Layout,
      exercise: BookOpen,
      discussion: MessageCircle,
      author: User
    };
    
    const colors = {
      publication: 'text-blue-400',
      exercise: 'text-green-400',
      discussion: 'text-purple-400',
      author: 'text-orange-400'
    };
    
    return (type) => {
      const IconComponent = icons[type] || Star;
      const color = colors[type] || 'text-yellow-400';
      return <IconComponent className={`w-5 h-5 ${color}`} />;
    };
  }, []);

  // =============================
  // FILTRAGE LOCAL
  // =============================
  const filteredFavorites = useMemo(() => {
    if (!debouncedQuery.trim()) return favorites;
    
    const searchLower = debouncedQuery.toLowerCase();
    return favorites.filter(fav => 
      fav.metadata?.title?.toLowerCase().includes(searchLower) ||
      fav.content_type?.toLowerCase().includes(searchLower)
    );
  }, [favorites, debouncedQuery]);

  // =============================
  // HIGHLIGHT SEARCH
  // =============================
  const highlightText = useCallback((text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark> : part
    );
  }, []);

  // =============================
  // FILTRES
  // =============================
  const FILTER_OPTIONS = [
    { id: 'all', label: 'Tous', icon: Star },
    { id: 'publication', label: 'Publications', icon: Layout },
    { id: 'exercise', label: 'Exercices', icon: BookOpen },
    { id: 'discussion', label: 'Discussions', icon: MessageCircle },
    { id: 'author', label: 'Auteurs', icon: User }
  ];

  const SORT_OPTIONS = [
    { id: 'newest', label: 'Plus récents' },
    { id: 'oldest', label: 'Plus anciens' }
  ];

  // =============================
  // REDIRECTION
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-all"
            aria-label="Retour"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tight">Mes Favoris</h1>
          {total > 0 && (
            <span className="px-3 py-1 bg-accent rounded-full text-sm font-bold">
              {total}
            </span>
          )}
        </div>

        {/* Barre de recherche et filtres */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-[#ff6b35] transition-colors" />
            <input 
              type="text"
              placeholder="Rechercher dans mes favoris..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-accent/50 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 ring-[#ff6b35]/20 transition-all outline-none"
              aria-label="Rechercher dans les favoris"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeFilter === filter.id 
                    ? 'bg-[#ff6b35] text-white shadow-lg shadow-[#ff6b35]/20' 
                    : 'bg-accent/50 text-muted-foreground hover:bg-accent'
                }`}
              >
                <filter.icon className="w-4 h-4" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tri */}
        <div className="flex justify-end mb-6">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-accent/50 border-none rounded-xl px-4 py-2 pr-8 text-sm font-medium appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Liste des favoris */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35]" />
            <p className="text-muted-foreground font-bold">Chargement de vos trésors...</p>
          </div>
        ) : filteredFavorites.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4">
              {filteredFavorites.map((fav) => (
                <div 
                  key={fav.id || fav._id}
                  className="group bg-accent/30 hover:bg-accent/50 border border-border/50 rounded-3xl p-6 transition-all hover:scale-[1.01] flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="p-4 rounded-2xl bg-secondary group-hover:bg-[#ff6b35]/10 transition-all">
                      {getIcon(fav.content_type)}
                    </div>
                    <div>
                      <h3 className="text-lg font-black group-hover:text-[#ff6b35] transition-colors">
                        {highlightText(fav.metadata?.title || 'Contenu sans titre', debouncedQuery)}
                      </h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                        {fav.content_type} • Ajouté le {new Date(fav.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/favorites/${fav.id || fav._id}`;
                        if (navigator.share) {
                          navigator.share({ title: fav.metadata?.title, url });
                        } else {
                          navigator.clipboard.writeText(url);
                          toast.success('Lien copié !');
                        }
                      }}
                      className="p-3 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 rounded-xl transition-all"
                      aria-label="Partager"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => removeFavorite(fav.id || fav._id)}
                      className="p-3 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl transition-all"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            {hasMore && (
              <div ref={loadMoreTriggerRef} className="h-8 mt-4" />
            )}

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center mt-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-accent/20 rounded-[40px] border-2 border-dashed border-border/50">
            <div className="w-20 h-20 bg-accent/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Star className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h2 className="text-xl font-black mb-2">Aucun favori trouvé</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              {searchQuery ? "Aucun résultat ne correspond à votre recherche." : "Commencez à explorer le feed pour sauvegarder vos contenus préférés !"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

Favorites.propTypes = {};

export default Favorites;
