/**
 * Système de notation et commentaires pour templates (version PRO)
 * 
 * Fonctionnalités:
 * - Reviews avec votes
 * - Cache optimisé
 * - Métriques avancées
 * - Anti-spam
 * - Pagination efficace
 */

import { EventEmitter } from 'events'
import { crypto } from '../utils/crypto'

// =============================
// CONFIGURATION
// =============================

const REVIEW_CONFIG = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  MAX_TITLE_LENGTH: 200,
  MAX_COMMENT_LENGTH: 2000,
  MAX_REVIEWS_PER_PAGE: 100,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  VOTE_COOLDOWN: 24 * 60 * 60 * 1000 // 24h
}

// =============================
// CACHE MANAGER
// =============================

class ReviewCache {
  constructor() {
    this.averages = new Map() // templateId -> { value, timestamp }
    this.distributions = new Map() // templateId -> { value, timestamp }
    this.stats = new Map() // templateId -> { value, timestamp }
  }

  getAverage(templateId) {
    const cached = this.averages.get(templateId)
    if (cached && Date.now() - cached.timestamp < REVIEW_CONFIG.CACHE_TTL) {
      return cached.value
    }
    return null
  }

  setAverage(templateId, value) {
    this.averages.set(templateId, { value, timestamp: Date.now() })
  }

  getDistribution(templateId) {
    const cached = this.distributions.get(templateId)
    if (cached && Date.now() - cached.timestamp < REVIEW_CONFIG.CACHE_TTL) {
      return cached.value
    }
    return null
  }

  setDistribution(templateId, value) {
    this.distributions.set(templateId, { value, timestamp: Date.now() })
  }

  getStats(templateId) {
    const cached = this.stats.get(templateId)
    if (cached && Date.now() - cached.timestamp < REVIEW_CONFIG.CACHE_TTL) {
      return cached.value
    }
    return null
  }

  setStats(templateId, value) {
    this.stats.set(templateId, { value, timestamp: Date.now() })
  }

  invalidate(templateId) {
    this.averages.delete(templateId)
    this.distributions.delete(templateId)
    this.stats.delete(templateId)
  }
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class TemplateReview extends EventEmitter {
  constructor() {
    super()

    this.reviews = new Map() // templateId -> [reviews]
    this.reviewIndex = new Map() // reviewId -> review
    this.averageRatings = new Map() // templateId -> average
    this.userReviews = new Map() // userId -> [reviewIds]
    this.reviewVotes = new Map() // reviewId -> Map(userId -> timestamp)
    this.cache = new ReviewCache()
    this.metrics = new Map() // templateId -> métriques
  }

  /**
   * Ajoute une review
   */
  async addReview(userId, templateId, reviewData) {
    this._validateReviewData(reviewData)

    if (this._hasReviewed(userId, templateId)) {
      throw new Error('Vous avez déjà reviewé ce template')
    }

    const review = {
      id: `review_${Date.now()}_${crypto.randomToken(8)}`,
      userId,
      templateId,
      rating: reviewData.rating,
      title: reviewData.title || '',
      comment: reviewData.comment || '',
      pros: reviewData.pros || [],
      cons: reviewData.cons || [],
      verified: reviewData.verified || false,
      helpful: 0,
      notHelpful: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Ajouter aux structures
    this._addToStructures(review)

    // Mettre à jour les métriques
    await this._updateMetrics(templateId)

    // Invalider le cache
    this.cache.invalidate(templateId)

    this.emit('review:added', { review, templateId, userId })

    return review
  }

  /**
   * Met à jour une review
   */
  async updateReview(reviewId, userId, updates) {
    const review = this._findReview(reviewId)

    if (!review) {
      throw new Error('Review non trouvée')
    }

    if (review.userId !== userId) {
      throw new Error('Vous ne pouvez modifier que vos propres reviews')
    }

    // Valider les mises à jour
    if (updates.rating) {
      this._validateRating(updates.rating)
    }

    if (updates.title) {
      this._validateTitle(updates.title)
    }

    if (updates.comment) {
      this._validateComment(updates.comment)
    }

    const allowedFields = ['rating', 'title', 'comment', 'pros', 'cons']

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        review[field] = updates[field]
      }
    }

    review.updatedAt = Date.now()

    // Recalculer les moyennes
    await this._updateAverageRating(review.templateId)

    // Invalider le cache
    this.cache.invalidate(review.templateId)

    this.emit('review:updated', {
      reviewId,
      templateId: review.templateId
    })

    return review
  }

  /**
   * Supprime une review
   */
  async deleteReview(reviewId, userId) {
    const review = this._findReview(reviewId)

    if (!review) {
      throw new Error('Review non trouvée')
    }

    if (review.userId !== userId) {
      throw new Error('Vous ne pouvez supprimer que vos propres reviews')
    }

    // Supprimer des structures
    this._removeFromStructures(review)

    // Mettre à jour les métriques
    await this._updateMetrics(review.templateId)

    // Invalider le cache
    this.cache.invalidate(review.templateId)

    this.emit('review:deleted', {
      reviewId,
      templateId: review.templateId
    })

    return { success: true }
  }

