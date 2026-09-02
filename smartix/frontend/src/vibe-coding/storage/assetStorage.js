/**
 * Gestionnaire de stockage des assets pour le module Vibe-Coding
 * 
 * Rôle: Gérer le stockage et la récupération des assets
 * - Images, icônes, fonts
 * - Fichiers statiques
 * - Optimisation et compression
 * - Gestion des versions
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import { useState, useEffect, useCallback, useRef } from 'react'
import { generateAssetId } from '../utils/idGenerator'
import { projectManager } from '../core/projectManager'
import { crypto } from '../../utils/crypto'

// =============================
// CONFIGURATION
// =============================

const MAX_ASSETS_PER_PROJECT = 500
const MAX_CACHE_SIZE = 100
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Types d'assets supportés
export const ASSET_TYPES = {
  IMAGE: 'image',
  FONT: 'font',
  ICON: 'icon',
  DOCUMENT: 'document',
  VIDEO: 'video',
  AUDIO: 'audio',
  OTHER: 'other'
}

// Extensions par type
const EXTENSION_TYPES = {
  '.png': ASSET_TYPES.IMAGE,
  '.jpg': ASSET_TYPES.IMAGE,
  '.jpeg': ASSET_TYPES.IMAGE,
  '.gif': ASSET_TYPES.IMAGE,
  '.svg': ASSET_TYPES.IMAGE,
  '.webp': ASSET_TYPES.IMAGE,
  '.ico': ASSET_TYPES.ICON,
  '.icns': ASSET_TYPES.ICON,

  '.ttf': ASSET_TYPES.FONT,
  '.otf': ASSET_TYPES.FONT,
  '.woff': ASSET_TYPES.FONT,
  '.woff2': ASSET_TYPES.FONT,
  '.eot': ASSET_TYPES.FONT,

  '.pdf': ASSET_TYPES.DOCUMENT,
  '.doc': ASSET_TYPES.DOCUMENT,
  '.docx': ASSET_TYPES.DOCUMENT,
  '.xls': ASSET_TYPES.DOCUMENT,
  '.xlsx': ASSET_TYPES.DOCUMENT,
  '.ppt': ASSET_TYPES.DOCUMENT,
  '.pptx': ASSET_TYPES.DOCUMENT,
  '.txt': ASSET_TYPES.DOCUMENT,
  '.md': ASSET_TYPES.DOCUMENT,

  '.mp4': ASSET_TYPES.VIDEO,
  '.webm': ASSET_TYPES.VIDEO,
  '.mov': ASSET_TYPES.VIDEO,
  '.avi': ASSET_TYPES.VIDEO,
  '.mkv': ASSET_TYPES.VIDEO,

  '.mp3': ASSET_TYPES.AUDIO,
  '.wav': ASSET_TYPES.AUDIO,
  '.ogg': ASSET_TYPES.AUDIO,
  '.flac': ASSET_TYPES.AUDIO,
  '.aac': ASSET_TYPES.AUDIO
}

// MIME autorisés
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon',
  'font/ttf', 'font/woff', 'font/woff2', 'font/otf',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown'
])

// Tailles maximales (en octets)
const MAX_FILE_SIZES = {
  [ASSET_TYPES.IMAGE]: 10 * 1024 * 1024,      // 10 MB
  [ASSET_TYPES.ICON]: 1 * 1024 * 1024,        // 1 MB
  [ASSET_TYPES.FONT]: 5 * 1024 * 1024,         // 5 MB
  [ASSET_TYPES.DOCUMENT]: 20 * 1024 * 1024,    // 20 MB
  [ASSET_TYPES.VIDEO]: 100 * 1024 * 1024,      // 100 MB
  [ASSET_TYPES.AUDIO]: 50 * 1024 * 1024,       // 50 MB
  [ASSET_TYPES.OTHER]: 10 * 1024 * 1024        // 10 MB
}

// Formats d'image optimisés
const OPTIMIZED_FORMATS = {
  [ASSET_TYPES.IMAGE]: ['webp', 'jpg', 'png']
}

// Qualité de compression (0-100)
const COMPRESSION_QUALITY = {
  high: 90,
  medium: 70,
  low: 50
}

// =============================
// CLASSE ASSET STORAGE
// =============================

class AssetStorage {
  constructor() {
    this.initialized = false
    this.currentProject = null
    this.currentUserId = null
    this.assets = new Map()
    this.assetCache = new Map() // Cache mémoire avec TTL
    this.objectUrls = new Set()  // Pour nettoyage
    this.uploadQueue = []
    this.isProcessingQueue = false
  }

  /**
   * Initialise le storage
   */
  async initialize(projectId, userId) {
    if (this.initialized && this.currentProject?.id === projectId) return

    try {
      await crypto.initialize()

      const project = await projectManager.getProjectById(projectId, userId)
      if (!project) throw new Error('Projet non trouvé')

      this.currentProject = project
      this.currentUserId = userId
      this.initialized = true

      await this._loadAssets()

      console.log(`✅ AssetStorage initialisé pour ${projectId}`)
    } catch (error) {
      console.error('❌ AssetStorage initialization failed:', error)
      throw error
    }
  }

  /**
   * Charge les assets du projet
   */
  async _loadAssets() {
    const projectAssets = this.currentProject.assets || {}
    
    Object.entries(projectAssets).forEach(([id, asset]) => {
      this.assets.set(id, asset)
    })
  }

  /**
   * Détermine le type d'asset à partir du nom
   */
  getAssetType(filename) {
    const index = filename.lastIndexOf('.')
    const ext = index !== -1 ? filename.substring(index).toLowerCase() : ''
    return EXTENSION_TYPES[ext] || ASSET_TYPES.OTHER
  }

  /**
   * Valide un fichier asset
   */
  validateAsset(file, type = null) {
    const errors = []

    if (!file) {
      errors.push('Aucun fichier fourni')
      return { isValid: false, errors }
    }

    if (!ALLOWED_MIME.has(file.type)) {
      errors.push(`Type MIME non autorisé: ${file.type}`)
    }

    const fileType = type || this.getAssetType(file.name)
    const maxSize = MAX_FILE_SIZES[fileType]

    if (file.size > maxSize) {
      errors.push(`Fichier trop volumineux: ${this._formatSize(file.size)} > ${this._formatSize(maxSize)}`)
    }

    // Vérifier les dimensions pour les images (optionnel)
    if (fileType === ASSET_TYPES.IMAGE && file.size > 1024 * 1024) {
      errors.push('Image > 1MB, compression recommandée')
    }

    return {
      isValid: errors.length === 0,
      errors,
      type: fileType,
      warnings: errors.filter(e => e.includes('recommandée'))
    }
  }

  /**
   * Upload un asset
   */
  async uploadAsset(file, options = {}) {
    if (!this.initialized) {
      throw new Error('AssetStorage non initialisé')
    }

    if (this.assets.size >= MAX_ASSETS_PER_PROJECT) {
      throw new Error(`Limite d'assets atteinte (max: ${MAX_ASSETS_PER_PROJECT})`)
    }

    const validation = this.validateAsset(file, options.type)
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '))
    }

    const assetId = generateAssetId()
    const timestamp = Date.now()

    // Lire le fichier selon l'option
    let content
    let objectUrl = null

    if (options.storeAsBlob) {
      objectUrl = URL.createObjectURL(file)
      this.objectUrls.add(objectUrl)
      content = objectUrl
    } else {
      content = await this._readFileAsBase64(file)
    }

    // Extraire les métadonnées
    const metadata = await this._extractMetadata(file, validation.type)

    // Calculer le hash du fichier (pour détection des doublons)
    const hash = await this._computeFileHash(file)

    // Vérifier les doublons
    const existing = this._findDuplicate(hash)
    if (existing) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
        this.objectUrls.delete(objectUrl)
      }
      return { success: true, asset: existing, duplicate: true }
    }

    const asset = {
      id: assetId,
      name: file.name,
      type: validation.type,
      extension: file.name.substring(file.name.lastIndexOf('.')).toLowerCase(),
      size: file.size,
      mimeType: file.type,
      content,
      hash,
      url: this._generateAssetUrl(assetId, file.name),
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      tags: options.tags || []
    }

    await this._saveAsset(asset)

    return { success: true, asset, duplicate: false }
  }

  /**
   * Upload multiple assets
   */
  async uploadMultipleAssets(files, options = {}) {
    const results = await Promise.allSettled(
      files.map(file => this.uploadAsset(file, options))
    )

    const success = []
    const failed = []
    const duplicates = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.duplicate) {
          duplicates.push(result.value.asset)
        } else {
          success.push(result.value.asset)
        }
      } else {
        failed.push({
          file: files[index].name,
          error: result.reason.message
        })
      }
    })

    return {
      success,
      duplicates,
      failed,
      total: files.length,
      successCount: success.length,
      duplicateCount: duplicates.length,
      failedCount: failed.length
    }
  }

  /**
   * Récupère un asset
   */
  async getAsset(assetId, options = {}) {
    // Vérifier le cache
    const cached = this._getFromCache(assetId)
    if (cached && !options.forceRefresh) {
      return cached
    }

    const asset = this.assets.get(assetId)
    if (!asset) {
      throw new Error(`Asset ${assetId} non trouvé`)
    }

    this._setCache(assetId, asset)

    return asset
  }

  /**
   * Liste tous les assets
   */
  listAssets(options = {}) {
    const { type = null, tag = null, limit = null } = options

    let assets = Array.from(this.assets.values())

    if (type) {
      assets = assets.filter(a => a.type === type)
    }

    if (tag) {
      assets = assets.filter(a => a.tags?.includes(tag))
    }

    assets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    if (limit) {
      assets = assets.slice(0, limit)
    }

    return assets.map(this._sanitizeAsset)
  }

  /**
   * Supprime un asset
   */
  async deleteAsset(assetId) {
    const asset = this.assets.get(assetId)
    if (!asset) {
      throw new Error('Asset non trouvé')
    }

    // Vérifier si l'asset est utilisé
    const usage = this.getAssetUsage(assetId)
    if (usage.length > 0) {
      throw new Error(`Asset utilisé dans ${usage.length} fichier(s): ${usage.join(', ')}`)
    }

    // Nettoyer l'ObjectURL si nécessaire
    if (asset.content?.startsWith('blob:')) {
      URL.revokeObjectURL(asset.content)
      this.objectUrls.delete(asset.content)
    }

    this.assets.delete(assetId)
    this.assetCache.delete(assetId)

    await this._updateProjectAssets()

    return { success: true, assetId }
  }

  /**
   * Optimise une image
   */
  async optimizeImage(assetId, options = {}) {
    const asset = await this.getAsset(assetId)

    if (asset.type !== ASSET_TYPES.IMAGE) {
      throw new Error('Asset non image')
    }

    const quality = options.quality || 'medium'
    const format = options.format || 'webp'

    // TODO: Implémenter la vraie compression d'image
    // Utiliser canvas, sharp, ou une API externe

    const optimizedAsset = {
      ...asset,
      id: generateAssetId(),
      name: `optimized_${asset.name.replace(/\.\w+$/, '')}.${format}`,
      size: Math.floor(asset.size * 0.7), // Simulation: 30% de réduction
      content: asset.content, // Garder le contenu original pour l'instant
      metadata: {
        ...asset.metadata,
        optimized: true,
        originalAsset: assetId,
        quality,
        format,
        compression: `${Math.round((1 - 0.7) * 100)}%`
      },
      createdAt: new Date().toISOString(),
      version: 1
    }

    await this._saveAsset(optimizedAsset)

    return { success: true, asset: optimizedAsset }
  }

  /**
   * Trouve où un asset est utilisé
   */
  getAssetUsage(assetId) {
    const files = this.currentProject.files || {}
    const usage = []

    Object.entries(files).forEach(([path, content]) => {
      if (content.includes(assetId) || content.includes(`url('${assetId}`)) {
        usage.push(path)
      }
    })

    return usage
  }

  /**
   * Recherche des assets
   */
  searchAssets(query, options = {}) {
    if (!query) return this.listAssets(options)

    const q = query.toLowerCase()
    const { type = null, limit = 20 } = options

    let results = Array.from(this.assets.values())

    if (type) {
      results = results.filter(a => a.type === type)
    }

    results = results.filter(asset => 
      asset.name.toLowerCase().includes(q) ||
      asset.tags?.some(tag => tag.toLowerCase().includes(q))
    )

    results.sort((a, b) => {
      // Priorité au nom exact
      if (a.name.toLowerCase() === q) return -1
      if (b.name.toLowerCase() === q) return 1
      return 0
    })

    return results.slice(0, limit).map(this._sanitizeAsset)
  }

  /**
   * Met à jour les métadonnées d'un asset
   */
  async updateAssetMetadata(assetId, metadata) {
    const asset = await this.getAsset(assetId)

    const updated = {
      ...asset,
      metadata: { ...asset.metadata, ...metadata },
      updatedAt: new Date().toISOString()
    }

    this.assets.set(assetId, updated)
    this.assetCache.delete(assetId)

    await this._updateProjectAssets()

    return updated
  }

  /**
   * Ajoute des tags à un asset
   */
  async addTags(assetId, tags) {
    const asset = await this.getAsset(assetId)

    const newTags = Array.from(new Set([...(asset.tags || []), ...tags]))

    const updated = {
      ...asset,
      tags: newTags,
      updatedAt: new Date().toISOString()
    }

    this.assets.set(assetId, updated)
    this.assetCache.delete(assetId)

    await this._updateProjectAssets()

    return updated
  }

  /**
   * Supprime des tags
   */
  async removeTags(assetId, tags) {
    const asset = await this.getAsset(assetId)

    const newTags = (asset.tags || []).filter(t => !tags.includes(t))

    const updated = {
      ...asset,
      tags: newTags,
      updatedAt: new Date().toISOString()
    }

    this.assets.set(assetId, updated)
    this.assetCache.delete(assetId)

    await this._updateProjectAssets()

    return updated
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const assets = Array.from(this.assets.values())

    const stats = {
      total: assets.length,
      totalSize: 0,
      byType: {},
      byExtension: {},
      totalSizeByType: {},
      oldest: null,
      newest: null,
      averageSize: 0
    }

    assets.forEach(a => {
      stats.totalSize += a.size

      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1
      stats.totalSizeByType[a.type] = (stats.totalSizeByType[a.type] || 0) + a.size
      stats.byExtension[a.extension] = (stats.byExtension[a.extension] || 0) + 1
    })

    if (assets.length > 0) {
      stats.oldest = assets.reduce((a, b) => a.createdAt < b.createdAt ? a : b)
      stats.newest = assets.reduce((a, b) => a.createdAt > b.createdAt ? a : b)
      stats.averageSize = stats.totalSize / assets.length
    }

    // Formater les tailles
    stats.totalSizeFormatted = this._formatSize(stats.totalSize)
    stats.averageSizeFormatted = this._formatSize(stats.averageSize)
    Object.keys(stats.totalSizeByType).forEach(type => {
      stats.totalSizeByType[type] = this._formatSize(stats.totalSizeByType[type])
    })

    return stats
  }

  /**
   * Nettoie les ObjectURLs
   */
  cleanup() {
    this.objectUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // Ignorer
      }
    })
    this.objectUrls.clear()
    this.assetCache.clear()
  }

  // =============================
  // MÉTHODES PRIVÉES
  // =============================

  /**
   * Lit un fichier en base64
   */
  _readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Extrait les métadonnées d'un fichier
   */
  async _extractMetadata(file, type) {
    const metadata = {
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    }

    if (type === ASSET_TYPES.IMAGE) {
      try {
        const dimensions = await this._extractImageDimensions(file)
        Object.assign(metadata, dimensions)
      } catch {
        // Ignorer les erreurs
      }
    }

    return metadata
  }

  /**
   * Extrait les dimensions d'une image
   */
  _extractImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(img.src)
        resolve({
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height
        })
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Calcule le hash d'un fichier
   */
  async _computeFileHash(file) {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Trouve un doublon par hash
   */
  _findDuplicate(hash) {
    for (const asset of this.assets.values()) {
      if (asset.hash === hash) {
        return asset
      }
    }
    return null
  }

  /**
   * Génère l'URL d'un asset
   */
  _generateAssetUrl(assetId, filename = '') {
    const base = '/api'
    const path = `/assets/${this.currentUserId}/${this.currentProject.id}/${assetId}/${filename}`
    return base + path
  }

  /**
   * Sauvegarde un asset
   */
  async _saveAsset(asset) {
    this.assets.set(asset.id, asset)
    this._setCache(asset.id, asset)
    await this._updateProjectAssets()
  }

  /**
   * Met à jour les assets du projet
   */
  async _updateProjectAssets() {
    const assets = {}
    this.assets.forEach((v, k) => assets[k] = v)

    await projectManager.updateProject(
      this.currentProject.id,
      { assets },
      this.currentUserId
    )
  }

  /**
   * Nettoie un asset pour l'affichage (sans contenu)
   */
  _sanitizeAsset(asset) {
    const { content, ...rest } = asset
    return rest
  }

  /**
   * Récupère du cache
   */
  _getFromCache(key) {
    const cached = this.assetCache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.assetCache.delete(key)
      return null
    }

    return cached.data
  }

  /**
   * Stocke dans le cache
   */
  _setCache(key, data) {
    if (this.assetCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.assetCache.keys().next().value
      this.assetCache.delete(oldestKey)
    }

    this.assetCache.set(key, {
      data,
      timestamp: Date.now()
    })
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
}

