/**
 * Module Analytics pour Vibe-Coding
 * Version INDUSTRIELLE avec pré-agrégation, streaming et temps réel
 * 
 * Rôle: Centraliser les analytics des applications
 * - Collecte avec batching
 * - Pré-agrégation quotidienne
 * - Export en streaming
 * - Métriques avancées (stickiness, funnel)
 * - Anonymisation RGPD
 * - Monitoring temps réel
 */

import { EventEmitter } from 'events'

const logger = {
  debug: (...args) => console.debug('[Analytics]', ...args),
  info: (...args) => console.info('[Analytics]', ...args),
  warn: (...args) => console.warn('[Analytics]', ...args),
  error: (...args) => console.error('[Analytics]', ...args),
  success: (...args) => console.info('[Analytics:OK]', ...args),
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
  clear: () => _cacheStore.clear(),
}

const simpleHash = (str) => {
  if (!str) return '00000000'
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

// =============================
// CONSTANTES
// =============================

export const ANALYTICS_VERSION = '3.0.0'

export const ANALYTICS_CONFIG = {
  EVENTS: {
    VIEW: 'view',
    DOWNLOAD: 'download',
    INSTALL: 'install',
    SESSION: 'session',
    FORK: 'fork',
    REVIEW: 'review',
    RATING: 'rating',
    PUBLISH: 'publish',
    UPDATE: 'update',
    ERROR: 'error',
    UNINSTALL: 'uninstall'
  },
  PERIODS: {
    TODAY: 'today',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
    ALL: 'all',
    CUSTOM: 'custom'
  },
  METRICS: {
    VIEWS: 'views',
    DOWNLOADS: 'downloads',
    INSTALLS: 'installs',
    SESSIONS: 'sessions',
    ACTIVE_USERS: 'activeUsers',
    RETENTION: 'retention',
    CONVERSION: 'conversion',
    DAU: 'dau',
    MAU: 'mau',
    STICKINESS: 'stickiness',
    AVG_SESSION: 'avgSessionDuration'
  },
  BATCH: {
    MAX_SIZE: 100,
    FLUSH_INTERVAL: 1000, // 1 seconde
    RETRY_ATTEMPTS: 3
  },
  CACHE: {
    METRICS_TTL: 5 * 60 * 1000, // 5 minutes
    DASHBOARD_TTL: 2 * 60 * 1000, // 2 minutes
    HEALTH_TTL: 10 * 1000 // 10 secondes
  }
}

// =============================
// EVENT BUFFER (batching)
// =============================

class EventBuffer {
  constructor(storage) {
    this.storage = storage
    this.buffer = []
    this.flushTimeout = null
    this.stats = {
      totalFlushed: 0,
      totalRetries: 0,
      currentSize: 0
    }
  }

  /**
   * Ajoute un événement au buffer
   */
  async add(event) {
    this.buffer.push(event)
    this.stats.currentSize = this.buffer.length

    // Flush immédiat si buffer plein
    if (this.buffer.length >= ANALYTICS_CONFIG.BATCH.MAX_SIZE) {
      await this.flush()
    } 
    // Sinon programmer un flush
    else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(
        () => this.flush(), 
        ANALYTICS_CONFIG.BATCH.FLUSH_INTERVAL
      )
    }
  }

  /**
   * Vide le buffer en base avec retry
   */
  async flush() {
    if (this.buffer.length === 0) return

    const events = [...this.buffer]
    this.buffer = []
    this.stats.currentSize = 0
    
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }

    // Tentative avec retry
    for (let attempt = 1; attempt <= ANALYTICS_CONFIG.BATCH.RETRY_ATTEMPTS; attempt++) {
      try {
        await this.storage.saveEvents(events)
        this.stats.totalFlushed += events.length
        logger.debug(`Buffer flush: ${events.length} events (attempt ${attempt})`)
        return
      } catch (error) {
        logger.warn(`Flush attempt ${attempt} failed:`, error)
        if (attempt === ANALYTICS_CONFIG.BATCH.RETRY_ATTEMPTS) {
          // Dernier recours : stocker dans un fichier dead letter
          await this._saveToDeadLetter(events, error)
          this.stats.totalRetries++
        }
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 100 * attempt))
      }
    }
  }

  /**
   * Sauvegarde les événements en dead letter en cas d'échec
   */
  async _saveToDeadLetter(events, error) {
    try {
      const deadLetter = {
        timestamp: Date.now(),
        error: error.message,
        events: events.map(e => ({
          ...e,
          _id: undefined // Enlever l'ID pour éviter les doublons
        }))
      }
      await this.storage.save('dead_letter_events', deadLetter)
      logger.error(`${events.length} events moved to dead letter`)
    } catch (dlError) {
      logger.error('Critical: Failed to save dead letter', dlError)
    }
  }

  /**
   * Force le flush (pour shutdown)
   */
  async forceFlush() {
    await this.flush()
  }

  getStats() {
    return {
      ...this.stats,
      bufferSize: this.buffer.length
    }
  }
}

