// src/pages/Messages.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search, Archive, Trash2, Edit, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

// Hooks et services
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { subscribeToUserStatus, subscribeToTypingStatuses } from '../services/messageSocketService';

// Composants UI
import { SkeletonMessages } from '../components/SkeletonComplete';
import BottomNav from '../components/BottomNav';
import { useRegisterRefresh } from '../contexts/PullToRefreshContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import TypingIndicator from '../components/messages/TypingIndicator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

// Utilitaires
import { formatLastSeen } from '../lib/utils';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const CONVERSATIONS_CACHE_TTL = 60000; // 60 secondes

// =============================
// HOOK PERSONNALISÉ POUR LES STATUTS DE FRAPPE MULTIPLES
// =============================
const useTypingStatuses = () => {
  const [typingUsers, setTypingUsers] = useState(new Map());

  useEffect(() => {
    // S'abonner aux événements de frappe pour tous les utilisateurs
    const cleanup = subscribeToTypingStatuses((data) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        
        if (data.isTyping) {
          newMap.set(data.user_id, {
            isTyping: true,
            timestamp: Date.now(),
            name: data.user_name
          });
        } else {
          newMap.delete(data.user_id);
        }
        
        // Nettoyer les entrées expirées (plus de 5 secondes)
        for (const [userId, entry] of newMap.entries()) {
          if (Date.now() - entry.timestamp > 5000) {
            newMap.delete(userId);
          }
        }
        
        return newMap;
      });
    }, (error) => {
      console.error('Erreur souscription typing:', error);
    });

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  const isUserTyping = useCallback((userId) => {
    return typingUsers.has(userId);
  }, [typingUsers]);

  const getTypingText = useCallback((userId, userName) => {
    const entry = typingUsers.get(userId);
    if (!entry) return null;
    
    if (entry.name || userName) {
      return `${entry.name || userName} écrit...`;
    }
    return "En train d'écrire...";
  }, [typingUsers]);

  return { isUserTyping, getTypingText };
};

