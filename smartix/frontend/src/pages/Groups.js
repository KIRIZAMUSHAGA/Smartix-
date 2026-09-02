import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Lock, Globe, TrendingUp, ArrowLeft, 
  Filter, Clock, Activity, Loader2, Search, Check, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { useDebounce } from '../hooks/useDebounce';

// Composants UI
import { SkeletonGroups, useSkeletonLoader } from '../components/SkeletonComplete';
import BottomNav from '../components/BottomNav';
import { useRegisterRefresh } from '../contexts/PullToRefreshContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const CATEGORIES = [
  { value: 'all', label: 'Toutes' },
  { value: 'sciences', label: 'Sciences' },
  { value: 'maths', label: 'Maths' },
  { value: 'informatique', label: 'Informatique' },
  { value: 'littérature', label: 'Littérature' },
  { value: 'comptabilité', label: 'Comptabilité' },
  { value: 'general', label: 'Général' }
];

const SORT_OPTIONS = [
  { value: 'members', label: 'Plus de membres', icon: Users },
  { value: 'recent', label: 'Plus récents', icon: Clock },
  { value: 'active', label: 'Plus actifs', icon: Activity }
];

// =============================
// GROUP CARD COMPONENT (sans state hover)
// =============================
const GroupCard = ({ group, onClick, showJoinButton = false, onJoin, isJoining = false, isMember = false }) => {
  const getInitials = (name) => name?.[0]?.toUpperCase() || 'G';

  return (
    <Card 
      className="group p-8 bg-card backdrop-blur-2xl border border-border rounded-[40px] transition-all cursor-pointer hover:scale-[1.02] hover:shadow-xl"
      onClick={onClick}
    >
      <div className="flex items-start gap-6 mb-6">
        <Avatar className="w-16 h-16 rounded-2xl border-2 border-border group-hover:border-[#ff6b35] transition-all">
          <AvatarImage src={group.avatar} />
          <AvatarFallback className="bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] text-white font-black text-2xl">
            {getInitials(group.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-black text-foreground truncate group-hover:text-[#ff6b35] transition-all">
              {group.name}
            </h3>
            {group.is_private && <Lock className="w-4 h-4 text-muted-foreground/50" />}
            {isMember && (
              <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-600 text-[10px] font-black rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Membre
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm line-clamp-2 font-medium">{group.description}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between border-t border-border/50 pt-6 mt-6">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
            {group.members?.length || 0} membres
          </span>
          {group.category && (
            <span className="px-2 py-1 bg-[#ff6b35]/10 rounded-full text-[10px] font-black text-[#ff6b35] uppercase tracking-wider">
              {group.category}
            </span>
          )}
        </div>
        {showJoinButton ? (
          <Button 
            onClick={(e) => { e.stopPropagation(); onJoin?.(); }}
            disabled={isJoining || isMember}
            className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black text-xs rounded-xl h-9 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isMember ? (
              <Check className="w-4 h-4 mr-1" />
            ) : (
              'Rejoindre'
            )}
          </Button>
        ) : (
          <div className="text-[#ff6b35] font-black uppercase tracking-widest text-[10px] flex items-center gap-1 group-hover:gap-2 transition-all">
            Voir
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        )}
      </div>
    </Card>
  );
};

// =============================
// SKELETON CARD
// =============================
const SkeletonGroupCard = () => (
  <Card className="p-8 bg-card backdrop-blur-2xl border border-border rounded-[40px] animate-pulse">
    <div className="flex items-start gap-6 mb-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 space-y-2">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    </div>
    <div className="border-t border-border/50 pt-6 mt-6">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    </div>
  </Card>
);

// =============================
// HOOK PERSONNALISÉ POUR LES GROUPES
// =============================
const useGroups = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const { groupsCache, updateGroupsCache } = useGlobalCache();

  const [myGroups, setMyGroups] = useState([]);
  const [discoverGroups, setDiscoverGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGroups = useCallback(async (force = false) => {
    if (!user) return;

    try {
      // Vérifier le cache
      if (!force && groupsCache?.myGroups && Date.now() - groupsCache.timestamp < CACHE_TTL) {
        setMyGroups(groupsCache.myGroups);
        setDiscoverGroups(groupsCache.discoverGroups);
        setLoading(false);
        return;
      }

      const [myGroupsRes, discoverRes] = await Promise.all([
        client.get('/groups'),
        client.get('/groups/discover')
      ]);

      const myData = myGroupsRes.data || [];
      const discoverData = discoverRes.data || [];

      setMyGroups(myData);
      setDiscoverGroups(discoverData);
      
      updateGroupsCache({
        myGroups: myData,
        discoverGroups: discoverData,
        timestamp: Date.now()
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, client, groupsCache, updateGroupsCache]);

  const createGroup = useCallback(async (groupData) => {
    if (!user) return null;

    const optimisticGroup = {
      id: `temp-${Date.now()}`,
      ...groupData,
      members: [user],
      created_at: new Date().toISOString(),
      isTemp: true
    };
    
    setMyGroups(prev => [optimisticGroup, ...prev]);

    try {
      const response = await client.post('/groups', groupData);
      const newGroup = response.data;
      
      setMyGroups(prev => [
        newGroup,
        ...prev.filter(g => g.id !== optimisticGroup.id)
      ]);
      
      return newGroup;
    } catch (err) {
      setMyGroups(prev => prev.filter(g => g.id !== optimisticGroup.id));
      throw err;
    }
  }, [user, client]);

  const joinGroup = useCallback(async (groupId) => {
    if (!user) return false;

    // Optimistic update
    setDiscoverGroups(prev => 
      prev.map(g => g.id === groupId ? { ...g, isJoining: true } : g)
    );

    try {
      await client.post(`/groups/${groupId}/join`);
      await fetchGroups(true);
      return true;
    } catch (err) {
      // Rollback
      setDiscoverGroups(prev => 
        prev.map(g => g.id === groupId ? { ...g, isJoining: false } : g)
      );
      throw err;
    }
  }, [user, client, fetchGroups]);

  return {
    myGroups,
    discoverGroups,
    loading,
    error,
    fetchGroups,
    createGroup,
    joinGroup
  };
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Groups = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-groups');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('members');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(null);
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    category: 'general',
    is_private: false
  });

  const { myGroups, discoverGroups, loading, fetchGroups, createGroup, joinGroup } = useGroups();
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
    fetchGroups();
  }, [fetchGroups]);

  // =============================
  // FILTRAGE ET TRI (mémorisé)
  // =============================
  const filteredDiscoverGroups = useMemo(() => {
    let filtered = [...discoverGroups];
    
    // Filtre par catégorie
    if (filterCategory !== 'all') {
      filtered = filtered.filter(group => group.category === filterCategory);
    }
    
    // Filtre par recherche
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(group => 
        group.name?.toLowerCase().includes(term) ||
        group.description?.toLowerCase().includes(term)
      );
    }
    
    // Tri (clonage avant tri)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'members') return (b.members?.length || 0) - (a.members?.length || 0);
      if (sortBy === 'recent') return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      if (sortBy === 'active') return (b.active_members || 0) - (a.active_members || 0);
      return 0;
    });
  }, [discoverGroups, filterCategory, sortBy, debouncedSearch]);

  // =============================
  // CRÉATION DE GROUPE
  // =============================
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error('Veuillez entrer un nom de groupe');
      return;
    }
    if (!newGroup.description.trim()) {
      toast.error('Veuillez entrer une description');
      return;
    }
    
    setIsCreating(true);
    setShowCreateDialog(false);
    
    try {
      await createGroup(newGroup);
      toast.success('Groupe créé avec succès !');
      setNewGroup({ name: '', description: '', category: 'general', is_private: false });
    } catch (error) {
      console.error('Failed to create group:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error(error.response?.data?.message || 'Erreur lors de la création');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // =============================
  // REJOINDRE UN GROUPE
  // =============================
  const handleJoinGroup = async (groupId, groupName) => {
    if (joiningGroup === groupId) return;
    
    setJoiningGroup(groupId);
    
    try {
      await joinGroup(groupId);
      toast.success(`Vous avez rejoint le groupe "${groupName}" !`);
    } catch (error) {
      console.error('Failed to join group:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 409) {
        toast.error('Vous êtes déjà membre de ce groupe');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription');
      }
    } finally {
      setJoiningGroup(null);
    }
  };

  // =============================
  // RENDU
  // =============================
  useRegisterRefresh(useCallback(() => fetchGroups(true), [fetchGroups]));

  if (loading) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300 pb-24">
        <div className="bg-background border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl px-4 py-8">
          <h1 className="text-2xl font-black text-foreground">Groupes</h1>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid sm:grid-cols-2 gap-8">
            {[...Array(4)].map((_, i) => (
              <SkeletonGroupCard key={i} />
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-24 font-sans">
      {/* Header */}
      <header className="bg-background border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] flex items-center justify-center shadow-2xl shadow-[#ff6b35]/20">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-foreground">Groupes</h1>
              <p className="text-muted-foreground font-medium">Rejoignez des communautés d'étude</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff6b35]/90 hover:to-[#ff8c61]/90 text-white font-black rounded-xl h-14 px-8 shadow-xl shadow-[#ff6b35]/20"
            aria-label="Créer un groupe"
          >
            <Plus className="w-5 h-5 mr-2" /> Créer
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-card backdrop-blur-xl rounded-2xl p-2 mb-12 border border-border">
            <TabsTrigger value="my-groups" className="flex-1 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white rounded-xl py-4 transition-all">
              Mes groupes ({myGroups.length})
            </TabsTrigger>
            <TabsTrigger value="discover" className="flex-1 font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white rounded-xl py-4 transition-all">
              Découvrir
            </TabsTrigger>
          </TabsList>

          {/* Mes groupes */}
          <TabsContent value="my-groups">
            {myGroups.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-[48px] border border-border">
                <Sparkles className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="text-xl font-black text-foreground mb-2">Aucun groupe</h3>
                <p className="text-muted-foreground mb-6">Vous n'avez pas encore rejoint de groupe</p>
                <Button 
                  onClick={() => setActiveTab('discover')}
                  className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white"
                >
                  Explorer les groupes
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-8">
                {myGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onClick={() => navigate(`/groups/${group.id}`)}
                    isMember={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Découvrir */}
          <TabsContent value="discover" className="space-y-8">
            {/* Filtres et recherche */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher un groupe..."
                  className="w-full bg-card border border-border rounded-2xl py-3 pl-10 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:border-[#ff6b35] outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Rechercher un groupe"
                />
              </div>
              
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="bg-card border border-border rounded-2xl" aria-label="Filtrer par catégorie">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-card border border-border rounded-2xl" aria-label="Trier par">
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             {/* Liste des groupes */}
            {filteredDiscoverGroups.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-[48px] border border-border">
                <Users className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="text-xl font-black text-foreground mb-2">Aucun groupe trouvé</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Aucun résultat ne correspond à votre recherche' : 'Aucun groupe disponible pour le moment'}
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-8">
                {filteredDiscoverGroups.map((group) => {
                  const isMember = myGroups.some(g => g.id === group.id);
                  return (
                    <GroupCard
                      key={group.id}
                      group={group}
                      onClick={() => navigate(`/groups/${group.id}`)}
                      showJoinButton={!isMember}
                      onJoin={() => handleJoinGroup(group.id, group.name)}
                      isJoining={joiningGroup === group.id}
                      isMember={isMember}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de création de groupe */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card border border-border rounded-[40px] p-12 text-foreground max-w-2xl">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-3xl font-black tracking-tight text-foreground">Créer un groupe</DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3 block">
                Nom du groupe *
              </label>
              <Input 
                value={newGroup.name} 
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} 
                className="bg-background border-border rounded-2xl h-14 font-bold focus:border-[#ff6b35]"
                placeholder="Ex: Groupe d'étude Mathématiques"
                maxLength={50}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3 block">
                Description *
              </label>
              <Textarea 
                value={newGroup.description} 
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} 
                className="bg-background border-border rounded-2xl font-medium focus:border-[#ff6b35]"
                placeholder="Décrivez l'objectif du groupe..."
                rows={4}
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3 block">
                Catégorie
              </label>
              <Select value={newGroup.category} onValueChange={(val) => setNewGroup({ ...newGroup, category: val })}>
                <SelectTrigger className="bg-background border-border rounded-2xl h-14">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleCreateGroup} 
              disabled={isCreating} 
              className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff6b35]/90 hover:to-[#ff8c61]/90 text-white font-black h-16 rounded-2xl"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer le groupe'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <BottomNav />
    </div>
  );
};

Groups.propTypes = {};

export default Groups;
GroupCard.propTypes = {
  group: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  showJoinButton: PropTypes.bool,
  onJoin: PropTypes.func.isRequired,
  isJoining: PropTypes.bool,
  isMember: PropTypes.bool,
};
SkeletonGroupCard.propTypes = {};