// =============================
// DAILY METRICS AGGREGATOR (pré-agrégation)
// =============================

class DailyMetricsAggregator {
  constructor(storage) {
    this.storage = storage
    this.aggregationInProgress = false
  }

  /**
   * Agrège les événements d'une journée
   */
  async aggregateDay(appId, date) {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const events = await this.storage.getEventsInRange(
      appId,
      startOfDay.getTime(),
      endOfDay.getTime()
    )

    const metrics = {
      appId,
      date: startOfDay.toISOString().split('T')[0],
      views: 0,
      downloads: 0,
      installs: 0,
      sessions: 0,
      uninstalls: 0,
      uniqueUsers: new Set(),
      totalSessionDuration: 0,
      sessionCount: 0
    }

    for (const event of events) {
      switch (event.type) {
        case ANALYTICS_CONFIG.EVENTS.VIEW:
          metrics.views++
          if (event.userId) metrics.uniqueUsers.add(event.userId)
          break
        case ANALYTICS_CONFIG.EVENTS.DOWNLOAD:
          metrics.downloads++
          break
        case ANALYTICS_CONFIG.EVENTS.INSTALL:
          metrics.installs++
          break
        case ANALYTICS_CONFIG.EVENTS.SESSION:
          metrics.sessions++
          if (event.data?.duration) {
            metrics.totalSessionDuration += event.data.duration
          }
          break
        case ANALYTICS_CONFIG.EVENTS.UNINSTALL:
          metrics.uninstalls++
          break
      }
    }

    const aggregated = {
      appId: metrics.appId,
      date: metrics.date,
      views: metrics.views,
      downloads: metrics.downloads,
      installs: metrics.installs,
      sessions: metrics.sessions,
      uninstalls: metrics.uninstalls,
      uniqueUsers: metrics.uniqueUsers.size,
      avgSessionDuration: metrics.sessionCount > 0 
        ? metrics.totalSessionDuration / metrics.sessionCount 
        : 0,
      updatedAt: new Date().toISOString()
    }

    // Sauvegarder l'agrégation
    await this.storage.saveDailyMetrics(appId, metrics.date, aggregated)

    return aggregated
  }

  /**
   * Agrège les 30 derniers jours
   */
  async aggregateLast30Days(appId) {
    const today = new Date()
    const results = []

    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      try {
        const metrics = await this.aggregateDay(appId, date)
        results.push(metrics)
      } catch (error) {
        logger.error(`Failed to aggregate ${date.toISOString()}`, error)
      }
    }

    return results
  }
}

// =============================
// STREAMING EXPORT
// =============================

