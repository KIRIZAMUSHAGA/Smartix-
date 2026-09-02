class ImagePreloaderService {
  constructor(options = {}) {
    this.cache = new Map();          // LRU cache
    this.loading = new Map();        // url -> { promise, controller }
    this.failedCache = new Map();    // url -> timestamp
    
    this.maxCacheSize = options.maxCacheSize || 150;
    this.defaultTimeout = options.timeout || 10000;
    this.defaultConcurrency = options.concurrency || 6;
    this.errorTTL = 30000; // 30s anti-retry spam
    this.debug = options.debug || false;

    this.activeLoads = 0;
    this.queueHigh = [];
    this.queueLow = [];

    this.stats = {
      loaded: 0,
      failed: 0,
      cacheHits: 0,
      totalRequests: 0,
      timeouts: 0,
      canceled: 0
    };
  }

  /* ==========================
     LOGGING
  ========================== */

  _log(message, data) {
    if (this.debug) {
      console.log(`🖼️ ${message}`, data !== undefined ? data : '');
    }
  }

  /* ==========================
     LRU TOUCH
  ========================== */

  touch(url) {
    if (this.cache.has(url)) {
      const value = this.cache.get(url);
      this.cache.delete(url);
      this.cache.set(url, value);
      return value;
    }
    return null;
  }

  evictIfNeeded() {
    while (this.cache.size > this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this._log('Evicted from cache', oldestKey);
    }
  }

  /* ==========================
     CORE LOAD
  ========================== */

  preloadImage(url, priority = 'low') {
    if (!url || typeof url !== 'string') {
      return Promise.resolve(null);
    }

    this.stats.totalRequests++;

    // Cache hit
    if (this.cache.has(url)) {
      this.stats.cacheHits++;
      this.touch(url);
      this._log('Cache hit', url);
      return Promise.resolve(url);
    }

    // Error cache check
    const failedAt = this.failedCache.get(url);
    if (failedAt && Date.now() - failedAt < this.errorTTL) {
      this._log('Skipping failed URL (within TTL)', url);
      return Promise.resolve(null);
    }

    // Already loading
    if (this.loading.has(url)) {
      this._log('Already loading', url);
      return this.loading.get(url).promise;
    }

    const task = () => this._loadImage(url);

    if (priority === 'high') {
      this.queueHigh.push(task);
    } else {
      this.queueLow.push(task);
    }

    this.processQueue();
    return this.loading.get(url)?.promise || Promise.resolve(null);
  }

  async _loadImage(url) {
    const controller = new AbortController();
    const signal = controller.signal;

    const promise = new Promise((resolve) => {
      const img = new Image();
      let resolved = false;

      // Timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          controller.abort();
          this.stats.timeouts++;
          this.loading.delete(url);
          this.failedCache.set(url, Date.now());
          this._log('Timeout', url);
          resolve(null);
        }
      }, this.defaultTimeout);

      // Succès
      img.onload = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.cache.set(url, true);
          this.touch(url);
          this.evictIfNeeded();
          this.loading.delete(url);
          this.stats.loaded++;
          this._log('Loaded', url);
          resolve(url);
        }
      };

      // Erreur
      img.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.loading.delete(url);
          this.failedCache.set(url, Date.now());
          this.stats.failed++;
          this._log('Failed', url);
          resolve(null);
        }
      };

      // Annulation via AbortController
      signal.addEventListener('abort', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.loading.delete(url);
          this.stats.canceled++;
          this._log('Canceled', url);
          resolve(null);
        }
      });

      img.src = url;
    });

    this.loading.set(url, { promise, controller });
    this.activeLoads++;

    promise.finally(() => {
      this.activeLoads--;
      this.processQueue();
    });

    return promise;
  }

  /* ==========================
     QUEUE SYSTEM
  ========================== */

  processQueue() {
    while (
      this.activeLoads < this.defaultConcurrency &&
      (this.queueHigh.length > 0 || this.queueLow.length > 0)
    ) {
      const task =
        this.queueHigh.shift() || this.queueLow.shift();

      this._log('Processing task', {
        activeLoads: this.activeLoads,
        queueHigh: this.queueHigh.length,
        queueLow: this.queueLow.length
      });

      task();
    }
  }

  /* ==========================
     MULTIPLE LOAD
  ========================== */

  preloadMultiple(urls, priority = 'low') {
    if (!Array.isArray(urls)) return Promise.resolve([]);

    // Déduplication avec Set
    const validUrls = [...new Set(urls.filter(Boolean))];

    this._log(`Preloading ${validUrls.length} images (${priority} priority)`);

    return Promise.all(
      validUrls.map(url => this.preloadImage(url, priority))
    );
  }

  preloadVisibleImages(elements) {
    if (!elements) return;

    const urls = Array.from(elements)
      .map(img => img.src || img.dataset?.src)
      .filter(Boolean);

    this._log(`Preloading ${urls.length} visible images`);
    return this.preloadMultiple(urls, 'high');
  }

  preloadBackground(urls) {
    return this.preloadMultiple(urls, 'low');
  }

  preloadPostImages(posts) {
    const urls = new Set();
    
    posts.forEach(post => {
      if (!post) return;
      if (post.user?.avatar) urls.add(post.user.avatar);
      if (post.image) urls.add(post.image);
      if (post.background_image) urls.add(post.background_image);
      if (post.media_url) urls.add(post.media_url);
      if (post.thumbnail) urls.add(post.thumbnail);
    });

    return this.preloadBackground(Array.from(urls));
  }

  preloadNewsImages(newsItems) {
    const urls = newsItems
      .filter(item => item && item.image_url)
      .map(item => item.image_url);

    return this.preloadBackground(urls);
  }

  preloadStoryImages(stories) {
    const urls = new Set();
    
    stories.forEach(story => {
      if (!story) return;
      if (story.user?.avatar) urls.add(story.user.avatar);
      if (story.thumbnail) urls.add(story.thumbnail);
      if (story.media_url) urls.add(story.media_url);
      if (story.background) urls.add(story.background);
    });

    return this.preloadBackground(Array.from(urls));
  }

  /* ==========================
     CONTROL
  ========================== */

  cancel(url) {
    const entry = this.loading.get(url);
    if (entry) {
      entry.controller.abort();
      this.loading.delete(url);
      this._log('Manually canceled', url);
    }
  }

  cancelAll() {
    this.loading.forEach(entry => entry.controller.abort());
    this.loading.clear();
    this.queueHigh = [];
    this.queueLow = [];
    this.activeLoads = 0;
    this._log('All requests canceled');
  }

  clearCache() {
    this.cache.clear();
    this.loading.forEach(entry => entry.controller.abort());
    this.loading.clear();
    this.failedCache.clear();
    this.queueHigh = [];
    this.queueLow = [];
    this.activeLoads = 0;
    this._log('Cache cleared');
  }

  /* ==========================
     UTILS
  ========================== */

  isImageCached(url) {
    return this.cache.has(url);
  }

  isImageLoading(url) {
    return this.loading.has(url);
  }

  getStats() {
    const hitRate =
      this.stats.totalRequests > 0
        ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(2)
        : 0;

    return {
      ...this.stats,
      cacheSize: this.cache.size,
      failedCacheSize: this.failedCache.size,
      loadingCount: this.loading.size,
      queueHigh: this.queueHigh.length,
      queueLow: this.queueLow.length,
      activeLoads: this.activeLoads,
      cacheHitRate: `${hitRate}%`
    };
  }

  /* ==========================
     MONITORING
  ========================== */

  emitStats() {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('imagePreloaderStats', { 
        detail: this.getStats() 
      });
      window.dispatchEvent(event);
    }
  }
}

// Créer l'instance unique
export const imagePreloader = new ImagePreloaderService();
export { ImagePreloaderService };

// Exposer en dev
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.imagePreloader = imagePreloader;
  window.imagePreloaderStats = () => console.table(imagePreloader.getStats());
}

export default imagePreloader;
