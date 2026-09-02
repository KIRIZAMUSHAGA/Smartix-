import React, { useState, useEffect, useMemo, useCallback, memo, createContext, useContext } from 'react'; // ✅ createContext, useContext ajoutés
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Repeat, Trash2, Edit3, Flag } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { getAvatarUrl, getOptimizedImageUrl, isValidImageUrl } from '../config/apiClient';
import { toast } from 'sonner';
import { useInView } from 'react-intersection-observer';
import Comments from './Comments/Comments';
import SharedPostCard from './SharedPostCard';
import { usePostActions } from '../hooks/usePostActions';

// =============================
// 1️⃣ EVENT BUS CONTEXT
// =============================
export const CommentEventBusContext = createContext(null);

// Hook personnalisé pour utiliser le bus (évite d'importer depuis un autre fichier)
export const useCommentEventBus = () => {
  const bus = useContext(CommentEventBusContext);
  if (!bus) {
    throw new Error('useCommentEventBus must be used within CommentEventBusProvider');
  }
  return bus;
};

// =============================
// 2️⃣ PROVIDER POUR L'EVENT BUS
// =============================
export const CommentEventBusProvider = ({ children }) => {
  const eventBus = useMemo(() => new EventTarget(), []);
  return (
    <CommentEventBusContext.Provider value={eventBus}>
      {children}
    </CommentEventBusContext.Provider>
  );
};

// =============================
// 3️⃣ SECURE IMAGE COMPONENT
// =============================
const SecureImage = ({ imagePath, alt, aspectRatio = '16/9' }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [validUrl, setValidUrl] = useState(null);
  
  const { ref, inView } = useInView({
    threshold: 0.01,
    triggerOnce: true,
    rootMargin: '100px'
  });

  useEffect(() => {
    if (!imagePath || error) return;
    
    const isValid = isValidImageUrl(imagePath);
    if (!isValid) {
      console.warn('🚫 URL image invalide:', imagePath);
      setError(true);
      return;
    }
    
    setValidUrl(imagePath);
  }, [imagePath, error]);

  if (!inView || !validUrl || error) {
    return (
      <div ref={ref} className="w-full bg-gray-100 flex items-center justify-center" style={{ aspectRatio }}>
        {error && <span className="text-gray-400 text-sm">Image non disponible</span>}
      </div>
    );
  }

  return (
    <div ref={ref} className="w-full bg-gray-100 relative overflow-hidden">
      <img
        src={getOptimizedImageUrl(validUrl, 'medium')}
        srcSet={`
          ${getOptimizedImageUrl(validUrl, 'small')} 400w,
          ${getOptimizedImageUrl(validUrl, 'medium')} 1080w
        `}
        sizes="(max-width: 768px) 100vw, 800px"
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-auto object-contain transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ aspectRatio }}
      />
      
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
};

