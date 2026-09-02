
import React from 'react';
import PropTypes from 'prop-types';
import { Music2, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const VideoInfo = ({
  clip,
  user,
  isOnline,
  immersiveMode = false,
  onFollow,
  onProfileClick,
  onHashtagClick,
  onSoundClick,
  isFollowing = false,
  className = ''
}) => {
  const isAuthor = user?.id === clip.author?.id;
  const isFollowingUser = clip.author?.following === true;
  const shouldShowFollow = !isAuthor && !isFollowingUser && isOnline && user;

  const handleFollowClick = async () => {
    if (onFollow && !isFollowing && clip.author?.id) {
      await onFollow(clip.author.id);
    }
  };

  const handleProfileClick = () => {
    if (onProfileClick && clip.author?.id) {
      onProfileClick(clip.author.id);
    }
  };

  const handleHashtagClick = (tag) => {
    if (onHashtagClick) {
      onHashtagClick(tag);
    }
  };

  const handleSoundClick = () => {
    if (onSoundClick && clip.sound?.id) {
      onSoundClick(clip.sound.id);
    }
  };

  // Si pas d'auteur, ne rien afficher
  if (!clip.author) return null;

  return (
    <div className={`absolute bottom-24 left-4 right-20 z-10 transition-opacity duration-300 ${immersiveMode ? 'opacity-0' : 'opacity-100'} ${className}`}>
      {/* Auteur */}
      <div className="flex items-center gap-3 mb-3">
        <button 
          onClick={handleProfileClick}
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#005CFF] rounded-full"
          aria-label={`Profil de ${clip.author.name}`}
        >
          <Avatar className="w-10 h-10 ring-2 ring-white/50">
            <AvatarImage src={clip.author.avatar} loading="lazy" />
            <AvatarFallback>{clip.author.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <span className="text-white font-semibold drop-shadow-lg">{clip.author.name}</span>
        </button>
        
        {shouldShowFollow && (
          <button
            onClick={handleFollowClick}
            disabled={isFollowing}
            className="px-4 py-1.5 bg-[#005CFF] hover:bg-[#0044CC] disabled:bg-[#005CFF]/50 text-white rounded-full text-sm font-semibold transition-all flex items-center gap-1"
            aria-label={`Suivre ${clip.author.name}`}
            aria-busy={isFollowing}
          >
            {isFollowing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Abonnement...
              </>
            ) : (
              'Suivre'
            )}
          </button>
        )}
      </div>

      {/* Description */}
      {clip.description && (
        <p className="text-white text-sm mb-2 drop-shadow-lg line-clamp-2">{clip.description}</p>
      )}

      {/* Hashtags */}
      {clip.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {clip.hashtags.map((tag, idx) => (
            <button
              key={idx}
              onClick={() => handleHashtagClick(tag)}
              className="text-[#44B0FF] text-sm font-semibold drop-shadow-lg hover:underline focus:outline-none focus:ring-2 focus:ring-[#44B0FF] rounded"
              aria-label={`Hashtag ${tag}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Son */}
      {clip.sound && (
        <button
          onClick={handleSoundClick}
          className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full hover:bg-black/40 transition-all focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          aria-label={`Son: ${clip.sound.name}`}
        >
          <Music2 className="w-4 h-4 text-white animate-pulse" />
          <span className="text-white text-sm truncate max-w-[180px]">{clip.sound.name}</span>
        </button>
      )}
    </div>
  );
};

VideoInfo.propTypes = {
  clip: PropTypes.shape({
    author: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      avatar: PropTypes.string,
      following: PropTypes.bool
    }),
    description: PropTypes.string,
    hashtags: PropTypes.arrayOf(PropTypes.string),
    sound: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string
    })
  }).isRequired,
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }),
  isOnline: PropTypes.bool,
  immersiveMode: PropTypes.bool,
  onFollow: PropTypes.func,
  onProfileClick: PropTypes.func,
  onHashtagClick: PropTypes.func,
  onSoundClick: PropTypes.func,
  isFollowing: PropTypes.bool,
  className: PropTypes.string
};

export default VideoInfo;
