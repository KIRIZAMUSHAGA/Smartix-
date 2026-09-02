/**
 * Module AI pour Vibe-Coding
 * Version PRO avec intégration analytics, mobile et auto-évolution
 * 
 * Rôle: Gérer les fonctionnalités d'IA du système
 * - Évolution automatique basée sur analytics réels
 * - Détection proactive des problèmes (crash, rétention)
 * - App Health Report avec scoring
 * - Queue système pour contrôle des coûts
 */

import { logger } from '../mobile/utils/logger'
import { cache } from '../mobile/utils/cache'
import { rateLimiter } from '../mobile/utils/rateLimiter'
import { Queue } from 'bullmq' // Pour la file d'attente
import Redis from 'ioredis'

// =============================
// IMPORTS DYNAMIQUES
// =============================

let evolutionModule
let servicesCache = null
let initializing = null
let aiQueue = null

async function loadModules() {
  if (!evolutionModule) {
    const { 
      appEvolutionService, 
      EVOLUTION_TYPES, 
      EVOLUTION_STATUS,
      initializeEvolutionService,
      getEvolutionService,
      setPublishService,
      setProjectService,
      setAnalyticsService,
      setEventsService,
      setMobileService,
      setApiKey,
      setModel
    } = await import('./appEvolutionService')

    evolutionModule = {
      service: appEvolutionService,
      initialize: initializeEvolutionService,
      get: getEvolutionService,
      setPublish: setPublishService,
      setProject: setProjectService,
      setAnalytics: setAnalyticsService,
      setEvents: setEventsService,
      setMobile: setMobileService,
      setApiKey,
      setModel,
      constants: { EVOLUTION_TYPES, EVOLUTION_STATUS }
    }
  }

  return { evolutionModule }
}

// =============================
// CONSTANTES
// =============================

export const AI_VERSION = '3.0.0'

export const AI_CONFIG = {
  EVOLUTION_TYPES: {
    UI: 'ui',
    PERFORMANCE: 'performance',
    FEATURE: 'feature',
    SECURITY: 'security',
    BUG_FIX: 'bug_fix',
    OPTIMIZATION: 'optimization',
    REFACTOR: 'refactor',
    DOCUMENTATION: 'documentation',
    ONBOARDING: 'onboarding', // Nouveau
    UX: 'ux' // Nouveau
  },
  EVOLUTION_STATUS: {
    PENDING: 'pending',
    ANALYZING: 'analyzing',
    GENERATING: 'generating',
    TESTING: 'testing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REJECTED: 'rejected',
    APPLIED: 'applied',
    QUEUED: 'queued' // Nouveau
  },
  CONFIDENCE_LEVELS: {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  },
  // 🔧 Rate limiting pour contrôler les coûts API
  RATE_LIMITS: {
    ANALYZE: 10,
    GENERATE: 5,
    OPTIMIZE: 10,
    SECURITY: 5,
    HEALTH: 20
  },
  // 🔧 Seuils pour déclenchement automatique
  AUTO_TRIGGERS: {
    RETENTION_THRESHOLD: 20, // Si rétention < 20%
    CRASH_RATE_THRESHOLD: 5,  // Si crash rate > 5%
    SESSION_DURATION_THRESHOLD: 60, // Si session < 60s
    INSTALL_TO_ACTIVE_RATIO: 0.3 // Si < 30% des installs deviennent actifs
  },
  // 🔧 Limites de tokens pour éviter coûts excessifs
  MAX_CODE_SIZE: 200000, // 200k caractères max
  MAX_PROMPT_TOKENS: 8000,
  // 🔧 Configuration de la queue
  QUEUE: {
    MAX_CONCURRENT: 2, // 2 jobs en parallèle max
    PRIORITY: {
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3
    }
  }
}

// =============================
// TYPES (pour JSDoc)
// =============================

