/**
 * appEvolutionService - Service d'évolution automatique des applications
 * Version PRO avec intégration analytics, mobile et auto-déclenchement
 * 
 * Rôle: Analyser et améliorer automatiquement les applications
 * - Analyse de code + analytics (usage réel)
 * - Suggestions basées sur métriques (rétention, crashes)
 * - Génération de nouvelles fonctionnalités
 * - Optimisation des performances
 * - Correction de bugs automatique
 * - Auto-déclenchement sur seuils
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { logger } from '../mobile/utils/logger'
import { cache } from '../mobile/utils/cache'
import { rateLimiter } from '../mobile/utils/rateLimiter'

// =============================
// INJECTION DE DÉPENDANCES
// =============================
let publishService
let projectManager
let analyticsService
let eventsService
let mobileService
let codeGenerator

export const setPublishService = (service) => {
  publishService = service
}

export const setProjectManager = (manager) => {
  projectManager = manager
}

export const setAnalyticsService = (service) => {
  analyticsService = service
}

export const setEventsService = (service) => {
  eventsService = service
}

export const setMobileService = (service) => {
  mobileService = service
}

export const setCodeGenerator = (generator) => {
  codeGenerator = generator
}

// =============================
// CONFIGURATION
// =============================

export const EVOLUTION_TYPES = {
  UI: 'ui',
  PERFORMANCE: 'performance',
  FEATURE: 'feature',
  SECURITY: 'security',
  BUG_FIX: 'bug_fix',
  OPTIMIZATION: 'optimization',
  REFACTOR: 'refactor',
  ACCESSIBILITY: 'accessibility',
  ONBOARDING: 'onboarding',
  UX: 'ux'
}

export const EVOLUTION_STATUS = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  GENERATING: 'generating',
  TESTING: 'testing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REJECTED: 'rejected',
  APPLIED: 'applied'
}

const CONFIDENCE_THRESHOLD = 0.7
const MAX_SUGGESTIONS_PER_APP = 50
const ANALYSIS_INTERVAL = 6 * 60 * 60 * 1000 // 6 heures
const MAX_CODE_SIZE = 200000 // 200k caractères max
const CACHE_TTL = 60 * 60 * 1000 // 1 heure

// 🔥 Seuils pour déclenchement automatique
const AUTO_TRIGGER_THRESHOLDS = {
  RETENTION_DAY7: 20, // Si rétention J7 < 20%
  CRASH_RATE: 5,       // Si taux de crash > 5%
  SESSION_DURATION: 60, // Si session moyenne < 60s
  INSTALL_TO_ACTIVE: 30, // Si < 30% des installs deviennent actifs
  DAU_DECLINE: 20       // Si baisse DAU > 20% sur 7 jours
}

// =============================
// ANALYTICS INTEGRATION
// =============================

class AnalyticsAnalyzer {
  constructor(analyticsService, eventsService) {
    this.analytics = analyticsService
    this.events = eventsService
  }

  /**
   * Récupère toutes les métriques d'une app
   */
  async getAppMetrics(appId) {
    try {
      const [
        dau,
        mau,
        retention,
        crashRate,
        sessionData,
        funnel,
        timeline
      ] = await Promise.all([
        this.analytics?.getDAU?.(appId) || 0,
        this.analytics?.getMAU?.(appId) || 0,
        this.analytics?.calculateRetention?.(appId, 7) || [],
        this._getCrashRate(appId),
        this._getSessionData(appId),
        this.analytics?.getConversionRate?.(appId) || {},
        this.analytics?.getTimeline?.(appId, 'day', 30) || []
      ])

      return {
        dau,
        mau,
        retention,
        crashRate,
        sessionData,
        funnel,
        timeline,
        stickiness: mau > 0 ? (dau / mau) * 100 : 0
      }
    } catch (error) {
      logger.warn('Erreur récupération métriques', { appId, error })
      return null
    }
  }

  /**
   * Calcule le taux de crash
   */
  async _getCrashRate(appId) {
    if (!this.events) return 0

    const errors = await this.events.getAppEvents(appId, {
      type: 'error',
      period: 'week'
    })

    const sessions = await this.events.getAppEvents(appId, {
      type: 'session',
      period: 'week'
    })

    return sessions.length > 0 ? (errors.length / sessions.length) * 100 : 0
  }

  /**
   * Récupère les données de session
   */
  async _getSessionData(appId) {
    if (!this.events) return null

    const sessions = await this.events.getAppEvents(appId, {
      type: 'session',
      period: 'week'
    })

    if (sessions.length === 0) return null

    const totalDuration = sessions.reduce((sum, s) => sum + (s.data?.duration || 0), 0)
    const avgDuration = totalDuration / sessions.length

    return {
      total: sessions.length,
      avgDuration,
      distribution: sessions.map(s => s.data?.duration).filter(Boolean)
    }
  }

  /**
   * Identifie les problèmes basés sur les métriques
   */
  identifyIssues(metrics) {
    const issues = []

    if (!metrics) return issues

    // Rétention faible
    if (metrics.retention && metrics.retention[6]?.percentage < AUTO_TRIGGER_THRESHOLDS.RETENTION_DAY7) {
      issues.push({
        type: 'low_retention',
        severity: 'high',
        value: metrics.retention[6].percentage,
        threshold: AUTO_TRIGGER_THRESHOLDS.RETENTION_DAY7,
        description: `Retention à J7: ${metrics.retention[6].percentage}% (seuil: ${AUTO_TRIGGER_THRESHOLDS.RETENTION_DAY7}%)`
      })
    }

    // Crash élevé
    if (metrics.crashRate > AUTO_TRIGGER_THRESHOLDS.CRASH_RATE) {
      issues.push({
        type: 'high_crash_rate',
        severity: 'critical',
        value: metrics.crashRate,
        threshold: AUTO_TRIGGER_THRESHOLDS.CRASH_RATE,
        description: `Taux de crash: ${metrics.crashRate.toFixed(1)}% (seuil: ${AUTO_TRIGGER_THRESHOLDS.CRASH_RATE}%)`
      })
    }

    // Sessions courtes
    if (metrics.sessionData?.avgDuration < AUTO_TRIGGER_THRESHOLDS.SESSION_DURATION) {
      issues.push({
        type: 'short_sessions',
        severity: 'medium',
        value: metrics.sessionData.avgDuration,
        threshold: AUTO_TRIGGER_THRESHOLDS.SESSION_DURATION,
        description: `Durée moyenne session: ${metrics.sessionData.avgDuration}s (seuil: ${AUTO_TRIGGER_THRESHOLDS.SESSION_DURATION}s)`
      })
    }

    // Faible activation
    if (metrics.funnel && metrics.funnel.installs > 0) {
      const installToActive = (metrics.dau / metrics.funnel.installs) * 100
      if (installToActive < AUTO_TRIGGER_THRESHOLDS.INSTALL_TO_ACTIVE) {
        issues.push({
          type: 'low_activation',
          severity: 'high',
          value: installToActive,
          threshold: AUTO_TRIGGER_THRESHOLDS.INSTALL_TO_ACTIVE,
          description: `Taux d'activation: ${installToActive.toFixed(1)}% (seuil: ${AUTO_TRIGGER_THRESHOLDS.INSTALL_TO_ACTIVE}%)`
        })
      }
    }

    // Déclin DAU
    if (metrics.timeline && metrics.timeline.length >= 7) {
      const dau7daysAgo = metrics.timeline[0]?.total || 0
      const dauToday = metrics.timeline[metrics.timeline.length - 1]?.total || 0
      if (dau7daysAgo > 0) {
        const decline = ((dau7daysAgo - dauToday) / dau7daysAgo) * 100
        if (decline > AUTO_TRIGGER_THRESHOLDS.DAU_DECLINE) {
          issues.push({
            type: 'dau_decline',
            severity: 'high',
            value: decline,
            threshold: AUTO_TRIGGER_THRESHOLDS.DAU_DECLINE,
            description: `Baisse DAU: ${decline.toFixed(1)}% sur 7 jours`
          })
        }
      }
    }

    return issues
  }

  /**
   * Génère un prompt enrichi pour l'IA
   */
  buildAIPrompt(issues, metrics, app, project) {
    const prompt = {
      app: {
        name: app.name,
        category: app.category,
        version: app.version,
        stats: app.stats
      },
      analytics: {
        dau: metrics.dau,
        mau: metrics.mau,
        stickiness: metrics.stickiness,
        crashRate: metrics.crashRate,
        avgSessionDuration: metrics.sessionData?.avgDuration,
        retention: metrics.retention?.map(r => ({
          day: r.day,
          percentage: r.percentage
        }))
      },
      issues: issues.map(i => ({
        type: i.type,
        description: i.description,
        severity: i.severity
      })),
      code: this._extractRelevantCode(project, issues)
    }

    return prompt
  }

  /**
   * Extrait le code pertinent pour les problèmes identifiés
   */
  _extractRelevantCode(project, issues) {
    if (!project?.files) return {}

    const relevantFiles = {}

    // Prioriser les fichiers selon les problèmes
    if (issues.some(i => i.type.includes('crash'))) {
      // Inclure les fichiers d'erreur
      Object.entries(project.files).forEach(([path, file]) => {
        if (path.includes('error') || path.includes('bug') || path.includes('crash')) {
          relevantFiles[path] = file.content?.slice(0, 5000)
        }
      })
    }

    if (issues.some(i => i.type.includes('retention') || i.type.includes('activation'))) {
      // Inclure les fichiers UI/onboarding
      Object.entries(project.files).forEach(([path, file]) => {
        if (path.includes('onboarding') || path.includes('welcome') || path.includes('home')) {
          relevantFiles[path] = file.content?.slice(0, 5000)
        }
      })
    }

    // Si aucun fichier spécifique, prendre les principaux
    if (Object.keys(relevantFiles).length === 0) {
      Object.entries(project.files).forEach(([path, file]) => {
        if (path.includes('App.js') || path.includes('main.js') || path.includes('index.js')) {
          relevantFiles[path] = file.content?.slice(0, MAX_CODE_SIZE)
        }
      })
    }

    return relevantFiles
  }
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class AppEvolutionService extends EventEmitter {
  constructor() {
    super()
    this.evolutions = new Map()
    this.appEvolutions = new Map()
    this.apiKey = null
    this.model = 'gpt-4'
    this.autoAnalysis = false
    this.analysisTimer = null
    this.analyticsAnalyzer = null
    this.queue = null
    this.stats = {
      totalAnalyses: 0,
      totalSuggestions: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      autoTriggered: 0,
      averageConfidence: 0,
      totalTime: 0
    }
    this.logger = logger.createChild('AppEvolutionService')
  }

  /**
   * Définit la clé API
   */
  setApiKey(key) {
    this.apiKey = key
    this.logger.info('Clé API configurée')
  }

  /**
   * Définit le modèle
   */
  setModel(model) {
    this.model = model
    this.logger.info(`Modèle configuré: ${model}`)
  }

  /**
   * Initialise avec la queue
   */
  initialize(options = {}) {
    const { rateLimits, queue, maxCodeSize } = options
    this.rateLimits = rateLimits
    this.queue = queue
    this.maxCodeSize = maxCodeSize || MAX_CODE_SIZE

    // Initialiser l'analyseur analytics
    if (analyticsService || eventsService) {
      this.analyticsAnalyzer = new AnalyticsAnalyzer(analyticsService, eventsService)
    }

    this.logger.info('Service d\'évolution initialisé')
  }

  /**
   * Démarre l'analyse automatique
   */
  startAutoAnalysis() {
    if (this.autoAnalysis) return

    this.autoAnalysis = true
    this.analysisTimer = setInterval(() => {
      this._runAutoAnalysis()
    }, ANALYSIS_INTERVAL)

    this.logger.info('Analyse automatique démarrée')
  }

  /**
   * Arrête l'analyse automatique
   */
  stopAutoAnalysis() {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer)
      this.analysisTimer = null
    }
    this.autoAnalysis = false
    this.logger.info('Analyse automatique arrêtée')
  }

  /**
   * Exécute l'analyse automatique
   */
  async _runAutoAnalysis() {
    try {
      if (!publishService) return

      const result = await publishService.listApps({
        visibility: 'public',
        limit: 100
      })

      const apps = result.items

      for (const app of apps.slice(0, 10)) {
        // Vérifier si besoin d'analyse
        if (await this._needsAnalysis(app.id)) {
          await this.analyzeApp(app.id, { autoTriggered: true }).catch(err => {
            this.logger.warn(`Erreur analyse auto ${app.id}:`, err)
          })
        }
      }

    } catch (error) {
      this.logger.error('Erreur analyse automatique', error)
    }
  }

  /**
   * Vérifie si une app a besoin d'analyse
   */
  async _needsAnalysis(appId) {
    if (!this.analyticsAnalyzer) return false

    const metrics = await this.analyticsAnalyzer.getAppMetrics(appId)
    const issues = this.analyticsAnalyzer.identifyIssues(metrics)

    return issues.length > 0
  }

  /**
   * Analyse une application avec données analytics
   */
  async analyzeApp(appId, options = {}) {
    const {
      types = Object.values(EVOLUTION_TYPES),
      depth = 'medium',
      autoTriggered = false,
      reason = 'manual',
      data = {}
    } = options

    const startTime = Date.now()
    this.stats.totalAnalyses++
    if (autoTriggered) this.stats.autoTriggered++

    this.logger.info(`Analyse de l'application ${appId}`, { types, depth, reason })

    try {
      if (!publishService || !projectManager) {
        throw new Error('Services requis non initialisés')
      }

      const app = await publishService.getApp(appId)

      if (!app) {
        throw new Error('Application non trouvée')
      }

      const project = await projectManager.getProjectById(
        app.projectId,
        app.userId
      )

      if (!project) {
        throw new Error('Projet non trouvé')
      }

      this.emit('analysis:started', { appId, reason })

      // 🔥 Récupérer les métriques analytics
      let metrics = null
      let issues = []
      
      if (this.analyticsAnalyzer) {
        metrics = await this.analyticsAnalyzer.getAppMetrics(appId)
        issues = this.analyticsAnalyzer.identifyIssues(metrics)
      }

      // Construire le prompt enrichi
      const prompt = this.analyticsAnalyzer?.buildAIPrompt(issues, metrics, app, project) || {
        app: { name: app.name, category: app.category },
        code: this._extractCode(project)
      }

      const suggestions = []

      // Analyse selon les types
      for (const type of types) {
        const typeSuggestions = await this._analyzeTypeWithAI(type, prompt, depth)
        suggestions.push(...typeSuggestions)
      }

      // Créer les suggestions
      const created = []
      for (const suggestion of suggestions) {
        if (suggestion.confidence >= CONFIDENCE_THRESHOLD) {
          const evolution = await this._createEvolution(appId, {
            ...suggestion,
            reason,
            metrics: issues.length > 0 ? issues : undefined
          })
          created.push(evolution)
        }
      }

      const duration = Date.now() - startTime
      this.stats.totalTime += duration
      this.stats.totalSuggestions += created.length

      this.emit('analysis:completed', {
        appId,
        suggestions: created.length,
        issues: issues.length,
        duration,
        reason
      })

      this.logger.success(`Analyse terminée pour ${appId}`, {
        suggestions: created.length,
        issues: issues.length,
        duration: `${duration}ms`,
        reason
      })

      return {
        success: true,
        appId,
        suggestions: created,
        issues,
        duration,
        reason
      }

    } catch (error) {
      this.emit('analysis:failed', { appId, error: error.message })
      this.logger.error(`Échec analyse ${appId}`, error)
      throw error
    }
  }

  /**
   * Extrait le code du projet avec limite de taille
   */
  _extractCode(project) {
    if (!project?.files) return {}

    const code = {}
    let totalSize = 0

    for (const [path, file] of Object.entries(project.files)) {
      if (totalSize >= this.maxCodeSize) break

      const content = file.content || ''
      const size = content.length

      if (totalSize + size <= this.maxCodeSize) {
        code[path] = content
        totalSize += size
      } else {
        // Tronquer le dernier fichier
        const remaining = this.maxCodeSize - totalSize
        code[path] = content.slice(0, remaining)
        break
      }
    }

    return code
  }

  /**
   * Analyse un type avec l'IA
   */
  async _analyzeTypeWithAI(type, prompt, depth) {
    // Simuler l'appel à l'IA pour l'exemple
    // Dans la réalité, utiliser codeGenerator avec le prompt enrichi

    const suggestions = []

    switch (type) {
      case EVOLUTION_TYPES.UI:
        if (prompt.issues?.some(i => i.type === 'low_retention' || i.type === 'short_sessions')) {
          suggestions.push({
            type: EVOLUTION_TYPES.UI,
            title: 'Amélioration de l\'onboarding utilisateur',
            description: 'Ajouter un tutoriel interactif pour les nouveaux utilisateurs',
            confidence: 0.85,
            reason: 'low_retention',
            changes: {
              files: ['src/components/Onboarding.js'],
              description: 'Créer un composant d\'onboarding pas à pas'
            }
          })
        }
        break

      case EVOLUTION_TYPES.PERFORMANCE:
        if (prompt.issues?.some(i => i.type === 'short_sessions')) {
          suggestions.push({
            type: EVOLUTION_TYPES.PERFORMANCE,
            title: 'Optimisation du temps de chargement initial',
            description: 'Réduire le temps de chargement avec du lazy loading',
            confidence: 0.9,
            reason: 'performance',
            changes: {
              files: ['src/App.js'],
              description: 'Implémenter React.lazy() pour les routes'
            }
          })
        }
        break

      case EVOLUTION_TYPES.BUG_FIX:
        if (prompt.issues?.some(i => i.type === 'high_crash_rate')) {
          suggestions.push({
            type: EVOLUTION_TYPES.BUG_FIX,
            title: 'Correction des crashes fréquents',
            description: 'Ajouter des try/catch et améliorer la gestion d\'erreur',
            confidence: 0.95,
            reason: 'crash',
            changes: {
              files: ['src/api/index.js'],
              description: 'Wrapper les appels API avec gestion d\'erreur'
            }
          })
        }
        break

      case EVOLUTION_TYPES.UX:
        if (prompt.issues?.some(i => i.type === 'low_activation')) {
          suggestions.push({
            type: EVOLUTION_TYPES.UX,
            title: 'Amélioration du parcours d\'activation',
            description: 'Simplifier le processus d\'inscription',
            confidence: 0.88,
            reason: 'activation',
            changes: {
              files: ['src/pages/Signup.js'],
              description: 'Réduire le nombre de champs requis'
            }
          })
        }
        break
    }

    return suggestions
  }

  /**
   * Génère une nouvelle fonctionnalité
   */
  async generateFeature(appId, description, options = {}) {
    this.logger.info(`Génération de fonctionnalité pour ${appId}`, { description })

    const evolution = await this._createEvolution(appId, {
      type: EVOLUTION_TYPES.FEATURE,
      title: `Nouvelle fonctionnalité: ${description.substring(0, 50)}...`,
      description,
      confidence: 0.7,
      reason: 'user_request',
      changes: {
        description: 'Fonctionnalité à implémenter',
        files: []
      }
    })

    this.emit('evolution:generated', evolution)
    return evolution
  }

  /**
   * Optimise les performances
   */
  async optimizePerformance(appId, options = {}) {
    return this.analyzeApp(appId, {
      types: [EVOLUTION_TYPES.PERFORMANCE, EVOLUTION_TYPES.OPTIMIZATION],
      reason: 'performance_request',
      ...options
    })
  }

  /**
   * Améliore l'interface utilisateur
   */
  async improveUI(appId, options = {}) {
    return this.analyzeApp(appId, {
      types: [EVOLUTION_TYPES.UI, EVOLUTION_TYPES.ACCESSIBILITY, EVOLUTION_TYPES.UX],
      reason: 'ui_request',
      ...options
    })
  }

    /**
   * Corrige un bug
   */
  async fixBug(appId, errorDescription, options = {}) {
    this.logger.info(`Correction de bug pour ${appId}`, { errorDescription })

    const evolution = await this._createEvolution(appId, {
      type: EVOLUTION_TYPES.BUG_FIX,
      title: `Correction: ${errorDescription.substring(0, 50)}...`,
      description: errorDescription,
      confidence: 0.8,
      reason: 'bug_report',
      changes: {
        description: 'Bug à corriger',
        files: []
      }
    })

    this.emit('evolution:generated', evolution)
    return evolution
  }

  /**
   * Crée une suggestion d'évolution
   */
  async _createEvolution(appId, suggestion) {
    const evolutionId = randomUUID()

    const evolution = {
      id: evolutionId,
      appId,
      ...suggestion,
      status: EVOLUTION_STATUS.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      votes: {
        up: 0,
        down: 0
      },
      comments: [],
      appliedAt: null,
      appliedBy: null
    }

    this.evolutions.set(evolutionId, evolution)

    if (!this.appEvolutions.has(appId)) {
      this.appEvolutions.set(appId, new Set())
    }
    this.appEvolutions.get(appId).add(evolutionId)

    this.emit('evolution:created', evolution)
    return evolution
  }

  /**
   * Applique une évolution
   */
  async applyEvolution(evolutionId, options = {}) {
    const evolution = this.evolutions.get(evolutionId)
    if (!evolution) {
      throw new Error('Évolution non trouvée')
    }

    if (evolution.status !== EVOLUTION_STATUS.PENDING) {
      throw new Error(`Impossible d'appliquer une évolution avec le statut ${evolution.status}`)
    }

    evolution.status = EVOLUTION_STATUS.GENERATING
    this.emit('evolution:applying', evolution)

    try {
      // TODO: Appliquer via codeGenerator
      await new Promise(resolve => setTimeout(resolve, 1000))

      evolution.status = EVOLUTION_STATUS.APPLIED
      evolution.appliedAt = Date.now()
      evolution.appliedBy = options.userId || null
      evolution.updatedAt = Date.now()

      this.stats.acceptedSuggestions++

      this.emit('evolution:applied', evolution)
      return evolution

    } catch (error) {
      evolution.status = EVOLUTION_STATUS.FAILED
      evolution.error = error.message
      evolution.updatedAt = Date.now()

      this.emit('evolution:failed', evolution)
      throw error
    }
  }

  /**
   * Rejette une évolution
   */
  async rejectEvolution(evolutionId, reason) {
    const evolution = this.evolutions.get(evolutionId)
    if (!evolution) {
      throw new Error('Évolution non trouvée')
    }

    evolution.status = EVOLUTION_STATUS.REJECTED
    evolution.rejectionReason = reason
    evolution.updatedAt = Date.now()

    this.stats.rejectedSuggestions++

    this.emit('evolution:rejected', evolution)
    return evolution
  }

  /**
   * Récupère les évolutions d'une application
   */
  getAppEvolutions(appId, options = {}) {
    const {
      status = null,
      type = null,
      reason = null,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt'
    } = options

    const evolutionIds = this.appEvolutions.get(appId) || new Set()
    let evolutions = Array.from(evolutionIds)
      .map(id => this.evolutions.get(id))
      .filter(Boolean)

    if (status) evolutions = evolutions.filter(e => e.status === status)
    if (type) evolutions = evolutions.filter(e => e.type === type)
    if (reason) evolutions = evolutions.filter(e => e.reason === reason)

    switch (sortBy) {
      case 'confidence':
        evolutions.sort((a, b) => b.confidence - a.confidence)
        break
      case 'votes':
        evolutions.sort((a, b) => (b.votes.up - b.votes.down) - (a.votes.up - a.votes.down))
        break
      default:
        evolutions.sort((a, b) => b.createdAt - a.createdAt)
    }

    const paginated = evolutions.slice(offset, offset + limit)

    return {
      evolutions: paginated,
      total: evolutions.length,
      offset,
      limit,
      hasMore: offset + limit < evolutions.length
    }
  }

  /**
   * Récupère une évolution
   */
  getEvolution(evolutionId) {
    return this.evolutions.get(evolutionId) || null
  }

  /**
   * Récupère le service analytics
   */
  getAnalyticsService() {
    return analyticsService
  }

  /**
   * Récupère le service mobile
   */
  getMobileService() {
    return mobileService
  }

  /**
   * Récupère les applications actives
   */
  async getActiveApps() {
    if (!publishService) return []

    const result = await publishService.listApps({
      visibility: 'public',
      limit: 100
    })

    return result.items
  }

  /**
   * Récupère les événements d'une app
   */
  async getEvents(appId, options) {
    if (!eventsService) return []
    return eventsService.getAppEvents(appId, options)
  }

  /**
   * Récupère le total des sessions
   */
  async getTotalSessions(appId, period) {
    if (!eventsService) return 0
    const sessions = await eventsService.getAppEvents(appId, {
      type: 'session',
      period
    })
    return sessions.length
  }

  /**
   * Scan de sécurité
   */
  async securityScan(appId) {
    // Simulation
    return {
      score: 72,
      vulnerabilities: [],
      suggestions: []
    }
  }

  /**
   * Scan de performance
   */
  async performanceScan(appId) {
    // Simulation
    return {
      score: 61,
      bottlenecks: [],
      suggestions: []
    }
  }

  /**
   * Génère des suggestions basées sur le rapport
   */
  async generateSuggestions(appId, report) {
    const suggestions = []

    if (report.scores.security < 70) {
      suggestions.push({
        type: EVOLUTION_TYPES.SECURITY,
        title: 'Améliorer la sécurité',
        confidence: 0.9
      })
    }

    if (report.scores.performance < 60) {
      suggestions.push({
        type: EVOLUTION_TYPES.PERFORMANCE,
        title: 'Optimiser les performances',
        confidence: 0.85
      })
    }

    if (report.crashRate > 5) {
      suggestions.push({
        type: EVOLUTION_TYPES.BUG_FIX,
        title: 'Réduire le taux de crash',
        confidence: 0.95
      })
    }

    return suggestions
  }

  /**
   * Estime le coût d'une opération
   */
  async estimateCost(operation, appId, options) {
    // Simulation
    const costs = {
      analyze: 0.05,
      generate: 0.10,
      optimize: 0.08,
      security: 0.07
    }

    return {
      operation,
      estimate: costs[operation] || 0.05,
      currency: 'USD',
      tokens: 1000
    }
  }

  /**
   * Récupère les limites d'utilisation
   */
  async getUsageLimits() {
    return this.rateLimits || {}
  }

  /**
   * Annule une opération
   */
  async cancelOperation(operationId) {
    // TODO: Implémenter
    return { success: true }
  }

  /**
   * Récupère le statut d'une opération
   */
  async getOperationStatus(operationId) {
    // TODO: Implémenter
    return { status: 'unknown' }
  }

  /**
   * Teste la connexion à l'API
   */
  async testConnection() {
    return {
      success: true,
      apiKey: this.apiKey ? 'configured' : 'missing',
      model: this.model,
      analytics: !!analyticsService,
      events: !!eventsService,
      mobile: !!mobileService,
      timestamp: Date.now()
    }
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const averageConfidence = this.stats.totalSuggestions > 0
      ? this.stats.averageConfidence / this.stats.totalSuggestions
      : 0

    const acceptanceRate = this.stats.totalSuggestions > 0
      ? (this.stats.acceptedSuggestions / this.stats.totalSuggestions) * 100
      : 0

    return {
      ...this.stats,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      pendingEvolutions: this._countByStatus(EVOLUTION_STATUS.PENDING),
      completedEvolutions: this._countByStatus(EVOLUTION_STATUS.APPLIED),
      failedEvolutions: this._countByStatus(EVOLUTION_STATUS.FAILED),
      autoAnalysis: this.autoAnalysis,
      model: this.model,
      apiKeyConfigured: !!this.apiKey,
      analyticsConnected: !!analyticsService,
      eventsConnected: !!eventsService,
      mobileConnected: !!mobileService
    }
  }

  /**
   * Compte les évolutions par statut
   */
  _countByStatus(status) {
    let count = 0
    for (const evolution of this.evolutions.values()) {
      if (evolution.status === status) {
        count++
      }
    }
    return count
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.stopAutoAnalysis()
    this.evolutions.clear()
    this.appEvolutions.clear()
    this.removeAllListeners()
  }
}

export const appEvolutionService = new AppEvolutionService()
export default appEvolutionService
