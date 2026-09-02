/**
 * installHelper - Assistance à l'installation Android
 * 
 * Rôle: Aider l'utilisateur à installer l'application
 * - Détection de la plateforme
 * - Instructions pas à pas adaptatives
 * - Ouverture des paramètres
 * - Vérification de l'installation via WebSocket
 * - Événements pour l'IDE
 * - Progression en temps réel
 */

import { EventEmitter } from 'events'
import { logger } from '../utils/logger'

// =============================
// CONFIGURATION
// =============================

const ANDROID_VERSIONS = {
  '4.4': 'KitKat',
  '5.0': 'Lollipop',
  '5.1': 'Lollipop',
  '6.0': 'Marshmallow',
  '7.0': 'Nougat',
  '7.1': 'Nougat',
  '8.0': 'Oreo',
  '8.1': 'Oreo',
  '9.0': 'Pie',
  '10': 'Android 10',
  '11': 'Android 11',
  '12': 'Android 12',
  '12.1': 'Android 12L',
  '13': 'Android 13',
  '14': 'Android 14',
  '15': 'Android 15'
}

const INSTALL_STEPS = {
  ENABLE_UNKNOWN_SOURCES: 'enable_unknown_sources',
  ALLOW_BROWSER_INSTALL: 'allow_browser_install',
  DOWNLOAD_APK: 'download_apk',
  OPEN_APK: 'open_apk',
  CONFIRM_INSTALL: 'confirm_install',
  COMPLETE: 'complete'
}

const INSTALL_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  EXPIRED: 'expired'
}

const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 heure
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24h
const PING_TIMEOUT = 5 * 60 * 1000 // 5 minutes

// =============================
// CLASSE PRINCIPALE
// =============================

