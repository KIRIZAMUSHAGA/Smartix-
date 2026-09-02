/**
 * livePreview - Preview en direct sur appareils mobiles
 * 
 * Rôle: Gérer les sessions de preview en direct
 * - Sessions de preview
 * - Hot reload via WebSocket
 * - Synchronisation appareils
 */

import { EventEmitter } from 'events'
import { previewServer } from '../server/previewServer'
import { deviceManager } from './deviceManager'
import { qrGenerator } from '../services/qrGenerator'
import { previewSessions } from '../sessions/previewSessions'
import { logger } from '../utils/logger'

// =============================
// CONFIGURATION
// =============================

const HEARTBEAT_INTERVAL = 30000
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 heure

// =============================
// CLASSE PRINCIPALE
// =============================

export class LivePreview extends EventEmitter {

  constructor() {
    super()

    this.activePreviews = new Map()
    this.heartbeats = new Map() // clientId -> interval

    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalConnections: 0
    }

    this.logger = logger.createChild('LivePreview')

    // Nettoyage automatique
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpiredSessions()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Démarrer session preview
   */
  async startSession(projectId, options = {}) {
    if (!projectId) {
      throw new Error("projectId requis")
    }

    // Vérifier session existante
    const existing = this.activePreviews.get(projectId)
    if (existing && !this._isSessionExpired(existing)) {
      this.logger.info(`Session existante réutilisée`, { projectId })
      
      return this._formatSessionResponse(existing)
    }

    const {
      port = 3000,
      expiresIn = 60 * 60 * 1000
    } = options

    try {
      // Créer session
      const session = previewSessions.createPreviewSession({
        projectId,
        port,
        expiresIn
      })

      // Démarrer serveur
      const server = await previewServer.start({
        projectId,
        port,
        sessionId: session.id
      })

      // Enrichir session
      session.server = server
      session.previewUrl = `https://preview.smartix.app/${session.id}`
      session.wsUrl = server.wsUrl

      // Générer QR code
      const qrCode = await qrGenerator.generate(session.previewUrl, {
        size: 300,
        margin: 1
      })

      session.qrCode = qrCode

      // Stocker
      this.activePreviews.set(projectId, session)
      this.stats.totalSessions++
      this.stats.activeSessions++

      // Écouter les événements du serveur
      this._setupServerListeners(session.id, server)

      this.emit('session:started', session)
      this.logger.success(`Preview démarré`, {
        projectId,
        sessionId: session.id,
        port
      })

      return this._formatSessionResponse(session)

    } catch (error) {
      this.logger.error("Erreur start preview", error)
      throw error
    }
  }

  /**
   * Configure les écouteurs du serveur
   */
  _setupServerListeners(sessionId, server) {
    server.on('connection', (ws, deviceInfo) => {
      this._handleConnection(sessionId, ws, deviceInfo)
    })

    server.on('message', (ws, data) => {
      this._safeHandleMessage(sessionId, ws, data)
    })

    server.on('error', (error) => {
      this.logger.error(`Erreur serveur preview`, { sessionId, error })
    })
  }

  /**
   * Connexion appareil
   */
  _handleConnection(sessionId, ws, deviceInfo) {
    const session = previewSessions.getPreviewSession(sessionId)
    if (!session) {
      ws.close()
      return
    }

    const clientId = previewSessions.addDeviceToSession(sessionId, deviceInfo)
    ws.clientId = clientId
    ws.sessionId = sessionId

    this.stats.totalConnections++

    // Enregistrer l'appareil
    deviceManager.registerDevice(deviceInfo.deviceId, {
      ...deviceInfo,
      sessionId,
      clientId,
      ws,
      connectedAt: Date.now()
    })

    // Démarrer heartbeat
    this._startHeartbeat(ws, clientId)

    // Envoyer code initial (async mais pas bloquant)
    this._sendInitialCode(session.projectId, ws).catch(error => {
      this.logger.warn(`Erreur envoi code initial`, error)
    })

    this.emit('device:connected', { sessionId, clientId, deviceInfo })

    // Gestion déconnexion
    ws.on('close', () => {
      this._handleDisconnection(sessionId, clientId, deviceInfo.deviceId)
    })

    ws.on('error', (error) => {
      this.logger.warn(`Erreur WebSocket`, { clientId, error })
    })
  }

  /**
   * Gestion déconnexion
   */
  _handleDisconnection(sessionId, clientId, deviceId) {
    previewSessions.removeDeviceFromSession(sessionId, clientId)
    deviceManager.disconnectDevice(deviceId)

    // Nettoyer heartbeat
    const heartbeat = this.heartbeats.get(clientId)
    if (heartbeat) {
      clearInterval(heartbeat)
      this.heartbeats.delete(clientId)
    }

    this.emit('device:disconnected', { sessionId, clientId })
  }

