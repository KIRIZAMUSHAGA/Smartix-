/**
 * events - Service de gestion des événements analytics
 * Version FINALE avec anti-spam, déduplication et métriques PRO
 * 
 * Rôle: Collecter et analyser les événements d'utilisation
 * - Anti-spam avec rate limiting
 * - Déduplication des installations
 * - Protection mémoire optimisée
 * - Métriques avancées (DAU, MAU, Stickiness)
 * - Dashboard-ready
 */

import { EventEmitter } from 'events'

const logger = {
  debug: (...args) => console.debug('[Analytics:Events]', ...args),
  info: (...args) => console.info('[Analytics:Events]', ...args),
  warn: (...args) => console.warn('[Analytics:Events]', ...args),
  error: (...args) => console.error('[Analytics:Events]', ...args),
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
  expire: async (key, ttl) => true,
}

// =============================
// CONFIGURATION
// =============================

export const EVENTS_TYPES = {
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
}

const DEFAULT_RETENTION_DAYS = 90 // 3 mois
const MAX_EVENTS_IN_MEMORY = 10000
const AGGREGATION_INTERVAL = 60 * 60 * 1000 // 1 heure
const BATCH_SIZE = 100
const FLUSH_INTERVAL = 5000 // 5 secondes

// 🔧 Anti-spam
const EVENT_RATE_LIMIT = {
  DEFAULT: 50, // events par minute par défaut
  VIEW: 100,
  DOWNLOAD: 20,
  INSTALL: 5,
  SESSION: 100,
  FORK: 10,
  REVIEW: 5,
  RATING: 10
}

// 🔧 Déduplication
const DEDUPLICATION_WINDOW = {
  INSTALL: 24 * 60 * 60, // 24h en secondes
  DOWNLOAD: 60 * 60,      // 1h
  REVIEW: 7 * 24 * 60 * 60 // 7 jours
}

// 🔧 Protection mémoire
const MEMORY_CLEANUP_RATIO = 0.2 // Supprime 20% quand plein

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

  async add(event) {
    this.buffer.push(event)
    this.stats.currentSize = this.buffer.length

    if (this.buffer.length >= BATCH_SIZE) {
      await this.flush()
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), FLUSH_INTERVAL)
    }
  }

  async flush() {
    if (this.buffer.length === 0) return

    const events = [...this.buffer]
    this.buffer = []
    this.stats.currentSize = 0
    
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (this.storage?.bulkInsert) {
          await this.storage.bulkInsert('events', events)
        } else if (this.storage?.save) {
          for (const event of events) {
            await this.storage.save('events', event)
          }
        }
        this.stats.totalFlushed += events.length
        return
      } catch (error) {
        logger.warn(`Flush attempt ${attempt} failed:`, error)
        if (attempt === 3) {
          await this._saveToDeadLetter(events, error)
          this.stats.totalRetries++
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt))
      }
    }
  }

  async _saveToDeadLetter(events, error) {
    try {
      const deadLetter = {
        timestamp: Date.now(),
        error: error.message,
        events: events.map(e => ({
          ...e,
          _id: undefined
        }))
      }
      await this.storage?.save('dead_letter_events', deadLetter)
      logger.error(`${events.length} events moved to dead letter`)
    } catch (dlError) {
      logger.error('Critical: Failed to save dead letter', dlError)
    }
  }

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
// DAILY METRICS AGGREGATOR
// =============================

class DailyMetricsAggregator {
  constructor(storage) {
    this.storage = storage
    this.cache = new Map()
  }