/**
 * @typedef {Object} EvolutionSuggestion
 * @property {string} id - ID de la suggestion
 * @property {string} appId - ID de l'application
 * @property {string} type - Type d'évolution
 * @property {string} title - Titre de la suggestion
 * @property {string} description - Description détaillée
 * @property {number} confidence - Niveau de confiance (0-1)
 * @property {Object} changes - Modifications proposées
 * @property {Array<string>} files - Fichiers concernés
 * @property {string} status - Statut de la suggestion
 * @property {number} createdAt - Date de création
 * @property {number} estimatedTokens - Tokens estimés
 * @property {string} reason - Raison de la suggestion (ex: "low_retention")
 */

/**
 * @typedef {Object} AppHealthReport
 * @property {string} appId - ID de l'application
 * @property {Object} scores - Scores par catégorie
 * @property {number} scores.security - Score sécurité (0-100)
 * @property {number} scores.performance - Score performance (0-100)
 * @property {number} scores.ux - Score UX (0-100)
 * @property {number} scores.stability - Score stabilité (0-100)
 * @property {number} overall - Score global
 * @property {Array<Object>} issues - Problèmes détectés
 * @property {Array<Object>} suggestions - Suggestions d'amélioration
 */

// =============================
// AI QUEUE SYSTEM
// =============================

class AIQueue {
  constructor(redisUrl) {
    this.queue = new Queue('ai-evolution', {
      connection: new Redis(redisUrl)
    })
    this.activeJobs = 0
  }

  async addJob(type, data, priority = AI_CONFIG.QUEUE.PRIORITY.MEDIUM) {
    const job = await this.queue.add(type, data, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    })

    logger.info(`Job added to queue`, { jobId: job.id, type })
    return job
  }

  async getJobStatus(jobId) {
    const job = await this.queue.getJob(jobId)
    if (!job) return null

    return {
      id: job.id,
      type: job.name,
      status: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
      failedReason: job.failedReason
    }
  }

  async cancelJob(jobId) {
    const job = await this.queue.getJob(jobId)
    if (job) {
      await job.remove()
      logger.info(`Job cancelled`, { jobId })
    }
  }
}

// =============================
// INITIALISATION
// =============================

/**
 * Initialise le module AI
 * @param {Object} config - Configuration
 * @param {string} config.apiKey - Clé API OpenAI/Claude (requis)
 * @param {string} config.model - Modèle à utiliser (défaut: gpt-4)
 * @param {boolean} config.autoAnalyze - Analyser automatiquement les apps
 * @param {Object} config.publishService - Service de publication
 * @param {Object} config.projectService - Service de projets
 * @param {Object} config.analyticsService - Service d'analytics
 * @param {Object} config.eventsService - Service d'événements
 * @param {Object} config.mobileService - Service mobile
 * @param {string} config.redisUrl - URL Redis pour la queue
 * @param {Object} config.rateLimits - Limites personnalisées
 */
export async function initializeAI(config = {}) {
  if (initializing) return initializing

  const {
    apiKey,
    model = 'gpt-4',
    autoAnalyze = false,
    publishService,
    projectService,
    analyticsService,
    eventsService,
    mobileService,
    redisUrl = process.env.REDIS_URL,
    rateLimits = {}
  } = config

  logger.info('🚀 Initialisation du module AI...')

  initializing = (async () => {
    try {
      if (!apiKey) {
        throw new Error('Clé API requise pour initialiser le module AI')
      }

      const modules = await loadModules()

      // Configurer l'API
      modules.evolutionModule.setApiKey(apiKey)
      modules.evolutionModule.setModel(model)

      // Injecter les dépendances
      if (publishService) modules.evolutionModule.setPublish(publishService)
      if (projectService) modules.evolutionModule.setProject(projectService)
      if (analyticsService) modules.evolutionModule.setAnalytics(analyticsService)
      if (eventsService) modules.evolutionModule.setEvents(eventsService)
      if (mobileService) modules.evolutionModule.setMobile(mobileService)

      // Initialiser la queue
      if (redisUrl) {
        aiQueue = new AIQueue(redisUrl)
      }

      // Initialiser le service
      modules.evolutionModule.initialize({
        rateLimits: { ...AI_CONFIG.RATE_LIMITS, ...rateLimits },
        queue: aiQueue,
        maxCodeSize: AI_CONFIG.MAX_CODE_SIZE
      })

      servicesCache = {
        evolution: modules.evolutionModule.get()
      }

      // Démarrer l'analyse automatique si demandé
      if (autoAnalyze) {
        servicesCache.evolution.startAutoAnalysis()
        this._setupAutoTriggers(analyticsService, eventsService)
      }

      logger.success('✅ Module AI initialisé avec succès')
      return { 
        success: true,
        version: AI_VERSION,
        model,
        autoAnalyze,
        queueEnabled: !!aiQueue
      }

    } catch (error) {
      logger.error('❌ Échec initialisation module AI:', error)
      return { success: false, error: error.message }
    } finally {
      initializing = null
    }
  })()

  return initializing
}

