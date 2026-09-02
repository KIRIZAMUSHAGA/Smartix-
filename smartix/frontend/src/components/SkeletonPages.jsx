import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import PropTypes from 'prop-types';

/**
 * SKELETONS ADAPTÉS À CHAQUE PAGE
 * Structure exacte des pages réelles
 */

// ================== PAGE HOME ==================
export const SkeletonHome = () => {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className={`h-64 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      
      {/* Search Bar */}
      <div className={`h-12 ${skeletonBg} rounded-lg skeleton-shimmer`} />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className={`p-4 ${skeletonBg} rounded-lg skeleton-shimmer`} />
        ))}
      </div>

      {/* Level Progress */}
      <div className={`${cardBg} p-4 rounded-lg shadow-sm`}>
        <div className={`w-24 h-4 ${skeletonBg} rounded skeleton-shimmer mb-3`} />
        <div className={`w-full h-2 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>

      {/* News Section */}
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className={`${cardBg} p-4 rounded-lg shadow-sm h-20 ${skeletonBg} skeleton-shimmer`} />
        ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <div className={`w-32 h-5 ${skeletonBg} rounded skeleton-shimmer mb-3`} />
        {[1,2,3].map(i => (
          <div key={i} className={`${cardBg} p-3 rounded-lg shadow-sm flex gap-3`}>
            <div className={`w-16 h-16 ${skeletonBg} rounded skeleton-shimmer`} />
            <div className="flex-1 space-y-2">
              <div className={`w-32 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
              <div className={`w-24 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ================== PAGE COURSES ==================
export const SkeletonCourses = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';

  return (
    <div>
      {/* Filters/Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-8 w-20 ${skeletonBg} rounded skeleton-shimmer flex-shrink-0`} />
        ))}
      </div>

      {/* Grid de cours */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className={`${cardBg} rounded-lg overflow-hidden shadow-sm`}>
            <div className={`w-full h-32 ${skeletonBg} skeleton-shimmer`} />
            <div className="p-3 space-y-2">
              <div className={`w-32 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
              <div className={`w-full h-2 ${skeletonBg} rounded skeleton-shimmer`} />
              <div className="flex justify-between pt-2">
                <div className={`w-12 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
                <div className={`w-16 h-6 ${skeletonBg} rounded skeleton-shimmer`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ================== PAGE MESSAGES ==================
export const SkeletonMessages = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';

  return (
    <div className="flex h-screen gap-2">
      {/* Conversations List */}
      <div className="w-1/3 border-r space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`${cardBg} p-3 rounded-lg flex gap-3`}>
            <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
            <div className="flex-1">
              <div className={`w-24 h-3 ${skeletonBg} rounded skeleton-shimmer mb-1`} />
              <div className={`w-full h-2 ${skeletonBg} rounded skeleton-shimmer`} />
            </div>
          </div>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className={`${cardBg} p-3 border-b flex gap-3 items-center`}>
          <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
          <div className="flex-1 space-y-1">
            <div className={`w-24 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
            <div className={`w-16 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className={i % 2 === 0 ? 'ml-auto w-2/3' : 'mr-auto w-2/3'}>
              <div className={`p-3 h-12 ${skeletonBg} rounded-lg skeleton-shimmer`} />
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className={`${cardBg} p-4 border-t flex gap-2`}>
          <div className={`flex-1 h-10 ${skeletonBg} rounded skeleton-shimmer`} />
          <div className={`w-10 h-10 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>
      </div>
    </div>
  );
};

// ================== PAGE GROUPS ==================
export const SkeletonGroups = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex gap-2">
        <div className={`flex-1 h-10 ${skeletonBg} rounded skeleton-shimmer`} />
        <div className={`w-20 h-10 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        {[1,2].map(i => (
          <div key={i} className={`w-20 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
        ))}
      </div>

      {/* Groups List */}
      <div className="space-y-3">
        {[1,2,3,4].map(i => (
          <div key={i} className={`${cardBg} p-4 rounded-lg shadow-sm flex gap-3`}>
            <div className={`w-12 h-12 ${skeletonBg} rounded-lg skeleton-shimmer`} />
            <div className="flex-1 space-y-2">
              <div className={`w-40 h-4 ${skeletonBg} rounded skeleton-shimmer`} />
              <div className={`w-full h-2 ${skeletonBg} rounded skeleton-shimmer`} />
              <div className="flex gap-2">
                <div className={`w-16 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
                <div className={`w-12 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
              </div>
            </div>
            <div className={`w-16 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ================== PAGE PROFILE ==================
export const SkeletonProfile = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';

  return (
    <div className="space-y-4">
      {/* Cover Photo */}
      <div className={`w-full h-32 ${skeletonBg} rounded-lg skeleton-shimmer`} />

      {/* Profile Info */}
      <div className={`${cardBg} p-4 -mt-8 rounded-lg shadow-sm`}>
        <div className="flex items-end justify-between mb-4">
          <div className={`w-16 h-16 ${skeletonBg} rounded-full skeleton-shimmer border-4`} />
          <div className={`w-24 h-9 ${skeletonBg} rounded skeleton-shimmer`} />
        </div>
        <div className={`w-32 h-4 ${skeletonBg} rounded skeleton-shimmer mb-2`} />
        <div className={`w-48 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => (
          <div key={i} className={`${cardBg} p-3 rounded-lg shadow-sm text-center`}>
            <div className={`w-12 h-4 ${skeletonBg} rounded skeleton-shimmer mx-auto mb-2`} />
            <div className={`w-16 h-2 ${skeletonBg} rounded skeleton-shimmer mx-auto`} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        {[1,2,3].map(i => (
          <div key={i} className={`w-16 h-8 ${skeletonBg} rounded skeleton-shimmer`} />
        ))}
      </div>

      {/* Posts/Content */}
      <div className="space-y-3">
        {[1,2].map(i => (
          <div key={i} className={`${cardBg} p-3 rounded-lg shadow-sm`}>
            <div className="flex gap-2 mb-2">
              <div className={`w-8 h-8 ${skeletonBg} rounded-full skeleton-shimmer`} />
              <div className="flex-1">
                <div className={`w-24 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
              </div>
            </div>
            <div className={`w-full h-20 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ================== PAGE AI CHAT ==================
export const SkeletonAIChatPage = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`${cardBg} p-4 rounded-lg shadow-sm`}>
        <div className={`w-32 h-5 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        {[1,2,3,4].map(i => (
          <div key={i} className={`p-4 ${skeletonBg} rounded-lg skeleton-shimmer h-20`} />
        ))}
      </div>

      {/* Chat History */}
      <div className="space-y-2">
        {[1,2,3].map(i => (
          <div key={i} className={`${cardBg} p-3 rounded-lg shadow-sm`}>
            <div className={`w-40 h-3 ${skeletonBg} rounded skeleton-shimmer mb-1`} />
            <div className={`w-20 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        ))}
      </div>

      {/* Chat Input */}
      <div className={`${cardBg} p-4 rounded-lg shadow-sm flex gap-2`}>
        <div className={`flex-1 h-10 ${skeletonBg} rounded skeleton-shimmer`} />
        <div className={`w-10 h-10 ${skeletonBg} rounded skeleton-shimmer`} />
      </div>
    </div>
  );
};

// ================== PAGE NOTIFICATIONS ==================
export const SkeletonNotifications = () => {
  const { darkMode } = useTheme();
  const skeletonBg = darkMode ? 'bg-[#2a2a2a]' : 'bg-[#e6e6e6]';
  const cardBg = darkMode ? 'bg-[#1e1e1e]' : 'bg-white';

  return (
    <div className="space-y-2">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`${cardBg} p-3 rounded-lg shadow-sm flex gap-3`}>
          <div className={`w-10 h-10 ${skeletonBg} rounded-full skeleton-shimmer`} />
          <div className="flex-1 space-y-1">
            <div className={`w-40 h-3 ${skeletonBg} rounded skeleton-shimmer`} />
            <div className={`w-60 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
            <div className={`w-20 h-2 ${skeletonBg} rounded skeleton-shimmer`} />
          </div>
        </div>
      ))}
    </div>
  );
};
SkeletonHome.propTypes = {};
SkeletonCourses.propTypes = {};
SkeletonMessages.propTypes = {};
SkeletonGroups.propTypes = {};
SkeletonProfile.propTypes = {};
SkeletonAIChatPage.propTypes = {};
SkeletonNotifications.propTypes = {};