  async aggregateDay(appId, date, events) {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const dayEvents = events || await this.storage?.getEventsInRange?.(
      appId,
      startOfDay.getTime(),
      endOfDay.getTime()
    ) || []

    const metrics = {
      appId,
      date: startOfDay.toISOString().split('T')[0],
      views: 0,
      downloads: 0,
      installs: 0,
      sessions: 0,
      uninstalls: 0,
      reviews: 0,
      forks: 0,
      ratings: 0,
      totalRating: 0,
      uniqueUsers: new Set(),
      totalSessionDuration: 0,
      sessionCount: 0
    }

    for (const event of dayEvents) {
      switch (event.type) {
        case EVENTS_TYPES.VIEW:
          metrics.views++
          if (event.userId) metrics.uniqueUsers.add(event.userId)
          break
        case EVENTS_TYPES.DOWNLOAD:
          metrics.downloads++
          break
        case EVENTS_TYPES.INSTALL:
          metrics.installs++
          break
        case EVENTS_TYPES.SESSION:
          metrics.sessions++
          if (event.data?.duration) {
            metrics.totalSessionDuration += event.data.duration
            metrics.sessionCount++
          }
          break
        case EVENTS_TYPES.UNINSTALL:
          metrics.uninstalls++
          break
        case EVENTS_TYPES.REVIEW:
          metrics.reviews++
          break
        case EVENTS_TYPES.FORK:
          metrics.forks++
          break
        case EVENTS_TYPES.RATING:
          metrics.ratings++
          if (event.data?.value) {
            metrics.totalRating += event.data.value
          }
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
      reviews: metrics.reviews,
      forks: metrics.forks,
      ratings: metrics.ratings,
      averageRating: metrics.ratings > 0 
        ? Math.round((metrics.totalRating / metrics.ratings) * 10) / 10
        : 0,
      uniqueUsers: metrics.uniqueUsers.size,
      avgSessionDuration: metrics.sessionCount > 0 
        ? Math.round(metrics.totalSessionDuration / metrics.sessionCount)
        : 0,
      updatedAt: new Date().toISOString()
    }

    const cacheKey = `daily:${appId}:${metrics.date}`
    this.cache.set(cacheKey, aggregated)

    if (this.storage?.saveDailyMetrics) {
      await this.storage.saveDailyMetrics(appId, metrics.date, aggregated)
    }

    return aggregated
  }

  async getMetrics(appId, period = 'month') {
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
    }

    const metrics = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const cacheKey = `daily:${appId}:${dateStr}`
      
      let daily = this.cache.get(cacheKey)
      
      if (!daily && this.storage?.getDailyMetrics) {
        daily = await this.storage.getDailyMetrics(appId, dateStr)
        if (daily) {
          this.cache.set(cacheKey, daily)
        }
      }

      if (daily) {
        metrics.push(daily)
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return metrics
  }

  clearCache() {
    this.cache.clear()
  }
}

// =============================
// CLASSE PRINCIPALE
// =============================

export class EventsService extends EventEmitter {
  constructor(storage = null) {
    super()
    this.events = []
    this.aggregates = new Map()
    this.appIndex = new Map()
    this.userIndex = new Map()
    this.retentionDays = DEFAULT_RETENTION_DAYS
    this.storage = storage
    this.buffer = storage ? new EventBuffer(storage) : null
    this.dailyAggregator = storage ? new DailyMetricsAggregator(storage) : null
    this.stats = {
      totalEvents: 0,
      eventsInMemory: 0,
      uniqueApps: 0,
      uniqueUsers: 0,
      oldestEvent: null,
      newestEvent: null,
      eventsPerSecond: 0,
      lastEventCount: 0,
      lastStatsUpdate: Date.now(),
      // 🔧 Nouvelles stats
      rateLimited: 0,
      deduplicated: 0
    }
    this.logger = logger.createChild('EventsService')

    setInterval(() => this._aggregate(), AGGREGATION_INTERVAL)
    setInterval(() => this._updateStats(), 1000)
  }

  /**
   * Configure la rétention
   */
  setRetention(days) {
    this.retentionDays = days
    this.logger.info(`Rétention configurée à ${days} jours`)
  }

  /**
   * Active/désactive la persistance
   */
  setPersistence(enabled, storage = null) {
    if (enabled && storage) {
      this.storage = storage
      this.buffer = new EventBuffer(storage)
      this.dailyAggregator = new DailyMetricsAggregator(storage)
    } else {
      this.buffer = null
      this.dailyAggregator = null
    }
    this.logger.info(`Persistance ${enabled ? 'activée' : 'désactivée'}`)
  }

  /**
   * Met à jour les stats en temps réel
   */
  _updateStats() {
    const now = Date.now()
    const elapsed = (now - this.stats.lastStatsUpdate) / 1000
    
    if (elapsed > 0) {
      const newEvents = this.stats.totalEvents - this.stats.lastEventCount
      this.stats.eventsPerSecond = Math.round(newEvents / elapsed)
    }

    this.stats.lastStatsUpdate = now
    this.stats.lastEventCount = this.stats.totalEvents
  }

  /**
   * 🔧 Vérifie le rate limiting
   */
  async _checkRateLimit(userId, type) {
    if (!userId || !cache) return true

    const limit = EVENT_RATE_LIMIT[type] || EVENT_RATE_LIMIT.DEFAULT
    const key = `rate:${userId}:${type}`

    try {
      const count = await cache.increment(key)
      if (count === 1) {
        await cache.expire(key, 60) // 60 secondes
      }
      
      if (count > limit) {
        this.stats.rateLimited++
        this.logger.warn(`Rate limit exceeded`, { userId, type, count })
        return false
      }
    } catch (error) {
      this.logger.warn('Rate limit check failed', error)
    }

    return true
  }

