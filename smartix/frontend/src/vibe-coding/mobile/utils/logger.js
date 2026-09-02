/**
 * logger - Utilitaire de logging pour le module mobile
 * 
 * Rôle: Centraliser les logs du module mobile
 * - Logs avec niveaux (debug, info, warn, error)
 * - Persistance des logs (fichier, console)
 * - Formatage structuré
 * - Export des logs
 * - Rotation automatique (taille et date)
 * - Contexte global
 * - Transport système
 * - Rate limiting
 * - Stack traces
 */

import { EventEmitter } from 'events'

const isNode = typeof window === 'undefined'

let fs = null
let path = null
let createWriteStream = null

if (isNode) {
  try {
    fs = require('fs')
    path = require('path')
    createWriteStream = require('fs').createWriteStream
  } catch (e) {}
}

// =============================
// CONFIGURATION
// =============================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
}

const LOG_LEVEL_NAMES = {
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR'
}

const DEFAULT_CONFIG = {
  level: process.env.LOG_LEVEL || LOG_LEVELS.INFO,
  persist: process.env.LOG_PERSIST === 'true' || false,
  logDir: process.env.LOG_DIR || './logs',
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 5,
  format: 'json', // json, text
  timestamp: true,
  colors: true,
  maxRatePerSecond: 1000, // logs par seconde max
  rotationInterval: 60 * 1000 // 1 minute
}

const parseLevel = (level) => {
  if (typeof level === 'number') return level
  const map = {
    debug: LOG_LEVELS.DEBUG,
    info: LOG_LEVELS.INFO,
    warn: LOG_LEVELS.WARN,
    error: LOG_LEVELS.ERROR
  }
  return map[level?.toLowerCase()] ?? LOG_LEVELS.INFO
}

// =============================
// TRANSPORTS
// =============================

class Transport {
  constructor(options = {}) {
    this.options = options
    this.level = parseLevel(options.level || LOG_LEVELS.DEBUG)
  }

  shouldLog(level) {
    return level >= this.level
  }

  async write(logEntry) {
    throw new Error('write() doit être implémenté')
  }

  async close() {}
}

class ConsoleTransport extends Transport {
  constructor(options = {}) {
    super(options)
    this.consoleMethods = {
      [LOG_LEVELS.DEBUG]: console.debug,
      [LOG_LEVELS.INFO]: console.info,
      [LOG_LEVELS.WARN]: console.warn,
      [LOG_LEVELS.ERROR]: console.error
    }
  }

  write(logEntry) {
    if (!this.shouldLog(logEntry.level)) return

    const method = this.consoleMethods[logEntry.level] || console.log
    const timeStr = this.options.timestamp
      ? `[${new Date(logEntry.timestamp).toISOString()}] `
      : ''
    const levelName = LOG_LEVEL_NAMES[logEntry.level]
    const context = logEntry.context ? ` [${logEntry.context}]` : ''
    const data = logEntry.data ? logEntry.data : ''

    const message = `${timeStr}[${levelName}]${context} ${logEntry.message}`
    
    if (this.options.colors) {
      const colors = {
        [LOG_LEVELS.DEBUG]: '\x1b[36m', // Cyan
        [LOG_LEVELS.INFO]: '\x1b[32m',  // Vert
        [LOG_LEVELS.WARN]: '\x1b[33m',  // Jaune
        [LOG_LEVELS.ERROR]: '\x1b[31m'  // Rouge
      }
      const color = colors[logEntry.level] || ''
      const reset = '\x1b[0m'
      method(color + message + reset, data)
    } else {
      method(message, data)
    }
  }
}

class FileTransport extends Transport {
  constructor(options = {}) {
    super(options)
    this.currentFile = null
    this.currentFileSize = 0
    this.stream = null
    this.rotationInterval = null
    this.baseName = options.baseName || 'app'
    this.logDir = options.logDir || './logs'
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024
    this.maxFiles = options.maxFiles || 5
    this.rotationIntervalTime = options.rotationInterval || 60 * 1000
    this.format = options.format || 'json'

    this._initLogDirectory()
    this._rotateLogFile()
    this._startRotationInterval()
  }

