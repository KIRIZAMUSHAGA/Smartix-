/**
 * trendingService - Service de calcul des tendances
 * Version ULTIME avec toutes les optimisations
 * 
 * Rôle: Calculer les applications tendances avec algorithmes avancés
 * - Bayesian rating pour les notes
 * - Install velocity (taux d'installation)
 * - Batch processing pour les requêtes DB
 * - 4 catégories de trending
 * - Intégration mobile complète
 */

import { EventEmitter } from 'events'
import { logger } from '../mobile/utils/logger'
import { cache } from '../mobile/utils/cache'

// =============================
// INJECTION DE DÉPENDANCES
// =============================
let publishService
let reviewService
let analyticsService

export const setPublishService = (service) => {
  publishService = service
}

export const setReviewService = (service) => {
  reviewService = service
}

export const setAnalyticsService = (service) => {
  analyticsService = service
}

// =============================
// CONSTANTES
// =============================

const CATEGORIES = [
  'general', 'games', 'productivity', 'education',
  'entertainment', 'utilities', 'business', 'social'
]

const TRENDING_WINDOW = 7 * 24 * 60 * 60 * 1000 // 7 jours
const TRENDING_UPDATE_INTERVAL = 60 * 60 * 1000 // 1 heure
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000 // 30 minutes
const MAX_CACHE_SIZE = 1000

// ✅ Constantes pour Bayesian rating
const BAYESIAN = {
  MIN_REVIEWS: 5, // Seuil minimum de reviews
  GLOBAL_AVERAGE: 4.0 // Note moyenne globale par défaut
}

// ✅ Poids pour le scoring
const TRENDING_WEIGHTS = {
  views: 0.1,
  downloads: 2.0,
  installs: 3.0,
  rating: 5.0,
  reviews: 2.0,
  forks: 1.5,
  recency: 2.0,
  growth: 1.5,
  installVelocity: 3.0, // Nouveau : vitesse d'installation
  retention: 5.0 // Nouveau : rétention
}

const RECOMMENDATION_WEIGHTS = {
  categoryMatch: 3.0,
  tagMatch: 2.0,
  popularity: 1.5,
  recency: 1.0,
  userHistory: 2.5,
  collaborative: 2.0
}

// =============================
// CACHE MANAGER AMÉLIORÉ
// =============================

class TrendingCache {
  constructor() {
    this.cache = new Map()
    this.stats = { hits: 0, misses: 0 }
    setInterval(() => this.cleanup(), CACHE_CLEANUP_INTERVAL)
  }

  get(key) {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    this.stats.hits++
    return entry.value
  }

  set(key, value) {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this._evictOldest()
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  }

  invalidate(pattern) {
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clear() {
    this.cache.clear()
  }

  cleanup() {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > CACHE_TTL) {
        this.cache.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      logger.debug(`Cache nettoyé: ${removed} entrées supprimées`)
    }
  }

  _evictOldest() {
    let oldestKey = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0
    }
  }
}

// =============================
// SERVICE PRINCIPAL
// =============================

export class TrendingService extends EventEmitter {
  constructor() {
    super()
    this.trendingCache = new TrendingCache()
    this.recommendationCache = new TrendingCache()
    this.lastUpdate = null
    this.stats = {
      totalCalculations: 0,
      averageCalculationTime: 0
    }
    this.logger = logger.createChild('TrendingService')
    this.updateInProgress = false

    // Cache pour les batch requests
    this.appsCache = new Map()
    this.collaborativeMatrix = null

    setInterval(() => this.updateTrending(), TRENDING_UPDATE_INTERVAL)
    this.updateTrending()
  }

  // =============================
  // BATCH PROCESSING
  // =============================

  /**
   * ✅ Récupère plusieurs apps en une seule requête
   */
  async _getAppsBatch(appIds) {
    if (!appIds.length || !publishService) return new Map()

    const uniqueIds = [...new Set(appIds)]
    const result = new Map()
    const missingIds = []

    // Vérifier le cache local
    for (const id of uniqueIds) {
      if (this.appsCache.has(id)) {
        result.set(id, this.appsCache.get(id))
      } else {
        missingIds.push(id)
      }
    }

    // Récupérer les manquantes
    if (missingIds.length > 0 && publishService.getAppsByIds) {
      try {
        const apps = await publishService.getAppsByIds(missingIds)
        for (const app of apps) {
          this.appsCache.set(app.id, app)
          result.set(app.id, app)
        }
      } catch (error) {
        this.logger.error('Erreur batch getApps', error)
      }
    }

    return result
  }

