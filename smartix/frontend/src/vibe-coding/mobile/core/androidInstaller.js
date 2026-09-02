/**
 * androidInstaller - Installation d'applications Android
 * 
 * Rôle: Construire l'APK et gérer les installations
 * - Build avec timeout
 * - Upload CDN
 * - QR codes
 * - Tracking
 */

import { EventEmitter } from 'events'
import { apkBuilder } from '../utils/apkBuilder'
import { fileUploader } from '../utils/fileUploader'
import { qrGenerator } from '../services/qrGenerator'
import { urlGenerator } from '../utils/urlGenerator'
import { deviceManager } from './deviceManager'
import { previewSessions } from '../sessions/previewSessions'
import { logger } from '../utils/logger'

// =============================
// CONFIGURATION
// =============================

const BUILD_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const CLEANUP_INTERVAL = 30 * 60 * 1000 // 30 minutes

// =============================
// UTILITAIRES
// =============================

const validateDeviceInfo = (deviceInfo) => {
  const required = ['deviceId', 'model', 'platform']
  
  for (const field of required) {
    if (deviceInfo[field] === undefined) {
      console.warn(`⚠️ Champ manquant dans deviceInfo: ${field}`)
    }
  }
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class AndroidInstaller extends EventEmitter {

  constructor() {
    super()

    this.pendingBuilds = new Map()
    this.stats = {
      totalBuilds: 0,
      totalInstalls: 0,
      totalDownloads: 0
    }
    this.logger = logger.createChild('AndroidInstaller')

    // Nettoyage automatique
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Génère un lien d'installation
   */
  async generateInstallLink(projectId, options = {}) {
    if (!projectId) {
      throw new Error("projectId requis")
    }

    const {
      version = '1.0.0',
      environment = 'development',
      minify = true,
      includeSourceMaps = false,
      expiresIn = 24 * 60 * 60 * 1000
    } = options

    const buildKey = `${projectId}_${version}`

    try {
      // Empêcher builds concurrents
      if (this.pendingBuilds.has(buildKey)) {
        this.logger.warn(`Build déjà en cours ${buildKey}`)
        return this.pendingBuilds.get(buildKey)
      }

      const buildPromise = this._buildAPK(projectId, {
        version,
        environment,
        minify,
        includeSourceMaps,
        expiresIn
      })

      this.pendingBuilds.set(buildKey, buildPromise)

      const result = await buildPromise
      
      return result

    } catch (error) {
      this.logger.error(`Échec build APK`, { error: error.message, projectId })
      throw error

    } finally {
      this.pendingBuilds.delete(buildKey)
    }
  }

  /**
   * Processus complet de build
   */
  async _buildAPK(projectId, config) {
    const { version, expiresIn } = config

    this.emit('build:start', { projectId, version })
    this.logger.info(`Build APK démarré`, { projectId, version })

    try {
      // Build avec timeout
      const buildResult = await this._withTimeout(
        apkBuilder.build(projectId, config),
        BUILD_TIMEOUT,
        'Build timeout'
      )

      this.stats.totalBuilds++

      // Upload CDN
      const upload = await fileUploader.upload(buildResult.apkPath, {
        bucket: 'android-builds',
        contentType: 'application/vnd.android.package-archive',
        metadata: {
          projectId,
          version,
          buildId: buildResult.buildId,
          timestamp: Date.now()
        }
      })

      // URL téléchargement
      const downloadUrl = urlGenerator.generateDownloadUrl(upload.fileId, {
        expiresIn
      })

      // QR Code
      const qrCode = await qrGenerator.generate(downloadUrl, {
        size: 300
      })

      // Session installation
      const sessionId = previewSessions.createInstallSession({
        projectId,
        version,
        buildId: buildResult.buildId,
        downloadUrl,
        qrCode,
        expiresIn,
        stats: {
          downloads: 0,
          installs: 0
        }
      })

      const session = previewSessions.getInstallSession(sessionId)

      this.emit('install:ready', session)
      this.logger.success(`APK prêt`, {
        sessionId,
        size: buildResult.size
      })

      return {
        success: true,
        sessionId,
        downloadUrl,
        qrCode,
        expiresAt: session.expiresAt,
        buildInfo: {
          version,
          size: buildResult.size,
          buildNumber: buildResult.buildNumber
        }
      }

    } catch (error) {
      this.emit('build:error', { projectId, error: error.message })
      throw error
    }
  }

  /**
   * Tracking téléchargement
   */
  async trackDownload(sessionId, deviceInfo = {}) {
    const session = previewSessions.getInstallSession(sessionId)

    if (!session) {
      throw new Error("Session non trouvée")
    }

    // Validation
    validateDeviceInfo(deviceInfo)

    // Mettre à jour la session
    const updatedSession = previewSessions.incrementDownloads(sessionId)
    
    this.stats.totalDownloads++

    // Enregistrer l'appareil si présent
    if (deviceInfo.deviceId) {
      await deviceManager.registerDevice(deviceInfo.deviceId, {
        ...deviceInfo,
        lastDownload: Date.now(),
        sessionId
      })
    }

    this.emit('download', { 
      sessionId, 
      deviceInfo,
      totalDownloads: updatedSession.stats.downloads 
    })

    return { success: true }
  }

  /**
   * Tracking installation
   */
  async trackInstall(sessionId, deviceInfo = {}) {
    const session = previewSessions.getInstallSession(sessionId)

    if (!session) {
      throw new Error("Session non trouvée")
    }

    // Validation
    validateDeviceInfo(deviceInfo)

    // Mettre à jour la session
    const updatedSession = previewSessions.incrementInstalls(sessionId)

    this.stats.totalInstalls++

    // Mettre à jour l'appareil
    if (deviceInfo.deviceId) {
      await deviceManager.updateDevice(deviceInfo.deviceId, {
        lastInstall: Date.now(),
        installedVersion: session.version,
        sessionId
      })
    }

    this.emit('install', { 
      sessionId, 
      deviceInfo,
      totalInstalls: updatedSession.stats.installs 
    })

    return { success: true }
  }

  /**
   * Nettoyage sessions expirées
   */
  cleanupExpiredSessions() {
    const removed = previewSessions.cleanupExp?.() || 0

    if (removed > 0) {
      this.logger.info(`${removed} sessions expirées supprimées`)
    }

    return removed
  }

  /**
   * Promise avec timeout
   */
  async _withTimeout(promise, ms, errorMessage = 'Timeout') {
    let timeoutId

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(errorMessage))
      }, ms)
    })

    try {
      const result = await Promise.race([promise, timeoutPromise])
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Statistiques
   */
  getStats() {
    const activeSessions = previewSessions.countActive?.() || 0

    return {
      ...this.stats,
      activeSessions,
      pendingBuilds: this.pendingBuilds.size
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
    this.removeAllListeners()
  }
}

export const androidInstaller = new AndroidInstaller()

export default androidInstaller