// =============================
// 4️⃣ POST ACTIONS COMPONENT
// =============================
const PostActions = ({ isLiked, isLiking, likesCount, commentsCount, handleLikeClick, handleShareClick, isSharing, toggleComments, user }) => {
  const formatCount = (num) => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' k';
    return num.toString();
  };

  return (
    <>
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 mx-1">
        <div className="flex items-center gap-1">
          <div className={`w-4 h-4 ${isLiked ? 'bg-blue-500' : 'bg-gray-400'} rounded-full flex items-center justify-center`}>
            <ThumbsUp className="w-2.5 h-2.5 text-white fill-current" />
          </div>
          <span className={`text-[13px] ${isLiked ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
            {formatCount(likesCount)}
          </span>
        </div>
        <div className="text-[13px] text-gray-500 flex gap-2">
          <span>{formatCount(commentsCount)} commentaire{commentsCount > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1">
        <button 
          onClick={handleLikeClick}
          disabled={isLiking || !user}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-full transition-colors ${
            isLiking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
          }`}
        >
          {isLiking ? (
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ThumbsUp className={`w-5 h-5 ${isLiked ? 'fill-blue-500 text-blue-500' : 'text-gray-500'}`} />
          )}
          <span className={`text-[14px] font-semibold ${isLiked ? 'text-blue-500' : 'text-gray-600'}`}>
            J'aime
          </span>
        </button>
        
        <button 
          onClick={toggleComments}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <span className="text-[14px] font-semibold text-blue-600">
            Commenter
          </span>
        </button>
        
        <button 
          onClick={handleShareClick}
          disabled={isSharing || !user}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-full transition-colors ${
            isSharing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
          }`}
        >
          {isSharing ? (
            <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Share2 className="w-5 h-5 text-gray-500" />
          )}
          <span className="text-[14px] font-semibold text-gray-600">
            Partager
          </span>
        </button>
      </div>
    </>
  );
};

// =============================
// 5️⃣ MENU OPTIONS COMPONENT
// =============================
const PostMenu = ({ isOpen, onClose, post, onDelete, onEdit, onReport }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute top-10 right-3 bg-white shadow-lg rounded-lg border border-gray-200 z-50 w-44">
      <button
        className="flex items-center gap-2 px-3 py-2 w-full text-left text-gray-700 hover:bg-gray-100"
        onClick={() => { onEdit(post); onClose(); }}
      >
        <Edit3 className="w-4 h-4" /> Modifier
      </button>
      <button
        className="flex items-center gap-2 px-3 py-2 w-full text-left text-red-600 hover:bg-gray-100"
        onClick={() => { onDelete(post); onClose(); }}
      >
        <Trash2 className="w-4 h-4" /> Supprimer
      </button>
      <button
        className="flex items-center gap-2 px-3 py-2 w-full text-left text-gray-700 hover:bg-gray-100"
        onClick={() => { onReport(post); onClose(); }}
      >
        <Flag className="w-4 h-4" /> Signaler
      </button>
    </div>
  );
};

// =============================
// 6️⃣ POST HEADER WITH MENU
// =============================
const PostHeader = ({ authorName, authorId, avatar, formattedDate, category, menuOpen, setMenuOpen, post, onDelete, onEdit, onReport }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-3 py-2.5 relative">
      <div className="flex items-center gap-2">
        <div 
          className="relative p-0.5 rounded-full border-2 border-blue-500 cursor-pointer hover:opacity-80 transition-opacity" 
          onClick={() => navigate(`/profile/${authorId}`)}
        >
          <img 
            src={getAvatarUrl(avatar)} 
            alt={authorName} 
            className="w-10 h-10 rounded-full object-cover border border-white"
            onError={(e) => { e.target.src = '/default-avatar.png'; }}
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <div 
              className="font-bold text-[15px] text-gray-900 leading-tight hover:underline cursor-pointer" 
              onClick={() => navigate(`/profile/${authorId}`)}
            >
              {authorName}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[13px] text-gray-500 mt-0.5">
            <span>{formattedDate}</span>
            <span className="text-blue-600 font-medium ml-1">• 🎓 {category || 'general'}</span>
          </div>
        </div>
      </div>
      <div className="relative">
        <button 
          onClick={() => setMenuOpen(!menuOpen)} 
          className="text-gray-500 hover:bg-gray-100 p-2 rounded-full" 
          aria-label="Options"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        <PostMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          post={post}
          onDelete={onDelete}
          onEdit={onEdit}
          onReport={onReport}
        />
      </div>
    </div>
  );
};

// =============================
// 7️⃣ MAIN POST ITEM COMPONENT
// =============================
const PostItem = memo(({ 
  post, 
  index, 
  postsCount, 
  onShareComplete, 
  toggleComments, 
  selectedPostForComments, 
  commentsByPost, 
  style, 
  onDeletePost, 
  onEditPost, 
  onReportPost 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const eventBus = useCommentEventBus(); // ✅ Utilisation du hook interne

  const [showFullText, setShowFullText] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    isLiked,
    likesCount,
    commentsCount,
    isLiking,
    isSharing,
    handleLike,
    handleShare
  } = usePostActions(
    post.id || post._id,
    post.likedByCurrentUser,
    post.likes_count || 0,
    post.comments_count || 0
  );

  const formattedDate = useMemo(() => {
    try {
      return new Date(post.created_at).toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short' 
      });
    } catch {
      return '';
    }
  }, [post.created_at]);

  const handleLikeClick = useCallback(async () => {
    if (!user) {
      toast.error('Connectez-vous pour aimer');
      navigate('/auth');
      return;
    }
    await handleLike();
  }, [user, navigate, handleLike]);

  const handleShareClick = useCallback(async () => {
    if (!user) {
      toast.error('Connectez-vous pour partager');
      navigate('/auth');
      return;
    }
    const result = await handleShare();
    if (result?.success && onShareComplete) onShareComplete(post);
  }, [user, navigate, handleShare, onShareComplete, post]);

  const handlePostClick = useCallback(() => {
    navigate(`/posts/${post.id || post._id}`);
  }, [navigate, post.id, post._id]);

  const postImage = useMemo(() => {
    const img = post.image_original_url || post.image_url;
    return isValidImageUrl(img) ? img : null;
  }, [post.image_original_url, post.image_url]);

  const isShared = post.post_type === 'shared_post';
  const isLongText = post.content?.length > 150;
  const displayContent = showFullText || !isLongText 
    ? post.content 
    : post.content?.substring(0, 150) + "...";

  return (
    <div style={style}>
      <div className="bg-white shadow-sm border-y sm:border sm:rounded-xl overflow-hidden font-sans">
        <PostHeader
          authorName={post.user?.full_name || post.author?.full_name || 'Utilisateur'}
          authorId={post.user?.id || post.author?.id}
          avatar={post.user?.avatar || post.author?.avatar}
          formattedDate={formattedDate}
          category={post.category}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          post={post}
          onDelete={onDeletePost}
          onEdit={onEditPost}
          onReport={onReportPost}
        />

        {isShared && post.shared_post_author_id && (
          <div className="px-3 py-1.5 flex items-center gap-1.5 text-gray-500 text-[11px] font-medium bg-gray-50/30 border-b border-gray-50">
            <Repeat size={12} className="text-gray-400" />
            <span>
              <span className="font-bold text-gray-700">
                {post.user?.full_name || post.author?.full_name}
              </span> a relayé
            </span>
          </div>
        )}

        <div 
          className="px-3 pb-3 text-[15px] text-gray-900 leading-normal cursor-pointer" 
          onClick={handlePostClick}
        >
          <div className="whitespace-pre-wrap">
            {displayContent}
            {isLongText && !showFullText && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullText(true);
                }} 
                className="ml-1 font-bold text-gray-600 hover:text-gray-800"
              >
                Voir plus
              </button>
            )}
          </div>
        </div>

        {postImage && !isShared && (
          <div onClick={handlePostClick} className="cursor-pointer">
            <SecureImage 
              imagePath={postImage}
              alt=""
              aspectRatio="4/5"
            />
          </div>
        )}

        {isShared && post.shared_post_id && (
          <SharedPostCard sharedPostId={post.shared_post_id} />
        )}

        <PostActions
          isLiked={isLiked}
          isLiking={isLiking}
          likesCount={likesCount}
          commentsCount={commentsCount}
          handleLikeClick={handleLikeClick}
          handleShareClick={handleShareClick}
          isSharing={isSharing}
          toggleComments={() => toggleComments(post)}
          user={user}
        />

        {selectedPostForComments === (post.id || post._id) && (
          <div className="border-t border-gray-100">
            <Comments 
              postId={post.id || post._id} 
              comments={commentsByPost[post.id || post._id] || []} 
              eventBus={eventBus} 
            />
          </div>
        )}
      </div>

      {index < postsCount - 1 && (
        <div 
          className="w-full bg-gray-200/50" 
          style={{ height: window.innerWidth < 768 ? '4px' : '6px' }} 
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.updated_at === nextProps.post.updated_at &&
    prevProps.post.likes_count === nextProps.post.likes_count &&
    prevProps.post.likedByCurrentUser === nextProps.post.likedByCurrentUser &&
    prevProps.post.comments_count === nextProps.post.comments_count &&
    prevProps.selectedPostForComments === nextProps.selectedPostForComments
  );
});

PostItem.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    content: PropTypes.string,
    image: PropTypes.string,
    author: PropTypes.object,
    created_at: PropTypes.string
  }).isRequired,
  index: PropTypes.number,
  postsCount: PropTypes.number,
  onShareComplete: PropTypes.func,
  toggleComments: PropTypes.func,
  selectedPostForComments: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  commentsByPost: PropTypes.object,
  style: PropTypes.object,
  onDeletePost: PropTypes.func,
  onEditPost: PropTypes.func,
  onReportPost: PropTypes.func
};

PostItem.displayName = 'PostItem';

export default PostItem;
CommentEventBusProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
SecureImage.propTypes = {
  imagePath: PropTypes.any.isRequired,
  alt: PropTypes.string.isRequired,
  aspectRatio: PropTypes.any,
};
PostActions.propTypes = {
  isLiked: PropTypes.bool.isRequired,
  isLiking: PropTypes.bool.isRequired,
  likesCount: PropTypes.any.isRequired,
  commentsCount: PropTypes.any.isRequired,
  handleLikeClick: PropTypes.func.isRequired,
  handleShareClick: PropTypes.func.isRequired,
  isSharing: PropTypes.bool.isRequired,
  toggleComments: PropTypes.any.isRequired,
  user: PropTypes.object.isRequired,
};
PostMenu.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  post: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onReport: PropTypes.func.isRequired,
};
PostHeader.propTypes = {
  authorName: PropTypes.any.isRequired,
  authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  avatar: PropTypes.node.isRequired,
  formattedDate: PropTypes.any.isRequired,
  category: PropTypes.object.isRequired,
  menuOpen: PropTypes.func.isRequired,
  setMenuOpen: PropTypes.func.isRequired,
  post: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onReport: PropTypes.func.isRequired,
};
