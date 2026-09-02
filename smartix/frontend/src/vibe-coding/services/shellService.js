/**
 * shellService - Service shell de niveau production
 * Version FINALE avec LRU cache, heartbeat, gestion prioritaire
 */

import axios from 'axios'

const API_BASE = '/api'
const _wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_BASE = `${_wsProto}//${window.location.host}`
const DEFAULT_TIMEOUT = 30000
const MAX_COMMAND_LENGTH = 500
const CACHE_TTL = 5000
const MAX_CACHE_SIZE = 1000
const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 30000
const LOG_BUFFER_INTERVAL = 50
const HEARTBEAT_INTERVAL = 10000
const MAX_SESSIONS = 10
const MAX_QUEUE_SIZE = 50

// =============================
// LRU Cache implémentation
// =============================
class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key)
      return null
    }

    // LRU: déplacer à la fin
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    return entry.data
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      // Supprimer le plus ancien (premier élément)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  delete(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  get size() {
    return this.cache.size
  }
}

// =============================
// Priority Queue pour commandes
// =============================
class PriorityQueue {
  constructor() {
    this.queue = []
    this.executing = false
  }

  enqueue(item, priority = 0) {
    this.queue.push({ ...item, priority })
    this.queue.sort((a, b) => b.priority - a.priority)
  }

  dequeue() {
    return this.queue.shift()
  }

  isEmpty() {
    return this.queue.length === 0
  }

  clear() {
    this.queue = []
    this.executing = false
  }
}

// =============================
// SERVICE PRINCIPAL
// =============================
class ShellService {
  constructor() {
    // État des sessions
    this.activeSessions = new Map()
    this.messageCallbacks = new Map()
    this.sessionHandlers = new Map() // Pour cleanup propre
    this.priorityQueues = new Map()
    this.reconnectState = new Map()
    
    // Cache LRU
    this.commandCache = new LRUCache()
    
    // WebSocket
    this.globalWs = null
    this.wsConnectionAttempts = 0
    this.wsMessageQueue = []
    this.wsSubscriptions = new Map()
    
    // Buffers
    this.logBuffers = new Map()
    
    // Métriques
    this.metrics = {
      commandsExecuted: 0,
      cacheHits: 0,
      errors: 0,
      sessionsCreated: 0,
      sessionsActive: 0
    }

    // Heartbeat
    this.heartbeatInterval = null
    this._startHeartbeat()
  }

