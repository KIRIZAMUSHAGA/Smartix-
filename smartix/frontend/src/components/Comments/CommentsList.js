import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { MessageCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import CommentItem from './CommentItem';

// =============================
// CONSTANTES
// =============================
const MAX_COMMENT_DEPTH = 5; // Limite de profondeur pour les réponses
const BATCH_SIZE = 20; // Nombre de commentaires à charger par lot (pour virtualisation future)

// =============================
// HOOK PERSONNALISÉ POUR L'AUTO-SCROLL
// =============================
const useAutoScroll = (dependencies) => {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, dependencies);
  
  return ref;
};

// =============================
// COMPOSANT LOADER INLINE
// =============================
const InlineLoader = () => (
  <div className="flex justify-center py-4" aria-label="Chargement">
    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
  </div>
);

// =============================
// BOUTON DE CHARGEMENT
// =============================
const LoadMoreButton = ({ onClick, loading, hasMore }) => {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center py-4">
      <button
        onClick={onClick}
        disabled={loading}
        className="px-4 py-2 text-sm text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
        aria-label="Charger plus de commentaires"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement...
          </span>
        ) : (
          'Voir plus de commentaires'
        )}
      </button>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CommentsList = ({ 
  comments, 
  loading, 
  loadingMore,
  hasMore, 
  onLoadMore, 
  onDelete, 
  onReply, 
  onReaction,
  currentUser,
  maxDepth = MAX_COMMENT_DEPTH,
  autoScroll = false
}) => {
  const [expandedComments, setExpandedComments] = useState(new Set());
  const listRef = useRef(null);
  const autoScrollRef = useAutoScroll([comments.length]);

  // =============================
  // ACTIONS STABILISÉES
  // =============================
  const actions = {
    onDelete: useCallback((id) => onDelete(id), [onDelete]),
    onReply: useCallback((comment) => onReply(comment), [onReply]),
    onReaction: useCallback((id, type) => onReaction(id, type), [onReaction])
  };

  // =============================
  // GESTION DES THREADS
  // =============================
  const toggleThread = useCallback((commentId) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);

  const isThreadExpanded = useCallback((commentId) => {
    return expandedComments.has(commentId);
  }, [expandedComments]);

  // =============================
  // RENDU RÉCURSIF AVEC LIMITE DE PROFONDEUR
  // =============================
  const renderComment = useCallback((comment, depth = 0) => {
    if (depth >= maxDepth) {
      return (
        <div key={comment.id} className="p-4 text-center text-sm text-gray-500">
          <button
            onClick={() => window.location.href = `/posts/${comment.post_id}#comment-${comment.id}`}
            className="text-blue-500 hover:underline focus:outline-none"
          >
            Voir la suite de la conversation
          </button>
        </div>
      );
    }

    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = isThreadExpanded(comment.id);

    return (
      <div key={comment.id} id={`comment-${comment.id}`}>
        <CommentItem
          comment={comment}
          onDelete={actions.onDelete}
          onReply={actions.onReply}
          onReaction={actions.onReaction}
          currentUser={currentUser}
          depth={depth}
          isExpanded={isExpanded}
          onToggleThread={() => toggleThread(comment.id)}
        />
        
        {/* Réponses conditionnelles (lazy rendering) */}
        {hasReplies && isExpanded && (
          <div className="ml-8 mt-3 space-y-3 border-l-2 border-blue-500/30 dark:border-blue-400/30 pl-4">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
        
        {/* Indicateur de réponses masquées */}
        {hasReplies && !isExpanded && (
          <button
            onClick={() => toggleThread(comment.id)}
            className="ml-8 mt-2 text-xs text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none focus:underline"
            aria-label={`Afficher les ${comment.replies.length} réponse${comment.replies.length > 1 ? 's' : ''}`}
          >
            <ChevronDown className="w-3 h-3" />
            Afficher les {comment.replies.length} réponse{comment.replies.length > 1 ? 's' : ''}
          </button>
        )}
      </div>
    );
  }, [actions, currentUser, isThreadExpanded, toggleThread, maxDepth]);

  // =============================
  // RENDU
  // =============================
  if (loading && comments.length === 0) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">Chargement des commentaires...</p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="py-12 text-center">
        <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          Aucun commentaire pour le moment
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Soyez le premier à commenter ! 💬
        </p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      {/* Liste des commentaires racines */}
      {comments.map(comment => renderComment(comment, 0))}
      
      {/* Loader de chargement supplémentaire (quand déjà des données) */}
      {loading && comments.length > 0 && <InlineLoader />}
      
      {/* Bouton "Voir plus" */}
      <LoadMoreButton 
        onClick={onLoadMore} 
        loading={loadingMore} 
        hasMore={hasMore} 
      />
      
      {/* Point d'ancrage pour auto-scroll */}
      {autoScroll && <div ref={autoScrollRef} />}
    </div>
  );
};

LoadMoreButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  hasMore: PropTypes.bool.isRequired
};

CommentsList.propTypes = {
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      content: PropTypes.string,
      created_at: PropTypes.string,
      author: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        full_name: PropTypes.string,
        avatar: PropTypes.string
      }),
      reactions: PropTypes.object,
      replies: PropTypes.array
    })
  ).isRequired,
  loading: PropTypes.bool,
  loadingMore: PropTypes.bool,
  hasMore: PropTypes.bool,
  onLoadMore: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onReply: PropTypes.func.isRequired,
  onReaction: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }),
  maxDepth: PropTypes.number,
  autoScroll: PropTypes.bool
};

export default CommentsList;
InlineLoader.propTypes = {};
