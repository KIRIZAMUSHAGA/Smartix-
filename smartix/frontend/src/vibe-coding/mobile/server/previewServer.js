/**
 * previewServer - Serveur WebSocket pour preview en direct
 * 
 * Rôle: Gérer les connexions WebSocket avec les appareils
 * - Serveur WebSocket
 * - Gestion des sessions
 * - Diffusion des mises à jour
 * - Heartbeat keepalive
 * - Compression
 * - Sécurité des messages
 */

import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { EventEmitter } from 'events'
import os from 'os'
import { deviceManager } from '../core/deviceManager'
import { previewSessions } from '../sessions/previewSessions'
import { logger } from '../utils/logger'
import { crypto } from '../../utils/crypto'

// =============================
// CONFIGURATION
// =============================

const PING_INTERVAL = 30000 // 30s
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_GLOBAL_CONNECTIONS = 500
const MAX_JSON_DEPTH = 20

// Types de messages autorisés
const ALLOWED_MESSAGE_TYPES = new Set([
  'ping',
  'pong',
  'log',
  'ready',
  'error',
  'hot_update',
  'init',
  'file_change',
  'reload'
])

// =============================
// UTILITAIRES
// =============================

/**
 * Récupère l'IP locale du serveur
 */
function getLocalIP() {
  try {
    const nets = os.networkInterfaces()
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // IPv4 et non interne
        if (net.family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }
  } catch (error) {
    console.warn('Erreur récupération IP:', error)
  }
  
  return 'localhost'
}

/**
 * Validation de la profondeur JSON
 */