  // =============================
  // HEARTBEAT ACTIF
  // =============================
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.globalWs?.readyState === WebSocket.OPEN) {
        this._sendWsMessage({ type: 'ping', timestamp: Date.now() })
      }
    }, HEARTBEAT_INTERVAL)
  }

  // =============================
  // WEBSOCKET MULTIPLEXÉ
  // =============================
  _initGlobalWebSocket() {
    if (this.globalWs?.readyState === WebSocket.OPEN) return

    // ⚠️ Production: utiliser cookie httpOnly, pas token dans URL
    const wsUrl = WS_BASE + '/shell/multiplex'
    
    this.globalWs = new WebSocket(wsUrl)
    
    // ⚠️ Authentification via sous-protocole WebSocket
    this.globalWs.addEventListener('open', () => {
      const token = this._getAuthToken()
      this.globalWs.send(JSON.stringify({
        type: 'auth',
        token
      }))
    })
    
    this.globalWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Heartbeat response
        if (data.type === 'pong') {
          console.debug('[ShellService] Heartbeat OK', Date.now() - data.timestamp, 'ms')
          return
        }

        const { sessionId, channel, payload } = data
        
        // Router vers les callbacks de la session
        const callbacks = this.wsSubscriptions.get(sessionId)
        if (callbacks) {
          callbacks.forEach(cb => cb({ channel, payload }))
        }
      } catch (error) {
        console.error('[ShellService] Erreur parsing WS:', error)
      }
    }
    
    this.globalWs.onerror = (error) => {
      console.error('[ShellService] WebSocket global error:', error)
    }
    
    this.globalWs.onclose = () => {
      console.log('[ShellService] WebSocket global fermé')
      this.globalWs = null
      
      // Backoff exponentiel
      const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, this.wsConnectionAttempts),
        MAX_RETRY_DELAY
      )
      
      if (this.wsConnectionAttempts < MAX_RETRIES) {
        setTimeout(() => {
          this.wsConnectionAttempts++
          this._initGlobalWebSocket()
        }, delay)
      }
    }
  }

  _subscribeToSession(sessionId, callback) {
    if (!this.wsSubscriptions.has(sessionId)) {
      this.wsSubscriptions.set(sessionId, new Set())
    }
    this.wsSubscriptions.get(sessionId).add(callback)
    
    this._sendWsMessage({
      type: 'subscribe',
      sessionId
    })
  }

  _unsubscribeFromSession(sessionId, callback) {
    const callbacks = this.wsSubscriptions.get(sessionId)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        this.wsSubscriptions.delete(sessionId)
        this._sendWsMessage({
          type: 'unsubscribe',
          sessionId
        })
      }
    }
  }

  _sendWsMessage(message) {
    if (this.globalWs?.readyState === WebSocket.OPEN) {
      this.globalWs.send(JSON.stringify(message))
    } else {
      this.wsMessageQueue.push(message)
    }
  }

  // =============================
  // SESSIONS AVEC LIMITE
  // =============================
  async createSession(projectId, tenantId = 'default') {
    // ⚠️ Limite de sessions
    if (this.activeSessions.size >= MAX_SESSIONS) {
      throw new Error('Trop de sessions actives. Fermez une session existante.')
    }

    try {
      const response = await axios.post(
        `${API_BASE}/vibe/projects/${projectId}/shell/session`,
        { tenantId },
        {
          headers: this._getAuthHeaders(),
          timeout: DEFAULT_TIMEOUT
        }
      )
      
      const sessionId = response.data.sessionId
      
      // Initialiser la priority queue
      this.priorityQueues.set(sessionId, new PriorityQueue())
      
      this.metrics.sessionsCreated++
      this.metrics.sessionsActive = this.activeSessions.size
      
      return sessionId
    } catch (error) {
      this._logError('createSession', error)
      throw new Error('Impossible de créer la session shell')
    }
  }

  // =============================
  // EXÉCUTION DE COMMANDE PRIORISÉE
  // =============================
  async executeCommand(projectId, sessionId, command, options = {}, context = {}) {
    // Validation
    this._validateCommand(command)

    const {
      onProgress,
      useCache = false,
      timeout = DEFAULT_TIMEOUT,
      priority = 0 // 0 = normal, 1 = high (pour Ctrl+C)
    } = options

    const cwd = context.cwd || 'unknown'

    // Cache LRU
    if (useCache && this._isCacheable(command)) {
      const cacheKey = this._getCacheKey(projectId, sessionId, cwd, command)
      const cached = this.commandCache.get(cacheKey)
      if (cached) {
        this.metrics.cacheHits++
        return cached
      }
    }

    // ⚠️ Handler nommé pour cleanup
    const handler = (msg) => {
      if (msg.channel === 'stdout') {
        this._pushLog(sessionId, { channel: 'stdout', data: msg.payload })
      } else if (msg.channel === 'stderr') {
        this._pushLog(sessionId, { channel: 'stderr', data: msg.payload })
      } else if (msg.channel === 'system') {
        this._pushLog(sessionId, { channel: 'system', data: msg.payload })
      } else if (msg.channel === 'exit') {
        this._flushLogs(sessionId)
        this.messageCallbacks.delete(sessionId)
        this._unsubscribeFromSession(sessionId, handler)
        this.sessionHandlers.delete(sessionId)
      }
    }

    if (onProgress && sessionId) {
      this.messageCallbacks.set(sessionId, onProgress)
      this.sessionHandlers.set(sessionId, handler)
      this._subscribeToSession(sessionId, handler)
    }

    // AbortController
    const controller = new AbortController()
    this.activeSessions.set(sessionId, { controller, command, priority })

    // Priority Queue
    const queue = this.priorityQueues.get(sessionId)
    
    // ⚠️ Limite de taille de queue
    if (queue.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error('File d\'attente pleine. Attendez ou annulez une commande.')
    }

    return new Promise((resolve, reject) => {
      queue.enqueue({
        execute: async () => {
          try {
            const result = await this._executeCommandInternal(
              projectId, sessionId, command, controller, timeout
            )

            // Mise en cache LRU
            if (useCache && this._isCacheable(command) && !result.error) {
              const cacheKey = this._getCacheKey(
                projectId, sessionId, result.cwd || cwd, command
              )
              this.commandCache.set(cacheKey, result)
            }

            this.metrics.commandsExecuted++
            resolve(result)

          } catch (error) {
            this.metrics.errors++
            reject(error)
          } finally {
            this.activeSessions.delete(sessionId)
          }
        }
      }, priority)

      this._processQueue(sessionId)
    })
  }

  async _processQueue(sessionId) {
    const queue = this.priorityQueues.get(sessionId)
    if (!queue || queue.executing || queue.isEmpty()) return

    queue.executing = true
    const item = queue.dequeue()

    try {
      await item.execute()
    } finally {
      queue.executing = false
      this._processQueue(sessionId)
    }
  }

  async _executeCommandInternal(projectId, sessionId, command, controller, timeout) {
    try {
      const response = await axios.post(
        `${API_BASE}/vibe/projects/${projectId}/shell/execute`,
        {
          sessionId,
          command
        },
        {
          headers: this._getAuthHeaders(),
          signal: controller.signal,
          timeout
        }
      )

      return {
        output: response.data.output || '',
        error: response.data.error || null,
        cwd: response.data.cwd || null,
        exitCode: response.data.exitCode || 0,
        duration: response.data.duration || 0,
        files: response.data.files || null
      }

    } catch (error) {
      if (axios.isCancel(error)) {
        return { output: '', error: 'Commande annulée', exitCode: -1 }
      }

      this._logError('executeCommand', error, { command, sessionId })

      if (error.code === 'ECONNABORTED') {
        throw new Error('La commande a pris trop de temps')
      }

      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }

      throw new Error('Erreur lors de l\'exécution de la commande')
    }
  }

  // =============================
  // BUFFER DE LOGS (stdout/stderr séparés)
  // =============================
  _pushLog(sessionId, log) {
    if (!this.logBuffers.has(sessionId)) {
      this.logBuffers.set(sessionId, { logs: [], timeout: null })
    }
    
    const buffer = this.logBuffers.get(sessionId)
    buffer.logs.push(log)
    
    if (!buffer.timeout) {
      buffer.timeout = setTimeout(() => {
        this._flushLogs(sessionId)
      }, LOG_BUFFER_INTERVAL)
    }
  }

  _flushLogs(sessionId) {
    const buffer = this.logBuffers.get(sessionId)
    if (!buffer || buffer.logs.length === 0) return
    
    const logs = [...buffer.logs]
    buffer.logs = []
    buffer.timeout = null
    
    const callback = this.messageCallbacks.get(sessionId)
    if (callback) {
      callback({ type: 'logs', payload: logs })
    }
  }

  // =============================
  // ANNULATION DE COMMANDE (avec reset queue)
  // =============================
  cancelCommand(sessionId) {
    const active = this.activeSessions.get(sessionId)
    if (active) {
      active.controller.abort()
      this.activeSessions.delete(sessionId)
    }

    // Reset queue
    const queue = this.priorityQueues.get(sessionId)
    if (queue) {
      queue.clear()
    }
  }

  // =============================
  // SNAPSHOT DE SESSION
  // =============================
  async getSessionSnapshot(projectId, sessionId) {
    try {
      const response = await axios.get(
        `${API_BASE}/vibe/projects/${projectId}/shell/session/${sessionId}/snapshot`,
        {
          headers: this._getAuthHeaders(),
          timeout: 5000
        }
      )
      return response.data
    } catch (error) {
      this._logError('getSessionSnapshot', error)
      return null
    }
  }

  async restoreSession(projectId, sessionId, snapshot) {
    try {
      await axios.post(
        `${API_BASE}/vibe/projects/${projectId}/shell/session/${sessionId}/restore`,
        snapshot,
        {
          headers: this._getAuthHeaders(),
          timeout: 5000
        }
      )
    } catch (error) {
      this._logError('restoreSession', error)
    }
  }

  // =============================
  // FERMETURE DE SESSION
  // =============================
  async closeSession(projectId, sessionId) {
    try {
      this.cancelCommand(sessionId)
      
      // Cleanup handlers
      const handler = this.sessionHandlers.get(sessionId)
      if (handler) {
        this._unsubscribeFromSession(sessionId, handler)
        this.sessionHandlers.delete(sessionId)
      }
      
      this.messageCallbacks.delete(sessionId)
      
      // Buffer cleanup
      const buffer = this.logBuffers.get(sessionId)
      if (buffer?.timeout) {
        clearTimeout(buffer.timeout)
      }
      this.logBuffers.delete(sessionId)
      
      // Cache cleanup
      for (const [key] of this.commandCache.cache) {
        if (key.includes(sessionId)) {
          this.commandCache.delete(key)
        }
      }

      this.priorityQueues.delete(sessionId)
      this.reconnectState.delete(sessionId)

      await axios.delete(
        `${API_BASE}/vibe/projects/${projectId}/shell/session/${sessionId}`,
        {
          headers: this._getAuthHeaders(),
          timeout: 5000
        }
      )
    } catch (error) {
      this._logError('closeSession', error, { sessionId })
    } finally {
      this.activeSessions.delete(sessionId)
      this.metrics.sessionsActive = this.activeSessions.size
    }
  }

  // =============================
  // VALIDATION
  // =============================
  _validateCommand(command) {
    if (!command || typeof command !== 'string') {
      throw new Error('Commande invalide')
    }
    
    if (command.length > MAX_COMMAND_LENGTH) {
      throw new Error('Commande trop longue')
    }
    
    // ⚠️ Ces patterns sont informatifs - le backend fait la vraie validation
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /mkfs/,
      /dd\s+if=/,
      />\s*\/dev\//,
      /wget.*\|.*sh/,
      /curl.*\|.*bash/
    ]
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        console.warn('[ShellService] Commande potentiellement dangereuse:', command)
        break
      }
    }
  }

  _isCacheable(command) {
    const cacheableCommands = ['ls', 'pwd', 'dir', 'll', 'la', 'cat']
    return cacheableCommands.some(cmd => command.startsWith(cmd))
  }

  _getCacheKey(projectId, sessionId, cwd, command) {
    return `${projectId}:${sessionId}:${cwd}:${command}`
  }

  // =============================
  // UTILITAIRES
  // =============================
  _getAuthToken() {
    // ⚠️ Production: utiliser cookie httpOnly
    return localStorage.getItem('access_token') || ''
  }

  _getAuthHeaders() {
    const token = this._getAuthToken()
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  }

  _logError(method, error, extra = {}) {
    console.error(`[ShellService] ${method} failed:`, {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      ...extra
    })
  }

  getMetrics() {
    return { ...this.metrics }
  }

  // Nettoyage global
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    if (this.globalWs) {
      this.globalWs.close()
    }
  }
}

export const shellService = new ShellService()