// =============================
// AUTO-TRIGGERS BASÉS SUR ANALYTICS
// =============================

async function _setupAutoTriggers(analyticsService, eventsService) {
  if (!analyticsService || !eventsService) return

  // Vérifier toutes les heures
  setInterval(async () => {
    try {
      const apps = await servicesCache.evolution.getActiveApps()
      
      for (const app of apps) {
        await triggerAIAnalysis(app.id)
      }
    } catch (error) {
      logger.error('Auto-trigger error:', error)
    }
  }, 60 * 60 * 1000) // 1 heure

  // Écouter les événements de crash
  eventsService.on('event', async (event) => {
    if (event.type === 'error' && event.data?.crash) {
      // Crash détecté, déclencher analyse
      const crashRate = await _calculateCrashRate(event.appId)
      if (crashRate > AI_CONFIG.AUTO_TRIGGERS.CRASH_RATE_THRESHOLD) {
        await queueAIAnalysis(event.appId, {
          reason: 'high_crash_rate',
          priority: AI_CONFIG.QUEUE.PRIORITY.HIGH,
          data: { crashRate, lastCrash: event }
        })
      }
    }
  })
}

async function _calculateCrashRate(appId) {
  const events = await servicesCache.evolution.getEvents(appId, {
    type: 'error',
    period: 'week'
  })
  const totalSessions = await servicesCache.evolution.getTotalSessions(appId, 'week')
  
  return totalSessions > 0 ? (events.length / totalSessions) * 100 : 0
}

// =============================
// FONCTION DE DÉCLENCHEMENT AUTOMATIQUE
// =============================

/**
 * 🔧 Déclenche une analyse IA basée sur les métriques
 */
export async function triggerAIAnalysis(appId) {
  try {
    const modules = await loadModules()
    const analytics = modules.evolutionModule.get().getAnalyticsService()

    if (!analytics) return

    // Récupérer les métriques clés
    const [retention, dau, mau, stickiness, funnel] = await Promise.all([
      analytics.calculateRetention?.(appId, 7),
      analytics.getDAU?.(appId),
      analytics.getMAU?.(appId),
      analytics.getStickiness?.(appId),
      analytics.getConversionRate?.(appId)
    ])

    const triggers = []

    // Vérifier rétention
    if (retention && retention[6]?.percentage < AI_CONFIG.AUTO_TRIGGERS.RETENTION_THRESHOLD) {
      triggers.push({
        reason: 'low_retention',
        data: { retention: retention[6].percentage },
        priority: AI_CONFIG.QUEUE.PRIORITY.HIGH
      })
    }

    // Vérifier conversion install → actif
    if (funnel && funnel.installs > 0) {
      const installToActive = (dau / funnel.installs) * 100
      if (installToActive < AI_CONFIG.AUTO_TRIGGERS.INSTALL_TO_ACTIVE_RATIO * 100) {
        triggers.push({
          reason: 'low_activation',
          data: { installToActive },
          priority: AI_CONFIG.QUEUE.PRIORITY.MEDIUM
        })
      }
    }

    // Vérifier engagement (stickiness)
    if (stickiness && stickiness.stickiness < 20) {
      triggers.push({
        reason: 'low_engagement',
        data: { stickiness: stickiness.stickiness },
        priority: AI_CONFIG.QUEUE.PRIORITY.MEDIUM
      })
    }

    // Déclencher les analyses
    for (const trigger of triggers) {
      await queueAIAnalysis(appId, {
        reason: trigger.reason,
        priority: trigger.priority,
        data: trigger.data
      })
    }

    return triggers
  } catch (error) {
    logger.error('Trigger AI analysis error:', error)
    return []
  }
}

