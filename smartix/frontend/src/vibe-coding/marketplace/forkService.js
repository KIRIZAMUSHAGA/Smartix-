/**
 * forkService - Service de fork d'applications
 * Version finale avec toutes les corrections
 * 
 * Rôle: Permettre aux utilisateurs de forker des applications existantes
 * - Copie profonde et sécurisée des projets
 * - Traçabilité complète des forks (ascendants/descendants)
 * - Gestion des permissions et validation
 * - Rollback automatique en cas d'erreur
 * - Arbre généalogique complet
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { projectManager } from '../core/projectManager'
import { logger } from '../mobile/utils/logger'
import { deepClone } from '../mobile/utils/deepClone'
import { rateLimiter } from '../mobile/utils/rateLimiter'

// =============================
// INJECTION DE DÉPENDANCES
// =============================
let publishService
let appAnalyticsService

export const setPublishService = (service) => {
  publishService = service
}

export const setAnalyticsService = (service) => {
  appAnalyticsService = service
}

// =============================
// CONSTANTES
// =============================

const FORK_COOLDOWN = 2 * 60 * 1000 // 2 minutes entre forks
const MAX_FORKS_PER_USER = 50 // Limite de forks par utilisateur
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_TAGS = 20 // Nombre maximum de tags
const MAX_FORK_DEPTH = 10 // Profondeur maximale pour l'arbre généalogique

const FORK_STATUS = {
  PENDING: 'pending',
  COPYING: 'copying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PUBLISHED: 'published'
}

// =============================
// INTERFACE STORAGE
// =============================

export class ForkStorage {
  constructor(client) {
    this.client = client
    this.cache = new Map()
  }

  /**
   * Sauvegarde un fork
   */
  async saveFork(forkId, data, transaction = null) {
    const forkData = {
      ...data,
      _id: forkId,
      updatedAt: new Date().toISOString()
    }

    if (this.client.save) {
      await this.client.save('forks', forkData, transaction)
    }

    // Mise en cache
    this.cache.set(forkId, {
      data: forkData,
      timestamp: Date.now()
    })

    // Invalider les caches liés
    this._invalidateRelatedCaches(forkData.originalAppId, forkData.forkedBy)

    return forkData
  }

  /**
   * Récupère un fork par son ID
   */
  async getFork(forkId) {
    // Cache
    const cached = this.cache.get(forkId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // Base de données
    let forkData = null
    if (this.client.get) {
      forkData = await this.client.get('forks', forkId)
    }

    if (forkData) {
      this.cache.set(forkId, {
        data: forkData,
        timestamp: Date.now()
      })
    }

    return forkData
  }

  /**
   * Récupère les forks d'une app originale (enfants directs)
   */
  async getForksByOriginalApp(originalAppId) {
    if (this.client.query) {
      return await this.client.query('forks', {
        where: { originalAppId },
        sort: { forkedAt: -1 }
      })
    }
    return { items: [] }
  }

  /**
   * ✅ Récupère le fork parent d'une app enfant
   */
  async getForkByChildApp(childAppId) {
    const cacheKey = `fork_by_child:${childAppId}`
    
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    if (this.client.query) {
      const result = await this.client.query('forks', {
        where: { newAppId: childAppId },
        limit: 1
      })
      
      const fork = result.items?.[0] || null
      
      this.cache.set(cacheKey, {
        data: fork,
        timestamp: Date.now()
      })
      
      return fork
    }
    return null
  }

  /**
   * Récupère les forks effectués par un utilisateur
   */
  async getForksByUser(userId) {
    if (this.client.query) {
      return await this.client.query('forks', {
        where: { forkedBy: userId },
        sort: { forkedAt: -1 }
      })
    }
    return { items: [] }
  }

  /**
   * Met à jour le statut d'un fork
   */
  async updateForkStatus(forkId, status, result = null) {
    const fork = await this.getFork(forkId)
    if (!fork) return null

    const updated = {
      ...fork,
      status,
      result: result || fork.result,
      completedAt: status === FORK_STATUS.COMPLETED || status === FORK_STATUS.FAILED 
        ? new Date().toISOString() 
        : fork.completedAt,
      updatedAt: new Date().toISOString()
    }

    await this.saveFork(forkId, updated)
    this.cache.delete(forkId)
    return updated
  }

  /**
   * Supprime un fork
   */
  async deleteFork(forkId) {
    if (this.client.delete) {
      await this.client.delete('forks', forkId)
    }
    this.cache.delete(forkId)
    return true
  }

  /**
   * Démarre une transaction
   */
  async beginTransaction() {
    if (this.client.beginTransaction) {
      return await this.client.beginTransaction()
    }
    return null
  }

  /**
   * Invalide les caches liés à une app ou un utilisateur
   */
  _invalidateRelatedCaches(appId, userId) {
    for (const [key] of this.cache) {
      if (key.includes(appId) || key.includes(userId)) {
        this.cache.delete(key)
      }
    }
  }
}

