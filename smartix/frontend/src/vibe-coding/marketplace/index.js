/**
 * Module Marketplace pour Vibe-Coding
 * Version ULTIME - Fusion de ta structure avec les optimisations PRO
 * 
 * Gère :
 * - Templates (achat, vente, notation) ← TA STRUCTURE
 * - Applications (publication, fork, recherche) ← MA STRUCTURE
 * - Paiements et avis
 * - Cache et performance
 */

// =============================
// EXPORTS DE TA STRUCTURE (préservés)
// =============================

import { templateMarketplace } from './templateMarketplace';
import { templateReview } from './templateReview';
import { templatePayment } from './templatePayment';

export { templateMarketplace, templateReview, templatePayment };

// =============================
// IMPORTS DYNAMIQUES (ma structure)
// =============================

let publishModule
let forkModule
let reviewModule
let trendingModule
let searchModule
let servicesCache = null
let initializing = null

async function loadModules() {
  if (!publishModule) {
    const [
      publishSvc,
      forkSvc,
      reviewSvc,
      trendingSvc,
      searchSvc
    ] = await Promise.all([
      import('../../marketplace/publishService'),
      import('./forkService'),
      import('./reviewService'),
      import('./trendingService'),
      import('./searchService')
    ])

    const { initializePublishService, getPublishService, setAnalyticsService, setNotificationService, PUBLISH_STATUS, VISIBILITY, CATEGORIES } = publishSvc
    const { initializeForkService, getForkService, setPublishService: setForkPublishService, setAnalyticsService: setForkAnalytics } = forkSvc
    const { initializeReviewService, getReviewService, setPublishService: setReviewPublishService, REVIEW_STATUS } = reviewSvc
    const { initializeTrendingService, getTrendingService, setPublishService: setTrendingPublishService, setAnalyticsService: setTrendingAnalytics, setReviewService: setTrendingReview } = trendingSvc
    const { initializeSearchService, getSearchService, setPublishService: setSearchPublishService, setTrendingService: setSearchTrending, setUserService: setSearchUser, setProjectService: setSearchProject, setEmbeddingService: setSearchEmbedding, SORT_OPTIONS } = searchSvc

    publishModule = {
      initialize: initializePublishService,
      get: getPublishService,
      setAnalytics: setAnalyticsService,
      setNotification: setNotificationService,
      constants: { PUBLISH_STATUS, VISIBILITY, CATEGORIES }
    }

    forkModule = {
      initialize: initializeForkService,
      get: getForkService,
      setPublish: setForkPublishService,
      setAnalytics: setForkAnalytics
    }

    reviewModule = {
      initialize: initializeReviewService,
      get: getReviewService,
      setPublish: setReviewPublishService,
      constants: { REVIEW_STATUS }
    }

    trendingModule = {
      initialize: initializeTrendingService,
      get: getTrendingService,
      setPublish: setTrendingPublishService,
      setAnalytics: setTrendingAnalytics,
      setReview: setTrendingReview
    }

    searchModule = {
      initialize: initializeSearchService,
      get: getSearchService,
      setPublish: setSearchPublishService,
      setTrending: setSearchTrending,
      setUser: setSearchUser,
      setProject: setSearchProject,
      setEmbedding: setSearchEmbedding,
      constants: { SORT_OPTIONS }
    }
  }

  return { publishModule, forkModule, reviewModule, trendingModule, searchModule }
}

// =============================
// CONSTANTES FUSIONNÉES
// =============================

export const MARKETPLACE_VERSION = '2.0.0' // Version fusionnée

// Tes constantes + mes constantes
export const MARKETPLACE_CONFIG = {
  // Templates (TA STRUCTURE)
  TEMPLATE_CATEGORIES: [
    'web',
    'mobile',
    'desktop',
    'api',
    'database',
    'ui',
    'game',
    'other'
  ],
  
  // Applications (MA STRUCTURE)
  PUBLISH_STATUS: {
    DRAFT: 'draft',
    BUILDING: 'building',
    UPLOADING: 'uploading',
    PUBLISHED: 'published',
    FAILED: 'failed'
  },
  VISIBILITY: {
    PUBLIC: 'public',
    PRIVATE: 'private',
    UNLISTED: 'unlisted'
  },
  REVIEW_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    FLAGGED: 'flagged',
    AUTO_REJECTED: 'auto_rejected'
  },
  SORT_OPTIONS: {
    RELEVANCE: 'relevance',
    DOWNLOADS: 'downloads',
    RATING: 'rating',
    NEWEST: 'newest',
    UPDATED: 'updated',
    NAME: 'name',
    TRENDING: 'trending',
    HYBRID: 'hybrid'
  },
  APP_CATEGORIES: [
    'general', 'games', 'productivity', 'education', 'entertainment',
    'utilities', 'business', 'social', 'health', 'finance',
    'travel', 'sports', 'music', 'photo', 'news',
    'books', 'shopping', 'food', 'maps', 'weather'
  ]
}

