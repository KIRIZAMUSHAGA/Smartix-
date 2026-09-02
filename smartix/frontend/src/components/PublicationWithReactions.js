import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Send, Bookmark, MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarUrl, handleAvatarError } from '../utils/avatarUtils';
import { useTranslation } from 'react-i18next';
import DoubleTapHeart from './DoubleTapHeart';
import SuperLikeHeart from './SuperLikeHeart';
import PublicationReactionOverlay from './PublicationReactionOverlay';
import KnowledgeCard from './KnowledgeCard';
import { useTouchGestures } from '../hooks/useTouchGestures';
import PropTypes from 'prop-types';

/**
 * Wrapper composant optimisé avec React.memo et useCallback
 * Gère les animations double-tap et long-press avec memoization
 */
const PublicationWithReactions = ({
  post,
  user,
  onLike,
  onSuperLike,
  onComment,
  onShare,
  onMenuClick,
  isLiked = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showReactionAnimation, setShowReactionAnimation] = useState(false);
  const [animationType, setAnimationType] = useState('like');
  const reactionTimeoutRef = useRef(null);
  const textSelectRef = useRef(false);

  const isPending = post.status === 'pending';
  const isFailed = post.status === 'failed';

  const handleMouseDown = useCallback(() => {
    textSelectRef.current = false;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (window.getSelection && window.getSelection().toString().length > 0) {
      textSelectRef.current = true;
    }
  }, []);

  const handleDoubleTapReaction = useCallback(() => {
    if (textSelectRef.current) return;
    setAnimationType('like');
    setShowReactionAnimation(true);
    onLike?.();
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    reactionTimeoutRef.current = setTimeout(() => {
      setShowReactionAnimation(false);
    }, 800);
  }, [onLike]);

  const handleLongPressReaction = useCallback(() => {
    if (textSelectRef.current) return;
    setAnimationType('super-like');
    setShowReactionAnimation(true);
    onSuperLike?.();
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    reactionTimeoutRef.current = setTimeout(() => {
      setShowReactionAnimation(false);
    }, 1200);
  }, [onSuperLike]);

  // Hook gestes tactiles - optimisé
  const touchHandlers = useTouchGestures({
    onDoubleTap: handleDoubleTapReaction,
    onLongPress: handleLongPressReaction,
    doubleTapThreshold: 350,
    longPressMinTime: 350,
    longPressMaxTime: 500,
    swipeThreshold: 50
  });

  const authorId = post.user?.id || post.author?.id || post.user_id;

  const handleProfileClick = () => {
    if (authorId) {
      navigate(`/profile/${authorId}`);
    }
  };

  return (
    <div
      className="relative w-full transform transition-all duration-300 mb-6"
      {...touchHandlers}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Header - Outside the card */}
      <div className="px-2 py-3 flex items-start justify-between">
        <div className="flex gap-3 flex-1">
          <button 
            onClick={handleProfileClick}
            className="hover:opacity-80 transition-opacity"
          >
            <Avatar className="w-12 h-12">
              <AvatarImage 
                src={getAvatarUrl(post.user?.avatar || post.author?.avatar || post.user_avatar)} 
                onError={handleAvatarError}
              />
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

      {/* Animations Overlay - Rendered above but doesn't block interactions */}
      {showReactionAnimation && post && post.id && (
        <PublicationReactionOverlay
          publicationId={post.id}
          publicationType={post.image ? 'photo' : post.video ? 'video' : 'text'}
          onLike={() => {}}
          onSuperLike={() => {}}
          likeCount={post.reactions_count || 0}
          isDisabled={false}
          animationType={animationType}
        />
      )}

      {/* KnowledgeCard - The actual card content */}
      <div className={`relative z-10 ${isPending ? 'opacity-70' : ''}`}>
        {isPending && (
          <div className="absolute top-2 right-12 z-20">
            <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 px-2 py-1 rounded-full backdrop-blur-md">
              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              <span className="text-[10px] font-bold text-primary italic">Envoi...</span>
            </div>
          </div>
        )}
        {isFailed && (
          <div className="absolute top-2 right-12 z-20">
            <div className="flex items-center gap-2 bg-red-100 text-red-600 px-2 py-1 rounded-full text-[10px] font-bold shadow-sm">
              ⚠️ Échec
            </div>
          </div>
        )}
        <KnowledgeCard
          post={post}
          user={user}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
          onMenuClick={onMenuClick}
          isLiked={isLiked}
          showFullCard={false}
        />
      </div>

      {/* Interactions Buttons - OUTSIDE of the card */}
      <div className="px-2 py-1 flex items-center justify-between gap-2 mt-2">
        <button
          onClick={onLike}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-semibold text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 ${
            isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 0 : 2} />
          <span>{post.reactions_count || 0}</span>
        </button>

        <button
          onClick={onComment}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-gray-600 dark:text-gray-400 font-semibold text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{post.comments_count || 0}</span>
        </button>

        <button
          onClick={onShare}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-gray-600 dark:text-gray-400 font-semibold text-sm bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700"
        >
          <Send className="w-5 h-5" />
          <span>{post.shares_count || 0}</span>
        </button>
      </div>
    </div>
  );
};

PublicationWithReactions.propTypes = {
  post: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperLike: PropTypes.func.isRequired,
  onComment: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  onMenuClick: PropTypes.func.isRequired,
  isLiked: PropTypes.bool,
};

export default PublicationWithReactions;