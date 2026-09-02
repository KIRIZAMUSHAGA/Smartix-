import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, RotateCcw, ArrowLeft, Grid3x3, 
  List, Loader2, CheckSquare, Square, Calendar,
  Image, FileText, AlertTriangle, Undo2
} from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { getImageUrl } from '../config/apiClient';

// Composants UI
import { SkeletonFeed, useSkeletonLoader } from '../components/SkeletonComplete';
import BottomNav from '../components/BottomNav';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {

  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const DELETE_DAYS = 30;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const POSTS_PER_PAGE = 20;

// Groupes de suppression
const GROUPS = [
  { key: 'urgent', label: '⚠️ Suppression imminente', maxDays: 7, color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
  { key: 'soon', label: '📅 Bientôt supprimés', maxDays: 14, color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  { key: 'later', label: '🕐 Dans les prochaines semaines', maxDays: 21, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
  { key: 'far', label: '⏳ Expire dans plus de 3 semaines', maxDays: Infinity, color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' }
];

// =============================
// UTILITAIRES
// =============================
const getDaysRemaining = (createdAt) => {
  const date = new Date(createdAt);
  const deleteDate = new Date(date.getTime() + DELETE_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysLeft = Math.ceil((deleteDate - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 ko';
  if (bytes < 1024) return `${bytes} o`;
  return `${(bytes / 1024).toFixed(1)} ko`;
};

const groupPostsByDays = (posts) => {
  const groups = {};
  GROUPS.forEach(group => { groups[group.key] = []; });
  
  posts.forEach(post => {
    const days = post.daysRemaining;
    const group = GROUPS.find(g => days <= g.maxDays);
    if (group) groups[group.key].push(post);
  });
  
  return groups;
};

// =============================
// COMPOSANT POST CARD
// =============================
const PostCard = ({ post, isSelected, onToggleSelect, viewMode }) => {
  const imageUrl = post.image_url ? getImageUrl(post.image_url, 'posts') : null;
  
  const handleClick = (e) => {
    e.stopPropagation();
    onToggleSelect(post.id);
  };

  if (viewMode === 'grid') {
    return (
      <div
        className={`group relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300 ${
          isSelected ? 'ring-2 ring-blue-500 scale-[1.02]' : 'hover:scale-[1.01]'
        }`}
        onClick={handleClick}
      >
        <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Post"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="w-12 h-12 text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-3 right-3">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              isSelected 
                ? 'bg-blue-500 border-blue-500' 
                : 'border-white/50 bg-black/30'
            }`}>
              {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-xs truncate">{post.content?.substring(0, 40)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-white/60">{formatFileSize(post.file_size)}</span>
            <span className="text-[10px] text-yellow-400">⚠️ {post.daysRemaining}j</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group bg-card/50 border rounded-xl p-4 cursor-pointer transition-all duration-300 ${
        isSelected 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-border hover:border-blue-500/50 hover:bg-accent/30'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            isSelected 
              ? 'bg-blue-500 border-blue-500' 
              : 'border-gray-400'
          }`}>
            {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
          </div>
        </div>
        
        {imageUrl ? (
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
            <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
            <FileText className="w-8 h-8 text-gray-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-medium line-clamp-2">
            {post.content || `Post de ${post.user?.full_name}`}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Suppression dans {post.daysRemaining} jours
            </span>
            <span className="flex items-center gap-1">
              <Image className="w-3 h-3" />
              {formatFileSize(post.file_size)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT GROUPE DE POSTS
// =============================
const PostGroup = ({ group, posts, selectedIds, onToggleSelect, viewMode }) => {
  if (posts.length === 0) return null;
  
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h3 className={`text-lg font-bold ${group.color}`}>{group.label}</h3>
        <div className={`px-2 py-0.5 rounded-full ${group.bgColor} ${group.color} text-xs font-bold`}>
          {posts.length}
        </div>
        <div className={`flex-1 h-px ${group.borderColor}`} />
      </div>
      
      <div className={viewMode === 'grid' 
        ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4' 
        : 'space-y-3'
      }>
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            isSelected={selectedIds.has(post.id)}
            onToggleSelect={onToggleSelect}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
};

// =============================
// COMPOSANT SKELETON
// =============================
const SavedPostsSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0f1428] pb-24">
    <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-gradient-to-r from-[#0a0e27]/80 to-[#1a1f3a]/80 border-b border-[#00D9FF]/20 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
            <div>
              <div className="h-7 w-32 bg-gray-700 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-700 rounded mt-1 animate-pulse" />
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
        </div>
      </div>
    </div>
    <div className="pt-20 max-w-4xl mx-auto px-4 py-6">
      <SkeletonFeed isLoading={true} count={6} />
    </div>
    <BottomNav />
  </div>
);

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SavedPosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getSavedPostsCache, updateSavedPostsCache } = useGlobalCache();

  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewMode, setViewMode] = useState('list');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // CHARGEMENT DES POSTS AVEC ENRICHISSEMENT
  // =============================
  const fetchSavedPosts = useCallback(async (force = false) => {
    if (!user) return;

    try {
      if (!force) {
        const cached = getSavedPostsCache(user.id);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setSavedPosts(cached.data);
          setLoading(false);
          return;
        }
      }

      const response = await client.get('/posts/saved', {
        params: { page: 1, limit: POSTS_PER_PAGE }
      });
      
      const posts = response.data || [];
      
      // Enrichir avec les jours restants et la taille
      const enrichedPosts = posts.map(post => ({
        ...post,
        daysRemaining: getDaysRemaining(post.created_at),
        file_size: post.file_size || 0
      }));
      
      setSavedPosts(enrichedPosts);
      
      updateSavedPostsCache(user.id, {
        data: enrichedPosts,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error fetching saved posts:', error);
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur lors du chargement des posts sauvegardés');
      }
    } finally {
      setLoading(false);
    }
  }, [user, client, getSavedPostsCache, updateSavedPostsCache, navigate]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  // =============================
  // GROUPEMENT DES POSTS (mémorisé)
  // =============================
  const groupedPosts = useMemo(() => {
    if (savedPosts.length === 0) return {};
    return groupPostsByDays(savedPosts);
  }, [savedPosts]);

  // =============================
  // STATISTIQUES
  // =============================
  const stats = useMemo(() => {
    const groups = groupPostsByDays(savedPosts);
    return {
      total: savedPosts.length,
      urgent: groups.urgent?.length || 0,
      soon: groups.soon?.length || 0,
      later: groups.later?.length || 0,
      far: groups.far?.length || 0
    };
  }, [savedPosts]);

  // =============================
  // SÉLECTION
  // =============================
  const toggleSelectItem = useCallback((postId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === savedPosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedPosts.map(p => p.id)));
    }
  }, [selectedIds, savedPosts]);

  // =============================
  // RESTAURER (avec undo)
  // =============================
  const handleRestore = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Sélectionnez au moins un élément');
      return;
    }

    const idsToRestore = new Set(selectedIds);
    const postsToRestore = savedPosts.filter(p => idsToRestore.has(p.id));
    
    setActionInProgress(true);
    
    // Sauvegarde pour undo
    const originalPosts = [...savedPosts];
    
    // Optimistic update atomique
    setSavedPosts(prev => {
      const updated = prev.filter(p => !idsToRestore.has(p.id));
      updateSavedPostsCache(user.id, {
        data: updated,
        timestamp: Date.now()
      });
      return updated;
    });
    
    const previousSelected = new Set(selectedIds);
    setSelectedIds(new Set());

    const toastId = toast.success(`${idsToRestore.size} élément(s) restauré(s)`, {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          // Rollback complet
          setSavedPosts(originalPosts);
          setSelectedIds(previousSelected);
          updateSavedPostsCache(user.id, {
            data: originalPosts,
            timestamp: Date.now()
          });
          toast.success('Restauration annulée');
        }
      }
    });

    try {
      await Promise.all(
        Array.from(idsToRestore).map(postId => 
          client.post(`/posts/${postId}/restore`)
        )
      );
    } catch (error) {
      console.error('Error restoring posts:', error);
      // Rollback
      setSavedPosts(originalPosts);
      setSelectedIds(previousSelected);
      updateSavedPostsCache(user.id, {
        data: originalPosts,
        timestamp: Date.now()
      });
      toast.dismiss(toastId);
      toast.error('Erreur lors de la restauration');
    } finally {
      setActionInProgress(false);
    }
  }, [selectedIds, savedPosts, client, user, updateSavedPostsCache]);

  // =============================
  // SUPPRIMER DÉFINITIVEMENT (avec undo)
  // =============================
  const handleDelete = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Sélectionnez au moins un élément');
      return;
    }

    const idsToDelete = new Set(selectedIds);
    const postsToDelete = savedPosts.filter(p => idsToDelete.has(p.id));
    
    setActionInProgress(true);
    
    // Sauvegarde pour undo
    const originalPosts = [...savedPosts];
    
    // Optimistic update atomique
    setSavedPosts(prev => {
      const updated = prev.filter(p => !idsToDelete.has(p.id));
      updateSavedPostsCache(user.id, {
        data: updated,
        timestamp: Date.now()
      });
      return updated;
    });
    
    const previousSelected = new Set(selectedIds);
    setSelectedIds(new Set());

    const toastId = toast.success(`${idsToDelete.size} élément(s) supprimé(s)`, {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          setSavedPosts(originalPosts);
          setSelectedIds(previousSelected);
          updateSavedPostsCache(user.id, {
            data: originalPosts,
            timestamp: Date.now()
          });
          toast.success('Suppression annulée');
        }
      }
    });

    try {
      await Promise.all(
        Array.from(idsToDelete).map(postId => 
          client.delete(`/posts/${postId}`)
        )
      );
    } catch (error) {
      console.error('Error deleting posts:', error);
      setSavedPosts(originalPosts);
      setSelectedIds(previousSelected);
      updateSavedPostsCache(user.id, {
        data: originalPosts,
        timestamp: Date.now()
      });
      toast.dismiss(toastId);
      toast.error('Erreur lors de la suppression');
    } finally {
      setActionInProgress(false);
      setShowDeleteDialog(false);
    }
  }, [selectedIds, savedPosts, client, user, updateSavedPostsCache]);

  // =============================
  // PAGINATION (charger plus)
  // =============================
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const response = await client.get('/posts/saved', {
        params: { page: page + 1, limit: POSTS_PER_PAGE }
      });
      
      const newPosts = response.data || [];
      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        const enrichedNewPosts = newPosts.map(post => ({
          ...post,
          daysRemaining: getDaysRemaining(post.created_at),
          file_size: post.file_size || 0
        }));
        setSavedPosts(prev => [...prev, ...enrichedNewPosts]);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [client, page, hasMore, loadingMore]);

  // =============================
  // RENDU
  // =============================
  if (loading) return <SavedPostsSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0f1428] pb-24 transition-colors duration-300">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-gradient-to-r from-[#0a0e27]/80 to-[#1a1f3a]/80 border-b border-[#00D9FF]/20 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-full hover:bg-[#00D9FF]/20 transition-all hover:shadow-lg hover:shadow-[#00D9FF]/50"
                aria-label="Retour"
              >
                <ArrowLeft className="w-6 h-6 text-[#00D9FF]" />
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00D9FF] via-[#00F5FF] to-[#9D4EDD] bg-clip-text text-transparent">
                  Corbeille
                </h1>
                <p className="text-xs text-[#00D9FF]/60">
                  {stats.total} élément{stats.total !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="p-2 rounded-full hover:bg-[#00D9FF]/20 transition-all hover:shadow-lg hover:shadow-[#00D9FF]/50"
              aria-label={viewMode === 'list' ? 'Vue grille' : 'Vue liste'}
            >
              {viewMode === 'list' ? (
                <Grid3x3 className="w-6 h-6 text-[#00D9FF]" />
              ) : (
                <List className="w-6 h-6 text-[#00D9FF]" />
              )}
            </button>
          </div>
          
               {/* Stats rapides */}
          {stats.total > 0 && (
            <div className="flex gap-3 mt-4">
              {stats.urgent > 0 && (
                <div className="px-2 py-1 bg-red-500/20 rounded-lg">
                  <span className="text-red-400 text-xs font-bold">⚠️ {stats.urgent} imminents</span>
                </div>
              )}
              {stats.soon > 0 && (
                <div className="px-2 py-1 bg-orange-500/20 rounded-lg">
                  <span className="text-orange-400 text-xs font-bold">📅 {stats.soon} bientôt</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-24 max-w-4xl mx-auto px-4 py-6">
        {savedPosts.length === 0 ? (
          <div className="backdrop-blur-xl bg-gradient-to-br from-[#1a1f3a]/40 to-[#2a2f4a]/40 border border-[#00D9FF]/20 p-12 text-center rounded-2xl shadow-xl">
            <Trash2 className="w-16 h-16 mx-auto mb-4 text-[#00D9FF]/40" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-[#00D9FF] to-[#9D4EDD] bg-clip-text text-transparent mb-2">
              Corbeille vide
            </h2>
            <p className="text-[#00D9FF]/60 mb-6">
              Les éléments supprimés apparaîtront ici et seront définitivement supprimés après 30 jours.
            </p>
            <Button
              onClick={() => navigate('/feed')}
              className="bg-gradient-to-r from-[#00D9FF] to-[#9D4EDD] hover:shadow-lg hover:shadow-[#00D9FF]/50 transition-all"
            >
              Retour au fil d'actualité
            </Button>
          </div>
        ) : (
          <>
            {/* Selection Bar */}
            <div className="mb-6 backdrop-blur-xl bg-gradient-to-r from-[#1a1f3a]/40 to-[#2a2f4a]/40 border border-[#00D9FF]/20 rounded-xl p-4 flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === savedPosts.length && savedPosts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded accent-[#00D9FF]"
                  disabled={actionInProgress}
                />
                <span className="text-[#00D9FF]">
                  {selectedIds.size > 0 ? `${selectedIds.size} sélectionné(s)` : 'Sélectionner tout'}
                </span>
              </label>
            </div>

            {/* Groups */}
            <div className="space-y-8">
              {GROUPS.map(group => (
                <PostGroup
                  key={group.key}
                  group={group}
                  posts={groupedPosts[group.key] || []}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelectItem}
                  viewMode={viewMode}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center py-8">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="border-[#00D9FF]/30 text-[#00D9FF] hover:bg-[#00D9FF]/10"
                >
                  {loadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Charger plus
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Action Buttons */}
      {savedPosts.length > 0 && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 backdrop-blur-xl bg-gradient-to-t from-[#0a0e27]/95 to-transparent border-t border-[#00D9FF]/20 px-4 py-4">
          <div className="max-w-4xl mx-auto flex gap-3">
            <Button
              onClick={handleRestore}
              disabled={actionInProgress}
              className="flex-1 bg-gradient-to-r from-[#00D9FF] to-[#00F5FF] text-[#0a0e27] hover:shadow-lg hover:shadow-[#00D9FF]/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionInProgress ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Restaurer ({selectedIds.size})
            </Button>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              disabled={actionInProgress}
              className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white hover:shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer définitivement {selectedIds.size} élément(s) ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground hover:bg-accent">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={actionInProgress}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {actionInProgress ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
};

SavedPosts.propTypes = {};

export default SavedPosts;
PostCard.propTypes = {
  post: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onToggleSelect: PropTypes.func.isRequired,
  viewMode: PropTypes.any.isRequired,
};
PostGroup.propTypes = {
  group: PropTypes.object.isRequired,
  posts: PropTypes.array.isRequired,
  selectedIds: PropTypes.any.isRequired,
  onToggleSelect: PropTypes.func.isRequired,
  viewMode: PropTypes.any.isRequired,
};
SavedPostsSkeleton.propTypes = {};
