/**
 * deviceManager - Gestion des appareils mobiles
 * 
 * Rôle: Gérer les téléphones connectés à l'IDE
 * - Enregistrement des appareils
 * - Statut en temps réel
 * - Informations système
 * - Nettoyage automatique
 */

import { EventEmitter } from 'events'
import { deviceSessions } from '../sessions/deviceSessions'
import { logger } from '../utils/logger'

// =============================
// CONFIGURATION
// =============================

const DEVICE_MAX_IDLE = 24 * 60 * 60 * 1000 // 24h
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1h
const MAX_DEVICES = 10000 // Limite pour éviter fuite mémoire

// =============================
// VALIDATION
// =============================

const validateDeviceInfo = (deviceInfo) => {
  const errors = []

  // Vérifier les champs obligatoires
  if (!deviceInfo.deviceId) {
    errors.push('deviceId requis')
  }

  // Limiter la taille des champs
  const maxLengths = {
    model: 100,
    manufacturer: 100,
    version: 20,
    ip: 45,
    userAgent: 500
  }

  for (const [field, max] of Object.entries(maxLengths)) {
    if (deviceInfo[field] && deviceInfo[field].length > max) {
      errors.push(`${field} trop long (max ${max})`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class DeviceManager extends EventEmitter {

  constructor() {
    super()

    this.devices = new Map()
    this.connectedDevices = new Set()

    this.stats = {
      totalDevices: 0,
      connectedDevices: 0,
      androidVersions: {},
      byManufacturer: {},
      byModel: {}
    }

    this.logger = logger.createChild('DeviceManager')

    // Nettoyage automatique
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveDevices()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Enregistrer appareil
   */
  async registerDevice(deviceId, deviceInfo = {}) {
    if (!deviceId) {
      throw new Error("deviceId requis")
    }

    // Validation
    const validation = validateDeviceInfo({ deviceId, ...deviceInfo })
    if (!validation.valid) {
      throw new Error(`Données invalides: ${validation.errors.join(', ')}`)
    }

    // Limite de taille
    if (this.devices.size >= MAX_DEVICES) {
      this.logger.warn("Limite d'appareils atteinte, nettoyage forcé")
      await this.cleanupInactiveDevices(12 * 60 * 60 * 1000) // 12h
    }

    const {
      clientId,
      sessionId,
      userAgent,
      platform = 'android',
      version = 'unknown',
      model = 'unknown',
      manufacturer = 'unknown',
      ip = 'unknown',
      screen = 'unknown',
      ws,
      ...rest
    } = deviceInfo

    let device = this.devices.get(deviceId)
    const isNew = !device

    // Mise à jour des stats de version
    if (isNew) {
      this.stats.androidVersions[version] =
        (this.stats.androidVersions[version] || 0) + 1
    } else if (device.version !== version) {
      // La version a changé
      this.stats.androidVersions[device.version] =
        (this.stats.androidVersions[device.version] || 1) - 1
      if (this.stats.androidVersions[device.version] <= 0) {
        delete this.stats.androidVersions[device.version]
      }
      this.stats.androidVersions[version] =
        (this.stats.androidVersions[version] || 0) + 1
    }

    if (!device) {
      device = {
        id: deviceId,
        firstSeen: Date.now(),
        connections: 0,
        metadata: {}
      }
    }

    // Mise à jour
    device.clientId = clientId
    device.sessionId = sessionId
    device.platform = platform
    device.version = version
    device.model = model
    device.manufacturer = manufacturer
    device.userAgent = userAgent
    device.ip = ip
    device.screen = screen
    device.lastSeen = Date.now()
    device.status = 'connected'
    device.ws = ws

    device.connections++

    device.metadata = {
      ...device.metadata,
      ...rest
    }

    this.devices.set(deviceId, device)
    this.connectedDevices.add(deviceId)

    // Stats globales
    this.stats.totalDevices = this.devices.size
    this.stats.connectedDevices = this.connectedDevices.size
    this.stats.byManufacturer = this._groupBy('manufacturer')
    this.stats.byModel = this._groupBy('model')

    // Ajout à la session si présente
    if (sessionId) {
      try {
        deviceSessions.addDeviceToSession(sessionId, device)
      } catch (error) {
        this.logger.warn(`Erreur ajout session`, { sessionId, error: error.message })
      }
    }

    this.emit('device:registered', this._sanitizeDevice(device))

    this.logger.info(`Appareil connecté`, {
      model,
      version,
      deviceId: deviceId.substring(0, 8)
    })

    return this._sanitizeDevice(device)
  }

  /**
   * Mise à jour appareil
   */
  async updateDevice(deviceId, updates) {
    const device = this.devices.get(deviceId)

    if (!device) {
      throw new Error(`Appareil ${deviceId} introuvable`)
    }

    // Validation basique
    const allowedUpdates = ['sessionId', 'version', 'model', 'manufacturer', 'screen', 'metadata']

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        device[key] = value
      }
    }

    device.lastSeen = Date.now()

    // Mise à jour stats si version change
    if (updates.version && updates.version !== device.version) {
      this.stats.androidVersions[device.version] =
        (this.stats.androidVersions[device.version] || 1) - 1
      if (this.stats.androidVersions[device.version] <= 0) {
        delete this.stats.androidVersions[device.version]
      }
      this.stats.androidVersions[updates.version] =
        (this.stats.androidVersions[updates.version] || 0) + 1
    }

    this.emit('device:updated', this._sanitizeDevice(device))

    return this._sanitizeDevice(device)
  }

  /**
   * Déconnexion appareil
   */
  disconnectDevice(deviceId) {
    const device = this.devices.get(deviceId)

    if (!device) return false

    device.status = 'disconnected'
    device.lastSeen = Date.now()

    this.connectedDevices.delete(deviceId)

    this.stats.connectedDevices = this.connectedDevices.size
    this.stats.byManufacturer = this._groupBy('manufacturer')
    this.stats.byModel = this._groupBy('model')

    if (device.sessionId) {
      try {
        deviceSessions.removeDeviceFromSession(
          device.sessionId,
          device.clientId
        )
      } catch (error) {
        this.logger.warn(`Erreur retrait session`, { sessionId: device.sessionId })
      }
    }

    this.emit('device:disconnected', this._sanitizeDevice(device))

    this.logger.info(`Appareil déconnecté`, {
      model: device.model,
      deviceId: deviceId.substring(0, 8)
    })

    return true
  }

  /**
   * Récupérer appareil
   */
  getDevice(deviceId) {
    const device = this.devices.get(deviceId)
    return device ? this._sanitizeDevice(device) : null
  }

  /**
   * Appareils connectés
   */
  getConnectedDevices() {
    return Array.from(this.connectedDevices)
      .map(id => this.devices.get(id))
      .filter(Boolean)
      .map(d => this._sanitizeDevice(d))
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /**
   * Appareils session
   */
  getDevicesBySession(sessionId) {
    try {
      const devices = deviceSessions.getSessionDevices(sessionId) || []
      return devices.map(d => this._sanitizeDevice(d))
    } catch {
      return []
    }
  }

  /**
   * Appareil par clientId
   */
  getDeviceByClientId(clientId) {
    for (const device of this.devices.values()) {
      if (device.clientId === clientId) {
        return this._sanitizeDevice(device)
      }
    }
    return null
  }

  /**
   * Appareils récents
   */
  getRecentDevices(limit = 10) {
    return Array.from(this.devices.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit)
      .map(d => this._sanitizeDevice(d))
  }

  /**
   * Nettoyage appareils inactifs
   */
  cleanupInactiveDevices(maxAge = DEVICE_MAX_IDLE) {
    const cutoff = Date.now() - maxAge
    let cleaned = 0

    this.devices.forEach((device, id) => {
      if (device.lastSeen < cutoff && device.status !== 'connected') {
        // Décrémenter les stats de version
        if (this.stats.androidVersions[device.version]) {
          this.stats.androidVersions[device.version]--
          if (this.stats.androidVersions[device.version] <= 0) {
            delete this.stats.androidVersions[device.version]
          }
        }

        this.devices.delete(id)
        cleaned++
      }
    })

    if (cleaned > 0) {
      this.stats.totalDevices = this.devices.size
      this.stats.byManufacturer = this._groupBy('manufacturer')
      this.stats.byModel = this._groupBy('model')

      this.logger.info(`${cleaned} appareils inactifs supprimés`)
    }

    return cleaned
  }

  /**
   * Nombre appareils connectés
   */
  getConnectedCount() {
    return this.connectedDevices.size
  }

  /**
   * Stats
   */
  getStats() {
    return {
      ...this.stats,
      activeDevices: this.connectedDevices.size,
      totalUnique: this.devices.size
    }
  }

  /**
   * Groupement
   */
  _groupBy(prop) {
    const groups = {}

    this.devices.forEach(device => {
      const key = device[prop] || 'unknown'
      groups[key] = (groups[key] || 0) + 1
    })

    return groups
  }

  /**
   * Nettoie les données sensibles pour l'export
   */
  _sanitizeDevice(device) {
    if (!device) return null

    const { ws, ...safe } = device
    return safe
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
    this.connectedDevices.clear()
    this.removeAllListeners()
  }
}

export const deviceManager = new DeviceManager()

export default deviceManager
