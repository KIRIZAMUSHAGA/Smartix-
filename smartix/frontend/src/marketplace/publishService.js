/**
 * publishService - Service de publication d'applications sur le marketplace
 * 
 * Rôle: Gérer le cycle de vie complet de publication des apps
 * - Build APK via mobile module
 * - Upload vers CDN
 * - Génération QR code
 * - Métadonnées et validation
 * - Persistance des données
 * - Analytics et monitoring
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { apkBuilder } from '../vibe-coding/mobile/utils/apkBuilder'
import { fileUploader } from '../vibe-coding/mobile/utils/fileUploader'
import { qrGenerator } from '../vibe-coding/mobile/services/qrGenerator'
import { urlGenerator } from '../vibe-coding/mobile/utils/urlGenerator'
import { logger } from '../vibe-coding/mobile/utils/logger'
import { cleanupTempFiles } from '../vibe-coding/mobile/utils/fileCleanup'
import { imageValidator } from '../vibe-coding/mobile/utils/imageValidator'
import { rateLimiter } from '../vibe-coding/mobile/utils/rateLimiter'

// =============================
// INJECTION DE DÉPENDANCES
// =============================
let appAnalyticsService
let notificationService

export const setAnalyticsService = (service) => {
  appAnalyticsService = service
}

export const setNotificationService = (service) => {
  notificationService = service
}

// =============================
// CONSTANTES
// =============================

export const PUBLISH_STATUS = {
  DRAFT: 'draft',
  BUILDING: 'building',
  UPLOADING: 'uploading',
  PUBLISHED: 'published',
  FAILED: 'failed'
}

export const VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  UNLISTED: 'unlisted'
}

export const CATEGORIES = [
  'general',
  'games',
  'productivity',
  'education',
  'entertainment',
  'utilities',
  'business',
  'social'
]

const VALIDATION = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_TAGS: 10,
  MAX_TAG_LENGTH: 30,
  MAX_SCREENSHOTS: 8,
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp']
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const PUBLISH_COOLDOWN = 5 * 60 * 1000 // 5 minutes entre publications

// =============================
// VALIDATION
// =============================

class ValidationError extends Error {
  constructor(errors) {
    super('Validation échouée')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

const validatePublishOptions = async (options) => {
  const errors = []
  const sanitized = { ...options }

  // Nom
  if (!options.name?.trim()) {
    errors.push('Le nom est requis')
  } else {
    sanitized.name = options.name.trim().slice(0, VALIDATION.MAX_NAME_LENGTH)
    if (sanitized.name !== options.name) {
      errors.push(`Le nom a été tronqué à ${VALIDATION.MAX_NAME_LENGTH} caractères`)
    }
    // Nettoyage basique XSS
    sanitized.name = sanitized.name.replace(/[<>]/g, '')
  }

  // Description
  if (options.description) {
    sanitized.description = options.description
      .trim()
      .slice(0, VALIDATION.MAX_DESCRIPTION_LENGTH)
    sanitized.description = sanitized.description.replace(/[<>]/g, '')
  }

  // Catégorie
  if (options.category && !CATEGORIES.includes(options.category)) {
    errors.push(`Catégorie invalide. Doit être une de: ${CATEGORIES.join(', ')}`)
  }

  // Tags
  if (options.tags) {
    if (!Array.isArray(options.tags)) {
      errors.push('Les tags doivent être un tableau')
    } else {
      sanitized.tags = options.tags
        .slice(0, VALIDATION.MAX_TAGS)
        .map(tag => tag.trim().slice(0, VALIDATION.MAX_TAG_LENGTH).replace(/[<>]/g, ''))
        .filter(tag => tag.length > 0)
      
      if (sanitized.tags.length === 0) {
        delete sanitized.tags
      }
    }
  }

  // Visibilité
  if (options.visibility && !Object.values(VISIBILITY).includes(options.visibility)) {
    errors.push(`Visibilité invalide. Doit être: ${Object.values(VISIBILITY).join(', ')}`)
  }

  // Version
  if (options.version && !/^\d+\.\d+\.\d+$/.test(options.version)) {
    errors.push('Version doit être au format semver (x.y.z)')
  }

  // Icon & Screenshots
  if (options.icon) {
    try {
      await imageValidator.validate(options.icon, {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: VALIDATION.ALLOWED_IMAGE_TYPES,
        minDimensions: { width: 192, height: 192 }
      })
    } catch (error) {
      errors.push(`Icon invalide: ${error.message}`)
    }
  }

  if (options.screenshotUrls) {
    if (!Array.isArray(options.screenshotUrls)) {
      errors.push('screenshotUrls doit être un tableau')
    } else if (options.screenshotUrls.length > VALIDATION.MAX_SCREENSHOTS) {
      errors.push(`Maximum ${VALIDATION.MAX_SCREENSHOTS} screenshots autorisés`)
    } else {
      // Validation async des URLs (optionnel - peut être lourd)
      // On pourrait valider ici ou laisser le storage le faire
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  }
}

// =============================
// INTERFACE STORAGE
// =============================

export class MarketplaceStorage {
  constructor(client) {
    this.client = client // DB client (MongoDB, PostgreSQL, etc.)
    this.cache = new Map()
  }

  async saveApp(appId, data, transaction = null) {
    const appData = {
      ...data,
      _id: appId,
      updatedAt: new Date().toISOString()
    }

    if (this.client.save) {
      await this.client.save('apps', appData, transaction)
    }

    // Mettre à jour le cache
    this.cache.set(appId, {
      data: appData,
      timestamp: Date.now()
    })

    return appData
  }

  async getApp(appId) {
    // Vérifier le cache
    const cached = this.cache.get(appId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // Récupérer depuis la DB
    let appData = null
    if (this.client.get) {
      appData = await this.client.get('apps', appId)
    }

    if (appData) {
      this.cache.set(appId, {
        data: appData,
        timestamp: Date.now()
      })
    }

    return appData
  }

  async listApps(filters = {}) {
    const {
      category,
      visibility = VISIBILITY.PUBLIC,
      userId,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters

    const query = {}
    
    if (category) query.category = category
    if (visibility) query.visibility = visibility
    if (userId) query.userId = userId

    const sort = {}
    switch (sortBy) {
      case 'downloads':
      case 'rating':
      case 'views':
        sort[`stats.${sortBy}`] = sortOrder === 'desc' ? -1 : 1
        break
      default:
        sort.createdAt = sortOrder === 'desc' ? -1 : 1
    }

    if (this.client.query) {
      return await this.client.query('apps', {
        where: query,
        sort,
        limit,
        offset
      })
    }

    // Fallback en mémoire (dev only)
    return { items: [], total: 0 }
  }

  async updateAppStats(appId, updates) {
    const app = await this.getApp(appId)
    if (!app) return null

    const updatedApp = {
      ...app,
      stats: {
        ...app.stats,
        ...updates
      },
      updatedAt: new Date().toISOString()
    }

    await this.saveApp(appId, updatedApp)
    
    // Invalider le cache
    this.cache.delete(appId)
    
    return updatedApp
  }

  async deleteApp(appId, userId) {
    const app = await this.getApp(appId)
    if (!app) return false
    
    if (app.userId !== userId) {
      throw new Error('Non autorisé à supprimer cette application')
    }

    if (this.client.delete) {
      await this.client.delete('apps', appId)
    }

    this.cache.delete(appId)
    return true
  }

  async beginTransaction() {
    if (this.client.beginTransaction) {
      return await this.client.beginTransaction()
    }
    return null
  }
}

// =============================
// SERVICE PRINCIPAL
// =============================

export class PublishService extends EventEmitter {
  constructor(storage) {
    super()
    this.storage = storage
    this.stats = {
      totalPublished: 0,
      totalDownloads: 0,
      totalInstalls: 0,
      activeApps: 0
    }
    this.logger = logger.createChild('PublishService')
    this.tempFiles = new Set()
    this.publishQueue = new Map() // Suivi des publications en cours
  }

  /**
   * Publie une application
   */
  async publishApp(projectId, userId, options = {}) {
    const startTime = Date.now()
    
    // Rate limiting
    if (!rateLimiter.check(userId, 'publish', PUBLISH_COOLDOWN)) {
      throw new Error('Trop de publications. Veuillez patienter.')
    }

    // Validation
    const { isValid, errors, sanitized } = await validatePublishOptions(options)
    if (!isValid) {
      throw new ValidationError(errors)
    }

    const publishId = randomUUID()
    this.publishQueue.set(publishId, { status: PUBLISH_STATUS.BUILDING, startTime })

    this.logger.info('Début publication', { 
      publishId, 
      projectId, 
      userId, 
      name: sanitized.name 
    })

    let buildResult = null
    let uploadResult = null
    let appId = null

    try {
      this.emit('publish:started', { publishId, projectId, userId })

      // 1. BUILD APK
      this.publishQueue.set(publishId, { status: PUBLISH_STATUS.BUILDING })
      this.emit('publish:building', { publishId, projectId })
      
      buildResult = await apkBuilder.build(projectId, {
        version: sanitized.version,
        buildType: sanitized.buildType || 'release',
        captureScreenshots: true
      })

      if (buildResult.apkPath) {
        this.tempFiles.add(buildResult.apkPath)
      }
      if (buildResult.screenshots) {
        buildResult.screenshots.forEach(path => this.tempFiles.add(path))
      }

      // 2. UPLOAD APK
      this.publishQueue.set(publishId, { status: PUBLISH_STATUS.UPLOADING })
      this.emit('publish:uploading', { publishId, projectId })
      
      uploadResult = await fileUploader.upload(buildResult.apkPath, {
        bucket: 'marketplace-apps',
        maxSize: VALIDATION.MAX_FILE_SIZE,
        metadata: {
          publishId,
          projectId,
          userId,
          version: sanitized.version,
          buildId: buildResult.buildId,
          buildTime: buildResult.duration
        }
      })

      // 3. GÉNÉRATION RESSOURCES
      const downloadUrl = urlGenerator.generateDownloadUrl(uploadResult.fileId, {
        singleUse: false,
        expiresIn: 30 * 24 * 60 * 60 * 1000, // 30 jours
        fileName: `${sanitized.name}-${sanitized.version}.apk`.replace(/[^a-zA-Z0-9.-]/g, '_')
      })

      const qrCode = await qrGenerator.generateInstallQR(downloadUrl.url, {
        size: 300,
        margin: 1,
        errorCorrection: 'M'
      })

      // 4. CRÉATION ENTRÉE MARKETPLACE
      appId = `app_${randomUUID()}`

      const appInfo = {
        id: appId,
        publishId,
        projectId,
        userId,
        name: sanitized.name,
        description: sanitized.description || '',
        category: sanitized.category || CATEGORIES[0],
        tags: sanitized.tags || [],
        visibility: sanitized.visibility || VISIBILITY.PUBLIC,
        version: sanitized.version,
        buildId: buildResult.buildId,
        apkUrl: downloadUrl.url,
        downloadToken: downloadUrl.token,
        qrCode: qrCode.dataUrl,
        icon: sanitized.icon || null,
        screenshots: sanitized.screenshotUrls || [],
        stats: {
          views: 0,
          downloads: 0,
          installs: 0,
          forks: 0,
          rating: 0,
          reviews: 0,
          reviewsCount: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          buildTime: buildResult.duration,
          apkSize: buildResult.size,
          apkChecksum: buildResult.checksum,
          screenshots: buildResult.screenshots || [],
          buildEnvironment: process.env.NODE_ENV
        }
      }

      // 5. PERSISTANCE
      const transaction = await this.storage.beginTransaction()
      
      try {
        await this.storage.saveApp(appId, appInfo, transaction)
        
        // Analytics (non bloquant)
        if (appAnalyticsService) {
          await appAnalyticsService.registerApp(appId, {
            name: sanitized.name,
            userId,
            category: sanitized.category,
            metadata: {
              publishId,
              buildId: buildResult.buildId
            }
          }, transaction).catch(err => {
            this.logger.warn('Analytics indisponible', err)
          })
        }

        if (transaction?.commit) {
          await transaction.commit()
        }

      } catch (error) {
        if (transaction?.rollback) {
          await transaction.rollback()
        }
        throw error
      }

      // 6. MISE À JOUR STATS
      this.stats.totalPublished++
      this.stats.activeApps++

      // 7. NOTIFICATION
      if (notificationService) {
        await notificationService.notifyUser(userId, {
          type: 'app_published',
          title: 'Application publiée !',
          message: `${sanitized.name} est maintenant disponible sur le marketplace`,
          data: { appId, projectId }
        }).catch(err => {
          this.logger.warn('Notification non envoyée', err)
        })
      }

      // 8. CLEANUP
      await cleanupTempFiles(Array.from(this.tempFiles))
      this.tempFiles.clear()

      const duration = Date.now() - startTime
      this.publishQueue.delete(publishId)

      this.emit('publish:success', { 
        publishId, 
        appId, 
        projectId, 
        duration 
      })
      
      this.logger.success('Publication réussie', { 
        appId, 
        name: sanitized.name,
        duration: `${duration}ms`
      })

      return {
        success: true,
        appId,
        publishId,
        name: sanitized.name,
        version: sanitized.version,
        downloadUrl: downloadUrl.url,
        qrCode: qrCode.dataUrl,
        stats: appInfo.stats,
        createdAt: appInfo.createdAt
      }

    } catch (error) {
      // Nettoyage
      if (this.tempFiles.size > 0) {
        await cleanupTempFiles(Array.from(this.tempFiles))
        this.tempFiles.clear()
      }

      this.publishQueue.delete(publishId)
      
      const errorMessage = error instanceof ValidationError 
        ? error.errors.join(', ')
        : error.message

      this.emit('publish:failed', { 
        publishId, 
        projectId, 
        error: errorMessage 
      })
      
      this.logger.error('Échec publication', {
        publishId,
        projectId,
        error: errorMessage,
        stack: error.stack
      })

      throw error
    }
  }

  /**
   * Récupère le statut d'une publication
   */
  getPublishStatus(publishId) {
    return this.publishQueue.get(publishId) || null
  }

  /**
   * Récupère une application
   */
  async getApp(appId) {
    return await this.storage.getApp(appId)
  }

  /**
   * Liste les applications
   */
  async listApps(filters = {}) {
    const result = await this.storage.listApps(filters)
    
    // Formatter pour l'API
    return {
      ...result,
      items: result.items.map(app => ({
        id: app.id,
        name: app.name,
        description: app.description,
        category: app.category,
        tags: app.tags,
        icon: app.icon,
        screenshots: app.screenshots,
        stats: app.stats,
        version: app.version,
        createdAt: app.createdAt,
        userId: app.userId,
        visibility: app.visibility
      }))
    }
  }

  /**
   * Incrémente les stats
   */
  async recordDownload(appId, userId = null) {
    const app = await this.storage.getApp(appId)
    if (!app) return false

    const updates = {
      downloads: app.stats.downloads + 1
    }

    await this.storage.updateAppStats(appId, updates)
    this.stats.totalDownloads++

    this.emit('app:downloaded', { appId, userId })
    return true
  }

  /**
   * Incrémente les installs
   */
  async recordInstall(appId, userId = null) {
    const app = await this.storage.getApp(appId)
    if (!app) return false

    const updates = {
      installs: app.stats.installs + 1
    }

    await this.storage.updateAppStats(appId, updates)
    this.stats.totalInstalls++

    this.emit('app:installed', { appId, userId })
    return true
  }

  /**
   * Met à jour le rating
   */
  async updateRating(appId, newRating) {
    const app = await this.storage.getApp(appId)
    if (!app) return false

    const currentReviews = app.stats.reviewsCount || 0
    const currentRating = app.stats.rating || 0
    
    const newReviewsCount = currentReviews + 1
    const updatedRating = (currentRating * currentReviews + newRating) / newReviewsCount

    const updates = {
      rating: Math.round(updatedRating * 10) / 10,
      reviewsCount: newReviewsCount
    }

    await this.storage.updateAppStats(appId, updates)
    return true
  }

  /**
   * Supprime une application
   */
  async unpublishApp(appId, userId) {
    const deleted = await this.storage.deleteApp(appId, userId)
    
    if (deleted) {
      this.stats.activeApps--
      
      if (appAnalyticsService) {
        await appAnalyticsService.deleteApp(appId).catch(() => {})
      }

      this.emit('app:unpublished', { appId, userId })
      this.logger.info('App dépubliée', { appId })
    }

    return { success: deleted }
  }

  /**
   * Statistiques globales
   */
  async getStats() {
    const activeApps = await this.storage.listApps({ limit: 1 })
    
    return {
      ...this.stats,
      activeApps: activeApps.total || this.stats.activeApps,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Apps populaires / tendances
   */
  async getTrendingApps(limit = 10) {
    const result = await this.storage.listApps({
      visibility: VISIBILITY.PUBLIC,
      sortBy: 'downloads',
      sortOrder: 'desc',
      limit
    })

    return result.items
  }

  /**
   * Apps par utilisateur
   */
  async getUserApps(userId, options = {}) {
    return await this.storage.listApps({
      userId,
      ...options
    })
  }
}

// =============================
// SINGLETON EXPORT
// =============================

let publishServiceInstance = null

export const initializePublishService = (storageClient) => {
  if (!publishServiceInstance) {
    const storage = new MarketplaceStorage(storageClient)
    publishServiceInstance = new PublishService(storage)
  }
  return publishServiceInstance
}

export const getPublishService = () => {
  if (!publishServiceInstance) {
    publishServiceInstance = new PublishService(new MarketplaceStorage(null))
  }
  return publishServiceInstance
}

// Export par défaut pour compatibilité
export default getPublishService
