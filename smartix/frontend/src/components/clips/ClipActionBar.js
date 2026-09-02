
import React from 'react';
import PropTypes from 'prop-types';
import { Heart, MessageCircle, Bookmark, UserPlus, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import ClipOptionsMenu from './ClipOptionsMenu';

// Composant interne pour éviter la duplication
const ActionButton = ({ 
  children, 
  onClick, 
  isActive = false, 
  activeClass = '',
  inactiveClass = '',
  disabled = false,
  loading = false,
  count = null,
  label = '',
  ariaLabel = ''
}) => {
  const baseClass = "w-14 h-14 rounded-full flex items-center justify-center transition-all transform";
  const activeStyle = isActive 
    ? `${baseClass} ${activeClass} scale-110` 
    : `${baseClass} ${inactiveClass} group-hover:scale-110`;
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex flex-col items-center gap-1 group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={ariaLabel || label}
      aria-pressed={isActive}
      aria-disabled={disabled || loading}
    >
      <div className={activeStyle}>
        {loading ? (
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        ) : (
          children
        )}
      </div>
      {count > 0 && (
        <span className="text-white text-xs font-bold drop-shadow-lg">
          {count}
        </span>
      )}
    </button>
  );
};

const ClipActionBar = ({
  clip,
  user,
  isOnline,
  onLike,
  onComment,
  onSave,
  onFollow,
  onProfileClick,
  handleDownload,
  isLiking = false,
  isSaving = false,
  isFollowing = false,
  isCommenting = false,
  className = ''
}) => {
  const isAuthor = user?.id === clip.author?.id;
  const isFollowingUser = clip.author?.following === true;
  const shouldShowFollow = !isAuthor && !isFollowingUser && isOnline && user;

  const handleFollowClick = async () => {
    if (onFollow && !isFollowing) {
      await onFollow(clip.author.id);
    }
  };

  const handleLikeClick = () => {
    if (onLike && !isLiking) {
      onLike(clip.id);
    }
  };

  const handleSaveClick = () => {
    if (onSave && !isSaving) {
      onSave(clip.id);
    }
  };

  const handleProfileClick = () => {
    if (onProfileClick && clip.author?.id) {
      onProfileClick(clip.author.id);
    }
  };

  return (
    <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10 ${className}`}>
      {/* Avatar + Follow */}
      <button 
        onClick={handleProfileClick}
        className="relative group mb-2"
        aria-label={`Profil de ${clip.author?.name || 'utilisateur'}`}
      >
        <Avatar className="w-14 h-14 ring-2 ring-white group-hover:ring-[#005CFF] transition-all">
          <AvatarImage src={clip.author?.avatar} loading="lazy" />
          <AvatarFallback className="bg-gradient-to-br from-[#005CFF] to-[#44B0FF] text-white">
            {clip.author?.name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
        {shouldShowFollow && (
          <div 
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-[#005CFF] rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              handleFollowClick();
            }}
            role="button"
            aria-label={`Suivre ${clip.author?.name}`}
          >
            {isFollowing ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <UserPlus className="w-3.5 h-3.5 text-white" />
            )}
          </div>
        )}
      </button>

      {/* LIKE */}
      <ActionButton
        onClick={handleLikeClick}
        isActive={clip.liked}
        activeClass="bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/50"
        inactiveClass="bg-white/20 backdrop-blur-md group-hover:bg-white/30"
        disabled={!isOnline}
        loading={isLiking}
        count={clip.likes}
        label="J'aime"
        ariaLabel={clip.liked ? "Retirer le like" : "J'aime"}
      >
        <Heart className={`w-7 h-7 transition-all ${clip.liked ? 'fill-white text-white animate-pulse' : 'text-white'}`} />
      </ActionButton>

      {/* COMMENTS */}
      <ActionButton
        onClick={onComment}
        disabled={!isOnline}
        loading={isCommenting}
        count={clip.comments_count}
        label="Commentaires"
        ariaLabel="Commentaires"
        inactiveClass="bg-white/20 backdrop-blur-md group-hover:bg-white/30"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </ActionButton>

      {/* SAVE */}
      <ActionButton
        onClick={handleSaveClick}
        isActive={clip.saved}
        activeClass="bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/50"
        inactiveClass="bg-white/20 backdrop-blur-md group-hover:bg-white/30"
        disabled={!isOnline}
        loading={isSaving}
        label="Sauvegarder"
        ariaLabel={clip.saved ? "Retirer des favoris" : "Sauvegarder"}
      >
        <Bookmark className={`w-7 h-7 ${clip.saved ? 'fill-white text-white' : 'text-white'}`} />
      </ActionButton>

      {/* MENU */}
      <ClipOptionsMenu 
        clip={clip} 
        handleDownload={handleDownload} 
        user={user} 
        isOnline={isOnline} 
      />
    </div>
  );
};

const clipAuthorShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  name: PropTypes.string,
  avatar: PropTypes.string,
  following: PropTypes.bool
});

ActionButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  isActive: PropTypes.bool,
  activeClass: PropTypes.string,
  inactiveClass: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  count: PropTypes.number,
  label: PropTypes.string,
  ariaLabel: PropTypes.string
};

ClipActionBar.propTypes = {
  clip: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    author: clipAuthorShape,
    liked: PropTypes.bool,
    likes: PropTypes.number,
    saved: PropTypes.bool,
    comments_count: PropTypes.number
  }).isRequired,
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }),
  isOnline: PropTypes.bool,
  onLike: PropTypes.func,
  onComment: PropTypes.func,
  onSave: PropTypes.func,
  onFollow: PropTypes.func,
  onProfileClick: PropTypes.func,
  handleDownload: PropTypes.func,
  isLiking: PropTypes.bool,
  isSaving: PropTypes.bool,
  isFollowing: PropTypes.bool,
  isCommenting: PropTypes.bool,
  className: PropTypes.string
};

export default ClipActionBar;
