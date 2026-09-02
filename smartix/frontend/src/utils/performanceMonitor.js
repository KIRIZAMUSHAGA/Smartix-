/**
 * 📊 PERFORMANCE MONITOR
 * Tracks editor performance and warns if stickers slow down UX
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      elementCount: 0,
      lastCheck: Date.now()
    };
    this.thresholds = {
      maxElements: 50,
      maxMemory: 100 * 1024 * 1024, // 100MB
      minFPS: 30
    };
  }

  startFrame() {
    this.frameStart = performance.now();
  }

  endFrame(elementCount) {
    if (!this.frameStart) return;
    
    const renderTime = performance.now() - this.frameStart;
    this.metrics.renderTime = renderTime;
    this.metrics.elementCount = elementCount;

    // Warn if rendering is slow
    if (renderTime > 16.67) { // 60fps target
      console.warn(`⚠️ Slow render: ${renderTime.toFixed(2)}ms`);
    }
  }

  checkMemory() {
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
      if (this.metrics.memoryUsage > this.thresholds.maxMemory) {
        console.warn('⚠️ High memory usage, consider clearing cache');
      }
    }
  }

  getReport() {
    return {
      ...this.metrics,
      healthy: this.metrics.renderTime < 16.67 && 
               this.metrics.elementCount < this.thresholds.maxElements &&
               this.metrics.memoryUsage < this.thresholds.maxMemory
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