// Exports individuels des constantes
export const PUBLISH_STATUS = MARKETPLACE_CONFIG.PUBLISH_STATUS
export const VISIBILITY = MARKETPLACE_CONFIG.VISIBILITY
export const REVIEW_STATUS = MARKETPLACE_CONFIG.REVIEW_STATUS
export const SORT_OPTIONS = MARKETPLACE_CONFIG.SORT_OPTIONS
export const APP_CATEGORIES = MARKETPLACE_CONFIG.APP_CATEGORIES
export const TEMPLATE_CATEGORIES = MARKETPLACE_CONFIG.TEMPLATE_CATEGORIES

// =============================
// EVENT BUS CENTRAL
// =============================

import { EventEmitter } from 'events'
export const marketplaceEvents = new EventEmitter()
marketplaceEvents.setMaxListeners(50)

// =============================
// INITIALISATION CENTRALISÉE
// =============================

/**
 * Initialise le module marketplace complet
 * Supporte à la fois les templates et les applications
 */
export async function initializeMarketplace(config = {}) {
  if (initializing) {
    return initializing
  }

  const {
    storageClient,
    analyticsService,
    notificationService,
    userService,
    projectService,
    embeddingService
  } = config

  console.log('🚀 Initialisation du module marketplace...')

  initializing = (async () => {
    try {
      if (!storageClient) {
        throw new Error('storageClient requis')
      }

      const modules = await loadModules()

      // 1. Initialiser publishService
      modules.publishModule.initialize(storageClient)
      if (analyticsService) modules.publishModule.setAnalytics(analyticsService)
      if (notificationService) modules.publishModule.setNotification(notificationService)

      const publishService = modules.publishModule.get()

      // 2. Initialiser forkService
      modules.forkModule.initialize(storageClient)
      modules.forkModule.setPublish(publishService)
      if (analyticsService) modules.forkModule.setAnalytics(analyticsService)

      // 3. Initialiser reviewService
      modules.reviewModule.initialize(storageClient)
      modules.reviewModule.setPublish(publishService)

      // 4. Initialiser trendingService
      modules.trendingModule.initialize()
      modules.trendingModule.setPublish(publishService)
      if (analyticsService) modules.trendingModule.setAnalytics(analyticsService)
      if (modules.reviewModule.get()) {
        modules.trendingModule.setReview(modules.reviewModule.get())
      }

      const trendingService = modules.trendingModule.get()

      // 5. Initialiser searchService
      modules.searchModule.initialize()
      modules.searchModule.setPublish(publishService)
      modules.searchModule.setTrending(trendingService)
      if (userService) modules.searchModule.setUser(userService)
      if (projectService) modules.searchModule.setProject(projectService)
      if (embeddingService) modules.searchModule.setEmbedding(embeddingService)

      // Cache des services
      servicesCache = {
        publish: publishService,
        fork: modules.forkModule.get(),
        review: modules.reviewModule.get(),
        trending: trendingService,
        search: modules.searchModule.get()
      }

      // Préchargement
      await trendingService.updateTrending().catch(() => {})

      marketplaceEvents.emit('marketplace:initialized', {
        version: MARKETPLACE_VERSION,
        timestamp: Date.now()
      })

      console.log('✅ Module marketplace initialisé')
      
      return { success: true, version: MARKETPLACE_VERSION }

    } catch (error) {
      console.error('❌ Échec initialisation:', error)
      return { success: false, error: error.message }
    } finally {
      initializing = null
    }
  })()

  return initializing
}

/**
 * Vérifie si le module est initialisé
 */
export async function isInitialized() {
  try {
    if (servicesCache) return true
    const modules = await loadModules()
    modules.publishModule.get()
    return true
  } catch {
    return false
  }
}

/**
 * Arrêt du module
 */
