import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ArrowLeft, Ban, Search, UserCheck, Loader2, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '../components/BottomNav';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const ITEMS_PER_PAGE = 20;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// =============================
// COMPOSANT PRINCIPAL
// =============================
const BlockedUsers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getBlockedCache, updateBlockedCache } = useGlobalCache();

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showUnblockAllConfirm, setShowUnblockAllConfirm] = useState(false);
  
  const observerRef = useRef();
  const lastElementRef = useCallback((node) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        setPage(prev => prev + 1);
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore]);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // CHARGEMENT DES PROFILS BLOQUÉS
  // =============================
  const fetchBlockedUsers = useCallback(async (reset = false) => {
    if (!user?.id) return;

    try {
      // Cache uniquement pour la page 1
      if (reset && page === 1) {
        const cached = getBlockedCache(user.id);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setBlockedUsers(cached.data);
          setHasMore(cached.hasMore ?? true);
          setLoading(false);
          return;
        }
        setLoading(true);
        setBlockedUsers([]);
        setPage(1);
      } else if (!reset) {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      const response = await client.get('/blocked-users', {
        params: {
          page: currentPage,
          limit: ITEMS_PER_PAGE
        }
      });

      const newUsers = response.data || [];
      
      setBlockedUsers(prev => {
        // Éviter les doublons
        const existingIds = new Set(prev.map(u => u.id));
        const uniqueNew = newUsers.filter(u => !existingIds.has(u.id));
        return reset ? newUsers : [...prev, ...uniqueNew];
      });
      
      const more = newUsers.length === ITEMS_PER_PAGE;
      setHasMore(more);
      
      if (reset && page === 1) {
        updateBlockedCache(user.id, {
          data: newUsers,
          hasMore: more,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur lors de la récupération des profils bloqués');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, client, page, getBlockedCache, updateBlockedCache, navigate]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    if (user) {
      fetchBlockedUsers(true);
    }
  }, [user]); // ✅ page retirée des dépendances

  // =============================
  // CHARGER PLUS (via scroll infini)
  // =============================
  useEffect(() => {
    if (page > 1) {
      fetchBlockedUsers();
    }
  }, [page, fetchBlockedUsers]);

  // =============================
  // DÉBLOQUER UN UTILISATEUR
  // =============================
  const handleUnblock = useCallback(async (blockedId) => {
    if (unblockingId === blockedId) return;

    setUnblockingId(blockedId);
    
    // Sauvegarde pour rollback
    let removedUser = null;
    let previousList = [];

    setBlockedUsers(prev => {
      previousList = [...prev];
      const found = prev.find(u => u.id === blockedId);
      if (found) removedUser = found;
      return prev.filter(u => u.id !== blockedId);
    });

    const toastId = toast.success('Profil débloqué', {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          // Rollback avec réinsertion à la bonne position
          if (removedUser) {
            setBlockedUsers(prev => {
              const newList = [...prev];
              const originalIndex = previousList.findIndex(u => u.id === blockedId);
              const insertAt = Math.min(originalIndex, newList.length);
              newList.splice(insertAt, 0, removedUser);
              return newList;
            });
          }
          toast.dismiss(toastId);
        }
      }
    });

    try {
      await client.post(`/blocked-users/unblock/${blockedId}`);
      
      // Mettre à jour le cache
      setBlockedUsers(prev => {
        const updated = prev.filter(u => u.id !== blockedId);
        const cached = getBlockedCache(user?.id);
        if (cached) {
          updateBlockedCache(user.id, {
            ...cached,
            data: updated,
            timestamp: Date.now()
          });
        }
        return updated;
      });
    } catch (error) {
      console.error('Failed to unblock user:', error);
      // Rollback en cas d'erreur
      if (removedUser) {
        setBlockedUsers(prev => {
          const newList = [...prev];
          const originalIndex = previousList.findIndex(u => u.id === blockedId);
          const insertAt = Math.min(originalIndex, newList.length);
          newList.splice(insertAt, 0, removedUser);
          return newList;
        });
      }
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur lors du déblocage');
      }
    } finally {
      setUnblockingId(null);
    }
  }, [unblockingId, client, user, getBlockedCache, updateBlockedCache, navigate]);

  // =============================
  // TOUT DÉBLOQUER
  // =============================
  const handleUnblockAll = useCallback(async () => {
    setShowUnblockAllConfirm(false);
    
    const blockedIds = blockedUsers.map(u => u.id);
    if (blockedIds.length === 0) return;

    const originalList = [...blockedUsers];
    setBlockedUsers([]);

    const toastId = toast.loading('Déblocage de tous les profils...');

    try {
      await Promise.all(blockedIds.map(id => 
        client.post(`/blocked-users/unblock/${id}`)
      ));
      
      toast.dismiss(toastId);
      toast.success('Tous les profils ont été débloqués');
      
      // Mettre à jour le cache
      const cached = getBlockedCache(user?.id);
      if (cached) {
        updateBlockedCache(user.id, {
          ...cached,
          data: [],
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to unblock all:', error);
      setBlockedUsers(originalList);
      toast.dismiss(toastId);
      toast.error('Erreur lors du déblocage global');
    }
  }, [blockedUsers, client, user, getBlockedCache, updateBlockedCache]);

  // =============================
  // HIGHLIGHT RECHERCHE
  // =============================
  const highlightText = useCallback((text) => {
    if (!searchQuery.trim()) return text;
    const query = searchQuery.trim().toLowerCase();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>');
  }, [searchQuery]);

  // =============================
  // FILTRAGE LOCAL
  // =============================
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return blockedUsers;
    
    const query = searchQuery.trim().toLowerCase();
    return blockedUsers.filter(u => 
      u.full_name?.toLowerCase().includes(query) ||
      u.username?.toLowerCase().includes(query)
    );
  }, [blockedUsers, searchQuery]);

  // =============================
  // STATS
  // =============================
  const stats = useMemo(() => ({
    total: blockedUsers.length,
    filteredCount: filteredUsers.length
  }), [blockedUsers, filteredUsers]);

  // =============================
  // RENDU
  // =============================
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-24 font-sans">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-20 flex items-center justify-between relative">
          <button 
            onClick={() => navigate('/friends')} 
            className="hover:bg-accent p-2 rounded-xl transition-all text-muted-foreground hover:text-foreground relative z-10"
            aria-label="Retour aux amis"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            <h1 className="text-xl font-black tracking-tight text-foreground">Profils bloqués</h1>
            <Ban className="w-5 h-5 text-red-500 opacity-60" />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Barre de recherche et stats */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Rechercher un profil bloqué..."
              className="w-full bg-card border border-border rounded-3xl py-4 pl-14 pr-8 text-foreground placeholder:text-muted-foreground/50 font-medium focus:outline-none focus:border-red-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Rechercher un profil bloqué"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-card rounded-full border border-border text-sm">
              {stats.filteredCount} / {stats.total} profil{stats.total > 1 ? 's' : ''}
            </div>
            
            {blockedUsers.length > 0 && (
              <Button
                onClick={() => setShowUnblockAllConfirm(true)}
                variant="outline"
                className="border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Tout débloquer
              </Button>
            )}
          </div>
        </div>

        {/* Chargement initial */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-red-500" />
          </div>
        ) : filteredUsers.length === 0 ? (
          /* État vide */
          <div className="py-20 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-[40px] p-12 max-w-md mx-auto">
              <div className="w-24 h-24 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Ban className="w-10 h-10 text-red-500 opacity-20" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-2">Aucun profil bloqué</h3>
              <p className="text-muted-foreground font-bold text-sm leading-relaxed">
                {searchQuery 
                  ? `Aucun profil ne correspond à "${searchQuery}".`
                  : "Votre liste de profils bloqués est vide."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Liste des profils bloqués */}
            <div className="grid sm:grid-cols-2 gap-6">
              {filteredUsers.map((user, index) => {
                const isLast = index === filteredUsers.length - 1;
                const name = user.full_name || user.username || 'Utilisateur';
                
                return (
                  <div
                    key={user.id}
                    ref={isLast ? lastElementRef : null}
                  >
                    <Card className="p-6 bg-card border border-border rounded-[32px] flex items-center justify-between transition-all duration-300 hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-12 h-12 rounded-xl border border-border">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="bg-red-500 text-white font-black">
                            {name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 
                            className="font-black text-sm text-foreground truncate"
                            dangerouslySetInnerHTML={{ __html: highlightText(name) }}
                          />
                          {user.blocked_at && (
                            <p className="text-[10px] text-muted-foreground font-bold">
                              Bloqué le {new Date(user.blocked_at).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleUnblock(user.id)} 
                        disabled={unblockingId === user.id}
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-black rounded-lg h-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Débloquer ${name}`}
                      >
                        {unblockingId === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Débloquer'
                        )}
                      </Button>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Indicateur de chargement plus */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Fin de la liste */}
            {!hasMore && blockedUsers.length > 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                — Fin de la liste —
              </p>
            )}
          </>
        )}
      </div>

      {/* Modal de confirmation Tout débloquer */}
      {showUnblockAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-card rounded-2xl p-6 max-w-md mx-4 border border-border shadow-xl animate-in zoom-in">
            <h3 className="text-xl font-black text-foreground mb-2">Tout débloquer ?</h3>
            <p className="text-muted-foreground mb-6">
              Vous allez débloquer tous les {blockedUsers.length} profil{blockedUsers.length > 1 ? 's' : ''} bloqué{blockedUsers.length > 1 ? 's' : ''}. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowUnblockAllConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleUnblockAll}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

BlockedUsers.propTypes = {};

export default BlockedUsers;