async function* streamEvents(storage, appId, options = {}) {
  const {
    batchSize = 1000,
    period = 'all',
    fromDate = null,
    toDate = null
  } = options

  let page = 0
  let hasMore = true

  while (hasMore) {
    const events = await storage.getAppEvents(appId, {
      limit: batchSize,
      offset: page * batchSize,
      period,
      fromDate,
      toDate
    })

    if (events.length === 0) {
      hasMore = false
    } else {
      yield events
      page++
    }
  }
}

// =============================
// ANONYMIZATION (RGPD)
// =============================

function anonymizeData(data, options = {}) {
  const {
    hashIp = true,
    hashUserId = true,
    removeUserAgent = true
  } = options

  const anonymized = { ...data }

  // Anonymiser l'IP
  if (hashIp && anonymized.metadata?.ip) {
    anonymized.metadata.ip = simpleHash(anonymized.metadata.ip).substring(0, 16)
  }

  // Anonymiser l'userId
  if (hashUserId && anonymized.userId) {
    anonymized.userId = simpleHash(anonymized.userId).substring(0, 16)
  }

  // Supprimer le userAgent
  if (removeUserAgent && anonymized.metadata?.userAgent) {
    delete anonymized.metadata.userAgent
  }

  return anonymized
}

// =============================
// REAL-TIME STREAM
// =============================

export const analyticsStream = new EventEmitter()
analyticsStream.setMaxListeners(100)

// =============================
// HEALTH MONITOR
// =============================

class HealthMonitor {
  constructor() {
    this.metrics = {
      eventsPerSecond: 0,
      lastEventsCount: 0,
      lastCheck: Date.now(),
      bufferSize: 0,
      storageLatency: 0,
      errors: []
    }
    this.interval = setInterval(() => this.update(), 1000)
  }

  update() {
    const now = Date.now()
    const elapsed = (now - this.metrics.lastCheck) / 1000
    
    if (elapsed > 0) {
      this.metrics.eventsPerSecond = Math.round(
        (this.metrics.lastEventsCount) / elapsed
      )
    }

    this.metrics.lastCheck = now
    this.metrics.lastEventsCount = 0
  }

  recordEvent() {
    this.metrics.lastEventsCount++
  }

  recordError(error) {
    this.metrics.errors.push({
      message: error.message,
      timestamp: new Date().toISOString()
    })
    // Garder seulement les 10 dernières erreurs
    if (this.metrics.errors.length > 10) {
      this.metrics.errors.shift()
    }
  }

  recordStorageLatency(duration) {
    this.metrics.storageLatency = duration
  }

  getHealth() {
    return {
      ...this.metrics,
      status: this.metrics.eventsPerSecond > 100 ? 'high_load' : 'healthy',
      timestamp: new Date().toISOString()
    }
  }

  shutdown() {
    clearInterval(this.interval)
  }
}

// =============================
// IMPORTS DYNAMIQUES
// =============================

let analyticsModule
let eventsModule
let servicesCache = null
let initializing = null
let healthMonitor = null
let eventBuffer = null
let dailyAggregator = null

async function loadModules() {
  if (!analyticsModule) {
    const [
      { appAnalyticsService, initializeAnalyticsService, getAnalyticsService },
      { eventsService, EVENTS_TYPES, initializeEventsService, getEventsService }
    ] = await Promise.all([
      import('./appAnalyticsService'),
      import('./events')
    ])

    analyticsModule = {
      service: appAnalyticsService,
      initialize: initializeAnalyticsService,
      get: getAnalyticsService
    }

    eventsModule = {
      service: eventsService,
      initialize: initializeEventsService,
      get: getEventsService,
      constants: { EVENTS_TYPES }
    }
  }

  return { analyticsModule, eventsModule }
}

// =============================
// INITIALISATION
// =============================

