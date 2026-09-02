/**
 * deviceSessions - Gestion des sessions d'appareils
 * 
 * Rôle: Gérer les appareils connectés aux sessions
 * - Association appareil ↔ session
 * - Historique des connexions
 * - Statistiques par appareil
 * - Nettoyage automatique
 * - Anti-flood
 */

import { EventEmitter } from 'events'
import { logger } from '../utils/logger'
import { crypto } from '../../utils/crypto'

// =============================
// CONFIGURATION
// =============================

const DEVICE_TIMEOUT = 5 * 60 * 1000 // 5 minutes sans ping
const MAX_DEVICE_AGE = 7 * 24 * 60 * 60 * 1000 // 7 jours
const MAX_CONNECTIONS_PER_DEVICE = 50
const MAX_HISTORY_PER_DEVICE = 100
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

const DEVICE_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  TIMEOUT: 'timeout',
  BLOCKED: 'blocked',
  EXPIRED: 'expired'
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class DeviceSessions extends EventEmitter {
  constructor() {
    super()

    this.devices = new Map() // deviceId -> deviceInfo
    this.sessionDevices = new Map() // sessionId -> Set(deviceIds)
    this.blockedDevices = new Set() // deviceId bloqués

    this.stats = {
      totalDevices: 0,
      activeDevices: 0,
      blockedDevices: 0,
      totalConnections: 0,
      uniqueDevices: 0,
      peakDevices: 0,
      averageSessionTime: 0,
      totalSessionTime: 0
    }

    this.logger = logger.createChild('DeviceSessions')

    // Nettoyage automatique
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveDevices()
      this._updateAverageSessionTime()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Enregistre un appareil dans une session
   */
  addDeviceToSession(sessionId, deviceInfo) {
    if (!sessionId) {
      throw new Error('sessionId requis')
    }

    const deviceId = deviceInfo.deviceId || `device_${crypto.randomToken(8)}`
    const clientId = deviceInfo.clientId || `client_${Date.now()}_${crypto.randomToken(4)}`
    
    // Vérifier si l'appareil est bloqué
    if (this.blockedDevices.has(deviceId)) {
      throw new Error(`Appareil ${deviceId} est bloqué`)
    }

    const now = Date.now()

    // Récupérer ou créer l'appareil
    let device = this.devices.get(deviceId)
    const isNew = !device

    if (!device) {
      device = {
        id: deviceId,
        firstSeen: now,
        lastSeen: now,
        lastPing: now,
        pingCount: 0,
        status: DEVICE_STATUS.CONNECTED,
        sessions: new Set(), // sessionIds auxquelles l'appareil a participé
        currentSession: sessionId,
        connections: new Map(), // clientId -> connectionInfo
        totalConnections: 0,
        totalTime: 0,
        userAgent: deviceInfo.userAgent || 'unknown',
        platform: deviceInfo.platform || 'unknown',
        version: deviceInfo.version || 'unknown',
        model: deviceInfo.model || 'unknown',
        manufacturer: deviceInfo.manufacturer || 'unknown',
        screen: deviceInfo.screen || 'unknown',
        metadata: deviceInfo.metadata || {},
        history: []
      }
      
      this.devices.set(deviceId, device)
      this.stats.uniqueDevices++
    } else {
      // Mettre à jour les infos si elles changent
      device.lastSeen = now
      device.lastPing = now
      device.status = DEVICE_STATUS.CONNECTED
      device.userAgent = deviceInfo.userAgent || device.userAgent
      device.platform = deviceInfo.platform || device.platform
      device.version = deviceInfo.version || device.version
      device.model = deviceInfo.model || device.model
      device.manufacturer = deviceInfo.manufacturer || device.manufacturer
      device.screen = deviceInfo.screen || device.screen
      Object.assign(device.metadata, deviceInfo.metadata || {})
    }

    // Vérifier le nombre de connexions par appareil (anti-flood)
    if (device.connections.size >= MAX_CONNECTIONS_PER_DEVICE) {
      this.blockDevice(deviceId, 'connection_flood')
      throw new Error(`Trop de connexions pour cet appareil (max: ${MAX_CONNECTIONS_PER_DEVICE})`)
    }

    // Si l'appareil est déjà dans une autre session, le déconnecter
    if (device.currentSession && device.currentSession !== sessionId) {
      this.removeDeviceFromSession(device.currentSession, deviceId)
    }

    // Ajouter la connexion
    device.connections.set(clientId, {
      clientId,
      sessionId,
      connectedAt: now,
      lastSeen: now,
      pingCount: 0
    })

    device.sessions.add(sessionId)
    device.currentSession = sessionId
    device.totalConnections++

    // Indexer par session
    if (!this.sessionDevices.has(sessionId)) {
      this.sessionDevices.set(sessionId, new Set())
    }
    this.sessionDevices.get(sessionId).add(deviceId)

    // Ajouter à l'historique
    const historyEntry = {
      clientId,
      sessionId,
      connectedAt: now,
      disconnectedAt: null,
      duration: null
    }
    
    device.history.unshift(historyEntry)
    
    // Limiter la taille de l'historique
    if (device.history.length > MAX_HISTORY_PER_DEVICE) {
      device.history = device.history.slice(0, MAX_HISTORY_PER_DEVICE)
    }

    this.stats.totalDevices = this.devices.size
    this.stats.activeDevices = this._countActiveDevices()
    this.stats.totalConnections++
    this.stats.peakDevices = Math.max(this.stats.peakDevices, this.stats.activeDevices)

    this.logger.info(`Appareil ajouté à la session`, {
      deviceId: deviceId.substring(0, 8),
      clientId: clientId.substring(0, 8),
      sessionId,
      model: device.model,
      isNew,
      totalConnections: device.totalConnections
    })

    this.emit('device:added', { 
      deviceId, 
      clientId,
      sessionId, 
      device: this._sanitizeDevice(device),
      isNew 
    })

    return { deviceId, clientId }
  }

  /**
   * Retire un appareil d'une session
   */
  removeDeviceFromSession(sessionId, deviceId, clientId = null) {
    const device = this.devices.get(deviceId)
    if (!device) return false

    const now = Date.now()

    // Si un clientId spécifique est fourni, ne retirer que cette connexion
    if (clientId && device.connections.has(clientId)) {
      const connection = device.connections.get(clientId)
      device.connections.delete(clientId)
      
      this.logger.info(`Connexion appareil retirée`, {
        deviceId: deviceId.substring(0, 8),
        clientId: clientId.substring(0, 8),
        sessionId
      })

      // Si plus aucune connexion, déconnecter complètement l'appareil
      if (device.connections.size === 0) {
        return this._fullyDisconnectDevice(device, deviceId, sessionId, now)
      }

      return true
    }

    // Sinon, déconnecter complètement l'appareil
    return this._fullyDisconnectDevice(device, deviceId, sessionId, now)
  }

  /**
   * Déconnecte complètement un appareil
   */
  _fullyDisconnectDevice(device, deviceId, sessionId, now) {
    device.status = DEVICE_STATUS.DISCONNECTED
    device.lastSeen = now
    device.sessions.delete(sessionId)

    if (device.currentSession === sessionId) {
      device.currentSession = device.sessions.size > 0 
        ? Array.from(device.sessions)[0] 
        : null
    }

    // Mettre à jour l'historique pour cette session
    for (const history of device.history) {
      if (history.sessionId === sessionId && !history.disconnectedAt) {
        history.disconnectedAt = now
        history.duration = now - history.connectedAt
        device.totalTime += history.duration
        this.stats.totalSessionTime += history.duration
        break
      }
    }

    // Nettoyer les connexions
    device.connections.clear()

    // Retirer de l'index session
    const sessionDevices = this.sessionDevices.get(sessionId)
    if (sessionDevices) {
      sessionDevices.delete(deviceId)
      if (sessionDevices.size === 0) {
        this.sessionDevices.delete(sessionId)
      }
    }

    this.stats.activeDevices = this._countActiveDevices()

    this.logger.info(`Appareil déconnecté de la session`, {
      deviceId: deviceId.substring(0, 8),
      sessionId,
      totalTime: device.totalTime
    })

    this.emit('device:removed', { deviceId, sessionId })

    return true
  }

  /**
   * Met à jour l'activité d'un appareil (ping)
   */
  handlePing(deviceId, clientId = null) {
    const device = this.devices.get(deviceId)
    if (!device) return false

    const now = Date.now()
    device.lastSeen = now
    device.lastPing = now
    device.pingCount++

    if (clientId && device.connections.has(clientId)) {
      const connection = device.connections.get(clientId)
      connection.lastSeen = now
      connection.pingCount = (connection.pingCount || 0) + 1
    }

    return true
  }

  /**
   * Récupère les appareils d'une session
   */
  getSessionDevices(sessionId) {
    const deviceIds = this.sessionDevices.get(sessionId)
    if (!deviceIds) return []

    return Array.from(deviceIds)
      .map(id => this.devices.get(id))
      .filter(Boolean)
      .map(d => this._sanitizeDevice(d))
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /**
   * Récupère les connexions actives d'un appareil
   */
  getDeviceConnections(deviceId) {
    const device = this.devices.get(deviceId)
    if (!device) return []

    return Array.from(device.connections.values()).map(c => ({
      ...c,
      connectedAt: new Date(c.connectedAt).toISOString(),
      lastSeen: new Date(c.lastSeen).toISOString()
    }))
  }

  /**
   * Récupère un appareil par son ID
   */
  getDevice(deviceId) {
    const device = this.devices.get(deviceId)
    return device ? this._sanitizeDevice(device) : null
  }

  /**
   * Récupère un appareil par clientId
   */
  getDeviceByClientId(clientId) {
    for (const device of this.devices.values()) {
      if (device.connections.has(clientId)) {
        return this._sanitizeDevice(device)
      }
    }
    return null
  }

  /**
   * Récupère l'historique d'un appareil
   */
  getDeviceHistory(deviceId, limit = 10) {
    const device = this.devices.get(deviceId)
    if (!device) return []

    return device.history
      .slice(0, limit)
      .map(h => ({
        ...h,
        connectedAt: new Date(h.connectedAt).toISOString(),
        disconnectedAt: h.disconnectedAt ? new Date(h.disconnectedAt).toISOString() : null,
        duration: h.duration ? Math.round(h.duration / 1000) + 's' : null
      }))
  }

  /**
   * Bloque un appareil
   */
  blockDevice(deviceId, reason = 'manual') {
    const device = this.devices.get(deviceId)
    if (!device) {
      throw new Error(`Appareil ${deviceId} non trouvé`)
    }

    this.blockedDevices.add(deviceId)
    device.status = DEVICE_STATUS.BLOCKED
    device.blockedAt = Date.now()
    device.blockReason = reason

    // Déconnecter toutes les sessions
    for (const sessionId of device.sessions) {
      this.removeDeviceFromSession(sessionId, deviceId)
    }

    this.stats.blockedDevices = this.blockedDevices.size

    this.logger.warn(`Appareil bloqué`, {
      deviceId: deviceId.substring(0, 8),
      reason
    })

    this.emit('device:blocked', { deviceId, reason })

    return true
  }

  /**
   * Débloque un appareil
   */
  unblockDevice(deviceId) {
    if (!this.blockedDevices.has(deviceId)) {
      return false
    }

    const device = this.devices.get(deviceId)
    if (device) {
      device.status = DEVICE_STATUS.DISCONNECTED
      delete device.blockedAt
      delete device.blockReason
    }

    this.blockedDevices.delete(deviceId)
    this.stats.blockedDevices = this.blockedDevices.size

    this.logger.info(`Appareil débloqué`, {
      deviceId: deviceId.substring(0, 8)
    })

    this.emit('device:unblocked', { deviceId })

    return true
  }

  /**
   * Vérifie si un appareil est bloqué
   */
  isDeviceBlocked(deviceId) {
    return this.blockedDevices.has(deviceId)
  }

  /**
   * Nettoie les appareils inactifs
   */
  cleanupInactiveDevices() {
    const now = Date.now()
    let cleaned = 0
    let expired = 0

    for (const [deviceId, device] of this.devices.entries()) {
      if (this.blockedDevices.has(deviceId)) continue

      // Nettoyer les connexions inactives
      for (const [clientId, connection] of device.connections.entries()) {
        if (now - connection.lastSeen > DEVICE_TIMEOUT) {
          device.connections.delete(clientId)
          this.logger.debug(`Connexion appareil timeout`, {
            deviceId: deviceId.substring(0, 8),
            clientId: clientId.substring(0, 8)
          })
        }
      }

      // Si plus aucune connexion, marquer comme timeout
      if (device.connections.size === 0 && device.status === DEVICE_STATUS.CONNECTED) {
        device.status = DEVICE_STATUS.TIMEOUT
        
        // Mettre à jour l'historique pour toutes les sessions actives
        for (const sessionId of device.sessions) {
          for (const history of device.history) {
            if (history.sessionId === sessionId && !history.disconnectedAt) {
              history.disconnectedAt = now
              history.duration = now - history.connectedAt
              device.totalTime += history.duration
              this.stats.totalSessionTime += history.duration
              break
            }
          }
        }

        // Nettoyer l'index sessionDevices
        for (const sessionId of device.sessions) {
          const sessionSet = this.sessionDevices.get(sessionId)
          if (sessionSet) {
            sessionSet.delete(deviceId)
            if (sessionSet.size === 0) {
              this.sessionDevices.delete(sessionId)
            }
          }
        }

        device.sessions.clear()
        device.currentSession = null
        cleaned++
      }

      // Supprimer les appareils très anciens
      if (now - device.lastSeen > MAX_DEVICE_AGE) {
        this.devices.delete(deviceId)
        expired++
        this.logger.debug(`Appareil ancien supprimé`, {
          deviceId: deviceId.substring(0, 8),
          lastSeen: new Date(device.lastSeen).toISOString()
        })
      }
    }

    if (cleaned > 0 || expired > 0) {
      this.stats.activeDevices = this._countActiveDevices()
      this.logger.info(`${cleaned} appareils timeout, ${expired} appareils anciens supprimés`)
    }

    return { cleaned, expired }
  }

  /**
   * Met à jour la durée moyenne des sessions
   */
  _updateAverageSessionTime() {
    const totalSessions = this.stats.totalConnections
    this.stats.averageSessionTime = totalSessions > 0
      ? Math.round(this.stats.totalSessionTime / totalSessions)
      : 0
  }

  /**
   * Compte les appareils actifs
   */
  _countActiveDevices() {
    let count = 0
    for (const device of this.devices.values()) {
      if (device.status === DEVICE_STATUS.CONNECTED) {
        count++
      }
    }
    return count
  }

  /**
   * Nettoie les données sensibles pour l'export
   */
  _sanitizeDevice(device) {
    if (!device) return null

    const { connections, ...safe } = device
    
    return {
      ...safe,
      sessions: Array.from(safe.sessions || []),
      connections: Array.from(connections?.keys() || []).map(id => id.substring(0, 8)),
      history: safe.history.slice(0, 5).map(h => ({
        ...h,
        connectedAt: new Date(h.connectedAt).toISOString(),
        disconnectedAt: h.disconnectedAt ? new Date(h.disconnectedAt).toISOString() : null,
        duration: h.duration ? Math.round(h.duration / 1000) + 's' : null
      })),
      lastSeen: new Date(safe.lastSeen).toISOString(),
      firstSeen: new Date(safe.firstSeen).toISOString(),
      lastPing: new Date(safe.lastPing).toISOString(),
      pingCount: safe.pingCount || 0
    }
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    return {
      ...this.stats,
      activeDevices: this._countActiveDevices(),
      blockedDevices: this.blockedDevices.size,
      averageSessionTime: this._formatDuration(this.stats.averageSessionTime),
      memoryUsage: {
        devices: this.devices.size,
        sessionIndex: this.sessionDevices.size,
        blockedCount: this.blockedDevices.size
      }
    }
  }

  /**
   * Formate une durée en millisecondes
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000)}h`
  }

  /**
   * Récupère des métriques détaillées
   */
  getMetrics() {
    const devices = Array.from(this.devices.values())
    const activeDevices = devices.filter(d => d.status === DEVICE_STATUS.CONNECTED)
    
    return {
      averageConnectionTime: this._formatDuration(
        devices.length ? this.stats.totalSessionTime / devices.length : 0
      ),
      topDevices: devices
        .sort((a, b) => b.totalConnections - a.totalConnections)
        .slice(0, 5)
        .map(d => ({
          id: d.id.substring(0, 8),
          model: d.model,
          connections: d.totalConnections,
          totalTime: this._formatDuration(d.totalTime)
        })),
      byPlatform: this._groupBy('platform'),
      byModel: this._groupBy('model'),
      byVersion: this._groupBy('version'),
      activeConnections: activeDevices.reduce((acc, d) => acc + d.connections.size, 0)
    }
  }

  /**
   * Groupe les appareils par propriété
   */
  _groupBy(prop) {
    const groups = {}
    for (const device of this.devices.values()) {
      const key = String(device[prop] || 'unknown').substring(0, 40)
      groups[key] = (groups[key] || 0) + 1
    }
    return groups
  }

  /**
   * Récupère les appareils récents
   */
  getRecentDevices(limit = 10) {
    return Array.from(this.devices.values())
      .filter(d => !this.blockedDevices.has(d.id))
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit)
      .map(d => this._sanitizeDevice(d))
  }

  /**
   * Arrête le nettoyage automatique
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    this.devices.clear()
    this.sessionDevices.clear()
    this.blockedDevices.clear()
    this.removeAllListeners()
  }
}

export const deviceSessions = new DeviceSessions()

export default deviceSessions
