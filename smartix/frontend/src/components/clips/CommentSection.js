// src/components/clips/CommentSection.js
import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Heart, MessageCircle, Send, X, Trash2, Flag, ChevronRight, AlertCircle, Pin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useDebouncedCallback } from 'use-debounce';

// Hooks personnalisés
import { useAuth } from '../../hooks/useAuth';
import { useApiClient } from '../../contexts/ApiClientContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

// Composants UI
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {

  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const MAX_COMMENT_LENGTH = 500;
const MAX_DEPTH = 10;
const MAX_VISIBLE_REPLIES = 5;
const MAX_REPLIES_PER_BATCH = 10;
const COMMENTS_PER_PAGE = 20;
const LIKE_DEBOUNCE_DELAY = 1000;

// =============================
// NORMALISATION DES COMMENTAIRES
// =============================
const normalizeComments = (flatComments) => {
  const byId = {};
  const rootIds = [];
  const repliesByParent = {};
  
  flatComments.forEach(comment => {
    byId[comment.id] = { ...comment, replies: [] };
  });
  
  flatComments.forEach(comment => {
    if (comment.parent_id) {
      if (!repliesByParent[comment.parent_id]) {
        repliesByParent[comment.parent_id] = [];
      }
      repliesByParent[comment.parent_id].push(comment.id);
      byId[comment.parent_id]?.replies.push(byId[comment.id]);
    } else {
      rootIds.push(comment.id);
    }
  });
  
  // Tri des racines (plus récent en haut)
  rootIds.sort((a, b) => new Date(byId[b].created_at) - new Date(byId[a].created_at));
  
  // Tri des réponses (plus ancien en haut)
  Object.keys(repliesByParent).forEach(parentId => {
    repliesByParent[parentId].sort((a, b) => 
      new Date(byId[a].created_at) - new Date(byId[b].created_at)
    );
  });
  
  return { byId, rootIds, repliesByParent };
};

// =============================
// HOOK PERSONNALISÉ useComments
// =============================
const useComments = (clipId) => {
  const { user } = useAuth();
  const { client } = useApiClient();
  
  const [state, setState] = useState({
    byId: {},
    rootIds: [],
    repliesByParent: {},
    totalCount: 0,
    hasMore: true,
    page: 1,
    isLoading: true,
    isLoadingMore: false,
    error: null
  });
  
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  
  const loadComments = useCallback(async (pageNum = 1, isLoadMore = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      if (!isLoadMore) {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
      } else {
        setState(prev => ({ ...prev, isLoadingMore: true, error: null }));
      }
      
      const response = await client.get(`/smartclips/${clipId}/comments`, {
        params: { page: pageNum, limit: COMMENTS_PER_PAGE },
        signal: abortControllerRef.current.signal
      });
      
      const newComments = response.data.comments || [];
      const { byId: newById, rootIds: newRootIds, repliesByParent: newRepliesByParent } = normalizeComments(newComments);
      
      if (isMountedRef.current) {
        setState(prev => ({
          byId: { ...prev.byId, ...newById },
          rootIds: isLoadMore ? [...prev.rootIds, ...newRootIds] : newRootIds,
          repliesByParent: { ...prev.repliesByParent, ...newRepliesByParent },
          totalCount: response.data.total || prev.totalCount,
          hasMore: newComments.length === COMMENTS_PER_PAGE,
          page: pageNum,
          isLoading: false,
          isLoadingMore: false,
          error: null
        }));
      }
      
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        console.error('Erreur chargement commentaires:', error);
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          isLoadingMore: false, 
          error: error.message 
        }));
        toast.error('Impossible de charger les commentaires');
      }
    }
  }, [clipId, client]);
  
  const addComment = useCallback(async (content, parentId = null) => {
    if (!user) return null;
    
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempComment = {
      id: tempId,
      content,
      author: user,
      created_at: new Date().toISOString(),
      likes: 0,
      liked: false,
      parent_id: parentId,
      isTemp: true
    };
    
    // Optimistic update
    setState(prev => {
      const { byId, rootIds, repliesByParent } = prev;
      const newById = { ...byId, [tempId]: tempComment };
      
      if (parentId) {
        const newRepliesByParent = { ...repliesByParent };
        if (!newRepliesByParent[parentId]) {
          newRepliesByParent[parentId] = [];
        }
        newRepliesByParent[parentId] = [...newRepliesByParent[parentId], tempId];
        
        // Mettre à jour le commentaire parent
        if (newById[parentId]) {
          newById[parentId] = {
            ...newById[parentId],
            replies: [...(newById[parentId].replies || []), tempComment]
          };
        }
        
        return { ...prev, byId: newById, repliesByParent: newRepliesByParent };
      } else {
        return { ...prev, byId: newById, rootIds: [tempId, ...rootIds] };
      }
    });
    
    try {
      const response = await client.post(`/smartclips/${clipId}/comments`, {
        content,
        parent_id: parentId
      });
      
      const realComment = response.data.comment;
      
      setState(prev => {
        const { byId, rootIds, repliesByParent } = prev;
        const newById = { ...byId };
        delete newById[tempId];
        newById[realComment.id] = realComment;
        
        if (parentId) {
          const newRepliesByParent = { ...repliesByParent };
          newRepliesByParent[parentId] = newRepliesByParent[parentId].map(id => 
            id === tempId ? realComment.id : id
          );
          
          if (newById[parentId]) {
            newById[parentId] = {
              ...newById[parentId],
              replies: newById[parentId].replies.map(r => 
                r.id === tempId ? realComment : r
              )
            };
          }
          
          return { ...prev, byId: newById, repliesByParent: newRepliesByParent };
        } else {
          const newRootIds = rootIds.map(id => id === tempId ? realComment.id : id);
          return { ...prev, byId: newById, rootIds: newRootIds };
        }
      });
      
      return realComment;
      
    } catch (error) {
      // Rollback
      setState(prev => {
        const { byId, rootIds, repliesByParent } = prev;
        const newById = { ...byId };
        delete newById[tempId];
        
        if (parentId && repliesByParent[parentId]) {
          const newRepliesByParent = { ...repliesByParent };
          newRepliesByParent[parentId] = newRepliesByParent[parentId].filter(id => id !== tempId);
          return { ...prev, byId: newById, repliesByParent: newRepliesByParent };
        } else {
          const newRootIds = rootIds.filter(id => id !== tempId);
          return { ...prev, byId: newById, rootIds: newRootIds };
        }
      });
      
      throw error;
    }
  }, [clipId, client, user]);
  
  const likeComment = useCallback(async (commentId) => {
    if (!user) return false;
    
    const currentComment = state.byId[commentId];
    if (!currentComment) return false;
    
    const wasLiked = currentComment.liked;
    const newLikes = wasLiked ? currentComment.likes - 1 : currentComment.likes + 1;
    
    // Optimistic update
    setState(prev => ({
      ...prev,
      byId: {
        ...prev.byId,
        [commentId]: {
          ...prev.byId[commentId],
          liked: !wasLiked,
          likes: newLikes
        }
      }
    }));
    
    try {
      await client.post(`/comments/${commentId}/like`);
      return true;
    } catch (error) {
      // Rollback
      setState(prev => ({
        ...prev,
        byId: {
          ...prev.byId,
          [commentId]: {
            ...prev.byId[commentId],
            liked: wasLiked,
            likes: currentComment.likes
          }
        }
      }));
      toast.error('Erreur lors du like');
      return false;
    }
  }, [client, state.byId, user]);
  
  const deleteComment = useCallback(async (commentId) => {
    if (!user) return false;
    
    const commentToDelete = state.byId[commentId];
    if (!commentToDelete) return false;
    
    const isRoot = !commentToDelete.parent_id;
    
    // Optimistic update
    setState(prev => {
      const { byId, rootIds, repliesByParent } = prev;
      const newById = { ...byId };
      delete newById[commentId];
      
      if (isRoot) {
        const newRootIds = rootIds.filter(id => id !== commentId);
        return { ...prev, byId: newById, rootIds: newRootIds };
      } else {
        const newRepliesByParent = { ...repliesByParent };
        if (newRepliesByParent[commentToDelete.parent_id]) {
          newRepliesByParent[commentToDelete.parent_id] = newRepliesByParent[commentToDelete.parent_id]
            .filter(id => id !== commentId);
        }
        return { ...prev, byId: newById, repliesByParent: newRepliesByParent };
      }
    });
    
    try {
      await client.delete(`/smartclips/${clipId}/comments/${commentId}`);
      toast.success('Commentaire supprimé');
      return true;
    } catch (error) {
      // Rollback
      setState(prev => ({
        ...prev,
        byId: {
          ...prev.byId,
          [commentId]: commentToDelete
        }
      }));
      toast.error('Erreur lors de la suppression');
      return false;
    }
  }, [clipId, client, state.byId, user]);
  
  const loadReplies = useCallback(async (parentId, page = 1) => {
    try {
      const response = await client.get(`/comments/${parentId}/replies`, {
        params: { page, limit: MAX_REPLIES_PER_BATCH }
      });
      
      const newReplies = response.data.replies || [];
      const { byId: newById, repliesByParent: newRepliesByParent } = normalizeComments(newReplies);
      
      setState(prev => ({
        ...prev,
        byId: { ...prev.byId, ...newById },
        repliesByParent: {
          ...prev.repliesByParent,
          [parentId]: [
            ...(prev.repliesByParent[parentId] || []),
            ...(newRepliesByParent[parentId] || [])
          ]
        }
      }));
      
      return newReplies;
    } catch (error) {
      console.error('Erreur chargement réponses:', error);
      toast.error('Erreur lors du chargement des réponses');
      return [];
    }
  }, [client]);
  
  useEffect(() => {
    isMountedRef.current = true;
    loadComments(1, false);
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadComments]);
  
  return {
    ...state,
    addComment,
    likeComment,
    deleteComment,
    loadMore: () => {
      if (state.hasMore && !state.isLoadingMore) {
        loadComments(state.page + 1, true);
      }
    },
    loadReplies
  };
};

