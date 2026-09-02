/**
 * 🎬 STORY RANKING ALGORITHM - Facebook Style
 * Agrégation, filtrage et classement intelligent des stories
 */

class StoryRankingEngine {
  constructor() {
    this.userInteractions = new Map(); // Track user view history
  }

  // 1️⃣ AGRÉGATION: Récupère les stories valides (< 24h)
  aggregateStories(allStories) {
    const now = Date.now();
    const STORY_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

    return allStories.filter(story => {
      const createdAt = new Date(story.createdAt).getTime();
      const age = now - createdAt;
      return age < STORY_EXPIRATION;
    });
  }

  // 2️⃣ GROUPER par utilisateur (1 bulle = multiple stories)
  groupByUser(stories) {
    const grouped = new Map();

    stories.forEach(story => {
      const userId = story.userId || story.id;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          userName: story.userName || 'Unknown',
          userAvatar: story.userAvatar,
          stories: [],
          isViewed: false,
          lastViewTime: null
        });
      }
      grouped.get(userId).stories.push(story);
    });

    return Array.from(grouped.values());
  }

  // 3️⃣ RANKING: Classement basé sur plusieurs critères
  rankStories(userGroups, userProfile = {}) {
    return userGroups.sort((a, b) => {
      const scoreA = this.calculateScore(a, userProfile);
      const scoreB = this.calculateScore(b, userProfile);
      return scoreB - scoreA;
    });
  }

  calculateScore(userGroup, userProfile) {
    let score = 0;

    // Facteur 1: Fraîcheur (plus récent = score plus haut)
    const newestStory = userGroup.stories[userGroup.stories.length - 1];
    const age = Date.now() - new Date(newestStory.createdAt).getTime();
    const freshnessScore = Math.max(0, 100 - (age / (24 * 60 * 60 * 1000) * 100));
    score += freshnessScore * 0.3; // 30% de poids

    // Facteur 2: Affinité sociale (amis proches = score plus haut)
    const isFriend = userProfile.friends?.includes(userGroup.userId);
    const isCloseFreind = userProfile.closeFriends?.includes(userGroup.userId);
    score += isCloseFreind ? 50 : (isFriend ? 30 : 10); // 10-50 points

    // Facteur 3: Historique de visionnage
    const viewHistory = this.userInteractions.get(userGroup.userId) || { views: 0, skips: 0 };
    const engagementRatio = viewHistory.views / (viewHistory.views + viewHistory.skips + 1);
    score += engagementRatio * 40; // 0-40 points

    // Facteur 4: Stories non vues (priorité)
    if (!userGroup.isViewed) {
      score += 25; // Bonus pour stories non vues
    }

    // Facteur 5: Poids du créateur (pages populaires)
    const creatorWeight = userGroup.stories[0].creatorWeight || 1;
    score *= creatorWeight;

    return score;
  }

  // Tracker les interactions
  trackView(userId) {
    if (!this.userInteractions.has(userId)) {
      this.userInteractions.set(userId, { views: 0, skips: 0 });
    }
    this.userInteractions.get(userId).views++;
  }

  trackSkip(userId) {
    if (!this.userInteractions.has(userId)) {
      this.userInteractions.set(userId, { views: 0, skips: 0 });
    }
    this.userInteractions.get(userId).skips++;
  }

  // Marquer comme vu
  markAsViewed(userGroup) {
    userGroup.isViewed = true;
    userGroup.lastViewTime = Date.now();
  }
}

export const storyRanking = new StoryRankingEngine();
