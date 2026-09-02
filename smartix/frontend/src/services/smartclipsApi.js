import axiosInstance from '../config/axiosConfig';

const API_URL = '/api';

class SmartClipsApi {
  constructor() {
    this.scrapingTriggered = false;
    this.lastFetchTime = 0;
    this.cache = {
      clips: [],
      offset: 0
    };
  }

  async checkOnboardingRequired(userId) {
    try {
      const response = await axiosInstance.get(
        `/smartclips/v2/onboarding-required?user_id=${userId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error checking onboarding:', error);
      return { required: false }; // En cas d'erreur 404 ou autre, on laisse passer pour éviter le blocage
    }
  }

  async getPersonalizedFeed(userId, limit = 20, offset = 0, excludeWatched = false) {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        exclude_watched: excludeWatched.toString()
      });
      
      if (userId) {
        params.append('user_id', userId);
      }

      const response = await axiosInstance.get(
        `/smartclips/v2/feed?${params.toString()}`
      );

      const data = response.data;
      
      if (offset === 0) {
        this.cache.clips = data.clips || [];
      } else {
        this.cache.clips = [...this.cache.clips, ...(data.clips || [])];
      }
      this.cache.offset = data.next_offset || offset;

      return data;
    } catch (error) {
      console.error('Error fetching personalized feed:', error);
      
      const fallbackResponse = await axiosInstance.get(
        `/smartclips?page=1&limit=${limit}`
      );
      return {
        clips: fallbackResponse.data || [],
        offset: 0,
        next_offset: limit,
        has_more: (fallbackResponse.data || []).length === limit,
        count: (fallbackResponse.data || []).length
      };
    }
  }

  async triggerBackgroundScraping(userId) {
    if (this.scrapingTriggered) {
      console.log('Scraping already triggered this session');
      return false;
    }

    try {
      const formData = new FormData();
      if (userId) {
        formData.append('user_id', userId);
      }

      const response = await axiosInstance.post(
        `/smartclips/v2/trigger-scraping`,
        formData
      );

      if (response.data.success) {
        this.scrapingTriggered = true;
        console.log('Background scraping triggered successfully');
      }

      return response.data.success;
    } catch (error) {
      console.error('Error triggering scraping:', error);
      return false;
    }
  }

  async getScrapingStatus() {
    try {
      const response = await axiosInstance.get(`/smartclips/v2/scraping-status`);
      return response.data;
    } catch (error) {
      console.error('Error getting scraping status:', error);
      return { status: 'unknown' };
    }
  }

  async updateProgress(userId, lastWatchedIndex) {
    try {
      await axiosInstance.post(`/smartclips/v2/progress`, {
        user_id: userId,
        last_watched_index: lastWatchedIndex
      });
      return true;
    } catch (error) {
      console.error('Error updating progress:', error);
      return false;
    }
  }

  async getProgress(userId) {
    try {
      const response = await axiosInstance.get(
        `/smartclips/v2/progress?user_id=${userId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting progress:', error);
      return { last_watched_index: 0 };
    }
  }

  async markVideoWatched(userId, videoId) {
    try {
      await axiosInstance.post(`/smartclips/v2/watched`, {
        user_id: userId,
        video_id: videoId
      });
      return true;
    } catch (error) {
      console.error('Error marking video watched:', error);
      return false;
    }
  }

  async getUserStats(userId) {
    try {
      const response = await axiosInstance.get(
        `/smartclips/v2/stats?user_id=${userId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  async setPreferences(userId, favoriteTags) {
    try {
      const response = await axiosInstance.post(`/smartclips/v2/preferences`, {
        user_id: userId,
        favorite_tags: favoriteTags
      });
      return response.data.success;
    } catch (error) {
      console.error('Error setting preferences:', error);
      return false;
    }
  }

  async getPreferences(userId) {
    try {
      const response = await axiosInstance.get(
        `/smartclips/v2/preferences?user_id=${userId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting preferences:', error);
      return { favorite_tags: [] };
    }
  }

  getCachedClips() {
    return this.cache.clips;
  }

  getCachedOffset() {
    return this.cache.offset;
  }

  clearCache() {
    this.cache = { clips: [], offset: 0 };
  }

  resetSession() {
    this.scrapingTriggered = false;
    this.clearCache();
  }
}

const smartClipsApi = new SmartClipsApi();
export default smartClipsApi;