  // =============================
  // BAYESIAN RATING
  // =============================

  /**
   * ✅ Calcule le Bayesian rating
   */
  _calculateBayesianRating(stats, globalAverage = BAYESIAN.GLOBAL_AVERAGE) {
    const v = stats.reviewsCount || 0
    const R = stats.rating || 0
    const m = BAYESIAN.MIN_REVIEWS
    const C = globalAverage

    if (v === 0) return 0
    
    // Formule bayésienne
    return (v / (v + m)) * R + (m / (v + m)) * C
  }

  // =============================
  // INSTALL VELOCITY
  // =============================

  /**
   * ✅ Calcule la vitesse d'installation
   */
  _calculateInstallVelocity(app) {
    const installs = app.stats?.installs || 0
    const createdAt = new Date(app.createdAt || Date.now()).getTime()
    const ageHours = Math.max(1, (Date.now() - createdAt) / (60 * 60 * 1000))
    
    return installs / ageHours
  }

  // =============================
  // RETENTION
  // =============================

  /**
   * ✅ Calcule le score de rétention
   */
  async _calculateRetentionScore(appId) {
    if (!analyticsService) return 0

    try {
      const retention = await analyticsService.getRetention?.(appId, {
        cohortSize: 1,
        followupDays: 7
      })

      if (!retention || retention.length === 0) return 0

      // Moyenne de rétention sur 7 jours
      const cohort = retention[0]
      if (!cohort || !cohort.retention) return 0

      const avgRetention = cohort.retention.reduce((sum, day) => {
        return sum + (day.retentionRate || 0)
      }, 0) / Math.max(1, cohort.retention.length)

      return avgRetention / 100 // Normalisé entre 0 et 1
    } catch {
      return 0
    }
  }

  // =============================
  // SCORING PRINCIPAL
  // =============================

  /**
   * ✅ Calcule le score de tendance (version ultime)
   */
  async _calculateAppScore(app) {
    try {
      const now = Date.now()
      const createdAt = new Date(app.createdAt || now).getTime()
      const age = Math.max(0, now - createdAt)
      
      // Decay exponentiel
      const recency = Math.exp(-age / TRENDING_WINDOW)
      
      const stats = app.stats || {}

      // Bayesian rating
      const bayesianRating = this._calculateBayesianRating(stats)
      
      // Install velocity
      const installVelocity = this._calculateInstallVelocity(app)
      
      // Rétention (async)
      const retentionScore = await this._calculateRetentionScore(app.id)

      // Croissance (via analytics)
      let growth = 0
      if (analyticsService) {
        const yesterday = await analyticsService.aggregateEvents?.(app.id, 'day', new Date(now - 24*60*60*1000))
        const today = await analyticsService.aggregateEvents?.(app.id, 'day', new Date())
        
        const yesterdayTotal = yesterday?.events ? Object.values(yesterday.events).reduce((s, e) => s + e.count, 0) : 0
        const todayTotal = today?.events ? Object.values(today.events).reduce((s, e) => s + e.count, 0) : 0
        
        if (yesterdayTotal > 0) {
          growth = (todayTotal - yesterdayTotal) / yesterdayTotal
        }
      }

      // Score final avec tous les facteurs
      const score = 
        (stats.views || 0) * TRENDING_WEIGHTS.views +
        (stats.downloads || 0) * TRENDING_WEIGHTS.downloads +
        (stats.installs || 0) * TRENDING_WEIGHTS.installs +
        bayesianRating * TRENDING_WEIGHTS.rating * ((stats.reviewsCount || 0) + 1) +
        (stats.forks || 0) * TRENDING_WEIGHTS.forks +
        recency * TRENDING_WEIGHTS.recency +
        growth * TRENDING_WEIGHTS.growth +
        installVelocity * TRENDING_WEIGHTS.installVelocity +
        retentionScore * TRENDING_WEIGHTS.retention

      return Math.max(0, Math.round(score * 100) / 100)

    } catch (error) {
      this.logger.error('Erreur calcul score', { appId: app?.id, error })
      return 0
    }
  }

