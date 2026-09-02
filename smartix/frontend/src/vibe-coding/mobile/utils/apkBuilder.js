/**
 * apkBuilder - Utilitaire de construction d'APK
 * 
 * Rôle: Construire un fichier APK à partir d'un projet
 * - Compilation du code
 * - Génération de l'APK/AAB
 * - Signature sécurisée
 * - Cache intelligent avec nettoyage
 * - Builds parallèles
 * - Tests automatiques
 * - Capture de screenshots multi-device
 * - Monitoring avancé
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { logger } from './logger'
import { crypto } from '../../utils/crypto'
import Redis from 'ioredis'

// =============================
// CONFIGURATION
// =============================

const BUILD_STATUS = {
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
}

const BUILD_TYPES = {
  DEBUG: 'debug',
  RELEASE: 'release',
  PROFILE: 'profile'
}

const ANDROID_VERSIONS = {
  minSdk: 21, // Android 5.0
  targetSdk: 33, // Android 13
  compileSdk: 33
}

const MAX_BUILD_TIME = 10 * 60 * 1000 // 10 minutes
const MAX_APK_SIZE = 100 * 1024 * 1024 // 100 MB
const MAX_PARALLEL_BUILDS = 3
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h
const MAX_LOGS_PER_BUILD = 500
const CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1h

// Devices pour les tests de screenshots
const TEST_DEVICES = [
  { id: 'pixel_6', name: 'Pixel 6', resolution: '1080x2400', android: '13' },
  { id: 'galaxy_s22', name: 'Galaxy S22', resolution: '1080x2340', android: '13' },
  { id: 'pixel_tablet', name: 'Pixel Tablet', resolution: '2560x1600', android: '13' }
]

// =============================
// CLASSE PRINCIPALE
// =============================

export class APKBuilder extends EventEmitter {
  constructor(redisConfig = null) {
    super()
    this.builds = new Map() // buildId -> buildInfo
    this.buildQueue = []
    this.activeBuilds = 0
    this.cache = redisConfig ? new Redis(redisConfig) : new Map() // Fallback mémoire
    this.stats = {
      totalBuilds: 0,
      successfulBuilds: 0,
      failedBuilds: 0,
      cancelledBuilds: 0,
      totalBuildDuration: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalQueueTime: 0,
      longestBuild: 0,
      fastestBuild: Infinity
    }
    this.logger = logger.createChild('APKBuilder')

    // Nettoyage périodique du cache
    this.cacheCleanupInterval = setInterval(() => {
      this._cleanupCache()
    }, CACHE_CLEANUP_INTERVAL)
  }

  /**
   * Construit un APK pour un projet
   */
  async build(projectId, options = {}) {
    const {
      version = '1.0.0',
      buildType = BUILD_TYPES.DEBUG,
      minify = true,
      includeSourceMaps = false,
      signingConfig = null,
      outputFormat = 'apk', // apk, aab
      forceRebuild = false,
      captureScreenshots = true,
      testDevices = ['pixel_6'] // liste des devices pour les tests
    } = options

    const queueStartTime = Date.now()

    // Calculer la clé de cache
    const cacheKey = await this._computeCacheKey(projectId, options)

    // Vérifier le cache
    if (!forceRebuild) {
      const cached = await this._getCachedBuild(cacheKey)
      if (cached) {
        this.stats.cacheHits++
        this.logger.info(`Build récupéré du cache`, { projectId, buildId: cached.buildId })
        return cached
      }
    }
    this.stats.cacheMisses++

    const buildId = `build_${randomUUID()}`
    const startTime = Date.now()
    const buildNumber = this.stats.totalBuilds + 1

    const buildInfo = {
      id: buildId,
      projectId,
      version,
      buildNumber,
      buildType,
      status: BUILD_STATUS.QUEUED,
      progress: 0,
      startTime,
      queueStartTime,
      endTime: null,
      duration: null,
      queueDuration: 0,
      output: null,
      screenshots: [],
      size: 0,
      logs: [],
      errors: [],
      cancelled: false,
      metadata: {
        ...options,
        androidVersion: ANDROID_VERSIONS,
        buildNumber,
        testDevices,
        captureScreenshots
      },
      signing: signingConfig ? {
        ...signingConfig,
        // Ne pas stocker les mots de passe en clair
        storePassword: signingConfig.storePassword ? '****' : null,
        keyPassword: signingConfig.keyPassword ? '****' : null
      } : null
    }

    this.builds.set(buildId, buildInfo)
    this.stats.totalBuilds++

    // Ajouter à la queue
    this.buildQueue.push(buildId)
    this._addLog(buildInfo, '🕐 Build ajouté à la file d\'attente')
    this.emit('build:queued', { buildId, projectId })
    
    this._processQueue()

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const build = this.builds.get(buildId)
        if (!build) {
          clearInterval(checkInterval)
          reject(new Error('Build introuvable'))
          return
        }

        if (build.status === BUILD_STATUS.COMPLETED) {
          clearInterval(checkInterval)
          
          // Mettre en cache
          const result = {
            success: true,
            buildId,
            apkPath: build.output,
            screenshots: build.screenshots,
            size: build.size,
            duration: build.duration,
            queueDuration: build.queueDuration,
            buildNumber
          }
          
          this._cacheBuildResult(cacheKey, result, build.metadata)
          
          resolve(result)
        }

        if (build.status === BUILD_STATUS.FAILED) {
          clearInterval(checkInterval)
          reject(new Error(build.errors.join('\n')))
        }

        if (build.status === BUILD_STATUS.CANCELLED) {
          clearInterval(checkInterval)
          reject(new Error('Build annulé'))
        }
      }, 500)

      // Timeout
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Build timeout'))
      }, MAX_BUILD_TIME)
    })
  }

  /**
   * Calcule une clé de cache basée sur le projet et les options
   */
  async _computeCacheKey(projectId, options) {
    // Dans un vrai système, on calculerait le hash des fichiers sources
    // Pour l'instant, on utilise projectId + options sans timestamp
    const { version, buildType, minify, outputFormat, captureScreenshots } = options
    const source = `${projectId}_${version}_${buildType}_${minify}_${outputFormat}_${captureScreenshots}`
    return crypto.createHash(source)
  }

  /**
   * Traite la file d'attente
   */
  async _processQueue() {
    if (this.activeBuilds >= MAX_PARALLEL_BUILDS || this.buildQueue.length === 0) return

    while (this.activeBuilds < MAX_PARALLEL_BUILDS && this.buildQueue.length > 0) {
      const buildId = this.buildQueue.shift()
      const build = this.builds.get(buildId)

      if (!build) continue

      // Calculer le temps d'attente dans la queue
      build.queueDuration = Date.now() - build.queueStartTime
      this.stats.totalQueueTime += build.queueDuration

      this.activeBuilds++
      this._runBuild(build).finally(() => {
        this.activeBuilds--
        this._processQueue()
      })
    }
  }

  /**
   * Exécute le build
   */
  async _runBuild(build) {
    this.logger.info(`Démarrage du build`, { buildId: build.id })

    try {
      this.emit('build:started', { buildId: build.id, projectId: build.projectId })

      while (Date.now() - build.startTime < MAX_BUILD_TIME) {
        // Vérifier annulation
        if (build.cancelled) throw new Error('Build annulé')

        // Étape 1: Préparation
        await this._updateBuildStatus(build, BUILD_STATUS.PREPARING, 10)
        await this._prepareBuild(build)

        // Vérifier timeout
        this._checkTimeout(build)

        // Étape 2: Compilation
        await this._updateBuildStatus(build, BUILD_STATUS.COMPILING, 25)
        await this._compileCode(build)

        this._checkTimeout(build)

        // Étape 3: Bundling
        await this._updateBuildStatus(build, BUILD_STATUS.BUNDLING, 40)
        const bundle = await this._bundleOrBuildAAB(build)

        this._checkTimeout(build)

        // Étape 4: Signature
        await this._updateBuildStatus(build, BUILD_STATUS.SIGNING, 55)
        await this._signAPK(build, bundle)

        this._checkTimeout(build)

        // Étape 5: Optimisation
        await this._updateBuildStatus(build, BUILD_STATUS.OPTIMIZING, 70)
        await this._optimizeAPK(build)

        // Vérifier la taille
        if (build.size > MAX_APK_SIZE) {
          throw new Error(`APK trop volumineux: ${this._formatSize(build.size)} > ${this._formatSize(MAX_APK_SIZE)}`)
        }

        this._checkTimeout(build)

        // Étape 6: Tests
        await this._updateBuildStatus(build, BUILD_STATUS.TESTING, 85)
        await this._testAPK(build)

        this._checkTimeout(build)

        // Étape 7: Screenshots multi-device
        if (build.metadata.captureScreenshots) {
          await this._updateBuildStatus(build, BUILD_STATUS.SCREENSHOTS, 95)
          await this._captureMultiDeviceScreenshots(build)
        }

        // Finalisation
        build.endTime = Date.now()
        build.duration = build.endTime - build.startTime
        build.status = BUILD_STATUS.COMPLETED
        build.progress = 100

        this.stats.successfulBuilds++
        this.stats.totalBuildDuration += build.duration
        this.stats.longestBuild = Math.max(this.stats.longestBuild, build.duration)
        this.stats.fastestBuild = Math.min(this.stats.fastestBuild, build.duration)

        this._addLog(build, `✅ Build terminé en ${Math.round(build.duration / 1000)}s`)

        this.emit('build:completed', {
          buildId: build.id,
          projectId: build.projectId,
          output: build.output,
          screenshots: build.screenshots,
          size: build.size,
          duration: build.duration,
          queueDuration: build.queueDuration,
          buildNumber: build.buildNumber
        })

        return
      }

      throw new Error('Build timeout')

    } catch (error) {
      if (build.cancelled) {
        build.status = BUILD_STATUS.CANCELLED
        this.stats.cancelledBuilds++
        this._addLog(build, '⛔ Build annulé')
        this.emit('build:cancelled', {
          buildId: build.id,
          projectId: build.projectId
        })
      } else {
        build.status = BUILD_STATUS.FAILED
        build.errors.push(error.message)
        this.stats.failedBuilds++
        this._addLog(build, `❌ Échec build: ${error.message}`)
        this.emit('build:failed', {
          buildId: build.id,
          projectId: build.projectId,
          error: error.message
        })
      }

      build.endTime = Date.now()
      build.duration = build.endTime - build.startTime
    }
  }

  /**
   * Vérifie le timeout
   */
  _checkTimeout(build) {
    if (Date.now() - build.startTime > MAX_BUILD_TIME) {
      throw new Error('Build timeout')
    }
  }

  /**
   * Bundle ou construit AAB selon le format
   */
  async _bundleOrBuildAAB(build) {
    if (build.metadata.outputFormat === 'aab') {
      return this._buildAAB(build)
    }
    return this._bundleAssets(build)
  }

  /**
   * Met à jour le statut du build
   */
  async _updateBuildStatus(build, status, progress) {
    build.status = status
    build.progress = progress
    this.emit('build:progress', {
      buildId: build.id,
      status,
      progress
    })
  }

  /**
   * Prépare le build
   */
  async _prepareBuild(build) {
    await this._simulateTask(1000)
    this._addLog(build, '✅ Environnement de build préparé')
  }

  /**
   * Compile le code
   */
  async _compileCode(build) {
    await this._simulateTask(2000)
    this._addLog(build, '✅ Code compilé avec succès')
  }

  /**
   * Bundle les assets
   */
  async _bundleAssets(build) {
    await this._simulateTask(1500)
    this._addLog(build, '✅ Assets bundlés')
    
    return {
      path: `/builds/${build.id}/app.apk`,
      size: 15 * 1024 * 1024 // 15 MB simulé
    }
  }

  /**
   * Construit un AAB
   */
  async _buildAAB(build) {
    await this._simulateTask(2000)
    this._addLog(build, '✅ Android App Bundle généré')
    
    return {
      path: `/builds/${build.id}/app.aab`,
      size: 12 * 1024 * 1024 // 12 MB simulé
    }
  }

  /**
   * Signe l'APK
   */
  async _signAPK(build, bundle) {
    build.output = bundle.path
    build.size = bundle.size

    // Si une configuration de signature est fournie
    if (build.signing) {
      this._addLog(build, '🔐 Signature APK...')
      await this._simulateTask(1000)
      this._addLog(build, '✅ APK signé')
    } else {
      this._addLog(build, '⚠️ APK non signé (mode debug)')
    }
  }

  /**
   * Optimise l'APK
   */
  async _optimizeAPK(build) {
    await this._simulateTask(1000)
    const oldSize = build.size
    build.size = Math.round(build.size * 0.9) // 10% de réduction
    this._addLog(build, `✅ APK optimisé: ${this._formatSize(oldSize)} → ${this._formatSize(build.size)}`)
  }

  /**
   * Teste l'APK
   */
  async _testAPK(build) {
    this._addLog(build, '🚀 Test lancement application')
    await this._simulateTask(1500)

    // Simuler un test de lancement
    const launchSuccess = Math.random() > 0.1 // 90% de succès

    if (!launchSuccess) {
      throw new Error('Échec du lancement de l\'application')
    }

    this._addLog(build, `📱 Tests sur ${build.metadata.testDevices?.length || 1} appareil(s)`)
    this._addLog(build, '✅ Application lancée avec succès')
  }

  /**
   * Capture des screenshots multi-device
   */
  async _captureMultiDeviceScreenshots(build) {
    this._addLog(build, '📸 Capture des screenshots multi-device')
    await this._simulateTask(2000)

    const screenshotNames = [
      'home',
      'login',
      'dashboard',
      'profile',
      'settings'
    ]

    const devices = build.metadata.testDevices || ['pixel_6']
    const screenshots = []

    for (const deviceId of devices) {
      const device = TEST_DEVICES.find(d => d.id === deviceId) || {
        id: deviceId,
        name: deviceId,
        resolution: '1080x2400',
        android: '13'
      }

      for (const name of screenshotNames) {
        screenshots.push({
          name,
          device: device.id,
          deviceName: device.name,
          orientation: 'portrait',
          resolution: device.resolution,
          android: device.android,
          path: `/builds/${build.id}/screenshots/${device.id}_${name}.png`,
          size: Math.floor(Math.random() * 200000) + 100000, // 100-300KB
          timestamp: Date.now()
        })
      }
    }

    build.screenshots = screenshots

    this._addLog(build, `✅ ${screenshots.length} screenshots capturés sur ${devices.length} appareil(s)`)

    this.emit('build:screenshots', {
      buildId: build.id,
      screenshots,
      devices: devices.length,
      count: screenshots.length
    })
  }

  /**
   * Simule une tâche (pour développement)
   */
  async _simulateTask(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Ajoute un log avec événement
   */
  _addLog(build, message) {
    const logEntry = {
      timestamp: Date.now(),
      message
    }
    build.logs.push(logEntry)

    // Limiter le nombre de logs en mémoire
    if (build.logs.length > MAX_LOGS_PER_BUILD) {
      build.logs.shift()
    }

    this.emit('build:log', {
      buildId: build.id,
      message,
      timestamp: logEntry.timestamp
    })
  }

  /**
   * Récupère un build
   */
  getBuild(buildId) {
    return this.builds.get(buildId) || null
  }

  /**
   * Récupère les logs d'un build
   */
  getBuildLogs(buildId, limit = 50) {
    const build = this.builds.get(buildId)
    return build ? build.logs.slice(-limit) : []
  }

  /**
   * Récupère les screenshots d'un build
   */
  getBuildScreenshots(buildId, deviceId = null) {
    const build = this.builds.get(buildId)
    if (!build) return []

    if (deviceId) {
      return build.screenshots.filter(s => s.device === deviceId)
    }
    return build.screenshots
  }

  /**
   * Annule un build
   */
  cancelBuild(buildId) {
    const build = this.builds.get(buildId)
    if (!build) return false

    if ([BUILD_STATUS.COMPLETED, BUILD_STATUS.FAILED, BUILD_STATUS.CANCELLED].includes(build.status)) {
      return false
    }

    build.cancelled = true
    this._addLog(build, '⏸️ Annulation en cours...')

    return true
  }

  /**
   * Récupère un build du cache
   */
  async _getCachedBuild(cacheKey) {
    if (this.cache instanceof Map) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data
      }
    } else {
      // Redis
      const data = await this.cache.get(`build:${cacheKey}`)
      if (data) {
        const parsed = JSON.parse(data)
        return parsed.data
      }
    }
    return null
  }

  /**
   * Met en cache un résultat de build
   */
  async _cacheBuildResult(cacheKey, result, metadata) {
    const cacheEntry = {
      data: result,
      metadata,
      timestamp: Date.now()
    }

    if (this.cache instanceof Map) {
      this.cache.set(cacheKey, cacheEntry)
    } else {
      await this.cache.setex(`build:${cacheKey}`, CACHE_TTL / 1000, JSON.stringify(cacheEntry))
    }
  }

  /**
   * Nettoie le cache
   */
  _cleanupCache() {
    if (!(this.cache instanceof Map)) return

    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.info(`${cleaned} entrées de cache nettoyées`)
    }
  }

  /**
   * Formate la taille
   */
  _formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const avgBuildTime = this.stats.successfulBuilds > 0
      ? Math.round(this.stats.totalBuildDuration / this.stats.successfulBuilds)
      : 0

    const avgQueueTime = this.stats.totalBuilds > 0
      ? Math.round(this.stats.totalQueueTime / this.stats.totalBuilds)
      : 0

    return {
      ...this.stats,
      averageBuildTime: avgBuildTime,
      averageBuildTimeFormatted: this._formatDuration(avgBuildTime),
      averageQueueTime: avgQueueTime,
      averageQueueTimeFormatted: this._formatDuration(avgQueueTime),
      queueLength: this.buildQueue.length,
      activeBuilds: this.activeBuilds,
      totalBuilds: this.stats.totalBuilds,
      successRate: this.stats.totalBuilds > 0
        ? Math.round((this.stats.successfulBuilds / this.stats.totalBuilds) * 100)
        : 0,
      cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100)
        : 0,
      fastestBuild: this.stats.fastestBuild !== Infinity
        ? this._formatDuration(this.stats.fastestBuild)
        : 'N/A',
      longestBuild: this.stats.longestBuild > 0
        ? this._formatDuration(this.stats.longestBuild)
        : 'N/A'
    }
  }

  /**
   * Formate une durée
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000)}h`
  }

  /**
   * Nettoie les builds anciens
   */
  cleanupOldBuilds(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now()
    let cleaned = 0

    for (const [id, build] of this.builds.entries()) {
      if (build.endTime && now - build.endTime > maxAge) {
        this.builds.delete(id)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.info(`${cleaned} builds anciens nettoyés`)
    }

    return cleaned
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.builds.clear()
    this.buildQueue = []
    this.removeAllListeners()

    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval)
    }

    // Fermer Redis si utilisé
    if (this.cache && this.cache.quit && typeof this.cache.quit === 'function') {
      this.cache.quit()
    }
  }
}

export const apkBuilder = new APKBuilder()
export default apkBuilder
