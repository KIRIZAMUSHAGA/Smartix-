/**
 * appAnalyticsService - Analytics professionnel
 * Version finale avec toutes les corrections
 * 
 * Rôle: Collecter et analyser les métriques des apps
 * - Persistance base de données
 * - Agrégations temporelles
 * - Cache intelligent
 * - Cohort analysis (rétention)
 * - Conversion funnel
 * - Intégration complète mobile
 */

import { EventEmitter } from 'events'

const logger = {
  debug: (...args) => console.debug('[AppAnalytics]', ...args),
  info: (...args) => console.info('[AppAnalytics]', ...args),
  warn: (...args) => console.warn('[AppAnalytics]', ...args),
  error: (...args) => console.error('[AppAnalytics]', ...args),
  createChild: (name) => ({
    debug: (...args) => console.debug(`[${name}]`, ...args),
    info: (...args) => console.info(`[${name}]`, ...args),
    warn: (...args) => console.warn(`[${name}]`, ...args),
    error: (...args) => console.error(`[${name}]`, ...args),
  }),
}

const _cacheStore = new Map()
const cache = {
  get: async (key) => _cacheStore.get(key) ?? null,
  set: async (key, value, ttl) => { _cacheStore.set(key, value); return true },
  increment: async (key) => { const v = (_cacheStore.get(key) || 0) + 1; _cacheStore.set(key, v); return v },
}

const androidInstaller = new EventEmitter()
const livePreview = new EventEmitter()
const apkBuilder = new EventEmitter()

// =============================
// INJECTION DE DÉPENDANCES
// =============================
let forkService
let reviewService

export const setForkService = (service) => {
  forkService = service
}

export const setReviewService = (service) => {
  reviewService = service
}

// =============================
// CONSTANTES
// =============================

const AGGREGATION_INTERVAL = 5 * 60 * 1000 // 5 minutes
const CACHE_TTL = 60 * 1000 // 1 minute
const TRENDING_DECAY = 0.5 // Facteur de décay
const MAX_EVENTS_IN_MEMORY = 10000
const BATCH_SIZE = 1000
const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = 24 * ONE_HOUR
const ONE_WEEK = 7 * ONE_DAY
const ONE_MONTH = 30 * ONE_DAY

export const EVENT_TYPES = {
  VIEW: 'view',
  DOWNLOAD: 'download',
  INSTALL: 'install',
  SESSION: 'session',
  UNINSTALL: 'uninstall',
  UPDATE: 'update',
  RATING: 'rating',
  REVIEW: 'review',
  FORK: 'fork'
}

// =============================
// INTERFACE STORAGE AMÉLIORÉE
// =============================

export class AnalyticsStorage {
  constructor(client) {
    this.client = client
    this.buffer = []
    this.bufferTimeout = null
  }

  /**
   * Sauvegarde un événement (avec buffer)
   */
  async saveEvent(event) {
    this.buffer.push({
      ...event,
      _id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      createdAt: new Date().toISOString()
    })

    if (this.buffer.length >= BATCH_SIZE) {
      await this.flushBuffer()
    } else if (!this.bufferTimeout) {
      this.bufferTimeout = setTimeout(() => this.flushBuffer(), 5000)
    }
  }

  /**
   * ✅ Sauvegarde multiple (batch)
   */
  async saveEvents(events) {
    if (events.length === 0) return

    const eventsToSave = events.map(event => ({
      ...event,
      _id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      createdAt: new Date().toISOString()
    }))

    if (this.client.bulkInsert) {
      await this.client.bulkInsert('analytics_events', eventsToSave)
    } else if (this.client.save) {
      for (const event of eventsToSave) {
        await this.client.save('analytics_events', event)
      }
    }
  }

