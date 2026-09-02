import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useTranslation } from 'react-i18next';

import Comments from './Comments/Comments';
import ShareMenu from './Interactions/ShareMenu';
import FormattedContent from './FormattedContent';
import PropTypes from 'prop-types';

const SmartTags = ({ tags = [] }) => {
  const tagConfig = {
    'Exercice OHADA': { icon: '📘', color: 'from-blue-400 to-blue-600' },
    'Analyse comptable': { icon: '📊', color: 'from-green-400 to-green-600' },
    'Aide IA': { icon: '🤖', color: 'from-purple-400 to-purple-600' },
    'Cours': { icon: '📚', color: 'from-orange-400 to-orange-600' },
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, idx) => {
        const config = tagConfig[tag] || { icon: '📌', color: 'from-cyan-400 to-cyan-600' };
        return (
          <span
            key={idx}
            className={`text-xs px-3 py-1 rounded-full bg-gradient-to-r ${config.color} text-white font-semibold shadow-lg`}
          >
            {config.icon} {tag}
          </span>
        );
      })}
    </div>
  );
};

const KnowledgeCard = ({
  post,
  user,
  onLike,
  onComment,
  onShare,
  onMenuClick,
  isLiked = false,
  showFullCard = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showFlowAnimation, setShowFlowAnimation] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(!post?.background_image);
  const [mainImageLoaded, setMainImageLoaded] = useState(!post?.image);

  useEffect(() => {
    if (post?.background_image) {
      // Pour les mascottes locales, on considère qu'elles sont déjà "chargées" pour l'UI
      if (post.background_image.startsWith('/mascots/')) {
        setImageLoaded(true);
      } else {
        const img = new Image();
        img.src = post.background_image;
        img.onload = () => setImageLoaded(true);
        img.onerror = () => setImageLoaded(true);
      }
    }
    if (post?.image) {
      const img = new Image();
      img.src = post.image;
      img.onload = () => setMainImageLoaded(true);
      img.onerror = () => setMainImageLoaded(true);
    }
  }, [post?.background_image, post?.image]);

  if (!post) return null;

  const handleLike = () => {
    onLike?.(post.id);
  };

  const authorId = post.user?.id || post.author?.id || post.user_id;

  const handleProfileClick = () => {
    if (authorId) {
      navigate(`/profile/${authorId}`);
    }
  };

  const hasBackground = post.background_id || post.background_css || post.background_image;

  return (
    <div className="transform transition-all duration-300">
      {/* Header - ONLY if showFullCard is true (legacy mode) */}
      {showFullCard && (
        <div className="px-2 py-3 flex items-start justify-between">
          <div className="flex gap-3 flex-1">
            <button 
              onClick={handleProfileClick}
              className="hover:opacity-80 transition-opacity"
            >
              <Avatar className="w-12 h-12">
                <AvatarImage src={post.user?.avatar || post.author?.avatar || post.user_avatar} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-violet-500 text-white">
                  {(post.user?.full_name || post.author?.full_name || post.user_name || 'U')[0]}
                </AvatarFallback>
              </Avatar>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button onClick={handleProfileClick} className="hover:underline text-left truncate">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">
                    {post.user?.full_name || post.author?.full_name || post.user_name || t('community.post.userDefault')}
                  </h3>
                </button>
                {post.badge && (
                  <span className="text-xs px-2 py-1 bg-cyan-400/20 text-cyan-600 dark:text-cyan-400 rounded-full font-semibold">
                    {post.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {post.created_at ? new Date(post.created_at).toLocaleDateString('fr-FR') : t('community.post.recently')}
              </p>
            </div>
          </div>

          <button
            onClick={() => onMenuClick?.(post.id)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
          >
            <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Card Content */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all overflow-hidden">
        {/* Smart Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="px-4 pt-2 pb-1">
            <SmartTags tags={post.tags} />
          </div>
        )}

        {/* Content */}
        {hasBackground ? (
          <div className="px-0 py-0">
            <div 
              className={`w-full bg-gradient-to-br ${post.background_css || 'from-cyan-400 to-violet-600'} shadow-sm overflow-hidden flex items-center justify-center relative`}
              style={{ 
                minHeight: '256px', 
                height: '300px',
                background: post.background_css || undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {(post.background_image || post.background_id) && (
                <div className="absolute inset-0 w-full h-full">
                  <img 
                    src={post.background_image || (post.background_id ? `/backgrounds/${post.background_id}.png` : '')} 
                    alt=""
                    className="w-full h-full object-cover opacity-100"
                    style={{ willChange: 'opacity' }}
                    loading="eager"
                  />
                </div>
              )}
              <div className="relative z-10 px-8 py-12 flex items-center justify-center" style={{ minHeight: '256px' }}>
                <div className="text-white text-center text-xl font-semibold leading-relaxed drop-shadow-lg break-words w-full">
                  <FormattedContent content={post.content} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-gray-800 dark:text-gray-200 text-base leading-relaxed whitespace-pre-wrap break-words">
              <FormattedContent content={post.content} />
            </div>
          </div>
        )}

        {post.image && (
          <div className="px-0 pb-0 -mx-0" style={{ minHeight: mainImageLoaded ? 'auto' : '200px' }}>
            {!mainImageLoaded && (
              <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 animate-pulse" />
            )}
            <img
              src={post.image}
              alt="Post"
              className={`w-full object-cover max-h-96 ${mainImageLoaded ? 'block' : 'hidden'}`}
              onLoad={() => setMainImageLoaded(true)}
            />
          </div>
        )}
      </div>

      {/* Interactions Buttons - ONLY if showFullCard is true */}
      {showFullCard && (
        <div className="px-2 py-1 flex items-center justify-between gap-2 mt-2">
          <button
            onClick={handleLike}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-semibold text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 ${
              isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 0 : 2} />
            <span>{post.reactions_count || 0}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-gray-600 dark:text-gray-400 font-semibold text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.comments_count || 0}</span>
          </button>

          <button
            onClick={() => setShowShareMenu(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-gray-600 dark:text-gray-400 font-semibold text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 relative ${
              showFlowAnimation ? 'animate-pulse' : ''
            }`}
          >
            <Share2 className="w-5 h-5" />
            <span>{post.shares_count || 0}</span>
          </button>
        </div>
      )}
    </div>
  );
};
};

SmartTags.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.string)
};

KnowledgeCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    content: PropTypes.string,
    tags: PropTypes.array,
    likes_count: PropTypes.number,
    comments_count: PropTypes.number,
    shares_count: PropTypes.number
  }).isRequired,
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    full_name: PropTypes.string,
    avatar: PropTypes.string
  }),
  onLike: PropTypes.func,
  onComment: PropTypes.func,
  onShare: PropTypes.func,
  onMenuClick: PropTypes.func,
  isLiked: PropTypes.bool,
  showFullCard: PropTypes.bool
};

export default KnowledgeCard;