export async function initializeAnalytics(config = {}) {
  if (initializing) return initializing

  const {
    storageClient,
    retention = 30,
    persist = true,
    cleanupOnStart = false,
    anonymization = { hashIp: true, hashUserId: true },
    enableRealtime = true
  } = config

  logger.info('🚀 Initialisation du module analytics...')

  initializing = (async () => {
    try {
      if (!storageClient) {
        throw new Error('storageClient requis')
      }

      const modules = await loadModules()

      // Initialiser les services
      modules.analyticsModule.initialize(storageClient)
      modules.eventsModule.initialize(storageClient)

      const eventsService = modules.eventsModule.get()

      // Initialiser le buffer et l'agrégateur
      eventBuffer = new EventBuffer(eventsService)
      dailyAggregator = new DailyMetricsAggregator(eventsService)
      healthMonitor = new HealthMonitor()

      // Configurer la rétention
      if (retention) {
        eventsService.setRetention?.(retention)
      }

      // Activer/désactiver la persistance
      if (persist !== undefined) {
        eventsService.setPersistence?.(persist)
      }

      // Nettoyer au démarrage
      if (cleanupOnStart) {
        await eventsService.cleanup?.()
      }

      // Cache des services
      servicesCache = {
        analytics: modules.analyticsModule.get(),
        events: eventsService,
        config: { anonymization, enableRealtime }
      }

      // Lancer l'agrégation quotidienne
      setInterval(() => {
        dailyAggregator.aggregateLast30Days().catch(err => {
          logger.error('Daily aggregation error:', err)
        })
      }, 60 * 60 * 1000) // Toutes les heures

      logger.success('✅ Module analytics initialisé')
      
      return { 
        success: true,
        version: ANALYTICS_VERSION,
        retention,
        persist,
        anonymization
      }

    } catch (error) {
      logger.error('❌ Échec initialisation:', error)
      return { success: false, error: error.message }
    } finally {
      initializing = null
    }
  })()

  return initializing
}

// =============================
// SHUTDOWN
// =============================

export async function shutdownAnalytics() {
  logger.info('🛑 Arrêt du module analytics...')

  try {
    // Vider le buffer
    if (eventBuffer) {
      await eventBuffer.forceFlush()
    }

    // Arrêter le health monitor
    if (healthMonitor) {
      healthMonitor.shutdown()
    }

    servicesCache = null

    logger.success('✅ Module analytics arrêté')
    return { success: true }

  } catch (error) {
    logger.error('❌ Erreur arrêt:', error)
    return { success: false, error: error.message }
  }
}

// =============================
// TRACKING AVEC BUFFER
// =============================

async function withEventsService(operation, ...args) {
  try {
    if (servicesCache?.events) {
      return await operation(servicesCache.events, ...args)
    }

    const modules = await loadModules()
    const service = modules.eventsModule.get()
    
    if (!service) throw new Error('EventsService non initialisé')
    
    if (servicesCache) servicesCache.events = service
    
    return await operation(service, ...args)
  } catch (error) {
    logger.error('Erreur eventsService:', error)
    throw error
  }
}

/**
 * Enregistre un événement avec buffer
 */
export async function trackEvent(type, appId, userId = null, data = {}, metadata = {}) {
  // Anonymisation
  const anonymized = anonymizeData(
    { userId, metadata },
    servicesCache?.config?.anonymization || {}
  )

  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    type,
    appId,
    userId: anonymized.userId,
    data,
    metadata: anonymized.metadata,
    timestamp: new Date().toISOString()
  }

  // Monitoring
  if (healthMonitor) {
    healthMonitor.recordEvent()
  }

  // Buffer
  if (eventBuffer) {
    await eventBuffer.add(event)
  } else {
    // Fallback direct
    await withEventsService((s) => s.saveEvent(event))
  }

  // Temps réel
  if (servicesCache?.config?.enableRealtime) {
    analyticsStream.emit('event', event)
  }

  return event
}

// =============================
// MÉTRIQUES OPTIMISÉES (pré-agrégées)
// =============================

/**
 * Récupère les métriques agrégées
 */