  _initLogDirectory() {
    if (!fs) return
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
    } catch (error) {
      console.error('Erreur création répertoire logs:', error)
    }
  }

  _getCurrentDate() {
    return new Date().toISOString().split('T')[0]
  }

  _getNextLogFile() {
    if (!fs || !path) return null
    const date = this._getCurrentDate()
    const baseName = `${this.baseName}-${date}`
    
    let index = 1
    while (fs.existsSync(path.join(this.logDir, `${baseName}-${index}.log`))) {
      index++
    }
    return path.join(this.logDir, `${baseName}-${index}.log`)
  }

  _rotateLogFile() {
    if (!fs || !path || !createWriteStream) return
    const newFile = this._getNextLogFile()
    if (!newFile) return
    
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }

    this.currentFile = newFile
    this.currentFileSize = 0
    this.stream = createWriteStream(this.currentFile, { flags: 'a' })

    this._cleanupOldFiles()
  }

  _cleanupOldFiles() {
    if (!fs || !path) return
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith(`${this.baseName}-`))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      if (files.length > this.maxFiles) {
        files.slice(this.maxFiles).forEach(f => {
          fs.unlinkSync(f.path)
        })
      }
    } catch (error) {
      console.error('Erreur nettoyage logs:', error)
    }
  }

  _checkRotation() {
    if (this.currentFileSize >= this.maxFileSize) {
      this._rotateLogFile()
    }
  }

  _startRotationInterval() {
    this.rotationInterval = setInterval(() => {
      this._checkRotation()
    }, this.rotationIntervalTime)
  }

  _formatLogEntry(logEntry) {
    if (this.format === 'json') {
      return JSON.stringify(logEntry) + '\n'
    }
    
    const timestamp = new Date(logEntry.timestamp).toISOString()
    const level = LOG_LEVEL_NAMES[logEntry.level]
    const context = logEntry.context ? ` [${logEntry.context}]` : ''
    const data = logEntry.data ? ` ${JSON.stringify(logEntry.data)}` : ''
    
    return `[${timestamp}] [${level}]${context} ${logEntry.message}${data}\n`
  }

  write(logEntry) {
    if (!this.shouldLog(logEntry.level) || !this.stream) return

    const line = this._formatLogEntry(logEntry)
    const bytes = Buffer.byteLength(line, 'utf8')
    
    this.stream.write(line)
    this.currentFileSize += bytes
  }

  async close() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval)
      this.rotationInterval = null
    }
    if (this.stream) {
      await new Promise(resolve => this.stream.end(resolve))
      this.stream = null
    }
  }
}

class HttpTransport extends Transport {
  constructor(options = {}) {
    super(options)
    this.endpoint = options.endpoint
    this.headers = options.headers || {}
    this.batchSize = options.batchSize || 100
    this.flushInterval = options.flushInterval || 5000
    this.buffer = []
    this.timer = null
    this._startFlushTimer()
  }

