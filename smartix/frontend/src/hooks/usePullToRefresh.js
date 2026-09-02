import { useState, useEffect, useRef, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

export const usePullToRefresh = (onRefresh, options = {}) => {
  const { threshold = 80, maxPull = 150, disabled = false } = options;

  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isOnline = useOnlineStatus();

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 5) return;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!isDraggingRef.current || disabled || isRefreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 5) {
      isDraggingRef.current = false;
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const distance = (currentY - startYRef.current) * 0.5;
    if (distance > 0) {
      setIsPulling(true);
      setPullDistance(Math.min(distance, maxPull));
    }
  }, [disabled, isRefreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const reachedThreshold = pullDistance >= threshold;
    setIsPulling(false);
    setPullDistance(0);

    if (!reachedThreshold || isRefreshing) return;

    if (!isOnline) {
      setShowOfflineMessage(true);
      return;
    }

    try {
      setIsRefreshing(true);
      await onRefresh?.();
    } catch (err) {
      console.error('Pull-to-refresh error:', err);
      if (!navigator.onLine) {
        setShowOfflineMessage(true);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [pullDistance, threshold, isRefreshing, isOnline, onRefresh]);

  useEffect(() => {
    if (disabled) return undefined;
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const hideOfflineMessage = useCallback(() => setShowOfflineMessage(false), []);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    showOfflineMessage,
    hideOfflineMessage,
    isOnline,
  };
};

export default usePullToRefresh;