// =============================
// VALIDATION
// =============================

class ForkValidationError extends Error {
  constructor(message, errors = []) {
    super(message)
    this.name = 'ForkValidationError'
    this.errors = errors
  }
}

const validateForkOptions = (options) => {
  const errors = []
  const sanitized = { ...options }

  // Validation du nouveau nom
  if (options.newName !== undefined) {
    if (typeof options.newName !== 'string') {
      errors.push('Le nouveau nom doit être une chaîne de caractères')
    } else {
      sanitized.newName = options.newName.trim().slice(0, 100).replace(/[<>]/g, '')
      if (sanitized.newName.length < 3) {
        errors.push('Le nouveau nom doit faire au moins 3 caractères')
      }
    }
  }

  // Validation de la description
  if (options.newDescription !== undefined) {
    if (typeof options.newDescription !== 'string') {
      errors.push('La description doit être une chaîne de caractères')
    } else {
      sanitized.newDescription = options.newDescription
        .trim()
        .slice(0, 2000)
        .replace(/[<>]/g, '')
    }
  }

  // Validation visibilité
  if (options.visibility !== undefined) {
    if (!['public', 'private', 'unlisted'].includes(options.visibility)) {
      errors.push('Visibilité invalide (doit être public, private ou unlisted)')
    }
  }

  // Validation du flag publish
  if (options.publish !== undefined && typeof options.publish !== 'boolean') {
    errors.push('publish doit être un booléen')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  }
}

// =============================
// SERVICE PRINCIPAL
// =============================

export class ForkService extends EventEmitter {
  constructor(storage) {
    super()
    this.storage = storage
    this.stats = {
      totalForks: 0,
      totalDerivedApps: 0,
      activeForks: 0
    }
    this.logger = logger.createChild('ForkService')
    this.pendingForks = new Map() // Suivi des forks en cours
  }

  // =============================
  // UTILITAIRES INTERNES
  // =============================

  /**
   * Met à jour partiellement un fork en cours
   */
  _updatePendingFork(forkId, updates) {
    const current = this.pendingForks.get(forkId)
    if (current) {
      this.pendingForks.set(forkId, {
        ...current,
        ...updates
      })
    }
  }

  /**
   * Gère une erreur de fork avec rollback
   */
  async _handleForkError(forkId, userId, originalAppId, error, forkedProject, transaction) {
    // Rollback transaction
    if (transaction?.rollback) {
      await transaction.rollback()
    }

    // Nettoyer le projet orphelin si nécessaire
    if (forkedProject) {
      try {
        await projectManager.deleteProject(forkedProject.id, userId)
        this.logger.info('Projet orphelin nettoyé', { projectId: forkedProject.id })
      } catch (cleanupError) {
        this.logger.error('Échec nettoyage projet', cleanupError)
      }
    }

    this.pendingForks.delete(forkId)

    // Sauvegarder l'échec
    await this.storage.saveFork(forkId, {
      id: forkId,
      originalAppId,
      forkedBy: userId,
      forkedAt: new Date().toISOString(),
      status: FORK_STATUS.FAILED,
      error: {
        message: error.message,
        stack: error.stack
      }
    }).catch(() => {})

    this.emit('fork:failed', {
      forkId,
      originalAppId,
      userId,
      error: error.message
    })

    this.logger.error('Échec fork', {
      forkId,
      originalAppId,
      error: error.message,
      stack: error.stack
    })
  }

  // =============================
  // PERMISSIONS
  // =============================

  /**
   * Vérifie les permissions de fork
   */
  async checkForkPermissions(originalApp, userId) {
    // Vérifier que l'app existe
    if (!originalApp) {
      throw new ForkValidationError('Application originale non trouvée')
    }

    // Vérifier la visibilité
    if (originalApp.visibility === 'private' && originalApp.userId !== userId) {
      throw new ForkValidationError('Impossible de forker une application privée')
    }

    // Vérifier la limite de forks
    const userForks = await this.storage.getForksByUser(userId)
    if (userForks.items.length >= MAX_FORKS_PER_USER) {
      throw new ForkValidationError(`Limite de ${MAX_FORKS_PER_USER} forks atteinte`)
    }

    // Rate limiting
    if (!rateLimiter.check(userId, 'fork', FORK_COOLDOWN)) {
      throw new ForkValidationError('Trop de forks. Veuillez patienter.')
    }

    return true
  }

