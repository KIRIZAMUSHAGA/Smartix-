import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

const PullToRefresh = ({ 
  onRefresh, 
  children, 
  threshold = 80,
  disabled = false,
  className = ''
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNoNewContent, setShowNoNewContent] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return;
    
    const scrollTop = containerRef.current?.scrollTop || window.scrollY;
    if (scrollTop > 5) return;
    
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current || disabled || isRefreshing) return;
    
    const scrollTop = containerRef.current?.scrollTop || window.scrollY;
    if (scrollTop > 5) {
      isDragging.current = false;
      setPullDistance(0);
      return;
    }
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - startY.current) * 0.5);
    
    if (distance > 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, threshold * 1.5));
    }
  }, [disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        const result = await onRefresh();
        
        if (result === 0) {
          setShowNoNewContent(true);
          setTimeout(() => setShowNoNewContent(false), 2000);
        }
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="absolute left-0 right-0 flex justify-center items-center z-50 transition-all duration-200"
          style={{ 
            top: Math.min(pullDistance, threshold) - 50,
            opacity: progress
          }}
        >
          <div 
            className={`w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: isRefreshing ? undefined : `rotate(${rotation}deg)` }}
          >
            <svg 
              className="w-6 h-6 text-purple-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </div>
        </div>
      )}

      {showNoNewContent && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div className="bg-gray-800 dark:bg-gray-700 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
            Pas de nouvelles publications
          </div>
        </div>
      )}

      <div 
        style={{ 
          transform: `translateY(${pullDistance > 0 ? Math.min(pullDistance * 0.3, 30) : 0}px)`,
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};

PullToRefresh.propTypes = {
  onRefresh: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  threshold: PropTypes.any,
  disabled: PropTypes.bool,
  className: PropTypes.any,
};

export default PullToRefresh;
