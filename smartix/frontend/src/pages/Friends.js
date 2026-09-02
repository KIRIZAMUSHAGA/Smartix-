import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Mail, ShieldCheck, Users, Search, 
  MoreVertical, Ban, Settings, UserPlus, UserCheck, 
  Clock, Loader2, XCircle, CheckCircle, Send, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import BottomNav from '../components/BottomNav';
import { useRegisterRefresh } from '../contexts/PullToRefreshContext';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { useDebounce } from '../hooks/useDebounce';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const COLOR_CLASSES = {
  orange: 'bg-[#ff6b35] hover:bg-[#ff6b35]/90',
  blue: 'bg-blue-600 hover:bg-blue-700',
  red: 'bg-red-600 hover:bg-red-700',
  green: 'bg-green-600 hover:bg-green-700'
};

// =============================
// SKELETON LOADER
// =============================
const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
      <div className="w-20 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  </div>
);

// =============================
// EMPTY STATE
// =============================
const EmptyState = ({ Icon, text, description }) => (
  <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-[32px] border border-gray-200 dark:border-gray-700">
    <Icon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
    <p className="font-bold text-gray-500">{text}</p>
    {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
  </div>
);

// =============================
// LOADING WRAPPER
// =============================
const ListWrapper = ({ loading, data, emptyIcon: Icon, emptyText, emptyDescription, children, skeletonCount = 3 }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(skeletonCount)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  
  if (!data?.length) {
    return <EmptyState Icon={Icon} text={emptyText} description={emptyDescription} />;
  }
  
  return children;
};

// =============================
// USER CARD
// =============================
const UserCard = ({ user, onClick, onAction, actionLabel, actionIcon: ActionIcon, actionColor = 'blue', loading = false }) => {
  const handleAction = (e) => {
    e.stopPropagation();
    if (onAction) onAction();
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-4 flex-1">
        {user.avatar ? (
          <img src={user.avatar} alt={user.full_name} className="w-14 h-14 rounded-2xl object-cover border-2 border-gray-200 dark:border-gray-600" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
            <User className="w-7 h-7 text-[#ff6b35]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-black dark:text-white truncate">{user.full_name}</h3>
          <p className="text-xs font-bold text-gray-400 truncate">@{user.username}</p>
          {user.email && <p className="text-[10px] text-gray-400 truncate">{user.email}</p>}
        </div>
      </div>
      {onAction && (
        <Button 
          onClick={handleAction}
          disabled={loading}
          className={`${COLOR_CLASSES[actionColor] || COLOR_CLASSES.blue} text-white font-black rounded-xl h-10 px-6 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {ActionIcon && <ActionIcon className="w-4 h-4 mr-1" />}
              {actionLabel}
            </>
          )}
        </Button>
      )}
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Friends = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { friendsData, fetchFriendsData, fetchMoreSuggestions, updateFriendsData } = useGlobalCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('friends');
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState({ show: false, action: null, targetId: null, targetName: '' });
  
  const observer = useRef();
  const loadMoreRef = useRef(null);
  const isMountedRef = useRef(true);

  // Debounce search
  const debouncedSearch = useDebounce(searchTerm, 300);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    const cacheAge = friendsData?.lastFetched ? Date.now() - friendsData.lastFetched : Infinity;
    if (cacheAge > 300000) {
      fetchFriendsData();
    }
  }, [fetchFriendsData, friendsData?.lastFetched]);

  // =============================
  // NETTOYAGE
  // =============================
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  // =============================
  // INFINITE SCROLL SUGGESTIONS
  // =============================
  const loadMore = useCallback(async () => {
    if (isFetchingMore || !friendsData?.hasMoreSuggestions) return;
    setIsFetchingMore(true);
    await fetchMoreSuggestions();
    setIsFetchingMore(false);
  }, [isFetchingMore, friendsData?.hasMoreSuggestions, fetchMoreSuggestions]);

  useEffect(() => {
    if (!loadMoreRef.current || activeTab !== 'suggestions') return;
    
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && friendsData?.hasMoreSuggestions && !friendsData?.isInitialLoading && !isFetchingMore) {
          loadMore();
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    );
    
    observer.current.observe(loadMoreRef.current);
    
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [activeTab, friendsData?.hasMoreSuggestions, friendsData?.isInitialLoading, isFetchingMore, loadMore]);

  // =============================
  // CONFIRMATION DIALOG
  // =============================
  const confirmAction = (action, targetId, targetName) => {
    setShowConfirmDialog({ show: true, action, targetId, targetName });
  };

  const executeConfirmedAction = async () => {
    const { action, targetId, targetName } = showConfirmDialog;
    if (!action) return;
    
    setShowConfirmDialog({ show: false, action: null, targetId: null, targetName: '' });
    
    let successMsg = '';
    let endpoint = '';
    let actionType = '';
    
    switch (action) {
      case 'accept':
        successMsg = `Demande d'ami de ${targetName} acceptée`;
        endpoint = `/friends/accept/${targetId}`;
        actionType = 'accept';
        break;
      case 'cancel':
        successMsg = `Demande envoyée à ${targetName} annulée`;
        endpoint = `/friends/cancel/${targetId}`;
        actionType = 'cancel';
        break;
      case 'request':
        successMsg = `Demande d'ami envoyée à ${targetName}`;
        endpoint = `/friends/request/${targetId}`;
        actionType = 'request';
        break;
      default: return;
    }
    
    if (loadingAction === targetId) return;
    setLoadingAction(targetId);
    
    // Optimistic update
    if (actionType === 'accept') {
      const request = friendsData.requests?.find(r => r.id === targetId);
      if (request) {
        updateFriendsData(prev => ({
          ...prev,
          requests: prev.requests?.filter(r => r.id !== targetId),
          friends: [...(prev.friends || []), request]
        }));
      }
    } else if (actionType === 'cancel') {
      updateFriendsData(prev => ({
        ...prev,
        sent: prev.sent?.filter(s => s.id !== targetId)
      }));
    } else if (actionType === 'request') {
      const suggested = friendsData.suggestions?.find(s => s.id === targetId);
      if (suggested) {
        updateFriendsData(prev => ({
          ...prev,
          suggestions: prev.suggestions?.filter(s => s.id !== targetId),
          sent: [...(prev.sent || []), suggested]
        }));
      }
    }

    try {
      await client.post(endpoint);
      toast.success(successMsg);
      fetchFriendsData(true);
    } catch (error) {
      console.error('Action error:', error);
      // Rollback en rechargeant les données
      fetchFriendsData(true);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error(error.response?.data?.message || 'Une erreur est survenue');
      }
    } finally {
      if (isMountedRef.current) setLoadingAction(null);
    }
  };

  // =============================
  // FILTRAGE DES AMIS (mémorisé)
  // =============================
  const filteredFriends = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return (friendsData?.friends || []).filter(f => 
      (f.full_name || '').toLowerCase().includes(query) ||
      (f.username || '').toLowerCase().includes(query)
    );
  }, [friendsData?.friends, debouncedSearch]);

  // =============================
  // NAVIGATION
  // =============================
  const goToProfile = useCallback((id) => navigate(`/profile/${id}`), [navigate]);

  const loading = friendsData?.isInitialLoading && !friendsData?.lastFetched;

  // =============================
  // CONFIRMATION DIALOG MODAL
  // =============================
  const ConfirmDialog = () => {
    if (!showConfirmDialog.show) return null;
    
    const { targetName, action } = showConfirmDialog;
    const actionText = action === 'accept' ? 'accepter' : action === 'cancel' ? 'annuler' : 'envoyer';
    
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirmer l'action</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Voulez-vous vraiment {actionText} la demande de <span className="font-semibold">{targetName}</span> ?
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowConfirmDialog({ show: false, action: null, targetId: null, targetName: '' })}
              variant="outline"
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={executeConfirmedAction}
              className="flex-1 bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white"
            >
              Confirmer
            </Button>
          </div>
        </div>
      </div>
    );
  };

  useRegisterRefresh(useCallback(() => fetchFriendsData(true), [fetchFriendsData]));

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 px-4 h-20 flex items-center justify-between">
        <button onClick={() => navigate('/feed')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all" aria-label="Retour">
          <ArrowLeft className="w-6 h-6 dark:text-white" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight dark:text-white">Amis</h1>
          <Users className="w-5 h-5 text-[#ff6b35] opacity-60" />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all" aria-label="Options">
              <MoreVertical className="w-6 h-6 dark:text-white" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] bg-white dark:bg-gray-800 border-l dark:border-gray-700 p-0">
            <SheetHeader className="p-6 border-b dark:border-gray-700">
              <SheetTitle className="text-xl font-black dark:text-white">Options</SheetTitle>
            </SheetHeader>
            <div className="p-4 space-y-2">
              <button onClick={() => navigate('/blocked-users')} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-all" aria-label="Profils bloqués">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-500" />
                </div>
                <span className="font-bold dark:text-white">Bloqués</span>
              </button>
              <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-2xl transition-all" aria-label="Paramètres">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-gray-500" />
                </div>
                <span className="font-bold dark:text-white">Paramètres</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white dark:bg-gray-800 rounded-2xl p-2 mb-8 border border-gray-200 dark:border-gray-700 flex">
            <TabsTrigger value="friends" className="flex-1 font-black text-[10px] uppercase py-3 rounded-xl data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white">
              Amis ({friendsData?.friends?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex-1 font-black text-[10px] uppercase py-3 rounded-xl data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white">
              Reçues ({friendsData?.requests?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex-1 font-black text-[10px] uppercase py-3 rounded-xl data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white">
              Envoyées ({friendsData?.sent?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="flex-1 font-black text-[10px] uppercase py-3 rounded-xl data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white">
              Suggestions
            </TabsTrigger>
          </TabsList>

          {/* Onglet Amis */}
          <TabsContent value="friends" className="space-y-4">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un ami..."
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-4 dark:text-white font-bold focus:border-[#ff6b35] outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Rechercher un ami"
              />
            </div>
            
            <ListWrapper 
              loading={loading} 
              data={filteredFriends}
              emptyIcon={Users}
              emptyText={searchTerm ? 'Aucun ami trouvé' : 'Aucun ami'}
              skeletonCount={4}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredFriends.map(friend => (
                  <UserCard
                    key={friend.id}
                    user={friend}
                    onClick={() => goToProfile(friend.id)}
                  />
                ))}
              </div>
            </ListWrapper>
          </TabsContent>

          {/* Onglet Demandes reçues */}
          <TabsContent value="requests" className="space-y-4">
            <ListWrapper 
              loading={loading} 
              data={friendsData?.requests}
              emptyIcon={UserCheck}
              emptyText="Aucune demande reçue"
              skeletonCount={3}
            >
              <div className="grid gap-4">
                {friendsData?.requests?.map(request => (
                  <UserCard
                    key={request.id}
                    user={request}
                    onClick={() => goToProfile(request.id)}
                    onAction={() => confirmAction('accept', request.id, request.full_name)}
                    actionLabel="Accepter"
                    actionIcon={CheckCircle}
                    actionColor="orange"
                    loading={loadingAction === request.id}
                  />
                ))}
              </div>
            </ListWrapper>
          </TabsContent>

          {/* Onglet Demandes envoyées */}
          <TabsContent value="sent" className="space-y-4">
            <ListWrapper 
              loading={loading} 
              data={friendsData?.sent}
              emptyIcon={Send}
              emptyText="Aucune demande envoyée"
              skeletonCount={3}
            >
              <div className="grid gap-4">
                {friendsData?.sent?.map(request => (
                  <UserCard
                    key={request.id}
                    user={request}
                    onClick={() => goToProfile(request.id)}
                    onAction={() => confirmAction('cancel', request.id, request.full_name)}
                    actionLabel="Annuler"
                    actionIcon={XCircle}
                    actionColor="red"
                    loading={loadingAction === request.id}
                  />
                ))}
              </div>
            </ListWrapper>
          </TabsContent>
{/* Onglet Suggestions */}
          <TabsContent value="suggestions" className="space-y-4">
            <ListWrapper 
              loading={loading} 
              data={friendsData?.suggestions}
              emptyIcon={UserPlus}
              emptyText="Aucune suggestion"
              skeletonCount={3}
            >
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {friendsData?.suggestions?.map((suggestion, index) => (
                    <div key={suggestion.id} ref={index === (friendsData?.suggestions?.length || 0) - 1 ? loadMoreRef : null}>
                      <UserCard
                        user={suggestion}
                        onClick={() => goToProfile(suggestion.id)}
                        onAction={() => confirmAction('request', suggestion.id, suggestion.full_name)}
                        actionLabel="Ajouter"
                        actionIcon={UserPlus}
                        actionColor="blue"
                        loading={loadingAction === suggestion.id}
                      />
                    </div>
                  ))}
                </div>
                {isFetchingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 text-[#ff6b35] animate-spin" />
                  </div>
                )}
              </div>
            </ListWrapper>
          </TabsContent>
        </Tabs>
      </div>
      
      <ConfirmDialog />
      <BottomNav />
    </div>
  );
};

Friends.propTypes = {};

export default Friends;
SkeletonCard.propTypes = {};
EmptyState.propTypes = {
  Icon: PropTypes.node.isRequired,
  text: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};
ListWrapper.propTypes = {
  loading: PropTypes.bool.isRequired,
  data: PropTypes.array.isRequired,
  emptyIcon: PropTypes.any.isRequired,
  Icon: PropTypes.node.isRequired,
  emptyText: PropTypes.any.isRequired,
  emptyDescription: PropTypes.any.isRequired,
  children: PropTypes.node.isRequired,
  skeletonCount: PropTypes.any,
};
UserCard.propTypes = {
  user: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired,
  actionLabel: PropTypes.any.isRequired,
  actionIcon: PropTypes.any.isRequired,
  ActionIcon: PropTypes.any.isRequired,
  actionColor: PropTypes.any,
  loading: PropTypes.bool,
};
