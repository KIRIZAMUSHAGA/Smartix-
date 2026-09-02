/**
 * previewSessions - Gestion des sessions de preview
 * 
 * Rôle: Gérer les sessions de preview en direct
 * - Création de sessions avec token de sécurité
 * - Expiration automatique
 * - Association appareils
 * - Statistiques
 */

import { EventEmitter } from 'events'
import { logger } from '../utils/logger'
import { crypto } from '../../utils/crypto'
import { previewServer } from '../server/previewServer'

// =============================
// CONFIGURATION
// =============================

const DEFAULT_SESSION_DURATION = 60 * 60 * 1000 // 1 heure
const MAX_SESSIONS = 1000
const MAX_PROJECT_SESSIONS = 5
const ZOMBIE_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes

const SESSION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CLOSED: 'closed',
  FULL: 'full',
  ZOMBIE: 'zombie'
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class PreviewSessions extends EventEmitter {
  constructor() {
    super()

    this.sessions = new Map() // sessionId -> session
    this.projectSessions = new Map() // projectId -> [sessionIds]
    this.deviceSessions = new Map() // deviceId -> sessionId
    this.tokens = new Map() // token -> sessionId

    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalDevices: 0,
      activeDevices: 0,
      peakDevices: 0,
      averageSessionDuration: 0,
      totalDuration: 0
    }

    this.logger = logger.createChild('PreviewSessions')

    // Nettoyage automatique
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions()
      this._updateAverageDuration()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Crée une nouvelle session de preview
   */
  createPreviewSession(options = {}) {
    const {
      projectId,
      port = 3000,
      expiresIn = DEFAULT_SESSION_DURATION,
      maxDevices = 10,
      metadata = {}
    } = options

    if (!projectId) {
      throw new Error('projectId requis')
    }

    // Vérifier le nombre de sessions par projet
    const existingSessions = this.getProjectSessions(projectId)
    if (existingSessions.length >= MAX_PROJECT_SESSIONS) {
      throw new Error(`Trop de sessions pour ce projet (max: ${MAX_PROJECT_SESSIONS})`)
    }

    // Limite de sessions globales
    if (this.sessions.size >= MAX_SESSIONS) {
      this.logger.warn('Nombre maximum de sessions atteint, nettoyage forcé')
      this.cleanupExpiredSessions()
    }

    const sessionId = `preview_${Date.now()}_${crypto.randomToken(8)}`
    const token = crypto.randomToken(32)
    const now = Date.now()

    const session = {
      id: sessionId,
      projectId,
      token,
      port,
      createdAt: now,
      expiresAt: now + expiresIn,
      lastActivity: now,
      status: SESSION_STATUS.ACTIVE,
      maxDevices,
      devices: new Map(), // clientId -> deviceInfo
      deviceCount: 0,
      peakDevices: 0,
      metadata: {
        ...metadata,
        userAgent: metadata.userAgent || null,
        source: metadata.source || 'web'
      },
      stats: {
        totalConnections: 0,
        totalMessages: 0,
        totalBytes: 0
      }
    }

    this.sessions.set(sessionId, session)
    this.tokens.set(token, sessionId)

    // Indexer par projet
    if (!this.projectSessions.has(projectId)) {
      this.projectSessions.set(projectId, [])
    }
    this.projectSessions.get(projectId).push(sessionId)

    this.stats.totalSessions++
    this.stats.activeSessions = this._countActiveSessions()

    this.logger.info(`Session créée`, {
      sessionId,
      projectId,
      token: token.substring(0, 8) + '...',
      expiresAt: new Date(session.expiresAt).toISOString()
    })

    this.emit('session:created', { sessionId, session, token })

    return session
  }

  /**
   * Récupère une session par son ID
   */
  getPreviewSession(sessionId) {
    return this.sessions.get(sessionId) || null
  }

  /**
   * Récupère une session par son token
   */
  getSessionByToken(token) {
    const sessionId = this.tokens.get(token)
    return sessionId ? this.sessions.get(sessionId) : null
  }

  /**
   * Valide un token de session
   */
  validateSessionToken(token) {
    const session = this.getSessionByToken(token)
    
    if (!session) {
      return { valid: false, reason: 'token_invalide' }
    }

    if (session.status !== SESSION_STATUS.ACTIVE) {
      return { valid: false, reason: 'session_inactive', status: session.status }
    }

    if (session.expiresAt < Date.now()) {
      return { valid: false, reason: 'session_expired' }
    }

    return { valid: true, session }
  }

  /**
   * Récupère les sessions d'un projet
   */
  getProjectSessions(projectId) {
    const sessionIds = this.projectSessions.get(projectId) || []
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Ajoute un appareil à une session
   */
  addDeviceToSession(sessionId, deviceInfo) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} non trouvée`)
    }

    if (session.status !== SESSION_STATUS.ACTIVE) {
      throw new Error(`Session ${sessionId} n'est pas active`)
    }

    if (session.deviceCount >= session.maxDevices) {
      session.status = SESSION_STATUS.FULL
      throw new Error(`Session ${sessionId} a atteint sa capacité maximale`)
    }

    const deviceId = deviceInfo.deviceId || `device_${crypto.randomToken(8)}`
    const clientId = `client_${Date.now()}_${crypto.randomToken(4)}`

    // Vérifier si l'appareil est déjà dans une autre session
    if (this.deviceSessions.has(deviceId)) {
      const oldSessionId = this.deviceSessions.get(deviceId)
      if (oldSessionId !== sessionId) {
        this._removeDeviceFromAllSessions(deviceId, oldSessionId)
      }
    }

    const device = {
      deviceId,
      clientId,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      userAgent: deviceInfo.userAgent || 'unknown',
      platform: deviceInfo.platform || 'unknown',
      version: deviceInfo.version || 'unknown',
      model: deviceInfo.model || 'unknown',
      metadata: deviceInfo.metadata || {}
    }

    session.devices.set(clientId, device)
    session.deviceCount = session.devices.size
    session.peakDevices = Math.max(session.peakDevices, session.deviceCount)
    session.lastActivity = Date.now()
    session.stats.totalConnections++

    this.deviceSessions.set(deviceId, sessionId)
    this.stats.totalDevices++
    this.stats.activeDevices = this._countActiveDevices()
    this.stats.peakDevices = Math.max(this.stats.peakDevices, this.stats.activeDevices)

    this.logger.info(`Appareil ajouté à la session`, {
      sessionId,
      clientId,
      deviceId: deviceId.substring(0, 8),
      model: device.model,
      totalDevices: session.deviceCount
    })

    this.emit('device:added', { sessionId, clientId, device })

    return { clientId, device }
  }

  /**
   * Retire un appareil de toutes ses sessions
   */
  _removeDeviceFromAllSessions(deviceId, currentSessionId) {
    for (const [sid, session] of this.sessions.entries()) {
      if (sid === currentSessionId) continue

      for (const [cid, device] of session.devices.entries()) {
        if (device.deviceId === deviceId) {
          this.removeDeviceFromSession(sid, cid)
          return
        }
      }
    }
  }

  /**
   * Retire un appareil d'une session
   */
  removeDeviceFromSession(sessionId, clientId) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    const device = session.devices.get(clientId)
    if (!device) return false

    session.devices.delete(clientId)
    session.deviceCount = session.devices.size
    session.lastActivity = Date.now()

    this.deviceSessions.delete(device.deviceId)
    this.stats.activeDevices = this._countActiveDevices()

    this.logger.info(`Appareil retiré de la session`, {
      sessionId,
      clientId,
      remainingDevices: session.deviceCount
    })

    this.emit('device:removed', { sessionId, clientId, device })

    return true
  }

  /**
   * Met à jour la dernière activité d'un appareil
   */
  updateDeviceActivity(sessionId, clientId) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    const device = session.devices.get(clientId)
    if (!device) return false

    device.lastSeen = Date.now()
    session.lastActivity = Date.now()

    return true
  }

  /**
   * Récupère les appareils d'une session
   */
  getSessionDevices(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return []

    return Array.from(session.devices.values())
      .sort((a, b) => b.joinedAt - a.joinedAt)
  }

  /**
   * Diffuse un message à tous les appareils d'une session
   */
  broadcastToSession(sessionId, message) {
    const session = this.sessions.get(sessionId)
    if (!session) return 0

    // Utiliser previewServer pour le broadcast réel
    const sentCount = previewServer.broadcast(sessionId, message)
    
    if (sentCount > 0) {
      const payload = JSON.stringify(message)
      const bytes = payload.length
      
      session.stats.totalMessages += sentCount
      session.stats.totalBytes += bytes * sentCount
    }

    this.emit('broadcast', { sessionId, messageCount: sentCount })

    return sentCount
  }

  /**
   * Ferme une session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    // Nettoyer les index des appareils
    for (const device of session.devices.values()) {
      this.deviceSessions.delete(device.deviceId)
    }

    session.devices.clear()
    session.deviceCount = 0
    session.status = SESSION_STATUS.CLOSED

    this.stats.activeSessions = this._countActiveSessions()
    this.stats.activeDevices = this._countActiveDevices()

    this.logger.info(`Session fermée`, { 
      sessionId,
      projectId: session.projectId,
      totalDevices: session.stats.totalConnections
    })

    this.emit('session:closed', { sessionId, session })

    return true
  }

  /**
   * Supprime une session
   */
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    // Calculer la durée pour les stats
    const duration = Date.now() - session.createdAt
    this.stats.totalDuration += duration

    // Nettoyer les appareils
    for (const device of session.devices.values()) {
      this.deviceSessions.delete(device.deviceId)
    }

    // Nettoyer l'index projet
    const projectSessions = this.projectSessions.get(session.projectId) || []
    const index = projectSessions.indexOf(sessionId)
    if (index !== -1) {
      projectSessions.splice(index, 1)
      if (projectSessions.length === 0) {
        this.projectSessions.delete(session.projectId)
      }
    }

    // Nettoyer le token
    this.tokens.delete(session.token)
    this.sessions.delete(sessionId)

    this.stats.totalSessions--
    this.stats.activeSessions = this._countActiveSessions()
    this.stats.activeDevices = this._countActiveDevices()

    this.logger.info(`Session supprimée`, { sessionId })

    this.emit('session:deleted', { sessionId })

    return true
  }

  /**
   * Nettoie les sessions expirées et zombies
   */
  cleanupExpiredSessions() {
    const now = Date.now()
    let cleaned = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      // Session expirée
      if (session.expiresAt < now) {
        session.status = SESSION_STATUS.EXPIRED
        this.deleteSession(sessionId)
        cleaned++
        continue
      }

      // Session zombie (sans activité)
      if (session.deviceCount === 0 && now - session.lastActivity > ZOMBIE_TIMEOUT) {
        session.status = SESSION_STATUS.ZOMBIE
        this.deleteSession(sessionId)
        cleaned++
        this.logger.debug(`Session zombie nettoyée`, { sessionId })
      }
    }

    if (cleaned > 0) {
      this.logger.info(`${cleaned} sessions expirées ou zombies nettoyées`)
    }

    return cleaned
  }

  /**
   * Met à jour la durée moyenne des sessions
   */
  _updateAverageDuration() {
    if (this.stats.totalSessions === 0) {
      this.stats.averageSessionDuration = 0
      return
    }

    this.stats.averageSessionDuration = Math.round(
      this.stats.totalDuration / (this.stats.totalSessions + this.sessions.size)
    )
  }

  /**
   * Compte les sessions actives
   */
  _countActiveSessions() {
    let count = 0
    for (const session of this.sessions.values()) {
      if (session.status === SESSION_STATUS.ACTIVE) {
        count++
      }
    }
    return count
  }

  /**
   * Compte les appareils actifs
   */
  _countActiveDevices() {
    let count = 0
    for (const session of this.sessions.values()) {
      count += session.deviceCount
    }
    return count
  }

  /**
   * Vérifie si une session est active
   */
  isSessionActive(sessionId) {
    const session = this.sessions.get(sessionId)
    return session && 
           session.status === SESSION_STATUS.ACTIVE && 
           session.expiresAt > Date.now()
  }

  /**
   * Prolonge une session
   */
  extendSession(sessionId, duration = DEFAULT_SESSION_DURATION) {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.expiresAt = Date.now() + duration
    session.lastActivity = Date.now()

    this.logger.info(`Session prolongée`, {
      sessionId,
      newExpiry: new Date(session.expiresAt).toISOString()
    })

    this.emit('session:extended', { sessionId, expiresAt: session.expiresAt })

    return true
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    return {
      ...this.stats,
      activeSessions: this._countActiveSessions(),
      activeDevices: this._countActiveDevices(),
      memoryUsage: {
        sessions: this.sessions.size,
        projectIndex: this.projectSessions.size,
        deviceIndex: this.deviceSessions.size,
        tokenIndex: this.tokens.size
      }
    }
  }

  /**
   * Récupère des métriques détaillées
   */
  getMetrics() {
    const sessions = Array.from(this.sessions.values())
    const totalDevices = sessions.reduce((acc, s) => acc + s.deviceCount, 0)
    
    return {
      totalSessions: sessions.length,
      averageDevicesPerSession: sessions.length
        ? totalDevices / sessions.length
        : 0,
      totalMessages: sessions.reduce((acc, s) => acc + s.stats.totalMessages, 0),
      totalBytes: sessions.reduce((acc, s) => acc + s.stats.totalBytes, 0),
      sessionsByProject: this._groupByProject(),
      topSessions: sessions
        .sort((a, b) => b.peakDevices - a.peakDevices)
        .slice(0, 5)
        .map(s => ({
          id: s.id,
          projectId: s.projectId,
          peakDevices: s.peakDevices,
          totalMessages: s.stats.totalMessages
        }))
    }
  }

  /**
   * Groupe les sessions par projet
   */
  _groupByProject() {
    const groups = {}
    for (const [projectId, sessionIds] of this.projectSessions.entries()) {
      groups[projectId] = sessionIds.length
    }
    return groups
  }

  /**
   * Arrête le nettoyage automatique
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // Fermer toutes les sessions
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId)
    }

    this.sessions.clear()
    this.projectSessions.clear()
    this.deviceSessions.clear()
    this.tokens.clear()
    this.removeAllListeners()
  }
}

export const previewSessions = new PreviewSessions()

export default previewSessions