  /**
   * 🔧 Vérifie la déduplication
   */
  async _checkDeduplication(type, appId, userId) {
    if (!appId || !userId || !cache) return true

    const window = DEDUPLICATION_WINDOW[type]
    if (!window) return true

    const key = `dedup:${type}:${appId}:${userId}`

    try {
      const exists = await cache.get(key)
      if (exists) {
        this.stats.deduplicated++
        this.logger.debug(`Deduplicated ${type}`, { appId, userId })
        return false
      }

      await cache.set(key, '1', window)
    } catch (error) {
      this.logger.warn('Deduplication check failed', error)
    }

    return true
  }

  /**
   * 🔧 Protection mémoire améliorée
   */
  _memoryProtection() {
    if (this.events.length <= MAX_EVENTS_IN_MEMORY) return

    const removeCount = Math.floor(MAX_EVENTS_IN_MEMORY * MEMORY_CLEANUP_RATIO)
    const removed = this.events.splice(0, removeCount)

    for (const event of removed) {
      this._removeFromIndexes(event)
      this.stats.totalEvents--
    }

    this.logger.debug(`Memory cleanup: removed ${removeCount} events`)
  }

  /**
   * Enregistre un événement (avec anti-spam et déduplication)
   */
  async track(type, appId, userId = null, data = {}, metadata = {}) {
    // 🔧 Anti-spam
    if (!await this._checkRateLimit(userId, type)) {
      return null
    }

    // 🔧 Déduplication
    if (!await this._checkDeduplication(type, appId, userId)) {
      return null
    }

    const eventId = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const now = Date.now()

    const event = {
      id: eventId,
      type,
      appId,
      userId,
      data,
      metadata: {
        ip: metadata.ip || null,
        userAgent: metadata.userAgent || null,
        device: metadata.device || null,
        platform: metadata.platform || null,
        version: metadata.version || null,
        ...metadata
      },
      timestamp,
      createdAt: now
    }

    // Stockage mémoire
    this.events.push(event)

    // Indexation
    if (!this.appIndex.has(appId)) {
      this.appIndex.set(appId, new Set())
    }
    this.appIndex.get(appId).add(eventId)

    if (userId) {
      if (!this.userIndex.has(userId)) {
        this.userIndex.set(userId, new Set())
      }
      this.userIndex.get(userId).add(eventId)
    }

    // 🔧 Protection mémoire
    this._memoryProtection()

    // Stats
    this.stats.totalEvents++
    this.stats.eventsInMemory = this.events.length
    this.stats.uniqueApps = this.appIndex.size
    this.stats.uniqueUsers = this.userIndex.size
    this.stats.newestEvent = timestamp

    if (!this.stats.oldestEvent) {
      this.stats.oldestEvent = timestamp
    }

    // Buffer pour persistance
    if (this.buffer) {
      await this.buffer.add(event)
    }

    this.emit('event', event)
    return event
  }

  /**
   * Retire un événement des index
   */
  _removeFromIndexes(event) {
    this.appIndex.get(event.appId)?.delete(event.id)
    if (event.userId) {
      this.userIndex.get(event.userId)?.delete(event.id)
    }
  }

  /**
   * Récupère les événements d'une application
   */
  async getAppEvents(appId, options = {}) {
    const {
      limit = 1000,
      offset = 0,
      type = null,
      userId = null,
      startDate = null,
      endDate = null,
      period = 'all',
      includeMetadata = false
    } = options

    const cacheKey = `events:${appId}:${period}:${offset}:${limit}`
    const cached = await cache?.get(cacheKey)
    if (cached) return cached

    // Mémoire
    const eventIds = this.appIndex.get(appId) || new Set()
    let events = Array.from(eventIds)
      .map(id => this.events.find(e => e.id === id))
      .filter(Boolean)

    // Storage
    if (this.storage && events.length < offset + limit) {
      const storedEvents = await this.storage.getAppEvents(appId, {
        limit: limit * 2,
        offset: Math.max(0, offset - events.length),
        startDate,
        endDate,
        period
      })
      
      const existingIds = new Set(events.map(e => e.id))
      for (const stored of storedEvents) {
        if (!existingIds.has(stored.id)) {
          events.push(stored)
        }
      }
    }

    // Filtres
    if (type) events = events.filter(e => e.type === type)
    if (userId) events = events.filter(e => e.userId === userId)
    if (startDate) {
      const start = new Date(startDate).getTime()
      events = events.filter(e => new Date(e.timestamp).getTime() >= start)
    }
    if (endDate) {
      const end = new Date(endDate).getTime()
      events = events.filter(e => new Date(e.timestamp).getTime() <= end)
    }

    // Tri
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Pagination
    const paginated = events.slice(offset, offset + limit)

    if (!includeMetadata) {
      paginated.forEach(e => delete e.metadata)
    }

    if (cache && paginated.length > 0) {
      await cache.set(cacheKey, paginated, 60 * 1000)
    }

    return paginated
  }

