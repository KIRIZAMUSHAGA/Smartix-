import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../utils/avatarUtils';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import axiosInstance from '../config/axiosConfig';
import { imagePreloader } from '../services/ImagePreloaderService';
import { useAuth } from '../hooks/useAuth';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SharedPostCard = ({ sharedPostId }) => {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPostCache, cachePost } = useGlobalCache();

  // Clé de cache plus robuste
  const cacheKey = `shared_post_${sharedPostId}_${user?.id || 'guest'}`;

  // Reset imgError quand le post change
  useEffect(() => {
    setImgError(false);
  }, [post?.id]);

  useEffect(() => {
    if (!sharedPostId) return;

    const controller = new AbortController();

    const fetchPost = async () => {
      try {
        // 1️⃣ Cache check avec TTL
        const cached = getPostCache(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setPost(cached.data);
          setLoading(false);
          return;
        }

        // 2️⃣ API via axiosInstance
        const response = await axiosInstance.get(
          `/api/posts/${sharedPostId}`,
          { signal: controller.signal }
        );

        const data = response.data;

        setPost(data);

        cachePost(cacheKey, {
          data,
          timestamp: Date.now()
        });

        // 3️⃣ Préchargement image (seulement si nécessaire)
        if (data.image && !imagePreloader.isImageCached(data.image)) {
          imagePreloader.preloadImage(data.image, 'high');
        }

      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error("SharedPost fetch error:", error);
          setPost(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPost();

    return () => controller.abort();
  }, [sharedPostId, cacheKey, getPostCache, cachePost]);

  if (loading) {
    return (
      <div className="p-4 border rounded-xl animate-pulse bg-gray-50 h-32">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-gray-200"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
        </div>
        <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-4 border rounded-xl bg-gray-50 text-gray-400 text-sm">
        Post original non disponible
      </div>
    );
  }

  const imageUrl = post.image?.startsWith('http') 
    ? post.image 
    : `${axiosInstance.defaults.baseURL}/uploads/posts/${post.image}`;

  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50 mt-2 ml-2 mr-2 mb-1 cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => navigate(`/posts/${post.id}`)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 pb-2">
        <img
          src={getAvatarUrl(post.author?.avatar)}
          className="w-6 h-6 rounded-full object-cover"
          alt={post.author?.full_name}
          onError={(e) => { e.target.src = '/default-avatar.png'; }}
        />
        <span className="font-bold text-sm text-gray-900">
          {post.author?.full_name}
        </span>
        <span className="text-[11px] text-gray-500">
          • {new Date(post.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short'
          })}
        </span>
      </div>

      {/* Contenu */}
      <div className="px-3 pb-3 text-sm text-gray-800 line-clamp-2">
        {post.content}
      </div>

      {/* Image */}
      {post.image && (
        <div className="w-full bg-gray-100 max-h-32 overflow-hidden">
          <img
            src={imgError ? '/placeholder-image.jpg' : imageUrl}
            onError={() => setImgError(true)}
            alt=""
            className="w-full h-auto object-cover opacity-80 hover:opacity-100 transition-opacity"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
};

SharedPostCard.propTypes = {
  sharedPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired
};

export default SharedPostCard;