  /**
   * Marque une review comme utile (avec cooldown)
   */
  async markHelpful(reviewId, userId) {
    const review = this._findReview(reviewId)

    if (!review) {
      throw new Error('Review non trouvée')
    }

    // Vérifier si l'utilisateur a déjà voté
    if (this._hasVoted(reviewId, userId)) {
      throw new Error('Vous avez déjà voté pour cette review')
    }

    if (!this.reviewVotes.has(reviewId)) {
      this.reviewVotes.set(reviewId, new Map())
    }

    const voters = this.reviewVotes.get(reviewId)
    voters.set(userId, Date.now())

    review.helpful++

    this.emit('review:helpful', { reviewId, userId })

    return { success: true }
  }

  /**
   * Marque une review comme pas utile
   */
  async markNotHelpful(reviewId, userId) {
    const review = this._findReview(reviewId)

    if (!review) {
      throw new Error('Review non trouvée')
    }

    if (this._hasVoted(reviewId, userId)) {
      throw new Error('Vous avez déjà voté pour cette review')
    }

    if (!this.reviewVotes.has(reviewId)) {
      this.reviewVotes.set(reviewId, new Map())
    }

    const voters = this.reviewVotes.get(reviewId)
    voters.set(userId, Date.now())

    review.notHelpful++

    this.emit('review:notHelpful', { reviewId, userId })

    return { success: true }
  }

  /**
   * Récupère les reviews d'un template (avec pagination optimisée)
   */
  getTemplateReviews(templateId, options = {}) {
    const {
      sortBy = 'recent',
      minRating = 1,
      limit = 10,
      offset = 0,
      includeUnverified = false
    } = options

    if (limit > REVIEW_CONFIG.MAX_REVIEWS_PER_PAGE) {
      throw new Error(`Limit maximum: ${REVIEW_CONFIG.MAX_REVIEWS_PER_PAGE}`)
    }

    let reviews = this.reviews.get(templateId) || []

    // Filtre par note minimale
    if (minRating > 1) {
      reviews = reviews.filter(r => r.rating >= minRating)
    }

    // Filtre par vérification
    if (!includeUnverified) {
      reviews = reviews.filter(r => r.verified)
    }

    // Tri optimisé
    switch (sortBy) {
      case 'rating_high':
        reviews.sort((a, b) => b.rating - a.rating)
        break

      case 'rating_low':
        reviews.sort((a, b) => a.rating - b.rating)
        break

      case 'helpful':
        reviews.sort((a, b) => {
          const scoreA = a.helpful - a.notHelpful
          const scoreB = b.helpful - b.notHelpful
          return scoreB - scoreA
        })
        break

      case 'recent':
      default:
        reviews.sort((a, b) => b.createdAt - a.createdAt)
    }

    // Pagination
    const paginated = reviews.slice(offset, offset + limit)

    return {
      reviews: paginated,
      total: reviews.length,
      average: this.getAverageRating(templateId),
      distribution: this.getRatingDistribution(templateId),
      metrics: this.getReviewMetrics(templateId),
      offset,
      limit,
      hasMore: offset + limit < reviews.length
    }
  }

  /**
   * Note moyenne (avec cache)
   */
  getAverageRating(templateId) {
    // Vérifier le cache
    const cached = this.cache.getAverage(templateId)
    if (cached !== null) return cached

    const reviews = this.reviews.get(templateId) || []
    
    if (reviews.length === 0) {
      this.cache.setAverage(templateId, 0)
      return 0
    }

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
    const average = sum / reviews.length
    const rounded = Math.round(average * 10) / 10

    this.cache.setAverage(templateId, rounded)

    return rounded
  }

  /**
   * Distribution des notes (avec cache)
   */
  getRatingDistribution(templateId) {
    // Vérifier le cache
    const cached = this.cache.getDistribution(templateId)
    if (cached !== null) return cached

    const reviews = this.reviews.get(templateId) || []

    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    }

    reviews.forEach(r => {
      distribution[r.rating]++
    })

    this.cache.setDistribution(templateId, distribution)

