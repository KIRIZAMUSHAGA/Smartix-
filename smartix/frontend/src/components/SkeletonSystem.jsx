import React, { useContext } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import PropTypes from 'prop-types';

const SkeletonSystem = () => {
  const { darkMode } = useTheme();

  const lightColors = {
    skeleton: '#e6e6e6',
    card: '#ffffff',
    shimmer: 'rgba(255, 255, 255, 0.14)'
  };

  const darkColors = {
    skeleton: '#2a2a2a',
    card: '#1e1e1e',
    shimmer: 'rgba(255, 255, 255, 0.09)'
  };

  const colors = darkMode ? darkColors : lightColors;

  const shimmerStyle = `
    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }

    .skeleton-shimmer {
      background: linear-gradient(
        90deg,
        ${colors.skeleton} 0%,
        ${colors.shimmer} 50%,
        ${colors.skeleton} 100%
      );
      background-size: 1000px 100%;
      animation: shimmer 2s infinite;
    }
  `;

  return <style>{shimmerStyle}</style>;
};

SkeletonSystem.propTypes = {};

export default SkeletonSystem;

// ==================== SKELETONS DE BASE ====================

export const SkeletonCircle = ({ size = 'md' }) => {
  const { darkMode } = useTheme();
  const sizeMap = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16', xl: 'w-20 h-20' };
  const bgColor = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${sizeMap[size]} ${bgColor} rounded-full skeleton-shimmer`} />
  );
};

export const SkeletonLine = ({ width = 'w-full', height = 'h-4' }) => {
  const { darkMode } = useTheme();
  const bgColor = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return <div className={`${width} ${height} ${bgColor} rounded skeleton-shimmer`} />;
};

export const SkeletonRect = ({ width = 'w-full', height = 'h-32' }) => {
  const { darkMode } = useTheme();
  const bgColor = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return <div className={`${width} ${height} ${bgColor} rounded-lg skeleton-shimmer`} />;
};

// ==================== SKELETONS COMPOSÉS ====================

export const SkeletonFeedPost = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} p-4 rounded-lg mb-4 shadow-sm`}>
      {/* Header */}
      <div className="flex items-center mb-4">
        <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer mr-3`} />
        <div className="flex-1">
          <div className={`w-24 h-4 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
          <div className={`w-16 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>
      </div>

      {/* Content */}
      <div className="mb-4 space-y-2">
        <div className={`w-full h-3 ${skeletonBg} rounded skeleton-shimmer`} />
        <div className={`w-4/5 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>

      {/* Image */}
      <div className={`w-full h-40 ${skeletonBg} rounded-lg skeleton-shimmer mb-4`} />

      {/* Actions */}
      <div className="flex justify-between">
        <div className={`w-12 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
        <div className={`w-12 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
        <div className={`w-12 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>
    </div>
  );
};

export const SkeletonProfileHeader = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} rounded-lg overflow-hidden shadow-sm`}>
      {/* Cover */}
      <div className={`w-full h-32 ${skeletonBg} skeleton-shimmer`} />

      {/* Profile Info */}
      <div className="p-4 relative -mt-8">
        <div className="flex items-end justify-between mb-4">
          <div className={`w-16 h-16 ${skeletonBg} rounded-full skeleton-shimmer border-4 border-white`} />
          <div className={`w-24 h-9 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>

        <div className="mb-4">
          <div className={`w-32 h-5 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
          <div className={`w-48 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className={`p-3 ${skeletonBg} rounded skeleton-shimmer`} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const SkeletonStoryCircle = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="flex flex-col items-center">
      <div className={`w-16 h-16 ${skeletonBg} rounded-full skeleton-shimmer border-2 border-cyan-400 p-0.5 mb-2`} />
      <div className={`w-14 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonStoryViewer = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-full max-w-sm h-full flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
          <div className="flex-1">
            <div className={`w-24 h-3 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
            <div className={`w-16 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className={`w-full h-full max-h-96 ${skeletonBg} skeleton-shimmer`} />
        </div>
      </div>
    </div>
  );
};

export const SkeletonComment = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="flex gap-3 mb-4">
      <div className={`w-8 h-8 ${skeletonBg} rounded-full skeleton-shimmer`} />
      <div className="flex-1">
        <div className={`w-24 h-3 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
        <div className={`w-full h-3 ${skeletonBg} rounded skeleton-shimmer mb-1`} />
        <div className={`w-3/4 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>
    </div>
  );
};

export const SkeletonGroupItem = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} p-4 rounded-lg shadow-sm mb-3 flex items-center gap-3`}>
      <div className={`w-12 h-12 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      <div className="flex-1">
        <div className={`w-32 h-4 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
        <div className={`w-48 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>
      <div className={`w-20 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonChatListItem = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} p-3 rounded-lg mb-2 flex items-center gap-3 border border-opacity-10`}>
      <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer relative`}>
        <div className={`w-3 h-3 ${skeletonBg} rounded-full absolute -bottom-1 -right-1`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`w-24 h-3 ${skeletonBg} rounded skeleton-shimmer mb-1`} />
        <div className={`w-full h-2 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>
      <div className={`w-8 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonMessageBubble = ({ isOwn = false }) => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';
  const align = isOwn ? 'ml-auto' : 'mr-auto';

  return (
    <div className={`${align} w-2/3 mb-3`}>
      <div className={`w-full h-12 ${skeletonBg} rounded-lg skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonNotificationItem = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} p-3 rounded-lg shadow-sm mb-2 flex gap-3`}>
      <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
      <div className="flex-1">
        <div className={`w-40 h-3 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
        <div className={`w-full h-2 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>
    </div>
  );
};

export const SkeletonSearchUser = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} p-3 rounded-lg mb-2 flex items-center gap-3`}>
      <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
      <div className="flex-1">
        <div className={`w-28 h-3 ${skeletonBg} rounded skeleton-shimmer mb-1`} />
        <div className={`w-40 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>
      <div className={`w-16 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonCourseCard = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} rounded-lg overflow-hidden shadow-sm`}>
      <div className={`w-full h-32 ${skeletonBg} skeleton-shimmer`} />
      <div className="p-3">
        <div className={`w-32 h-4 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
        <div className={`w-full h-2 ${skeletonBg} rounded skeleton-shimmer mb-3`} />
        <div className="flex justify-between">
          <div className={`w-12 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
          <div className={`w-16 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>
      </div>
    </div>
  );
};

export const SkeletonFeed = () => {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <SkeletonFeedPost key={i} />
      ))}
    </div>
  );
};

export const SkeletonStoriesCarousel = () => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex-shrink-0">
          <SkeletonStoryCircle />
        </div>
      ))}
    </div>
  );
};
SkeletonCircle.propTypes = {
  size: PropTypes.number,
};
SkeletonLine.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};
SkeletonRect.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
};
SkeletonFeedPost.propTypes = {};
SkeletonProfileHeader.propTypes = {};
SkeletonStoryCircle.propTypes = {};
SkeletonStoryViewer.propTypes = {};
SkeletonComment.propTypes = {};
SkeletonGroupItem.propTypes = {};
SkeletonChatListItem.propTypes = {};
SkeletonMessageBubble.propTypes = {
  isOwn: PropTypes.bool,
};
SkeletonNotificationItem.propTypes = {};
SkeletonSearchUser.propTypes = {};
SkeletonCourseCard.propTypes = {};
SkeletonFeed.propTypes = {};
SkeletonStoriesCarousel.propTypes = {};
