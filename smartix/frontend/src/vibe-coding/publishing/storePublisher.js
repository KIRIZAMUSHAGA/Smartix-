/**
 * Gestionnaire de publication vers les stores
 */

import { useState, useEffect, useCallback } from 'react'
import { versionManager } from './versionManager'
import { packaging } from './packaging'
import { visibilityManager } from './visibilityManager'
import { projectManager } from '../core/projectManager'
import { appGenerator } from '../ai/appGenerator'
import { asoOptimizer } from './asoOptimizer'

// =============================
// CONFIGURATION
// =============================

export const STORES = {
  INTERNAL: 'internal',
  GOOGLE_PLAY: 'google_play',
  APP_STORE: 'app_store',
  AMAZON: 'amazon',
  SAMSUNG: 'samsung',
  HUAWEI: 'huawei'
}

const MAX_QUEUE = 1000
const MAX_RETRIES = 3

const STORE_CONFIG = {
  [STORES.INTERNAL]: {
    name: 'Marketplace Smartix',
    maxSize: 100 * 1024 * 1024,
    requiredFields: ['name', 'description', 'version'],
    reviewTime: 'instantané',
    icon: '🏪',
    color: '#6366f1',
    supportsAso: false
  },

  [STORES.GOOGLE_PLAY]: {
    name: 'Google Play Store',
    maxSize: 150 * 1024 * 1024,
    requiredFields: ['name', 'description', 'version', 'category', 'screenshots'],
    reviewTime: '2-5 jours',
    icon: '▶️',
    color: '#34a853',
    supportsAso: true
  },

  [STORES.APP_STORE]: {
    name: 'Apple App Store',
    maxSize: 200 * 1024 * 1024,
    requiredFields: ['name', 'description', 'version', 'category', 'screenshots', 'privacy'],
    reviewTime: '1-3 jours',
    icon: '🍎',
    color: '#000000',
    supportsAso: true
  },

  [STORES.AMAZON]: {
    name: 'Amazon Appstore',
    maxSize: 100 * 1024 * 1024,
    requiredFields: ['name', 'description', 'version'],
    reviewTime: '1-2 jours',
    icon: '📱',
    color: '#ff9900',
    supportsAso: false
  },

  [STORES.SAMSUNG]: {
    name: 'Samsung Galaxy Store',
    maxSize: 100 * 1024 * 1024,
    requiredFields: ['name', 'description', 'version'],
    reviewTime: '1-2 jours',
    icon: '📱',
    color: '#1428a0',
    supportsAso: false
  },

  [STORES.HUAWEI]: {
    name: 'Huawei AppGallery',
    maxSize: 150 * 1024 * 1024,
    requiredFields: ['name', 'description', 'version', 'category'],
    reviewTime: '2-3 jours',
    icon: '📱',
    color: '#ff0000',
    supportsAso: false
  }
}

export const PUBLICATION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

// =============================
// STORE PUBLISHER
// =============================

class StorePublisher {
  constructor() {
    this.publications = new Map()
    this.storeClients = new Map()
    this.initialized = false
    this.publishQueue = []
    this.isProcessingQueue = false
    this.pendingCancellations = new Set()
  }

  async initialize() {
    if (this.initialized) return

    await this._initStoreClients()
    this.initialized = true

    console.log('✅ StorePublisher initialisé')
  }

