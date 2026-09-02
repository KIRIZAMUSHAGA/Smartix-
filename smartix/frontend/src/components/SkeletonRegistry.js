/**
 * 🎨 SMARTOHADA SKELETON SYSTEM - REGISTRY COMPLET
 * Système 5-couches conforme au design system officiel
 * 
 * COULEURS OFFICIELLES:
 * Light: skeleton=#e6e6e6, card=#ffffff, shimmer=rgba(255,255,255,0.14)
 * Dark:  skeleton=#2a2a2a, card=#1e1e1e, shimmer=rgba(255,255,255,0.09)
 */

export const SKELETON_PAGES = {
  // ===================== ACCUEIL & EXPLORATION =====================
  
  'HOME': {
    components: ['SkeletonHeroSection', 'SkeletonStatsGrid', 'SkeletonRecommendations'],
    duration: 2500,
    description: 'Page d\'accueil avec hero, stats, recommandations'
  },

  'FEED': {
    components: ['SkeletonStoriesCarousel', 'SkeletonComposer', 'SkeletonFeed'],
    duration: 2000,
    description: 'Feed communauté avec stories, composer, posts'
  },

  'EXPLORE': {
    components: ['SkeletonSearchBar', 'SkeletonGridCards'],
    duration: 2000,
    description: 'Page explorer avec résultats'
  },

  // ===================== PROFILS =====================

  'PROFILE_HEADER': {
    components: ['SkeletonProfileHeader', 'SkeletonProfileTabs'],
    duration: 1500,
    description: 'En-tête profil + onglets'
  },

  'PROFILE_CONTENT': {
    components: ['SkeletonFeed'],
    duration: 2000,
    description: 'Contenu profil (posts/stories)'
  },

  // ===================== STORIES =====================

  'STORIES_LIST': {
    components: ['SkeletonStoriesCarousel'],
    duration: 1500,
    description: 'Liste stories'
  },

  'STORY_VIEWER': {
    components: ['SkeletonStoryViewer'],
    duration: 1000,
    description: 'Viewer story fullscreen'
  },

  // ===================== IA =====================

  'AI_CHAT': {
    components: ['SkeletonAIChat'],
    duration: 1500,
    description: 'Chat IA Mushaga'
  },

  // ===================== COURSES =====================

  'COURSES_GRID': {
    components: ['SkeletonCourseCard'],
    duration: 2000,
    description: 'Grille de cours'
  },

  'COURSE_DETAIL': {
    components: ['SkeletonCourseDetail'],
    duration: 1500,
    description: 'Détails cours'
  },

  // ===================== GROUPES =====================

  'GROUPS_LIST': {
    components: ['SkeletonGroupItem'],
    duration: 2000,
    description: 'Liste groupes'
  },

  'GROUP_FEED': {
    components: ['SkeletonFeed'],
    duration: 2000,
    description: 'Feed groupe'
  },

  // ===================== MESSAGES =====================

  'CONVERSATIONS': {
    components: ['SkeletonChatListItem'],
    duration: 1500,
    description: 'Liste conversations'
  },

  'CHAT': {
    components: ['SkeletonMessageBubble'],
    duration: 1000,
    description: 'Messages individuels'
  },

  // ===================== NOTIFICATIONS =====================

  'NOTIFICATIONS': {
    components: ['SkeletonNotificationItem'],
    duration: 2000,
    description: 'Liste notifications'
  },

  // ===================== SEARCH =====================

  'SEARCH_RESULTS': {
    components: ['SkeletonSearchUser', 'SkeletonSearchPost'],
    duration: 1500,
    description: 'Résultats recherche'
  },

  // ===================== AUTRES =====================

  'SMARTIX_STORE': {
    components: ['SkeletonCourseCard'],
    duration: 2000,
    description: 'Store boutique'
  },

  'REWARDS': {
    components: ['SkeletonRewardCard'],
    duration: 2000,
    description: 'Centre récompenses'
  }
};

export const SKELETON_COLORS = {
  light: {
    skeleton: '#e6e6e6',
    card: '#ffffff',
    shimmer: 'rgba(255, 255, 255, 0.14)'
  },
  dark: {
    skeleton: '#2a2a2a',
    card: '#1e1e1e',
    shimmer: 'rgba(255, 255, 255, 0.09)'
  }
};

export const SKELETON_ANIMATION = `
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
  
  .skeleton-shimmer {
    animation: shimmer 2s infinite;
    background-size: 1000px 100%;
  }
`;

/**
 * Helper pour obtenir la config skeleton d'une page
 */
export const getSkeletonConfig = (pageName) => {
  return SKELETON_PAGES[pageName] || null;
};

/**
 * Helper pour obtenir les couleurs
 */
export const getSkeletonColors = (darkMode = false) => {
  return darkMode ? SKELETON_COLORS.dark : SKELETON_COLORS.light;
};
