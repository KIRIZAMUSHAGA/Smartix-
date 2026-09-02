/**
 * urlGenerator - Utilitaire de génération d'URL
 * 
 * Rôle: Générer des URLs pour les différents services
 * - URLs de téléchargement
 * - URLs de preview
 * - URLs de partage
 * - QR codes
 * - URLs signées (expiration, signature HMAC)
 * - IP restriction
 * - Analytics
 * - Short links
 */

import { EventEmitter } from 'events'
import { logger } from './logger'
import { crypto } from '../../utils/crypto'

// =============================
// CONFIGURATION
// =============================

const DEFAULT_BASE_URL = process.env.APP_URL || 'https://app.smartix.com'
const DEFAULT_CDN_URL = process.env.CDN_URL || 'https://cdn.smartix.com'
const DEFAULT_PREVIEW_URL = process.env.PREVIEW_URL || 'https://preview.smartix.com'
const DEFAULT_API_URL = process.env.API_URL || 'https://api.smartix.com'
const DEFAULT_SHORT_URL = process.env.SHORT_URL || 'https://s.smartix.com'

const URL_TYPES = {
  DOWNLOAD: 'download',
  PREVIEW: 'preview',
  API: 'api',
  CDN: 'cdn',
  SHARE: 'share',
  QR: 'qr',
  DEVICE: 'device',
  SHORT: 'short'
}

