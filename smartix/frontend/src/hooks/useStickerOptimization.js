import { useCallback, useEffect } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';
import { stickerCache } from '../utils/stickerCache';

/**
 * 🚀 STICKER OPTIMIZATION HOOK
 * Ensures stickers don't slow down the editor
 */
export const useStickerOptimization = (elements, isEnabled = true) => {
  // Monitor performance
  useEffect(() => {
    if (!isEnabled) return;

    performanceMonitor.startFrame();
    performanceMonitor.endFrame(elements.length);
    performanceMonitor.checkMemory();

    const report = performanceMonitor.getReport();
    if (!report.healthy) {
      console.warn('⚠️ Performance degradation detected:', report);
    }
  }, [elements.length, isEnabled]);

  // Cleanup when too many stickers
  const cleanupIfNeeded = useCallback(() => {
    if (elements.length > 50) {
      console.warn('⚠️ Too many elements, performance may suffer');
      stickerCache.clear();
    }
  }, [elements.length]);

  return {
    isOptimized: performanceMonitor.getReport().healthy,
    elementCount: elements.length,
    cacheStats: {
      memoryUsage: performanceMonitor.metrics.memoryUsage,
      renderTime: performanceMonitor.metrics.renderTime
    },
    cleanup: cleanupIfNeeded
  };
};