  // =============================
  // MISE À JOUR TRENDING
  // =============================

  /**
   * ✅ Met à jour les tendances avec les 4 catégories
   */
  async updateTrending() {
    if (this.updateInProgress) {
      this.logger.debug('Mise à jour déjà en cours')
      return
    }

    const startTime = Date.now()
    this.updateInProgress = true

    this.logger.info('Mise à jour des tendances...')

    try {
      if (!publishService) {
        this.updateInProgress = false
        return
      }

      // Récupérer toutes les apps publiques
      const result = await publishService.listApps({
        visibility: 'public',
        limit: 1000
      })

      const apps = result.items || []

      // Calculer les scores en parallèle
      const scoredApps = await Promise.all(
        apps.map(async (app) => ({
          ...app,
          trendingScore: await this._calculateAppScore(app),
          installVelocity: this._calculateInstallVelocity(app)
        }))
      )

      const validApps = scoredApps.filter(app => app.trendingScore > 0)
      const now = Date.now()

      // ✅ 1. TRENDING (score global)
      const trending = validApps
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 100)

      this.trendingCache.set('overall', {
        apps: trending,
        timestamp: now
      })

      // ✅ 2. RISING (plus forte croissance)
      const rising = validApps
        .filter(app => {
          const age = now - new Date(app.createdAt || now).getTime()
          return age < 30 * 24 * 60 * 60 * 1000 // Moins de 30 jours
        })
        .sort((a, b) => {
          const growthA = a.stats?.installs || 0
          const growthB = b.stats?.installs || 0
          return growthB - growthA
        })
        .slice(0, 50)

      this.trendingCache.set('rising', {
        apps: rising,
        timestamp: now
      })

      // ✅ 3. TOP RATED (Bayesian rating)
      const topRated = validApps
        .filter(app => (app.stats?.reviewsCount || 0) >= BAYESIAN.MIN_REVIEWS)
        .map(app => ({
          ...app,
          bayesianRating: this._calculateBayesianRating(app.stats || {})
        }))
        .sort((a, b) => b.bayesianRating - a.bayesianRating)
        .slice(0, 50)

      this.trendingCache.set('topRated', {
        apps: topRated,
        timestamp: now
      })

      // ✅ 4. NEW (moins de 7 jours)
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      const newApps = validApps
        .filter(app => new Date(app.createdAt || now).getTime() > sevenDaysAgo)
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 50)

      this.trendingCache.set('new', {
        apps: newApps,
        timestamp: now
      })

      // ✅ Par catégorie
      const byCategory = {}
      for (const category of CATEGORIES) {
        const categoryApps = validApps
          .filter(app => app.category === category)
          .sort((a, b) => b.trendingScore - a.trendingScore)
          .slice(0, 20)

        if (categoryApps.length > 0) {
          byCategory[category] = {
            apps: categoryApps,
            timestamp: now
          }
        }
      }

      this.trendingCache.set('byCategory', byCategory)

      this.lastUpdate = Date.now()
      const duration = Date.now() - startTime

      this.stats.totalCalculations++
      this.stats.averageCalculationTime = Math.round(
        (this.stats.averageCalculationTime * (this.stats.totalCalculations - 1) + duration) /
        this.stats.totalCalculations
      )

      this.emit('trending:updated', {
        totalApps: apps.length,
        validApps: validApps.length,
        trending: trending.length,
        rising: rising.length,
        topRated: topRated.length,
        new: newApps.length,
        duration
      })

