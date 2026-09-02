import React, { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useComments } from '../hooks/useComments';
import { usePost } from '../hooks/usePost';

// Composants
import PostHeader from '../components/Post/PostHeader';
import PostContent from '../components/Post/PostContent';
import CommentsList from '../components/Comments/CommentsList';
import CommentBox from '../components/Comments/CommentBox';

// Icônes
import { ArrowLeft } from 'lucide-react'; // ou ton système d'icônes
import PropTypes from 'prop-types';

// =============================
// COMPOSANT CONTAINER
// =============================
const PostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hook Post (CORRIGÉ: refetch au lieu de refreshPost)
  const { 
    post, 
    loading: postLoading, 
    error: postError, 
    refetch 
  } = usePost(postId);

  // Hook Comments (CORRIGÉ: passe currentUser)
  const {
    flatComments: comments,
    loading: commentsLoading,
    loadingMore: commentsLoadingMore,
    hasMore,
    loadMore,
    addComment,
    deleteComment,
    addReaction
  } = useComments(postId, user);

  const [replyingTo, setReplyingTo] = useState(null);
  const commentsEndRef = useRef(null);

  // =============================
  // SCROLL VERS LE BAS
  // =============================
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  // =============================
  // GESTION DES RÉPONSES
  // =============================
  const handleReply = useCallback((comment) => {
    setReplyingTo(comment);
    requestAnimationFrame(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // =============================
  // AJOUT DE COMMENTAIRE (CORRIGÉ)
  // =============================
  const handleAddComment = useCallback(async (commentData, parentCommentId = null) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour commenter');
      navigate('/auth');
      return;
    }

    const result = await addComment(commentData.content, parentCommentId, {
      userId: user.id,
      userName: user.full_name,
      userAvatar: user.avatar
    });

    if (result.success) {
      setReplyingTo(null);
      scrollToBottom();
      toast.success('Commentaire ajouté');
    } else {
      toast.error(result.error?.message || 'Erreur lors de l\'ajout du commentaire');
    }
  }, [user, addComment, navigate, scrollToBottom]);

  // =============================
  // SUPPRESSION DE COMMENTAIRE (CORRIGÉ)
  // =============================
  const handleDeleteComment = useCallback(async (commentId) => {
    const result = await deleteComment(commentId);
    if (!result.success) {
      toast.error(result.error?.message || 'Erreur lors de la suppression');
    }
  }, [deleteComment]);

  // =============================
  // RÉACTION À UN COMMENTAIRE (CORRIGÉ)
  // =============================
  const handleReaction = useCallback(async (commentId, reactionType) => {
    if (!user) {
      toast.error('Connectez-vous pour réagir');
      navigate('/auth');
      return;
    }

    const result = await addReaction(commentId, reactionType);
    if (!result.success) {
      toast.error(result.error?.message || 'Erreur lors de la réaction');
    }
  }, [user, addReaction, navigate]);

  // =============================
  // RENDU - CHARGEMENT
  // =============================
  if (postLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // =============================
  // RENDU - ERREUR
  // =============================
  if (postError || !post) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {postError?.message || 'Publication introuvable'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // =============================
  // RENDU - SUCCÈS
  // =============================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Publication de {post.user?.full_name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {post.comments_count || comments?.length || 0} commentaire{(post.comments_count || 0) > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-2xl mx-auto pb-32">
        {/* Post */}
        <PostContent post={post} />

        {/* Commentaires */}
        <CommentsList
          comments={comments}
          loading={commentsLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onDelete={handleDeleteComment}
          onReply={handleReply}
          onReaction={handleReaction}
          currentUser={user}
        />
        
        {/* Indicateur de chargement supplémentaires */}
        {commentsLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        <div ref={commentsEndRef} />
      </div>

      {/* Champ de commentaire fixe */}
      <CommentBox
        onSubmit={handleAddComment}
        onCancelReply={cancelReply}
        replyingTo={replyingTo}
        placeholder={replyingTo ? `Répondre à ${replyingTo.author?.full_name}...` : "Ajouter un commentaire..."}
      />
    </div>
  );
};

PostDetail.propTypes = {};

export default PostDetail;
