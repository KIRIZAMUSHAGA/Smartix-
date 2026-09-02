import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, User, ExternalLink, 
  MessageCircle, Heart, Share2, Loader2, 
  Check, X, Send 
} from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';

// Composants UI
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import BottomNav from '../components/BottomNav';
import {

  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const ALLOWED_HTML_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'blockquote', 'img', 'figure', 'figcaption',
  'div', 'span', 'b', 'i', 'small', 'mark', 'code', 'pre'
];

const ALLOWED_ATTRIBUTES = ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'];

// Configuration DOMPurify pour les liens externes
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// =============================
// SKELETON LOADER
// =============================
const ArticleSkeleton = () => (
  <div className="min-h-screen bg-[#0f172a] pb-24">
    <div className="bg-[#0f172a] border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
        <div className="w-10 h-10 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-6 bg-white/5 rounded w-48 animate-pulse" />
      </div>
    </div>
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white/5 border border-white/10 rounded-[48px] overflow-hidden">
        <div className="h-64 sm:h-[400px] bg-white/5 animate-pulse" />
        <div className="p-8 sm:p-12 space-y-6">
          <div className="flex gap-6">
            <div className="w-24 h-10 bg-white/5 rounded-xl animate-pulse" />
            <div className="w-32 h-10 bg-white/5 rounded-xl animate-pulse" />
          </div>
          <div className="h-12 bg-white/5 rounded w-3/4 animate-pulse" />
          <div className="space-y-3">
            <div className="h-4 bg-white/5 rounded w-full animate-pulse" />
            <div className="h-4 bg-white/5 rounded w-11/12 animate-pulse" />
            <div className="h-4 bg-white/5 rounded w-4/5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =============================
// COMPOSANT COMMENTAIRES
// =============================
const CommentsSheet = ({ open, onOpenChange, articleId, comments, onAddComment }) => {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState(comments || []);
  const containerRef = useRef(null);

  // Synchronisation des commentaires avec le parent
  useEffect(() => {
    setLocalComments(comments || []);
  }, [comments]);

  // Auto-scroll en bas quand nouveau commentaire ajouté
  useEffect(() => {
    if (localComments.length > 0 && localComments[0]?.isTemp) {
      containerRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [localComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) {
      toast.error('Le commentaire ne peut pas être vide');
      return;
    }

    setSubmitting(true);
    try {
      const newComment = await onAddComment(commentText.trim());
      setLocalComments(prev => [newComment, ...prev]);
      setCommentText('');
      toast.success('Commentaire ajouté');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl bg-[#0f172a] border-t border-white/10">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-white text-xl font-black">
            Commentaires ({localComments.length})
          </SheetTitle>
        </SheetHeader>
        
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto max-h-[calc(80vh-140px)] space-y-4 mb-4"
        >
          {localComments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Aucun commentaire</p>
              <p className="text-sm text-white/30">Soyez le premier à commenter !</p>
            </div>
          ) : (
            localComments.map((comment) => (
              <div 
                key={comment.id} 
                className={`bg-white/5 rounded-xl p-4 ${comment.isTemp ? 'opacity-60 animate-pulse' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-[#ff6b35] text-sm">
                    {comment.user_name || comment.user?.full_name || 'Utilisateur'}
                  </span>
                  <span className="text-white/40 text-xs">
                    {new Date(comment.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p className="text-white/80 break-words">{comment.content || comment.message}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Ajouter un commentaire..."
            disabled={submitting}
            maxLength={500}
            className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6b35] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || submitting}
            className="w-10 h-10 bg-[#ff6b35] rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
};

// =============================
// HOOK PERSONNALISÉ POUR LES ARTICLES
// =============================
const useArticleDetail = (id) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getNewsDetailCache, cacheNewsDetail } = useGlobalCache();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [isLiking, setIsLiking] = useState(false);
  const [error, setError] = useState(null);

  const fetchArticle = useCallback(async () => {
    const cachedArticle = getNewsDetailCache(id);
    if (cachedArticle) {
      setArticle(cachedArticle);
      setLikesCount(cachedArticle.likes_count || 0);
      setIsLiked(cachedArticle.liked_by_current_user || false);
      setComments(cachedArticle.comments || []);
      setLoading(false);
      return;
    }

    try {
      const response = await client.get(`/news/${id}`);
      const data = response.data;
      setArticle(data);
      setLikesCount(data.likes_count || 0);
      setIsLiked(data.liked_by_current_user || false);
      setComments(data.comments || []);
      cacheNewsDetail(id, data);
    } catch (err) {
      console.error('Error fetching article:', err);
      setError(err);
      
      if (err.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (err.response?.status === 404) {
        toast.error('Article introuvable');
        navigate('/news');
      } else {
        toast.error('Impossible de charger l\'article');
      }
    } finally {
      setLoading(false);
    }
  }, [id, client, getNewsDetailCache, cacheNewsDetail, navigate]);

  const like = useCallback(async () => {
    if (!user) {
      toast.error('Connectez-vous pour aimer');
      navigate('/auth');
      return false;
    }

    if (isLiking) return false;

    setIsLiking(true);
    const previousLiked = isLiked;
    const previousCount = likesCount;

    // Optimistic update
    setIsLiked(!isLiked);
    const newCount = !previousLiked ? previousCount + 1 : previousCount - 1;
    setLikesCount(newCount);

    try {
      await client.post(`/news/${id}/like`);
      
      // Mettre à jour le cache
      if (article) {
        cacheNewsDetail(id, {
          ...article,
          likes_count: newCount,
          liked_by_current_user: !previousLiked
        });
      }
      return true;
    } catch (err) {
      // Rollback
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      
      if (err.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (err.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur lors du like');
      }
      return false;
    } finally {
      setIsLiking(false);
    }
  }, [id, user, isLiked, likesCount, isLiking, client, article, cacheNewsDetail, navigate]);

  const addComment = useCallback(async (content) => {
    if (!user) {
      toast.error('Connectez-vous pour commenter');
      navigate('/auth');
      throw new Error('Not authenticated');
    }

    const tempComment = {
      id: `temp-${Date.now()}`,
      content,
      user_name: user.full_name,
      user_avatar: user.avatar,
      created_at: new Date().toISOString(),
      isTemp: true
    };

    setComments(prev => [tempComment, ...prev]);

    try {
      const response = await client.post(`/news/${id}/comments`, { content });
      const newComment = response.data.comment;
      
      setComments(prev => prev.map(c => c.id === tempComment.id ? newComment : c));
      
      // Mettre à jour le compteur dans l'article
      setArticle(prev => prev ? {
        ...prev,
        comments_count: (prev.comments_count || 0) + 1
      } : prev);
      
      // Mettre à jour le cache
      if (article) {
        cacheNewsDetail(id, {
          ...article,
          comments_count: (article.comments_count || 0) + 1
        });
      }
      
      return newComment;
    } catch (err) {
      // Rollback
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
      
      if (err.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (err.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur lors de l\'ajout');
      }
      throw err;
    }
  }, [id, user, client, article, cacheNewsDetail, navigate]);

  return {
    article,
    loading,
    error,
    isLiked,
    likesCount,
    comments,
    isLiking,
    fetchArticle,
    like,
    addComment
  };
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const NewsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [doubleTapTimeout, setDoubleTapTimeout] = useState(null);
  
  const {
    article,
    loading,
    error,
    isLiked,
    likesCount,
    comments,
    isLiking,
    like,
    addComment
  } = useArticleDetail(id);

  // =============================
  // DOUBLE TAP POUR LIKE (mobile)
  // =============================
  const handleDoubleTap = useCallback((e) => {
    if (doubleTapTimeout) clearTimeout(doubleTapTimeout);
    
    const newTimeout = setTimeout(() => {
      setDoubleTapTimeout(null);
    }, 300);
    
    setDoubleTapTimeout(newTimeout);
    
    // Si c'est un double tap
    if (doubleTapTimeout) {
      like();
    }
  }, [doubleTapTimeout, like]);

  // =============================
  // PARTAGE
  // =============================
  const handleShare = useCallback(async () => {
    if (!article) return;
    
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.summary || article.title,
          url
        });
      } catch {
        // L'utilisateur a annulé
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié !');
      } catch {
        toast.error('Impossible de copier le lien');
      }
    }
  }, [article]);

  // =============================
  // NETTOYAGE DU HTML
  // =============================
  const sanitizedContent = useMemo(() => {
    if (!article) return '';
    const rawContent = article.content_html || article.content || article.summary || '';
    return DOMPurify.sanitize(rawContent, {
      ALLOWED_TAGS: ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTRIBUTES
    });
  }, [article]);

  // =============================
  // RENDU
  // =============================
  if (loading) return <ArticleSkeleton />;

  if (error && !article) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white pb-24 font-sans">
        <div className="p-8 text-center">
          <p className="text-white/50 font-black">Article introuvable</p>
          <Button onClick={() => navigate('/news')} className="mt-8 bg-[#ff6b35] font-black">
            Retour
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!article) return null;

  return (
    <div 
      className="min-h-screen bg-[#0f172a] text-white pb-24 font-sans"
      onDoubleClick={handleDoubleTap}
    >
      {/* Header */}
      <div className="bg-[#0f172a] border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => navigate('/news')} 
            className="hover:bg-white/5 p-2 rounded-xl transition-all"
            aria-label="Retour"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black tracking-tight truncate flex-1">{article.title}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="bg-white/5 border border-white/10 rounded-[48px] overflow-hidden shadow-2xl backdrop-blur-2xl">
          {/* Image avec lazy loading */}
          {article.image_url && (
            <div className="relative h-64 sm:h-[400px]">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent opacity-80" />
            </div>
          )}

          <div className="p-8 sm:p-12">
            {/* Métadonnées */}
            <div className="flex flex-wrap items-center gap-6 mb-10">
              {article.source && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ff6b35]/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#ff6b35]" />
                  </div>
                  <span className="font-black text-[#ff6b35] uppercase tracking-widest text-xs">
                    {article.source}
                  </span>
                </div>
              )}
              {article.published_at && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white/30" />
                  </div>
                  <span className="text-white/50 text-xs font-black uppercase tracking-widest">
                    {new Date(article.published_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Titre */}
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-8 leading-tight">
              {article.title}
            </h2>

            {/* Contenu avec sanitization */}
            <div 
              className="text-white/80 text-lg leading-relaxed font-medium space-y-6 prose prose-invert prose-orange max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />

            {/* Lien source */}
            {article.url && (
              <Button
                onClick={() => window.open(article.url, '_blank', 'noopener noreferrer')}
                className="w-full mt-8 bg-white/5 border border-white/10 hover:bg-[#ff6b35] text-white font-black py-8 rounded-2xl transition-all group"
              >
                <ExternalLink className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                Voir l'article complet
              </Button>
            )}
          </div>
        </Card>

        {/* Barre d'interactions */}
        <div className="mt-8 flex items-center gap-4 px-4">
          <Button 
            onClick={like}
            disabled={isLiking}
            className={`flex-1 h-14 rounded-2xl gap-3 font-black transition-all ${
              isLiked 
                ? 'bg-red-500/20 text-red-500 border border-red-500/20 scale-110' 
                : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
            } disabled:opacity-50`}
          >
            {isLiking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500' : ''}`} />
            )}
            {likesCount}
          </Button>
          
          <Button 
            onClick={() => setCommentsOpen(true)}
            className="flex-1 h-14 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl gap-3 font-black"
          >
            <MessageCircle className="w-5 h-5" />
            {article.comments_count || 0}
          </Button>
          
          <Button 
            onClick={handleShare}
            className="w-14 h-14 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl font-black"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Modal des commentaires */}
      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        articleId={id}
        comments={comments}
        onAddComment={addComment}
      />

      <BottomNav />
    </div>
  );
};

NewsDetail.propTypes = {};

export default NewsDetail;
ArticleSkeleton.propTypes = {};
CommentsSheet.propTypes = {
  open: PropTypes.func.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  articleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  comments: PropTypes.array.isRequired,
  onAddComment: PropTypes.func.isRequired,
};
