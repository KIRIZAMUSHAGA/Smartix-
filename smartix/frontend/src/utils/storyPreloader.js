/**
 * 📦 STORY PRELOADER
 * Pré-charge les stories pour une lecture fluide
 */

class StoryPreloader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }

  // Pré-charge une story
  async preloadStory(story) {
    const key = story.id;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (this.loading.has(key)) {
      return this.loading.get(key);
    }

    const promise = this._loadStory(story);
    this.loading.set(key, promise);

    try {
      const result = await promise;
      this.cache.set(key, result);
      return result;
    } finally {
      this.loading.delete(key);
    }
  }

  async _loadStory(story) {
    // Pré-charger l'image
    const imagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = reject;
      img.src = story.backgroundImage;
    });

    // Pré-charger la musique
    let musicPromise = Promise.resolve();
    if (story.music) {
      musicPromise = new Promise((resolve) => {
        const audio = new Audio(story.music.url);
        audio.preload = 'auto';
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => resolve(); // Continue même si erreur
      });
    }

    // Pré-charger les stickers
    const stickerPromises = (story.elements || [])
      .filter(el => el.type === 'sticker')
      .map(el => new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = el.content;
      }));

    await Promise.all([imagePromise, musicPromise, ...stickerPromises]);

    return story;
  }

  // Pré-charger plusieurs stories
  async preloadMultiple(stories) {
    return Promise.all(stories.map(story => this.preloadStory(story)));
  }

  clear() {
    this.cache.clear();
    this.loading.clear();
  }

  getStats() {
    return {
      cached: this.cache.size,
      loading: this.loading.size
    };
  }
}

export const storyPreloader = new StoryPreloader();