      this.logger.success('Tendances mises à jour', {
        trending: trending.length,
        rising: rising.length,
        topRated: topRated.length,
        new: newApps.length,
        duration: `${duration}ms`
      })

    } catch (error) {
      this.logger.error('Erreur mise à jour tendances', error)
      this.emit('trending:error', { error: error.message })
    } finally {
      this.updateInProgress = false
    }
  }

  /**
   * ✅ Récupère les tendances (avec les 4 catégories)
   */
  async getTrending(options = {}) {
    const {
      type = 'overall', // overall, rising, topRated, new, category
      category = null,
      limit = 20,
      forceRefresh = false
    } = options

    let cacheKey = type
    if (type === 'category' && category) {
      cacheKey = `category:${category}`
    }

    // Vérifier le cache
    if (!forceRefresh) {
      if (type === 'category' && category) {
        const byCategory = this.trendingCache.get('byCategory')
        const cached = byCategory?.[category]
        if (cached) {
          return cached.apps.slice(0, limit)
        }
      } else {
        const cached = this.trendingCache.get(type)
        if (cached) {
          return cached.apps.slice(0, limit)
        }
      }
    }

    // Forcer la mise à jour si nécessaire
    if (!this.updateInProgress) {
      await this.updateTrending()
    }

    // Réessayer le cache
    if (type === 'category' && category) {
      const byCategory = this.trendingCache.get('byCategory')
      return byCategory?.[category]?.apps.slice(0, limit) || []
    } else {
      const cached = this.trendingCache.get(type)
      return cached?.apps.slice(0, limit) || []
    }
  }

  // =============================
  // RECOMMANDATIONS OPTIMISÉES
  // =============================

  /**
   * ✅ Analyse les préférences en BATCH
   */
  async _analyzePreferences(history) {
    const preferences = {
      categories: {},
      tags: {},
      averageRating: 0,
      totalInteractions: 0,
      interactedApps: new Set()
    }

    if (!publishService) return preferences

    // Collecter tous les appIds
    const allAppIds = [
      ...history.downloads,
      ...history.views,
      ...history.ratings.map(r => r.appId),
      ...history.forks
    ]

    // ✅ BATCH GET
    const appsMap = await this._getAppsBatch(allAppIds)

    let totalRating = 0
    let ratingCount = 0

    // Downloads (poids 3)
    for (const appId of history.downloads) {
      const app = appsMap.get(appId)
      if (!app) continue

      preferences.categories[app.category] = (preferences.categories[app.category] || 0) + 3
      ;(app.tags || []).forEach(tag => {
        preferences.tags[tag] = (preferences.tags[tag] || 0) + 3
      })
      preferences.interactedApps.add(appId)
      preferences.totalInteractions++
    }

    // Views (poids 1, sauf déjà compté)
    for (const appId of history.views) {
      if (history.downloads.includes(appId)) continue
      
      const app = appsMap.get(appId)
      if (!app) continue

      preferences.categories[app.category] = (preferences.categories[app.category] || 0) + 1
      ;(app.tags || []).forEach(tag => {
        preferences.tags[tag] = (preferences.tags[tag] || 0) + 1
      })
      preferences.interactedApps.add(appId)
      preferences.totalInteractions++
    }

    // Ratings (poids basé sur la note)
    for (const rating of history.ratings) {
      const app = appsMap.get(rating.appId)
      if (!app) continue

      const weight = rating.rating / 5
      preferences.categories[app.category] = (preferences.categories[app.category] || 0) + weight * 2
      ;(app.tags || []).forEach(tag => {
        preferences.tags[tag] = (preferences.tags[tag] || 0) + weight
      })
      
      totalRating += rating.rating
      ratingCount++
    }

    // Forks (poids 4)
    for (const appId of history.forks) {
      const app = appsMap.get(appId)
      if (!app) continue

      preferences.categories[app.category] = (preferences.categories[app.category] || 0) + 4
      ;(app.tags || []).forEach(tag => {
        preferences.tags[tag] = (preferences.tags[tag] || 0) + 4
      })
    }

    preferences.averageRating = ratingCount > 0 ? totalRating / ratingCount : 0

    return preferences
  }

  /**
   * ✅ Calcule la matrice collaborative (pré-calculée)
   */
  async _buildCollaborativeMatrix() {
    if (!analyticsService) return

    try {
      // Récupérer toutes les interactions utilisateur-app
      const interactions = await analyticsService.getAllUserInteractions?.()
      
      if (!interactions) return

      // Construire la matrice [userId][appId] = score
      const matrix = {}
      
      for (const interaction of interactions) {
        if (!matrix[interaction.userId]) {
          matrix[interaction.userId] = {}
        }
        matrix[interaction.userId][interaction.appId] = interaction.score || 1
      }

      this.collaborativeMatrix = matrix
      this.logger.info('Matrice collaborative construite')
    } catch (error) {
      this.logger.error('Erreur construction matrice collaborative', error)
    }
  }

  /**
   * ✅ Score collaboratif optimisé (pas de boucle)
   */
  async _getCollaborativeScore(appId, userId, history) {
    if (!this.collaborativeMatrix || !userId) return 0

    try {
      const userInteractions = this.collaborativeMatrix[userId]
      if (!userInteractions) return 0

      // Trouver des utilisateurs similaires
      let similarUsers = []
      const userApps = Array.from(history.interactedApps)

      for (const [otherUserId, otherInteractions] of Object.entries(this.collaborativeMatrix)) {
        if (otherUserId === userId) continue

        // Calculer la similarité (intersection)
        let commonApps = 0
        for (const appId of userApps) {
          if (otherInteractions[appId]) commonApps++
        }

        if (commonApps > 0) {
          similarUsers.push({
            userId: otherUserId,
            similarity: commonApps / Math.max(userApps.length, 1)
          })
        }
      }

      // Trier par similarité
      similarUsers.sort((a, b) => b.similarity - a.similarity)
      similarUsers = similarUsers.slice(0, 10)

      // Voir si ces utilisateurs aiment appId
      let totalScore = 0
      for (const similar of similarUsers) {
        const score = this.collaborativeMatrix[similar.userId]?.[appId] || 0
        totalScore += score * similar.similarity
      }

      return totalScore

    } catch (error) {
      this.logger.warn('Erreur collaborative score', error)
      return 0
    }
  }

   /**
   * ✅ Recommandations optimisées
   */
  async getRecommendations(userId, options = {}) {
    const {
      limit = 10,
      excludeIds = [],
      forceRefresh = false
    } = options

    if (!userId) {
      return this.getTrending({ limit })
    }

    const cacheKey = `user:${userId}`

    if (!forceRefresh) {
      const cached = this.recommendationCache.get(cacheKey)
      if (cached) {
        return cached.recommendations
          .filter(rec => !excludeIds.includes(rec.id))
          .slice(0, limit)
      }
    }

    const startTime = Date.now()
    this.logger.info('Calcul des recommandations', { userId })

    try {
      // Construire la matrice collaborative si nécessaire
      if (!this.collaborativeMatrix) {
        await this._buildCollaborativeMatrix()
      }

      // Récupérer l'historique
      const userHistory = await this._getUserHistory(userId)

      // Récupérer les apps populaires
      const trending = await this.getTrending({ limit: 100 })

      // Analyser les préférences (BATCH optimisé)
      const preferences = await this._analyzePreferences(userHistory)

      // Calculer les scores
      const scoredApps = []
      
      for (const app of trending) {
        try {
          if (excludeIds.includes(app.id)) continue

          const score = await this._calculateRecommendationScore(
            app, 
            preferences, 
            userHistory,
            userId
          )
          
          if (score > 0) {
            scoredApps.push({
              ...app,
              recommendationScore: score
            })
          }
        } catch (appError) {
          this.logger.warn('Erreur calcul score pour app', { appId: app.id })
        }
      }

      const recommendations = scoredApps
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit)

      this.recommendationCache.set(cacheKey, {
        recommendations,
        timestamp: Date.now()
      })

      const duration = Date.now() - startTime
      this.logger.success('Recommandations calculées', {
        userId,
        count: recommendations.length,
        duration: `${duration}ms`
      })

      return recommendations

    } catch (error) {
      this.logger.error('Erreur calcul recommandations', error)
      return this.getTrending({ limit })
    }
  }

  /**
   * ✅ Score de recommandation avec collaborative pré-calculé
   */
  async _calculateRecommendationScore(app, preferences, history, userId) {
    let score = 0

    // Catégorie
    const categoryScore = preferences.categories[app.category] || 0
    score += categoryScore * RECOMMENDATION_WEIGHTS.categoryMatch

    // Tags
    const tagScore = (app.tags || []).reduce((sum, tag) => {
      return sum + (preferences.tags[tag] || 0)
    }, 0)
    score += tagScore * RECOMMENDATION_WEIGHTS.tagMatch

    // Popularité
    const popularity = (app.stats?.downloads || 0) + (app.stats?.installs || 0) * 2
    score += Math.log1p(popularity) * RECOMMENDATION_WEIGHTS.popularity

    // Récence
    const createdAt = new Date(app.createdAt || Date.now()).getTime()
    const age = Math.max(0, Date.now() - createdAt)
    const recency = Math.exp(-age / (30 * 24 * 60 * 60 * 1000))
    score += recency * RECOMMENDATION_WEIGHTS.recency

    // Bonus note
    if (app.stats?.rating > 4) {
      score += 10
    }

    // Historique utilisateur
    if (preferences.totalInteractions > 0) {
      score *= (1 + Math.log1p(preferences.totalInteractions) / 10)
    }

    // ✅ Collaborative (pré-calculé, pas de boucle)
    const collaborativeScore = await this._getCollaborativeScore(app.id, userId, history)
    score += collaborativeScore * RECOMMENDATION_WEIGHTS.collaborative

    return Math.max(0, Math.round(score * 100) / 100)
  }

  /**
   * Récupère l'historique utilisateur
   */
  async _getUserHistory(userId) {
    const history = {
      downloads: [],
      views: [],
      ratings: [],
      forks: []
    }

    if (!analyticsService) return history

    try {
      const userEvents = await analyticsService.getUserEvents?.(userId, {
        limit: 100
      }) || []

      for (const event of userEvents) {
        switch (event.type) {
          case 'download':
            if (event.appId) history.downloads.push(event.appId)
            break
          case 'view':
            if (event.appId) history.views.push(event.appId)
            break
          case 'rating':
            if (event.appId && event.rating) {
              history.ratings.push({
                appId: event.appId,
                rating: event.rating
              })
            }
            break
          case 'fork':
            if (event.appId) history.forks.push(event.appId)
            break
        }
      }
    } catch (error) {
      this.logger.warn('Erreur récupération historique', error)
    }

    return history
  }

  /**
   * Apps similaires
   */
  async getSimilarApps(appId, limit = 10) {
    if (!publishService) return []

    try {
      const targetApp = await publishService.getApp(appId)
      if (!targetApp) return []

      const allApps = await publishService.listApps({
        visibility: 'public',
        limit: 100
      })

      const similar = []
      
      for (const app of allApps.items) {
        if (app.id === appId) continue

        const similarity = this._calculateSimilarity(targetApp, app)
        if (similarity > 0.1) {
          similar.push({
            ...app,
            similarityScore: similarity
          })
        }
      }

      return similar
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit)

    } catch (error) {
      this.logger.error('Erreur getSimilarApps', error)
      return []
    }
  }

  /**
   * Calcule la similarité
   */
  _calculateSimilarity(app1, app2) {
    let score = 0

    if (app1.category === app2.category) {
      score += 0.5
    }

    const tags1 = app1.tags || []
    const tags2 = app2.tags || []
    
    const commonTags = tags1.filter(tag => tags2.includes(tag)).length
    const maxTags = Math.max(tags1.length, tags2.length)
    
    if (maxTags > 0) {
      score += (commonTags / maxTags) * 0.3
    }

    const pop1 = (app1.stats?.downloads || 0) + (app1.stats?.installs || 0)
    const pop2 = (app2.stats?.downloads || 0) + (app2.stats?.installs || 0)
    
    const maxPop = Math.max(pop1, pop2, 1)
    const popDiff = Math.abs(pop1 - pop2) / maxPop
    score += (1 - popDiff) * 0.2

    return Math.round(score * 100) / 100
  }

  /**
   * Nettoie les caches
   */
  clearCache() {
    this.trendingCache.clear()
    this.recommendationCache.clear()
    this.appsCache.clear()
    this.logger.info('Cache des tendances nettoyé')
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const trendingStats = this.trendingCache.getStats()
    const recommendationStats = this.recommendationCache.getStats()

    return {
      ...this.stats,
      cache: {
        trending: trendingStats,
        recommendations: recommendationStats,
        apps: this.appsCache.size
      },
      collaborativeMatrix: this.collaborativeMatrix ? 'built' : 'pending',
      lastUpdate: this.lastUpdate,
      updateInProgress: this.updateInProgress
    }
  }
}

// =============================
// SINGLETON EXPORT
// =============================

let trendingServiceInstance = null

export const initializeTrendingService = () => {
  if (!trendingServiceInstance) {
    trendingServiceInstance = new TrendingService()
  }
  return trendingServiceInstance
}

export const getTrendingService = () => {
  if (!trendingServiceInstance) {
    trendingServiceInstance = new TrendingService()
  }
  return trendingServiceInstance
}

export default getTrendingService