  /**
   * Récupère les événements dans une plage de dates
   */
  async getEventsInRange(appId, startTime, endTime) {
    const events = []

    // Mémoire
    for (const event of this.events) {
      const time = new Date(event.timestamp).getTime()
      if (event.appId === appId && time >= startTime && time <= endTime) {
        events.push(event)
      }
    }

    // Storage
    if (this.storage?.getEventsInRange) {
      const stored = await this.storage.getEventsInRange(appId, startTime, endTime)
      events.push(...stored)
    }

    return events
  }

  /**
   * Calcule le cutoff pour une période
   */
  _getPeriodCutoff(period) {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000

    switch (period) {
      case 'today':
        return new Date().setHours(0, 0, 0, 0)
      case 'week':
        return now - 7 * day
      case 'month':
        return now - 30 * day
      case 'year':
        return now - 365 * day
      default:
        return 0
    }
  }

  /**
   * Agrège les métriques
   */
  aggregateMetrics(events) {
    const metrics = {
      total: events.length,
      byType: {},
      byDay: {},
      byHour: {},
      uniqueUsers: new Set(),
      uniqueDevices: new Set(),
      totalDuration: 0,
      sessions: 0,
      totalRating: 0,
      ratings: 0
    }

    for (const event of events) {
      metrics.byType[event.type] = (metrics.byType[event.type] || 0) + 1

      const day = event.timestamp.split('T')[0]
      metrics.byDay[day] = (metrics.byDay[day] || 0) + 1

      const hour = event.timestamp.split('T')[1]?.substring(0, 2) || '00'
      metrics.byHour[hour] = (metrics.byHour[hour] || 0) + 1

      if (event.userId) metrics.uniqueUsers.add(event.userId)
      if (event.metadata?.device) metrics.uniqueDevices.add(event.metadata.device)

      if (event.type === 'session' && event.data?.duration) {
        metrics.totalDuration += event.data.duration
        metrics.sessions++
      }

      if (event.type === 'rating' && event.data?.value) {
        metrics.totalRating += event.data.value
        metrics.ratings++
      }
    }

    return {
      ...metrics,
      uniqueUsers: metrics.uniqueUsers.size,
      uniqueDevices: metrics.uniqueDevices.size,
      averageSessionDuration: metrics.sessions > 0
        ? Math.round(metrics.totalDuration / metrics.sessions)
        : 0,
      averageRating: metrics.ratings > 0
        ? Math.round((metrics.totalRating / metrics.ratings) * 10) / 10
        : 0
    }
  }

  /**
   * Agrège les données (pour le cache)
   */
  async _aggregate() {
    const now = Date.now()
    const hour = new Date(now).toISOString().slice(0, 13)

    this.logger.debug('Agrégation des données...', { hour })

    const metrics = this.aggregateMetrics(this.events)

    this.aggregates.set(hour, {
      metrics,
      timestamp: now
    })

    // Nettoyer vieux agrégats
    const cutoff = now - 7 * 24 * 60 * 60 * 1000
    for (const [key, value] of this.aggregates.entries()) {
      if (value.timestamp < cutoff) {
        this.aggregates.delete(key)
      }
    }

    this.emit('aggregated', { hour, metrics })
  }