// =============================
// QUEUE WRAPPER
// =============================

async function queueAIAnalysis(appId, options = {}) {
  const {
    reason = 'manual',
    priority = AI_CONFIG.QUEUE.PRIORITY.MEDIUM,
    data = {}
  } = options

  if (aiQueue) {
    const job = await aiQueue.addJob('analyze', {
      appId,
      reason,
      data,
      timestamp: Date.now()
    }, priority)

    return {
      queued: true,
      jobId: job.id,
      estimatedWait: _estimateWaitTime(priority)
    }
  } else {
    // Exécution directe si pas de queue
    return withEvolutionService(
      (service) => service.analyzeApp(appId, { reason, ...data }),
      `ANALYZE:${appId}`
    )
  }
}

function _estimateWaitTime(priority) {
  switch (priority) {
    case AI_CONFIG.QUEUE.PRIORITY.HIGH:
      return 0
    case AI_CONFIG.QUEUE.PRIORITY.MEDIUM:
      return 5 * 60 * 1000 // 5 minutes
    case AI_CONFIG.QUEUE.PRIORITY.LOW:
      return 30 * 60 * 1000 // 30 minutes
    default:
      return 10 * 60 * 1000
  }
}

// =============================
// WRAPPER SÉCURISÉ
// =============================

async function withEvolutionService(operation, rateLimitKey = null, ...args) {
  try {
    if (!servicesCache?.evolution) {
      const modules = await loadModules()
      const service = modules.evolutionModule.get()
      if (!service) {
        throw new Error('EvolutionService non initialisé')
      }
      servicesCache = { evolution: service }
    }

    // Rate limiting
    if (rateLimitKey) {
      const [type, identifier] = rateLimitKey.split(':')
      const limit = AI_CONFIG.RATE_LIMITS[type] || 10
      const key = `ai:${rateLimitKey}:${new Date().toISOString().split('T')[0]}`

      const count = await rateLimiter.increment(key)
      if (count === 1) {
        await rateLimiter.expire(key, 24 * 60 * 60)
      }

      if (count > limit) {
        throw new Error(`Rate limit exceeded for ${type}. Maximum ${limit} per day.`)
      }
    }

    return await operation(servicesCache.evolution, ...args)
  } catch (error) {
    logger.error('Erreur evolutionService:', error)
    throw error
  }
}

// =============================
// API PUBLIQUE
// =============================

/**
 * Analyse une application avec données analytics
 */
export async function analyzeApp(appId, options = {}) {
  const { reason = 'manual', priority = AI_CONFIG.QUEUE.PRIORITY.MEDIUM } = options

  // Si raison basée sur analytics, utiliser la queue
  if (reason !== 'manual') {
    return queueAIAnalysis(appId, { reason, priority, data: options.data })
  }

  return withEvolutionService(
    async (service) => {
      // Enrichir avec analytics
      const analytics = service.getAnalyticsService()
      if (analytics) {
        const [metrics, retention, dau, mau] = await Promise.all([
          analytics.getAppMetrics?.(appId),
          analytics.calculateRetention?.(appId, 7),
          analytics.getDAU?.(appId),
          analytics.getMAU?.(appId)
        ])

        options.analytics = { metrics, retention, dau, mau }
      }

      return service.analyzeApp(appId, options)
    },
    `ANALYZE:${appId}`
  )
}

/**
 * 🔧 App Health Report
 */
