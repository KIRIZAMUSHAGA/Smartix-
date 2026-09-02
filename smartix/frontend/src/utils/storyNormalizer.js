/**
 * 📐 STORY NORMALIZER - Facebook-Style Data Normalization
 * 
 * Handles BOTH formats:
 * 1. Backend grouped format: { user, stories[], unseen_count }
 * 2. Flat story format: { user: { id }, id, created_at, ... }
 */

/**
 * Normalize stories into display-ready orbits
 * Accepts backend-grouped OR flat story arrays
 */
export const normalizeStoryOrbits = (rawInput = []) => {
  // 🛡️ Defensive: ensure array
  if (!Array.isArray(rawInput)) {
    console.warn('⚠️ normalizeStoryOrbits: input is not an array', rawInput);
    return [];
  }

  if (rawInput.length === 0) {
    return [];
  }

  // 🔍 STEP 1: Detect format - is it backend-grouped or flat stories?
  const firstItem = rawInput[0];
  const isBackendGrouped = firstItem?.stories && Array.isArray(firstItem.stories);

  let orbits;

  if (isBackendGrouped) {
    // ✅ FORMAT 1: Backend already grouped [{user, stories, unseen_count, story_cover_url}]
    console.log('📊 Detected backend-grouped format');
    
    orbits = rawInput.map(group => {
      if (!group?.user?.id) {
        console.warn('⚠️ Skipping group without user.id:', group);
        return null;
      }

      const stories = Array.isArray(group.stories) ? group.stories : [];
      
      // Sort stories DESC by created_at
      stories.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      // Extract thumbnail from LATEST story
      const latestStory = stories[0];
      
      // 🎯 ROBUSTE: Build thumbnail URL via dedicated endpoint
      // Backend will generate & cache thumbnail on-demand
      const storyId = latestStory?.id;
      const thumbnailUrl = storyId 
        ? `/api/stories/${storyId}/thumbnail`
        : null;

      // 🔍 SMART DETECTION: Check for text property OR media_type
      const isTextStory = latestStory?.media_type === 'text' || !!latestStory?.text;

      if (!thumbnailUrl && latestStory) {
        console.warn(
          `⚠️ No thumbnail for user ${group.user.id}. 
          Latest story missing: story_cover_url, backgroundImage, media_url.`,
          latestStory
        );
      }
      
      return {
        userId: group.user.id,
        userName: group.user.full_name || 'Unknown',
        userAvatar: group.user.avatar,
        thumbnailUrl,
        storyCount: stories.length,
        stories,
        hasStories: stories.length > 0,
        isViewed: false,
        isTextStory: isTextStory,
        latestStory: latestStory
      };
    }).filter(Boolean);
  } else {
    // ✅ FORMAT 2: Flat stories [{id, user: {id}, created_at, ...}]
    console.log('📊 Detected flat story format');
    
    // Group by userId
    const grouped = rawInput.reduce((acc, story) => {
      if (!story || !story.user?.id) {
        console.warn('⚠️ Skipping story without user.id:', story);
        return acc;
      }

      const userId = story.user.id;
      if (!acc[userId]) {
        acc[userId] = {
          userId: story.user.id,
          userName: story.user.full_name || 'Unknown',
          userAvatar: story.user.avatar,
          stories: []
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    // Convert to orbits
    orbits = Object.values(grouped).map(group => {
      // Sort stories DESC by createdAt
      group.stories.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const latestStory = group.stories[0];
      const thumbnailUrl = 
        latestStory?.story_cover_url ||
        latestStory?.backgroundImage ||
        latestStory?.media_url ||
        null;

      // 🔍 SMART DETECTION: Check for text property OR media_type
      const isTextStory = latestStory?.media_type === 'text' || !!latestStory?.text;

      if (!thumbnailUrl) {
        console.warn(`⚠️ No thumbnail for user ${group.userId}.`, latestStory);
      }
      
      return {
        userId: group.userId,
        userName: group.userName,
        userAvatar: group.userAvatar,
        thumbnailUrl,
        storyCount: group.stories.length,
        stories: group.stories,
        hasStories: group.stories.length > 0,
        isViewed: false,
        isTextStory: isTextStory,
        latestStory: latestStory
      };
    });
  }

  // 🔄 STEP 2: Sort orbits by newest story date (most recent first)
  orbits.sort((a, b) => {
    const dateA = new Date(a.stories[0]?.created_at || a.stories[0]?.createdAt || 0).getTime();
    const dateB = new Date(b.stories[0]?.created_at || b.stories[0]?.createdAt || 0).getTime();
    return dateB - dateA;
  });

  console.log(`✅ Normalized ${orbits.length} story orbits from ${isBackendGrouped ? 'grouped' : 'flat'} format`);
  return orbits;
};

/**
 * Safe thumbnail extraction for single orbit
 */
export const getOrbitThumbnail = (orbit) => {
  if (!orbit?.stories?.length) return null;
  const latestStory = orbit.stories[0];
  return (
    latestStory?.story_cover_url ||
    latestStory?.backgroundImage ||
    latestStory?.media_url ||
    null
  );
};
