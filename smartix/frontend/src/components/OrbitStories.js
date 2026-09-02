import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatarUrl } from '../utils/avatarUtils';
import { useStoryViewer } from '../contexts/StoryViewerContext';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

// Composant pour le chargement progressif des avatars/thumbnails
const LazyStoryAvatar = ({ src, alt, fallback, isViewed, isTextStory, latestStory }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
      {isVisible && (
        <>
          {src ? (
            <img 
              src={getAvatarUrl(src)} 
              alt={alt}
              className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                e.target.src = getAvatarUrl(fallback);
                setIsLoaded(true);
              }}
            />
          ) : isTextStory && latestStory ? (
            <div 
              className="w-full h-full flex items-center justify-center p-2 text-center overflow-hidden"
              style={{
                background: latestStory.style?.useGradient 
                  ? `linear-gradient(${latestStory.style.gradientAngle || 135}deg, ${latestStory.style.backgroundColor || '#000'} 0%, ${latestStory.style.gradientColor2 || '#000'} 100%)`
                  : latestStory.style?.backgroundColor || '#1f2937',
              }}
            >
              <p className="text-[10px] font-medium leading-tight line-clamp-2" style={{ color: latestStory.style?.textColor || '#ffffff' }}>
                {latestStory.text?.substring(0, 30)}...
              </p>
            </div>
          ) : (
            <Avatar className="w-full h-full">
              <AvatarImage src={getAvatarUrl(fallback)} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-violet-500 text-white text-lg">
                {(alt || 'S')[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </>
      )}
    </div>
  );
};

import { StorySkeleton } from './SkeletonComplete.jsx';

const OrbitStories = ({ storyOrbits = [], user, onCreateStory, onViewStory, isLoading }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hoveredStory, setHoveredStory] = useState(null);
  const { openViewer } = useStoryViewer();

  if (isLoading) {
    return (
      <div className="mb-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3, 4, 5].map(i => <StorySkeleton key={i} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🛡️ DEFENSIVE RENDERING: Guard against undefined/empty orbits
  const safeOrbits = Array.isArray(storyOrbits) ? storyOrbits : [];
  
  // ✅ DATA ALREADY NORMALIZED - No logic here, just render

  return (
    <div className="mb-3">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700" style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)' }}>
        <div className="px-4 py-3">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={onCreateStory}
              className="flex-shrink-0 flex flex-col items-center gap-2 group"
            >
              <div className="relative">
                <div 
                  className="w-16 h-16 rounded-full border-2 border-dashed border-cyan-400 dark:border-cyan-500 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 group-hover:border-cyan-500 transition-all duration-200 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${user?.id || user?._id}`);
                  }}
                >
                  <Avatar className="w-full h-full">
                    <AvatarImage src={getAvatarUrl(user?.avatar)} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-violet-500 text-white text-lg font-semibold">
                      {(user?.full_name || 'U')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16 text-center truncate">
                {t('community.stories.yourStory')}
              </span>
            </button>

            {safeOrbits.length > 0 && safeOrbits.map((orbit, idx) => {
              if (!orbit?.hasStories || !orbit?.stories?.length) {
                return null;
              }

              return (
                <button
                  key={`orbit-${orbit.userId}-${idx}`}
                  onClick={() => openViewer(orbit.stories, 0)}
                  onMouseEnter={() => setHoveredStory(orbit.userId)}
                  onMouseLeave={() => setHoveredStory(null)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 group"
                >
                  <div className="relative">
                    <div 
                      className={`w-16 h-16 rounded-full p-0.5 cursor-pointer ${!orbit.isViewed ? 'bg-gradient-to-tr from-cyan-400 to-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${orbit.userId}`);
                      }}
                    >
                      <LazyStoryAvatar 
                        src={orbit.thumbnailUrl}
                        alt={orbit.userName}
                        fallback={orbit.userAvatar}
                        isViewed={orbit.isViewed}
                        isTextStory={orbit.isTextStory}
                        latestStory={orbit.latestStory}
                      />
                    </div>
                    {orbit.storyCount > 1 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">
                        <span className="text-xs font-bold text-white">{orbit.storyCount}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-16 text-center truncate">
                    {orbit.userName?.substring(0, 10) || 'Story'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

OrbitStories.propTypes = {
  storyOrbits: PropTypes.any,
  user: PropTypes.object.isRequired,
  onCreateStory: PropTypes.func.isRequired,
  onViewStory: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

export default OrbitStories;
LazyStoryAvatar.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  fallback: PropTypes.node.isRequired,
  isViewed: PropTypes.bool.isRequired,
  isTextStory: PropTypes.bool.isRequired,
  latestStory: PropTypes.any.isRequired,
};
