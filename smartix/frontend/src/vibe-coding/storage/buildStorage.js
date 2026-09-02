/**
 * Gestionnaire de stockage des builds pour le module Vibe-Coding
 * 
 * Rôle: Stocker et gérer les versions compilées des projets
 * - Sauvegarde des builds
 * - Gestion des versions
 * - Cache des builds
 * - Métadonnées de build
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================

import { useState, useEffect, useCallback, useRef } from 'react'
import { generateBuildId } from '../utils/idGenerator'
import { versionManager } from '../publishing/versionManager'
import { crypto } from '../../utils/crypto'

// =============================
// CONFIGURATION
// =============================

export const BUILD_STATUS = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

export const BUILD_TYPES = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  PREVIEW: 'preview',
  STAGING: 'staging'
}

export const BUILD_ENVIRONMENTS = {
  WEB: 'web',
  ANDROID: 'android',
  ANDROID_APK: 'android_apk',
  IOS: 'ios',
  WINDOWS: 'windows',
  MACOS: 'macos',
  LINUX: 'linux'
}

const MAX_BUILD_SIZE = 500 * 1024 * 1024 // 500 MB
const BUILD_RETENTION_DAYS = 30
const MAX_BUILDS_PER_PROJECT = 50
const MAX_LOGS_PER_BUILD = 1000
const STORAGE_QUOTA = 2 * 1024 * 1024 * 1024 // 2 GB

// =============================
// CLASSE BUILD STORAGE
// =============================

class BuildStorage {
  constructor() {
    this.builds = new Map()
    this.buildLogs = new Map()
    this.initialized = false
    this.totalStorageUsed = 0
    this.storageQuota = STORAGE_QUOTA
    this.userId = null
    this.db = null
    this.dbName = 'BuildStorage'
    this.dbVersion = 2
  }

  /**
   * Initialise le storage
   */
  async initialize(userId) {
    if (this.initialized && this.userId === userId) return

    try {
      await crypto.initialize()
      this.userId = userId
      await this._openIndexedDB()
      await this._loadFromIndexedDB()
      await this.cleanupOldBuilds() // Nettoyage automatique au démarrage
      
      this.initialized = true
      console.log(`✅ BuildStorage initialisé pour ${userId}`)
    } catch (error) {
      console.error('❌ BuildStorage initialization failed:', error)
      throw error
    }
  }

  /**
   * Ouvre la connexion IndexedDB
   */
  async _openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Store des builds
        if (!db.objectStoreNames.contains('builds')) {
          const buildStore = db.createObjectStore('builds', { keyPath: 'id' })
          buildStore.createIndex('projectId', 'projectId', { unique: false })
          buildStore.createIndex('status', 'status', { unique: false })
          buildStore.createIndex('createdAt', 'createdAt', { unique: false })
          buildStore.createIndex('project_status', ['projectId', 'status'], { unique: false })
        }

        // Store des logs
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' })
          logStore.createIndex('buildId', 'buildId', { unique: false })
          logStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Store des métadonnées
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' })
        }
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve()
      }

      request.onerror = () => reject(new Error('Erreur ouverture IndexedDB'))
    })
  }

  /**
   * Charge les builds depuis IndexedDB
   */
  async _loadFromIndexedDB() {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['builds', 'logs', 'metadata'], 'readonly')
      const buildStore = tx.objectStore('builds')
      const logStore = tx.objectStore('logs')
      const metaStore = tx.objectStore('metadata')

      // Charger les builds
      const buildRequest = buildStore.getAll()
      buildRequest.onsuccess = () => {
        buildRequest.result.forEach(build => {
          this.builds.set(build.id, build)
          this.totalStorageUsed += build.size || 0
        })
      }

      // Charger les logs
      const logRequest = logStore.getAll()
      logRequest.onsuccess = () => {
        logRequest.result.forEach(log => {
          if (!this.buildLogs.has(log.buildId)) {
            this.buildLogs.set(log.buildId, [])
          }
          this.buildLogs.get(log.buildId).push(log)
        })
      }

      // Charger les métadonnées (compteurs de builds)
      const metaRequest = metaStore.get('buildCounters')
      metaRequest.onsuccess = () => {
        this.buildCounters = metaRequest.result?.data || {}
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject()
    })
  }

  /**
   * Sauvegarde dans IndexedDB
   */
  async _saveToIndexedDB(build, logs = null) {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['builds', 'logs', 'metadata'], 'readwrite')
      const buildStore = tx.objectStore('builds')
      const logStore = tx.objectStore('logs')
      const metaStore = tx.objectStore('metadata')

      // Sauvegarder le build
      buildStore.put(build)

      // Sauvegarder les logs si fournis
      if (logs) {
        logs.forEach(log => logStore.put(log))
      }

      // Sauvegarder les compteurs
      metaStore.put({ key: 'buildCounters', data: this.buildCounters || {} })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error('Erreur sauvegarde IndexedDB'))
    })
  }

  /**
   * Crée un nouveau build
   */
  async createBuild(projectId, options = {}) {
    if (!this.initialized) throw new Error('BuildStorage non initialisé')

    const {
      type = BUILD_TYPES.DEVELOPMENT,
      environment = BUILD_ENVIRONMENTS.WEB,
      version = '1.0.0',
      metadata = {}
    } = options

    // Vérifier les limites
    const projectBuilds = Array.from(this.builds.values())
      .filter(b => b.projectId === projectId)

    if (projectBuilds.length >= MAX_BUILDS_PER_PROJECT) {
      throw new Error(`Limite de ${MAX_BUILDS_PER_PROJECT} builds atteinte pour ce projet`)
    }

    const buildId = generateBuildId()
    const timestamp = Date.now()
    const buildNumber = await this._getNextBuildNumber(projectId)

    const build = {
      id: buildId,
      projectId,
      userId: this.userId,
      type,
      environment,
      version,
      status: BUILD_STATUS.PENDING,
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      completedAt: null,
      size: 0,
      fileCount: 0,
      artifact: null,
      errors: [],
      warnings: [],
      metadata: {
        ...metadata,
        buildNumber,
        buildId: buildId.substring(0, 8)
      },
      lastAccessed: timestamp
    }

    this.builds.set(buildId, build)
    await this._saveToIndexedDB(build)

    // Ajouter un log initial
    this.addBuildLog(buildId, 'info', 'Build créé')

    return build
  }

  /**
   * Démarre un build
   */
  async startBuild(buildId) {
    const build = this._getBuild(buildId)
    if (!build) throw new Error('Build non trouvé')

    if (build.status !== BUILD_STATUS.PENDING) {
      throw new Error(`Impossible de démarrer un build avec le statut ${build.status}`)
    }

    build.status = BUILD_STATUS.BUILDING
    build.startedAt = Date.now()
    build.updatedAt = Date.now()

    this.addBuildLog(buildId, 'info', 'Build démarré')
    await this._saveToIndexedDB(build)

    return build
  }

  /**
   * Termine un build avec succès
   */
  async completeBuild(buildId, artifact, stats = {}) {
    const build = this._getBuild(buildId)
    if (!build) throw new Error('Build non trouvé')

    // Vérifier la taille
    if (artifact?.size > MAX_BUILD_SIZE) {
      throw new Error(`Build trop volumineux: ${this._formatSize(artifact.size)} > ${this._formatSize(MAX_BUILD_SIZE)}`)
    }

    build.status = BUILD_STATUS.SUCCESS
    build.completedAt = Date.now()
    build.updatedAt = Date.now()
    build.artifact = artifact
    build.size = artifact?.size || 0
    build.fileCount = stats.fileCount || 0

    this.addBuildLog(buildId, 'success', 'Build terminé')

    this.totalStorageUsed += build.size
    await this._checkQuota()

    await this._saveToIndexedDB(build)

    return build
  }

  /**
   * Marque un build comme échoué
   */
  async failBuild(buildId, errors = []) {
    const build = this._getBuild(buildId)
    if (!build) throw new Error('Build non trouvé')

    build.status = BUILD_STATUS.FAILED
    build.completedAt = Date.now()
    build.updatedAt = Date.now()
    build.errors = errors

    errors.forEach(error => {
      this.addBuildLog(buildId, 'error', error)
    })

    await this._saveToIndexedDB(build)

    return build
  }

  /**
   * Annule un build
   */
  async cancelBuild(buildId) {
    const build = this._getBuild(buildId)
    if (!build) throw new Error('Build non trouvé')

    build.status = BUILD_STATUS.CANCELLED
    build.updatedAt = Date.now()

    this.addBuildLog(buildId, 'warning', 'Build annulé')
    await this._saveToIndexedDB(build)

    return build
  }

  /**
   * Supprime un build
   */
  async deleteBuild(buildId) {
    const build = this.builds.get(buildId)
    if (!build) throw new Error('Build non trouvé')

    // Libérer l'espace
    this.totalStorageUsed -= build.size || 0

    // Supprimer les logs associés
    const logs = this.buildLogs.get(buildId) || []
    logs.forEach(log => {
      // Supprimer de la DB
    })

    this.builds.delete(buildId)
    this.buildLogs.delete(buildId)

    if (this.db) {
      const tx = this.db.transaction(['builds', 'logs'], 'readwrite')
      tx.objectStore('builds').delete(buildId)
      
      const logStore = tx.objectStore('logs')
      const logIndex = logStore.index('buildId')
      const logRequest = logIndex.openCursor(IDBKeyRange.only(buildId))

      logRequest.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    }

    return { success: true, buildId }
  }

  /**
   * Nettoie les vieux builds
   */
  async cleanupOldBuilds() {
    const now = Date.now()
    const cutoff = now - (BUILD_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    let cleaned = 0

    const buildsToDelete = Array.from(this.builds.values())
      .filter(build => build.createdAt < cutoff && build.status === BUILD_STATUS.SUCCESS)

    for (const build of buildsToDelete) {
      await this.deleteBuild(build.id)
      cleaned++
    }

    if (cleaned > 0) {
      console.log(`🧹 ${cleaned} vieux builds nettoyés`)
    }

    return cleaned
  }

  /**
   * Récupère un build
   */
  async getBuild(buildId) {
    const build = this._getBuild(buildId)
    if (!build) return null

    build.lastAccessed = Date.now()
    await this._saveToIndexedDB(build)

    return {
      ...build,
      logs: this.getBuildLogs(buildId)
    }
  }

  /**
   * Récupère un build (interne)
   */
  _getBuild(buildId) {
    return this.builds.get(buildId)
  }

  /**
   * Liste les builds d'un projet
   */
  async listBuilds(projectId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      status = null,
      type = null,
      environment = null
    } = options

    let builds = Array.from(this.builds.values())
      .filter(b => b.projectId === projectId)

    if (status) builds = builds.filter(b => b.status === status)
    if (type) builds = builds.filter(b => b.type === type)
    if (environment) builds = builds.filter(b => b.environment === environment)

    builds.sort((a, b) => b.createdAt - a.createdAt)

    const paginated = builds.slice(offset, offset + limit)

    return {
      builds: paginated.map(b => ({
        ...b,
        logs: this.getBuildLogs(b.id).slice(-5) // Derniers logs
      })),
      total: builds.length,
      offset,
      limit,
      hasMore: offset + limit < builds.length
    }
  }

  /**
   * Récupère le dernier build réussi
   */
  async getLatestSuccessfulBuild(projectId, environment = BUILD_ENVIRONMENTS.WEB) {
    const builds = Array.from(this.builds.values())
      .filter(b =>
        b.projectId === projectId &&
        b.status === BUILD_STATUS.SUCCESS &&
        b.environment === environment
      )
      .sort((a, b) => b.createdAt - a.createdAt)

    return builds[0] || null
  }

  /**
   * Ajoute un log
   */
  addBuildLog(buildId, level, message) {
    if (!this.buildLogs.has(buildId)) {
      this.buildLogs.set(buildId, [])
    }

    const logs = this.buildLogs.get(buildId)
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      buildId,
      level,
      message,
      timestamp: Date.now()
    }

    logs.push(logEntry)

    if (logs.length > MAX_LOGS_PER_BUILD) {
      logs.shift()
    }

    // Sauvegarder dans IndexedDB
    if (this.db) {
      const tx = this.db.transaction(['logs'], 'readwrite')
      tx.objectStore('logs').put(logEntry)
    }
  }

  /**
   * Récupère les logs d'un build
   */
  getBuildLogs(buildId) {
    return this.buildLogs.get(buildId) || []
  }

  /**
   * Récupère le prochain numéro de build
   */
  async _getNextBuildNumber(projectId) {
    const builds = Array.from(this.builds.values())
      .filter(b => b.projectId === projectId)
    return builds.length + 1
  }

  /**
   * Vérifie le quota
   */
  async _checkQuota() {
    if (this.totalStorageUsed > this.storageQuota) {
      console.warn(`⚠️ Quota stockage dépassé: ${this._formatSize(this.totalStorageUsed)} > ${this._formatSize(this.storageQuota)}`)
      
      // Nettoyage automatique si quota dépassé
      await this.cleanupOldBuilds()
    }
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const builds = Array.from(this.builds.values())
    const byStatus = {}
    const byType = {}
    const byEnvironment = {}

    builds.forEach(b => {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1
      byType[b.type] = (byType[b.type] || 0) + 1
      byEnvironment[b.environment] = (byEnvironment[b.environment] || 0) + 1
    })

    return {
      totalBuilds: builds.length,
      totalStorageUsed: this._formatSize(this.totalStorageUsed),
      storageUsedPercent: (this.totalStorageUsed / this.storageQuota) * 100,
      storageQuota: this._formatSize(this.storageQuota),
      byStatus,
      byType,
      byEnvironment,
      oldestBuild: builds.length > 0
        ? new Date(Math.min(...builds.map(b => b.createdAt))).toISOString()
        : null,
      newestBuild: builds.length > 0
        ? new Date(Math.max(...builds.map(b => b.createdAt))).toISOString()
        : null
    }
  }

  /**
   * Formate la taille
   */
  _formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Ferme la connexion DB
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// =============================
// HOOK PERSONNALISÉ
// =============================