// =============================
// SOUS-COMPOSANT MÉMOÏSÉ POUR UNE CARTE DE CONVERSATION
// =============================
const ConversationCard = React.memo(({ conv, onClick, isTyping, typingText }) => {
  return (
    <Card
      onClick={onClick}
      className="p-6 bg-card backdrop-blur-2xl border border-border rounded-[32px] hover:bg-accent/50 transition-all cursor-pointer flex items-center gap-6 group"
    >
      <div className="relative">
        <Avatar className="w-20 h-20 rounded-3xl border-2 border-border group-hover:border-[#ff6b35] transition-all">
          <AvatarImage src={conv.partner.avatar} />
          <AvatarFallback className="bg-[#ff6b35] text-white font-black text-2xl">
            {conv.partner.full_name?.charAt(0) || conv.partner.username?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        {conv.partner.is_online && !isTyping && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#22c55e] rounded-full border-4 border-background" />
        )}
        {isTyping && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#ff6b35] rounded-full border-4 border-background flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xl font-black text-foreground tracking-tight truncate group-hover:text-[#ff6b35] transition-all">
            {conv.partner.full_name || conv.partner.username}
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">
            {conv.last_message_at
              ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </span>
        </div>
        
        {/* Affichage du dernier message ou de l'indicateur de frappe */}
        {isTyping ? (
          <div className="flex items-center gap-2 mb-1">
            <TypingIndicator size="sm" showText={false} />
            <span className="text-sm font-medium text-[#ff6b35] animate-pulse">
              {typingText}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground font-medium text-sm truncate mb-1">
            {conv.last_message || 'Aucun message'}
          </p>
        )}
        
        <p className={`text-xs font-medium truncate ${
          isTyping ? 'text-[#ff6b35]' : (conv.partner.is_online ? 'text-[#22c55e]' : 'text-muted-foreground/70')
        }`}>
          {isTyping ? 'En train d\'écrire...' : (conv.partner.is_online ? 'En ligne' : formatLastSeen(conv.partner.last_seen))}
        </p>
      </div>

      {conv.unread_count > 0 && !isTyping && (
        <div className="w-8 h-8 rounded-full bg-[#ff6b35] flex items-center justify-center text-white font-black text-xs shadow-lg shadow-[#ff6b35]/20">
          {conv.unread_count}
        </div>
      )}
    </Card>
  );
});

ConversationCard.displayName = 'ConversationCard';

// =============================
// SOUS-COMPOSANT MÉMOÏSÉ POUR UN AMI DANS LA MODALE
// =============================
const FriendItem = React.memo(({ friend, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(friend.id)}
      className="w-full p-4 flex items-center gap-4 hover:bg-accent rounded-2xl transition-all group"
    >
      <div className="relative">
        <Avatar className="w-14 h-14 rounded-2xl border-2 border-border group-hover:border-[#ff6b35] transition-all">
          <AvatarImage src={friend.avatar} />
          <AvatarFallback className="bg-[#ff6b35] text-white font-black text-lg">
            {(friend.full_name || friend.username || '?').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {friend.is_online && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#22c55e] rounded-full border-2 border-card" />
        )}
      </div>
      <div className="flex-1 text-left">
        <h4 className="font-bold text-foreground group-hover:text-[#ff6b35] transition-all">
          {friend.full_name || friend.username}
        </h4>
        <p className={`text-xs font-medium ${friend.is_online ? 'text-[#22c55e]' : 'text-muted-foreground'}`}>
          {friend.is_online ? 'En ligne' : formatLastSeen(friend.last_seen)}
        </p>
      </div>
      <MessageCircle className="w-5 h-5 text-muted-foreground group-hover:text-[#ff6b35] transition-all" />
    </button>
  );
});

FriendItem.displayName = 'FriendItem';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Messages = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const globalCache = useGlobalCache();
  const { getConversationsCache, updateConversationsCache } = globalCache;

  console.log('[MESSAGES][RENDER]', {
    hasUser: !!user,
    hasClient: !!client,
    getConversationsCache_type: typeof getConversationsCache,
    updateConversationsCache_type: typeof updateConversationsCache,
  });

  // États
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Hook pour les statuts de frappe
  const { isUserTyping, getTypingText } = useTypingStatuses();

  // Refs pour annulation
  const abortControllerRef = useRef(null);
  const fetchFriendsAbortRef = useRef(null);

  // =============================
  // CHARGEMENT INITIAL DES CONVERSATIONS
  // =============================
  const loadConversations = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);

      if (!forceRefresh) {
        const cached = getConversationsCache();
        if (cached && Date.now() - cached.timestamp < CONVERSATIONS_CACHE_TTL) {
          setConversations(cached.data);
          setLoading(false);
          return;
        }
      }

      const response = await client.get(`/conversations?user_id=${user.id}`, {
        signal: abortControllerRef.current.signal
      });
      const conversations = response?.conversations || response?.data || [];
      setConversations(conversations);
      updateConversationsCache({
        data: conversations,
        timestamp: Date.now()
      });
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.error('Failed to fetch conversations:', error);
        toast.error('Erreur lors du chargement des conversations');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [user, client, getConversationsCache, updateConversationsCache]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user, loadConversations]);

  // =============================
  // SOUSCRIPTION AUX STATUTS EN LIGNE
  // =============================
  useEffect(() => {
    const cleanupStatus = subscribeToUserStatus(
      (data) => {
        setConversations(prev => prev.map(conv => {
          if (conv.partner.id === data.user_id) {
            return {
              ...conv,
              partner: {
                ...conv.partner,
                is_online: data.status === 'online',
                last_seen: data.last_seen
              }
            };
          }
          return conv;
        }));

        setFriends(prev => prev.map(friend => {
          if (friend.id === data.user_id) {
            return {
              ...friend,
              is_online: data.status === 'online',
              last_seen: data.last_seen
            };
          }
          return friend;
        }));
      },
      (error) => {
        console.error('Erreur de souscription aux statuts:', error);
        toast.error('Connexion aux statuts en ligne perdue');
      }
    );

    return () => {
      if (typeof cleanupStatus === 'function') cleanupStatus();
    };
  }, []);

  // =============================
  // CHARGEMENT DE LA LISTE D'AMIS
  // =============================
  const fetchFriends = useCallback(async () => {
    if (!user) return;

    if (fetchFriendsAbortRef.current) {
      fetchFriendsAbortRef.current.abort();
    }
    fetchFriendsAbortRef.current = new AbortController();

    setFriendsLoading(true);
    try {
      const response = await client.get('/friends/all-accepted', {
        signal: fetchFriendsAbortRef.current.signal
      });
      setFriends(response?.friends || response?.data || (Array.isArray(response) ? response : []));
    } catch (error) {
      if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
        console.error('Failed to fetch friends:', error);
        toast.error('Impossible de charger vos amis');
      }
    } finally {
      setFriendsLoading(false);
      fetchFriendsAbortRef.current = null;
    }
  }, [user, client]);

  const handleOpenNewConversation = useCallback(() => {
    setShowNewConversationModal(true);
    fetchFriends();
  }, [fetchFriends]);

  const handleStartConversation = useCallback(async (friendId) => {
    setCreatingConversation(true);
    try {
      const response = await client.post('/conversations', { partner_id: friendId });
      setShowNewConversationModal(false);
      await loadConversations(true);
      const convId = response?.id || response?.data?.id || response?.conversation_id;
      if (convId) navigate(`/messages/${convId}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast.error('Impossible de créer la conversation');
    } finally {
      setCreatingConversation(false);
    }
  }, [client, loadConversations, navigate]);

  // =============================
  // FILTRES MÉMOÏSÉS
  // =============================
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv =>
      (conv.partner.full_name?.toLowerCase().includes(query)) ||
      (conv.partner.username?.toLowerCase().includes(query))
    );
  }, [conversations, searchQuery]);

  const filteredFriends = useMemo(() => {
    if (!friendSearchQuery) return friends;
    const query = friendSearchQuery.toLowerCase();
    return friends.filter(friend =>
      (friend.full_name || '').toLowerCase().includes(query) ||
      (friend.username || '').toLowerCase().includes(query)
    );
  }, [friends, friendSearchQuery]);

  // =============================
  // ARCHIVER UNE CONVERSATION
  // =============================
  const handleArchiveConversation = useCallback(async (conversationId) => {
    try {
      await client.post(`/conversations/${conversationId}/archive`);
      await loadConversations(true);
      toast.success('Conversation archivée');
    } catch (error) {
      console.error('Failed to archive conversation:', error);
      toast.error('Erreur lors de l\'archivage');
    }
  }, [client, loadConversations]);

  // =============================
  // SUPPRIMER UNE CONVERSATION
  // =============================
  const handleDeleteConversation = useCallback(async (conversationId) => {
    if (!window.confirm('Supprimer cette conversation ? Cette action est irréversible.')) return;
    
    try {
      await client.delete(`/conversations/${conversationId}`);
      await loadConversations(true);
      toast.success('Conversation supprimée');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Erreur lors de la suppression');
    }
  }, [client, loadConversations]);

  // =============================
  // RENDU
  // =============================
  useRegisterRefresh(useCallback(() => loadConversations(true), [loadConversations]));

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300 pb-24">
        <div className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-black text-foreground">Messages</h1>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <SkeletonMessages isLoading={true} />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-24 font-sans">
      {/* Header */}
      <div className="bg-background border-b border-border sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#ff6b35] flex items-center justify-center shadow-2xl shadow-[#ff6b35]/20">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-foreground tracking-tight">Messages</h1>
                <p className="text-muted-foreground font-medium">{conversations.length} conversations</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleOpenNewConversation}
                className="w-12 h-12 rounded-xl bg-[#ff6b35] hover:bg-[#ff8c61] flex items-center justify-center transition-all shadow-lg shadow-[#ff6b35]/20"
                aria-label="Nouvelle conversation"
              >
                <Edit className="w-5 h-5 text-white" />
              </button>
              <button
                className="w-12 h-12 rounded-xl bg-card border border-border hover:bg-accent flex items-center justify-center transition-all"
                aria-label="Archiver"
              >
                <Archive className="w-5 h-5 text-muted-foreground" />
              </button>
              <button
                className="w-12 h-12 rounded-xl bg-card border border-border hover:bg-accent flex items-center justify-center transition-all"
                aria-label="Corbeille"
              >
                <Trash2 className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#ff6b35]" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              className="w-full bg-card border border-border rounded-3xl py-5 pl-16 pr-8 text-foreground placeholder:text-muted-foreground/30 font-bold text-lg focus:outline-none focus:border-[#ff6b35] transition-all shadow-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Rechercher une conversation"
            />
          </div>
        </div>
      </div>

      {/* Liste des conversations */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {filteredConversations.length > 0 ? (
          <div className="grid gap-6">
            {filteredConversations.map((conv) => {
              const isTyping = isUserTyping(conv.partner.id);
              const typingText = getTypingText(conv.partner.id, conv.partner.full_name);
              
              return (
                <ConversationCard
                  key={conv.id}
                  conv={conv}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  isTyping={isTyping}
                  typingText={typingText}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-32 bg-card rounded-[48px] border border-border">
            <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center mx-auto mb-8 border border-border">
              <MessageCircle className="w-12 h-12 text-muted-foreground/20" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-2">Aucune conversation</h3>
            <p className="text-muted-foreground font-medium mb-10">
              {searchQuery ? 'Aucun résultat pour cette recherche' : 'Envoyez un message pour commencer une discussion !'}
            </p>
            <Button
              onClick={handleOpenNewConversation}
              className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black px-12 h-16 rounded-2xl shadow-xl shadow-[#ff6b35]/20 flex items-center gap-3 mx-auto"
            >
              <Edit className="w-5 h-5" /> Nouvelle discussion
            </Button>
          </div>
        )}
      </div>

         {/* Modal nouvelle conversation */}
      <Dialog open={showNewConversationModal} onOpenChange={setShowNewConversationModal}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border">
            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff6b35] flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              Nouvelle discussion
            </DialogTitle>
          </DialogHeader>

          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un ami..."
                className="w-full bg-background border border-border rounded-2xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 font-medium focus:outline-none focus:border-[#ff6b35] transition-all"
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                aria-label="Rechercher un ami"
              />
            </div>

            <ScrollArea className="h-[400px]">
              {friendsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-[#ff6b35] animate-spin" />
                </div>
              ) : filteredFriends.length > 0 ? (
                <div className="space-y-1">
                  {filteredFriends.map((friend) => (
                    <FriendItem
                      key={friend.id}
                      friend={friend}
                      onSelect={handleStartConversation}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-4 border border-border">
                    <Users className="w-8 h-8 text-muted-foreground/20" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {friendSearchQuery ? 'Aucun ami trouvé' : 'Aucun ami disponible'}
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    Ajoutez des amis pour commencer une conversation
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Footer de la modale */}
          <div className="p-4 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground/50 text-center">
              {friends.length} ami{friends.length > 1 ? 's' : ''} disponible{friends.length > 1 ? 's' : ''}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Indicateur de création en cours */}
      {creatingConversation && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
          <div className="bg-card rounded-2xl p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-6 h-6 text-[#ff6b35] animate-spin" />
            <span className="text-foreground font-medium">Création de la conversation...</span>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

Messages.propTypes = {};

export default Messages;
