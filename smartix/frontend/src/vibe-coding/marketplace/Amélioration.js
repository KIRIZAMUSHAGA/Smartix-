/**
 * reviewService - Version finale avec corrections
 * Intégration mobile, analytics, et quality score
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { logger } from '../mobile/utils/logger'
import { sanitizeHtml } from '../mobile/utils/sanitizer'
import { rateLimiter } from '../mobile/utils/rateLimiter'
import { spamDetector } from '../mobile/utils/spamDetector'
import { cache } from '../mobile/utils/cache' // Redis ou autre

// =============================
// INJECTION DE DÉPENDANCES
// =============================
let publishService
let analyticsService
let androidInstaller

export const setPublishService = (service) => {
  publishService = service
}

export const setAnalyticsService = (service) => {
  analyticsService = service
}

export const setAndroidInstaller = (installer) => {
  androidInstaller = installer
  
  // Connexion automatique pour verified reviews
  if (androidInstaller) {
    androidInstaller.on('installed', async (data) => {
      const { reviewId, userId, appId } = data
      if (reviewId) {
        try {
          await getReviewService().markAsVerified(reviewId, userId, appId)
          logger.info('Review auto-verified via install', { reviewId, appId })
        } catch (error) {
          logger.error('Failed to auto-verify review', error)
        }
      }
    })
  }
}

// =============================
// CONSTANTES
// =============================

export const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
  AUTO_REJECTED: 'auto_rejected'
}

export const REVIEW_SORT = {
  RECENT: 'recent',
  HELPFUL: 'helpful',
  RATING: 'rating',
  VERIFIED: 'verified',
  QUALITY: 'quality' // Nouveau tri par qualité
}

const VALIDATION = {
  MAX_TITLE_LENGTH: 100,
  MAX_COMMENT_LENGTH: 2000,
  MAX_PRO_CONS_LENGTH: 200,
  MAX_PRO_CONS_ITEMS: 10,
  MIN_RATING: 1,
  MAX_RATING: 5,
  MIN_REVIEW_INTERVAL: 60 * 1000,
  MAX_REVIEWS_PER_APP_PER_USER: 1,
  COOLDOWN_AFTER_FLAG: 10 * 60 * 1000,
  MAX_DEVELOPER_REPLY_LENGTH: 1000
}

const CACHE = {
  APP_STATS_TTL: 5 * 60 * 1000,
  REVIEWS_LIST_TTL: 60 * 1000
}

// =============================
// QUALITY SCORE CALCULATOR
// =============================

const calculateQualityScore = (review) => {
  let score = 0
  
  // Rating weight (max 10 points)
  score += (review.rating || 3) * 2
  
  // Helpful votes (max 15 points)
  score += Math.min((review.helpful || 0) * 3, 15)
  
  // Verified badge (10 points)
  if (review.verified) {
    score += 10
  }
  
  // Comment length quality (max 5 points)
  if (review.comment) {
    const commentScore = Math.min(review.comment.length / 200, 5)
    score += commentScore
  }
  
  // Pros/Cons quality (max 5 points)
  const prosConsCount = (review.pros?.length || 0) + (review.cons?.length || 0)
  score += Math.min(prosConsCount * 1.5, 5)
  
  // Developer reply (bonus 5 points)
  if (review.developerReply) {
    score += 5
  }
  
  return Math.min(Math.round(score * 10) / 10, 50) // Max 50 points
}

// =============================
// INTERFACE STORAGE
// =============================

export class ReviewStorage {
  constructor(client) {
    this.client = client
    this.cache = new cache.RedisCache() // Utilise Redis en prod
  }

  async saveReview(reviewId, data, transaction = null) {
    const reviewData = {
      ...data,
      _id: reviewId,
      qualityScore: calculateQualityScore(data), // Calcul auto
      updatedAt: new Date().toISOString()
    }

    if (this.client.save) {
      await this.client.save('reviews', reviewData, transaction)
    }

    this._invalidateRelatedCaches(data.appId, data.userId)
    return reviewData
  }

  async getReview(reviewId) {
    if (this.client.get) {
      return await this.client.get('reviews', reviewId)
    }
    return null
  }

  async getAppReviews(appId, filters = {}) {
    const {
      status = REVIEW_STATUS.APPROVED,
      minRating = 1,
      limit = 20,
      offset = 0,
      sortBy = REVIEW_SORT.RECENT
    } = filters

    const cacheKey = `app_reviews:${appId}:${JSON.stringify(filters)}`
    
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached

    if (this.client.query) {
      // ✅ CORRECTION : Support des arrays de status
      const statusCondition = Array.isArray(status) 
        ? { $in: status } 
        : status

      const query = {
        appId,
        status: statusCondition,
        rating: { $gte: minRating }
      }

      const sort = {}
      switch (sortBy) {
        case REVIEW_SORT.HELPFUL:
          sort.helpful = -1
          break
        case REVIEW_SORT.RATING:
          sort.rating = -1
          break
        case REVIEW_SORT.VERIFIED:
          sort.verified = -1
          sort.createdAt = -1
          break
        case REVIEW_SORT.QUALITY:
          sort.qualityScore = -1 // Nouveau tri
          break
        default:
          sort.createdAt = -1
      }

      const result = await this.client.query('reviews', {
        where: query,
        sort,
        limit,
        offset
      })

      await this.cache.set(cacheKey, result, CACHE.REVIEWS_LIST_TTL)
      return result
    }

    return { items: [], total: 0 }
  }

  async getUserReviews(userId, filters = {}) {
    const { limit = 50, offset = 0 } = filters

    if (this.client.query) {
      return await this.client.query('reviews', {
        where: { userId },
        sort: { createdAt: -1 },
        limit,
        offset
      })
    }

    return { items: [], total: 0 }
  }

  async updateReviewVote(reviewId, userId, voteType) {
    if (this.client.update) {
      // ✅ CORRECTION : Protection contre voters undefined
      const update = voteType === 'helpful'
        ? { 
            $inc: { helpful: 1 },
            $addToSet: { voters: userId } // Évite les doublons
          }
        : { 
            $inc: { notHelpful: 1 },
            $addToSet: { voters: userId }
          }

      const updated = await this.client.update('reviews', reviewId, update)
      
      // Recalculer le quality score
      const review = await this.getReview(reviewId)
      if (review) {
        await this.saveReview(reviewId, review)
      }
      
      return updated
    }
    return null
  }

  async addDeveloperReply(reviewId, developerId, comment) {
    if (this.client.update) {
      const reply = {
        comment: sanitizeHtml(comment, {
          allowedTags: ['b', 'i', 'em', 'strong'],
          maxLength: VALIDATION.MAX_DEVELOPER_REPLY_LENGTH
        }),
        developerId,
        repliedAt: new Date().toISOString()
      }

      return await this.client.update('reviews', reviewId, {
        $set: { developerReply: reply }
      })
    }
    return null
  }

  async deleteReview(reviewId) {
    if (this.client.delete) {
      return await this.client.delete('reviews', reviewId)
    }
    return false
  }

  async getAppStats(appId) {
    const cacheKey = `app_stats:${appId}`
    
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached

    if (this.client.aggregate) {
      const stats = await this.client.aggregate('reviews', [
        { $match: { appId, status: REVIEW_STATUS.APPROVED } },
        { $group: {
          _id: '$rating',
          count: { $sum: 1 },
          avgQuality: { $avg: '$qualityScore' }
        }}
      ])

      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      let total = 0
      let sum = 0
      let totalQuality = 0

      stats.forEach(stat => {
        distribution[stat._id] = stat.count
        total += stat.count
        sum += stat._id * stat.count
        totalQuality += stat.avgQuality * stat.count
      })

      const result = {
        total,
        average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
        averageQuality: total > 0 ? Math.round((totalQuality / total) * 10) / 10 : 0,
        distribution
      }

      await this.cache.set(cacheKey, result, CACHE.APP_STATS_TTL)
      return result
    }

    return { total: 0, average: 0, averageQuality: 0, distribution: { 1:0, 2:0, 3:0, 4:0, 5:0 } }
  }

  _invalidateRelatedCaches(appId, userId) {
    // Invalidation intelligente avec Redis pattern matching
    if (this.cache.invalidatePattern) {
      this.cache.invalidatePattern(`app_reviews:${appId}:*`)
      this.cache.invalidatePattern(`app_stats:${appId}`)
    }
  }
}

// =============================
// VALIDATION
// =============================

class ReviewValidationError extends Error {
  constructor(message, errors = []) {
    super(message)
    this.name = 'ReviewValidationError'
    this.errors = errors
  }
}

const validateReview = (options) => {
  const errors = []
  const sanitized = { ...options }

  // Rating
  if (!options.rating) {
    errors.push('La note est requise')
  } else if (options.rating < VALIDATION.MIN_RATING || options.rating > VALIDATION.MAX_RATING) {
    errors.push(`La note doit être entre ${VALIDATION.MIN_RATING} et ${VALIDATION.MAX_RATING}`)
  } else {
    sanitized.rating = options.rating
  }

  // Titre
  if (options.title) {
    if (typeof options.title !== 'string') {
      errors.push('Le titre doit être une chaîne')
    } else {
      sanitized.title = sanitizeHtml(options.title.trim(), {
        allowedTags: [],
        maxLength: VALIDATION.MAX_TITLE_LENGTH
      })
    }
  }

  // Commentaire
  if (options.comment) {
    if (typeof options.comment !== 'string') {
      errors.push('Le commentaire doit être une chaîne')
    } else {
      sanitized.comment = sanitizeHtml(options.comment.trim(), {
        allowedTags: ['b', 'i', 'em', 'strong', 'br'],
        allowedAttributes: {},
        maxLength: VALIDATION.MAX_COMMENT_LENGTH
      })
    }
  }

  // Pros/Cons
  ['pros', 'cons'].forEach(field => {
    if (options[field]) {
      if (!Array.isArray(options[field])) {
        errors.push(`${field} doit être un tableau`)
      } else {
        sanitized[field] = options[field]
          .slice(0, VALIDATION.MAX_PRO_CONS_ITEMS)
          .map(item => sanitizeHtml(String(item).trim(), {
            allowedTags: [],
            maxLength: VALIDATION.MAX_PRO_CONS_LENGTH
          }))
          .filter(item => item.length > 0)
      }
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  }
}

// =============================
// SERVICE PRINCIPAL
// =============================

export class ReviewService extends EventEmitter {
  constructor(storage) {
    super()
    this.storage = storage
    this.stats = {
      totalReviews: 0,
      approvedReviews: 0,
      rejectedReviews: 0,
      flaggedReviews: 0,
      spamDetected: 0,
      verifiedReviews: 0
    }
    this.logger = logger.createChild('ReviewService')
    this.moderationQueue = []

    // Auto-connect analytics
    this.on('review:added', async (data) => {
      if (analyticsService) {
        await analyticsService.recordEvent('review_added', {
          appId: data.appId,
          rating: data.rating,
          verified: data.verified
        }).catch(err => this.logger.warn('Analytics failed', err))
      }
    })

    this.on('review:verified', async (data) => {
      if (analyticsService) {
        await analyticsService.recordEvent('review_verified', {
          appId: data.appId,
          reviewId: data.reviewId
        }).catch(err => this.logger.warn('Analytics failed', err))
      }
    })
  }

  /**
   * Ajoute un avis avec modération
   */
  async addReview(appId, userId, options = {}, metadata = {}) {
    // Rate limiting
    if (!rateLimiter.check(userId, 'add_review', VALIDATION.MIN_REVIEW_INTERVAL)) {
      throw new ReviewValidationError('Trop d\'avis. Veuillez patienter.')
    }

    // Validation des données
    const { isValid, errors, sanitized } = validateReview(options)
    if (!isValid) {
      throw new ReviewValidationError('Avis invalide', errors)
    }

    // Vérifier que publishService est disponible
    if (!publishService) {
      throw new Error('PublishService non initialisé')
    }

    // Vérifier que l'app existe
    const app = await publishService.getApp(appId)
    if (!app) {
      throw new ReviewValidationError('Application non trouvée')
    }

    // Vérifier si l'utilisateur a déjà commenté
    const userReviews = await this.storage.getUserReviews(userId, { limit: 100 })
    const existing = userReviews.items.find(r => r.appId === appId)
    
    if (existing) {
      throw new ReviewValidationError('Vous avez déjà commenté cette application')
    }

    // Détection de spam
    const spamScore = await spamDetector.analyze({
      text: sanitized.comment || '',
      title: sanitized.title || '',
      userId,
      appId,
      ip: metadata.ip,
      userAgent: metadata.userAgent
    })

    let status = REVIEW_STATUS.PENDING
    if (spamScore.isSpam) {
      status = REVIEW_STATUS.AUTO_REJECTED
      this.stats.spamDetected++
      this.logger.warn('Spam détecté', { userId, appId, score: spamScore.score })
    }

    const reviewId = `review_${randomUUID()}`
    const now = new Date().toISOString()

    const review = {
      id: reviewId,
      appId,
      userId,
      rating: sanitized.rating,
      title: sanitized.title || null,
      comment: sanitized.comment || null,
      pros: sanitized.pros || [],
      cons: sanitized.cons || [],
      helpful: 0,
      notHelpful: 0,
      voters: [], // ✅ Initialisé à []
      status,
      verified: false,
      developerReply: null,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        spamScore: spamScore.score,
        spamReasons: spamScore.reasons
      }
    }

    // Sauvegarde
    await this.storage.saveReview(reviewId, review)

    // Mise à jour des stats
    this.stats.totalReviews++
    if (status === REVIEW_STATUS.APPROVED) {
      this.stats.approvedReviews++
      await this._updateAppRating(appId)
    } else if (status === REVIEW_STATUS.AUTO_REJECTED) {
      this.stats.rejectedReviews++
    }

    // Ajouter à la file de modération si nécessaire
    if (status === REVIEW_STATUS.PENDING) {
      this.moderationQueue.push({
        reviewId,
        appId,
        userId,
        submittedAt: now,
        spamScore: spamScore.score
      })
    }

    // ✅ CORRECTION : Utiliser sanitized.rating au lieu de rating
    this.emit('review:added', { 
      reviewId, 
      appId, 
      userId, 
      rating: sanitized.rating,
      verified: false,
      status 
    })

    this.logger.info('Avis ajouté', { 
      reviewId, 
      appId, 
      userId, 
      rating: sanitized.rating, // ✅ CORRECTION ICI
      status 
    })

    return {
      ...review,
      metadata: undefined,
      voters: undefined
    }
  }

  /**
   * Vote utile/pas utile
   */
  async voteReview(reviewId, userId, voteType) {
    if (!['helpful', 'notHelpful'].includes(voteType)) {
      throw new Error('Type de vote invalide')
    }

    const review = await this.storage.getReview(reviewId)
    if (!review) {
      throw new Error('Avis non trouvé')
    }

    if (review.userId === userId) {
      throw new Error('Vous ne pouvez pas voter sur votre propre avis')
    }

    // ✅ CORRECTION : Protection contre voters undefined
    const voters = review.voters || []
    if (voters.includes(userId)) {
      throw new Error('Vous avez déjà voté')
    }

    await this.storage.updateReviewVote(reviewId, userId, voteType)

    this.emit('review:vote', { reviewId, userId, voteType })
    return { success: true }
  }

  /**
   * Marque un avis comme vérifié (installation confirmée)
   */
  async markAsVerified(reviewId, userId, appId) {
    const review = await this.storage.getReview(reviewId)
    if (!review) {
      throw new Error('Avis non trouvé')
    }

    if (review.userId !== userId) {
      throw new Error('Seul l\'auteur peut être vérifié')
    }

    if (review.appId !== appId) {
      throw new Error('Application mismatch')
    }

    await this.storage.saveReview(reviewId, {
      ...review,
      verified: true,
      verifiedAt: new Date().toISOString(),
      verifiedVia: 'apk_install'
    })

    this.stats.verifiedReviews++

    this.emit('review:verified', { reviewId, appId, userId })
    this.logger.info('Review verified', { reviewId, appId })

    return { success: true }
  }

  /**
   * Ajoute une réponse du développeur
   */
  async addDeveloperReply(reviewId, developerId, comment) {
    const review = await this.storage.getReview(reviewId)
    if (!review) {
      throw new Error('Avis non trouvé')
    }

    // Vérifier que l'utilisateur est bien le développeur de l'app
    const app = await publishService.getApp(review.appId)
    if (app.userId !== developerId) {
      throw new Error('Seul le développeur peut répondre')
    }

    await this.storage.addDeveloperReply(reviewId, developerId, comment)

    this.emit('review:replied', { reviewId, developerId })
    return { success: true }
  }

  /**
   * Récupère les avis d'une app
   */
  async getAppReviews(appId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      sortBy = REVIEW_SORT.RECENT,
      minRating = 1,
      includeUnapproved = false
    } = options

    // ✅ CORRECTION : Support array de status
    const status = includeUnapproved 
      ? [REVIEW_STATUS.APPROVED, REVIEW_STATUS.PENDING]
      : REVIEW_STATUS.APPROVED

    const result = await this.storage.getAppReviews(appId, {
      status,
      minRating,
      limit,
      offset,
      sortBy
    })

    const stats = await this.storage.getAppStats(appId)

    const reviews = await Promise.all(
      result.items.map(async (review) => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        pros: review.pros,
        cons: review.cons,
        helpful: review.helpful,
        notHelpful: review.notHelpful,
        verified: review.verified,
        qualityScore: review.qualityScore,
        developerReply: review.developerReply,
        createdAt: review.createdAt,
        user: {
          id: review.userId
        },
        ...(includeUnapproved && { status: review.status })
      }))
    )

    return {
      reviews,
      total: result.total,
      offset,
      limit,
      hasMore: offset + limit < result.total,
      stats
    }
  }

  /**
   * Signalement d'un avis
   */
  async flagReview(reviewId, userId, reason) {
    const review = await this.storage.getReview(reviewId)
    if (!review) {
      throw new Error('Avis non trouvé')
    }

    // Rate limiting
    if (!rateLimiter.check(userId, 'flag_review', VALIDATION.COOLDOWN_AFTER_FLAG)) {
      throw new Error('Trop de signalements. Veuillez patienter.')
    }

    const flags = review.flags || []
    
    // ✅ CORRECTION : Empêcher double signalement
    if (flags.some(f => f.userId === userId)) {
      throw new Error('Vous avez déjà signalé cet avis')
    }

    flags.push({
      userId,
      reason,
      flaggedAt: new Date().toISOString()
    })

    // Si assez de signalements uniques, passer en FLAGGED
    let status = review.status
    if (flags.length >= 3) {
      status = REVIEW_STATUS.FLAGGED
      this.stats.flaggedReviews++
    }

    await this.storage.saveReview(reviewId, {
      ...review,
      status,
      flags
    })

    if (status === REVIEW_STATUS.FLAGGED) {
      this.emit('review:auto-flagged', { reviewId, flagsCount: flags.length })
    }

    this.emit('review:flagged', { reviewId, userId, reason })
    return { success: true }
  }

  /**
   * Récupère les meilleurs avis (quality score)
   */
  async getTopReviews(appId, limit = 5) {
    return await this.getAppReviews(appId, {
      limit,
      sortBy: REVIEW_SORT.QUALITY,
      minRating: 4 // Au moins 4 étoiles
    })
  }

  /**
   * Récupère les avis en attente de réponse du développeur
   */
  async getUnrepliedReviews(developerId, limit = 20) {
    // Récupérer toutes les apps du développeur
    const apps = await publishService.getUserApps(developerId)
    const appIds = apps.items.map(a => a.id)

    if (this.client.query) {
      return await this.client.query('reviews', {
        where: {
          appId: { $in: appIds },
          developerReply: null,
          status: REVIEW_STATUS.APPROVED
        },
        sort: { qualityScore: -1 },
        limit
      })
    }

    return { items: [] }
  }

  /**
   * Met à jour la note moyenne
   */
  async _updateAppRating(appId) {
    if (!publishService) return

    const stats = await this.storage.getAppStats(appId)
    
    await publishService.updateAppStats(appId, {
      rating: stats.average,
      reviews: stats.total,
      averageQuality: stats.averageQuality
    })
  }

  /**
   * Récupère les statistiques
   */
  async getStats() {
    return {
      ...this.stats,
      pendingModeration: this.moderationQueue.length,
      verifiedRate: this.stats.totalReviews > 0 
        ? Math.round((this.stats.verifiedReviews / this.stats.totalReviews) * 100) 
        : 0,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }
}

// =============================
// SINGLETON EXPORT
// =============================

let reviewServiceInstance = null

export const initializeReviewService = (storageClient) => {
  if (!reviewServiceInstance) {
    const storage = new ReviewStorage(storageClient)
    reviewServiceInstance = new ReviewService(storage)
  }
  return reviewServiceInstance
}

export const getReviewService = () => {
  if (!reviewServiceInstance) {
    throw new Error('ReviewService non initialisé')
  }
  return reviewServiceInstance
}

export default getReviewService