  // =============================
  // CLONAGE
  // =============================

  /**
   * Copie profonde du projet
   */
  async cloneProject(originalProject, originalApp, userId, forkId, newName, newDescription) {
    this.emit('fork:cloning', { forkId, originalAppId: originalApp.id })

    // Clonage profond sécurisé
    const clonedFiles = deepClone(originalProject.files || {})
    const clonedConfig = deepClone(originalProject.config || {})

    // Validation des tags
    const validatedTags = (originalProject.tags || [])
      .slice(0, MAX_TAGS)
      .map(tag => tag.trim().slice(0, 50).replace(/[<>]/g, ''))
      .filter(tag => tag.length > 0)

    // Métadonnées de traçabilité
    const metadata = {
      forkedFrom: originalApp.id,
      originalUserId: originalApp.userId,
      originalProjectId: originalProject.id,
      forkId,
      forkDate: new Date().toISOString(),
      forkVersion: originalApp.version,
      originalName: originalProject.name
    }

    // Utiliser le nouveau nom si fourni
    const projectName = newName || `${originalProject.name} (fork)`
    const projectDescription = newDescription || originalProject.description

    // Création du nouveau projet
    const forkedProject = await projectManager.createProject(userId, {
      name: projectName,
      description: projectDescription,
      type: originalProject.type,
      files: clonedFiles,
      config: clonedConfig,
      tags: validatedTags,
      metadata: {
        ...originalProject.metadata,
        ...metadata
      }
    })

    return forkedProject
  }

  // =============================
  // OPÉRATION PRINCIPALE
  // =============================

  /**
   * Fork une application
   */
  async forkApp(originalAppId, userId, options = {}) {
    const startTime = Date.now()
    const forkId = `fork_${randomUUID()}`

    // Validation des options
    const { isValid, errors, sanitized } = validateForkOptions(options)
    if (!isValid) {
      throw new ForkValidationError('Options de fork invalides', errors)
    }

    // Initialisation du suivi
    this.pendingForks.set(forkId, {
      status: FORK_STATUS.PENDING,
      startTime,
      originalAppId,
      userId,
      options: sanitized
    })

    this.logger.info('Début fork', { forkId, originalAppId, userId })

    let transaction = null
    let forkedProject = null
    let newApp = null

    try {
      this.emit('fork:started', { forkId, originalAppId, userId })

      // Vérifier que publishService est disponible
      if (!publishService) {
        throw new Error('PublishService non initialisé')
      }

      // Récupérer l'app originale
      const originalApp = await publishService.getApp(originalAppId)
      
      // Vérifier les permissions
      await this.checkForkPermissions(originalApp, userId)

      // Mise à jour du statut
      this._updatePendingFork(forkId, { status: FORK_STATUS.COPYING })
      
      // Récupérer le projet original
      const originalProject = await projectManager.getProjectById(
        originalApp.projectId,
        originalApp.userId
      )

      if (!originalProject) {
        throw new ForkValidationError('Projet original non trouvé')
      }

      // Démarrer une transaction
      transaction = await this.storage.beginTransaction()

      // Cloner le projet
      forkedProject = await this.cloneProject(
        originalProject,
        originalApp,
        userId,
        forkId,
        sanitized.newName,
        sanitized.newDescription
      )

      // Publier si demandé (par défaut true)
      if (options.publish !== false) {
        this._updatePendingFork(forkId, { status: FORK_STATUS.PUBLISHED })
        
        const forkName = sanitized.newName || `${originalApp.name} (fork)`
        
        newApp = await publishService.publishApp(
          forkedProject.id,
          userId,
          {
            name: forkName,
            description: sanitized.newDescription || originalApp.description,
            category: originalApp.category,
            tags: originalApp.tags,
            visibility: sanitized.visibility || originalApp.visibility || 'public',
            icon: originalApp.icon,
            screenshots: originalApp.screenshots,
            version: '1.0.0'
          }
        )
      }

      // Enregistrer le fork
      const forkInfo = {
        id: forkId,
        originalAppId,
        originalUserId: originalApp.userId,
        forkedBy: userId,
        forkedProjectId: forkedProject.id,
        newAppId: newApp?.appId || null,
        forkedAt: new Date().toISOString(),
        status: FORK_STATUS.COMPLETED,
        options: sanitized,
        metadata: {
          originalAppName: originalApp.name,
          originalVersion: originalApp.version,
          forkDuration: Date.now() - startTime
        }
      }

      await this.storage.saveFork(forkId, forkInfo, transaction)

      // Commit transaction
      if (transaction?.commit) {
        await transaction.commit()
      }

      // Mettre à jour les stats de l'original
      await publishService.updateAppStats(originalAppId, {
        forks: (originalApp.stats?.forks || 0) + 1
      })

      // Analytics
      if (appAnalyticsService) {
        await appAnalyticsService.trackFork({
          forkId,
          originalAppId,
          userId,
          newAppId: newApp?.appId,
          duration: Date.now() - startTime
        }).catch(err => {
          this.logger.warn('Analytics fork failed', err)
        })
      }

      // Mettre à jour les stats du service
      this.stats.totalForks++
      if (newApp) this.stats.totalDerivedApps++

      this.pendingForks.delete(forkId)

      this.emit('fork:success', {
        forkId,
        originalAppId,
        newAppId: newApp?.appId,
        duration: Date.now() - startTime
      })

      this.logger.success('Fork réussi', {
        forkId,
        originalAppId,
        newAppId: newApp?.appId,
        duration: `${Date.now() - startTime}ms`
      })

      return {
        success: true,
        forkId,
        forkedProject: {
          id: forkedProject.id,
          name: forkedProject.name,
          type: forkedProject.type
        },
        newApp: newApp ? {
          id: newApp.appId,
          name: newApp.name,
          downloadUrl: newApp.downloadUrl
        } : null,
        originalApp: {
          id: originalApp.id,
          name: originalApp.name
        }
      }

    } catch (error) {
      await this._handleForkError(forkId, userId, originalAppId, error, forkedProject, transaction)
      throw error
    }
  }

