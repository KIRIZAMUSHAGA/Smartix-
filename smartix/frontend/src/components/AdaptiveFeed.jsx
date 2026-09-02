import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAdaptiveFeed } from '../hooks/useAdaptiveFeed';
import { getOptimizedImageUrl } from '../config/apiClient';
import { toast } from 'sonner';

// =============================
// COMPOSANT IMAGE OPTIMISÉ
// =============================
const OptimizedImage = ({ src, alt, className, type = 'post' }) => {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return (
      <div className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-sm">Image non disponible</span>
      </div>
    );
  }

  return (
    <img
      src={getOptimizedImageUrl(src, type === 'avatar' ? 'small' : 'medium')}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const AdaptiveFeed = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { posts, loading, loadingMore, hasMore, fetchFeed, resetFeed, currentLimit, currentRTT } = useAdaptiveFeed();
  const loaderRef = useRef(null);

  // Redirection si non connecté
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Chargement initial
  useEffect(() => {
    if (user) {
      fetchFeed();
    }
  }, [user, fetchFeed]);

  // Configuration de l'IntersectionObserver
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchFeed();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '200px' // Charge 200px avant la fin
      }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [hasMore, loading, loadingMore, fetchFeed]);

  // Gestionnaire de rafraîchissement manuel
  const handleRefresh = useCallback(() => {
    resetFeed();
  }, [resetFeed]);

  // Formatage de la date
  const formatDate = useCallback((dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }, []);

  if (!user) return null;

  return (
    <div className="adaptive-feed max-w-2xl mx-auto px-4">
      {/* En-tête avec stats */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 py-3 mb-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h1 className="text-xl font-bold">Fil d'actualité</h1>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Limite: {currentLimit}</span>
          <span>RTT: {Math.round(currentRTT)}ms</span>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs hover:bg-blue-600 transition-colors"
            aria-label="Rafraîchir"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Liste des posts */}
      {posts.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-500">
          Aucun post à afficher
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              {/* En-tête du post */}
              <div className="p-4 flex items-center gap-3">
                <button
                  onClick={() => navigate(`/profile/${post.user_id}`)}
                  className="focus:outline-none"
                >
                  <OptimizedImage
                    src={post.avatar_thumbnail}
                    alt={post.username}
                    type="avatar"
                    className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
                  />
                </button>
                <div className="flex-1">
                  <button
                    onClick={() => navigate(`/profile/${post.user_id}`)}
                    className="font-semibold hover:underline text-left"
                  >
                    {post.username}
                  </button>
                  <p className="text-xs text-gray-500">
                    {formatDate(post.created_at)}
                  </p>
                </div>
              </div>

              {/* Image du post */}
              {post.image_thumbnail && (
                <button
                  onClick={() => navigate(`/posts/${post.id}`)}
                  className="w-full focus:outline-none"
                >
                  <OptimizedImage
                    src={post.image_thumbnail}
                    alt="Post content"
                    type="post"
                    className="w-full h-auto max-h-96 object-cover"
                  />
                </button>
              )}

              {/* Contenu du post */}
              <div className="p-4">
                <p className="text-gray-800 dark:text-gray-200 mb-3">
                  {post.content_preview}
                  {post.content_preview?.length >= 100 && (
                    <button
                      onClick={() => navigate(`/posts/${post.id}`)}
                      className="ml-1 text-blue-500 hover:underline text-sm"
                    >
                      Lire la suite
                    </button>
                  )}
                </p>

                {/* Statistiques */}
                <div className="flex gap-4 text-sm text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
                  <span className="flex items-center gap-1">
                    <span>❤️</span> {post.like_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>💬</span> {post.comment_count || 0}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Loader et indicateur de fin */}
      <div
        ref={loaderRef}
        className="py-8 text-center text-gray-500"
        aria-label={loadingMore ? 'Chargement en cours' : hasMore ? 'Défiler pour plus' : 'Fin du feed'}
      >
        {loadingMore ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Chargement...</span>
          </div>
        ) : hasMore ? (
          <span>↓ Scrollez pour charger plus</span>
        ) : (
          <span>🏁 Fin du fil d'actualité</span>
        )}
      </div>
    </div>
  );
};

OptimizedImage.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  className: PropTypes.string,
  type: PropTypes.string,
};

AdaptiveFeed.propTypes = {};

export default AdaptiveFeed;
