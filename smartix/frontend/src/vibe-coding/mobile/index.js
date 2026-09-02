/**
 * Module Mobile pour Vibe-Coding
 * 
 * Rôle: Installation et preview en direct sur appareils Android
 * - Build APK et installation via QR code
 * - Live preview avec hot reload
 * - Gestion des appareils connectés
 * - Capture de screenshots automatique
 * - Upload de builds
 * - Génération d'URLs sécurisées
 */

// =============================
// IMPORTS LOCAUX (nécessaires pour shutdownMobile + default export)
// =============================

import { androidInstaller } from './core/androidInstaller'
import { livePreview } from './core/livePreview'
import { deviceManager } from './core/deviceManager'
import { previewServer } from './server/previewServer'
import { qrGenerator } from './services/qrGenerator'
import { installHelper } from './services/installHelper'
import { previewSessions } from './sessions/previewSessions'
import { deviceSessions } from './sessions/deviceSessions'
import { useAndroidInstall } from './hooks/useAndroidInstall'
import { useLivePreview } from './hooks/useLivePreview'
import { useDeviceManager } from './hooks/useDeviceManager'
import { InstallQR } from './components/InstallQR'
import { DeviceList } from './components/DeviceList'
import { LivePreviewBar } from './components/LivePreviewBar'
import { InstallInstructions } from './components/InstallInstructions'
import { apkBuilder } from './utils/apkBuilder'
import { fileUploader } from './utils/fileUploader'
import { urlGenerator } from './utils/urlGenerator'
import { logger, rootLogger } from './utils/logger'

// =============================
// CORE
// =============================

export { androidInstaller, livePreview, deviceManager }

// =============================
// SERVER
// =============================

export { previewServer }

// =============================
// SERVICES
// =============================

export { qrGenerator, installHelper }

// =============================
// SESSIONS
// =============================

export { previewSessions, deviceSessions }

// =============================
// HOOKS
// =============================

export { useAndroidInstall, useLivePreview, useDeviceManager }

// =============================
// COMPONENTS
// =============================

export { InstallQR, DeviceList, LivePreviewBar, InstallInstructions }

// =============================
// UTILS
// =============================

export { apkBuilder, fileUploader, urlGenerator, logger, rootLogger }

// =============================
// CONSTANTS
// =============================

export const MOBILE_VERSION = '1.0.0'