  // =============================
  // GÉNÉALOGIE
  // =============================

  /**
   * ✅ Récupère la généalogie complète d'une app (ascendants)
   */
  async getAppGenealogy(appId, maxDepth = MAX_FORK_DEPTH) {
    const genealogy = []
    let currentId = appId
    let depth = 0

    while (currentId && depth < maxDepth) {
      // Récupérer l'app courante
      const app = publishService 
        ? await publishService.getApp(currentId)
        : null

      if (!app) break

      // Ajouter au début (ordre chronologique)
      genealogy.unshift({
        id: currentId,
        name: app.name,
        userId: app.userId,
        createdAt: app.createdAt,
        version: app.version
      })

      // ✅ Chercher le fork PARENT
      const parentFork = await this.storage.getForkByChildApp(currentId)
      
      // Remonter au parent
      currentId = parentFork?.originalAppId || null
      depth++
    }

    return genealogy
  }

  /**
   * ✅ Récupère les enfants directs d'une app
   */
  async getChildApps(appId, options = {}) {
    const { limit = 50, offset = 0 } = options
    
    const result = await this.storage.getForksByOriginalApp(appId)
    
    const children = await Promise.all(
      result.items.slice(offset, offset + limit).map(async (fork) => {
        const childApp = fork.newAppId 
          ? await publishService?.getApp(fork.newAppId)
          : null

        return {
          forkId: fork.id,
          appId: fork.newAppId,
          appName: childApp?.name || 'Application inconnue',
          forkedBy: fork.forkedBy,
          forkedAt: fork.forkedAt,
          status: fork.status,
          metadata: fork.metadata
        }
      })
    )

    return {
      children,
      total: result.items.length,
      offset,
      limit,
      hasMore: offset + limit < result.items.length
    }
  }

  /**
   * ✅ Récupère récursivement tous les descendants
   */
  async _getDescendants(appId, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth) return []

    const children = await this.getChildApps(appId)
    
    const descendants = await Promise.all(
      children.children.map(async (child) => ({
        app: {
          id: child.appId,
          name: child.appName,
          forkedAt: child.forkedAt,
          forkedBy: child.forkedBy
        },
        children: await this._getDescendants(child.appId, maxDepth, currentDepth + 1)
      }))
    )