  /**
   * Publie un projet sur un store
   */
  async publishToStore(projectId, userId, store, options = {}) {
    if (!this.initialized) await this.initialize()

    // Vérifier les paramètres
    if (!projectId || !userId || !store) {
      throw new Error('Paramètres requis manquants')
    }

    if (!STORES[store]) {
      throw new Error(`Store ${store} non supporté`)
    }

    const project = await projectManager.getProjectById(projectId, userId)

    if (!project) {
      throw new Error('Projet non trouvé')
    }

    // Vérifier les permissions
    const canPublish = await this.canPublish(projectId, store)
    if (!canPublish) {
      throw new Error(`Vous n'avez pas les permissions pour publier sur ${STORE_CONFIG[store].name}`)
    }

    // Valider pour le store
    const validation = await this._validateForStore(project, store)
    if (!validation.isValid) {
      throw new Error(`Validation échouée: ${validation.errors.join(', ')}`)
    }

    // Vérifier la taille
    const size = await this._estimatePackageSize(project)
    if (size > STORE_CONFIG[store].maxSize) {
      throw new Error(`Projet trop volumineux pour ${STORE_CONFIG[store].name}: ${this._formatSize(size)} > ${this._formatSize(STORE_CONFIG[store].maxSize)}`)
    }

    // Vérifier la file d'attente
    if (this.publishQueue.length >= MAX_QUEUE) {
      throw new Error('Queue de publication pleine')
    }

    // Préparer le package
    const packageInfo = await packaging.prepareForStore?.(project, store, options) || {
      files: project.files,
      size
    }

    const publicationId = `pub_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`

    const publication = {
      id: publicationId,
      projectId,
      projectName: project.name,
      store,
      version: project.version,
      status: PUBLICATION_STATUS.SUBMITTED,
      retryCount: 0,
      package: packageInfo,
      submittedAt: new Date().toISOString(),
      submittedBy: userId,
      options,
      metadata: await this._generateStoreMetadata(project, store),
      statusDetails: []
    }

    this.publishQueue.push(publication)
    this.publications.set(publicationId, publication)

    if (!this.isProcessingQueue) {
      this._processPublishQueue()
    }

    return {
      success: true,
      publicationId,
      status: PUBLICATION_STATUS.SUBMITTED,
      message: `Publication soumise sur ${STORE_CONFIG[store].name}`,
      estimatedTime: STORE_CONFIG[store].reviewTime
    }
  }

  /**
   * Annule une publication en cours
   */
  async cancelPublication(publicationId, userId) {
    const publication = this.publications.get(publicationId)

    if (!publication) {
      throw new Error('Publication non trouvée')
    }

    if (publication.submittedBy !== userId) {
      throw new Error('Vous n\'êtes pas autorisé à annuler cette publication')
    }

    if (![PUBLICATION_STATUS.SUBMITTED, PUBLICATION_STATUS.IN_REVIEW].includes(publication.status)) {
      throw new Error(`Impossible d'annuler une publication avec le statut ${publication.status}`)
    }

    // Marquer pour annulation
    this.pendingCancellations.add(publicationId)
    publication.status = PUBLICATION_STATUS.CANCELLED
    publication.cancelledAt = new Date().toISOString()
    publication.statusDetails.push({
      type: 'cancelled',
      message: 'Publication annulée par l\'utilisateur',
      timestamp: new Date().toISOString()
    })

    return {
      success: true,
      publicationId,
      status: PUBLICATION_STATUS.CANCELLED
    }
  }

  /**
   * Vérifie les permissions de publication
   */
  async canPublish(projectId, store) {
    // TODO: Implémenter la vérification des permissions réelles
    // Par exemple: vérifier si l'utilisateur a un compte développeur valide
    return true
  }

  /**
   * Récupère le statut d'une publication
   */
  async getPublicationStatus(publicationId) {
    const publication = this.publications.get(publicationId)

    if (!publication) {
      throw new Error('Publication non trouvée')
    }

    return {
      id: publication.id,
      status: publication.status,
      store: publication.store,
      submittedAt: publication.submittedAt,
      completedAt: publication.completedAt,
      estimatedTime: STORE_CONFIG[publication.store].reviewTime,
      details: publication.statusDetails,
      error: publication.error
    }
  }

  /**
   * Liste les publications d'un projet
   */
  async listProjectPublications(projectId) {
    const publications = []

    this.publications.forEach(pub => {
      if (pub.projectId === projectId) {
        publications.push({
          id: pub.id,
          store: pub.store,
          storeName: STORE_CONFIG[pub.store]?.name || pub.store,
          version: pub.version,
          status: pub.status,
          submittedAt: pub.submittedAt,
          completedAt: pub.completedAt
        })
      }
    })

    return publications.sort((a, b) =>
      new Date(b.submittedAt) - new Date(a.submittedAt)
    )
  }