export async function shutdownMarketplace() {
  console.log('🛑 Arrêt du module marketplace...')

  try {
    if (servicesCache) {
      await Promise.allSettled([
        servicesCache.trending?.clearCache?.(),
        servicesCache.search?.cleanup?.(),
        servicesCache.publish?.cleanupStaleForks?.()
      ])
      servicesCache = null
    }

    marketplaceEvents.emit('marketplace:shutdown', {
      timestamp: Date.now()
    })

    console.log('✅ Module marketplace arrêté')
    return { success: true }

  } catch (error) {
    console.error('❌ Erreur arrêt:', error)
    return { success: false, error: error.message }
  }
}

// =============================
// WRAPPERS SÉCURISÉS
// =============================

async function withService(serviceName, operation, ...args) {
  try {
    if (servicesCache?.[serviceName]) {
      return await operation(servicesCache[serviceName], ...args)
    }

    const modules = await loadModules()
    
    let service
    switch (serviceName) {
      case 'publish': service = modules.publishModule.get(); break
      case 'fork': service = modules.forkModule.get(); break
      case 'review': service = modules.reviewModule.get(); break
      case 'trending': service = modules.trendingModule.get(); break
      case 'search': service = modules.searchModule.get(); break
      default: throw new Error(`Service inconnu: ${serviceName}`)
    }

    if (!service) throw new Error(`Service ${serviceName} non initialisé`)
    
    if (servicesCache) servicesCache[serviceName] = service
    
    return await operation(service, ...args)
  } catch (error) {
    console.error(`Erreur ${serviceName}:`, error)
    throw error
  }
}

// =============================
// API APPLICATIONS (ma structure)
// =============================

/**
 * Recherche des applications
 */
export async function searchApps(query, options = {}) {
  return withService('search', (s) => s.search(query, options))
}

/**
 * Suggestions de recherche
 */
export async function getSearchSuggestions(partial) {
  return withService('search', (s) => s.getSuggestions(partial))
}

/**
 * Recherches populaires
 */
export async function getPopularSearches(limit = 10) {
  return withService('search', (s) => s.getPopularSearches(limit))
}

/**
 * Applications tendances
 */
export async function getTrendingApps(options = {}) {
  return withService('trending', (s) => s.getTrending(options))
}

/**
 * Recommandations personnalisées
 */
export async function getRecommendations(userId, options = {}) {
  if (!userId) return getTrendingApps({ limit: options.limit || 10 })
  return withService('trending', (s) => s.getRecommendations(userId, options))
}

/**
 * Applications similaires
 */
export async function getSimilarApps(appId, limit = 10) {
  return withService('trending', (s) => s.getSimilarApps(appId, limit))
}

/**
 * Publier une application
 */
export async function publishApp(projectId, userId, options = {}) {
  const result = await withService('publish', (s) => 
    s.publishApp(projectId, userId, options)
  )
  marketplaceEvents.emit('app:published', {
    appId: result.appId,
    projectId,
    userId
  })
  return result
}

/**
 * Récupérer une application
 */
export async function getApp(appId) {
  return withService('publish', (s) => s.getApp(appId))
}

/**
 * Lister les applications
 */
export async function listApps(filters = {}) {
  return withService('publish', (s) => s.listApps(filters))
}

/**
 * Dépublier une application
 */
export async function unpublishApp(appId, userId) {
  const result = await withService('publish', (s) => s.unpublishApp(appId, userId))
  marketplaceEvents.emit('app:unpublished', { appId, userId })
  return result
}

/**
 * Enregistrer un téléchargement
 */
export async function recordDownload(appId, userId = null) {
  const result = await withService('publish', (s) => s.recordDownload(appId, userId))
  marketplaceEvents.emit('app:downloaded', { appId, userId })
  return result
}

/**
 * Fork une application
 */
export async function forkApp(originalAppId, userId, options = {}) {
  const result = await withService('fork', (s) => 
    s.forkApp(originalAppId, userId, options)
  )
  marketplaceEvents.emit('app:forked', {
    forkId: result.forkId,
    originalAppId,
    newAppId: result.newApp?.id,
    userId
  })
  return result
}

/**
 * Récupérer les forks d'une app
 */
export async function getAppForks(appId, options = {}) {
  return withService('fork', (s) => s.getForksOfApp(appId, options))
}

/**
 * Récupérer les forks d'un utilisateur
 */
export async function getUserForks(userId, options = {}) {
  return withService('fork', (s) => s.getForksByUser(userId, options))
}

/**
 * Généalogie d'une application
 */
export async function getAppGenealogy(appId) {
  return withService('fork', (s) => s.getAppGenealogy(appId))
}

/**
 * Ajouter un avis
 */