// =============================
// HOOK PERSONNALISÉ
// =============================

export const useAssetStorage = (projectId, userId) => {
  const [storage, setStorage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [assets, setAssets] = useState([])
  const [stats, setStats] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)

  const storageRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const instance = new AssetStorage()
        await instance.initialize(projectId, userId)

        storageRef.current = instance
        setStorage(instance)
        setAssets(instance.listAssets())
        setStats(instance.getStats())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (projectId && userId) {
      init()
    }

    return () => {
      if (storageRef.current) {
        storageRef.current.cleanup()
      }
    }
  }, [projectId, userId])

  const refresh = useCallback(async () => {
    if (!storageRef.current) return
    setAssets(storageRef.current.listAssets())
    setStats(storageRef.current.getStats())
  }, [])

  const uploadAsset = useCallback(async (file, options) => {
    if (!storageRef.current) throw new Error('Storage non initialisé')

    setUploadProgress({ status: 'uploading', progress: 0 })
    try {
      const result = await storageRef.current.uploadAsset(file, options)
      await refresh()
      setUploadProgress({ status: 'success', progress: 100 })
      return result
    } catch (err) {
      setUploadProgress({ status: 'error', error: err.message })
      throw err
    }
  }, [refresh])

  const uploadMultipleAssets = useCallback(async (files, options) => {
    if (!storageRef.current) throw new Error('Storage non initialisé')

    setUploadProgress({ status: 'uploading', progress: 0, total: files.length })
    try {
      const result = await storageRef.current.uploadMultipleAssets(files, options)
      await refresh()
      setUploadProgress({ status: 'success', progress: 100, result })
      return result
    } catch (err) {
      setUploadProgress({ status: 'error', error: err.message })
      throw err
    }
  }, [refresh])

  const deleteAsset = useCallback(async (assetId) => {
    if (!storageRef.current) throw new Error('Storage non initialisé')
    const result = await storageRef.current.deleteAsset(assetId)
    await refresh()
    return result
  }, [refresh])

  const getAsset = useCallback(async (assetId, options) => {
    if (!storageRef.current) throw new Error('Storage non initialisé')
    return storageRef.current.getAsset(assetId, options)
  }, [])

  const searchAssets = useCallback((query, options) => {
    if (!storageRef.current) return []
    return storageRef.current.searchAssets(query, options)
  }, [])

  const optimizeImage = useCallback(async (assetId, options) => {
    if (!storageRef.current) throw new Error('Storage non initialisé')
    const result = await storageRef.current.optimizeImage(assetId, options)
    await refresh()
    return result
  }, [refresh])

  const addTags = useCallback(async (assetId, tags) => {
    if (!storageRef.current) throw new Error('Storage non initialisé')
    const result = await storageRef.current.addTags(assetId, tags)
    await refresh()
    return result
  }, [refresh])

  const removeTags = useCallback(async (assetId, tags) => {
    if (!storageRef.current) throw new Error('Storage non initialisé')
    const result = await storageRef.current.removeTags(assetId, tags)
    await refresh()
    return result
  }, [refresh])

  return {
    loading,
    error,
    assets,
    stats,
    uploadProgress,
    
    // Actions
    uploadAsset,
    uploadMultipleAssets,
    deleteAsset,
    getAsset,
    searchAssets,
    optimizeImage,
    addTags,
    removeTags,
    refresh,
    
    // Constantes
    ASSET_TYPES,
    MAX_FILE_SIZES
  }
}

// =============================
// EXPORT
// =============================

export const assetStorage = new AssetStorage()
export default assetStorage
