import React from 'react';
import PropTypes from 'prop-types';

/**
 * 🚀 SYSTÈME SKELETON OPTIMISÉ
 * - Affichage ultra-rapide (<100ms)
 * - Adaptation 100% aux structures de pages
 * - Animation shimmer fluide
 */

// Hook safe qui ne dépend pas de ThemeContext
export const useSkeletonLoader = (delay = 2000) => {
  const [isLoading, setIsLoading] = React.useState(() => {
    // Si on a déjà chargé une fois au niveau global, on ne montre plus le skeleton
    return !window.__SMARTIX_HAS_LOADED__;
  });

  React.useEffect(() => {
    if (!window.__SMARTIX_HAS_LOADED__) {
      const timer = setTimeout(() => {
        setIsLoading(false);
        window.__SMARTIX_HAS_LOADED__ = true;
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, [delay]);

  return { isLoading, stopLoading: () => setIsLoading(false) };
};

// Utiliser ThemeContext de manière sûre
let useTheme = null;
try {
  const ThemeModule = require('../contexts/ThemeContext');
  useTheme = ThemeModule.useTheme || (() => ({ darkMode: false }));
} catch (e) {
  // Fallback si ThemeContext n'est pas disponible
  useTheme = () => ({ darkMode: false });
}

const useSkeletonColors = () => {
  try {
    const { darkMode } = useTheme();
    return {
      skeletonBg: darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]',
      cardBg: darkMode ? 'bg-[#1e1e1e]' : 'bg-white'
    };
  } catch (e) {
    return {
      skeletonBg: 'bg-[#e6e6e6]',
      cardBg: 'bg-white'
    };
  }
};

// Shimmer animation ultra-rapide
const shimmerStyle = `
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .skeleton-shimmer {
    background: linear-gradient(90deg, currentColor 25%, rgba(255,255,255,.2) 50%, currentColor 75%);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }
`;

export const SkeletonHome = ({ isLoading = true }) => {
  const { skeletonBg, cardBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="space-y-6">
      <div className={`h-64 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className={`p-4 ${skeletonBg} rounded-lg skeleton-shimmer h-20`} />)}
      </div>
    </div>
  );
};

export const StorySkeleton = () => {
  const { skeletonBg } = useSkeletonColors();
  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-2">
      <div className="relative p-0.5 rounded-full border-2 border-blue-500">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${skeletonBg} border border-white skeleton-shimmer`} />
      </div>
      <div className={`w-12 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
    </div>
  );
};

export const PostSkeleton = () => {
  const { skeletonBg, cardBg } = useSkeletonColors();
  return (
    <div className={`${cardBg} mb-3 shadow-sm border-y sm:border sm:rounded-xl overflow-hidden font-sans w-full max-w-[600px] mx-auto`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative p-0.5 rounded-full border-2 border-blue-500">
            <div className={`w-10 h-10 rounded-full ${skeletonBg} border border-white skeleton-shimmer`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <div className={`w-24 h-3.5 ${skeletonBg} rounded skeleton-shimmer`} />
              <div className="w-3.5 h-3.5 bg-blue-500 rounded-full opacity-20" />
            </div>
            <div className={`w-20 h-2.5 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        </div>
        <div className={`w-8 h-8 rounded-full ${skeletonBg} opacity-20`} />
      </div>

      {/* Content Text */}
      <div className="px-3 pb-3 space-y-2">
        <div className={`w-full h-3.5 ${skeletonBg} rounded skeleton-shimmer`} />
        <div className={`w-full h-3.5 ${skeletonBg} rounded skeleton-shimmer`} />
        <div className={`w-3/4 h-3.5 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>

      {/* Media Placeholder */}
      <div className={`w-full ${skeletonBg} min-h-[300px] skeleton-shimmer`} />

      {/* Interaction Counts */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 mx-1">
        <div className="flex items-center gap-1">
          <div className={`w-4 h-4 ${skeletonBg} rounded-full opacity-50`} />
          <div className={`w-8 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>
        <div className={`w-24 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>

      {/* Interaction Buttons */}
      <div className="flex items-center gap-1 p-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-1 flex items-center justify-center py-2">
            <div className={`w-20 h-6 ${skeletonBg} rounded-full skeleton-shimmer`} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonFeed = ({ isLoading = true, count = 3, showStories = false }) => {
  if (!isLoading) return null;
  return (
    <div className="space-y-4">
      {showStories && (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {[1, 2, 3, 4, 5].map(i => <StorySkeleton key={i} />)}
        </div>
      )}
      {Array.from({ length: count }).map((_, i) => <PostSkeleton key={i} />)}
    </div>
  );
};

export const SkeletonProfile = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return <div className={`w-full h-96 ${skeletonBg} rounded-lg skeleton-shimmer`} />;
};

export const SkeletonCourses = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[1,2,3,4,5,6].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-48`} />)}
    </div>
  );
};

export const SkeletonMessages = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return <div className={`h-96 ${skeletonBg} rounded-lg skeleton-shimmer`} />;
};

export const SkeletonGroups = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-20`} />)}
    </div>
  );
};

export const SkeletonNotifications = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="space-y-2">
      {[1,2,3,4,5].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-16`} />)}
    </div>
  );
};

export const SkeletonFriends = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="space-y-3">
      {[1,2,3,4,5,6].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-16`} />)}
    </div>
  );
};

export const SkeletonCreatePost = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return <div className={`${skeletonBg} rounded-lg skeleton-shimmer h-40`} />;
};

export const SkeletonCreateStory = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return <div className={`${skeletonBg} rounded-lg skeleton-shimmer w-full h-96`} />;
};

export const SkeletonCommunity = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return <div className={`${skeletonBg} rounded-lg skeleton-shimmer h-80`} />;
};

export const SkeletonSmartixStore = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-32`} />)}
    </div>
  );
};

export const SkeletonGroupFeed = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-32`} />)}
    </div>
  );
};

export const SkeletonCourseDetail = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return <div className={`${skeletonBg} rounded-lg skeleton-shimmer w-full h-96`} />;
};

export const SkeletonStories = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-24`} />)}
    </div>
  );
};

export const SkeletonAIChat = ({ isLoading = true }) => {
  const { skeletonBg } = useSkeletonColors();
  if (!isLoading) return null;
  return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className={`${skeletonBg} rounded-lg skeleton-shimmer h-12`} />)}
    </div>
  );
};

// Style injection
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = shimmerStyle;
  document.head.appendChild(style);
}
SkeletonHome.propTypes = {
  isLoading: PropTypes.bool,
};
StorySkeleton.propTypes = {};
PostSkeleton.propTypes = {};
SkeletonFeed.propTypes = {
  isLoading: PropTypes.bool,
  count: PropTypes.number,
  showStories: PropTypes.bool,
};
SkeletonProfile.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonCourses.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonMessages.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonGroups.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonNotifications.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonFriends.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonCreatePost.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonCreateStory.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonCommunity.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonSmartixStore.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonGroupFeed.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonCourseDetail.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonStories.propTypes = {
  isLoading: PropTypes.bool,
};
SkeletonAIChat.propTypes = {
  isLoading: PropTypes.bool,
};
