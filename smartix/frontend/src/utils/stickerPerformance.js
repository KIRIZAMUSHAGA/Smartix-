/**
 * ⚡ STICKER PERFORMANCE UTILS
 * Optimized sticker loading with parallel requests
 */

class StickerPerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  // Parallel load multiple stickers
  async loadStickersParallel(stickers) {
    const promises = stickers.map(sticker =>
      this.loadSticker(sticker)
    );
    return Promise.all(promises);
  }

  // Load single sticker with caching
  async loadSticker(sticker) {
    const key = `${sticker.category}_${sticker.id}`;
    
    // Return from cache if available
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Return pending request if already loading
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Load new
    const promise = Promise.all([
      fetch(`/stickers/${sticker.category}/${sticker.id}.svg`).then(r => r.text()),
      fetch(`/stickers/${sticker.category}/${sticker.id}.json`).then(r => r.json())
    ]).then(([svg, meta]) => ({
      id: sticker.id,
      category: sticker.category,
      svg,
      meta
    }));

    this.pendingRequests.set(key, promise);
    
    try {
      const result = await promise;
      this.cache.set(key, result);
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  // Batch preload with throttling
  async preloadBatch(stickers, batchSize = 5) {
    for (let i = 0; i < stickers.length; i += batchSize) {
      const batch = stickers.slice(i, i + batchSize);
      await this.loadStickersParallel(batch);
      // Yield to browser
      await new Promise(r => setTimeout(r, 0));
    }
  }

  clear() {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  getStats() {
    return {
      cached: this.cache.size,
      pending: this.pendingRequests.size
    };
  }
}

export const stickerPerformance = new StickerPerformanceOptimizer();