  /**
   * Récupère la longueur de la file d'attente
   */
  getQueueLength() {
    return this.publishQueue.length
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const stats = {
      total: this.publications.size,
      byStore: {},
      byStatus: {},
      successRate: 0,
      failedRate: 0,
      queueLength: this.publishQueue.length
    }

    let success = 0
    let failed = 0

    this.publications.forEach(pub => {
      stats.byStore[pub.store] = (stats.byStore[pub.store] || 0) + 1
      stats.byStatus[pub.status] = (stats.byStatus[pub.status] || 0) + 1

      if (pub.status === PUBLICATION_STATUS.PUBLISHED) success++
      if (pub.status === PUBLICATION_STATUS.FAILED) failed++
    })

    if (stats.total > 0) {
      stats.successRate = (success / stats.total) * 100
      stats.failedRate = (failed / stats.total) * 100
    }

    return stats
  }

  /**
   * Traite la file d'attente
   * @private
   */
  async _processPublishQueue() {
    if (this.isProcessingQueue) return

    this.isProcessingQueue = true

    while (this.publishQueue.length > 0) {
      const publication = this.publishQueue[0] // Regarder le premier sans le retirer

      // Vérifier si annulé
      if (this.pendingCancellations.has(publication.id)) {
        this.publishQueue.shift()
        this.pendingCancellations.delete(publication.id)
        continue
      }

      try {
        publication.status = PUBLICATION_STATUS.IN_REVIEW
        publication.statusDetails.push({
          type: 'review',
          message: 'Publication en cours de révision',
          timestamp: new Date().toISOString()
        })

        // Simuler le temps de révision
        const reviewDelay = publication.store === STORES.INTERNAL ? 1000 : 3000
        await new Promise(r => setTimeout(r, reviewDelay))

        const client = this.storeClients.get(publication.store)

        if (client) {
          const result = await client.publish(publication.package)

          publication.status = result.success
            ? PUBLICATION_STATUS.PUBLISHED
            : PUBLICATION_STATUS.FAILED

          if (result.success) {
            publication.storeId = result.id
            publication.storeUrl = result.url
            publication.statusDetails.push({
              type: 'published',
              message: 'Publication réussie',
              url: result.url,
              timestamp: new Date().toISOString()
            })
          } else {
            publication.error = result.error
            publication.statusDetails.push({
              type: 'error',
              message: result.error,
              timestamp: new Date().toISOString()
            })
          }
        }

        this.publishQueue.shift() // Retirer après traitement réussi

      } catch (error) {
        publication.retryCount++

        if (publication.retryCount <= MAX_RETRIES) {
          // Remettre à la fin de la queue pour réessayer plus tard
          this.publishQueue.shift()
          this.publishQueue.push(publication)
          
          publication.statusDetails.push({
            type: 'retry',
            message: `Tentative ${publication.retryCount}/${MAX_RETRIES}`,
            timestamp: new Date().toISOString()
          })
        } else {
          publication.status = PUBLICATION_STATUS.FAILED
          publication.error = error.message
          publication.statusDetails.push({
            type: 'failed',
            message: error.message,
            timestamp: new Date().toISOString()
          })
          this.publishQueue.shift()
        }
      }

      publication.completedAt = new Date().toISOString()
    }

    this.isProcessingQueue = false
  }

