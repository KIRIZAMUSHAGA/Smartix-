/**
 * publishService - Service de publication d'applications marketplace
 * Stub: à implémenter côté backend
 */
let instance = null;

class PublishService {
  constructor() {
    this.publishedApps = [];
  }
  async publish(appData) {
    console.warn('[publishService] publish() not yet implemented', appData);
    return null;
  }
  async unpublish(appId) {
    console.warn('[publishService] unpublish() not yet implemented', appId);
    return false;
  }
  async getPublished(userId) {
    return [];
  }
}

export const getPublishService = () => {
  if (!instance) instance = new PublishService();
  return instance;
};

export default getPublishService;
