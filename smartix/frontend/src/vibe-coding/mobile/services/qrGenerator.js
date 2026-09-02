/**
 * qrGenerator - Génération de QR codes pour installation et preview
 * 
 * Rôle: Créer des QR codes pour:
 * - Installation APK
 * - Live preview
 * - Partage de sessions
 * - Reconnexion automatique
 */

import QRCode from 'qrcode'
import crypto from 'crypto'
import { logger } from '../utils/logger'

// =============================
// CONFIGURATION
// =============================

const DEFAULT_OPTIONS = {
  size: 300,
  margin: 1,
  color: {
    dark: '#000000',
    light: '#ffffff'
  },
  errorCorrection: 'M' // L, M, Q, H
}

const SUPPORTED_FORMATS = ['png', 'svg', 'utf8']
const MAX_CACHE_ITEMS = 50
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1h

// =============================
// CLASSE PRINCIPALE
// =============================

export class QRGenerator {
  constructor() {
    this.cache = new Map() // hash -> { value, timestamp, size }
    this.stats = {
      totalGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheSize: 0,
      totalBytes: 0
    }
    this.logger = logger.createChild('QRGenerator')

    // Nettoyage automatique du cache
    this.cleanupInterval = setInterval(() => {
      this._cleanupCache()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Génère un QR code
   * @param {string} data - Données à encoder (URL, texte)
   * @param {Object} options - Options de génération
   * @returns {Promise<string>} QR code en base64 ou SVG
   */
  async generate(data, options = {}) {
    if (!data) {
      throw new Error('Données requises pour générer un QR code')
    }

    const {
      size = DEFAULT_OPTIONS.size,
      margin = DEFAULT_OPTIONS.margin,
      color = DEFAULT_OPTIONS.color,
      errorCorrection = DEFAULT_OPTIONS.errorCorrection,
      format = 'png'
    } = options

    // Validation du format
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Format non supporté: ${format}. Utilisez: ${SUPPORTED_FORMATS.join(', ')}`)
    }

    // Générer une clé de cache hashée
    const cacheKey = this._generateCacheKey(data, options)

    // Vérifier le cache
    const cached = this._getFromCache(cacheKey)
    if (cached) {
      this.stats.cacheHits++
      return cached
    }
    this.stats.cacheMisses++

    try {
      let qrCode
      let qrSize = 0

      // Configuration selon le format
      const qrOptions = {
        errorCorrectionLevel: errorCorrection,
        margin,
        color,
        width: size
      }

      const startTime = Date.now()

      if (format === 'svg') {
        qrCode = await this._generateSVG(data, qrOptions)
        qrSize = qrCode.length
      } else if (format === 'utf8') {
        qrCode = await this._generateUTF8(data, qrOptions)
        qrSize = qrCode.length
      } else {
        // PNG par défaut (base64)
        qrCode = await QRCode.toDataURL(data, qrOptions)
        qrSize = qrCode.length
      }

      const generationTime = Date.now() - startTime

      this.stats.totalGenerated++
      this.stats.totalBytes += qrSize

      // Mettre en cache
      this._setCache(cacheKey, qrCode, qrSize)

      this.logger.info(`QR code généré`, {
        format,
        size,
        qrSize: `${Math.round(qrSize / 1024)}KB`,
        time: `${generationTime}ms`,
        hash: cacheKey.substring(0, 8),
        type: data.startsWith('ws://') ? 'websocket' : 
              data.includes('install') ? 'install' : 'preview'
      })

      return qrCode

    } catch (error) {
      this.logger.error(`Erreur génération QR`, { 
        error: error.message,
        format,
        size
      })
      throw new Error(`Impossible de générer le QR code: ${error.message}`)
    }
  }

  /**
   * Génère un QR code pour installation APK
   */
  async generateInstallQR(downloadUrl, options = {}) {
    // URL enrichie avec métadonnées
    const enhancedUrl = this._enhanceUrl(downloadUrl, {
      type: 'install',
      timestamp: Date.now()
    })

    return this.generate(enhancedUrl, {
      ...options,
      format: options.format || 'png',
      errorCorrection: 'H' // Haute correction pour installation (important)
    })
  }

  /**
   * Génère un QR code pour preview en direct
   */
  async generatePreviewQR(previewUrl, sessionId, projectId, token = null) {
    // URL enrichie avec sessionId et token
    const enhancedUrl = this._buildPreviewUrl(previewUrl, sessionId, projectId, token)

    return this.generate(enhancedUrl, {
      format: 'png',
      errorCorrection: 'M',
      size: 300
    })
  }

  /**
   * Génère un QR code de session (pour partage)
   */
  async generateSessionQR(session) {
    const sessionData = {
      type: 'session',
      sessionId: session.id,
      projectId: session.projectId,
      wsUrl: session.wsUrl,
      previewUrl: session.previewUrl,
      expiresAt: session.expiresAt,
      token: session.token || crypto.randomBytes(16).toString('hex')
    }

    const data = JSON.stringify(sessionData)
    
    return this.generate(data, {
      format: 'png',
      errorCorrection: 'Q', // Qualité élevée pour données structurées
      size: 400 // Plus grand pour plus de données
    })
  }

  /**
   * Génère plusieurs QR codes en parallèle
   */
  async generateBatch(items) {
    const startTime = Date.now()
    
    const promises = items.map(async (item) => {
      try {
        const qr = await this.generate(item.data, item.options)
        return {
          id: item.id,
          data: item.data,
          qr,
          success: true,
          time: Date.now() - startTime
        }
      } catch (error) {
        return {
          id: item.id,
          data: item.data,
          error: error.message,
          success: false
        }
      }
    })

    const results = await Promise.all(promises)
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    this.logger.info(`Batch généré`, {
      total: items.length,
      success: successCount,
      failed: failCount,
      time: `${Date.now() - startTime}ms`
    })

    return results
  }

  /**
   * Construit une URL de preview enrichie
   */
  _buildPreviewUrl(baseUrl, sessionId, projectId, token = null) {
    const url = new URL(baseUrl)
    url.searchParams.set('session', sessionId)
    url.searchParams.set('project', projectId)
    if (token) {
      url.searchParams.set('token', token)
    }
    return url.toString()
  }

  /**
   * Enrichit une URL avec des métadonnées
   */
  _enhanceUrl(url, metadata) {
    try {
      const urlObj = new URL(url)
      Object.entries(metadata).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value.toString())
      })
      return urlObj.toString()
    } catch {
      // Si ce n'est pas une URL valide, on retourne la donnée brute
      return url
    }
  }

  /**
   * Génère un QR code au format SVG
   */
  async _generateSVG(data, options) {
    return new Promise((resolve, reject) => {
      QRCode.toString(data, {
        ...options,
        type: 'svg'
      }, (err, svg) => {
        if (err) reject(err)
        else resolve(svg)
      })
    })
  }

  /**
   * Génère un QR code au format UTF8 (terminal)
   */
  async _generateUTF8(data, options) {
    return new Promise((resolve, reject) => {
      QRCode.toString(data, {
        ...options,
        type: 'terminal'
      }, (err, utf8) => {
        if (err) reject(err)
        else resolve(utf8)
      })
    })
  }

  /**
   * Génère un QR code avec logo au centre
   */
  async generateWithLogo(data, logoBase64, options = {}) {
    const qr = await this.generate(data, { ...options, format: 'png' })
    
    // Fusionner QR et logo (nécessite une librairie de manipulation d'images)
    // TODO: Implémenter si nécessaire
    return qr
  }

  /**
   * Génère une clé de cache hashée
   */
  _generateCacheKey(data, options) {
    const raw = data + JSON.stringify(options)
    return crypto.createHash('sha1').update(raw).digest('hex')
  }

  /**
   * Récupère du cache
   */
  _getFromCache(key) {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(key)
      this.stats.cacheSize = this.cache.size
      return null
    }

    return cached.value
  }

  /**
   * Stocke dans le cache
   */
  _setCache(key, value, size) {
    // Nettoyer si trop gros
    if (this.cache.size >= MAX_CACHE_ITEMS) {
      const oldestKey = this.cache.keys().next().value
      const oldest = this.cache.get(oldestKey)
      this.stats.totalBytes -= oldest.size || 0
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      size
    })

    this.stats.cacheSize = this.cache.size
  }

  /**
   * Nettoie le cache expiré
   */
  _cleanupCache() {
    const now = Date.now()
    let cleaned = 0
    let bytesFreed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        bytesFreed += entry.size || 0
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.stats.totalBytes -= bytesFreed
      this.stats.cacheSize = this.cache.size
      this.logger.info(`Cache nettoyé`, {
        removed: cleaned,
        bytesFreed: `${Math.round(bytesFreed / 1024)}KB`,
        remaining: this.cache.size
      })
    }
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear()
    this.stats.cacheSize = 0
    this.stats.totalBytes = 0
    this.logger.info('Cache QR vidé')
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses
    return {
      ...this.stats,
      hitRate: totalRequests > 0
        ? Math.round(this.stats.cacheHits / totalRequests * 100)
        : 0,
      cacheMemory: `${Math.round(this.stats.totalBytes / 1024)}KB`,
      averageSize: this.stats.totalGenerated > 0
        ? `${Math.round(this.stats.totalBytes / this.stats.totalGenerated / 1024)}KB`
        : '0KB'
    }
  }

  /**
   * Arrête le nettoyage automatique
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clearCache()
  }
}

export const qrGenerator = new QRGenerator()

export default qrGenerator
