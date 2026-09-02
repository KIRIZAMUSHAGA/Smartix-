import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import BottomNav from '../components/BottomNav';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import { FixedSizeList as List } from 'react-window';
import throttle from 'lodash.throttle';
import debounce from 'lodash.debounce';
import {
  Search, TrendingUp, Hash, Users, BookOpen, Heart, MessageCircle,
  ArrowLeft, Filter, School, Sparkles, GraduationCap, Star,
  FileText, Calendar, UserPlus, UserCheck, ChevronDown, Clock, ArrowUp,
  Video, ShoppingBag, Book, Newspaper, Code2, Rocket, AppWindow, Github, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatTimeAgo } from '../utils/timeFormatter';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const ITEMS_PER_PAGE = {
  posts: 5,
  users: 6,
  hashtags: 6,
  courses: 4,
  marketplace: 4,
  smartclips: 4
};

const VIRTUALIZATION_THRESHOLD = 50;
const DEBOUNCE_DELAY = 300;
const SCROLL_THROTTLE_MS = 100;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

const DOMAINS = ['informatique', 'comptabilite', 'mathematiques', 'sciences', 'litterature'];
const GRADES = ['6eme', '5eme', '4eme', '3eme', 'seconde', 'premiere', 'terminale'];

// =============================
// COMPOSANT SKELETON
// =============================
const ExploreSkeleton = React.memo(() => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
    <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-4 py-4 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-4">Explorer</h1>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
    <BottomNav />
  </div>
));

ExploreSkeleton.displayName = 'ExploreSkeleton';

// =============================
// COMPOSANTS DE ROW (Virtualisation)
// =============================
const CourseRow = React.memo(({ course, style }) => (
  <div style={style}>
    <Card className="p-4 hover:shadow-xl transition-all mx-2 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-[#00B894] to-[#0984E3] rounded-lg flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{course.title}</p>
          <p className="text-sm text-gray-500">{course.category} • {course.duration} min</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-xs text-gray-600">{course.rating || 4.8}</span>
            </div>
            <span className="text-xs text-gray-400">{course.students || 0} étudiants</span>
          </div>
        </div>
        <Button size="sm" className="bg-gradient-to-r from-[#00B894] to-[#0984E3]">
          Démarrer
        </Button>
      </div>
    </Card>
  </div>
));

CourseRow.displayName = 'CourseRow';

