/**
 * useAnalytics - Hook React pour les analytics
 * Version PRO avec cache, context provider et optimisations
 * 
 * Rôle: Interface React pour le module analytics
 * - Suivi des événements avec batching
 * - Métriques d'application avec TTL
 * - Tableaux de bord interactifs
 * - Export de données
 * - Live events avec websocket
 */

import { useState, useEffect, useCallback, useMemo, useRef, startTransition, useContext, createContext } from 'react'
import { 

  trackEvent,
  trackView,
  trackDownload,
  trackInstall,
  trackSession,
  trackUninstall,
  getAppMetrics,
  getAppDashboard,
  getActiveUsers,
  getRetentionRate,
  getConversionRate,
  getFunnel,
  getStickiness,
  getDAU,
  getMAU,
  exportAnalytics,
  getGlobalStats,
  getTopApps,
  EVENTS,
  PERIODS,
  METRICS
} from '../analytics'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const METRICS_REFRESH = 60 * 1000 // 1 minute
const DASHBOARD_REFRESH = 5 * 60 * 1000 // 5 minutes
const LIVE_EVENTS_LIMIT = 50
const EVENT_BATCH_SIZE = 10
const EVENT_BATCH_INTERVAL = 2000 // 2 secondes

// 🔥 TTL différenciés
const CACHE_TTL = {
  METRICS: 60 * 1000,      // 1 minute
  DASHBOARD: 5 * 60 * 1000, // 5 minutes
  ACTIVE_USERS: 30 * 1000,  // 30 secondes
  RETENTION: 60 * 60 * 1000, // 1 heure
  CONVERSION: 5 * 60 * 1000, // 5 minutes
  GLOBAL: 5 * 60 * 1000
}

// =============================
// CACHE GLOBAL
// =============================

class AnalyticsCache {
  constructor() {
    this.cache = new Map()
  }

  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  set(key, data, ttl) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  invalidate(key) {
    this.cache.delete(key)
  }

  invalidatePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clear() {
    this.cache.clear()
  }
}

let globalAnalyticsCache

if (typeof window !== 'undefined' && !globalAnalyticsCache) {
  globalAnalyticsCache = new AnalyticsCache()
}

const cache = globalAnalyticsCache || new AnalyticsCache()

// =============================
// CONTEXT PROVIDER
// =============================

const AnalyticsContext = createContext(null)

export const AnalyticsProvider = ({ children, appId = null, userId = null, options = {} }) => {
  const analytics = useAnalytics(appId, userId, options)
  
  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export const useAnalyticsContext = () => {
  const context = useContext(AnalyticsContext)
  if (!context) {
    throw new Error('useAnalyticsContext must be used within AnalyticsProvider')
  }
  return context
}

// =============================
// EVENT BATCHER
// =============================

class EventBatcher {
  constructor() {
    this.queue = []
    this.timeout = null
  }

  add(event) {
    this.queue.push(event)
    
    if (this.queue.length >= EVENT_BATCH_SIZE) {
      this.flush()
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), EVENT_BATCH_INTERVAL)
    }
  }

  async flush() {
    if (this.queue.length === 0) return

    const events = [...this.queue]
    this.queue = []
    
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    try {
      // Traiter les événements en batch
      await Promise.all(events.map(event => trackEvent(
        event.type,
        event.appId,
        event.userId,
        event.data,
        event.metadata
      )))
    } catch (error) {
      console.error('Error flushing events batch:', error)
    }
  }
}

const eventBatcher = new EventBatcher()

// =============================
// HOOK PRINCIPAL
// =============================

