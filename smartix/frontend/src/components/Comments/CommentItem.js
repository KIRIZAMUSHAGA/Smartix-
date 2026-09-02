import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { MessageCircle, Heart, MoreVertical, Trash2, Edit, Flag, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { getAvatarUrl } from '../../config/apiClient';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// =============================
// HOOK PERSONNALISÉ POUR CLIC EXTÉRIEUR
// =============================
const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

// =============================
// CONSTANTES
// =============================
const REACTION_MAP = {
  utile: { emoji: '👍', label: 'Utile' },
  pertinent: { emoji: '💡', label: 'Pertinent' },
  scolaire: { emoji: '🎓', label: 'Scolaire' },
  solidaire: { emoji: '🤝', label: 'Solidaire' },
  expert: { emoji: '⭐', label: 'Expert' }
};

const MAX_DEPTH_VISUAL = 3; // Limite d'indentation visuelle

// =============================
// COMPOSANT DE RÉACTION AVEC LOADING
// =============================
const ReactionButton = ({ type, emoji, count, active, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`flex items-center gap-1 transition-colors ${
      active ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'
    } disabled:opacity-50 disabled:cursor-not-allowed`}
    aria-label={REACTION_MAP[type]?.label || type}
    aria-pressed={active}
  >
    <span className="text-base">{emoji}</span>
    {count > 0 && <span className="text-xs font-medium">{count}</span>}
    {loading && <Loader2 className="w-3 h-3 animate-spin ml-0.5" />}
  </button>
);

// =============================
// MENU DE COMMENTAIRE AVEC ACCÈS CLAVIER
// =============================
const CommentMenu = ({ isAuthor, onDelete, onClose }) => {
  const menuRef = useRef(null);
  const firstButtonRef = useRef(null);

  useClickOutside(menuRef, onClose);

  // Gestion clavier (touche Échap)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus sur le premier élément
    firstButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      ref={menuRef} 
      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
      role="menu"
      aria-label="Options du commentaire"
    >
      {isAuthor && (
        <button
          ref={firstButtonRef}
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
          role="menuitem"
        >
          <Trash2 className="w-4 h-4 inline mr-2" />
          Supprimer
        </button>
      )}
      {!isAuthor && (
        <button
          ref={firstButtonRef}
          className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
          role="menuitem"
        >
          <Flag className="w-4 h-4 inline mr-2" />
          Signaler
        </button>
      )}
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CommentItem = ({ 
  comment, 
  onDelete, 
  onReply, 
  onReaction,
  currentUser,
  depth = 0,
  isExpanded = true,
  onToggleThread
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [reactingType, setReactingType] = useState(null);
  const reactingRef = useRef(false);

  const isAuthor = currentUser?.id === comment.author?.id;
  const reactions = comment.reactions || {};
  const hasReplies = comment.replies?.length > 0;

  // Limiter la profondeur visuelle
  const visualDepth = Math.min(depth, MAX_DEPTH_VISUAL);

  // =============================
  // GESTION DES RÉACTIONS (SANS RACE CONDITION)
  // =============================
  const handleReaction = useCallback(async (type) => {
    if (reactingRef.current) return;
    reactingRef.current = true;
    setReactingType(type);

    try {
      await onReaction(comment.id, type);
    } finally {
      reactingRef.current = false;
      setReactingType(null);
    }
  }, [comment.id, onReaction]);

  // =============================
  // FORMATAGE DE LA DATE (simple, pas de useMemo)
  // =============================
  const formattedDate = (() => {
    try {
      return formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr });
    } catch {
      return '';
    }
  })();

  // =============================
  // VÉRIFICATION DES RÉACTIONS (O(1) avec Set si disponible)
  // =============================
  const getReactionStatus = (type) => {
    const reactionSet = reactions[type];
    const count = reactionSet?.size || reactionSet?.length || 0;
    const active = currentUser?.id && (
      reactionSet?.has ? reactionSet.has(currentUser.id) : reactionSet?.includes(currentUser.id)
    );
    return { count, active };
  };

  return (
    <div className={`p-4 ${visualDepth > 0 ? 'ml-8 border-l-2 border-blue-500/30 pl-4' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={getAvatarUrl(comment.author?.avatar)} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
            {comment.author?.full_name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white">
              {comment.author?.full_name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formattedDate}
            </span>
            {comment.isTemp && (
              <span className="text-xs text-gray-400 animate-pulse">Envoi...</span>
            )}
          </div>

          <p className="text-gray-800 dark:text-gray-200 mb-2 break-words">
            {comment.content}
          </p>

          {/* Barre d'actions */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {Object.entries(REACTION_MAP).map(([type, { emoji }]) => {
              const { count, active } = getReactionStatus(type);
              const isLoading = reactingType === type;
              return (
                <ReactionButton
                  key={type}
                  type={type}
                  emoji={emoji}
                  count={count}
                  active={active}
                  onClick={() => handleReaction(type)}
                  loading={isLoading}
                />
              );
            })}

            <button
              onClick={() => onReply(comment)}
              className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50"
              disabled={comment.isTemp}
              aria-label="Répondre"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">Répondre</span>
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            disabled={comment.isTemp}
            aria-label="Options"
            aria-expanded={showMenu}
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>

          {showMenu && (
            <CommentMenu
              isAuthor={isAuthor}
              onDelete={() => onDelete(comment.id)}
              onClose={() => setShowMenu(false)}
            />
          )}
        </div>
      </div>

      {/* Indicateur de réponses */}
      {hasReplies && onToggleThread && (
        <button
          onClick={onToggleThread}
          className="mt-2 text-xs text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1 focus:outline-none focus:underline"
          aria-label={isExpanded ? "Masquer les réponses" : "Afficher les réponses"}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Masquer les réponses ({comment.replies.length})
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Afficher les réponses ({comment.replies.length})
            </>
          )}
        </button>
      )}
    </div>
  );
};

ReactionButton.propTypes = {
  type: PropTypes.string.isRequired,
  emoji: PropTypes.string.isRequired,
  count: PropTypes.number,
  active: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

CommentMenu.propTypes = {
  isAuthor: PropTypes.bool.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

CommentItem.propTypes = {
  comment: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    content: PropTypes.string,
    created_at: PropTypes.string,
    isTemp: PropTypes.bool,
    author: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      full_name: PropTypes.string,
      avatar: PropTypes.string
    }),
    reactions: PropTypes.object,
    replies: PropTypes.array
  }).isRequired,
  onDelete: PropTypes.func.isRequired,
  onReply: PropTypes.func.isRequired,
  onReaction: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }),
  depth: PropTypes.number,
  isExpanded: PropTypes.bool,
  onToggleThread: PropTypes.func
};

// Memo avec comparaison personnalisée pour éviter les re-rendus inutiles
const areEqual = (prevProps, nextProps) => {
  // Comparer les IDs pour savoir si le commentaire a changé
  if (prevProps.comment.id !== nextProps.comment.id) return false;
  
  // Comparer le contenu du commentaire (si modifié)
  if (prevProps.comment.content !== nextProps.comment.content) return false;
  if (prevProps.comment.isTemp !== nextProps.comment.isTemp) return false;
  
  // Comparer les réactions (version Set)
  const prevReactions = prevProps.comment.reactions || {};
  const nextReactions = nextProps.comment.reactions || {};
  if (JSON.stringify(prevReactions) !== JSON.stringify(nextReactions)) return false;
  
  // Comparer les props
  if (prevProps.isExpanded !== nextProps.isExpanded) return false;
  if (prevProps.depth !== nextProps.depth) return false;
  
  // Comparer l'utilisateur (pour les réactions actives)
  const prevUserId = prevProps.currentUser?.id;
  const nextUserId = nextProps.currentUser?.id;
  if (prevUserId !== nextUserId) return false;
  
  return true;
};

export default memo(CommentItem, areEqual);