const MarketplaceRow = React.memo(({ item, style }) => (
  <div style={style}>
    <Card className="p-4 hover:shadow-xl transition-all mx-2 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{item.title}</p>
          <p className="text-sm text-gray-500">{item.category} • {item.type}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-[#00B894]">{item.price} FCFA</span>
            <span className="text-xs text-gray-400">{item.sales || 0} vendus</span>
          </div>
        </div>
        <Button variant="outline" size="sm">
          Voir
        </Button>
      </div>
    </Card>
  </div>
));

MarketplaceRow.displayName = 'MarketplaceRow';

const SmartClipRow = React.memo(({ clip, style }) => (
  <div style={style}>
    <Card className="p-4 hover:shadow-xl transition-all mx-2 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Video className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{clip.title}</p>
          <p className="text-sm text-gray-500">{clip.duration} • {clip.views} vues</p>
          <div className="flex items-center gap-2 mt-2">
            <Heart className="w-3 h-3 text-red-500" />
            <span className="text-xs text-gray-600">{clip.likes || 0}</span>
            <MessageCircle className="w-3 h-3 text-blue-500 ml-2" />
            <span className="text-xs text-gray-600">{clip.comments || 0}</span>
          </div>
        </div>
        <Button size="sm" className="bg-gradient-to-r from-red-500 to-orange-500">
          Regarder
        </Button>
      </div>
    </Card>
  </div>
));

SmartClipRow.displayName = 'SmartClipRow';

const VibeProjectRow = React.memo(({ project, style }) => (
  <div style={style}>
    <Card className="p-4 hover:shadow-xl transition-all mx-2 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Code2 className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{project.name}</p>
          <p className="text-sm text-gray-500">{project.language} • {project.stars} ⭐</p>
          <p className="text-xs text-gray-400 mt-1 line-clamp-1">{project.description}</p>
        </div>
        <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-500">
          Explorer
        </Button>
      </div>
    </Card>
  </div>
));

VibeProjectRow.displayName = 'VibeProjectRow';

const AppRow = React.memo(({ app, style }) => (
  <div style={style}>
    <Card className="p-4 hover:shadow-xl transition-all mx-2 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <AppWindow className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{app.name}</p>
          <p className="text-sm text-gray-500">{app.category} • {app.version}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-[#00B894]">{app.price} FCFA</span>
            <span className="text-xs text-gray-400">{app.downloads} téléchargements</span>
          </div>
        </div>
        <Button variant="outline" size="sm">
          Installer
        </Button>
      </div>
    </Card>
  </div>
));

AppRow.displayName = 'AppRow';

// Composant minimal créé suite à audit (props utilisées : user, style, isFollowed, onToggleFollow)
const UserRow = React.memo(({ user, style, isFollowed, onToggleFollow }) => {
  if (!user) return null;
  return (
    <div style={style}>
      <Card className="p-4 hover:shadow-xl transition-all mx-2 mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={user.avatar_url || user.profile_picture} alt={user.username || user.name} />
            <AvatarFallback>{(user.username || user.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {user.full_name || user.name || user.username}
            </p>
            <p className="text-sm text-gray-500 truncate">@{user.username}</p>
            {typeof user.followers_count === 'number' && (
              <p className="text-xs text-gray-400 mt-1">{user.followers_count} abonnés</p>
            )}
          </div>
          <Button
            size="sm"
            variant={isFollowed ? 'outline' : 'default'}
            onClick={() => onToggleFollow?.(user.id)}
            className={isFollowed ? '' : 'bg-gradient-to-r from-[#00B894] to-[#0984E3]'}
          >
            {isFollowed ? (
              <><UserCheck className="w-4 h-4 mr-1" />Suivi</>
            ) : (
              <><UserPlus className="w-4 h-4 mr-1" />Suivre</>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
});

UserRow.displayName = 'UserRow';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Explore = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [followedUsers, setFollowedUsers] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [visibleCounts, setVisibleCounts] = useState({
    posts: ITEMS_PER_PAGE.posts,
    users: ITEMS_PER_PAGE.users,
    hashtags: ITEMS_PER_PAGE.hashtags,
    courses: ITEMS_PER_PAGE.courses,
    marketplace: ITEMS_PER_PAGE.marketplace,
    smartclips: ITEMS_PER_PAGE.smartclips
  });
  const [filters, setFilters] = useState({
    domain: 'all',
    grade: 'all',
    contentType: 'all',
    sortBy: 'popularity'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const searchInputRef = useRef(null);

  // =============================
  // REACT QUERY: EXPLORE DATA (TOUS LES MODULES)
  // =============================
  const {
    data: exploreData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['explore', user?.id],
    queryFn: async () => {
      const response = await client.get('/explore');
      const data = response.data;
      
      const initialFollowed = new Set(
        (data.popular_users || [])
          .filter(u => u.is_followed)
          .map(u => u.id)
      );
      setFollowedUsers(initialFollowed);
      
      return {
        trending_posts: data.trending_posts || [],
        popular_users: data.popular_users || [],
        trending_hashtags: data.trending_hashtags || [],
        suggested_groups: data.suggested_groups || [],
        // Nouveaux modules
        trending_courses: data.trending_courses || [],
        trending_marketplace: data.trending_marketplace || [],
        trending_smartclips: data.trending_smartclips || [],
        trending_vibe_projects: data.trending_vibe_projects || [],
        trending_apps: data.trending_apps || [],
        trending_news: data.trending_news || []
      };
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!user
  });

  // =============================
  // SEARCH (avec debounce)
  // =============================
  const debouncedSearch = useMemo(
    () => debounce(async (query) => {
      if (!query.trim()) return;
      
      try {
        const response = await client.get('/search/global', {
          params: { q: query, include: 'all' }
        });
        setSearchResults(response.data);
        
        if (!response.data.posts?.length && !response.data.users?.length && 
            !response.data.groups?.length && !response.data.courses?.length &&
            !response.data.marketplace?.length && !response.data.smartclips?.length) {
          toast.info('Aucun résultat trouvé');
        }
      } catch (error) {
        toast.error('Erreur de recherche');
      }
    }, DEBOUNCE_DELAY),
    [client]
  );

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      toast.error('Veuillez entrer un terme de recherche');
      return;
    }
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // =============================
  // FOLLOW MUTATION
  // =============================
  const followMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await client.post(`/users/${userId}/follow`);
      return { userId, action: response.data.action };
    },
    onSuccess: ({ userId, action }) => {
      setFollowedUsers(prev => {
        const next = new Set(prev);
        if (action === 'followed') {
          next.add(userId);
          toast.success('Suivi avec succès!');
        } else {
          next.delete(userId);
          toast.success('Désabonné avec succès!');
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Erreur lors du suivi');
    }
  });

  const handleToggleFollow = useCallback((userId) => {
    followMutation.mutate(userId);
  }, [followMutation]);

  // =============================
  // JOIN GROUP MUTATION
  // =============================
  const joinGroupMutation = useMutation({
    mutationFn: async (groupId) => {
      await client.post(`/groups/${groupId}/join`);
      return groupId;
    },
    onSuccess: (groupId) => {
      queryClient.setQueryData(['explore', user?.id], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          suggested_groups: oldData.suggested_groups.map(group =>
            group.id === groupId
              ? { ...group, is_member: true, members: [...(group.members || []), user?.id] }
              : group
          )
        };
      });
      toast.success('Vous avez rejoint le groupe!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  });

  const handleJoinGroup = useCallback((groupId) => {
    joinGroupMutation.mutate(groupId);
  }, [joinGroupMutation]);

  // =============================
  // MEMOIZED DATA
  // =============================
  const filteredPopularUsers = useMemo(() => {
    if (!exploreData?.popular_users) return [];
    let filtered = [...exploreData.popular_users];
    if (filters.domain !== 'all') {
      filtered = filtered.filter(item => item.domain === filters.domain);
    }
    if (filters.grade !== 'all') {
      filtered = filtered.filter(item => item.grade === filters.grade);
    }
    return filtered;
  }, [exploreData?.popular_users, filters]);

  const sortedTrendingPosts = useMemo(() => {
    if (!exploreData?.trending_posts) return [];
    const sorted = [...exploreData.trending_posts];
    switch(filters.sortBy) {
      case 'popularity':
        return sorted.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
      case 'recent':
        return sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      default:
        return sorted;
    }
  }, [exploreData?.trending_posts, filters.sortBy]);

  // =============================
  // SCROLL HANDLER
  // =============================
  useEffect(() => {
    const handleScroll = throttle(() => {
      setShowScrollTop(window.scrollY > 400);
    }, SCROLL_THROTTLE_MS);
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      handleScroll.cancel();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // =============================
  // VISIBILITY TOGGLE
  // =============================
  const toggleVisibility = useCallback((type) => {
    setVisibleCounts(prev => ({
      ...prev,
      [type]: prev[type] === ITEMS_PER_PAGE[type] 
        ? (exploreData?.[`trending_${type}`]?.length || 0)
        : ITEMS_PER_PAGE[type]
    }));
  }, [exploreData]);

  // =============================
  // RESET FILTERS
  // =============================
  const resetFilters = useCallback(() => {
    setFilters({
      domain: 'all',
      grade: 'all',
      contentType: 'all',
      sortBy: 'popularity'
    });
  }, []);

  // =============================
  // SCROLL TO TOP
  // =============================
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // =============================
  // VIRTUALISATION
  // =============================
  const shouldVirtualizePosts = sortedTrendingPosts.length > VIRTUALIZATION_THRESHOLD;
  const shouldVirtualizeUsers = filteredPopularUsers.length > VIRTUALIZATION_THRESHOLD;

  // =============================
  // TABS
  // =============================
  const tabs = [
    { id: 'all', label: 'Tout', icon: Sparkles, color: 'from-gray-500 to-gray-600' },
    { id: 'courses', label: 'Cours', icon: GraduationCap, color: 'from-green-500 to-emerald-500' },
    { id: 'community', label: 'Communauté', icon: Users, color: 'from-blue-500 to-cyan-500' },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, color: 'from-purple-500 to-pink-500' },
    { id: 'smartclips', label: 'SmartClips', icon: Video, color: 'from-red-500 to-orange-500' },
    { id: 'vibecoding', label: 'Vibe-Coding', icon: Code2, color: 'from-indigo-500 to-purple-500' },
    { id: 'apps', label: 'Applications', icon: AppWindow, color: 'from-cyan-500 to-teal-500' },
    { id: 'news', label: 'Actualités', icon: Newspaper, color: 'from-amber-500 to-yellow-500' }
  ];

  // =============================
  // RENDU
  // =============================
  if (isLoading) {
    return <ExploreSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center pb-24">
        <Card className="p-8 text-center max-w-md mx-4">
          <p className="text-red-500 mb-4">❌ Erreur de chargement</p>
          <Button onClick={() => refetch()} className="bg-gradient-to-r from-[#00B894] to-[#0984E3]">
            Réessayer
          </Button>
        </Card>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 right-8 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg text-gray-600 dark:text-gray-400 transition-all duration-300 hover:text-[#00B894] hover:scale-110 active:scale-95 group ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        aria-label="Retour en haut"
      >
        <ArrowUp className="w-6 h-6 transition-transform group-hover:-translate-y-1" />
      </button>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/home')}
              className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-all"
              aria-label="Retour"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00B894] to-[#0984E3] bg-clip-text text-transparent">
              🔍 Explorer
            </h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`ml-auto w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                showFilters ? 'bg-[#00B894] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              aria-label="Filtres"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher cours, personnes, applications, vidéos..."
                className="pl-10 rounded-full"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-[#00B894] to-[#0984E3] rounded-full"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-3 animate-in slide-in-from-top">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Domaine</label>
                  <select
                    value={filters.domain}
                    onChange={(e) => setFilters({...filters, domain: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="all">Tous</option>
                    {DOMAINS.map(domain => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Classe</label>
                  <select
                    value={filters.grade}
                    onChange={(e) => setFilters({...filters, grade: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="all">Toutes</option>
                    {GRADES.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Type de contenu</label>
                  <select
                    value={filters.contentType}
                    onChange={(e) => setFilters({...filters, contentType: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="all">Tous</option>
                    <option value="video">Vidéos</option>
                    <option value="article">Articles</option>
                    <option value="course">Cours</option>
                    <option value="app">Applications</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Trier par</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="popularity">Popularité</option>
                    <option value="recent">Plus récent</option>
                    <option value="trending">Tendance</option>
                  </select>
                </div>
              </div>

              <Button
                onClick={resetFilters}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="mt-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-2">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 inline mr-1" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {searchResults ? (
          /* Search Results */
          <div className="space-y-6">
            <Button
              onClick={() => setSearchResults(null)}
              variant="ghost"
              className="mb-4"
            >
              ← Retour à l'exploration
            </Button>

            {!searchResults.posts?.length && !searchResults.users?.length && 
             !searchResults.groups?.length && !searchResults.courses?.length &&
             !searchResults.marketplace?.length && !searchResults.smartclips?.length ? (
              <Card className="p-12 text-center">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucun résultat trouvé</h3>
                <p className="text-gray-500 dark:text-gray-400">Essayez d'autres mots-clés ou catégories.</p>
              </Card>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="w-full flex-wrap">
                  <TabsTrigger value="all" className="flex-1">Tous</TabsTrigger>
                  <TabsTrigger value="courses" className="flex-1">Cours</TabsTrigger>
                  <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
                  <TabsTrigger value="users" className="flex-1">Personnes</TabsTrigger>
                  <TabsTrigger value="apps" className="flex-1">Apps</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                  {searchResults.courses?.slice(0, 3).map(course => (
                    <CourseRow key={course.id} course={course} style={{}} />
                  ))}
                  {searchResults.posts?.slice(0, 3).map(post => (
                    <Card key={post.id} className="p-4">...</Card>
                  ))}
                </TabsContent>

                <TabsContent value="courses" className="space-y-4 mt-4">
                  {searchResults.courses?.map(course => (
                    <CourseRow key={course.id} course={course} style={{}} />
                  ))}
                </TabsContent>

                {/* Autres TabsContent similaires... */}
              </Tabs>
            )}
          </div>
        ) : (
          /* Explore Content - Tous les modules */
          <div className="space-y-8">
            {/* Tous les contenus selon l'onglet actif */}
            {(activeTab === 'all' || activeTab === 'courses') && exploreData?.trending_courses?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-[#00B894]" />
                    Cours populaires
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/courses')}>
                    Voir tout
                  </Button>
                </div>
                <div className="space-y-3">
                  {exploreData.trending_courses.slice(0, visibleCounts.courses).map(course => (
                    <CourseRow key={course.id} course={course} style={{}} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'community') && (
              <>
                {/* Hashtags tendances */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <TrendingUp className="w-6 h-6 text-[#00B894]" />
                    Hashtags tendances
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {exploreData?.trending_hashtags?.slice(0, visibleCounts.hashtags).map((hashtag, index) => (
                      <Card key={index} className="p-4 cursor-pointer hover:shadow-lg" onClick={() => navigate(`/hashtag/${encodeURIComponent(hashtag.tag)}`)}>
                        <div className="flex items-center gap-2">
                          <Hash className="w-5 h-5 text-[#0984E3]" />
                          <span className="font-bold">#{hashtag.tag}</span>
                        </div>
                        <p className="text-sm text-gray-500">{hashtag.count} publications</p>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Posts populaires */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📈 Posts populaires</h2>
                  {shouldVirtualizePosts ? (
                    <List height={600} itemCount={visibleCounts.posts} itemSize={280} width="100%">
                      {({ index, style }) => (
                        <div style={style}>
                          <Card className="p-4 mx-2 mb-3">...</Card>
                        </div>
                      )}
                    </List>
                  ) : (
                    <div className="space-y-4">
                      {sortedTrendingPosts.slice(0, visibleCounts.posts).map(post => (
                        <Card key={post.id} className="p-4">...</Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Utilisateurs populaires */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Users className="w-6 h-6 text-[#00B894]" />
                    Utilisateurs populaires
                  </h2>
                  {shouldVirtualizeUsers ? (
                    <List height={600} itemCount={visibleCounts.users} itemSize={140} width="100%">
                      {({ index, style }) => (
                        <div style={style}>
                          <UserRow
                            user={filteredPopularUsers[index]}
                            style={{}}
                            isFollowed={followedUsers.has(filteredPopularUsers[index]?.id)}
                            onToggleFollow={handleToggleFollow}
                          />
                        </div>
                      )}
                    </List>
                  ) : (
                    <div className="space-y-3">
                      {filteredPopularUsers.slice(0, visibleCounts.users).map(user => (
                        <UserRow
                          key={user.id}
                          user={user}
                          style={{}}
                          isFollowed={followedUsers.has(user.id)}
                          onToggleFollow={handleToggleFollow}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Groupes suggérés */}
                {exploreData?.suggested_groups?.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                      <BookOpen className="w-6 h-6 text-[#00B894]" />
                      Groupes suggérés
                    </h2>
                    <div className="grid gap-3">
                      {exploreData.suggested_groups.slice(0, 3).map(group => (
                        <Card key={group.id} className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar><AvatarFallback>{group.name?.[0]}</AvatarFallback></Avatar>
                            <div className="flex-1">
                              <p className="font-semibold">{group.name}</p>
                              <p className="text-sm text-gray-500">{group.members?.length || 0} membres</p>
                            </div>
                            <Button size="sm" onClick={() => handleJoinGroup(group.id)}>Rejoindre</Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {(activeTab === 'all' || activeTab === 'marketplace') && exploreData?.trending_marketplace?.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <ShoppingBag className="w-6 h-6 text-[#00B894]" />
                  Produits populaires
                </h2>
                <div className="space-y-3">
                  {exploreData.trending_marketplace.slice(0, visibleCounts.marketplace).map(item => (
                    <MarketplaceRow key={item.id} item={item} style={{}} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'smartclips') && exploreData?.trending_smartclips?.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Video className="w-6 h-6 text-[#00B894]" />
                  Vidéos SmartClips
                </h2>
                <div className="space-y-3">
                  {exploreData.trending_smartclips.slice(0, visibleCounts.smartclips).map(clip => (
                    <SmartClipRow key={clip.id} clip={clip} style={{}} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'vibecoding') && exploreData?.trending_vibe_projects?.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Code2 className="w-6 h-6 text-[#00B894]" />
                  Projets Vibe-Coding
                </h2>
                <div className="space-y-3">
                  {exploreData.trending_vibe_projects.slice(0, 4).map(project => (
                    <VibeProjectRow key={project.id} project={project} style={{}} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'apps') && exploreData?.trending_apps?.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <AppWindow className="w-6 h-6 text-[#00B894]" />
                  Applications tendances
                </h2>
                <div className="space-y-3">
                  {exploreData.trending_apps.slice(0, 4).map(app => (
                    <AppRow key={app.id} app={app} style={{}} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'news') && exploreData?.trending_news?.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <Newspaper className="w-6 h-6 text-[#00B894]" />
                  Actualités
                </h2>
                <div className="space-y-3">
                  {exploreData.trending_news.slice(0, 4).map(news => (
                    <Card key={news.id} className="p-4 cursor-pointer hover:shadow-lg">
                      <div className="flex gap-3">
                        {news.image && <img src={news.image} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                        <div>
                          <p className="font-semibold line-clamp-2">{news.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{news.source} • {formatTimeAgo(news.published_at)}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

  {/* Recommandations personnalisées */}
            <Card className="p-6 bg-gradient-to-br from-[#00B894]/10 to-[#0984E3]/10 border-none">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-6 h-6 text-[#00B894]" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recommandations personnalisées</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Basé sur vos centres d'intérêt et votre activité récente
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-white dark:bg-gray-800">Mathématiques</Badge>
                <Badge className="bg-white dark:bg-gray-800">Informatique</Badge>
                <Badge className="bg-white dark:bg-gray-800">Développement Web</Badge>
                <Badge className="bg-white dark:bg-gray-800">Intelligence Artificielle</Badge>
                <Badge className="bg-white dark:bg-gray-800">Applications Mobiles</Badge>
              </div>
            </Card>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

Explore.propTypes = {};

export default Explore;
