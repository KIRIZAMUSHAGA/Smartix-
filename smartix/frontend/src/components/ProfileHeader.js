import React, { useContext } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Camera, Edit3 } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatarUtils';
import { AuthContext } from '../contexts/AuthContext';

import PropTypes from 'prop-types';

const ProfileHeader = ({ user, onEditCover, onEditProfile }) => {
    const { user: currentUser } = useContext(AuthContext);
    const isOwner = currentUser?.id === user?.id;

    const getImageUrl = (path, isAvatar = false) => {
      if (!path) return undefined;
      if (path.startsWith('http')) return path;
      if (isAvatar) return getAvatarUrl(path);
      return `${window.location.origin}${path}${path.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
    };

    return (
      <div className="relative w-full">
        {/* ===== COVER PHOTO SECTION ===== */}
        <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden group">
          {/* Cover Image */}
          <div
            className="w-full h-full bg-gradient-to-br from-[#00E6FF]/30 via-[#6A5CFF]/30 to-[#00E6FF]/30 relative"
            style={{
              backgroundImage: user?.cover_photo ? `url(${getImageUrl(user.cover_photo)})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Overlay gradient pour meilleure lisibilité */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 z-0" />
            
            {/* Neon glow effect léger */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#00E6FF]/5 to-[#6A5CFF]/5 z-0" />
          </div>

          {/* Edit Cover Button */}
          {isOwner && (
            <button
              onClick={onEditCover}
              className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* ===== PROFILE PICTURE CONTAINER (Superposée) ===== */}
        <div className="relative px-4 md:px-8 pb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:-mt-20">
            {/* Profile Picture Circle */}
            <div className="relative group">
              {/* Glow ring animation */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#00E6FF] to-[#6A5CFF] blur-lg opacity-50 group-hover:opacity-100 transition-opacity animate-pulse" />
              
              {/* Avatar Container */}
              <div className="relative w-56 h-56 md:w-80 md:h-80 rounded-full border-4 border-background shadow-2xl overflow-hidden bg-card">
                <Avatar className="w-full h-full">
                  <AvatarImage src={getImageUrl(user?.avatar, true)} />
                  <AvatarFallback className="bg-gradient-to-br from-[#00E6FF] to-[#6A5CFF] text-white text-9xl font-bold">
                    {user?.full_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              
              {/* Edit Profile Button */}
              {isOwner && (
                <button
                  onClick={onEditProfile}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit3 className="w-6 h-6 text-white" />
                </button>
              )}
            </div>

            {/* Online status indicator */}
            <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-2 border-background shadow-lg animate-pulse" />
          </div>

          {/* User Info Section */}
          <div className="flex-1 pb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
              {user?.full_name}
            </h1>
            <p className="text-[#ff6b35] text-lg mb-2">
              @{user?.username || user?.email?.split('@')[0]}
            </p>
            
            {/* Bio */}
            {user?.bio && (
              <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                {user.bio}
              </p>
            )}

            {/* Tags/Badges */}
            <div className="flex flex-wrap gap-2">
              {user?.school && (
                <span className="px-3 py-1 bg-accent/50 border border-border rounded-full text-xs text-foreground font-semibold">
                  🎓 {user.school}
                </span>
              )}
              {user?.level && (
                <span className="px-3 py-1 bg-accent/50 border border-border rounded-full text-xs text-foreground font-semibold">
                  {user.level}
                </span>
              )}
              {user?.date_of_birth && (
                <span className="px-3 py-1 bg-pink-500/10 border border-pink-500/50 rounded-full text-xs text-pink-600 dark:text-pink-300 font-semibold">
                  🎂 {new Date(user.date_of_birth).toLocaleDateString('fr-FR', { month: 'long', day: 'numeric' })}
                </span>
              )}
              <span className="px-3 py-1 bg-gradient-to-r from-[#ff6b35]/10 to-[#ff8c61]/10 border border-[#ff6b35]/30 rounded-full text-xs text-[#ff6b35] font-black">
                🌟 {user?.points || 0} XP
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 md:pb-2">
            <button className="px-6 py-2 bg-[#ff6b35] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#ff6b35]/50 transition-all transform hover:scale-105">
              Suivre
            </button>
            <button className="px-6 py-2 bg-card border border-border text-foreground font-bold rounded-xl hover:bg-accent transition-all backdrop-blur-sm">
              Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

ProfileHeader.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    full_name: PropTypes.string,
    avatar: PropTypes.string,
    cover: PropTypes.string,
    bio: PropTypes.string
  }),
  onEditCover: PropTypes.func,
  onEditProfile: PropTypes.func
};

export default ProfileHeader;