export async function getAppMetrics(appId, period = 'month') {
  const cacheKey = `analytics:metrics:${appId}:${period}`
  
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const startTime = Date.now()

  // Utiliser les daily metrics pré-agrégées
  const dailyMetrics = await withEventsService((s) => 
    s.getDailyMetrics(appId, period)
  )

  // Agrégation SUM
  const metrics = {
    appId,
    period,
    totals: {
      views: 0,
      downloads: 0,
      installs: 0,
      sessions: 0,
      uninstalls: 0,
      uniqueUsers: 0
    },
    daily: dailyMetrics,
    average: {
      dailyViews: 0,
      dailyDownloads: 0,
      dailyInstalls: 0,
      avgSessionDuration: 0
    }
  }

  if (dailyMetrics.length > 0) {
    // Calculer les totaux
    for (const day of dailyMetrics) {
      metrics.totals.views += day.views
      metrics.totals.downloads += day.downloads
      metrics.totals.installs += day.installs
      metrics.totals.sessions += day.sessions
      metrics.totals.uninstalls += day.uninstalls
      metrics.totals.uniqueUsers += day.uniqueUsers
    }

    // Moyennes
    const days = dailyMetrics.length
    metrics.average.dailyViews = Math.round(metrics.totals.views / days)
    metrics.average.dailyDownloads = Math.round(metrics.totals.downloads / days)
    metrics.average.dailyInstalls = Math.round(metrics.totals.installs / days)
    
    const avgSession = dailyMetrics.reduce((sum, d) => sum + (d.avgSessionDuration || 0), 0) / days
    metrics.average.avgSessionDuration = Math.round(avgSession)

    // Métriques avancées
    metrics.stickiness = metrics.totals.uniqueUsers > 0
      ? Math.round((metrics.totals.sessions / metrics.totals.uniqueUsers) * 100) / 100
      : 0
  }

  const duration = Date.now() - startTime
  if (healthMonitor) {
    healthMonitor.recordStorageLatency(duration)
  }

  await cache.set(cacheKey, metrics, ANALYTICS_CONFIG.CACHE.METRICS_TTL)
  return metrics
}

// =============================
// EXPORT EN STREAMING
// =============================

export async function* streamAnalytics(appId, options = {}) {
  const storage = servicesCache?.events
  if (!storage) throw new Error('Analytics non initialisé')

  for await (const batch of streamEvents(storage, appId, options)) {
    yield batch
  }
}

/**
 * Export avec streaming
 */
export async function exportAnalytics(appId, format = 'json', options = {}) {
  const {
    period = 'all',
    batchSize = 1000,
    onProgress = null
  } = options

  let totalEvents = 0
  let firstBatch = true
  let result = ''

  for await (const batch of streamAnalytics(appId, { period, batchSize })) {
    totalEvents += batch.length

    if (format === 'json') {
      if (firstBatch) {
        result += JSON.stringify({
          appId,
          exportedAt: new Date().toISOString(),
          period,
          events: []
        }, null, 2).slice(0, -3) // Enlever le ']}' final
        firstBatch = false
      }
      
      // Ajouter les événements
      for (const event of batch) {
        result += JSON.stringify(event, null, 2) + ',\n'
      }
    }

    if (format === 'csv' && firstBatch) {
      result = 'timestamp,type,userId,data\n'
      firstBatch = false
    }

    if (format === 'csv') {
      for (const event of batch) {
        const time = new Date(event.timestamp).toLocaleString()
        const data = JSON.stringify(event.data).replace(/,/g, ';')
        result += `${time},${event.type},${event.userId || ''},${data}\n`
      }
    }

    if (onProgress) {
      onProgress({ batch: batch.length, total: totalEvents })
    }
  }

  // Finaliser JSON
  if (format === 'json' && !firstBatch) {
    result = result.slice(0, -2) // Enlever la dernière virgule
    result += '\n]}'
  }

  return {
    data: result,
    total: totalEvents,
    format,
    period
  }
}