export class InstallHelper extends EventEmitter {
  constructor() {
    super()

    this.installSessions = new Map() // sessionId -> installState
    this.verifiedDevices = new Set() // deviceId -> already installed
    this.pendingVerifications = new Map() // deviceId -> sessionId

    this.stats = {
      totalSessions: 0,
      completedInstalls: 0,
      failedInstalls: 0,
      activeSessions: 0,
      verifiedDevices: 0
    }

    this.logger = logger.createChild('InstallHelper')

    // Nettoyage automatique des sessions expirées
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions()
    }, CLEANUP_INTERVAL)

    // Nettoyage des vérifications en attente
    this.pingInterval = setInterval(() => {
      this._cleanupPendingVerifications()
    }, PING_TIMEOUT)
  }

  /**
   * Détecte la plateforme de l'utilisateur
   */
  detectPlatform(userAgent = null) {
    const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')
    
    const platforms = {
      android: /android/i.test(ua),
      ios: /iphone|ipad|ipod/i.test(ua),
      windows: /windows/i.test(ua),
      mac: /macintosh|mac os x/i.test(ua),
      linux: /linux/i.test(ua)
    }

    let detected = 'unknown'
    for (const [name, isMatch] of Object.entries(platforms)) {
      if (isMatch) {
        detected = name
        break
      }
    }

    // Extraire la version Android de manière robuste
    let androidVersion = null
    let androidName = null
    
    if (platforms.android) {
      const match = ua.match(/Android\s([0-9\.]+)/i)
      androidVersion = match ? match[1] : null
      
      if (androidVersion) {
        // Normaliser la version (ex: 8.1.0 → 8.1)
        const parts = androidVersion.split('.')
        androidVersion = parts.slice(0, 2).join('.')
        
        androidName = ANDROID_VERSIONS[androidVersion] || `Android ${androidVersion}`
      }
    }

    return {
      platform: detected,
      isAndroid: platforms.android,
      isIOS: platforms.ios,
      androidVersion,
      androidName,
      userAgent: ua,
      isMobile: platforms.android || platforms.ios
    }
  }

  /**
   * Crée une session d'installation
   */
  createInstallSession(sessionId, deviceInfo = {}) {
    if (!sessionId) {
      throw new Error("sessionId requis")
    }

    const platform = this.detectPlatform(deviceInfo.userAgent)
    const androidVersion = parseFloat(platform.androidVersion || '0')

    // Adapter les étapes selon la version Android
    const steps = {
      [INSTALL_STEPS.DOWNLOAD_APK]: false,
      [INSTALL_STEPS.OPEN_APK]: false,
      [INSTALL_STEPS.CONFIRM_INSTALL]: false,
      [INSTALL_STEPS.COMPLETE]: false
    }

    // Android 8+ nécessite une autorisation par application
    if (androidVersion >= 8) {
      steps[INSTALL_STEPS.ALLOW_BROWSER_INSTALL] = false
    } else {
      steps[INSTALL_STEPS.ENABLE_UNKNOWN_SOURCES] = false
    }

    const session = {
      id: sessionId,
      platform: platform.platform,
      androidVersion: platform.androidVersion,
      androidName: platform.androidName,
      steps,
      status: INSTALL_STATUS.NOT_STARTED,
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastPing: null,
      deviceInfo,
      metadata: {
        attempts: 0,
        errors: [],
        verifiedDeviceId: null
      }
    }

    this.installSessions.set(sessionId, session)
    this.stats.totalSessions++
    this.stats.activeSessions = this.installSessions.size

    this.logger.info(`Session d'installation créée`, {
      sessionId,
      platform: platform.platform,
      androidVersion: platform.androidVersion
    })

    this.emit('session:created', { sessionId, session })

    return session
  }

  /**
   * Calcule la progression
   */
  _getProgress(session) {
    const total = Object.keys(session.steps).length
    const done = Object.values(session.steps).filter(v => v === true).length
    return Math.round((done / total) * 100)
  }

  /**
   * Génère les instructions d'installation
   */
  getInstallInstructions(sessionId, options = {}) {
    const session = this.installSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} non trouvée`)
    }

    const { language = 'fr', step = null } = options
    const platform = session.platform
    const androidVersion = parseFloat(session.androidVersion || '0')

    if (platform !== 'android') {
      return this._getNonAndroidInstructions(platform, language)
    }

    const instructions = this._getAndroidInstructions(session.androidVersion, androidVersion, language)
    
    // Ajouter les étapes déjà complétées
    instructions.forEach(inst => {
      inst.completed = session.steps[inst.id] || false
    })

    // Filtrer par étape si spécifié
    if (step) {
      return instructions.find(i => i.id === step) || instructions[0]
    }

    return instructions
  }

  /**
   * Instructions pour Android
   */
  _getAndroidInstructions(androidVersionStr, androidVersion, language) {
    const instructions = []

    // Étape spécifique selon la version
    if (androidVersion >= 8) {
      instructions.push({
        id: INSTALL_STEPS.ALLOW_BROWSER_INSTALL,
        title: language === 'fr' ? '1. Autoriser l\'installation depuis le navigateur' : '1. Allow browser installation',
        description: language === 'fr'
          ? 'Allez dans Paramètres > Applications > Votre navigateur > Installer applications inconnues'
          : 'Go to Settings > Apps > Your browser > Install unknown apps',
        action: 'settings',
        actionLabel: language === 'fr' ? 'Ouvrir les paramètres' : 'Open settings',
        androidVersion: '8+',
        required: true,
        docs: 'https://developer.android.com/guide/topics/admin/device-policy#install_unknown_apps'
      })
    } else {
      instructions.push({
        id: INSTALL_STEPS.ENABLE_UNKNOWN_SOURCES,
        title: language === 'fr' ? '1. Autoriser les sources inconnues' : '1. Allow unknown sources',
        description: language === 'fr'
          ? 'Allez dans Paramètres > Sécurité > Sources inconnues'
          : 'Go to Settings > Security > Unknown sources',
        action: 'settings',
        actionLabel: language === 'fr' ? 'Ouvrir les paramètres' : 'Open settings',
        androidVersion: '<8',
        required: true
      })
    }

    instructions.push(
      {
        id: INSTALL_STEPS.DOWNLOAD_APK,
        title: language === 'fr' ? '2. Télécharger l\'APK' : '2. Download APK',
        description: language === 'fr'
          ? 'Scannez le QR code ou cliquez sur le lien ci-dessous'
          : 'Scan the QR code or click the link below',
        action: 'download',
        actionLabel: language === 'fr' ? 'Télécharger' : 'Download',
        androidVersion: 'all',
        required: true
      },
      {
        id: INSTALL_STEPS.OPEN_APK,
        title: language === 'fr' ? '3. Ouvrir le fichier APK' : '3. Open APK file',
        description: language === 'fr'
          ? 'Une fois téléchargé, ouvrez le fichier APK'
          : 'Once downloaded, open the APK file',
        action: 'open',
        actionLabel: language === 'fr' ? 'Ouvrir' : 'Open',
        androidVersion: 'all',
        required: true
      },
      {
        id: INSTALL_STEPS.CONFIRM_INSTALL,
        title: language === 'fr' ? '4. Confirmer l\'installation' : '4. Confirm installation',
        description: language === 'fr'
          ? 'Appuyez sur "Installer" puis "Ouvrir"'
          : 'Tap "Install" then "Open"',
        action: 'install',
        actionLabel: language === 'fr' ? 'Installer' : 'Install',
        androidVersion: 'all',
        required: true
      }
    )

    return instructions
  }

  /**
   * Instructions pour les autres plateformes
   */
  _getNonAndroidInstructions(platform, language) {
    return [{
      id: 'not_android',
      title: language === 'fr' ? 'Plateforme non supportée' : 'Platform not supported',
      description: language === 'fr'
        ? `L'installation directe d'APK n'est pas disponible sur ${platform}.`
        : `APK installation is not available on ${platform}.`,
      action: 'info',
      actionLabel: language === 'fr' ? 'En savoir plus' : 'Learn more',
      platform,
      required: false,
      completed: false
    }]
  }

  /**
   * Ouvre les paramètres Android
   */
  async openAndroidSettings() {
    // Pour une PWA/web, on ne peut pas ouvrir directement les paramètres
    // On guide l'utilisateur
    this.logger.info('Ouverture des paramètres Android demandée')
    
    return {
      success: true,
      message: 'Veuillez ouvrir manuellement les paramètres Android',
      instructions: 'Paramètres > Sécurité > Sources inconnues'
    }
  }

  /**
   * Vérifie si l'installation est possible
   */
  async checkInstallCapability(deviceInfo = {}) {
    const platform = this.detectPlatform(deviceInfo.userAgent)
    const version = parseFloat(platform.androidVersion || '0')
    
    const capabilities = {
      canInstall: platform.isAndroid,
      platform: platform.platform,
      androidVersion: platform.androidVersion,
      androidName: platform.androidName,
      requiresPermission: version >= 8,
      requiresUnknownSources: version < 8,
      limitations: [],
      steps: []
    }

    if (platform.isAndroid) {
      if (version < 4.4) {
        capabilities.limitations.push('Version Android trop ancienne (minimum 4.4)')
        capabilities.canInstall = false
      }
      
      if (version >= 11) {
        capabilities.permissionFlow = 'scoped'
        capabilities.limitations.push('Installation par application requise')
      }

      // Ajouter les étapes requises
      if (version >= 8) {
        capabilities.steps.push('allow_browser_install')
      } else {
        capabilities.steps.push('enable_unknown_sources')
      }
      capabilities.steps.push('download_apk', 'open_apk', 'confirm_install')
    }

    return capabilities
  }

  /**
   * Met à jour l'état d'une étape d'installation
   */
  async updateInstallStep(sessionId, stepId, completed = true) {
    const session = this.installSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} non trouvée`)
    }

    if (!session.steps.hasOwnProperty(stepId)) {
      throw new Error(`Étape ${stepId} invalide`)
    }

    session.steps[stepId] = completed
    session.updatedAt = Date.now()
    session.progress = this._getProgress(session)

    // Vérifier si toutes les étapes sont complétées
    const allCompleted = Object.values(session.steps).every(v => v === true)
    
    if (allCompleted) {
      session.status = INSTALL_STATUS.COMPLETED
      this.stats.completedInstalls++
      this.logger.success(`Installation terminée`, { sessionId, progress: session.progress })
      this.emit('install:completed', { sessionId, session })
    } else {
      session.status = INSTALL_STATUS.IN_PROGRESS
      this.emit('install:progress', { sessionId, stepId, progress: session.progress })
    }

    this.emit('step:updated', {
      sessionId,
      stepId,
      completed,
      progress: session.progress,
      allCompleted
    })

    return {
      success: true,
      session
    }
  }

  /**
   * Vérifie l'installation via WebSocket
   */
  async verifyInstallation(deviceId, sessionId = null) {
    if (this.verifiedDevices.has(deviceId)) {
      return true
    }

    // Marquer comme vérifié
    this.verifiedDevices.add(deviceId)
    this.stats.verifiedDevices = this.verifiedDevices.size

    // Si une session est associée, marquer l'étape comme complétée
    if (sessionId) {
      this.pendingVerifications.set(deviceId, sessionId)
      
      const session = this.installSessions.get(sessionId)
      if (session && session.status !== INSTALL_STATUS.COMPLETED) {
        await this.updateInstallStep(sessionId, INSTALL_STEPS.CONFIRM_INSTALL, true)
        await this.updateInstallStep(sessionId, INSTALL_STEPS.COMPLETE, true)
        
        session.metadata.verifiedDeviceId = deviceId
        session.lastPing = Date.now()
        
        this.pendingVerifications.delete(deviceId)
        this.emit('install:verified', { sessionId, deviceId })
      }
    }

    this.logger.info(`Installation vérifiée`, { deviceId, sessionId })

    return true
  }

  /**
   * Nettoie les vérifications en attente
   */
  _cleanupPendingVerifications() {
    const now = Date.now()
    let cleaned = 0

    for (const [deviceId, sessionId] of this.pendingVerifications.entries()) {
      const session = this.installSessions.get(sessionId)
      if (!session || now - session.updatedAt > PING_TIMEOUT) {
        this.pendingVerifications.delete(deviceId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`${cleaned} vérifications en attente nettoyées`)
    }
  }

  /**
   * Enregistre une erreur d'installation
   */
  async recordInstallError(sessionId, error) {
    const session = this.installSessions.get(sessionId)
    if (!session) return

    session.metadata.errors.push({
      message: error.message,
      timestamp: Date.now()
    })
    session.metadata.attempts++
    session.status = INSTALL_STATUS.FAILED
    session.updatedAt = Date.now()

    this.stats.failedInstalls++

    this.logger.error(`Erreur installation`, {
      sessionId,
      error: error.message,
      attempt: session.metadata.attempts
    })

    this.emit('install:failed', { sessionId, error: error.message, session })

    return {
      success: false,
      session
    }
  }

  /**
   * Récupère l'état d'une session
   */
  getInstallSession(sessionId) {
    return this.installSessions.get(sessionId) || null
  }

  /**
   * Récupère toutes les sessions actives
   */
  getActiveSessions() {
    const active = []
    for (const [id, session] of this.installSessions.entries()) {
      if (session.status === INSTALL_STATUS.IN_PROGRESS || session.status === INSTALL_STATUS.NOT_STARTED) {
        active.push({ id, ...session })
      }
    }
    return active
  }

  /**
   * Nettoie les sessions expirées
   */
  cleanupExpiredSessions(maxAge = SESSION_TIMEOUT) {
    const now = Date.now()
    let cleaned = 0

    for (const [id, session] of this.installSessions.entries()) {
      if (now - session.updatedAt > maxAge) {
        session.status = INSTALL_STATUS.EXPIRED
        this.installSessions.delete(id)
        cleaned++
        this.emit('session:expired', { sessionId: id, session })
      }
    }

    if (cleaned > 0) {
      this.stats.activeSessions = this.installSessions.size
      this.logger.info(`${cleaned} sessions expirées nettoyées`)
    }

    return cleaned
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    return {
      ...this.stats,
      activeSessions: this.installSessions.size,
      verifiedDevices: this.verifiedDevices.size,
      pendingVerifications: this.pendingVerifications.size
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.installSessions.clear()
    this.verifiedDevices.clear()
    this.pendingVerifications.clear()
    this.removeAllListeners()
  }
}

export const installHelper = new InstallHelper()

export default installHelper