export async function getAppHealthReport(appId) {
  return withEvolutionService(
    async (service) => {
      const analytics = service.getAnalyticsService()
      const mobile = service.getMobileService()

      // Collecter toutes les métriques
      const [
        metrics,
        retention,
        crashRate,
        sessionData,
        securityScan,
        perfScan
      ] = await Promise.all([
        analytics?.getAppMetrics?.(appId),
        analytics?.calculateRetention?.(appId, 7),
        _calculateCrashRate(appId),
        mobile?.getSessionData?.(appId),
        service.securityScan?.(appId),
        service.performanceScan?.(appId)
      ])

      // Calculer les scores
      const scores = {
        security: securityScan?.score || 70,
        performance: perfScan?.score || 65,
        ux: _calculateUXScore(metrics, retention, sessionData),
        stability: _calculateStabilityScore(crashRate, sessionData)
      }

      const overall = Math.round(
        (scores.security + scores.performance + scores.ux + scores.stability) / 4
      )

      // Générer les suggestions
      const suggestions = await service.generateSuggestions(appId, {
        scores,
        metrics,
        retention,
        crashRate
      })

      return {
        appId,
        scores,
        overall,
        issues: _identifyIssues(scores, metrics, retention, crashRate),
        suggestions,
        timestamp: new Date().toISOString()
      }
    },
    `HEALTH:${appId}`
  )
}

function _calculateUXScore(metrics, retention, sessionData) {
  let score = 70 // Base

  if (retention) {
    if (retention[6]?.percentage > 50) score += 15
    else if (retention[6]?.percentage < 20) score -= 20
  }

  if (sessionData?.avgDuration) {
    if (sessionData.avgDuration > 300) score += 10
    else if (sessionData.avgDuration < 60) score -= 15
  }

  return Math.min(100, Math.max(0, score))
}

function _calculateStabilityScore(crashRate, sessionData) {
  let score = 80 // Base

  if (crashRate > 10) score -= 30
  else if (crashRate > 5) score -= 15
  else if (crashRate < 1) score += 10

  return Math.min(100, Math.max(0, score))
}

function _identifyIssues(scores, metrics, retention, crashRate) {
  const issues = []

  if (scores.security < 60) {
    issues.push({
      severity: 'high',
      category: 'security',
      description: 'Security vulnerabilities detected',
      impact: 'User data at risk'
    })
  }

  if (scores.performance < 50) {
    issues.push({
      severity: 'high',
      category: 'performance',
      description: 'App is slow to load and respond',
      impact: 'Users may abandon the app'
    })
  }

  if (crashRate > 5) {
    issues.push({
      severity: 'critical',
      category: 'stability',
      description: `High crash rate (${crashRate.toFixed(1)}%)`,
      impact: 'Users experience frequent crashes'
    })
  }

  if (retention && retention[6]?.percentage < 20) {
    issues.push({
      severity: 'high',
      category: 'ux',
      description: 'Very low retention rate',
      impact: 'Users try once and never return'
    })
  }

  return issues
}

/**
 * Queue status
 */
export async function getQueueStatus() {
  if (!aiQueue) return { enabled: false }

  const jobs = await aiQueue.queue.getJobs([
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed'
  ])

  return {
    enabled: true,
    counts: {
      waiting: jobs.filter(j => j.isWaiting()).length,
      active: jobs.filter(j => j.isActive()).length,
      completed: jobs.filter(j => j.isCompleted()).length,
      failed: jobs.filter(j => j.isFailed()).length,
      delayed: jobs.filter(j => j.isDelayed()).length
    },
    total: jobs.length
  }
}

// =============================
// API EXISTANTE PRÉSERVÉE
// =============================

export async function generateFeature(appId, description, options = {}) {
  return withEvolutionService(
    (service) => service.generateFeature(appId, description, options),
    `GENERATE:${appId}`
  )
}

export async function optimizePerformance(appId, options = {}) {
  return withEvolutionService(
    (service) => service.optimizePerformance(appId, options),
    `OPTIMIZE:${appId}`
  )
}

export async function improveUI(appId, options = {}) {
  return withEvolutionService(
    (service) => service.improveUI(appId, options),
    `OPTIMIZE:${appId}`
  )
}

export async function fixBug(appId, errorDescription, options = {}) {
  return withEvolutionService(
    (service) => service.fixBug(appId, errorDescription, options),
    `GENERATE:${appId}`
  )
}