    return descendants
  }

  /**
   * ✅ Récupère l'arbre généalogique complet (ascendants + descendants)
   */
  async getFullFamilyTree(appId, maxDepth = MAX_FORK_DEPTH) {
    // Récupérer les ancêtres
    const ancestors = await this.getAppGenealogy(appId, maxDepth)
    
    // Récupérer les descendants
    const descendants = await this._getDescendants(appId, maxDepth)
    
    // L'app courante est le dernier élément des ancêtres
    const currentApp = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null
    
    return {
      appId,
      ancestors: ancestors.slice(0, -1), // Tout sauf l'app courante
      current: currentApp,
      descendants
    }
  }

   // =============================
  // REQUÊTES
  // =============================

  /**
   * Récupère les forks d'une app
   */
  async getForksOfApp(originalAppId, options = {}) {
    const { limit = 50, offset = 0 } = options
    
    const result = await this.storage.getForksByOriginalApp(originalAppId)
    
    return {
      forks: result.items.slice(offset, offset + limit).map(fork => ({
        id: fork.id,
        forkedBy: fork.forkedBy,
        forkedAt: fork.forkedAt,
        newAppId: fork.newAppId,
        status: fork.status,
        metadata: fork.metadata
      })),
      total: result.items.length,
      offset,
      limit
    }
  }

  /**
   * Récupère les forks d'un utilisateur
   */
  async getForksByUser(userId, options = {}) {
    const { limit = 50, offset = 0 } = options
    
    const result = await this.storage.getForksByUser(userId)
    
    const forks = await Promise.all(
      result.items.slice(offset, offset + limit).map(async (fork) => {
        const originalApp = publishService 
          ? await publishService.getApp(fork.originalAppId)
          : null

        const newApp = fork.newAppId && publishService
          ? await publishService.getApp(fork.newAppId)
          : null

        return {
          id: fork.id,
          originalAppId: fork.originalAppId,
          originalAppName: originalApp?.name || 'Application inconnue',
          newAppId: fork.newAppId,
          newAppName: newApp?.name || null,
          forkedAt: fork.forkedAt,
          status: fork.status,
          metadata: fork.metadata
        }
      })
    )

    return {
      forks,
      total: result.items.length,
      offset,
      limit
    }
  }

  /**
   * Récupère l'arbre complet des forks (structure arborescente)
   */
  async getForkTree(originalAppId, maxDepth = MAX_FORK_DEPTH) {
    const buildTree = async (appId, depth = 0) => {
      if (depth >= maxDepth) return null

      const app = publishService ? await publishService.getApp(appId) : null
      if (!app) return null

      const children = await this.getChildApps(appId)
      
      return {
        app: {
          id: app.id,
          name: app.name,
          userId: app.userId,
          createdAt: app.createdAt,
          stats: app.stats
        },
        forks: await Promise.all(
          children.children
            .filter(child => child.appId)
            .map(async (child) => ({
              fork: {
                id: child.forkId,
                forkedBy: child.forkedBy,
                forkedAt: child.forkedAt,
                metadata: child.metadata
              },
              children: child.appId ? await buildTree(child.appId, depth + 1) : null
            }))
        )
      }
    }

    return await buildTree(originalAppId)
  }

  /**
   * Vérifie si une app est un fork d'une autre
   */
  async isForkOf(appId, potentialParentId) {
    const genealogy = await this.getAppGenealogy(appId)
    return genealogy.some(app => app.id === potentialParentId)
  }

  /**
   * Récupère la chaîne de forks (du plus ancien au plus récent)
   */
  async getForkChain(appId) {
    return await this.getAppGenealogy(appId)
  }

  // =============================
  // STATISTIQUES & MAINTENANCE
  // =============================

  /**
   * Récupère les statistiques
   */
  async getStats() {
    const activeForks = this.pendingForks.size
    
    return {
      ...this.stats,
      activeForks,
      pendingForks: Array.from(this.pendingForks.entries()).map(([id, fork]) => ({
        id,
        status: fork.status,
        startTime: fork.startTime,
        originalAppId: fork.originalAppId,
        userId: fork.userId,
        elapsed: Date.now() - fork.startTime
      })),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Nettoie les forks en erreur (à appeler périodiquement)
   */
  async cleanupStaleForks(maxAge = 24 * 60 * 60 * 1000) { // 24h par défaut
    const now = Date.now()
    const staleForks = []

    for (const [forkId, fork] of this.pendingForks) {
      if (now - fork.startTime > maxAge) {
        staleForks.push(forkId)
      }
    }

    for (const forkId of staleForks) {
      this.pendingForks.delete(forkId)
      this.logger.warn('Fork expiré nettoyé', { forkId })
    }

    return staleForks.length
  }
}

// =============================

let forkServiceInstance = null

export const initializeForkService = (storageClient) => {
  if (!forkServiceInstance) {
    const storage = new ForkStorage(storageClient)
    forkServiceInstance = new ForkService(storage)
  }
  return forkServiceInstance
}

export const getForkService = () => {
  if (!forkServiceInstance) {
    throw new Error('ForkService non initialisé. Appelez initializeForkService d\'abord.')
  }
  return forkServiceInstance
}

export default getForkService