const URL_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  USED: 'used'
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class URLGenerator extends EventEmitter {
  constructor(options = {}) {
    super()
    this.urls = new Map() // urlId -> urlInfo
    this.tokens = new Map() // token -> urlId
    this.shortLinks = new Map() // shortCode -> urlId
    this.typeIndex = new Map() // type -> Set(urlId)
    this.stats = {
      totalGenerated: 0,
      activeUrls: 0,
      expiredUrls: 0,
      revokedUrls: 0,
      totalAccesses: 0,
      uniqueVisitors: 0
    }
    this.config = {
      baseUrl: options.baseUrl || DEFAULT_BASE_URL,
      cdnUrl: options.cdnUrl || DEFAULT_CDN_URL,
      previewUrl: options.previewUrl || DEFAULT_PREVIEW_URL,
      apiUrl: options.apiUrl || DEFAULT_API_URL,
      shortUrl: options.shortUrl || DEFAULT_SHORT_URL,
      secret: options.secret || process.env.URL_SECRET || 'default-secret-change-me',
      defaultExpiry: options.defaultExpiry || 24 * 60 * 60 * 1000, // 24h
      tokenLength: options.tokenLength || 32,
      ...options
    }
    this.logger = logger.createChild('URLGenerator')

    // Nettoyage périodique des URLs expirées
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredUrls()
    }, 60 * 60 * 1000) // 1h
  }

  /**
   * Génère une signature HMAC
   */
  _generateSignature(token, data = '') {
    const message = `${token}:${data}`
    return crypto.createHmac(message, this.config.secret)
  }

  /**
   * Génère un token unique
   */
  _generateToken() {
    const bytes = crypto.randomBytes(this.config.tokenLength / 2)
    return bytes.toString('hex')
  }

  /**
   * Génère un short code
   */
  _generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Ajoute aux index
   */
  _addToIndex(urlInfo) {
    if (!this.typeIndex.has(urlInfo.type)) {
      this.typeIndex.set(urlInfo.type, new Set())
    }
    this.typeIndex.get(urlInfo.type).add(urlInfo.id)
  }

  /**
   * Supprime des index
   */
  _removeFromIndex(urlInfo) {
    const typeSet = this.typeIndex.get(urlInfo.type)
    if (typeSet) {
      typeSet.delete(urlInfo.id)
      if (typeSet.size === 0) {
        this.typeIndex.delete(urlInfo.type)
      }
    }
  }

  /**
   * Génère une URL de téléchargement
   */
  generateDownloadUrl(fileId, options = {}) {
    const {
      expiresIn = this.config.defaultExpiry,
      singleUse = false,
      fileName = null,
      allowedIPs = null,
      metadata = {}
    } = options

    const token = this._generateToken()
    const signature = this._generateSignature(token, fileId)
    const urlId = `url_${Date.now()}_${crypto.randomToken(8)}`
    const shortCode = this._generateShortCode()
    const expiresAt = Date.now() + expiresIn

    const urlInfo = {
      id: urlId,
      type: URL_TYPES.DOWNLOAD,
      fileId,
      token,
      signature,
      shortCode,
      url: `${this.config.cdnUrl}/download/${fileId}?token=${token}&sig=${signature}`,
      directUrl: `${this.config.cdnUrl}/files/${fileId}`,
      shortUrl: `${this.config.shortUrl}/${shortCode}`,
      expiresAt,
      singleUse,
      used: false,
      fileName,
      allowedIPs,
      metadata,
      status: URL_STATUS.ACTIVE,
      createdAt: Date.now(),
      accessCount: 0,
      uniqueVisitors: new Set(),
      lastAccess: null,
      lastIP: null,
      userAgents: []
    }

    this.urls.set(urlId, urlInfo)
    this.tokens.set(token, urlId)
    this.shortLinks.set(shortCode, urlId)
    this._addToIndex(urlInfo)
    this.stats.totalGenerated++
    this.stats.activeUrls++

    this._addLog(`URL de téléchargement générée`, { urlId, fileId, expiresIn })

    this.emit('url:generated', {
      urlId,
      type: URL_TYPES.DOWNLOAD,
      fileId,
      expiresAt
    })

    return {
      urlId,
      url: urlInfo.url,
      directUrl: urlInfo.directUrl,
      shortUrl: urlInfo.shortUrl,
      token,
      signature,
      shortCode,
      expiresAt,
      singleUse
    }
  }

  /**
   * Génère une URL de preview
   */
  generatePreviewUrl(projectId, sessionId, options = {}) {
    const {
      expiresIn = this.config.defaultExpiry,
      password = null,
      allowedIPs = null,
      metadata = {}
    } = options

    const token = this._generateToken()
    const signature = this._generateSignature(token, sessionId)
    const urlId = `url_${Date.now()}_${crypto.randomToken(8)}`
    const shortCode = this._generateShortCode()
    const expiresAt = Date.now() + expiresIn

    const urlInfo = {
      id: urlId,
      type: URL_TYPES.PREVIEW,
      projectId,
      sessionId,
      token,
      signature,
      shortCode,
      url: `${this.config.previewUrl}/preview/${sessionId}?token=${token}&sig=${signature}`,
      embedUrl: `${this.config.previewUrl}/embed/${sessionId}?token=${token}&sig=${signature}`,
      qrUrl: `${this.config.previewUrl}/qr/${sessionId}?token=${token}`,
      shortUrl: `${this.config.shortUrl}/${shortCode}`,
      expiresAt,
      password,
      allowedIPs,
      metadata,
      status: URL_STATUS.ACTIVE,
      createdAt: Date.now(),
      accessCount: 0,
      uniqueVisitors: new Set(),
      lastAccess: null,
      lastIP: null,
      userAgents: []
    }

    this.urls.set(urlId, urlInfo)
    this.tokens.set(token, urlId)
    this.shortLinks.set(shortCode, urlId)
    this._addToIndex(urlInfo)
    this.stats.totalGenerated++
    this.stats.activeUrls++

    this._addLog(`URL de preview générée`, { urlId, projectId, sessionId, expiresIn })

    this.emit('url:generated', {
      urlId,
      type: URL_TYPES.PREVIEW,
      projectId,
      sessionId,
      expiresAt
    })

    return {
      urlId,
      url: urlInfo.url,
      embedUrl: urlInfo.embedUrl,
      qrUrl: urlInfo.qrUrl,
      shortUrl: urlInfo.shortUrl,
      token,
      signature,
      shortCode,
      expiresAt,
      hasPassword: !!password
    }
  }

  /**
   * Génère une URL pour un appareil spécifique
   */
  generateDevicePreviewUrl(deviceId, options = {}) {
    const {
      expiresIn = this.config.defaultExpiry,
      allowedIPs = null,
      metadata = {}
    } = options

    const token = this._generateToken()
    const signature = this._generateSignature(token, deviceId)
    const urlId = `url_${Date.now()}_${crypto.randomToken(8)}`
    const shortCode = this._generateShortCode()
    const expiresAt = Date.now() + expiresIn

    const urlInfo = {
      id: urlId,
      type: URL_TYPES.DEVICE,
      deviceId,
      token,
      signature,
      shortCode,
      url: `${this.config.previewUrl}/device/${deviceId}?token=${token}&sig=${signature}`,
      shortUrl: `${this.config.shortUrl}/${shortCode}`,
      expiresAt,
      allowedIPs,
      metadata,
      status: URL_STATUS.ACTIVE,
      createdAt: Date.now(),
      accessCount: 0,
      uniqueVisitors: new Set(),
      lastAccess: null,
      lastIP: null,
      userAgents: []
    }

    this.urls.set(urlId, urlInfo)
    this.tokens.set(token, urlId)
    this.shortLinks.set(shortCode, urlId)
    this._addToIndex(urlInfo)
    this.stats.totalGenerated++
    this.stats.activeUrls++

    this._addLog(`URL device générée`, { urlId, deviceId, expiresIn })

    return {
      urlId,
      url: urlInfo.url,
      shortUrl: urlInfo.shortUrl,
      token,
      signature,
      shortCode,
      expiresAt
    }
  }

  /**
   * Génère une URL API
   */
  generateApiUrl(endpoint, options = {}) {
    const {
      expiresIn = this.config.defaultExpiry,
      method = 'GET',
      params = {},
      headers = {},
      allowedIPs = null,
      metadata = {}
    } = options

    const token = this._generateToken()
    const signature = this._generateSignature(token, endpoint)
    const urlId = `url_${Date.now()}_${crypto.randomToken(8)}`
    const shortCode = this._generateShortCode()
    const expiresAt = Date.now() + expiresIn

    // Construire l'URL avec les paramètres
    const url = new URL(`${this.config.apiUrl}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
    url.searchParams.append('token', token)
    url.searchParams.append('sig', signature)

    const urlInfo = {
      id: urlId,
      type: URL_TYPES.API,
      endpoint,
      method,
      token,
      signature,
      shortCode,
      url: url.toString(),
      shortUrl: `${this.config.shortUrl}/${shortCode}`,
      expiresAt,
      headers,
      allowedIPs,
      metadata,
      status: URL_STATUS.ACTIVE,
      createdAt: Date.now(),
      accessCount: 0,
      uniqueVisitors: new Set(),
      lastAccess: null,
      lastIP: null,
      userAgents: []
    }

    this.urls.set(urlId, urlInfo)
    this.tokens.set(token, urlId)
    this.shortLinks.set(shortCode, urlId)
    this._addToIndex(urlInfo)
    this.stats.totalGenerated++
    this.stats.activeUrls++

    this._addLog(`URL API générée`, { urlId, endpoint, method, expiresIn })

    return {
      urlId,
      url: urlInfo.url,
      shortUrl: urlInfo.shortUrl,
      token,
      signature,
      shortCode,
      expiresAt,
      method,
      headers
    }
  }

  /**
   * Génère une URL de partage
   */
  generateShareUrl(content, options = {}) {
    const {
      expiresIn = this.config.defaultExpiry,
      password = null,
      maxUses = null,
      allowedIPs = null,
      metadata = {}
    } = options

    const token = this._generateToken()
    const signature = this._generateSignature(token, content)
    const urlId = `url_${Date.now()}_${crypto.randomToken(8)}`
    const shortCode = this._generateShortCode()
    const expiresAt = Date.now() + expiresIn

    const urlInfo = {
      id: urlId,
      type: URL_TYPES.SHARE,
      content,
      token,
      signature,
      shortCode,
      url: `${this.config.baseUrl}/share/${shortCode}`,
      embedUrl: `${this.config.baseUrl}/embed/${shortCode}`,
      expiresAt,
      password,
      maxUses,
      uses: 0,
      allowedIPs,
      metadata,
      status: URL_STATUS.ACTIVE,
      createdAt: Date.now(),
      accessCount: 0,
      uniqueVisitors: new Set(),
      lastAccess: null,
      lastIP: null,
      userAgents: []
    }

    this.urls.set(urlId, urlInfo)
    this.tokens.set(token, urlId)
    this.shortLinks.set(shortCode, urlId)
    this._addToIndex(urlInfo)
    this.stats.totalGenerated++
    this.stats.activeUrls++

    this._addLog(`URL de partage générée`, { urlId, expiresIn, maxUses })

    this.emit('url:generated', {
      urlId,
      type: URL_TYPES.SHARE,
      expiresAt,
      maxUses
    })

    return {
      urlId,
      url: urlInfo.url,
      embedUrl: urlInfo.embedUrl,
      shortUrl: urlInfo.shortUrl,
      token,
      signature,
      shortCode,
      expiresAt,
      hasPassword: !!password,
      maxUses
    }
  }

  /**
   * Génère une URL pour QR code
   */
  generateQRUrl(content, options = {}) {
    const {
      expiresIn = this.config.defaultExpiry,
      size = 300,
      format = 'png',
      metadata = {}
    } = options

    const token = this._generateToken()
    const signature = this._generateSignature(token, content)
    const urlId = `url_${Date.now()}_${crypto.randomToken(8)}`
    const shortCode = this._generateShortCode()
    const expiresAt = Date.now() + expiresIn

    const urlInfo = {
      id: urlId,
      type: URL_TYPES.QR,
      content,
      token,
      signature,
      shortCode,
      url: `${this.config.baseUrl}/qr/${shortCode}?size=${size}&format=${format}`,
      qrData: `${this.config.baseUrl}/qr/${shortCode}/data`,
      shortUrl: `${this.config.shortUrl}/${shortCode}`,
      qrValue: content,
      expiresAt,
      size,
      format,
      metadata,
      status: URL_STATUS.ACTIVE,
      createdAt: Date.now(),
      accessCount: 0,
      uniqueVisitors: new Set(),
      lastAccess: null,
      lastIP: null,
      userAgents: []
    }

    this.urls.set(urlId, urlInfo)
    this.tokens.set(token, urlId)
    this.shortLinks.set(shortCode, urlId)
    this._addToIndex(urlInfo)
    this.stats.totalGenerated++
    this.stats.activeUrls++

    this._addLog(`URL QR générée`, { urlId, size, format, expiresIn })

    return {
      urlId,
      url: urlInfo.url,
      qrData: urlInfo.qrData,
      shortUrl: urlInfo.shortUrl,
      qrValue: urlInfo.qrValue,
      token,
      signature,
      shortCode,
      expiresAt,
      size,
      format
    }
  }

  /**
   * Valide et récupère une URL
   */
  async getUrl(token, options = {}) {
    const {
      password = null,
      clientIP = null,
      userAgent = null,
      verifySignature = true
    } = options

    const urlId = this.tokens.get(token)
    if (!urlId) {
      // Essayer avec shortCode
      const shortId = this.shortLinks.get(token)
      if (!shortId) {
        throw new Error('URL invalide')
      }
      return this.getUrlById(shortId, { password, clientIP, userAgent, verifySignature: false })
    }

    return this.getUrlById(urlId, { password, clientIP, userAgent, verifySignature })
  }

  /**
   * Récupère une URL par son ID
   */
  async getUrlById(urlId, options = {}) {
    const {
      password = null,
      clientIP = null,
      userAgent = null,
      verifySignature = true
    } = options

    const urlInfo = this.urls.get(urlId)
    if (!urlInfo) {
      throw new Error('URL introuvable')
    }

    // Vérifier l'expiration
    if (urlInfo.expiresAt && urlInfo.expiresAt < Date.now()) {
      urlInfo.status = URL_STATUS.EXPIRED
      this.stats.expiredUrls++
      this.stats.activeUrls--
      this.tokens.delete(urlInfo.token)
      this.shortLinks.delete(urlInfo.shortCode)
      this._removeFromIndex(urlInfo)
      throw new Error('URL expirée')
    }

    // Vérifier la signature si demandé
    if (verifySignature && urlInfo.signature) {
      const expectedSignature = this._generateSignature(urlInfo.token, urlInfo.fileId || urlInfo.sessionId || urlInfo.content)
      if (urlInfo.signature !== expectedSignature) {
        throw new Error('Signature invalide')
      }
    }

    // Vérifier le mot de passe
    if (urlInfo.password && urlInfo.password !== password) {
      throw new Error('Mot de passe incorrect')
    }

    // Vérifier les IPs autorisées
    if (urlInfo.allowedIPs && clientIP && !urlInfo.allowedIPs.includes(clientIP)) {
      throw new Error('IP non autorisée')
    }

    // Vérifier le nombre d'utilisations
    if (urlInfo.maxUses && urlInfo.uses >= urlInfo.maxUses) {
      urlInfo.status = URL_STATUS.USED
      this.tokens.delete(urlInfo.token)
      this.shortLinks.delete(urlInfo.shortCode)
      this._removeFromIndex(urlInfo)
      throw new Error('URL déjà utilisée')
    }

    // Mettre à jour les statistiques
    urlInfo.accessCount++
    urlInfo.lastAccess = Date.now()
    urlInfo.lastIP = clientIP || urlInfo.lastIP
    if (userAgent) {
      urlInfo.userAgents.push(userAgent)
      if (urlInfo.userAgents.length > 10) {
        urlInfo.userAgents.shift()
      }
    }

    // Compter les visiteurs uniques
    if (clientIP) {
      urlInfo.uniqueVisitors.add(clientIP)
    }

    // Si single use, marquer comme utilisé et supprimer
    if (urlInfo.singleUse) {
      urlInfo.status = URL_STATUS.USED
      this.tokens.delete(urlInfo.token)
      this.shortLinks.delete(urlInfo.shortCode)
      this._removeFromIndex(urlInfo)
      this.stats.activeUrls--
    }

    this.stats.totalAccesses++
    this.stats.uniqueVisitors = this._countUniqueVisitors()

    this.emit('url:accessed', {
      urlId,
      type: urlInfo.type,
      accessCount: urlInfo.accessCount,
      ip: clientIP,
      userAgent
    })

    // Ne pas retourner les données sensibles
    const { token, signature, password: pwd, allowedIPs, ...safe } = urlInfo
    return {
      ...safe,
      uniqueVisitors: urlInfo.uniqueVisitors.size,
      uniqueVisitorsList: Array.from(urlInfo.uniqueVisitors).slice(0, 10)
    }
  }

  /**
   * Récupère une URL par son short code
   */
  async getUrlByShortCode(shortCode, options = {}) {
    const urlId = this.shortLinks.get(shortCode)
    if (!urlId) {
      throw new Error('Short code invalide')
    }
    return this.getUrlById(urlId, options)
  }

  /**
   * Révoque une URL
   */
  revokeUrl(urlId) {
    const urlInfo = this.urls.get(urlId)
    if (!urlInfo) return false

    if (urlInfo.status === URL_STATUS.ACTIVE) {
      urlInfo.status = URL_STATUS.REVOKED
      this.stats.activeUrls--
      this.stats.revokedUrls++
      
      // Supprimer le token et le short code
      this.tokens.delete(urlInfo.token)
      this.shortLinks.delete(urlInfo.shortCode)
      this._removeFromIndex(urlInfo)

      this._addLog(`URL révoquée`, { urlId, type: urlInfo.type })
      this.emit('url:revoked', { urlId, type: urlInfo.type })
    }

    return true
  }

  /**
   * Prolonge une URL
   */
  extendUrl(urlId, additionalTime = this.config.defaultExpiry) {
    const urlInfo = this.urls.get(urlId)
    if (!urlInfo) return false

    if (urlInfo.status !== URL_STATUS.ACTIVE) {
      return false
    }

    urlInfo.expiresAt += additionalTime

    this._addLog(`URL prolongée`, { urlId, additionalTime })
    this.emit('url:extended', { urlId, expiresAt: urlInfo.expiresAt })

    return true
  }

  /**
   * Nettoie les URLs expirées
   */
  cleanupExpiredUrls() {
    const now = Date.now()
    let cleaned = 0

    for (const [urlId, urlInfo] of this.urls.entries()) {
      if (urlInfo.expiresAt < now) {
        this.tokens.delete(urlInfo.token)
        this.shortLinks.delete(urlInfo.shortCode)
        this._removeFromIndex(urlInfo)
        this.urls.delete(urlId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.stats.activeUrls = this.urls.size
      this.stats.expiredUrls += cleaned
      this._addLog(`${cleaned} URLs expirées nettoyées`)
    }

    return cleaned
  }

  /**
   * Compte les visiteurs uniques globaux
   */
  _countUniqueVisitors() {
    const allIPs = new Set()
    for (const urlInfo of this.urls.values()) {
      for (const ip of urlInfo.uniqueVisitors) {
        allIPs.add(ip)
      }
    }
    return allIPs.size
  }

  /**
   * Ajoute un log
   */
  _addLog(message, data = {}) {
    this.logger.info(message, data)
  }

  /**
   * Récupère une URL par son ID (sans validation)
   */
  getUrlInfo(urlId) {
    const urlInfo = this.urls.get(urlId)
    if (!urlInfo) return null

    // Ne pas retourner les données sensibles
    const { token, signature, password, allowedIPs, ...safe } = urlInfo
    return {
      ...safe,
      uniqueVisitors: urlInfo.uniqueVisitors.size
    }
  }

  /**
   * Récupère les URLs par type
   */
  getUrlsByType(type, limit = 50) {
    const typeSet = this.typeIndex.get(type)
    if (!typeSet) return []

    const urls = []
    for (const urlId of typeSet) {
      urls.push(this.getUrlInfo(urlId))
      if (urls.length >= limit) break
    }
    return urls
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    return {
      ...this.stats,
      totalUrls: this.urls.size,
      activeTokens: this.tokens.size,
      activeShortLinks: this.shortLinks.size,
      byType: this._groupByType(),
      averageAccessPerUrl: this.stats.totalAccesses / (this.stats.totalGenerated || 1)
    }
  }

  /**
   * Groupe les URLs par type
   */
  _groupByType() {
    const groups = {}
    for (const [type, set] of this.typeIndex.entries()) {
      groups[type] = set.size
    }
    return groups
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.urls.clear()
    this.tokens.clear()
    this.shortLinks.clear()
    this.typeIndex.clear()
    this.removeAllListeners()
  }
}

export const urlGenerator = new URLGenerator()
export default urlGenerator
