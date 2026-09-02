// frontend/src/components/Comments/Comment.js
import React, { useState, memo, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { useApiClient } from '../../contexts/ApiClientContext';
import { 
  Heart, ThumbsDown, MessageCircle, Copy, MoreVertical, Trash2, 
  Edit, Pin, Volume2, Bookmark, Languages, Share2 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getAvatarUrl } from '../../config/apiClient';
import { toast } from 'sonner';

// =============================
// Hook personnalisé pour la fermeture au clic extérieur
// =============================
const useClickOutside = (ref, callback) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, callback]);
};

// === Sous-composants === //

const CommentHeader = memo(({ author, timestamp, isAuthor, onEdit, onDelete, showMenu, setShowMenu, menuRef, comment, onTranslate }) => {
  return (
    <div className="flex gap-3 mb-3">
      <Avatar className="w-10 h-10 ring-2 ring-[#1877F2]/20 dark:ring-[#00E6FF]/30">
        <AvatarImage 
          src={getAvatarUrl(author?.avatar)} 
          onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.png'; }}
        />
        <AvatarFallback className="bg-gradient-to-br from-[#1877F2] to-[#4267B2] dark:from-[#00E6FF] dark:to-[#6A5CFF] text-white font-bold">
          {author?.full_name?.[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[#050505] dark:text-white font-semibold text-sm">{author?.full_name}</p>
          <p className="text-[#65676B] dark:text-gray-500 text-xs">@{author?.email?.split('@')[0]}</p>
          {author?.role && (
            <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-[#00E6FF]/20 text-[#1877F2] dark:text-[#00E6FF] rounded-full font-medium">
              {author.role}
            </span>
          )}
          <p className="text-[#65676B] dark:text-gray-500 text-xs">• {timestamp}</p>
        </div>
      </div>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 hover:bg-white/10 rounded-lg transition-all h-fit"
          aria-label="Options du commentaire"
        >
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
        {showMenu && (
          <CommentMenu 
            isAuthor={isAuthor} 
            onEdit={onEdit} 
            onDelete={onDelete}
            onClose={() => setShowMenu(false)}
            commentId={comment?.id}
            originalContent={comment?.content}
            onTranslate={(translatedContent) => {
              // Callback pour mettre à jour l'affichage après traduction
              if (onTranslate) onTranslate(translatedContent);
            }}
          />
        )}
      </div>
    </div>
  );
});

const CommentMenu = memo(({ isAuthor, onEdit, onDelete, onClose, commentId, originalContent, onTranslate }) => {
  const { client } = useApiClient();
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Lien copié !');
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    const newSaved = !saved;
    setSaved(newSaved);
    try {
      if (newSaved) {
        await client.post(`/api/comments/${commentId}/save`);
        toast.success('Commentaire sauvegardé !');
      } else {
        await client.delete(`/api/comments/${commentId}/save`);
        toast.success('Commentaire retiré des favoris');
      }
    } catch (error) {
      setSaved(saved);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
      onClose();
    }
  }, [client, saved, isSaving, onClose, commentId]);

  // =============================
  // TRADUCTION RÉELLE AVEC API
  // =============================
  const handleTranslate = useCallback(async () => {
    if (isTranslating) return;
    if (!originalContent) {
      toast.error('Contenu à traduire introuvable');
      return;
    }

    setIsTranslating(true);
    toast.info('Traduction en cours...');

    try {
      // Appel API vers le backend pour la traduction
      const response = await client.post('/translate', {
        text: originalContent,
        targetLang: 'fr'
      });

      if (response?.translatedText) {
        // Afficher la traduction dans une notification ou mettre à jour le commentaire
        toast.success('Traduction disponible !');
        
        // Appeler le callback pour mettre à jour l'affichage
        if (onTranslate) {
          onTranslate(response.data.translatedText);
        }
        
        // Alternative : afficher dans une modale ou un tooltip
        toast.info(`Traduction : ${response.data.translatedText}`, {
          duration: 5000,
          style: { whiteSpace: 'pre-wrap', maxWidth: '300px' }
        });
      } else {
        throw new Error('Réponse invalide');
      }
    } catch (error) {
      console.error('Erreur de traduction:', error);
      
      // Fallback : utiliser l'API Google Translate directement (si configurée)
      try {
        const fallbackResponse = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(originalContent)}`
        );
        const data = await fallbackResponse.json();
        const translatedText = data[0]?.map(item => item[0]).join('');
        
        if (translatedText) {
          toast.success('Traduction disponible !');
          if (onTranslate) onTranslate(translatedText);
          toast.info(`Traduction : ${translatedText}`, {
            duration: 5000,
            style: { whiteSpace: 'pre-wrap', maxWidth: '300px' }
          });
        } else {
          throw new Error('Traduction échouée');
        }
      } catch (fallbackError) {
        toast.error('Erreur lors de la traduction');
      }
    } finally {
      setIsTranslating(false);
      onClose();
    }
  }, [client, originalContent, isTranslating, onTranslate, onClose]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: `Commentaire`,
        text: `Regarde ce commentaire`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
    onClose();
  }, [handleCopyLink, onClose]);

  return (
    <div className="absolute top-12 right-0 bg-white dark:bg-[#0A0E1A] border border-[#E4E6EB] dark:border-white/20 rounded-xl overflow-hidden z-20 shadow-xl min-w-[200px]">
      {isAuthor && (
        <>
          <button 
            onClick={() => { onEdit(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-[#050505] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Edit className="w-4 h-4" /> Modifier
          </button>
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
          <div className="border-t border-[#E4E6EB] dark:border-white/10"></div>
        </>
      )}
      <button 
        onClick={handleCopyLink}
        className="w-full text-left px-4 py-2.5 text-[#050505] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-white/10 transition-all flex items-center gap-2"
      >
        <Copy className="w-4 h-4" /> Copier lien
      </button>
      <button 
        onClick={handleSave}
        disabled={isSaving}
        className="w-full text-left px-4 py-2.5 text-[#050505] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Bookmark className={`w-4 h-4 ${saved ? 'fill-[#1877F2] dark:fill-[#00E6FF] text-[#1877F2] dark:text-[#00E6FF]' : ''}`} /> 
        {saved ? 'Retirer favoris' : 'Sauvegarder'}
      </button>
      <button 
        onClick={handleTranslate}
        disabled={isTranslating}
        className="w-full text-left px-4 py-2.5 text-[#050505] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Languages className={`w-4 h-4 ${isTranslating ? 'animate-spin' : ''}`} /> 
        {isTranslating ? 'Traduction...' : 'Traduire'}
      </button>
      <button 
        onClick={handleShare}
        className="w-full text-left px-4 py-2.5 text-[#050505] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-white/10 transition-all flex items-center gap-2"
      >
        <Share2 className="w-4 h-4" /> Partager
      </button>
      {!isAuthor && (
        <>
          <div className="border-t border-[#E4E6EB] dark:border-white/10"></div>
          <button className="w-full text-left px-4 py-2.5 text-[#050505] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-white/10 transition-all flex items-center gap-2">
            <Pin className="w-4 h-4" /> Épingler
          </button>
        </>
      )}
    </div>
  );
});

const CommentContent = memo(({ comment, translatedContent, showTranslation }) => {
  const renderTextWithTags = useCallback((text) => {
    const parts = text.split(/(@\w+|#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-[#1877F2] dark:text-[#00E6FF] font-semibold cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      if (part.startsWith('#')) {
        return (
          <span key={i} className="text-[#4267B2] dark:text-[#6A5CFF] font-semibold cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      return part;
    });
  }, []);

  const displayContent = showTranslation && translatedContent ? translatedContent : comment.content;

  switch (comment.type) {
    case 'audio':
    case 'voice':
      return (
        <div className="my-2 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <audio controls className="flex-1 h-8">
            <source src={comment.content} type="audio/webm" />
            <source src={comment.content} type="audio/mp3" />
          </audio>
        </div>
      );
    case 'video':
      return (
        <div className="my-2">
          <video controls className="w-full rounded-lg max-h-64">
            <source src={comment.content} type="video/mp4" />
          </video>
        </div>
      );
    case 'image':
      return <img src={comment.content} alt="Comment" className="my-2 rounded-lg max-w-full max-h-64" />;
    case 'gif':
      return <img src={comment.content} alt="GIF" className="my-2 rounded-lg max-w-full max-h-64" />;
    case 'sticker':
      return <div className="text-4xl my-2">{comment.content}</div>;
    default:
      return (
        <div>
          <p className="text-[#1C1E21] dark:text-white break-words leading-relaxed">
            {renderTextWithTags(displayContent)}
          </p>
          {showTranslation && translatedContent && translatedContent !== comment.content && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Traduction :</p>
              <p className="text-[#1C1E21] dark:text-white break-words leading-relaxed italic">
                {renderTextWithTags(translatedContent)}
              </p>
            </div>
          )}
        </div>
      );
  }
});

const ReactionButtons = memo(({ reactions, handleReaction, user }) => {
  const getReactionCount = (type) => reactions[type]?.length || 0;
  const hasUserReacted = (type) => reactions[type]?.includes(user?.id);

  const reactionMap = {
    utile: '👍',
    pertinent: '💡',
    scolaire: '🎓',
    solidaire: '🤝',
    expert: '⭐'
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#E4E6EB] dark:border-white/10">
      {Object.entries(reactionMap).map(([type, emoji]) => {
        const count = getReactionCount(type);
        const isActive = hasUserReacted(type);
        return (
          <button
            key={type}
            onClick={() => handleReaction(type)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive 
                ? 'bg-blue-50 dark:bg-[#00E6FF]/20 text-[#1877F2] dark:text-[#00E6FF] ring-1 ring-[#1877F2]/30 dark:ring-[#00E6FF]/50 scale-105' 
                : 'bg-[#F5F5F5] dark:bg-white/5 text-[#65676B] dark:text-gray-400 hover:bg-[#E4E6EB] dark:hover:bg-white/10 hover:text-[#050505] dark:hover:text-white'
            }`}
            aria-label={`Réagir avec ${type}`}
            aria-pressed={isActive}
          >
            <span className="text-base">{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
});

// === Composant principal === //

const Comment = memo(({ comment, onDelete, onEdit, onReply, onLike, depth = 0 }) => {
  const { user } = useAuth();
  const { client } = useApiClient();

  const [showMenu, setShowMenu] = useState(false);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [reactions, setReactions] = useState({
    utile: comment.reactions?.utile || [],
    pertinent: comment.reactions?.pertinent || [],
    scolaire: comment.reactions?.scolaire || [],
    solidaire: comment.reactions?.solidaire || [],
    expert: comment.reactions?.expert || []
  });
  const [isReacting, setIsReacting] = useState(false);
  const menuRef = useRef(null);

  useClickOutside(menuRef, () => setShowMenu(false));

  const { author, created_at } = comment;
  const timestamp = useMemo(() => {
    if (!created_at) return '';
    try {
      return new Date(created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [created_at]);

  const isAuthor = user?.id === author?.id;

  // Callback pour gérer la traduction
  const handleTranslateCallback = useCallback((translatedText) => {
    setTranslatedContent(translatedText);
    setShowTranslation(true);
  }, []);

  const handleReaction = useCallback(async (type) => {
    if (!user) {
      toast.error('Connectez-vous pour réagir');
      return;
    }
    if (isReacting) return;
    setIsReacting(true);

    const userId = user.id;
    const prevReactions = { ...reactions };

    setReactions(prev => {
      const newReactions = { ...prev };
      Object.keys(newReactions).forEach(key => {
        newReactions[key] = (newReactions[key] || []).filter(id => id !== userId);
      });
      const current = newReactions[type] || [];
      if (current.includes(userId)) {
        newReactions[type] = current.filter(id => id !== userId);
      } else {
        newReactions[type] = [...current, userId];
      }
      return newReactions;
    });

    try {
      await client.post(`/api/comments/${comment.id}/react`, { type });
      toast.success(type);
    } catch (error) {
      setReactions(prevReactions);
      toast.error('Erreur lors de la réaction');
    } finally {
      setIsReacting(false);
    }
  }, [user, client, comment.id, reactions, isReacting]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/posts/${comment.post_id}#comment-${comment.id}`);
    toast.success('Lien copié !');
    setShowMenu(false);
  }, [comment.post_id, comment.id]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: `Commentaire de ${comment.author?.full_name}`,
        text: comment.content,
        url: `${window.location.origin}/posts/${comment.post_id}#comment-${comment.id}`
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
    setShowMenu(false);
  }, [comment, handleCopyLink]);

  return (
    <div
      id={`comment-${comment.id}`}
      className={`relative ${depth > 0 ? 'ml-8 border-l-2 border-[#E4E6EB] dark:border-[#00E6FF]/30 pl-4' : ''}`}
    >
      <div className="hover:bg-[#F5F5F5] dark:hover:bg-white/5 rounded-lg p-3 transition-all animate-fadeIn">
        <CommentHeader 
          author={author} 
          timestamp={timestamp} 
          isAuthor={isAuthor} 
          onEdit={() => onEdit?.(comment.id)} 
          onDelete={() => onDelete?.(comment.id)} 
          showMenu={showMenu} 
          setShowMenu={setShowMenu}
          menuRef={menuRef}
          comment={comment}
          onTranslate={handleTranslateCallback}
        />

        <CommentContent 
          comment={comment} 
          translatedContent={translatedContent}
          showTranslation={showTranslation}
        />

        {showTranslation && (
          <button
            onClick={() => setShowTranslation(false)}
            className="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Afficher l'original
          </button>
        )}

        <ReactionButtons reactions={reactions} handleReaction={handleReaction} user={user} />

        <div className="flex gap-4 mt-3 text-xs text-[#65676B] dark:text-gray-400">
          <button
            onClick={() => onReply?.(comment)}
            className="flex items-center gap-1 hover:text-[#1877F2] dark:hover:text-[#00E6FF] transition-colors font-medium"
          >
            <MessageCircle className="w-4 h-4" /> Répondre
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 hover:text-[#1877F2] dark:hover:text-[#00E6FF] transition-colors font-medium ml-auto"
          >
            <Copy className="w-4 h-4" /> Copier lien
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1 hover:text-[#1877F2] dark:hover:text-[#00E6FF] transition-colors font-medium"
          >
            <Share2 className="w-4 h-4" /> Partager
          </button>
        </div>
      </div>
    </div>
  );
});

const commentShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  content: PropTypes.string,
  type: PropTypes.string,
  created_at: PropTypes.string,
  post_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  author: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    full_name: PropTypes.string,
    avatar: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string
  }),
  reactions: PropTypes.object
});

CommentHeader.propTypes = {
  author: PropTypes.shape({
    full_name: PropTypes.string,
    avatar: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string
  }),
  timestamp: PropTypes.string,
  isAuthor: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  showMenu: PropTypes.bool,
  setShowMenu: PropTypes.func,
  menuRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
};

CommentMenu.propTypes = {
  isAuthor: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  commentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  originalContent: PropTypes.string,
  onTranslate: PropTypes.func
};

CommentContent.propTypes = {
  comment: commentShape,
  translatedContent: PropTypes.string,
  showTranslation: PropTypes.bool
};

ReactionButtons.propTypes = {
  reactions: PropTypes.object.isRequired,
  handleReaction: PropTypes.func.isRequired,
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  })
};

Comment.propTypes = {
  comment: commentShape.isRequired,
  onDelete: PropTypes.func,
  onEdit: PropTypes.func,
  onReply: PropTypes.func,
  onLike: PropTypes.func,
  depth: PropTypes.number
};

export default Comment;
