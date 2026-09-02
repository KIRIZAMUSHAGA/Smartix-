import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, MessageSquare, Heart, Share2, 
  Trophy, Target, Globe, Lightbulb, Award,
  Search, Plus, TrendingUp, Filter, ArrowRight,
  Sparkles, GraduationCap, Zap, ArrowLeft, Loader2,
  ThumbsUp, MessageCircle, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import axios from 'axios';
import { io } from 'socket.io-client';

import { getAvatarUrl } from '../utils/avatarUtils';
import './About/AboutPage.css';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const ITEMS_PER_PAGE = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Mapping des onglets vers les types de données
const TAB_TO_TYPE = {
  'Flux Global': 'posts',
  'Groupes d\'Étude': 'groups',
  'Tableau d\'Honneur': 'ranking',
  'Projets': 'projects'
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Community = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();

  // Cache local pour éviter les requêtes répétées
  const localCache = useRef({});
  const getCommunityCache = useCallback((type) => localCache.current[type] || null, []);
  const updateCommunityCache = useCallback((type, data) => { localCache.current[type] = data; }, []);

  const [activeTab, setActiveTab] = useState('Flux Global');
  const [data, setData] = useState({
    posts: [],
    groups: [],
    ranking: [],
    projects: []
  });
  const [loading, setLoading] = useState({
    posts: false,
    groups: false,
    ranking: false,
    projects: false
  });
  const [loadingMore, setLoadingMore] = useState({
    posts: false,
    groups: false,
    ranking: false,
    projects: false
  });
  const [hasMore, setHasMore] = useState({
    posts: true,
    groups: true,
    ranking: true,
    projects: true
  });
  const [page, setPage] = useState({
    posts: 1,
    groups: 1,
    ranking: 1,
    projects: 1
  });

  const observerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const socketRef = useRef(null);

  const isAuthenticated = !!user;
  const [searchQuery, setSearchQuery] = useState('');

  // =============================
  // ACTIONS POUR UTILISATEURS NON CONNECTÉS
  // =============================
  const requireAuth = useCallback((action = "interagir") => {
    toast.info(`Connectez-vous pour ${action}`, {
      action: {
        label: "Se connecter",
        onClick: () => navigate('/auth?mode=login')
      },
    });
    return false;
  }, [navigate]);

  // =============================
  // DÉDUPLICATION DES DONNÉES
  // =============================
  const mergeWithoutDuplicates = useCallback((existing, newItems) => {
    const existingIds = new Set(existing.map(item => item.id));
    const merged = [...existing];
    newItems.forEach(item => {
      if (!existingIds.has(item.id)) {
        merged.push(item);
      }
    });
    return merged;
  }, []);

  // =============================
  // CHARGEMENT DES DONNÉES
  // =============================
  const fetchData = useCallback(async (type, reset = false, customPage = null) => {
    const currentPage = customPage !== null ? customPage : (reset ? 1 : page[type]);
    const isLoadingMore = !reset && currentPage > 1;

    // Mettre à jour l'état de chargement
    if (reset) {
      setLoading(prev => ({ ...prev, [type]: true }));
    } else if (isLoadingMore) {
      setLoadingMore(prev => ({ ...prev, [type]: true }));
    }

    try {
      // Vérifier le cache pour reset uniquement
      if (reset) {
        const cached = getCommunityCache(type);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setData(prev => ({ ...prev, [type]: cached.data }));
          setHasMore(prev => ({ ...prev, [type]: cached.hasMore ?? true }));
          setLoading(prev => ({ ...prev, [type]: false }));
          return;
        }
      }

      let newData = [];
      const cycleTypes = ['posts', 'groups', 'projects', 'ranking'];
      if (cycleTypes.includes(type)) {
        if (client) {
          const response = await client.get(`/community/${type}/cycle`);
          newData = response?.items || [];
        } else {
          const res = await axios.get(`/api/community/${type}/cycle`);
          newData = res.data?.items || [];
        }
      } else if (client) {
        const response = await client.get(`/community/${type}`, {
          params: { page: currentPage, limit: ITEMS_PER_PAGE }
        });
        newData = response.data?.items || [];
      } else {
        const res = await axios.get(`/api/community/${type}`, {
          params: { page: currentPage, limit: ITEMS_PER_PAGE }
        });
        newData = res.data?.items || [];
      }

      const more = newData.length === ITEMS_PER_PAGE;

      const maxPosts = isAuthenticated ? Infinity : 5;
      const limitedNewData = type === 'posts' ? newData.slice(0, maxPosts) : newData;

      setData(prev => ({
        ...prev,
        [type]: reset ? limitedNewData : mergeWithoutDuplicates(prev[type], limitedNewData)
      }));
      setHasMore(prev => ({ ...prev, [type]: more }));

      // Mettre à jour le cache pour reset uniquement
      if (reset) {
        updateCommunityCache(type, {
          data: newData,
          hasMore: more,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`Failed to fetch ${type}:`, error);
      if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else if (error.response?.status !== 401) {
        toast.error(`Erreur chargement ${type}`);
      }
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
      setLoadingMore(prev => ({ ...prev, [type]: false }));
    }
  }, [client, page, getCommunityCache, updateCommunityCache, mergeWithoutDuplicates, isAuthenticated]);

  // =============================
  // CHARGER PLUS (PAGINATION CORRIGÉE)
  // =============================
  const loadMore = useCallback((type) => {
    const isLoading = loadingMore[type] || loading[type];
    if (!isLoading && hasMore[type]) {
      setPage(prev => {
        const nextPage = prev[type] + 1;
        fetchData(type, false, nextPage);
        return { ...prev, [type]: nextPage };
      });
    }
  }, [loadingMore, loading, hasMore, fetchData]);

  // =============================
  // F3 — SOCKET.IO TEMPS RÉEL
  // =============================
  useEffect(() => {
    const SOCKET_URL = window.location.origin;
    const socket = io(SOCKET_URL, {
      path: '/ws/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_community_room', {});
    });

    socket.on('post:like_update', ({ post_id, likes_count }) => {
      setData(prev => ({
        ...prev,
        posts: prev.posts.map(p =>
          p.id === post_id ? { ...p, likes_count } : p
        )
      }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // =============================
  // INFINITE SCROLL (groupes, classement, projets uniquement)
  // =============================
  useEffect(() => {
    if (!isAuthenticated) return;
    const currentType = TAB_TO_TYPE[activeTab];
    if (currentType === 'posts') return;
    if (!hasMore[currentType] || loading[currentType] || loadingMore[currentType]) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore(currentType);
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    );

    if (loadMoreTriggerRef.current) {
      observer.observe(loadMoreTriggerRef.current);
    }

    return () => observer.disconnect();
  }, [activeTab, hasMore, loading, loadingMore, loadMore, isAuthenticated]);

  // =============================
  // CHARGEMENT SELON L'ONGLET ACTIF
  // =============================
  useEffect(() => {
    const type = TAB_TO_TYPE[activeTab];
    fetchData(type, true);
  }, [activeTab, fetchData]);

  // =============================
  // POLLING AUTOMATIQUE — GROUPES (30s)
  // =============================
  useEffect(() => {
    if (activeTab !== 'Groupes d\'Étude') return;
    const interval = setInterval(() => {
      fetchData('groups', true);
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchData]);

  // =============================
  // LIKE (CORRIGÉ)
  // =============================
  const handleLike = useCallback(async (postId) => {
    if (!isAuthenticated) return requireAuth('liker');

    let originalLiked;
    let originalCount;

    setData(prev => {
      const post = prev.posts.find(p => p.id === postId);
      if (post) {
        originalLiked = post.liked;
        originalCount = post.likes_count || 0;
      }
      return {
        ...prev,
        posts: prev.posts.map(p => {
          if (p.id === postId) {
            const wasLiked = p.liked;
            return {
              ...p,
              liked: !wasLiked,
              likes_count: (p.likes_count || 0) + (wasLiked ? -1 : 1)
            };
          }
          return p;
        })
      };
    });

    try {
      await client.post(`/community/posts/${postId}/like`);
    } catch (error) {
      setData(prev => ({
        ...prev,
        posts: prev.posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              liked: originalLiked,
              likes_count: originalCount
            };
          }
          return p;
        })
      }));
      toast.error('Erreur lors du like');
    }
  }, [isAuthenticated, requireAuth, client]);

  // =============================
  // PARTAGE (SÉCURISÉ)
  // =============================
  const handleShare = useCallback(async (url) => {
    if (!isAuthenticated) return requireAuth('partager');
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // L'utilisateur a annulé
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié !');
      } catch {
        toast.error('Impossible de copier le lien');
      }
    }
  }, [isAuthenticated, requireAuth]);

  // =============================
  // RAFRAÎCHISSEMENT FORCÉ DES GROUPES (bypass cache)
  // =============================
  const handleRefreshGroups = useCallback(() => {
    updateCommunityCache('groups', null);
    fetchData('groups', true);
  }, [updateCommunityCache, fetchData]);

  // =============================
  // RENDU DE L'ONGLET GROUPE (MÉMOÏSÉ)
  // =============================
  const GroupsTab = useMemo(() => {
    const groups = data.groups;
    const isLoading = loading.groups;

    if (isLoading && groups.length === 0) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35]" />
        </div>
      );
    }

    if (groups.length === 0) {
      return (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">Aucun groupe d'étude disponible</p>
          <p className="text-sm text-muted-foreground/60 mt-1">De nouveaux groupes apparaîtront automatiquement chaque jour</p>
          <button
            onClick={handleRefreshGroups}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff6b35] text-white rounded-full font-semibold hover:bg-[#ff8c61] transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Rafraîchir
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground/50 uppercase tracking-widest font-bold">Groupes du jour</p>
          <button
            onClick={handleRefreshGroups}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-[#ff6b35] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {groups.map((group, i) => (
            <div key={group.id || i} className="p-8 rounded-[40px] bg-card border border-border shadow-sm hover:border-[#ff6b35]/50 transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div className="text-5xl">{group.icon || '📚'}</div>
                <Button 
                  onClick={() => isAuthenticated ? navigate(`/groups/${group.id}`) : requireAuth()}
                  variant="ghost" 
                  className="rounded-full bg-secondary text-foreground hover:bg-[#ff6b35] hover:text-white"
                >
                  Rejoindre
                </Button>
              </div>
              <h3 className="text-2xl font-bold mb-2">{group.name}</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{group.description}</p>
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-[#ff6b35]">
                <span className="px-3 py-1 bg-[#ff6b35]/10 rounded-full">{group.category}</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {group.members_count} membres</span>
              </div>
            </div>
          ))}
        </div>
        {hasMore.groups && (
          <div ref={loadMoreTriggerRef} className="h-8" />
        )}
      </div>
    );
  }, [data.groups, loading.groups, hasMore.groups, isAuthenticated, requireAuth, navigate, handleRefreshGroups]);

  // =============================
  // RENDU DE L'ONGLET CLASSEMENT (MÉMOÏSÉ)
  // =============================
  const RankingTab = useMemo(() => {
    const ranking = data.ranking;
    const isLoading = loading.ranking;

    if (isLoading && ranking.length === 0) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35]" />
        </div>
      );
    }

    if (ranking.length === 0) {
      return (
        <div className="text-center py-16">
          <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">Tableau d'honneur vide</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Les meilleurs étudiants apparaîtront ici au fur et à mesure de leur progression.</p>
        </div>
      );
    }

    const CRITERIA = [
      { icon: '📝', label: 'Posts publiés cette semaine', weight: '×10 pts' },
      { icon: '👥', label: 'Abonnés au profil', weight: '×5 pts' },
      { icon: '🚀', label: 'Projets publiés (total)', weight: '×20 pts' },
      { icon: '❤️', label: 'Likes reçus cette semaine', weight: '×2 pts' },
    ];

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground/50 uppercase tracking-widest font-bold">Classement de la semaine</p>
          <span className="text-[10px] text-muted-foreground/40 font-medium">Se renouvelle chaque lundi</span>
        </div>
        <div className="grid gap-3">
          {ranking.map((rankUser, i) => {
            const stats = rankUser.stats || {};
            const isTop3 = rankUser.rank <= 3;
            return (
              <div key={rankUser.id || i} className={`p-4 rounded-2xl bg-card border shadow-sm transition-all ${
                rankUser.rank === 1 ? 'border-yellow-500/40 shadow-yellow-500/10' :
                rankUser.rank === 2 ? 'border-gray-400/30' :
                rankUser.rank === 3 ? 'border-amber-600/30' :
                'border-border'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-base ${
                    rankUser.rank === 1 ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/30' :
                    rankUser.rank === 2 ? 'bg-gray-300 text-gray-800' :
                    rankUser.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-secondary text-muted-foreground/60'
                  }`}>
                    {isTop3 ? ['🥇','🥈','🥉'][rankUser.rank - 1] : `#${rankUser.rank}`}
                  </div>
                  <div className="w-11 h-11 rounded-full flex-shrink-0 overflow-hidden border-2 border-[#ff6b35]/20 bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] flex items-center justify-center text-white font-black text-sm">
                    {rankUser.avatar ? (
                      <img src={rankUser.avatar} alt={rankUser.full_name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span>{rankUser.full_name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[14px] text-foreground truncate">{rankUser.full_name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">{rankUser.badge || 'Apprenant'}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-[#ff6b35] font-black text-xs">{rankUser.score || rankUser.points || 0} pts</span>
                    </div>
                  </div>
                </div>
                {(stats.posts > 0 || stats.followers > 0 || stats.projects > 0 || stats.likes > 0) && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/40">
                    {stats.posts > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <span>📝</span><span className="font-bold">{stats.posts}</span>
                      </span>
                    )}
                    {stats.followers > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <span>👥</span><span className="font-bold">{stats.followers}</span>
                      </span>
                    )}
                    {stats.projects > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <span>🚀</span><span className="font-bold">{stats.projects}</span>
                      </span>
                    )}
                    {stats.likes > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <span>❤️</span><span className="font-bold">{stats.likes}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hasMore.ranking && (
          <div ref={loadMoreTriggerRef} className="h-8" />
        )}

        {/* Critères du classement */}
        <div className="mt-8 p-4 rounded-2xl bg-secondary/50 border border-border/50">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">📊 Critères du classement hebdomadaire</p>
          <div className="grid gap-2">
            {CRITERIA.map(c => (
              <div key={c.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/70 flex items-center gap-2">
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </span>
                <span className="text-[11px] font-black text-[#ff6b35]">{c.weight}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-3 leading-relaxed">
            Le classement se réinitialise chaque lundi à minuit. Les likes et posts comptent uniquement pour la semaine en cours. Les projets sont comptabilisés sur l'ensemble de l'historique.
          </p>
        </div>
      </div>
    );
  }, [data.ranking, loading.ranking, hasMore.ranking]);

  // =============================
  // RENDU DE L'ONGLET PROJETS (MÉMOÏSÉ)
  // =============================
  const ProjectsTab = useMemo(() => {
    const projects = data.projects;
    const isLoading = loading.projects;

    if (isLoading && projects.length === 0) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35]" />
        </div>
      );
    }

    if (projects.length === 0) {
      return (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">Aucun projet collaboratif en cours</p>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm mx-auto">
              Les projets créés par la communauté apparaîtront ici. Vous pouvez lancer le premier !
            </p>
          </div>
          <div
            onClick={() => isAuthenticated ? navigate('/projects/create') : requireAuth('créer un projet')}
            className="p-10 rounded-2xl bg-card border border-dashed border-border text-center group cursor-pointer hover:border-[#ff6b35]/50 transition-all"
          >
            <Plus className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20 group-hover:text-[#ff6b35] transition-colors" />
            <h3 className="text-base font-bold text-muted-foreground/40 group-hover:text-foreground transition-colors">
              Lancer un nouveau projet collaboratif
            </h3>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        <p className="text-xs text-muted-foreground/50 uppercase tracking-widest font-bold">Projets en cours</p>
        <div className="grid gap-5">
          {projects.map((project, i) => {
            const authorName = project.author?.full_name || project.lead || 'Équipe Smartix';
            const authorAvatar = project.author?.avatar;
            const statusLabel = {
              draft: 'Brouillon', generated: 'Généré', editing: 'En cours',
              running: 'En ligne', published: 'Publié', archived: 'Archivé'
            }[project.status] || project.status || 'En cours';
            const statusColor = {
              published: 'bg-green-500/10 text-green-500',
              running: 'bg-blue-500/10 text-blue-500',
              editing: 'bg-orange-500/10 text-orange-500',
              draft: 'bg-gray-500/10 text-gray-500',
            }[project.status] || 'bg-blue-500/10 text-blue-500';
            const progress = Number(project.progress) || 0;

            return (
              <div key={project.id || i} className="p-5 rounded-2xl bg-card border border-border shadow-sm hover:border-blue-500/30 transition-all">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${statusColor}`}>
                      {statusLabel}
                    </div>
                    {project.type && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground uppercase tracking-wider">
                        {project.type}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-foreground mt-1 truncate">{project.title || project.name || 'Projet sans titre'}</h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                    {authorAvatar ? (
                      <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span>{authorName.charAt(0)}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium truncate">{authorName}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    <span>Progression</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {hasMore.projects && (
          <div ref={loadMoreTriggerRef} className="h-8" />
        )}
        <div
          onClick={() => isAuthenticated ? navigate('/projects/create') : requireAuth('créer un projet')}
          className="p-8 rounded-2xl bg-card border border-dashed border-border text-center group cursor-pointer hover:border-[#ff6b35]/50 transition-all"
        >
          <Plus className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20 group-hover:text-[#ff6b35] transition-colors" />
          <h3 className="text-base font-bold text-muted-foreground/40 group-hover:text-foreground transition-colors">
            Lancer un nouveau projet collaboratif
          </h3>
        </div>
      </div>
    );
  }, [data.projects, loading.projects, hasMore.projects, isAuthenticated, requireAuth, navigate]);

  // =============================
  // RENDU DE L'ONGLET FLUX (MÉMOÏSÉ)
  // =============================
  const FeedTab = useMemo(() => {
    const posts = data.posts;
    const isLoading = loading.posts;

    if (isLoading && posts.length === 0) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-[#ff6b35]" />
        </div>
      );
    }

    if (posts.length === 0) {
      return (
        <div className="text-center py-20">
          <MessageSquare className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">Aucun post pour le moment</p>
        </div>
      );
    }

    const filteredPosts = searchQuery
      ? posts.filter(p =>
          p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.author?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : posts;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Rechercher dans la communauté..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/30 focus:border-[#ff6b35]/50 transition-all"
            />
          </div>
          <button
            onClick={() => isAuthenticated ? navigate('/create-post') : requireAuth('publier')}
            style={{ backgroundColor: '#ff6b35' }}
            className="h-10 rounded-xl text-white px-5 font-bold flex-shrink-0 inline-flex items-center hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Publier
          </button>
        </div>

        {filteredPosts.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun résultat pour « {searchQuery} »</p>
          </div>
        )}

        {filteredPosts.map((post) => (
          <div key={post.id} className="rounded-2xl bg-card border border-border shadow-sm hover:border-[#ff6b35]/30 transition-all overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 rounded-full border-2 border-[#ff6b35]/30">
                  <AvatarImage
                    src={getAvatarUrl(post.author?.avatar || post.author?.profile_picture || post.author?.avatar_url)}
                    alt={post.author?.full_name}
                  />
                  <AvatarFallback className="rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] text-white font-black">
                    {post.author?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-[15px] text-foreground leading-tight">{post.author?.full_name || 'Utilisateur'}</h3>
                  <p className="text-xs text-muted-foreground/60">
                    {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {post.category && <span className="ml-2 text-[#ff6b35]">• {post.category}</span>}
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 bg-secondary rounded-full border border-border text-[10px] font-bold uppercase tracking-tight text-muted-foreground/70">
                {post.category || '📚 Ressources'}
              </div>
            </div>

            <div className="px-5 pb-4">
              <p className="text-[15px] text-foreground/80 leading-relaxed">{post.content}</p>
            </div>

            <div className="flex items-center border-t border-border/50 mx-2 mb-1">
              <div className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/50">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${post.liked ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}>
                  <ThumbsUp className="w-2 h-2 text-white fill-white" />
                </div>
                <span>{post.likes_count || 0}</span>
                <span className="ml-2">{post.comments_count || 0} commentaire{post.comments_count > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 px-2 pb-2">
              <button
                onClick={() => handleLike(post.id)}
                disabled={!isAuthenticated}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full transition-colors ${
                  post.liked ? 'text-blue-500' : 'text-muted-foreground/60'
                } ${isAuthenticated ? 'hover:bg-accent cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              >
                <ThumbsUp className={`w-5 h-5 ${post.liked ? 'fill-blue-500 text-blue-500' : ''}`} />
                <span className="text-[14px] font-semibold">J'aime</span>
              </button>
              <button
                onClick={() => {
                  if (!isAuthenticated) return requireAuth('commenter');
                  navigate(`/posts/${post.id}`);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-muted-foreground/60 hover:bg-accent hover:text-blue-500 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-[14px] font-semibold">Commenter</span>
              </button>
              <button
                onClick={() => handleShare(`${window.location.origin}/posts/${post.id}`)}
                disabled={!isAuthenticated}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full transition-colors text-muted-foreground/60 ${
                  isAuthenticated ? 'hover:bg-accent hover:text-green-500 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <Share2 className="w-5 h-5" />
                <span className="text-[14px] font-semibold">Partager</span>
              </button>
            </div>
          </div>
        ))}

        {!isAuthenticated && (
          <div className="text-center py-12">
            <div 
              onClick={() => navigate('/auth?mode=login')}
              className="inline-block p-1 bg-gradient-to-r from-[#ff6b35] to-transparent rounded-full mb-6 cursor-pointer hover:scale-105 transition-transform"
            >
              <div className="px-8 py-3 bg-card border border-border rounded-full text-sm font-bold text-muted-foreground/50 hover:text-foreground transition-colors shadow-sm">
                Connectez-vous pour voir plus de contenu
              </div>
            </div>
            <br />
            <Button 
              onClick={() => navigate('/auth?mode=signup')}
              className="bg-foreground text-background hover:bg-foreground/90 px-10 h-16 rounded-full font-bold text-xl shadow-2xl transition-all hover:scale-105"
            >
              Rejoindre la Communauté
            </Button>
          </div>
        )}
      </div>
    );
  }, [data.posts, loading.posts, isAuthenticated, handleLike, handleShare, requireAuth, navigate, searchQuery, setSearchQuery]);

  // =============================
  // RENDU PRINCIPAL
  // =============================
  const renderContent = () => {
    switch (activeTab) {
      case 'Groupes d\'Étude': return GroupsTab;
      case 'Tableau d\'Honneur': return RankingTab;
      case 'Projets': return ProjectsTab;
      default: return FeedTab;
    }
  };

  return (
    <div className="about-page min-h-screen bg-background text-foreground transition-colors duration-300 overflow-x-hidden relative">
      {/* Header */}
      <section className="px-6 pt-6 pb-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth', { replace: true, state: { openMenu: true } })}
              className="p-2 hover:bg-accent rounded-full transition-all flex-shrink-0"
              aria-label="Retour au menu"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-black text-foreground leading-tight">
                Communauté <span className="text-[#ff6b35]">Smartix</span>
              </h1>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Découvre ce que les autres membres accomplissent déjà.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="px-6 mb-12">
        <div className="max-w-6xl mx-auto border-b border-border/50">
          <div className="flex gap-8 overflow-x-auto no-scrollbar">
            {['Flux Global', 'Groupes d\'Étude', 'Tableau d\'Honneur', 'Projets'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-[#ff6b35]' : 'text-muted-foreground/50 hover:text-foreground'}`}
              >
                {tab}
                {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#ff6b35] rounded-full" />}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-border/50 text-center">
        <h2 className="text-xl font-bold opacity-30 mb-4 tracking-tighter uppercase text-foreground">Smartix Community</h2>
        <p className="text-muted-foreground/50 text-xs">© 2026 Smartix Platform. Ensemble pour l'Afrique.</p>
      </footer>
    </div>
  );
};

Community.propTypes = {};

export default Community;
 