    return distribution
  }

  /**
   * Métriques avancées (avec cache)
   */
  getReviewMetrics(templateId) {
    // Vérifier le cache
    const cached = this.cache.getStats(templateId)
    if (cached !== null) return cached

    const reviews = this.reviews.get(templateId) || []
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const week = 7 * day
    const month = 30 * day

    const metrics = {
      total: reviews.length,
      verified: reviews.filter(r => r.verified).length,
      unverified: reviews.filter(r => !r.verified).length,
      averageRating: this.getAverageRating(templateId),
      distribution: this.getRatingDistribution(templateId),
      lastDay: reviews.filter(r => r.createdAt > now - day).length,
      lastWeek: reviews.filter(r => r.createdAt > now - week).length,
      lastMonth: reviews.filter(r => r.createdAt > now - month).length,
      helpfulTotal: reviews.reduce((acc, r) => acc + r.helpful, 0),
      notHelpfulTotal: reviews.reduce((acc, r) => acc + r.notHelpful, 0),
      participationRate: this._calculateParticipationRate(templateId)
    }

    this.cache.setStats(templateId, metrics)

    return metrics
  }

  /**
   * Reviews d'un utilisateur
   */
  getUserReviews(userId, options = {}) {
    const { limit = 10, offset = 0 } = options

    const reviewIds = this.userReviews.get(userId) || []
    let reviews = reviewIds
      .map(id => this._findReview(id))
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)

    const paginated = reviews.slice(offset, offset + limit)

    return {
      reviews: paginated,
      total: reviews.length,
      offset,
      limit,
      hasMore: offset + limit < reviews.length
    }
  }

  /**
   * Ajoute aux structures
   * @private
   */
  _addToStructures(review) {
    // Reviews par template
    if (!this.reviews.has(review.templateId)) {
      this.reviews.set(review.templateId, [])
    }
    this.reviews.get(review.templateId).push(review)

    // Index par ID
    this.reviewIndex.set(review.id, review)

    // Reviews par utilisateur
    if (!this.userReviews.has(review.userId)) {
      this.userReviews.set(review.userId, [])
    }
    this.userReviews.get(review.userId).push(review.id)
  }

  /**
   * Supprime des structures
   * @private
   */
  _removeFromStructures(review) {
    // Supprimer des reviews du template
    const reviews = this.reviews.get(review.templateId) || []
    const index = reviews.findIndex(r => r.id === review.id)
    if (index !== -1) reviews.splice(index, 1)

    // Supprimer de l'index
    this.reviewIndex.delete(review.id)

    // Supprimer des reviews utilisateur
    const userReviews = this.userReviews.get(review.userId) || []
    const userIndex = userReviews.indexOf(review.id)
    if (userIndex !== -1) userReviews.splice(userIndex, 1)

    // Supprimer les votes
    this.reviewVotes.delete(review.id)
  }

  /**
   * Met à jour les métriques
   * @private
   */
  async _updateMetrics(templateId) {
    const reviews = this.reviews.get(templateId) || []
    
    const metrics = {
      total: reviews.length,
      verified: reviews.filter(r => r.verified).length,
      unverified: reviews.filter(r => !r.verified).length,
      average: this.getAverageRating(templateId),
      distribution: this.getRatingDistribution(templateId)
    }

    this.metrics.set(templateId, metrics)
    this.emit('metrics:updated', { templateId, metrics })
  }

  /**
   * Calcule le taux de participation
   * @private
   */
  _calculateParticipationRate(templateId) {
    const reviews = this.reviews.get(templateId) || []
    if (reviews.length === 0) return 0

    const voters = new Set()
    reviews.forEach(r => {
      voters.add(r.userId)
      const votes = this.reviewVotes.get(r.id)
      if (votes) {
        votes.forEach((_, userId) => voters.add(userId))
      }
    })

    return voters.size
  }

  /**
   * Vérifie si utilisateur a déjà voté
   * @private
   */
  _hasVoted(reviewId, userId) {
    return this.reviewVotes.get(reviewId)?.has(userId) || false
  }

  /**
   * Vérifie si utilisateur a déjà reviewé
   * @private
   */
  _hasReviewed(userId, templateId) {
    const reviews = this.reviews.get(templateId) || []
    return reviews.some(r => r.userId === userId)
  }

  /**
   * Trouve review rapidement
   * @private
   */
  _findReview(reviewId) {
    return this.reviewIndex.get(reviewId) || null
  }

  /**
   * Validation
   * @private
   */
  _validateReviewData(data) {
    this._validateRating(data.rating)
    
    if (data.title) {
      this._validateTitle(data.title)
    }

    if (data.comment) {
      this._validateComment(data.comment)
    }

    if (data.pros && !Array.isArray(data.pros)) {
      throw new Error('Pros doit être un tableau')
    }

    if (data.cons && !Array.isArray(data.cons)) {
      throw new Error('Cons doit être un tableau')
    }
  }

  _validateRating(rating) {
    if (!rating || rating < REVIEW_CONFIG.MIN_RATING || rating > REVIEW_CONFIG.MAX_RATING) {
      throw new Error(`La note doit être entre ${REVIEW_CONFIG.MIN_RATING} et ${REVIEW_CONFIG.MAX_RATING}`)
    }
  }

  _validateTitle(title) {
    if (title.length > REVIEW_CONFIG.MAX_TITLE_LENGTH) {
      throw new Error(`Titre trop long (max ${REVIEW_CONFIG.MAX_TITLE_LENGTH})`)
    }
  }

  _validateComment(comment) {
    if (comment.length > REVIEW_CONFIG.MAX_COMMENT_LENGTH) {
      throw new Error(`Commentaire trop long (max ${REVIEW_CONFIG.MAX_COMMENT_LENGTH})`)
    }
  }
}

// =============================
// EXPORT
// =============================

export const templateReview = new TemplateReview()
export default templateReview
