/**
 * Performance monitoring utilities for production
 * Tracks Core Web Vitals and music tool metrics
 */

export const reportWebVitals = (metric) => {
  if (process.env.NODE_ENV === 'production') {
    console.log(`⚡ ${metric.name}: ${Math.round(metric.value)}${metric.unit === 'millisecond' ? 'ms' : ''}`);
    // Send to analytics service here
  }
};

export const trackMusicLoad = (musicId, loadTime) => {
  if (process.env.NODE_ENV === 'production') {
    console.log(`🎵 Music loaded (ID: ${musicId}) in ${loadTime}ms`);
  }
};

export const trackAudioPlayback = (startTime, endTime) => {
  const duration = endTime - startTime;
  if (process.env.NODE_ENV === 'production') {
    console.log(`▶️ Playback duration: ${duration}ms`);
  }
};

export const trackMemoryUsage = () => {
  if (performance.memory && process.env.NODE_ENV === 'production') {
    const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
    const limit = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
    console.log(`📊 Memory: ${used}MB / ${limit}MB`);
  }
};
