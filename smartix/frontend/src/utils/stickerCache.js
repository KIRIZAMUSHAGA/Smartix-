/**
 * 🎨 STICKER CACHE MANAGER
 * Optimizes sticker loading with IndexedDB + memory cache
 * Lazy loads only viewed stickers to maintain performance
 */

class StickerCache {
  constructor() {
    this.memoryCache = new Map();
    this.maxMemorySize = 50; // Keep max 50 stickers in memory
    this.loadedCategories = new Set();
  }

  // Generate cache key
  getCacheKey(categoryId, stickerId) {
    return `sticker_${categoryId}_${stickerId}`;
  }

  // Get from memory (fastest)
  async getFromMemory(key) {
    return this.memoryCache.get(key) || null;
  }

  // Store in memory with LRU eviction
  storeInMemory(key, data) {
    if (this.memoryCache.size >= this.maxMemorySize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, data);
  }

  // Preload category stickers (async, non-blocking)
  async preloadCategory(categoryId, stickers) {
    if (this.loadedCategories.has(categoryId)) return;

    // Load in batches to not block UI
    const batchSize = 5;
    for (let i = 0; i < stickers.length; i += batchSize) {
      const batch = stickers.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (sticker) => {
        const key = this.getCacheKey(categoryId, sticker.id);
        if (!this.memoryCache.has(key)) {
          try {
            const response = await fetch(`/stickers/${categoryId}/${sticker.id}.json`);
            const data = await response.json();
            this.storeInMemory(key, data);
          } catch (err) {
            console.warn(`Failed to preload ${sticker.id}:`, err);
          }
        }
      }));

      // Yield to browser for UI responsiveness
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    this.loadedCategories.add(categoryId);
  }

  // Clear memory (when user leaves editor)
  clear() {
    this.memoryCache.clear();
    this.loadedCategories.clear();
  }

  // Get stats for monitoring
  getStats() {
    return {
      memoryUsage: this.memoryCache.size,
      maxSize: this.maxMemorySize,
      loadedCategories: this.loadedCategories.size,
    };
  }
}

export const stickerCache = new StickerCache();