export const MOBILE_CONFIG = {
  BUILD_STATUS: {
    QUEUED: 'queued',
    PREPARING: 'preparing',
    COMPILING: 'compiling',
    BUNDLING: 'bundling',
    SIGNING: 'signing',
    OPTIMIZING: 'optimizing',
    TESTING: 'testing',
    SCREENSHOTS: 'screenshots',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
  BUILD_TYPES: {
    DEBUG: 'debug',
    RELEASE: 'release',
    PROFILE: 'profile'
  },
  UPLOAD_STATUS: {
    PENDING: 'pending',
    UPLOADING: 'uploading',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
  URL_TYPES: {
    DOWNLOAD: 'download',
    PREVIEW: 'preview',
    API: 'api',
    CDN: 'cdn',
    SHARE: 'share',
    QR: 'qr',
    DEVICE: 'device',
    SHORT: 'short'
  },
  DEVICE_STATUS: {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    TIMEOUT: 'timeout',
    BLOCKED: 'blocked',
    EXPIRED: 'expired'
  },
  INSTALL_STATUS: {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    BLOCKED: 'blocked',
    EXPIRED: 'expired'
  }
}

// =============================
// TYPES (pour JSDoc)
// =============================

/**
 * @typedef {Object} BuildResult
 * @property {boolean} success - Succès du build
 * @property {string} buildId - ID du build
 * @property {string} apkPath - Chemin vers l'APK généré
 * @property {Array<Object>} screenshots - Liste des screenshots capturés
 * @property {number} size - Taille du fichier
 * @property {number} duration - Durée du build en ms
 * @property {number} buildNumber - Numéro du build
 */

/**
 * @typedef {Object} UploadResult
 * @property {boolean} success - Succès de l'upload
 * @property {string} uploadId - ID de l'upload
 * @property {string} fileId - ID du fichier
 * @property {string} url - URL d'accès
 * @property {number} size - Taille du fichier
 * @property {number} duration - Durée de l'upload
 * @property {number} speed - Vitesse d'upload (bytes/s)
 * @property {string} checksum - Checksum du fichier
 */

/**
 * @typedef {Object} URLResult
 * @property {string} urlId - ID de l'URL
 * @property {string} url - URL générée
 * @property {string} token - Token d'accès
 * @property {string} signature - Signature HMAC
 * @property {string} shortUrl - URL courte
 * @property {number} expiresAt - Date d'expiration
 */

/**
 * @typedef {Object} DeviceInfo
 * @property {string} id - ID de l'appareil
 * @property {string} clientId - ID du client WebSocket
 * @property {string} platform - Plateforme (android/ios)
 * @property {string} version - Version Android
 * @property {string} model - Modèle de l'appareil
 * @property {string} manufacturer - Fabricant
 * @property {Date} lastSeen - Dernière activité
 * @property {string} status - Statut (connected/disconnected)
 */

// =============================
// UTILITAIRES D'INITIALISATION
// =============================

/**
 * Initialise le module mobile
 * @param {Object} config - Configuration
 * @param {string} config.apiUrl - URL de l'API
 * @param {string} config.cdnUrl - URL du CDN
 * @param {string} config.previewUrl - URL de preview
 * @param {string} config.secret - Secret pour signatures
 */
export async function initializeMobile(config = {}) {
  const logger = rootLogger.createChild('mobile:init')
  
  logger.info('Initialisation du module mobile', config)

  // Configurer les URLs
  if (config.apiUrl) {
    process.env.API_URL = config.apiUrl
  }
  if (config.cdnUrl) {
    process.env.CDN_URL = config.cdnUrl
  }
  if (config.previewUrl) {
    process.env.PREVIEW_URL = config.previewUrl
  }
  if (config.secret) {
    process.env.URL_SECRET = config.secret
  }

  // Tester les connexions
  try {
    // TODO: Vérifier connexion aux services
    logger.success('Module mobile initialisé avec succès')
    return { success: true }
  } catch (error) {
    logger.error('Échec initialisation module mobile', error)
    return { success: false, error: error.message }
  }
}

/**
 * Nettoie les ressources du module mobile
 */
export async function shutdownMobile() {
  const logger = rootLogger.createChild('mobile:shutdown')
  
  logger.info('Arrêt du module mobile')

  try {
    await androidInstaller.destroy?.()
    await livePreview.destroy?.()
    await previewServer.destroy?.()
    await previewSessions.destroy?.()
    await deviceSessions.destroy?.()
    await apkBuilder.destroy?.()
    await fileUploader.destroy?.()
    await urlGenerator.destroy?.()
    await rootLogger.destroy?.()

    logger.success('Module mobile arrêté')
    return { success: true }
  } catch (error) {
    logger.error('Erreur arrêt module mobile', error)
    return { success: false, error: error.message }
  }
}

// =============================
// EXPORT PAR DÉFAUT
// =============================

export default {
  // Version
  version: MOBILE_VERSION,
  
  // Initialisation
  initialize: initializeMobile,
  shutdown: shutdownMobile,
  
  // Core
  androidInstaller,
  livePreview,
  deviceManager,
  
  // Server
  previewServer,
  
  // Services
  qrGenerator,
  installHelper,
  
  // Sessions
  previewSessions,
  deviceSessions,
  
  // Hooks
  useAndroidInstall,
  useLivePreview,
  useDeviceManager,
  
  // Composants
  InstallQR,
  DeviceList,
  LivePreviewBar,
  InstallInstructions,
  
  // Utils
  apkBuilder,
  fileUploader,
  urlGenerator,
  logger: rootLogger,
  
  // Constantes
  constants: MOBILE_CONFIG
}