export const useBuildStorage = (userId) => {
  const [storage, setStorage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  const storageRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const buildStorage = new BuildStorage()
        await buildStorage.initialize(userId)

        storageRef.current = buildStorage
        setStorage(buildStorage)
        setStats(buildStorage.getStats())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (userId) init()

    return () => {
      if (storageRef.current) {
        storageRef.current.close()
      }
    }
  }, [userId])

  const createBuild = useCallback(async (projectId, options) => {
    const build = await storage.createBuild(projectId, options)
    setStats(storage.getStats())
    return build
  }, [storage])

  const getBuild = useCallback(async (buildId) => {
    return storage.getBuild(buildId)
  }, [storage])

  const listBuilds = useCallback(async (projectId, options) => {
    return storage.listBuilds(projectId, options)
  }, [storage])

  const getLatestBuild = useCallback(async (projectId, env) => {
    return storage.getLatestSuccessfulBuild(projectId, env)
  }, [storage])

  const deleteBuild = useCallback(async (buildId) => {
    const result = await storage.deleteBuild(buildId)
    setStats(storage.getStats())
    return result
  }, [storage])

  const addBuildLog = useCallback((buildId, level, message) => {
    storage.addBuildLog(buildId, level, message)
  }, [storage])

  const getBuildLogs = useCallback((buildId) => {
    return storage.getBuildLogs(buildId)
  }, [storage])

  const refreshStats = useCallback(() => {
    if (storage) {
      setStats(storage.getStats())
    }
  }, [storage])

  return {
    loading,
    error,
    stats,
    
    // Build operations
    createBuild,
    getBuild,
    listBuilds,
    getLatestBuild,
    deleteBuild,
    
    // Log operations
    addBuildLog,
    getBuildLogs,
    
    // Utils
    refreshStats,
    
    // Constants
    BUILD_STATUS,
    BUILD_TYPES,
    BUILD_ENVIRONMENTS
  }
}

// =============================
// EXPORT
// =============================

export const buildStorage = new BuildStorage()
export default buildStorage