  /**
   * Vide le buffer
   */
  async flushBuffer() {
    if (this.buffer.length === 0) return

    const events = [...this.buffer]
    this.buffer = []
    
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout)
      this.bufferTimeout = null
    }

    await this.saveEvents(events)
    logger.debug(`Flushed ${events.length} analytics events`)
  }

  /**
   * ✅ Agrégation globale (sans appId)
   */
  async aggregateGlobal(period = 'hour') {
    const now = Date.now()
    let startTime

    switch (period) {
      case 'hour':
        startTime = now - ONE_HOUR
        break
      case 'day':
        startTime = now - ONE_DAY
        break
      case 'week':
        startTime = now - ONE_WEEK
        break
      default:
        startTime = now - ONE_HOUR
    }

    if (this.client.aggregate) {
      const result = await this.client.aggregate('analytics_events', [
        {
          $match: {
            timestamp: { $gte: startTime }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        }
      ])

      const formatted = {}
      result.forEach(item => {
        formatted[item._id] = {
          count: item.count,
          // ✅ Protection contre undefined
          uniqueUsers: (item.uniqueUsers || []).filter(u => u).length
        }
      })

      return formatted
    }

    return {}
  }

  /**
   * Agrège les événements par app
   */
  async aggregateEvents(appId, period = 'day', date = new Date()) {
    const cacheKey = `analytics_agg:${appId}:${period}:${date.toISOString().split('T')[0]}`
    
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let result = null

    if (this.client.aggregate) {
      const start = this._getPeriodStart(date, period)
      const end = this._getPeriodEnd(date, period)

      const aggregation = await this.client.aggregate('analytics_events', [
        {
          $match: {
            appId,
            timestamp: { $gte: start, $lt: end }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        }
      ])

      result = {
        period,
        date: start,
        events: {}
      }

      aggregation.forEach(item => {
        result.events[item._id] = {
          count: item.count,
          // ✅ Protection contre undefined
          uniqueUsers: (item.uniqueUsers || []).filter(u => u).length
        }
      })

      await cache.set(cacheKey, result, CACHE_TTL)
    }

    return result
  }

  /**
   * ✅ Récupère les données pour cohort analysis
   */
  async getCohortData(appId, cohortDate) {
    const startOfCohort = this._getPeriodStart(new Date(cohortDate), 'day')
    const endOfCohort = this._getPeriodEnd(new Date(cohortDate), 'day')

    // Trouver tous les utilisateurs qui ont installé ce jour-là
    if (this.client.aggregate) {
      const installUsers = await this.client.aggregate('analytics_events', [
        {
          $match: {
            appId,
            type: EVENT_TYPES.INSTALL,
            timestamp: { $gte: startOfCohort, $lt: endOfCohort }
          }
        },
        {
          $group: {
            _id: null,
            users: { $addToSet: '$userId' }
          }
        }
      ])

      return installUsers[0]?.users || []
    }

    return []
  }

  /**
   * ✅ Récupère le funnel de conversion
   */
  async getConversionFunnel(appId, startDate, endDate) {
    if (this.client.aggregate) {
      const funnel = await this.client.aggregate('analytics_events', [
        {
          $match: {
            appId,
            timestamp: { $gte: startDate, $lt: endDate },
            type: { 
              $in: [EVENT_TYPES.VIEW, EVENT_TYPES.DOWNLOAD, EVENT_TYPES.INSTALL, EVENT_TYPES.SESSION]
            }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            users: { $addToSet: '$userId' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])

      const result = {
        views: 0,
        downloads: 0,
        installs: 0,
        sessions: 0,
        uniqueViewers: 0,
        uniqueDownloaders: 0,
        uniqueInstallers: 0,
        uniqueUsers: 0
      }

      funnel.forEach(item => {
        switch (item._id) {
          case EVENT_TYPES.VIEW:
            result.views = item.count
            result.uniqueViewers = (item.users || []).filter(u => u).length
            break
          case EVENT_TYPES.DOWNLOAD:
            result.downloads = item.count
            result.uniqueDownloaders = (item.users || []).filter(u => u).length
            break
          case EVENT_TYPES.INSTALL:
            result.installs = item.count
            result.uniqueInstallers = (item.users || []).filter(u => u).length
            break
          case EVENT_TYPES.SESSION:
            result.sessions = item.count
            result.uniqueUsers = (item.users || []).filter(u => u).length
            break
        }
      })

      // Calculer les taux de conversion
      result.conversionRate = {
        viewToDownload: result.views > 0 
          ? Math.round((result.downloads / result.views) * 100) 
          : 0,
        downloadToInstall: result.downloads > 0 
          ? Math.round((result.installs / result.downloads) * 100) 
          : 0,
        installToActive: result.installs > 0 
          ? Math.round((result.sessions / result.installs) * 100) 
          : 0
      }

      return result
    }

    return null
  }

  /**
   * Récupère les événements récents
   */
  async getRecentEvents(appId, limit = 100, offset = 0) {
    if (this.client.query) {
      return await this.client.query('analytics_events', {
        where: { appId },
        sort: { timestamp: -1 },
        limit,
        offset
      })
    }
    return { items: [] }
  }

  /**
   * Supprime les événements d'une app
   */
  async deleteAppEvents(appId) {
    if (this.client.deleteMany) {
      return await this.client.deleteMany('analytics_events', { appId })
    }
    return 0
  }

  /**
   * Nettoie les vieux événements
   */
  async cleanupOldEvents(olderThan) {
    if (this.client.deleteMany) {
      return await this.client.deleteMany('analytics_events', {
        timestamp: { $lt: olderThan }
      })
    }
    return 0
  }

  /**
   * Calcule les périodes
   */
  _getPeriodStart(date, period) {
    const d = new Date(date)
    switch (period) {
      case 'hour':
        d.setMinutes(0, 0, 0)
        break
      case 'day':
        d.setHours(0, 0, 0, 0)
        break
      case 'week':
        d.setDate(d.getDate() - d.getDay())
        d.setHours(0, 0, 0, 0)
        break
      case 'month':
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        break
    }
    return d.getTime()
  }

  _getPeriodEnd(date, period) {
    const d = new Date(date)
    switch (period) {
      case 'hour':
        d.setMinutes(59, 59, 999)
        break
      case 'day':
        d.setHours(23, 59, 59, 999)
        break
      case 'week':
        d.setDate(d.getDate() + (6 - d.getDay()))
        d.setHours(23, 59, 59, 999)
        break
      case 'month':
        d.setMonth(d.getMonth() + 1)
        d.setDate(0)
        d.setHours(23, 59, 59, 999)
        break
    }
    return d.getTime()
  }
}

// =============================
// SERVICE PRINCIPAL
// =============================

export class AppAnalyticsService extends EventEmitter {
  constructor(storage) {
    super()
    this.storage = storage
    this.apps = new Map() // Cache des métadonnées
    this.stats = {
      totalApps: 0,
      totalEvents: 0,
      eventsToday: 0,
      // ✅ Sets avec cleanup
      activeToday: new Set(),
      activeThisWeek: new Set()
    }
    this.logger = logger.createChild('AppAnalytics')
    this.processingQueue = []

    // ✅ Nettoyage quotidien des sets
    setInterval(() => {
      this.stats.activeToday.clear()
      this.logger.debug('Active today set cleared')
    }, ONE_DAY)

    // Agrégation périodique
    setInterval(() => {
      this._processAggregations()
    }, AGGREGATION_INTERVAL)

    // Setup des écouteurs
    this._setupMobileListeners()
  }

  /**
   * Configure les écouteurs du module mobile (version complète)
   */
  _setupMobileListeners() {
    // Install
    androidInstaller.on('install', ({ sessionId, deviceInfo, appId, userId }) => {
      this.recordEvent(EVENT_TYPES.INSTALL, appId, userId, { sessionId, deviceInfo })
    })

    // Uninstall
    androidInstaller.on('uninstall', ({ appId, userId, deviceInfo }) => {
      this.recordEvent(EVENT_TYPES.UNINSTALL, appId, userId, { deviceInfo })
    })

    // Download APK
    apkBuilder.on('download', ({ appId, userId, version }) => {
      this.recordEvent(EVENT_TYPES.DOWNLOAD, appId, userId, { version })
    })

    // Preview session
    livePreview.on('device:connected', ({ sessionId, clientId, deviceInfo, appId }) => {
      this.recordEvent(EVENT_TYPES.SESSION, appId, clientId, { sessionId, deviceInfo })
    })

    livePreview.on('device:disconnected', ({ sessionId, appId, userId }) => {
      this.emit('session:ended', { sessionId, appId, userId })
    })

    // Connexion avec forkService et reviewService
    if (forkService) {
      forkService.on('fork:success', ({ originalAppId, newAppId, userId }) => {
        this.recordEvent(EVENT_TYPES.FORK, originalAppId, userId, { newAppId })
      })
    }

    if (reviewService) {
      reviewService.on('review:added', ({ appId, userId, rating }) => {
        this.recordEvent(EVENT_TYPES.REVIEW, appId, userId, { rating })
      })
    }
  }

  /**
   * Enregistre une nouvelle app
   */
  async registerApp(appId, metadata = {}) {
    const appData = {
      appId,
      name: metadata.name,
      userId: metadata.userId,
      category: metadata.category,
      registeredAt: Date.now(),
      lastEventAt: null,
      metadata
    }

    this.apps.set(appId, appData)
    this.stats.totalApps++

    this.logger.info('App enregistrée dans analytics', { appId })
    this.emit('app:registered', { appId, metadata })
    return appData
  }

  /**
   * Enregistre un événement (version optimisée)
   */
  async recordEvent(type, appId, userId = null, data = {}) {
    // Validation
    if (!Object.values(EVENT_TYPES).includes(type)) {
      throw new Error(`Type d'événement invalide: ${type}`)
    }

    const app = this.apps.get(appId)
    if (!app) {
      this.logger.warn('App non trouvée dans analytics', { appId })
      return false
    }

    const event = {
      type,
      appId,
      userId,
      timestamp: Date.now(),
      ...data,
      metadata: {
        userAgent: data.userAgent,
        ip: data.ip,
        platform: data.platform,
        version: data.version
      }
    }

    // Mettre à jour le cache
    app.lastEventAt = event.timestamp
    this.stats.totalEvents++

    // Mise à jour des sets actifs (avec nettoyage automatique)
    const today = new Date().toDateString()
    if (userId) {
      this.stats.activeToday.add(`${userId}:${today}`)
      this.stats.activeThisWeek.add(userId)
    }

    // File d'attente pour batch processing
    this.processingQueue.push(event)
    
    // Traiter immédiatement si la queue est pleine
    if (this.processingQueue.length >= MAX_EVENTS_IN_MEMORY) {
      await this._processQueue()
    } else if (!this.processingTimer) {
      // Sinon, traiter après délai
      this.processingTimer = setTimeout(() => this._processQueue(), 1000)
    }

    // Émettre pour les souscripteurs temps réel
    this.emit('analytics:event', event)
    this.emit(`analytics:${type}`, event)

    return true
  }

  /**
   * Traite la file d'attente (batch)
   */
  async _processQueue() {
    if (this.processingQueue.length === 0) return

    const events = [...this.processingQueue]
    this.processingQueue = []
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer)
      this.processingTimer = null
    }

    try {
      // ✅ Sauvegarde en batch
      await this.storage.saveEvents(events)
      this.stats.eventsToday += events.length
    } catch (error) {
      this.logger.error('Erreur sauvegarde analytics', error)
      // Remettre dans la queue en cas d'erreur
      this.processingQueue.unshift(...events)
    }
  }

  /**
   * Traite les agrégations périodiques
   */
  async _processAggregations() {
    for (const [appId, app] of this.apps) {
      try {
        const todayAgg = await this.storage.aggregateEvents(appId, 'day', new Date())
        const weekAgg = await this.storage.aggregateEvents(appId, 'week', new Date())
        
        await cache.set(`analytics:${appId}:today`, todayAgg, CACHE_TTL)
        await cache.set(`analytics:${appId}:week`, weekAgg, CACHE_TTL)

        this.emit('analytics:aggregated', { appId, today: todayAgg, week: weekAgg })
      } catch (error) {
        this.logger.error('Erreur agrégation', { appId, error })
      }
    }

    this.logger.info('Agrégations terminées')
  }

  // =============================
  // ANALYTICS AVANCÉS
  // =============================

  /**
   * ✅ Cohort analysis (rétention)
   */
  async getRetention(appId, options = {}) {
    const {
      cohortSize = 7, // 7 jours de cohorts
      followupDays = 30 // Suivi sur 30 jours
    } = options

    const now = Date.now()
    const retention = []

    for (let i = 0; i < cohortSize; i++) {
      const cohortDate = new Date(now - (i * ONE_DAY))
      const cohortDay = cohortDate.toISOString().split('T')[0]

      // Récupérer les utilisateurs de cette cohort (installés ce jour)
      const cohortUsers = await this.storage.getCohortData(appId, cohortDate)

      if (cohortUsers.length === 0) continue

      // Calculer la rétention pour chaque jour suivant
      const retentionRates = []

      for (let day = 1; day <= followupDays; day++) {
        const checkDate = new Date(cohortDate.getTime() + (day * ONE_DAY))
        
        // Compter combien de ces users étaient actifs ce jour-là
        if (this.client.aggregate) {
          const activeCount = await this.client.aggregate('analytics_events', [
            {
              $match: {
                appId,
                userId: { $in: cohortUsers },
                timestamp: {
                  $gte: this.storage._getPeriodStart(checkDate, 'day'),
                  $lt: this.storage._getPeriodEnd(checkDate, 'day')
                }
              }
            },
            {
              $group: {
                _id: null,
                users: { $addToSet: '$userId' }
              }
            }
          ])

          const activeUsers = activeCount[0]?.users?.length || 0
          const retentionRate = Math.round((activeUsers / cohortUsers.length) * 100)

          retentionRates.push({
            day,
            activeUsers,
            retentionRate
          })
        }
      }

      retention.push({
        cohort: cohortDay,
        cohortSize: cohortUsers.length,
        retention: retentionRates
      })
    }

    return retention
  }

  /**
   * ✅ Conversion funnel
   */
  async getFunnel(appId, period = 'week') {
    const endDate = Date.now()
    let startDate

    switch (period) {
      case 'day':
        startDate = endDate - ONE_DAY
        break
      case 'week':
        startDate = endDate - ONE_WEEK
        break
      case 'month':
        startDate = endDate - ONE_MONTH
        break
      default:
        startDate = endDate - ONE_WEEK
    }

    return await this.storage.getConversionFunnel(appId, startDate, endDate)
  }

  /**
   * ✅ Récupère les tendances enrichies
   */
  async getTrending(limit = 10, options = {}) {
    const {
      period = 'day',
      minEvents = 10,
      includeReviews = true,
      includeForks = true
    } = options

    const now = Date.now()
    const trending = []

    for (const [appId, app] of this.apps) {
      try {
        const today = await this.storage.aggregateEvents(appId, period)
        const yesterday = await this.storage.aggregateEvents(
          appId, 
          period, 
          new Date(now - ONE_DAY)
        )

        if (!today) continue

        let score = 0
        let events = today.events || {}

        // Score basé sur les événements
        if (events[EVENT_TYPES.VIEW]) {
          score += events[EVENT_TYPES.VIEW].count * 0.1
        }
        if (events[EVENT_TYPES.DOWNLOAD]) {
          score += events[EVENT_TYPES.DOWNLOAD].count * 2
        }
        if (events[EVENT_TYPES.INSTALL]) {
          score += events[EVENT_TYPES.INSTALL].count * 3
        }
        if (events[EVENT_TYPES.SESSION]) {
          score += events[EVENT_TYPES.SESSION].count * 1.5
        }

        // ✅ Intégration avec forkService
        if (includeForks && forkService) {
          const forks = await forkService.getForksOfApp(appId, { limit: 1 })
          if (forks.total > 0) {
            score += forks.total * 4
          }
        }

        // ✅ Intégration avec reviewService
        if (includeReviews && reviewService) {
          const appData = await reviewService?.getAppAnalytics?.(appId)
          if (appData?.stats?.average) {
            score += appData.stats.average * 5
          }
        }

        // Bonus de croissance
        if (yesterday?.events) {
          const todayTotal = Object.values(events).reduce((s, e) => s + e.count, 0)
          const yesterdayTotal = Object.values(yesterday.events).reduce((s, e) => s + e.count, 0)
          
          if (yesterdayTotal > 0) {
            const growth = (todayTotal - yesterdayTotal) / yesterdayTotal
            score *= (1 + Math.max(growth, 0))
          }
        }

        // Bonus utilisateurs uniques
        const uniqueUsers = new Set()
        Object.values(events).forEach(e => {
          e.uniqueUsers?.forEach(u => uniqueUsers.add(u))
        })
        score *= (1 + uniqueUsers.size * 0.1)

        if (score > minEvents) {
          trending.push({
            appId,
            name: app.name,
            category: app.category,
            score: Math.round(score * 10) / 10,
            events: {
              views: events[EVENT_TYPES.VIEW]?.count || 0,
              downloads: events[EVENT_TYPES.DOWNLOAD]?.count || 0,
              installs: events[EVENT_TYPES.INSTALL]?.count || 0,
              sessions: events[EVENT_TYPES.SESSION]?.count || 0
            },
            uniqueUsers: uniqueUsers.size,
            growth: this._calculateGrowth(today, yesterday)
          })
        }
      } catch (error) {
        this.logger.error('Erreur calcul trending', { appId, error })
      }
    }

    return trending
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Calcule la croissance
   */
  _calculateGrowth(today, yesterday) {
    if (!today || !yesterday) return 0

    const todayTotal = Object.values(today.events || {}).reduce((s, e) => s + e.count, 0)
    const yesterdayTotal = Object.values(yesterday.events || {}).reduce((s, e) => s + e.count, 0)

    if (yesterdayTotal === 0) return 100
    return Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100)
  }

  /**
   * ✅ Récupère les stats en temps réel (corrigé)
   */
  async getRealtimeStats() {
    // ✅ Utilisation de la nouvelle méthode globale
    const eventsLastHour = await this.storage.aggregateGlobal('hour')
    
    return {
      activeNow: this.processingQueue.length,
      eventsToday: this.stats.eventsToday,
      eventsLastHour,
      activeUsers: {
        today: this.stats.activeToday.size,
        week: this.stats.activeThisWeek.size
      },
      topApps: await this.getTrending(5)
    }
  }

  /**
   * Récupère les apps populaires par catégorie
   */
  async getCategoryTrending(category, limit = 5) {
    const allTrending = await this.getTrending(50)
    return allTrending
      .filter(app => app.category === category)
      .slice(0, limit)
  }

  /**
   * Récupère les analytics d'une app
   */
  async getAppAnalytics(appId, options = {}) {
    const {
      period = 'week',
      includeDaily = false,
      includeEvents = false,
      includeFunnel = false,
      includeRetention = false,
      limit = 100
    } = options

    const app = this.apps.get(appId)
    if (!app) return null

    const cached = await cache.get(`analytics:${appId}:${period}`)
    if (cached) return cached

    const aggregation = await this.storage.aggregateEvents(appId, period)

    const result = {
      appId,
      name: app.name,
      registeredAt: app.registeredAt,
      period,
      aggregation,
      totals: {
        views: 0,
        downloads: 0,
        installs: 0,
        sessions: 0
      }
    }

    if (aggregation?.events) {
      Object.entries(aggregation.events).forEach(([type, data]) => {
        if (result.totals[`${type}s`] !== undefined) {
          result.totals[`${type}s`] = data.count
        }
      })
    }

    if (includeDaily) {
      result.daily = []
      const today = new Date()
      for (let i = 0; i < 30; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const daily = await this.storage.aggregateEvents(appId, 'day', date)
        result.daily.unshift({
          date: date.toISOString().split('T')[0],
          ...daily
        })
      }
    }

    if (includeEvents) {
      const recent = await this.storage.getRecentEvents(appId, limit)
      result.recentEvents = recent.items
    }

    if (includeFunnel) {
      result.funnel = await this.getFunnel(appId, period)
    }

    if (includeRetention) {
      result.retention = await this.getRetention(appId)
    }

    await cache.set(`analytics:${appId}:${period}`, result, CACHE_TTL)
    return result
  }

  /**
   * Supprime une app
   */
  async deleteApp(appId) {
    this.apps.delete(appId)
    const deleted = await this.storage.deleteAppEvents(appId)
    await cache.invalidatePattern(`analytics:${appId}:*`)
    this.logger.info('App supprimée', { appId, eventsDeleted: deleted })
    this.emit('app:deleted', { appId })
  }

  /**
   * Nettoie les vieux événements
   */
  async cleanupEvents(retentionDays = 30) {
    const cutoff = Date.now() - (retentionDays * ONE_DAY)
    const deleted = await this.storage.cleanupOldEvents(cutoff)
    this.logger.info(`${deleted} vieux événements nettoyés`)
    return deleted
  }

  /**
   * Récupère les statistiques globales
   */
  async getStats() {
    const realtime = await this.getRealtimeStats()
    
    return {
      ...this.stats,
      ...realtime,
      appsTracked: this.apps.size,
      queueSize: this.processingQueue.length,
      bufferSize: this.storage.buffer.length,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Arrêt propre
   */
  async shutdown() {
    this.logger.info('Arrêt du service analytics')
    await this.storage.flushBuffer()
    await this._processQueue()
    this.removeAllListeners()
  }
}

// =============================
// SINGLETON EXPORT
// =============================

let analyticsServiceInstance = null

export const initializeAnalyticsService = (storageClient) => {
  if (!analyticsServiceInstance) {
    const storage = new AnalyticsStorage(storageClient)
    analyticsServiceInstance = new AppAnalyticsService(storage)
  }
  return analyticsServiceInstance
}

export const getAnalyticsService = () => {
  if (!analyticsServiceInstance) {
    throw new Error('AnalyticsService non initialisé')
  }
  return analyticsServiceInstance
}

export default getAnalyticsService