  /**
   * Récupère la timeline des événements
   */
  async getTimeline(appId, interval = 'day', days = 30) {
    const cacheKey = `timeline:${appId}:${interval}:${days}`
    
    const cached = await cache?.get(cacheKey)
    if (cached) return cached

    if (this.dailyAggregator) {
      const dailyMetrics = await this.dailyAggregator.getMetrics(appId, 'month')
      
      const timeline = dailyMetrics.map(day => ({
        date: day.date,
        total: day.views + day.downloads + day.installs + day.sessions,
        byType: {
          views: day.views,
          downloads: day.downloads,
          installs: day.installs,
          sessions: day.sessions,
          reviews: day.reviews,
          forks: day.forks
        }
      }))

      await cache?.set(cacheKey, timeline, 60 * 60 * 1000)
      return timeline
    }

    // Fallback
    const events = await this.getAppEvents(appId, { period: `${days}d` })
    const timeline = []
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * day)
      const dateStr = date.toISOString().split('T')[0]

      const dayEvents = events.filter(e => e.timestamp.startsWith(dateStr))

      timeline.push({
        date: dateStr,
        total: dayEvents.length,
        byType: this._groupByType(dayEvents)
      })
    }

    await cache?.set(cacheKey, timeline, 60 * 60 * 1000)
    return timeline
  }

    /**
   * Groupe les événements par type
   */
  _groupByType(events) {
    const groups = {}
    events.forEach(e => {
      groups[e.type] = (groups[e.type] || 0) + 1
    })
    return groups
  }

  /**
   * Récupère les utilisateurs actifs
   */
  async getActiveUsers(period = 'day') {
    const cacheKey = `active:${period}`
    
    const cached = await cache?.get(cacheKey)
    if (cached) return cached

    const cutoff = this._getPeriodCutoff(period)
    const activeUsers = new Set()

    // Mémoire
    for (const event of this.events) {
      if (event.userId && new Date(event.timestamp).getTime() > cutoff) {
        activeUsers.add(event.userId)
      }
    }

    // Storage
    if (this.storage?.getActiveUsers) {
      const stored = await this.storage.getActiveUsers(cutoff)
      for (const userId of stored) {
        activeUsers.add(userId)
      }
    }

    await cache?.set(cacheKey, activeUsers.size, 60 * 1000)
    return activeUsers.size
  }

  /**
   * Récupère le nombre d'utilisateurs actifs
   */
  async getActiveUsersCount(period = 'day') {
    return this.getActiveUsers(period)
  }

  /**
   * 🔧 DAU - Daily Active Users
   */
  async getDAU(appId) {
    const cacheKey = `dau:${appId}`
    
    const cached = await cache?.get(cacheKey)
    if (cached) return cached

    const users = new Set()
    const events = await this.getAppEvents(appId, { period: 'today' })

    for (const event of events) {
      if (event.userId) users.add(event.userId)
    }

    const dau = users.size
    await cache?.set(cacheKey, dau, 60 * 60) // 1 heure
    return dau
  }

  /**
   * 🔧 MAU - Monthly Active Users
   */
  async getMAU(appId) {
    const cacheKey = `mau:${appId}`
    
    const cached = await cache?.get(cacheKey)
    if (cached) return cached

    const users = new Set()
    const events = await this.getAppEvents(appId, { period: 'month' })

    for (const event of events) {
      if (event.userId) users.add(event.userId)
    }

    const mau = users.size
    await cache?.set(cacheKey, mau, 60 * 60) // 1 heure
    return mau
  }

  /**
   * 🔧 Stickiness (DAU/MAU * 100)
   */
  async getStickiness(appId) {
    const [dau, mau] = await Promise.all([
      this.getDAU(appId),
      this.getMAU(appId)
    ])

    return {
      dau,
      mau,
      stickiness: mau > 0 ? Math.round((dau / mau) * 100) : 0
    }
  }

  /**
   * 🔧 Dashboard complet pour une app
   */
  async getAppDashboard(appId) {
    const cacheKey = `dashboard:${appId}`
    
    const cached = await cache?.get(cacheKey)
    if (cached) return cached

    const [
      events,
      dau,
      mau,
      stickiness,
      timeline,
      metrics
    ] = await Promise.all([
      this.getAppEvents(appId, { limit: 100 }),
      this.getDAU(appId),
      this.getMAU(appId),
      this.getStickiness(appId),
      this.getTimeline(appId, 'day', 7),
      this.dailyAggregator?.getMetrics(appId, 'month').then(m => {
        const totals = m.reduce((acc, day) => ({
          views: acc.views + day.views,
          downloads: acc.downloads + day.downloads,
          installs: acc.installs + day.installs,
          sessions: acc.sessions + day.sessions,
          forks: acc.forks + day.forks,
          reviews: acc.reviews + day.reviews
        }), { views:0, downloads:0, installs:0, sessions:0, forks:0, reviews:0 })
        return totals
      })
    ])

    const dashboard = {
      appId,
      overview: {
        ...metrics,
        dau,
        mau,
        stickiness: stickiness.stickiness
      },
      timeline,
      recentEvents: events.slice(0, 10),
      generatedAt: new Date().toISOString()
    }

    await cache?.set(cacheKey, dashboard, 5 * 60 * 1000) // 5 minutes
    return dashboard
  }

  /**
   * Récupère les applications les plus actives
   */
  async getTopApps(limit = 10, metric = 'installs') {
    const cacheKey = `top:${metric}:${limit}`
    
    const cached = await cache?.get(cacheKey)
    if (cached) return cached

    if (this.dailyAggregator) {
      const allMetrics = []
      for (const appId of this.appIndex.keys()) {
        const metrics = await this.dailyAggregator.getMetrics(appId, 'month')
        const total = metrics.reduce((sum, day) => sum + (day[metric] || 0), 0)
        allMetrics.push({
          appId,
          total,
          ...metrics[metrics.length - 1]
        })
      }

      const result = allMetrics
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)

      await cache?.set(cacheKey, result, 30 * 60 * 1000)
      return result
    }

    // Fallback
    const appStats = new Map()

    for (const event of this.events) {
      const stats = appStats.get(event.appId) || {
        appId: event.appId,
        total: 0,
        views: 0,
        downloads: 0,
        installs: 0,
        sessions: 0,
        forks: 0,
        reviews: 0
      }

      stats.total++
      stats[event.type] = (stats[event.type] || 0) + 1
      appStats.set(event.appId, stats)
    }

    const result = Array.from(appStats.values())
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, limit)

    await cache?.set(cacheKey, result, 30 * 60 * 1000)
    return result
  }

  /**
   * Sauvegarde un événement (compatibilité)
   */
  async saveEvent(event) {
    return this.track(
      event.type,
      event.appId,
      event.userId,
      event.data,
      event.metadata
    )
  }

  /**
   * Récupère les métriques quotidiennes
   */
  async getDailyMetrics(appId, period = 'month') {
    if (this.dailyAggregator) {
      return this.dailyAggregator.getMetrics(appId, period)
    }
    return []
  }

  /**
   * Sauvegarde les métriques quotidiennes
   */
  async saveDailyMetrics(appId, date, metrics) {
    if (this.dailyAggregator) {
      this.dailyAggregator.cache.set(`daily:${appId}:${date}`, metrics)
    }
  }

  /**
   * Nettoie les anciennes données
   */
  async cleanup(olderThan = null) {
    const cutoff = olderThan || Date.now() - this.retentionDays * 24 * 60 * 60 * 1000
    const before = this.events.length

    this.events = this.events.filter(event => {
      const keep = new Date(event.timestamp).getTime() > cutoff
      if (!keep) {
        this._removeFromIndexes(event)
        this.stats.totalEvents--
      }
      return keep
    })

    this.stats.eventsInMemory = this.events.length
    this.stats.oldestEvent = this.events[0]?.timestamp || null

    if (this.dailyAggregator) {
      this.dailyAggregator.clearCache()
    }

    const cleaned = before - this.events.length
    if (cleaned > 0) {
      this.logger.info(`${cleaned} événements nettoyés`)
    }

    return cleaned
  }

  /**
   * Récupère les statistiques du service
   */
  getStats() {
    return {
      ...this.stats,
      buffer: this.buffer?.getStats() || null,
      aggregatesSize: this.aggregates.size,
      retentionDays: this.retentionDays,
      storageConfigured: !!this.storage,
      rateLimit: {
        limited: this.stats.rateLimited,
        deduplicated: this.stats.deduplicated
      }
    }
  }

  /**
   * Force le flush du buffer
   */
  async flush() {
    if (this.buffer) {
      await this.buffer.forceFlush()
    }
  }

  /**
   * Arrête le service
   */
  async shutdown() {
    await this._aggregate()
    if (this.buffer) {
      await this.buffer.forceFlush()
    }
    this.removeAllListeners()
    this.logger.info('Service events arrêté')
  }
}

// =============================
// SINGLETON EXPORT
// =============================

let eventsServiceInstance = null

export const initializeEventsService = (storage) => {
  if (!eventsServiceInstance) {
    eventsServiceInstance = new EventsService(storage)
  }
  return eventsServiceInstance
}

export const getEventsService = () => {
  if (!eventsServiceInstance) {
    throw new Error('EventsService non initialisé')
  }
  return eventsServiceInstance
}

export const eventsService = new EventsService()
export default eventsService