export const useAnalytics = (appId = null, userId = null, options = {}) => {
  const {
    initialLoad = true,
    autoRefresh = true,
    cacheResults = true,
    batchEvents = true
  } = options

  const [metrics, setMetrics] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [activeUsers, setActiveUsers] = useState(0)
  const [retention, setRetention] = useState([])
  const [conversion, setConversion] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [stickiness, setStickiness] = useState(null)
  const [dau, setDau] = useState(0)
  const [mau, setMau] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('month')
  const [liveEvents, setLiveEvents] = useState([])

  const abortControllerRef = useRef(null)
  const mountedRef = useRef(true)
  const refreshIntervalRef = useRef(null)

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // =============================
  // CHARGEMENT DES DONNÉES
  // =============================

  useEffect(() => {
    if (!appId || !initialLoad) return

    loadAllData()

    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadAllData({ silent: true })
      }, METRICS_REFRESH)
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [appId, period, autoRefresh, initialLoad])

  // =============================
  // FONCTIONS DE CHARGEMENT AVEC CACHE
  // =============================

  const loadMetrics = useCallback(async (options = {}) => {
    const { silent = false, forceRefresh = false } = options

    if (!appId) return

    if (!silent) setLoading(true)

    try {
      const cacheKey = `metrics:${appId}:${period}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setMetrics(cached)
          if (!silent) setLoading(false)
          return cached
        }
      }

      cancelPendingRequests()
      abortControllerRef.current = new AbortController()

      const data = await getAppMetrics(appId, period, {
        signal: abortControllerRef.current.signal
      })

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, data, CACHE_TTL.METRICS)
      }

      if (mountedRef.current) {
        startTransition(() => {
          setMetrics(data)
        })
      }

      return data
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        console.error('Erreur chargement métriques:', err)
        setError(err.message)
      }
    } finally {
      if (!silent && mountedRef.current) setLoading(false)
    }
  }, [appId, period, cacheResults])

  const loadDashboard = useCallback(async (options = {}) => {
    const { forceRefresh = false } = options

    if (!appId) return

    try {
      const cacheKey = `dashboard:${appId}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setDashboard(cached)
          return cached
        }
      }

      const data = await getAppDashboard(appId)

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, data, CACHE_TTL.DASHBOARD)
      }

      if (mountedRef.current) {
        setDashboard(data)
      }

      return data
    } catch (err) {
      console.error('Erreur chargement dashboard:', err)
    }
  }, [appId, cacheResults])

  const loadActiveUsers = useCallback(async (options = {}) => {
    const { forceRefresh = false } = options

    try {
      const cacheKey = `active:${period}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setActiveUsers(cached)
          return cached
        }
      }

      const count = await getActiveUsers(period)

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, count, CACHE_TTL.ACTIVE_USERS)
      }

      if (mountedRef.current) {
        setActiveUsers(count)
      }

      return count
    } catch (err) {
      console.error('Erreur chargement utilisateurs actifs:', err)
    }
  }, [period, cacheResults])

  const loadRetention = useCallback(async (options = {}) => {
    const { forceRefresh = false } = options

    if (!appId) return

    try {
      const cacheKey = `retention:${appId}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setRetention(cached)
          return cached
        }
      }

      const data = await getRetentionRate(appId, 30)

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, data, CACHE_TTL.RETENTION)
      }

      if (mountedRef.current) {
        setRetention(data)
      }

      return data
    } catch (err) {
      console.error('Erreur chargement rétention:', err)
    }
  }, [appId, cacheResults])

  const loadConversion = useCallback(async (options = {}) => {
    const { forceRefresh = false } = options

    if (!appId) return

    try {
      const cacheKey = `conversion:${appId}:${period}`
      
      if (!forceRefresh && cacheResults) {
        const cached = cache.get(cacheKey)
        if (cached && mountedRef.current) {
          setConversion(cached)
          return cached
        }
      }

      const data = await getConversionRate(appId, period)

      if (cacheResults && mountedRef.current) {
        cache.set(cacheKey, data, CACHE_TTL.CONVERSION)
      }

      if (mountedRef.current) {
        setConversion(data)
      }

      return data
    } catch (err) {
      console.error('Erreur chargement conversion:', err)
    }
  }, [appId, period, cacheResults])

  const loadFunnel = useCallback(async () => {
    if (!appId) return

    try {
      const data = await getFunnel(appId, period)
      if (mountedRef.current) {
        setFunnel(data)
      }
    } catch (err) {
      console.error('Erreur chargement funnel:', err)
    }
  }, [appId, period])

  const loadStickiness = useCallback(async () => {
    if (!appId) return

    try {
      const data = await getStickiness(appId)
      if (mountedRef.current) {
        setStickiness(data)
      }
    } catch (err) {
      console.error('Erreur chargement stickiness:', err)
    }
  }, [appId])

  const loadDAU = useCallback(async () => {
    if (!appId) return

    try {
      const count = await getDAU(appId)
      if (mountedRef.current) {
        setDau(count)
      }
    } catch (err) {
      console.error('Erreur chargement DAU:', err)
    }
  }, [appId])

  const loadMAU = useCallback(async () => {
    if (!appId) return

    try {
      const count = await getMAU(appId)
      if (mountedRef.current) {
        setMau(count)
      }
    } catch (err) {
      console.error('Erreur chargement MAU:', err)
    }
  }, [appId])

  const loadAllData = useCallback(async (options = {}) => {
    await Promise.allSettled([
      loadMetrics(options),
      loadDashboard(options),
      loadActiveUsers(options),
      loadRetention(options),
      loadConversion(options),
      loadFunnel(),
      loadStickiness(),
      loadDAU(),
      loadMAU()
    ])
  }, [loadMetrics, loadDashboard, loadActiveUsers, loadRetention, loadConversion, loadFunnel, loadStickiness, loadDAU, loadMAU])

  const cancelPendingRequests = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  // =============================
  // ACTIONS DE TRACKING
  // =============================

  const track = useCallback(async (type, data = {}, metadata = {}) => {
    if (!appId) return

    const event = {
      type,
      appId,
      userId,
      data,
      metadata,
      timestamp: new Date().toISOString()
    }

    // Ajouter aux live events
    if (mountedRef.current) {
      setLiveEvents(prev => [event, ...prev].slice(0, LIVE_EVENTS_LIMIT))
    }

    // Batching ou direct
    if (batchEvents) {
      eventBatcher.add(event)
    } else {
      try {
        const result = await trackEvent(type, appId, userId, data, metadata)
        // Rafraîchir les métriques après tracking
        loadMetrics({ silent: true })
        return result
      } catch (err) {
        setError(err.message)
        throw err
      }
    }
  }, [appId, userId, batchEvents])

  const view = useCallback(async (metadata = {}) => {
    return track(EVENTS.VIEW, {}, metadata)
  }, [track])

  const download = useCallback(async (metadata = {}) => {
    return track(EVENTS.DOWNLOAD, {}, metadata)
  }, [track])

  const install = useCallback(async (metadata = {}) => {
    return track(EVENTS.INSTALL, {}, metadata)
  }, [track])

  const uninstall = useCallback(async (metadata = {}) => {
    return track(EVENTS.UNINSTALL, {}, metadata)
  }, [track])

  const session = useCallback(async (duration = null, metadata = {}) => {
    return track(EVENTS.SESSION, { duration }, metadata)
  }, [track])

  // =============================
  // EXPORT
  // =============================

  const exportData = useCallback(async (format = 'json', options = {}) => {
    if (!appId) return null

    try {
      return await exportAnalytics(appId, format, {
        period,
        ...options
      })
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [appId, period])

  // =============================
  // RAFRAÎCHISSEMENT
  // =============================

  const refresh = useCallback(() => {
    loadAllData({ forceRefresh: true })
  }, [loadAllData])

  const invalidateCache = useCallback(() => {
    if (appId) {
      cache.invalidatePattern(appId)
    }
  }, [appId])

  // =============================
  // MÉTRIQUES DÉRIVÉES
  // =============================

  const trends = useMemo(() => {
    if (!metrics?.timeline || metrics.timeline.length < 2) return {}

    const last = metrics.timeline[metrics.timeline.length - 1]
    const prev = metrics.timeline[metrics.timeline.length - 2]

    return {
      views: last?.total - prev?.total || 0,
      downloads: (last?.byType?.download || 0) - (prev?.byType?.download || 0),
      installs: (last?.byType?.install || 0) - (prev?.byType?.install || 0),
      percentage: {
        views: prev?.total ? ((last?.total - prev?.total) / prev?.total) * 100 : 0,
        downloads: prev?.byType?.download 
          ? ((last?.byType?.download - prev?.byType?.download) / prev?.byType?.download) * 100 
          : 0,
        installs: prev?.byType?.install
          ? ((last?.byType?.install - prev?.byType?.install) / prev?.byType?.install) * 100
          : 0
      }
    }
  }, [metrics])

  const summary = useMemo(() => {
    return {
      dau,
      mau,
      stickiness: stickiness?.stickiness || 0,
      retentionDay1: retention[0]?.percentage || 0,
      retentionDay7: retention[6]?.percentage || 0,
      retentionDay30: retention[29]?.percentage || 0,
      conversionRate: conversion?.rate || 0,
      funnel: funnel?.conversion || {}
    }
  }, [dau, mau, stickiness, retention, conversion, funnel])

  return {
    // États
    metrics,
    dashboard,
    activeUsers,
    retention,
    conversion,
    funnel,
    stickiness,
    dau,
    mau,
    trends,
    summary,
    loading,
    error,
    period,
    liveEvents,

    // Actions de tracking
    track,
    view,
    download,
    install,
    uninstall,
    session,

    // Actions
    setPeriod,
    refresh,
    invalidateCache,
    exportData,
    cancelRequests: cancelPendingRequests,

    // Utilitaires
    hasData: metrics?.total > 0,
    viewsTotal: metrics?.totals?.views || 0,
    downloadsTotal: metrics?.totals?.downloads || 0,
    installsTotal: metrics?.totals?.installs || 0,
    uniqueUsers: metrics?.uniqueUsers || 0
  }
}

// =============================
// HOOK POUR LE TABLEAU DE BORD
// =============================

export const useAnalyticsDashboard = (appId, options = {}) => {
  const {
    initialTimeRange = '30d',
    initialChartType = 'line',
    initialMetrics = ['views', 'downloads', 'installs']
  } = options

  const [timeRange, setTimeRange] = useState(initialTimeRange)
  const [chartType, setChartType] = useState(initialChartType)
  const [selectedMetrics, setSelectedMetrics] = useState(initialMetrics)

  const analytics = useAnalytics(appId, null, {
    autoRefresh: true,
    ...options
  })

  const chartData = useMemo(() => {
    if (!analytics.dashboard?.timeline) return []

    return analytics.dashboard.timeline.map(day => ({
      date: day.date,
      ...selectedMetrics.reduce((acc, metric) => ({
        ...acc,
        [metric]: day.byType[metric] || 0
      }), {})
    }))
  }, [analytics.dashboard, JSON.stringify(selectedMetrics)])

  const metricsList = useMemo(() => {
    return selectedMetrics.map(metric => ({
      name: metric,
      total: analytics[`${metric}Total`] || 0,
      trend: analytics.trends?.percentage?.[metric] || 0
    }))
  }, [selectedMetrics, analytics])

  return {
    ...analytics,
    chartData,
    metricsList,
    timeRange,
    setTimeRange,
    chartType,
    setChartType,
    selectedMetrics,
    setSelectedMetrics
  }
}

// =============================
// HOOK POUR LE SUIVI EN DIRECT
// =============================

export const useLiveAnalytics = (appId, options = {}) => {
  const {
    maxEvents = 50,
    autoConnect = true
  } = options

  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState({
    views: 0,
    downloads: 0,
    installs: 0,
    sessions: 0
  })

  const analytics = useAnalytics(appId, null)

  // Simuler une connexion WebSocket
  useEffect(() => {
    if (!appId || !autoConnect) return

    setConnected(true)

    const interval = setInterval(() => {
      const eventTypes = ['view', 'download', 'install', 'session']
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      
      const newEvent = {
        id: `live-${Date.now()}`,
        type: randomType,
        timestamp: new Date().toISOString(),
        data: {}
      }

      setEvents(prev => [newEvent, ...prev].slice(0, maxEvents))
      setStats(prev => ({
        ...prev,
        [randomType]: prev[randomType] + 1
      }))
    }, 3000)

    return () => {
      clearInterval(interval)
      setConnected(false)
    }
  }, [appId, autoConnect, maxEvents])

  const eventsByMinute = useMemo(() => {
    const now = Date.now()
    const minute = 60 * 1000
    
    return events.filter(e => 
      now - new Date(e.timestamp).getTime() < minute
    ).length
  }, [events])

  return {
    ...analytics,
    liveEvents: events,
    liveStats: stats,
    connected,
    eventsPerMinute: eventsByMinute,
    reconnect: () => {
      setConnected(true)
    }
  }
}

// =============================
// HOOK POUR LES STATISTIQUES GLOBALES
// =============================

export const useGlobalAnalytics = () => {
  const [globalStats, setGlobalStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadGlobalStats()
  }, [])

  const loadGlobalStats = async () => {
    setLoading(true)
    try {
      const { getGlobalStats } = await import('../analytics')
      const stats = await getGlobalStats()
      setGlobalStats(stats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const topApps = useMemo(() => {
    return globalStats?.topApps || []
  }, [globalStats])

  return {
    globalStats,
    topApps,
    loading,
    error,
    refresh: loadGlobalStats
  }
}

export default useAnalytics
AnalyticsProvider.propTypes = {
  children: PropTypes.node.isRequired,
  appId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  options: PropTypes.object,
};
