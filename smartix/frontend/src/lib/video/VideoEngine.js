// frontend/src/lib/video/VideoEngine.js
// Singleton VideoEngine — Phase 1 (création seulement, non utilisé par l'app)
// Architecture single-player : une seule balise <video> déplacée dynamiquement.

class VideoEngine {
  constructor() {
    this.video = null;
    this.container = null;
    this.currentSrc = null;
    this.cache = new Map();
    this.listeners = new Map();
    this.preloadQueue = [];
    this.maxCacheSize = 5;
  }

  init() {
    if (this.video) return;
    if (typeof document === 'undefined') return;

    this.video = document.createElement('video');
    this.video.style.position = 'fixed';
    this.video.style.top = '-9999px';
    this.video.style.left = '-9999px';
    this.video.style.width = '1px';
    this.video.style.height = '1px';
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    this.video.preload = 'metadata';
    document.body.appendChild(this.video);

    this._forwardNativeEvents();
    this._setupBufferingEmitter();
  }

  _setupBufferingEmitter() {
    if (!this.video) return;
    this._bufferingTimeout = null;

    this.video.addEventListener('waiting', () => {
      this.emit('buffering', { isBuffering: true });
      if (this._bufferingTimeout) clearTimeout(this._bufferingTimeout);
      this._bufferingTimeout = setTimeout(() => {
        this.emit('buffering', { isBuffering: false, timeout: true });
      }, 5000);
    });

    const clearBuffering = () => {
      if (this._bufferingTimeout) {
        clearTimeout(this._bufferingTimeout);
        this._bufferingTimeout = null;
      }
      this.emit('buffering', { isBuffering: false });
    };

    this.video.addEventListener('canplay', clearBuffering);
    this.video.addEventListener('playing', clearBuffering);
  }

  load(src) {
    if (!this.video || !src) return Promise.reject(new Error('No video or src'));
    return new Promise((resolve, reject) => {
      const onCanPlay = () => {
        this.video.removeEventListener('canplay', onCanPlay);
        this.video.removeEventListener('error', onError);
        resolve();
      };
      const onError = (e) => {
        this.video.removeEventListener('canplay', onCanPlay);
        this.video.removeEventListener('error', onError);
        reject(e);
      };
      this.video.addEventListener('canplay', onCanPlay, { once: true });
      this.video.addEventListener('error', onError, { once: true });

      const cachedUrl = this.cache.get(src);
      this.currentSrc = src;
      this.video.src = cachedUrl || src;
      this.video.load();
    });
  }

  async loadWithRetry(src, maxRetries = 3) {
    let lastErr;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.load(src);
        return;
      } catch (err) {
        lastErr = err;
        this.emit('retry', { attempt: i + 1, maxRetries, src });
        if (i === maxRetries - 1) break;
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    this.emit('loadFailed', { src, err: lastErr });
    throw lastErr;
  }

  transitionTo(src, onComplete) {
    if (!this.video) return;
    if (!this.video.src || this.currentSrc === null) {
      this.load(src).then(() => {
        const p = this.video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        if (typeof onComplete === 'function') onComplete();
      }).catch(() => {});
      return;
    }
    this.video.style.transition = 'opacity 0.15s ease';
    this.video.style.opacity = '0';
    setTimeout(() => {
      this.load(src).then(() => {
        const p = this.video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        setTimeout(() => {
          this.video.style.opacity = '1';
          if (typeof onComplete === 'function') onComplete();
        }, 50);
      }).catch(() => {
        this.video.style.opacity = '1';
      });
    }, 150);
  }

  _forwardNativeEvents() {
    if (!this.video) return;
    const events = [
      'play', 'pause', 'playing', 'waiting', 'ended',
      'timeupdate', 'loadedmetadata', 'error', 'canplay', 'stalled'
    ];
    events.forEach((evt) => {
      this.video.addEventListener(evt, (e) => {
        this.emit(evt, { event: e, video: this.video });
      });
    });
  }

  attach(containerEl, src, options = {}) {
    if (!this.video) this.init();
    if (!this.video || !containerEl) return;

    if (this.container === containerEl && this.currentSrc === src) {
      if (options.autoplay) this.play();
      return;
    }

    this.container = containerEl;

    if (this.video.parentNode !== containerEl) {
      containerEl.appendChild(this.video);
    }

    this.video.style.position = 'absolute';
    this.video.style.top = '0';
    this.video.style.left = '0';
    this.video.style.width = '100%';
    this.video.style.height = '100%';
    this.video.style.objectFit = options.objectFit || 'cover';

    if (this.currentSrc !== src) {
      this.currentSrc = src;
      const cachedUrl = this.cache.get(src);
      const finalSrc = cachedUrl || src;
      this.video.src = finalSrc;
      this.video.load();
    }

    if (options.muted !== undefined) this.video.muted = options.muted;
    this.video.loop = !!options.loop;

    if (options.autoplay) {
      const p = this.video.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => this.emit('autoplayBlocked', { src, err }));
      }
    }

    this.emit('attached', { src, container: containerEl });
  }

  detach() {
    if (!this.video) return;
    this.video.pause();
    this.video.style.position = 'fixed';
    this.video.style.top = '-9999px';
    this.video.style.left = '-9999px';
    this.video.style.width = '1px';
    this.video.style.height = '1px';

    if (typeof document !== 'undefined' && this.video.parentNode !== document.body) {
      document.body.appendChild(this.video);
    }
    this.container = null;
    this.emit('detached', {});
  }

  preload(src) {
    if (!src) return;
    if (this.cache.has(src)) return;

    while (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      const oldestUrl = this.cache.get(oldestKey);
      if (oldestUrl && oldestUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(oldestUrl); } catch (_) {}
      }
      this.cache.delete(oldestKey);
    }

    this.preloadQueue.push(src);

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Preload HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        this.cache.set(src, url);
        this.preloadQueue = this.preloadQueue.filter((s) => s !== src);
        this.emit('preloadComplete', { src, url });
      })
      .catch((err) => {
        this.preloadQueue = this.preloadQueue.filter((s) => s !== src);
        this.emit('preloadError', { src, err });
      });
  }

  play() {
    if (!this.video) return Promise.resolve();
    const p = this.video.play();
    return p || Promise.resolve();
  }

  pause() {
    if (this.video) this.video.pause();
  }

  setMuted(muted) {
    if (this.video) this.video.muted = !!muted;
  }

  seek(time) {
    if (this.video && Number.isFinite(time)) this.video.currentTime = time;
  }

  getCurrentTime() {
    return this.video ? this.video.currentTime : 0;
  }

  getDuration() {
    return this.video ? this.video.duration : 0;
  }

  isPaused() {
    return this.video ? this.video.paused : true;
  }

  on(event, callback) {
    if (typeof callback !== 'function') return () => {};
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const arr = this.listeners.get(event).filter((cb) => cb !== callback);
    if (arr.length === 0) this.listeners.delete(event);
    else this.listeners.set(event, arr);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach((cb) => {
      try { cb(data); } catch (e) { /* swallow */ }
    });
  }

  destroy() {
    if (this.video) {
      try {
        this.video.pause();
        this.video.src = '';
        this.video.load();
        this.video.remove();
      } catch (_) {}
    }
    this.cache.forEach((url) => {
      if (url && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch (_) {}
      }
    });
    this.cache.clear();
    this.listeners.clear();
    this.preloadQueue = [];
    this.video = null;
    this.container = null;
    this.currentSrc = null;
  }
}

export const videoEngine = new VideoEngine();
export default videoEngine;
