// constants/defaultSettings.js

// =============================
// 1️⃣ CONFIGURATION DES SECTIONS (version finale)
// =============================
export const SECTIONS = [
  { 
    id: 'appearance', 
    labelKey: 'settings.sections.appearance', 
    icon: 'Palette',
    order: 10,
    group: 'general'
  },
  { 
    id: 'language', 
    labelKey: 'settings.sections.language', 
    icon: 'Languages',
    order: 20,
    group: 'general',
    badge: 'language',
    badgeType: 'neutral'
  },
  { 
    id: 'notifications', 
    labelKey: 'settings.sections.notifications', 
    icon: 'Bell',
    order: 30,
    group: 'general',
    badge: 'notifications',
    badgeType: 'danger'
  },
  { 
    id: 'content', 
    labelKey: 'settings.sections.content', 
    icon: 'Layout',
    order: 40,
    group: 'general'
  },
  { 
    id: 'performance', 
    labelKey: 'settings.sections.performance', 
    icon: 'Gauge',
    order: 50,
    group: 'advanced'
  },
  { 
    id: 'accessibility', 
    labelKey: 'settings.sections.accessibility', 
    icon: 'Accessibility',
    order: 60,
    group: 'advanced'
  },
  // Sections premium
  {
    id: 'premium',
    icon: 'Star',
    labelKey: 'settings.sections.premium',
    descriptionKey: 'settings.sections.premiumDesc',
    order: 5,
    group: 'general',
    premium: true,
    badge: 'premium',
    badgeType: 'premium'
  },
  // Sections admin
  {
    id: 'admin',
    icon: 'Shield',
    labelKey: 'settings.sections.admin',
    descriptionKey: 'settings.sections.adminDesc',
    order: 100,
    group: 'advanced',
    roles: ['admin', 'superadmin'],
    badge: null
  }
];

// =============================
// 2️⃣ CONFIGURATION DES SOUS-SECTIONS
// =============================
export const SUB_SECTIONS = [
  { 
    id: 'feed', 
    icon: 'Layout',
    labelKey: 'settings.content.feed',
    descriptionKey: 'settings.content.feedDesc'
  },
  { 
    id: 'interests', 
    icon: 'TrendingUp',
    labelKey: 'settings.content.interests',
    descriptionKey: 'settings.content.interestsDesc'
  },
  { 
    id: 'favorites', 
    icon: 'Star',
    labelKey: 'settings.content.favorites',
    descriptionKey: 'settings.content.favoritesDesc'
  },
  { 
    id: 'filtering', 
    icon: 'Filter',
    labelKey: 'settings.content.filtering',
    descriptionKey: 'settings.content.filteringDesc'
  },
  { 
    id: 'hidden', 
    icon: 'Eye',
    labelKey: 'settings.content.hidden',
    descriptionKey: 'settings.content.hiddenDesc'
  },
  { 
    id: 'ai_prefs', 
    icon: 'Brain',
    labelKey: 'settings.content.aiPrefs',
    descriptionKey: 'settings.content.aiPrefsDesc'
  },
  { 
    id: 'study', 
    icon: 'GraduationCap',
    labelKey: 'settings.content.study',
    descriptionKey: 'settings.content.studyDesc'
  }
];

// =============================
// 3️⃣ VALEURS PAR DÉFAUT
// =============================
export const DEFAULT_SETTINGS = {
  // Apparence
  fontSize: 'normal',
  animationsEnabled: true,
  
  // Langue & région
  language: 'fr',
  region: 'ci',
  
  // Notifications
  notifications: {
    posts: true,
    messages: true,
    likes: false,
    system: true
  },
  
  // Contenu
  content: {
    premiumPriority: true,
    autoPlayVideos: false,
    quality: 'auto'
  },
  
  // Performance
  performance: {
    dataSaver: false,
    preloadImages: true,
    cacheSize: 'auto'
  },
  
  // Accessibilité
  accessibility: {
    highContrast: false,
    readableText: false,
    reduceMotion: false,
    screenReaderOptimized: false
  },
  
  // Fil d'actualité
  feed: {
    order: 'relevance',
    showEducational: true,
    showPremium: true,
    showFollowing: true,
    hideRepetitive: false,
    hideSeen: false
  },
  
  // Centres d'intérêt
  interests: [
    { id: 'compta', label: 'Comptabilité générale', selected: true },
    { id: 'ohada', label: 'OHADA', selected: true },
    { id: 'exercices', label: 'Exercices corrigés', selected: false },
    { id: 'astuces', label: 'Astuces & méthodologie', selected: false },
    { id: 'commu', label: 'Discussions communautaires', selected: false },
    { id: 'programmation', label: 'Programmation', selected: false },
    { id: 'intelligence', label: 'Intelligence Artificielle', selected: false },
    { id: 'science', label: 'Sciences', selected: false },
    { id: 'langues', label: 'Langues', selected: false }
  ],
  
  // Favoris
  fav: {
    priorityFavs: true,
    similarNotifs: false,
    autoSync: true,
    favoritesFeed: false
  },
  
  // Filtrage
  filter: {
    filterLang: true,
    hideOffTopic: true,
    strictMode: false,
    matureContent: false
  },
  
  // IA
  ai: {
    aiSuggestions: true,
    aiExplanations: true,
    aiPersonalization: false,
    aiVoiceAssistant: false,
    difficulty: 'intermediate'
  },
  
  // Mode étude
  study: {
    studyMode: false,
    hideNonEdu: true,
    priorityExercises: true,
    focusMode: false,
    blockNotifications: false
  },
  
  // Contenu masqué
  hidden: {
    posts: [],
    authors: [],
    themes: []
  },
  
  // Métadonnées
  isDirty: false,
  lastSaved: null,
  version: '2.0.0'
};

// =============================
// 4️⃣ EXPORTS POUR COMPATIBILITÉ
// =============================
export const getDefaultSettings = () => ({ ...DEFAULT_SETTINGS });

export const resetToDefault = () => ({ ...DEFAULT_SETTINGS });

export default DEFAULT_SETTINGS;