// =============================
// COMPOSANT COMMENT ITEM (MEMOIZED AVEC STABLE CALLBACKS)
// =============================
const CommentItem = memo(({ 
  comment, 
  depth = 0, 
  onLike, 
  onReply, 
  onDelete, 
  onFlag,
  onLoadReplies,
  isExpanded,
  hasMoreReplies,
  isSubmitting,
  currentUserId,
  isAdmin,
  onPin
}) => {
  const hasReplies = comment.replies && comment.replies.length > 0;
  const isAuthor = currentUserId === comment.author?.id;
  const canModerate = isAuthor || isAdmin;
  const isPinned = comment.isPinned;
  
  // Callbacks stabilisés
  const handleLike = useCallback(() => onLike(comment.id), [comment.id, onLike]);
  const handleReply = useCallback(() => onReply(comment.id), [comment.id, onReply]);
  const handleDelete = useCallback(() => onDelete(comment.id), [comment.id, onDelete]);
  const handleFlag = useCallback(() => onFlag(comment.id), [comment.id, onFlag]);
  const handleLoadReplies = useCallback(() => onLoadReplies(comment.id), [comment.id, onLoadReplies]);
  const handlePin = useCallback(() => onPin?.(comment.id, !isPinned), [comment.id, isPinned, onPin]);
  
  if (depth >= MAX_DEPTH) {
    return (
      <div className="ml-8 mt-2 text-white/40 text-xs italic">
        ... commentaires plus profonds masqués
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? 'ml-8 mt-2' : 'mt-4 first:mt-0'}`}>
      <div className={`flex gap-3 group ${comment.isTemp ? 'opacity-50' : ''}`}>
        <Avatar className="w-10 h-10 ring-2 ring-white/10 flex-shrink-0">
          <AvatarImage src={comment.author?.avatar} loading="lazy" />
          <AvatarFallback className="bg-gradient-to-br from-[#005CFF] to-[#44B0FF] text-white">
            {comment.author?.name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-white font-medium text-sm">
              {comment.author?.name}
            </span>
            <span className="text-white/40 text-xs">
              {formatDistanceToNow(new Date(comment.created_at), { 
                addSuffix: true,
                locale: fr 
              })}
            </span>
            {comment.isEdited && (
              <span className="text-white/30 text-xs">(modifié)</span>
            )}
            {isPinned && (
              <span className="text-cyan-400 text-xs flex items-center gap-1">
                <Pin className="w-3 h-3" />
                Épinglé
              </span>
            )}
          </div>
          
          {comment.parent_author && (
            <div className="text-xs text-white/40 mb-1 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <span>Réponse à @{comment.parent_author.name}</span>
            </div>
          )}
          
          <p className="text-white/90 text-sm mb-2 break-words whitespace-pre-wrap">
            {comment.content}
          </p>
          
          <div className="flex items-center gap-4 flex-wrap">
            <button 
              onClick={handleLike}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-xs hover:scale-110 transition-transform disabled:opacity-50"
              aria-label={comment.liked ? 'Retirer le like' : 'Aimer'}
            >
              <Heart className={`w-4 h-4 ${comment.liked ? 'fill-red-500 text-red-500' : 'text-white/40'}`} />
              <span className="text-white/40">{comment.likes > 0 ? comment.likes : ''}</span>
            </button>
            
            <button 
              onClick={handleReply}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
              aria-label="Répondre"
            >
              Répondre
            </button>
            
            {hasReplies && (
              <button 
                onClick={handleLoadReplies}
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
                aria-label={isExpanded ? 'Masquer les réponses' : 'Afficher les réponses'}
              >
                {isExpanded ? 'Masquer' : 'Afficher'} les {comment.replies.length} réponse{comment.replies.length > 1 ? 's' : ''}
              </button>
            )}
            
            {canModerate && (
              <button 
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                aria-label="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            {!isAuthor && isAdmin && (
              <button 
                onClick={handlePin}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-cyan-500"
                aria-label={isPinned ? 'Désépingler' : 'Épingler'}
              >
                <Pin className={`w-4 h-4 ${isPinned ? 'text-cyan-500' : ''}`} />
              </button>
            )}
            
            {!isAuthor && !isAdmin && (
              <button 
                onClick={handleFlag}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-yellow-500"
                aria-label="Signaler"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {comment.isTemp && (
          <div className="text-xs text-white/40 animate-pulse flex items-center">
            Envoi...
          </div>
        )}
      </div>

      {hasReplies && isExpanded && (
        <div className="mt-2 space-y-2 border-l-2 border-white/10 pl-2">
          {comment.replies.slice(0, MAX_VISIBLE_REPLIES).map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onLike={onLike}
              onReply={onReply}
              onDelete={onDelete}
              onFlag={onFlag}
              onLoadReplies={onLoadReplies}
              isExpanded={false}
              hasMoreReplies={false}
              isSubmitting={isSubmitting}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onPin={onPin}
            />
          ))}
          {comment.replies.length > MAX_VISIBLE_REPLIES && (
            <button
              onClick={handleLoadReplies}
              className="text-xs text-white/40 hover:text-white/60 ml-8 mt-1"
            >
              Voir les {comment.replies.length - MAX_VISIBLE_REPLIES} autres réponses
            </button>
          )}
        </div>
      )}
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

// =============================
// COMPOSANT DE ROW POUR VIRTUALISATION
// =============================
const CommentRow = memo(({ data, index, style }) => {
  const { comments, onLike, onReply, onDelete, onFlag, onLoadReplies, expandedThreads, isSubmitting, currentUserId, isAdmin, onPin } = data;
  const comment = comments[index];
  
  if (!comment) return null;
  
  return (
    <div style={style}>
      <CommentItem
        comment={comment}
        onLike={onLike}
        onReply={onReply}
        onDelete={onDelete}
        onFlag={onFlag}
        onLoadReplies={onLoadReplies}
        isExpanded={expandedThreads.has(comment.id)}
        isSubmitting={isSubmitting}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onPin={onPin}
      />
    </div>
  );
});

CommentRow.displayName = 'CommentRow';

// =============================
// COMPOSANT DE CONFIRMATION
// =============================
const ConfirmDialog = ({ open, onOpenChange, title, description, onConfirm, isLoading }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="bg-[#1A1A1A] border border-white/10">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-white/60">
          {description}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-none">
          Annuler
        </AlertDialogCancel>
        <AlertDialogAction 
          onClick={onConfirm}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          {isLoading ? 'Suppression...' : 'Supprimer'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// =============================
// COMPOSANT DE SIGNALEMENT
// =============================
const FlagDialog = ({ open, onOpenChange, onConfirm, isLoading }) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (reason.trim()) handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1A1A1A] border border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Signaler ce commentaire</DialogTitle>
          <DialogDescription className="text-white/60">
            Pour quelle raison signalez-vous ce commentaire ? (Optionnel)
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Raison du signalement..."
          className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          rows={3}
          maxLength={200}
        />
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Envoi...' : 'Signaler'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CommentSection = ({ clipId, onClose, onCountChange, onUnsavedChanges }) => {
  const { user: authUser, isAdmin } = useAuth();
  const { client } = useApiClient();
  const { isOnline } = useOnlineStatus();
  
  const {
    byId,
    rootIds,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    addComment,
    likeComment,
    deleteComment,
    loadMore,
    loadReplies
  } = useComments(clipId);
  
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState(new Set());
  
  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState({ open: false, commentId: null });
  const [flagDialog, setFlagDialog] = useState({ open: false, commentId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFlagging, setIsFlagging] = useState(false);
  
  const inputRef = useRef(null);
  const listRef = useRef(null);
  
  // =============================
  // ✅ DÉTECTION DES CHANGEMENTS NON SAUVEGARDÉS
  // =============================
  useEffect(() => {
    const hasUnsavedChanges = newComment.length > 0 || replyingTo !== null;
    onUnsavedChanges?.(hasUnsavedChanges);
  }, [newComment, replyingTo, onUnsavedChanges]);
  
  // Debounced like pour éviter le spam
  const debouncedLike = useDebouncedCallback(
    async (commentId) => {
      await likeComment(commentId);
    },
    LIKE_DEBOUNCE_DELAY
  );
  
  // Liste des commentaires racines (filtrés pour éviter les undefined)
  const rootComments = useMemo(() => {
    return rootIds
      .map(id => byId[id])
      .filter(comment => comment !== undefined);
  }, [rootIds, byId]);
  
  // =============================
  // HANDLERS
  // =============================
  const handleAddComment = useCallback(async (e) => {
    e.preventDefault();
    
    if (!authUser) {
      toast.error('Connectez-vous pour commenter');
      return;
    }
    
    if (!isOnline) {
      toast.error('Pas de connexion internet');
      return;
    }
    
    if (!newComment.trim()) {
      toast.error('Le commentaire ne peut pas être vide');
      return;
    }
    
    if (newComment.length > MAX_COMMENT_LENGTH) {
      toast.error(`Maximum ${MAX_COMMENT_LENGTH} caractères`);
      return;
    }
    
    if (submitting) return;
    
    setSubmitting(true);
    const commentText = newComment;
    const parentId = replyingTo;
    
    setNewComment('');
    setReplyingTo(null);
    
    try {
      await addComment(commentText, parentId);
      
      // Notification au parent
      if (onCountChange) {
        onCountChange({ type: parentId ? 'reply' : 'comment', action: 'add' });
      }
      
      toast.success(parentId ? 'Réponse ajoutée' : 'Commentaire ajouté');
      
      // Scroll en haut de la liste
      setTimeout(() => {
        listRef.current?.scrollToItem(0);
      }, 100);
      
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
      setNewComment(commentText);
      setReplyingTo(parentId);
    } finally {
      setSubmitting(false);
    }
  }, [authUser, newComment, submitting, replyingTo, isOnline, addComment, onCountChange]);
  
  const handleLike = useCallback(async (commentId) => {
    debouncedLike(commentId);
  }, [debouncedLike]);
  
  const handleDelete = useCallback(async () => {
    const { commentId } = deleteDialog;
    if (!commentId) return;
    
    setIsDeleting(true);
    
    try {
      await deleteComment(commentId);
      if (onCountChange) {
        onCountChange({ type: 'comment', action: 'remove' });
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialog({ open: false, commentId: null });
    }
  }, [deleteDialog, deleteComment, onCountChange]);
  
  const handleFlag = useCallback(async (reason) => {
    const { commentId } = flagDialog;
    if (!commentId) return;
    
    setIsFlagging(true);
    
    try {
      await client.post(`/comments/${commentId}/flag`, { reason: reason || undefined });
      toast.success('Signalement envoyé, merci');
    } catch (error) {
      toast.error('Erreur lors du signalement');
    } finally {
      setIsFlagging(false);
      setFlagDialog({ open: false, commentId: null });
    }
  }, [flagDialog, client]);
  
  const handlePin = useCallback(async (commentId, isPinned) => {
    try {
      await client.post(`/comments/${commentId}/pin`, { pinned: isPinned });
      toast.success(isPinned ? 'Commentaire épinglé' : 'Commentaire désépinglé');
      // Recharger les commentaires pour mettre à jour l'ordre
      loadMore(); // Refresh
    } catch (error) {
      toast.error('Erreur lors de l\'épinglage');
    }
  }, [client, loadMore]);
  
  const handleReply = useCallback((commentId) => {
    setReplyingTo(commentId);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);
  
  const handleLoadReplies = useCallback(async (commentId, forceExpand = false) => {
    if (forceExpand) {
      setExpandedThreads(prev => new Set([...prev, commentId]));
    } else {
      setExpandedThreads(prev => {
        const newSet = new Set(prev);
        if (newSet.has(commentId)) {
          newSet.delete(commentId);
        } else {
          newSet.add(commentId);
        }
        return newSet;
      });
    }
    
    // Charger les réponses si nécessaire
    const comment = byId[commentId];
    if (comment && (!comment.replies || comment.replies.length === 0)) {
      await loadReplies(commentId);
    }
  }, [byId, loadReplies]);
  
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    loadMore();
  }, [hasMore, isLoadingMore, loadMore]);
  
  // =============================
  // RENDU
  // =============================
  const totalComments = rootComments.length;
  
  if (isLoading && totalComments === 0) {
    return (
      <div className="bg-[#1A1A1A] w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-lg">Commentaires</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-4 w-full p-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 bg-white/10 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#1A1A1A] w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold text-lg">
          Commentaires ({totalComments})
        </h3>
        <button 
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          aria-label="Fermer"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Liste des commentaires avec virtualisation */}
      <div className="flex-1 overflow-hidden">
        {error && totalComments === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500/50 mx-auto mb-3" />
              <p className="text-white/60">Erreur de chargement</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-sm text-cyan-500 hover:text-cyan-400"
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : rootComments.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Aucun commentaire</p>
              <p className="text-sm text-white/30">Soyez le premier à commenter !</p>
            </div>
          </div>
        ) : (
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                itemCount={rootComments.length}
                itemSize={120}
                width={width}
                itemData={{
                  comments: rootComments,
                  onLike: handleLike,
                  onReply: handleReply,
                  onDelete: (id) => setDeleteDialog({ open: true, commentId: id }),
                  onFlag: (id) => setFlagDialog({ open: true, commentId: id }),
                  onLoadReplies: handleLoadReplies,
                  onPin: handlePin,
                  expandedThreads,
                  isSubmitting: submitting,
                  currentUserId: authUser?.id,
                  isAdmin: isAdmin
                }}
              >
                {CommentRow}
              </List>
            )}
          </AutoSizer>
        )}
        
        {hasMore && rootComments.length > 0 && (
          <div className="flex justify-center p-4">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 text-white/60 hover:text-white/80 text-sm transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? 'Chargement...' : 'Charger plus de commentaires'}
            </button>
          </div>
        )}
      </div>

      {/* Indicateur de réponse */}
      {replyingTo && byId[replyingTo] && (
        <div className="px-4 pt-2 pb-1 bg-white/5 mx-4 rounded-lg mb-2 flex items-center justify-between">
          <span className="text-xs text-white/60">
            Répondre à @{byId[replyingTo]?.author?.name}
          </span>
          <button 
            onClick={() => setReplyingTo(null)}
            className="text-white/40 hover:text-white/60"
            aria-label="Annuler la réponse"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleAddComment} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={!isOnline ? "Hors ligne..." : (replyingTo ? "Écrire une réponse..." : "Ajouter un commentaire...")}
            disabled={!authUser || submitting || !isOnline}
            maxLength={MAX_COMMENT_LENGTH}
            className="flex-1 bg-white/10 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#005CFF] disabled:opacity-50"
            aria-label="Nouveau commentaire"
          />
          <button
            type="submit"
            disabled={!authUser || !newComment.trim() || submitting || !isOnline}
            className="w-10 h-10 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
            aria-label="Envoyer"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
        {newComment.length > 0 && (
          <div className="text-right mt-1">
            <span className={`text-xs ${newComment.length > MAX_COMMENT_LENGTH - 50 ? 'text-yellow-500' : 'text-white/30'}`}>
              {newComment.length}/{MAX_COMMENT_LENGTH}
            </span>
          </div>
        )}
      </form>

      {/* Dialogues */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, commentId: null })}
        title="Supprimer le commentaire ?"
        description="Cette action est irréversible. Le commentaire sera définitivement supprimé."
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
      
      <FlagDialog
        open={flagDialog.open}
        onOpenChange={(open) => !open && setFlagDialog({ open: false, commentId: null })}
        onConfirm={handleFlag}
        isLoading={isFlagging}
      />
    </div>
  );
};

CommentSection.propTypes = {
  clipId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onClose: PropTypes.func.isRequired,
  onCountChange: PropTypes.func.isRequired,
  onUnsavedChanges: PropTypes.func.isRequired,
};

export default CommentSection;
ConfirmDialog.propTypes = {
  open: PropTypes.func.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};
FlagDialog.propTypes = {
  open: PropTypes.func.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};
