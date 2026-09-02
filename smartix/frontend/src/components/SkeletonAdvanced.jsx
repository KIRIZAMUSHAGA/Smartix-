import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import PropTypes from 'prop-types';

// ==================== SKELETONS AVANCÉS ====================

export const SkeletonAIChat = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="space-y-4">
      {/* Message utilisateur */}
      <div className={`ml-auto w-2/3 p-3 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      
      {/* Message IA */}
      <div className={`mr-auto w-2/3 p-3 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      <div className={`mr-auto w-3/4 p-3 ${skeletonBg} rounded-lg skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonCourseDetail = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} rounded-lg overflow-hidden`}>
      {/* Video */}
      <div className={`w-full h-64 ${skeletonBg} skeleton-shimmer`} />
      
      <div className="p-4 space-y-4">
        {/* Title */}
        <div className={`w-3/4 h-6 ${skeletonBg} rounded skeleton-shimmer`} />
        
        {/* Description */}
        <div className="space-y-2">
          <div className={`w-full h-3 ${skeletonBg} rounded skeleton-shimmer`} />
          <div className={`w-full h-3 ${skeletonBg} rounded skeleton-shimmer`} />
          <div className={`w-2/3 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>
        
        {/* Instructor */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
          <div className={`w-32 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>
      </div>
    </div>
  );
};

export const SkeletonSearchBar = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return <div className={`w-full h-10 ${skeletonBg} rounded-lg skeleton-shimmer`} />;
};

export const SkeletonGridCards = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className={`h-40 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      ))}
    </div>
  );
};

export const SkeletonProfileTabs = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="flex gap-2 border-b">
      {[1, 2, 3].map(i => (
        <div key={i} className={`w-20 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
      ))}
    </div>
  );
};

export const SkeletonRewardCard = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} p-4 rounded-lg shadow-sm`}>
      <div className={`w-full h-24 ${skeletonBg} rounded-lg skeleton-shimmer mb-3`} />
      <div className={`w-32 h-4 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
      <div className={`w-24 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonHeroSection = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div>
      <div className={`w-full h-48 ${skeletonBg} rounded-lg skeleton-shimmer mb-4`} />
      <div className={`w-2/3 h-8 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
      <div className={`w-full h-4 ${skeletonBg} rounded skeleton-shimmer`} />
    </div>
  );
};

export const SkeletonStatsGrid = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[1, 2, 3].map(i => (
        <div key={i} className={`p-3 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      ))}
    </div>
  );
};

export const SkeletonRecommendations = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className={`${cardBg} p-3 rounded-lg shadow-sm flex gap-3`}>
          <div className={`w-12 h-12 ${skeletonBg} rounded-lg skeleton-shimmer`} />
          <div className="flex-1 space-y-2">
            <div className={`w-32 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
            <div className={`w-24 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonComposer = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className={`${cardBg} p-4 rounded-lg shadow-sm mb-4`}>
      <div className="flex gap-3 mb-3">
        <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
        <div className={`flex-1 h-10 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`w-10 h-9 ${skeletonBg} rounded skeleton-shimmer`} />
        ))}
      </div>
    </div>
  );
};
SkeletonAIChat.propTypes = {};
SkeletonCourseDetail.propTypes = {};
SkeletonSearchBar.propTypes = {};
SkeletonGridCards.propTypes = {};
SkeletonProfileTabs.propTypes = {};
SkeletonRewardCard.propTypes = {};
SkeletonHeroSection.propTypes = {};
SkeletonStatsGrid.propTypes = {};
SkeletonRecommendations.propTypes = {};
SkeletonComposer.propTypes = {};