  /**
   * Gestion message sécurisé
   */
  _safeHandleMessage(sessionId, ws, data) {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      this._handleMessage(sessionId, ws, parsed)
    } catch (error) {
      this.logger.warn("Message WS invalide", { error: error.message })
    }
  }

  /**
   * Traitement message
   */
  _handleMessage(sessionId, ws, data) {
    switch (data.type) {
      case 'ping':
        this._sendSafe(ws, {
          type: 'pong',
          timestamp: Date.now()
        })
        break

      case 'ready':
        this.emit('device:ready', {
          sessionId,
          clientId: ws.clientId
        })
        break

      case 'error':
        this.emit('device:error', {
          sessionId,
          clientId: ws.clientId,
          error: data.error
        })
        break

      case 'log':
        this.logger.info(`[Device ${ws.clientId}] ${data.message}`)
        break
    }
  }

  /**
   * Envoi sécurisé WebSocket
   */
  _sendSafe(ws, data) {
    if (ws.readyState !== 1) return false

    try {
      ws.send(JSON.stringify(data))
      return true
    } catch {
      return false
    }
  }

  /**
   * Envoyer code initial
   */
  async _sendInitialCode(projectId, ws) {
    // TODO: Récupérer les vrais fichiers du projet
    const payload = {
      type: 'init',
      files: {},
      timestamp: Date.now()
    }

    return this._sendSafe(ws, payload)
  }

  /**
   * Démarrer heartbeat
   */
  _startHeartbeat(ws, clientId) {
    // Nettoyer ancien heartbeat
    const old = this.heartbeats.get(clientId)
    if (old) clearInterval(old)

    const interval = setInterval(() => {
      if (ws.readyState !== 1) {
        clearInterval(interval)
        this.heartbeats.delete(clientId)
        return
      }

      this._sendSafe(ws, { type: 'ping' })
    }, HEARTBEAT_INTERVAL)

    this.heartbeats.set(clientId, interval)
  }

  /**
   * Envoyer mise à jour
   */
  async pushUpdate(projectId, changes) {
    const session = this.activePreviews.get(projectId)
    if (!session) {
      throw new Error("Session preview inexistante")
    }

    const payload = {
      type: 'hot_update',
      changes,
      version: Date.now()
    }

    const sentCount = previewSessions.broadcastToSession(session.id, payload)

    this.emit('update:sent', {
      sessionId: session.id,
      sentCount,
      changes: Object.keys(changes || {})
    })

    this.logger.info(`Mise à jour envoyée à ${sentCount} appareil(s)`, {
      projectId,
      files: Object.keys(changes || {}).length
    })

    return { success: true, sentCount }
  }

  /**
   * Arrêter session
   */
  async stopSession(projectId) {
    const session = this.activePreviews.get(projectId)
    if (!session) return { success: false, reason: 'session_not_found' }

    // Arrêter le serveur
    await previewServer.stop(session.id)

    // Nettoyer tous les heartbeats de cette session
    const devices = previewSessions.getSessionDevices(session.id)
    for (const device of devices) {
      const heartbeat = this.heartbeats.get(device.clientId)
      if (heartbeat) {
        clearInterval(heartbeat)
        this.heartbeats.delete(device.clientId)
      }
    }

    this.activePreviews.delete(projectId)
    this.stats.activeSessions--

    this.emit('session:stopped', {
      sessionId: session.id,
      projectId
    })

    this.logger.info(`Session arrêtée`, { projectId })

    return { success: true }
  }

  /**
   * Nettoie les sessions expirées
   */
  _cleanupExpiredSessions() {
    const now = Date.now()
    let cleaned = 0

    for (const [projectId, session] of this.activePreviews.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        this.stopSession(projectId).catch(() => {})
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.info(`${cleaned} sessions expirées nettoyées`)
    }

    return cleaned
  }

  /**
   * Vérifie si une session est expirée
   */
  _isSessionExpired(session) {
    return session.expiresAt && session.expiresAt < Date.now()
  }

  /**
   * Formate la réponse de session
   */
  _formatSessionResponse(session) {
    return {
      success: true,
      sessionId: session.id,
      previewUrl: session.previewUrl,
      qrCode: session.qrCode,
      port: session.port,
      expiresAt: session.expiresAt,
      wsUrl: session.wsUrl,
      deviceCount: previewSessions.getSessionDevices(session.id).length
    }
  }

  /**
   * Récupère les appareils connectés
   */
  getConnectedDevices(projectId) {
    const session = this.activePreviews.get(projectId)
    if (!session) return []

    return previewSessions.getSessionDevices(session.id)
  }

  /**
   * Vérifie si une session est active
   */
  isSessionActive(projectId) {
    const session = this.activePreviews.get(projectId)
    return !!session && !this._isSessionExpired(session)
  }

  /**
   * Statistiques
   */
  getStats() {
    return {
      ...this.stats,
      connectedDevices: deviceManager.getConnectedCount(),
      activeHeartbeats: this.heartbeats.size
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

    // Arrêter tous les heartbeats
    for (const interval of this.heartbeats.values()) {
      clearInterval(interval)
    }
    this.heartbeats.clear()

    this.removeAllListeners()
  }
}

export const livePreview = new LivePreview()

export default livePreview