function validateJSONDepth(obj, maxDepth = MAX_JSON_DEPTH, currentDepth = 0) {
  if (currentDepth > maxDepth) return false
  if (typeof obj !== 'object' || obj === null) return true

  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (!validateJSONDepth(obj[key], maxDepth, currentDepth + 1)) {
        return false
      }
    }
  }
  return true
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class PreviewServer extends EventEmitter {
  constructor() {
    super()

    this.servers = new Map() // sessionId -> server
    this.httpServers = new Map() // port -> httpServer
    this.connections = new Map() // clientId -> { ws, sessionId }
    this.pingIntervals = new Map() // clientId -> interval

    this.stats = {
      totalServers: 0,
      activeServers: 0,
      totalConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      latencyAvg: 0,
      rejectedMessages: 0
    }

    this.logger = logger.createChild('PreviewServer')
  }

  /**
   * Démarre un serveur de preview
   */
  async start(options = {}) {
    const {
      projectId,
      port = 3000,
      sessionId,
      host = '0.0.0.0',
      maxConnections = 100
    } = options

    // Vérifier si le port est déjà utilisé
    if (this.httpServers.has(port)) {
      throw new Error(`Le port ${port} est déjà utilisé`)
    }

    return new Promise((resolve, reject) => {
      try {
        // Créer le serveur HTTP
        const httpServer = createServer()
        
        // Créer le serveur WebSocket avec compression
        const wss = new WebSocketServer({ 
          server: httpServer,
          maxPayload: MAX_PAYLOAD_SIZE,
          perMessageDeflate: {
            zlibDeflateOptions: {
              level: 6 // Compression optimale
            },
            zlibInflateOptions: {
              chunkSize: 10 * 1024
            },
            clientNoContextTakeover: true,
            serverNoContextTakeover: true
          }
        })

        // Déterminer l'IP publique
        const ip = host === '0.0.0.0' ? getLocalIP() : host
        const wsUrl = `ws://${ip}:${port}`

        const serverInfo = {
          id: sessionId,
          projectId,
          port,
          host: ip,
          wss,
          httpServer,
          startedAt: Date.now(),
          connections: new Set(),
          maxConnections,
          stats: {
            messages: 0,
            bytes: 0,
            connections: 0,
            bytesSent: 0,
            bytesReceived: 0
          }
        }

        // Gérer les connexions
        wss.on('connection', (ws, req) => {
          this._handleConnection(ws, req, serverInfo)
        })

        wss.on('error', (error) => {
          this.logger.error(`Erreur WebSocket`, { sessionId, error: error.message })
          this.emit('server:error', { sessionId, error: error.message })
        })

        // Démarrer le serveur HTTP
        httpServer.listen(port, host, () => {
          serverInfo.url = wsUrl
          this.servers.set(sessionId, serverInfo)
          this.httpServers.set(port, httpServer)
          this.stats.totalServers++
          this.stats.activeServers++

          this.logger.success(`Serveur démarré`, { sessionId, port, url: wsUrl })
          this.emit('server:started', serverInfo)

          resolve({
            id: sessionId,
            url: wsUrl,
            port,
            wss
          })
        })

        httpServer.on('error', (error) => {
          this.logger.error(`Erreur HTTP`, { sessionId, error: error.message })
          reject(error)
        })

      } catch (error) {
        this.logger.error(`Échec démarrage`, { sessionId, error: error.message })
        reject(error)
      }
    })
  }

  /**
   * Gère une nouvelle connexion WebSocket
   */
  _handleConnection(ws, req, serverInfo) {
    // Vérifier limite globale
    if (this.connections.size >= MAX_GLOBAL_CONNECTIONS) {
      ws.close(1013, 'Server overloaded')
      return
    }

    // Vérifier limite par serveur
    if (serverInfo.connections.size >= serverInfo.maxConnections) {
      ws.close(1013, 'Too many connections for this session')
      return
    }

    // Récupérer les infos du device depuis les headers
    const userAgent = req.headers['user-agent'] || 'unknown'
    const deviceId = this._extractDeviceId(req) || `device_${crypto.randomToken(8)}`
    
    const clientId = `client_${Date.now()}_${crypto.randomToken(4)}`
    
    const connection = {
      id: clientId,
      ws,
      sessionId: serverInfo.id,
      projectId: serverInfo.projectId,
      deviceId,
      userAgent,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      lastMessage: Date.now(),
      ip: req.socket.remoteAddress,
      messages: 0,
      bytesReceived: 0,
      bytesSent: 0,
      latency: 0,
      latencies: []
    }

    this.connections.set(clientId, connection)
    serverInfo.connections.add(clientId)
    serverInfo.stats.connections++
    this.stats.totalConnections++

    // Enregistrer dans deviceManager
    deviceManager.registerDevice(deviceId, {
      clientId,
      sessionId: serverInfo.id,
      projectId: serverInfo.projectId,
      userAgent,
      ip: req.socket.remoteAddress,
      connectedAt: Date.now(),
      ws
    }).catch(error => {
      this.logger.warn(`Erreur enregistrement device`, error)
    })

    this.logger.info(`Nouvelle connexion`, { 
      clientId, 
      sessionId: serverInfo.id,
      deviceId: deviceId.substring(0, 8)
    })

    this.emit('connection', { clientId, sessionId: serverInfo.id, deviceId })

    // Configurer les gestionnaires
    this._setupWSHandlers(ws, clientId, serverInfo)

    // Démarrer ping interval
    this._startPingInterval(clientId, ws)

    // Envoyer confirmation de connexion
    this._sendSafe(ws, {
      type: 'connected',
      clientId,
      sessionId: serverInfo.id,
      timestamp: Date.now()
    })
  }

  /**
   * Configure les gestionnaires WebSocket
   */
  _setupWSHandlers(ws, clientId, serverInfo) {
    ws.on('message', (data) => {
      this._handleMessage(ws, data, clientId, serverInfo)
    })

    ws.on('close', () => {
      this._handleClose(clientId, serverInfo)
    })

    ws.on('error', (error) => {
      this.logger.warn(`Erreur WebSocket client`, { clientId, error: error.message })
      this.emit('client:error', { clientId, error: error.message })
    })

    ws.on('pong', () => {
      this._handlePong(clientId)
    })
  }

  /**
   * Gère un message reçu
   */
  _handleMessage(ws, data, clientId, serverInfo) {
    const connection = this.connections.get(clientId)
    if (!connection) return

    try {
      // Compter les bytes reçus
      const bytesReceived = typeof data === 'string' ? data.length : data.byteLength
      connection.bytesReceived += bytesReceived
      serverInfo.stats.bytesReceived += bytesReceived
      this.stats.bytesReceived += bytesReceived

      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      
      // Vérifier la profondeur JSON
      if (!validateJSONDepth(parsed)) {
        this.stats.rejectedMessages++
        this.logger.warn(`JSON trop profond`, { clientId })
        return
      }

      // Vérifier le type de message
      if (!ALLOWED_MESSAGE_TYPES.has(parsed.type)) {
        this.stats.rejectedMessages++
        this.logger.warn(`Type de message non autorisé`, { clientId, type: parsed.type })
        return
      }
      
      connection.lastMessage = Date.now()
      connection.messages++
      
      serverInfo.stats.messages++
      serverInfo.stats.bytes += data.length
      this.stats.messagesReceived++

      // Traiter les types spéciaux
      if (parsed.type === 'ping') {
        this._sendSafe(ws, { type: 'pong', timestamp: Date.now() })
        return
      }

      if (parsed.type === 'log') {
        this.logger.info(`[Device ${clientId}] ${parsed.message}`)
        return
      }

      // Relayer l'événement
      this.emit('message', {
        clientId,
        sessionId: serverInfo.id,
        message: parsed
      })

    } catch (error) {
      this.stats.rejectedMessages++
      this.logger.warn(`Message invalide`, { clientId, error: error.message })
    }
  }

  /**
   * Gère la fermeture de connexion
   */
  _handleClose(clientId, serverInfo) {
    const connection = this.connections.get(clientId)
    
    this.connections.delete(clientId)
    serverInfo.connections.delete(clientId)

    // Nettoyer ping interval
    const pingInterval = this.pingIntervals.get(clientId)
    if (pingInterval) {
      clearInterval(pingInterval)
      this.pingIntervals.delete(clientId)
    }

    // Notifier deviceManager
    if (connection) {
      deviceManager.disconnectDevice(connection.deviceId)
    }

    this.emit('disconnection', { clientId, sessionId: serverInfo.id })

    this.logger.info(`Connexion fermée`, { clientId, sessionId: serverInfo.id })
  }

  /**
   * Gère un pong reçu
   */
  _handlePong(clientId) {
    const connection = this.connections.get(clientId)
    if (connection) {
      const now = Date.now()
      connection.latency = now - connection.lastPing
      connection.latencies.push(connection.latency)
      
      // Garder seulement les 10 dernières latences
      if (connection.latencies.length > 10) {
        connection.latencies.shift()
      }
      
      connection.lastPing = now
      
      // Mettre à jour la latence moyenne globale
      this._updateAverageLatency()
    }
  }

  /**
   * Met à jour la latence moyenne
   */
  _updateAverageLatency() {
    let total = 0
    let count = 0
    
    for (const connection of this.connections.values()) {
      if (connection.latency > 0) {
        total += connection.latency
        count++
      }
    }
    
    this.stats.latencyAvg = count > 0 ? Math.round(total / count) : 0
  }

  /**
   * Démarre l'intervalle de ping
   */
  _startPingInterval(clientId, ws) {
    const interval = setInterval(() => {
      const connection = this.connections.get(clientId)
      
      // Vérifier si la connexion est toujours active
      if (!connection || ws.readyState !== 1) {
        clearInterval(interval)
        this.pingIntervals.delete(clientId)
        return
      }

      // Vérifier le dernier ping (timeout après 3 intervals)
      if (Date.now() - connection.lastPing > PING_INTERVAL * 3) {
        this.logger.warn(`Client timed out`, { clientId })
        ws.terminate()
        clearInterval(interval)
        this.pingIntervals.delete(clientId)
        return
      }

      connection.lastPing = Date.now()
      
      // Envoyer ping
      const pingMsg = { type: 'ping', timestamp: Date.now() }
      const bytesSent = JSON.stringify(pingMsg).length
      
      connection.bytesSent += bytesSent
      connection.lastPing = Date.now()
      
      this._sendSafe(ws, pingMsg)

    }, PING_INTERVAL)

    this.pingIntervals.set(clientId, interval)
  }

  /**
   * Envoi sécurisé WebSocket
   */
  _sendSafe(ws, data) {
    if (ws.readyState !== 1) return false

    try {
      const payload = JSON.stringify(data)
      const bytes = payload.length
      
      ws.send(payload)
      
      // Mettre à jour les stats
      this.stats.messagesSent++
      this.stats.bytesSent += bytes
      
      // Mettre à jour les stats de la connexion
      const clientId = ws.clientId
      if (clientId) {
        const connection = this.connections.get(clientId)
        if (connection) {
          connection.bytesSent += bytes
        }
      }
      
      return true
    } catch (error) {
      this.logger.warn(`Erreur envoi`, { error: error.message })
      return false
    }
  }

  /**
   * Envoie un message à un client spécifique
   */
  sendToClient(clientId, message) {
    const connection = this.connections.get(clientId)
    if (!connection) return false

    return this._sendSafe(connection.ws, message)
  }

  /**
   * Diffuse un message à tous les clients d'une session
   */
  broadcast(sessionId, message) {
    const server = this.servers.get(sessionId)
    if (!server) return 0

    // Prendre un snapshot pour éviter les modifications pendant l'itération
    const clients = Array.from(server.connections)
    let sentCount = 0

    for (const clientId of clients) {
      const connection = this.connections.get(clientId)
      if (connection?.ws?.readyState === 1) {
        if (this._sendSafe(connection.ws, message)) {
          sentCount++
        }
      }
    }

    return sentCount
  }

  /**
   * Arrête un serveur
   */
  async stop(sessionId) {
    const server = this.servers.get(sessionId)
    if (!server) return false

    return new Promise((resolve) => {
      // Prendre un snapshot des connexions
      const clients = Array.from(server.connections)

      // Fermer toutes les connexions
      for (const clientId of clients) {
        const connection = this.connections.get(clientId)
        if (connection?.ws?.readyState === 1) {
          connection.ws.close(1000, 'Server stopping')
        }
      }

      // Fermer le serveur WebSocket
      server.wss.close(() => {
        // Fermer le serveur HTTP
        server.httpServer.close(() => {
          this.servers.delete(sessionId)
          this.httpServers.delete(server.port)
          this.stats.activeServers--

          this.logger.info(`Serveur arrêté`, { sessionId })
          this.emit('server:stopped', { sessionId })

          resolve(true)
        })
      })
    })
  }

  /**
   * Vérifie les sessions expirées
   */
  checkExpiredSessions() {
    for (const [sessionId, server] of this.servers.entries()) {
      const session = previewSessions.getPreviewSession(sessionId)
      if (!session || (session.expiresAt && session.expiresAt < Date.now())) {
        this.stop(sessionId).catch(() => {})
      }
    }
  }

  /**
   * Extrait l'ID du device des headers
   */
  _extractDeviceId(req) {
    // Chercher dans les headers personnalisés
    const deviceId = req.headers['x-device-id'] || 
                     req.headers['device-id'] ||
                     req.headers['deviceid']
    
    if (deviceId) return deviceId

    // Générer un ID basé sur l'IP et user-agent
    const ip = req.socket.remoteAddress
    const ua = req.headers['user-agent'] || ''
    return crypto.createHash(`${ip}:${ua}`).substring(0, 16)
  }

  /**
   * Récupère les informations d'un serveur
   */
  getServerInfo(sessionId) {
    const server = this.servers.get(sessionId)
    if (!server) return null

    // Calculer les latences pour cette session
    let totalLatency = 0
    let latencyCount = 0
    
    for (const clientId of server.connections) {
      const connection = this.connections.get(clientId)
      if (connection?.latency > 0) {
        totalLatency += connection.latency
        latencyCount++
      }
    }

    return {
      id: server.id,
      projectId: server.projectId,
      port: server.port,
      url: server.url,
      startedAt: server.startedAt,
      connections: server.connections.size,
      stats: {
        ...server.stats,
        latencyAvg: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0
      }
    }
  }

  /**
   * Liste les serveurs actifs
   */
  listActiveServers() {
    return Array.from(this.servers.values()).map(s => ({
      id: s.id,
      projectId: s.projectId,
      port: s.port,
      connections: s.connections.size,
      startedAt: s.startedAt
    }))
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.connections.size,
      activePingIntervals: this.pingIntervals.size,
      activeServers: this.servers.size
    }
  }

  /**
   * Nettoie toutes les ressources
   */
  destroy() {
    // Arrêter tous les serveurs
    for (const sessionId of this.servers.keys()) {
      this.stop(sessionId).catch(() => {})
    }

    // Nettoyer tous les ping intervals
    for (const interval of this.pingIntervals.values()) {
      clearInterval(interval)
    }

    this.pingIntervals.clear()
    this.connections.clear()
    this.servers.clear()
    this.httpServers.clear()
    this.removeAllListeners()
  }
}

export const previewServer = new PreviewServer()

export default previewServer
