// frontend/src/components/Comments/Comments.js
import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../contexts/ApiClientContext';
import { useAuth } from '../../hooks/useAuth';
import { useCommentEmitter } from '../../hooks/useEventBus';
import Comment from './Comment';
import CommentInput from './CommentInput';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

// =============================
// Constantes
// =============================
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000;

// =============================
// Composant Comment mémoïsé
// =============================
const MemoizedComment = memo(Comment);

// =============================
// Hook pour mentions/hashtags
// =============================
const useSocialNotifications = () => {
  const detectAndNotifyMentions = useCallback((text) => {
    const mentions = text.match(/@\w+/g) || [];
    mentions.forEach(mention => console.log(`🔔 Mention détectée: ${mention}`));
  }, []);

  const detectAndNotifyHashtags = useCallback((text) => {
    const hashtags = text.match(/#\w+/g) || [];
    hashtags.forEach(hashtag => console.log(`🏷️ Hashtag détecté: ${hashtag}`));
  }, []);

  return { detectAndNotifyMentions, detectAndNotifyHashtags };
};

// =============================
// Fonction utilitaire pour le tri des dates
// =============================
const getSafeTime = (date) => {
  try {
    return new Date(date).getTime();
  } catch {
    return 0;
  }
};

// =============================
// Composant principal
// =============================
const Comments = ({ postId, comments: initialComments = [] }) => {
  const navigate = useNavigate();
  const { client } = useApiClient(); // Gardé pour usage futur (ajout commentaire)
  const { user } = useAuth();
  const { emitCommentAdded } = useCommentEmitter();
  const { detectAndNotifyMentions, detectAndNotifyHashtags } = useSocialNotifications();

  // État local des commentaires (avec sanitization initiale)
  const [comments, setComments] = useState(() => 
    initialComments.map(c => ({
      ...c,
      content: DOMPurify.sanitize(c.content),
      replies: c.replies?.map(r => ({ ...r, content: DOMPurify.sanitize(r.content) }))
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mise à jour si initialComments change (par exemple après rechargement)
  useEffect(() => {
    setComments(
      initialComments.map(c => ({
        ...c,
        content: DOMPurify.sanitize(c.content),
        replies: c.replies?.map(r => ({ ...r, content: DOMPurify.sanitize(r.content) }))
      }))
    );
  }, [initialComments]);

  // Tri chronologique stable avec gestion d'erreur
  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => getSafeTime(a.created_at) - getSafeTime(b.created_at));
  }, [comments]);

  // Affichage des 3 derniers commentaires
  const displayedComments = useMemo(() => sortedComments.slice(-3), [sortedComments]);
  const hiddenCount = Math.max(0, sortedComments.length - 3);

  // =============================
  // Retry exponentiel pour l'ajout
  // =============================
  const addCommentWithRetry = useCallback(async (commentData, attempt = 0) => {
    try {
      const response = await client.post(`/api/posts/${postId}/comments`, {
        type: commentData.type || 'text',
        content: commentData.content
      });
      return response;
    } catch (error) {
      if (error.response?.status === 429 && attempt < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY * 2 ** attempt;
        console.warn(`⏳ Rate limit, nouvelle tentative dans ${delay}ms`);
        await new Promise(res => setTimeout(res, delay));
        return addCommentWithRetry(commentData, attempt + 1);
      }
      throw error;
    }
  }, [client, postId]);

  // =============================
  // Ajouter un commentaire
  // =============================
  const handleAddComment = useCallback(async (commentData) => {
    const content = commentData.content?.trim();
    if (!content && commentData.type === 'text') return;

    setIsSubmitting(true);

    const tempComment = {
      id: `temp-${Date.now()}`,
      content,
      user: user ? { id: user.id, full_name: user.full_name || 'Vous', avatar: user.avatar } 
                 : { id: 'guest', full_name: 'Vous', avatar: null },
      created_at: new Date().toISOString(),
      isTemp: true
    };

    setComments(prev => [...prev, tempComment]);

    try {
      const response = await addCommentWithRetry(commentData);
      if (response.data?.comment) {
        // Sanitize le commentaire reçu
        const newComment = {
          ...response.data.comment,
          content: DOMPurify.sanitize(response.data.comment.content)
        };
        setComments(prev => {
          const filtered = prev.filter(c => c.id !== tempComment.id);
          const exists = filtered.some(c => c.id === newComment.id);
          return exists ? filtered : [...filtered, newComment];
        });
        emitCommentAdded(postId, newComment);
      }

      if (commentData.content) {
        detectAndNotifyMentions(commentData.content);
        detectAndNotifyHashtags(commentData.content);
      }

    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
      setComments(prev => prev.filter(c => c.id !== tempComment.id));

      if (error.response?.status === 429) toast.error("Trop de requêtes, veuillez patienter");
      else if (error.response?.status === 401) {
        toast.error("Session expirée, reconnectez-vous");
        navigate('/auth');
      } else if (error.response?.status === 413) toast.error("Commentaire trop long");
      else toast.error("Erreur lors de l'ajout du commentaire");
    } finally {
      setIsSubmitting(false);
    }
  }, [postId, user, addCommentWithRetry, emitCommentAdded, detectAndNotifyMentions, detectAndNotifyHashtags, navigate]);

  const handleDeleteComment = useCallback((commentId) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
  }, []);

  const handleViewAll = useCallback(() => {
    navigate(`/post/${postId}/comments`, { replace: false });
  }, [navigate, postId]);

  // =============================
  // Rendu récursif des threads (utilise les commentaires déjà sanitizés)
  // =============================
  const renderCommentThread = useCallback((comment) => (
    <div key={comment.id}>
      <MemoizedComment
        comment={comment}
        onDelete={handleDeleteComment}
        currentUser={user}
      />
      {comment.replies?.length > 0 && (
        <div className="ml-8 mt-3 space-y-3 border-l-2 border-[#1877F2]/30 dark:border-[#00E6FF]/30 pl-4">
          {comment.replies.map(reply => renderCommentThread(reply))}
        </div>
      )}
    </div>
  ), [handleDeleteComment, user]);

  return (
    <div className="bg-white dark:bg-[#0A0E1A] rounded-2xl overflow-hidden shadow-sm transition-shadow">
      {/* Liste des commentaires */}
      {comments.length > 0 && (
        <div className="px-5 py-1 space-y-2 max-h-[300px] overflow-y-auto">
          {displayedComments.map(comment => renderCommentThread(comment))}
        </div>
      )}

      {/* Formulaire de commentaire */}
      <div className="px-5 py-2 border-t border-gray-50 dark:border-white/5">
        <CommentInput
          postId={postId}
          onSubmit={handleAddComment}
          disabled={isSubmitting}
        />
      </div>

      {/* Bouton Voir tous les commentaires */}
      {comments.length > 0 && (
        <div className="px-5 pb-2">
          <button
            onClick={handleViewAll}
            className="w-full text-[#1877F2] dark:text-[#00E6FF] text-[12px] font-semibold py-1 hover:underline flex items-center justify-center gap-1"
            aria-label={hiddenCount > 0 ? `Voir les ${comments.length} commentaires` : 'Voir plus'}
            aria-expanded={hiddenCount > 0 ? false : undefined}
          >
            {hiddenCount > 0 ? `Voir les ${comments.length} commentaires` : 'Voir plus'}
          </button>
        </div>
      )}
    </div>
  );
};

Comments.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
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
  )
};

export default Comments;