export async function applyEvolution(evolutionId, options = {}) {
  return withEvolutionService(
    (service) => service.applyEvolution(evolutionId, options)
  )
}

export async function rejectEvolution(evolutionId, reason) {
  return withEvolutionService(
    (service) => service.rejectEvolution(evolutionId, reason)
  )
}

export async function getAppEvolutions(appId, options = {}) {
  return withEvolutionService(
    (service) => service.getAppEvolutions(appId, options)
  )
}

export async function getEvolution(evolutionId) {
  return withEvolutionService(
    (service) => service.getEvolution(evolutionId)
  )
}

export async function compareVersions(appId, version1, version2) {
  return withEvolutionService(
    (service) => service.compareVersions(appId, version1, version2)
  )
}

export async function generateChangelog(appId, fromVersion = null) {
  return withEvolutionService(
    (service) => service.generateChangelog(appId, fromVersion)
  )
}

export async function evaluateCode(appId, options = {}) {
  return withEvolutionService(
    (service) => service.evaluateCode(appId, options),
    `ANALYZE:${appId}`
  )
}

export async function suggestSecurityImprovements(appId) {
  return withEvolutionService(
    (service) => service.suggestSecurityImprovements(appId),
    `SECURITY:${appId}`
  )
}

export async function analyzePerformance(appId) {
  return withEvolutionService(
    (service) => service.analyzePerformance(appId),
    `ANALYZE:${appId}`
  )
}

export async function estimateCost(operation, appId, options = {}) {
  return withEvolutionService(
    (service) => service.estimateCost(operation, appId, options)
  )
}

export async function getUsageLimits() {
  return withEvolutionService(
    (service) => service.getUsageLimits()
  )
}

export async function getAIStats() {
  return withEvolutionService(
    (service) => service.getStats()
  )
}

export async function testConnection() {
  return withEvolutionService(
    (service) => service.testConnection()
  )
}

export async function cancelOperation(operationId) {
  if (aiQueue) {
    await aiQueue.cancelJob(operationId)
    return { success: true }
  }
  return withEvolutionService(
    (service) => service.cancelOperation(operationId)
  )
}

export async function getOperationStatus(operationId) {
  if (aiQueue) {
    return aiQueue.getJobStatus(operationId)
  }
  return withEvolutionService(
    (service) => service.getOperationStatus(operationId)
  )
}

// =============================
// EXPORT DES CONSTANTES
// =============================

export const EVOLUTION_TYPES = AI_CONFIG.EVOLUTION_TYPES
export const EVOLUTION_STATUS = AI_CONFIG.EVOLUTION_STATUS
export const CONFIDENCE_LEVELS = AI_CONFIG.CONFIDENCE_LEVELS

// =============================
// EXPORT PAR DÉFAUT
// =============================

export default {
  // Version
  version: AI_VERSION,
  
  // Initialisation
  initialize: initializeAI,
  shutdown: shutdownAI,
  isInitialized,
  
  // Services
  getEvolutionService: async () => servicesCache?.evolution || (await loadModules()).evolutionModule.get(),
  
  // 🔥 NOUVELLES FONCTIONS
  health: getAppHealthReport,
  trigger: triggerAIAnalysis,
  queueStatus: getQueueStatus,
  
  // Analyse
  analyze: analyzeApp,
  evaluate: evaluateCode,
  security: suggestSecurityImprovements,
  performance: analyzePerformance,
  
  // Génération
  generateFeature,
  optimize: optimizePerformance,
  improveUI,
  fixBug,
  
  // Gestion des évolutions
  apply: applyEvolution,
  reject: rejectEvolution,
  getEvolutions: getAppEvolutions,
  getEvolution,
  
  // Utilitaires
  compare: compareVersions,
  changelog: generateChangelog,
  
  // Coûts et limites
  estimateCost,
  getUsageLimits,
  cancel: cancelOperation,
  status: getOperationStatus,
  
  // Statistiques
  stats: getAIStats,
  test: testConnection,
  
  // Constantes
  constants: AI_CONFIG,
  EVOLUTION_TYPES,
  EVOLUTION_STATUS,
  CONFIDENCE_LEVELS
        }