// =============================
// MÉTRIQUES AVANCÉES
// =============================

/**
 * Calcule le stickiness (DAU/MAU)
 */
export async function getStickiness(appId) {
  const [dau, mau] = await Promise.all([
    getActiveUsers('day'),
    getActiveUsers('month')
  ])

  return {
    dau,
    mau,
    stickiness: mau > 0 ? (dau / mau) * 100 : 0
  }
}
/**
 * Calcule le funnel de conversion
 */
export async function getFunnel(appId, period = 'month') {
  const events = await getAppEvents(appId, { period })

  const funnel = {
    views: events.filter(e => e.type === ANALYTICS_CONFIG.EVENTS.VIEW).length,
    downloads: events.filter(e => e.type === ANALYTICS_CONFIG.EVENTS.DOWNLOAD).length,
    installs: events.filter(e => e.type === ANALYTICS_CONFIG.EVENTS.INSTALL).length,
    sessions: events.filter(e => e.type === ANALYTICS_CONFIG.EVENTS.SESSION).length
  }

  funnel.conversion = {
    viewToDownload: funnel.views > 0 
      ? (funnel.downloads / funnel.views) * 100 
      : 0,
    downloadToInstall: funnel.downloads > 0 
      ? (funnel.installs / funnel.downloads) * 100 
      : 0,
    installToActive: funnel.installs > 0 
      ? (funnel.sessions / funnel.installs) * 100 
      : 0,
    overall: funnel.views > 0 
      ? (funnel.sessions / funnel.views) * 100 
      : 0
  }

  return funnel
}

// =============================
// HEALTH ENDPOINT
// =============================

export async function getAnalyticsHealth() {
  const cacheKey = 'analytics:health'
  
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const health = healthMonitor ? healthMonitor.getHealth() : {
    status: 'not_initialized',
    eventsPerSecond: 0,
    bufferSize: 0
  }

  if (eventBuffer) {
    health.buffer = eventBuffer.getStats()
  }

  await cache.set(cacheKey, health, ANALYTICS_CONFIG.CACHE.HEALTH_TTL)
  return health
}

// =============================
// API EXISTANTE PRÉSERVÉE
// =============================

// Toutes les fonctions existantes sont conservées mais optimisées
export async function getAppEvents(appId, options = {}) {
  return withEventsService((s) => s.getAppEvents(appId, options))
}

export async function getAppDashboard(appId) {
  const cacheKey = `analytics:dashboard:${appId}`
  
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const [metrics, events, timeline] = await Promise.all([
    getAppMetrics(appId),
    getAppEvents(appId, { limit: 100 }),
    withEventsService((s) => s.getTimeline?.(appId, 'day', 30) || [])
  ])

  const dashboard = {
    appId,
    metrics,
    recentEvents: events,
    timeline,
    funnel: await getFunnel(appId),
    generatedAt: new Date().toISOString()
  }

  await cache.set(cacheKey, dashboard, ANALYTICS_CONFIG.CACHE.DASHBOARD_TTL)
  return dashboard
}

export async function getActiveUsers(period = 'day') {
  const cacheKey = `analytics:active:${period}`
  
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const result = await withEventsService((s) => s.getActiveUsers?.(period) || {})
  await cache.set(cacheKey, result, 60 * 1000)
  return result
}

export async function getRetentionRate(appId, days = 30) {
  const cacheKey = `analytics:retention:${appId}:${days}`
  
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const result = await withEventsService((s) => s.calculateRetention?.(appId, days) || {
    cohort: [],
    average: 0
  })

  await cache.set(cacheKey, result, 60 * 60 * 1000)
  return result
}

export async function getConversionRate(appId, period = 'month') {
  const funnel = await getFunnel(appId, period)
  return {
    ...funnel.conversion,
    views: funnel.views,
    downloads: funnel.downloads,
    installs: funnel.installs,
    sessions: funnel.sessions
  }
}