  _startFlushTimer() {
    this.timer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  async flush() {
    if (this.buffer.length === 0) return

    const batch = [...this.buffer]
    this.buffer = []

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify({ logs: batch })
      })
    } catch (error) {
      console.error('Erreur envoi logs HTTP:', error)
      // Remettre les logs dans le buffer
      this.buffer.unshift(...batch)
    }
  }

  write(logEntry) {
    if (!this.shouldLog(logEntry.level)) return

    this.buffer.push(logEntry)

    if (this.buffer.length >= this.batchSize) {
      this.flush()
    }
  }

  async close() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    await this.flush()
  }
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class Logger extends EventEmitter {
  constructor(name = 'app', config = {}) {
    super()
    this.name = name
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      level: parseLevel(config.level || DEFAULT_CONFIG.level)
    }
    this.context = {}
    this.logs = []
    this.children = new Map()
    this.transports = []
    this.stats = {
      totalLogs: 0,
      droppedLogs: 0,
      byLevel: {
        [LOG_LEVELS.DEBUG]: 0,
        [LOG_LEVELS.INFO]: 0,
        [LOG_LEVELS.WARN]: 0,
        [LOG_LEVELS.ERROR]: 0
      },
      startTime: Date.now(),
      logsPerSecond: 0,
      lastSecond: Date.now(),
      secondCount: 0
    }

    // Ajouter les transports par défaut
    this.addTransport(new ConsoleTransport({
      level: this.config.level,
      timestamp: this.config.timestamp,
      colors: this.config.colors
    }))

    if (this.config.persist && isNode) {
      this.addTransport(new FileTransport({
        level: LOG_LEVELS.DEBUG,
        baseName: name,
        logDir: this.config.logDir,
        maxFileSize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        format: this.config.format,
        rotationInterval: this.config.rotationInterval
      }))
    }
  }

  /**
   * Ajoute un transport
   */
  addTransport(transport) {
    this.transports.push(transport)
  }

  /**
   * Définit le contexte global
   */
  setContext(context) {
    this.context = { ...this.context, ...context }
  }

  /**
   * Met à jour le contexte
   */
  updateContext(updates) {
    this.context = { ...this.context, ...updates }
  }

  /**
   * Vérifie le rate limiting
   */
  _checkRateLimit() {
    const now = Date.now()
    
    if (now - this.stats.lastSecond > 1000) {
      this.stats.logsPerSecond = this.stats.secondCount
      this.stats.lastSecond = now
      this.stats.secondCount = 0
    }

    this.stats.secondCount++

    if (this.stats.secondCount > this.config.maxRatePerSecond) {
      this.stats.droppedLogs++
      return false
    }

    return true
  }

  /**
   * Log de niveau DEBUG
   */
  debug(message, data = null) {
    this._log(LOG_LEVELS.DEBUG, message, data)
  }

  /**
   * Log de niveau INFO
   */
  info(message, data = null) {
    this._log(LOG_LEVELS.INFO, message, data)
  }

  /**
   * Log de niveau WARN
   */
  warn(message, data = null) {
    this._log(LOG_LEVELS.WARN, message, data)
  }

  /**
   * Log de niveau ERROR
   */
  error(message, error = null) {
    let data = null
    
    if (error instanceof Error) {
      data = {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } else if (error) {
      data = error
    }

    this._log(LOG_LEVELS.ERROR, message, data)
  }

  /**
   * Log interne
   */
  _log(level, message, data = null) {
    // Rate limiting
    if (!this._checkRateLimit()) return

    const timestamp = Date.now()
    const logEntry = {
      level,
      message,
      data,
      timestamp,
      logger: this.name,
      context: { ...this.context }
    }

    // Ajouter aux logs en mémoire
    this.logs.push(logEntry)
    this.stats.totalLogs++
    this.stats.byLevel[level]++

    // Limiter la mémoire
    if (this.logs.length > 1000) {
      this.logs.shift()
    }

    // Envoyer à tous les transports
    for (const transport of this.transports) {
      try {
        transport.write(logEntry)
      } catch (error) {
        console.error('Erreur transport logs:', error)
      }
    }

    // Émettre l'événement
    this.emit('log', logEntry)
  }

  /**
   * Crée un logger enfant
   */
  createChild(name) {
    if (this.children.has(name)) {
      return this.children.get(name)
    }

    const child = new Logger(`${this.name}:${name}`, this.config)
    child.setContext(this.context)
    this.children.set(name, child)
    return child
  }

  /**
   * Récupère les logs récents
   */
  getLogs(limit = 100, level = null) {
    let logs = this.logs

    if (level !== null) {
      logs = logs.filter(l => l.level >= level)
    }

    return logs.slice(-limit)
  }

  /**
   * Récupère les logs d'une période
   */
  getLogsInPeriod(start, end = Date.now()) {
    return this.logs.filter(l => l.timestamp >= start && l.timestamp <= end)
  }

  /**
   * Exporte les logs au format demandé
   */
  exportLogs(format = 'json') {
    if (format === 'json') {
      return JSON.stringify({
        logger: this.name,
        generatedAt: Date.now(),
        stats: this.stats,
        context: this.context,
        logs: this.logs
      }, null, 2)
    }

    if (format === 'text') {
      const lines = []
      for (const log of this.logs) {
        const timestamp = new Date(log.timestamp).toISOString()
        const level = LOG_LEVEL_NAMES[log.level]
        const context = log.context ? ` [${JSON.stringify(log.context)}]` : ''
        const data = log.data ? ` ${JSON.stringify(log.data)}` : ''
        lines.push(`[${timestamp}] [${level}]${context} ${log.message}${data}`)
      }
      return lines.join('\n')
    }

    if (format === 'csv') {
      const headers = 'timestamp,level,message,data,context\n'
      const rows = this.logs.map(l => {
        const time = new Date(l.timestamp).toISOString()
        const level = LOG_LEVEL_NAMES[l.level]
        const message = l.message.replace(/,/g, ';')
        const data = l.data ? JSON.stringify(l.data).replace(/,/g, ';') : ''
        const context = l.context ? JSON.stringify(l.context).replace(/,/g, ';') : ''
        return `${time},${level},${message},${data},${context}`
      }).join('\n')
      return headers + rows
    }

    throw new Error(`Format non supporté: ${format}`)
  }

  /**
   * Récupère les fichiers de logs
   */
  getLogFiles() {
    try {
      return fs.readdirSync(this.config.logDir)
        .filter(f => f.startsWith(`${this.name}-`))
        .map(f => ({
          name: f,
          path: path.join(this.config.logDir, f),
          size: fs.statSync(path.join(this.config.logDir, f)).size,
          modified: fs.statSync(path.join(this.config.logDir, f)).mtime
        }))
        .sort((a, b) => b.modified - a.modified)
    } catch (error) {
      console.error('Erreur lecture fichiers logs:', error)
      return []
    }
  }

  /**
   * Lit un fichier de log
   */
  readLogFile(filename, lines = 100) {
    try {
      const filePath = path.join(this.config.logDir, filename)
      if (!fs.existsSync(filePath)) return []

      const content = fs.readFileSync(filePath, 'utf8')
      const allLines = content.split('\n').filter(l => l.trim())

      if (this.config.format === 'json') {
        return allLines
          .slice(-lines)
          .map(l => JSON.parse(l))
      } else {
        return allLines.slice(-lines)
      }
    } catch (error) {
      console.error('Erreur lecture fichier log:', error)
      return []
    }
  }

  /**
   * Nettoie les logs en mémoire
   */
  clear() {
    this.logs = []
    this.stats.totalLogs = 0
    this.stats.droppedLogs = 0
    this.stats.byLevel = {
      [LOG_LEVELS.DEBUG]: 0,
      [LOG_LEVELS.INFO]: 0,
      [LOG_LEVELS.WARN]: 0,
      [LOG_LEVELS.ERROR]: 0
    }
    this.emit('cleared')
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      memoryLogs: this.logs.length,
      children: this.children.size,
      transports: this.transports.length,
      config: {
        level: LOG_LEVEL_NAMES[this.config.level],
        persist: this.config.persist,
        format: this.config.format,
        maxRatePerSecond: this.config.maxRatePerSecond
      }
    }
  }

  /**
   * Nettoie les ressources
   */
  async destroy() {
    this.logs = []
    this.children.clear()
    
    // Fermer tous les transports
    for (const transport of this.transports) {
      await transport.close()
    }
    
    this.removeAllListeners()
  }
}

// =============================
// SINGLETON PRINCIPAL
// =============================

export const rootLogger = new Logger('vibe-coding', {
  level: process.env.NODE_ENV === 'development' ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO,
  persist: true,
  colors: true
})

export default rootLogger

export const logger = rootLogger;