  /**
   * Valide un projet pour un store spécifique
   * @private
   */
  async _validateForStore(project, store) {
    const errors = []
    const warnings = []
    const config = STORE_CONFIG[store]

    // Vérifier les champs requis
    config.requiredFields.forEach(field => {
      if (!project[field] && !project.metadata?.[field]) {
        errors.push(`Champ requis manquant: ${field}`)
      }
    })

    // Vérifier les screenshots pour certains stores
    if ((store === STORES.APP_STORE || store === STORES.GOOGLE_PLAY) && 
        (!project.screenshots || project.screenshots.length === 0)) {
      errors.push('Au moins une capture d\'écran requise')
    }

    // Vérifier la politique de confidentialité pour l'App Store
    if (store === STORES.APP_STORE && !project.privacyPolicy) {
      errors.push('Politique de confidentialité requise pour l\'App Store')
    }

    // Vérifier la catégorie
    if (!project.category && config.requiredFields.includes('category')) {
      errors.push('Catégorie requise')
    }

    // Vérifier la présence d'icône
    if (!project.icon) {
      warnings.push('Icône manquante (recommandée)')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Estime la taille du package
   * @private
   */
  async _estimatePackageSize(project) {
    let size = 0

    if (project.files) {
      Object.values(project.files).forEach(content => {
        size += new Blob([content || '']).size
      })
    }

    if (project.assets) {
      Object.values(project.assets).forEach(asset => {
        size += asset.size || 0
      })
    }

    return size
  }

  /**
   * Nettoie le texte pour les stores
   * @private
   */
  _sanitize(text) {
    if (!text) return ''

    return String(text)
      .replace(/<script.*?>.*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '') // Supprimer toutes les balises HTML
      .replace(/[<>]/g, '')
      .trim()
  }

  /**
   * Génère les métadonnées pour le store
   * @private
   */
  async _generateStoreMetadata(project, store) {
    const baseMetadata = {
      name: this._sanitize(project.name) || 'Application',
      description: this._sanitize(project.description) || '',
      shortDescription: this._sanitize(project.shortDescription || project.description || '').substring(0, 80),
      version: project.version || '1.0.0',
      buildNumber: Date.now(),
      minOsVersion: project.minOsVersion || '12.0',
      targetSdk: project.targetSdk || 33,
      permissions: await this._generatePermissions(project),
      features: project.features || [],
      screenshots: project.screenshots || [],
      icon: project.icon,
      category: project.category || 'general',
      tags: project.tags || [],
      languages: project.languages || ['fr', 'en'],
      privacyPolicy: project.privacyPolicy || '',
      website: project.website || '',
      email: project.email || '',
      keywords: project.keywords || []
    }

    // Optimisation ASO pour les stores qui le supportent
    if (STORE_CONFIG[store]?.supportsAso) {
      try {
        const asoData = await asoOptimizer.generateOptimizedMetadata(project, store)
        return {
          ...baseMetadata,
          ...asoData,
          asoOptimized: true
        }
      } catch (error) {
        console.warn('⚠️ ASO optimization failed:', error.message)
        return baseMetadata
      }
    }

    return baseMetadata
  }

  /**
   * Génère les permissions basées sur le code
   * @private
   */
  async _generatePermissions(project) {
    const permissions = new Set()
    const codebase = Object.values(project.files || {}).join(' ')

    // Analyser le code pour détecter les permissions nécessaires
    const permissionPatterns = {
      'android.permission.CAMERA': /camera|MediaDevices|getUserMedia/i,
      'android.permission.ACCESS_FINE_LOCATION': /geolocation|getCurrentPosition|watchPosition/i,
      'android.permission.READ_EXTERNAL_STORAGE': /FileReader|readAs|FileSystem/i,
      'android.permission.WRITE_EXTERNAL_STORAGE': /write|save|download/i,
      'android.permission.RECORD_AUDIO': /MediaRecorder|getUserMedia.*audio/i,
      'android.permission.INTERNET': /fetch|XMLHttpRequest|axios|http:|https:/i,
      'android.permission.VIBRATE': /vibrate|Vibration/i,
      'android.permission.ACCESS_NETWORK_STATE': /navigator\.onLine|connection/i,
      'android.permission.WAKE_LOCK': /wakeLock|WakeLock/i,
      'android.permission.BLUETOOTH': /bluetooth|Bluetooth/i,
      'android.permission.NFC': /nfc|NDEF/i
    }

    Object.entries(permissionPatterns).forEach(([permission, pattern]) => {
      if (pattern.test(codebase)) {
        permissions.add(permission)
      }
    })

    // Permissions spécifiques aux features
    if (project.features?.includes('camera')) {
      permissions.add('android.permission.CAMERA')
    }

    if (project.features?.includes('storage')) {
      permissions.add('android.permission.READ_EXTERNAL_STORAGE')
      permissions.add('android.permission.WRITE_EXTERNAL_STORAGE')
    }

    if (project.features?.includes('location')) {
      permissions.add('android.permission.ACCESS_FINE_LOCATION')
      permissions.add('android.permission.ACCESS_COARSE_LOCATION')
    }

    if (project.features?.includes('microphone')) {
      permissions.add('android.permission.RECORD_AUDIO')
    }

    return Array.from(permissions)
  }

  /**
   * Initialise les clients store
   * @private
   */
  async _initStoreClients() {
    // Client pour le store interne
    this.storeClients.set(STORES.INTERNAL, {
      name: 'Internal Store API',
      publish: async (pkg) => ({
        success: true,
        id: `int_${Date.now()}`,
        url: `https://store.internal/app/${Date.now()}`
      })
    })

    // TODO: Ajouter les clients pour les autres stores
    // Google Play, App Store, etc. nécessitent des API spécifiques
  }

  /**
   * Formate la taille
   * @private
   */
  _formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    this.publishQueue = []
    this.pendingCancellations.clear()
    this.isProcessingQueue = false
    // Ne pas clear publications pour garder l'historique
  }
}

// =============================
// HOOK REACT
// =============================

export const useStorePublisher = () => {
  const [loading, setLoading] = useState(false)
  const [publications, setPublications] = useState([])
  const [publisher] = useState(() => new StorePublisher())

  useEffect(() => {
    publisher.initialize().catch(console.error)

    return () => {
      publisher.cleanup()
    }
  }, [publisher])

  const publishToStore = useCallback(async (projectId, userId, store, options) => {
    setLoading(true)
    try {
      const result = await publisher.publishToStore(projectId, userId, store, options)
       // Mettre à jour la liste si c'est pour le projet courant
      if (publications.some(p => p.projectId === projectId)) {
        const list = await publisher.listProjectPublications(projectId)
        setPublications(list)
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [publisher, publications])

  const listPublications = useCallback(async (projectId) => {
    const list = await publisher.listProjectPublications(projectId)
    setPublications(list)
    return list
  }, [publisher])

  const refreshPublications = useCallback(async (projectId) => {
    if (projectId) {
      return listPublications(projectId)
    }
  }, [listPublications])

  return {
    loading,
    publications,
    publishToStore,
    publishToInternal: (p, u, o) => publishToStore(p, u, STORES.INTERNAL, o),
    publishToGooglePlay: (p, u, o) => publishToStore(p, u, STORES.GOOGLE_PLAY, o),
    publishToAppStore: (p, u, o) => publishToStore(p, u, STORES.APP_STORE, o),
    publishToAmazon: (p, u, o) => publishToStore(p, u, STORES.AMAZON, o),
    publishToSamsung: (p, u, o) => publishToStore(p, u, STORES.SAMSUNG, o),
    publishToHuawei: (p, u, o) => publishToStore(p, u, STORES.HUAWEI, o),
    getStatus: (id) => publisher.getPublicationStatus(id),
    listPublications,
    refreshPublications,
    cancelPublication: (id, userId) => publisher.cancelPublication(id, userId),
    canPublish: (projectId, store) => publisher.canPublish(projectId, store),
    getStats: () => publisher.getStats(),
    getQueueLength: () => publisher.getQueueLength(),
    STORES
  }
}

// =============================
// EXPORT
// =============================

export const storePublisher = new StorePublisher()
export default storePublisher