export async function getTopApps(limit = 10, metric = 'installs') {
  const cacheKey = `analytics:top:${metric}:${limit}`
  
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const result = await withEventsService((s) => s.getTopApps?.(limit, metric) || [])
  await cache.set(cacheKey, result, 30 * 60 * 1000)
  return result
}

export async function getGlobalStats() {
  const cacheKey = 'analytics:global'
  
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const [
    totalEvents,
    activeUsers,
    topApps,
    dau,
    mau
  ] = await Promise.all([
    withEventsService((s) => s.getTotalEvents?.() || 0),
    getActiveUsers('day'),
    getTopApps(10),
    withEventsService((s) => s.getActiveUsersCount?.('day') || 0),
    withEventsService((s) => s.getActiveUsersCount?.('month') || 0)
  ])

  const result = {
    totalEvents,
    activeUsers,
    topApps,
    dau,
    mau,
    stickiness: mau > 0 ? (dau / mau) * 100 : 0,
    timestamp: Date.now()
  }

  await cache.set(cacheKey, result, 5 * 60 * 1000)
  return result
}

export async function cleanupAnalytics(olderThan = null) {
  return withEventsService((s) => s.cleanup?.(olderThan))
}

export async function clearAnalyticsCache() {
  await cache.invalidatePattern('analytics:*')
  logger.info('Cache analytics vidé')
}

export async function getAnalyticsStats() {
  return {
    version: ANALYTICS_VERSION,
    initialized: !!servicesCache,
    health: await getAnalyticsHealth(),
    events: await withEventsService((s) => s.getStats?.() || {}),
    uptime: process.uptime(),
    timestamp: Date.now()
  }
}

// =============================
// EXPORT DES CONSTANTES
// =============================

export const EVENTS = ANALYTICS_CONFIG.EVENTS
export const PERIODS = ANALYTICS_CONFIG.PERIODS
export const METRICS = ANALYTICS_CONFIG.METRICS

// =============================
// EXPORT PAR DÉFAUT
// =============================

export default {
  version: ANALYTICS_VERSION,
  
  // Initialisation
  initialize: initializeAnalytics,
  shutdown: shutdownAnalytics,
  isInitialized: async () => !!servicesCache,
  
  // Streaming temps réel
  stream: analyticsStream,
  
  // Services
  getAnalyticsService: async () => servicesCache?.analytics,
  getEventsService: async () => servicesCache?.events,
  
  // Tracking
  track: trackEvent,
  view: (appId, userId, metadata) => 
    trackEvent(EVENTS.VIEW, appId, userId, {}, metadata),
  download: (appId, userId, metadata) => 
    trackEvent(EVENTS.DOWNLOAD, appId, userId, {}, metadata),
  install: (appId, userId, metadata) => 
    trackEvent(EVENTS.INSTALL, appId, userId, {}, metadata),
  session: (appId, userId, duration, metadata) => 
    trackEvent(EVENTS.SESSION, appId, userId, { duration }, metadata),
  uninstall: (appId, userId, metadata) => 
    trackEvent(EVENTS.UNINSTALL, appId, userId, {}, metadata),
  
  // Requêtes optimisées
  getAppMetrics,
  getAppDashboard,
  getActiveUsers,
  getRetentionRate,
  getConversionRate,
  getFunnel,
  getStickiness,
  getTopApps,
  getGlobalStats,
  getAnalyticsHealth,
  getAnalyticsStats,
  
  // Export streaming
  export: exportAnalytics,
  stream: streamAnalytics,
  
  // Maintenance
  cleanup: cleanupAnalytics,
  clearCache: clearAnalyticsCache,
  
  // Constantes
  constants: ANALYTICS_CONFIG,
  EVENTS,
  PERIODS,
  METRICS
  }

export const getDAU = async (appId) => 0;
export const getMAU = async (appId) => 0;