export async function addReview(appId, userId, options = {}) {
  const result = await withService('review', (s) => 
    s.addReview(appId, userId, options)
  )
  marketplaceEvents.emit('review:added', {
    reviewId: result.id,
    appId,
    userId,
    rating: result.rating
  })
  return result
}

/**
 * Récupérer les avis d'une app
 */
export async function getAppReviews(appId, options = {}) {
  return withService('review', (s) => s.getAppReviews(appId, options))
}

/**
 * Récupérer les avis d'un utilisateur
 */
export async function getUserReviews(userId, options = {}) {
  return withService('review', (s) => s.getUserReviews(userId, options))
}

/**
 * Marquer un avis utile
 */
export async function markReviewHelpful(reviewId, userId) {
  return withService('review', (s) => s.markHelpful(reviewId, userId))
}

/**
 * Signaler un avis
 */
export async function flagReview(reviewId, userId, reason) {
  return withService('review', (s) => s.flagReview(reviewId, userId, reason))
}

/**
 * Répondre à un avis
 */
export async function replyToReview(reviewId, developerId, comment) {
  return withService('review', (s) => s.addDeveloperReply(reviewId, developerId, comment))
}

// =============================
// STATISTIQUES GLOBALES
// =============================

/**
 * Statistiques du marketplace (templates + apps)
 */
export async function getMarketplaceStats() {
  try {
    if (!servicesCache) {
      return {
        version: MARKETPLACE_VERSION,
        initialized: false,
        timestamp: Date.now()
      }
    }

    const [publishStats, reviewStats, trendingStats, searchStats] = await Promise.allSettled([
      servicesCache.publish?.getStats?.(),
      servicesCache.review?.getStats?.(),
      servicesCache.trending?.getStats?.(),
      servicesCache.search?.getStats?.()
    ])

    // Ici tu peux ajouter les stats des templates
    // const templateStats = await getTemplateStats() // À implémenter si besoin

    return {
      version: MARKETPLACE_VERSION,
      initialized: true,
      uptime: process.uptime(),
      apps: {
        publish: publishStats.status === 'fulfilled' ? publishStats.value : null,
        reviews: reviewStats.status === 'fulfilled' ? reviewStats.value : null,
        trending: trendingStats.status === 'fulfilled' ? trendingStats.value : null,
        search: searchStats.status === 'fulfilled' ? searchStats.value : null
      },
      // templates: templateStats, // Décommente si tu veux
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('Erreur stats:', error)
    return {
      version: MARKETPLACE_VERSION,
      initialized: false,
      error: error.message,
      timestamp: Date.now()
    }
  }
}

// =============================
// EXPORT PAR DÉFAUT FUSIONNÉ
// =============================

export default {
  // Version
  version: MARKETPLACE_VERSION,
  
  // TA STRUCTURE (préservée)
  templateMarketplace,
  templateReview,
  templatePayment,
  
  // MA STRUCTURE (ajoutée)
  // Services
  getPublishService: async () => servicesCache?.publish || (await loadModules()).publishModule.get(),
  getForkService: async () => servicesCache?.fork || (await loadModules()).forkModule.get(),
  getReviewService: async () => servicesCache?.review || (await loadModules()).reviewModule.get(),
  getTrendingService: async () => servicesCache?.trending || (await loadModules()).trendingModule.get(),
  getSearchService: async () => servicesCache?.search || (await loadModules()).searchModule.get(),
  
  // Event Bus
  events: marketplaceEvents,
  
  // Initialisation
  initialize: initializeMarketplace,
  shutdown: shutdownMarketplace,
  isInitialized,
  
  // API Apps
  search: searchApps,
  suggestions: getSearchSuggestions,
  popularSearches: getPopularSearches,
  trending: getTrendingApps,
  recommendations: getRecommendations,
  similar: getSimilarApps,
  publish: publishApp,
  getApp,
  list: listApps,
  unpublish: unpublishApp,
  recordDownload,
  fork: forkApp,
  getForks: getAppForks,
  getUserForks,
  genealogy: getAppGenealogy,
  addReview,
  getReviews: getAppReviews,
  getUserReviews,
  helpful: markReviewHelpful,
  flag: flagReview,
  reply: replyToReview,
  
  // Statistiques
  stats: getMarketplaceStats,
  
  // Constantes fusionnées
  constants: MARKETPLACE_CONFIG,
  PUBLISH_STATUS,
  VISIBILITY,
  REVIEW_STATUS,
  SORT_OPTIONS,
  APP_CATEGORIES,
  TEMPLATE_CATEGORIES
      }
