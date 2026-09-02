/**
 * useDeviceManager - Hook React pour la gestion des appareils
 * 
 * Rôle: Interface React pour le module deviceManager
 * - Liste des appareils connectés
 * - Statistiques en temps réel
 * - Gestion des appareils bloqués
 * - Historique des connexions
 * - Filtres et tris
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { deviceManager } from '../core/deviceManager'
import { deviceSessions } from '../sessions/deviceSessions'
import { logger } from '../utils/logger'

// =============================
// CONSTANTES
// =============================

const REFRESH_INTERVAL = 5000 // 5 secondes
const MAX_HISTORY_ITEMS = 50
const DEBOUNCE_DELAY = 300 // 300ms
const ACTIVE_THRESHOLD = 60000 // 1 minute

// =============================
// HOOK PRINCIPAL
// =============================

export const useDeviceManager = (options = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = REFRESH_INTERVAL,
    onDeviceConnected,
    onDeviceDisconnected,
    onDeviceBlocked,
    onDeviceUnblocked,
    initialFilter = null
  } = options

  const [devices, setDevices] = useState([])
  const [connectedDevices, setConnectedDevices] = useState([])
  const [blockedDevices, setBlockedDevices] = useState([])
  const [stats, setStats] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [filter, setFilter] = useState(initialFilter)

  const mountedRef = useRef(true)
  const refreshTimerRef = useRef(null)
  const refreshDebounceRef = useRef(null)
  const historyRef = useRef([])

  // =============================
  // NETTOYAGE AU DÉMONTAGE
  // =============================
  useEffect(() => {
    return () => {
      mountedRef.current = false
      
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
        refreshDebounceRef.current = null
      }
    }
  }, [])

  // =============================
  // CHARGEMENT DES DONNÉES
  // =============================

  const loadData = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      // Récupérer les appareils
      const allDevices = deviceManager.getRecentDevices?.() || []
      const connected = deviceManager.getConnectedDevices?.() || []
      
      // Récupérer les appareils bloqués via une méthode dédiée
      const blockedIds = deviceSessions.getBlockedDevices?.() || []
      const blocked = blockedIds
        .map(id => deviceManager.getDevice(id))
        .filter(Boolean)

      // Récupérer les stats
      const deviceStats = deviceManager.getStats?.() || {}
      const deviceMetrics = deviceSessions.getMetrics?.() || {}

      if (!mountedRef.current) return

      setDevices(allDevices)
      setConnectedDevices(connected)
      setBlockedDevices(blocked)
      setStats(deviceStats)
      setMetrics(deviceMetrics)
      setLastUpdate(Date.now())
      setError(null)

    } catch (err) {
      if (!mountedRef.current) return
      logger.error('Erreur chargement appareils', err)
      setError(err.message)
    }
  }, [])

  // =============================
  // DEBOUNCE REFRESH
  // =============================

  const scheduleRefresh = useCallback(() => {
    if (refreshDebounceRef.current) return

    refreshDebounceRef.current = setTimeout(() => {
      loadData()
      refreshDebounceRef.current = null
    }, DEBOUNCE_DELAY)
  }, [loadData])

  // =============================
  // HISTORIQUE
  // =============================

  const addToHistory = useCallback((entry) => {
    const historyEntry = {
      id: `${Date.now()}_${entry.deviceId}_${Math.random().toString(36).substr(2, 4)}`,
      ...entry,
      timestamp: Date.now()
    }

    historyRef.current = [historyEntry, ...historyRef.current].slice(0, MAX_HISTORY_ITEMS)
    setHistory(historyRef.current)
  }, [])

  // =============================
  // EFFET DE RAFRAÎCHISSEMENT
  // =============================

  useEffect(() => {
    if (!autoRefresh) return

    loadData()

    const updateInterval = connectedDevices.length > 0
      ? refreshInterval
      : refreshInterval * 2

    refreshTimerRef.current = setInterval(() => {
      loadData()
    }, updateInterval)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [autoRefresh, refreshInterval, loadData, connectedDevices.length])

  // =============================
  // ÉCOUTEURS D'ÉVÉNEMENTS
  // =============================

  useEffect(() => {
    const handleDeviceRegistered = (device) => {
      if (!mountedRef.current) return

      addToHistory({
        type: 'registered',
        deviceId: device.id,
        model: device.model,
        platform: device.platform
      })

      scheduleRefresh()
      onDeviceConnected?.(device)
    }

    const handleDeviceDisconnected = (device) => {
      if (!mountedRef.current) return

      addToHistory({
        type: 'disconnected',
        deviceId: device.id,
        model: device.model
      })

      scheduleRefresh()
      onDeviceDisconnected?.(device)
    }

    const handleDeviceBlocked = ({ deviceId, reason }) => {
      if (!mountedRef.current) return

      addToHistory({
        type: 'blocked',
        deviceId,
        reason
      })

      scheduleRefresh()
      onDeviceBlocked?.({ deviceId, reason })
    }

    const handleDeviceUnblocked = ({ deviceId }) => {
      if (!mountedRef.current) return

      addToHistory({
        type: 'unblocked',
        deviceId
      })

      scheduleRefresh()
      onDeviceUnblocked?.({ deviceId })
    }

    deviceManager.on('device:registered', handleDeviceRegistered)
    deviceManager.on('device:disconnected', handleDeviceDisconnected)
    deviceSessions.on('device:blocked', handleDeviceBlocked)
    deviceSessions.on('device:unblocked', handleDeviceUnblocked)

    return () => {
      deviceManager.off('device:registered', handleDeviceRegistered)
      deviceManager.off('device:disconnected', handleDeviceDisconnected)
      deviceSessions.off('device:blocked', handleDeviceBlocked)
      deviceSessions.off('device:unblocked', handleDeviceUnblocked)
    }
  }, [addToHistory, scheduleRefresh, onDeviceConnected, onDeviceDisconnected, onDeviceBlocked, onDeviceUnblocked])

  // =============================
  // FILTRES ET TRIS
  // =============================

  const filteredDevices = useMemo(() => {
    let result = devices

    if (filter) {
      const filterLower = filter.toLowerCase()
      result = result.filter(d => 
        d.model?.toLowerCase().includes(filterLower) ||
        d.platform?.toLowerCase().includes(filterLower) ||
        d.version?.toLowerCase().includes(filterLower) ||
        d.manufacturer?.toLowerCase().includes(filterLower)
      )
    }

    return result
  }, [devices, filter])

  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      const aTime = new Date(a.lastSeen || 0).getTime()
      const bTime = new Date(b.lastSeen || 0).getTime()
      return bTime - aTime
    })
  }, [filteredDevices])

  const activeDevices = useMemo(() => {
    const now = Date.now()
    return devices.filter(d => {
      const lastSeen = new Date(d.lastSeen || 0).getTime()
      return now - lastSeen < ACTIVE_THRESHOLD
    })
  }, [devices])

  // =============================
  // ACTIONS
  // =============================

  /**
   * Rafraîchit manuellement les données
   */
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await loadData()
    } finally {
      setLoading(false)
    }
  }, [loadData])

  /**
   * Bloque un appareil
   */
  const blockDevice = useCallback(async (deviceId, reason = 'manual') => {
    if (!deviceId) {
      return { success: false, error: 'deviceId requis' }
    }

    setLoading(true)
    try {
      await deviceSessions.blockDevice(deviceId, reason)
      await scheduleRefresh()
      return { success: true }
    } catch (err) {
      logger.error('Erreur blocage appareil', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [scheduleRefresh])

  /**
   * Débloque un appareil
   */
  const unblockDevice = useCallback(async (deviceId) => {
    if (!deviceId) {
      return { success: false, error: 'deviceId requis' }
    }

    setLoading(true)
    try {
      await deviceSessions.unblockDevice(deviceId)
      await scheduleRefresh()
      return { success: true }
    } catch (err) {
      logger.error('Erreur déblocage appareil', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [scheduleRefresh])

  /**
   * Récupère les détails d'un appareil
   */
  const getDeviceDetails = useCallback((deviceId) => {
    if (!deviceId) {
      logger.warn('getDeviceDetails: deviceId manquant')
      return null
    }

    const device = deviceManager.getDevice(deviceId)
    
    if (!device) {
      logger.warn(`Appareil introuvable`, { deviceId })
    }

    return device
  }, [])

  /**
   * Récupère l'historique d'un appareil
   */
  const getDeviceHistory = useCallback((deviceId, limit = 10) => {
    return deviceSessions.getDeviceHistory?.(deviceId, limit) || []
  }, [])

  /**
   * Récupère les appareils par session
   */
  const getDevicesBySession = useCallback((sessionId) => {
    return deviceSessions.getSessionDevices(sessionId) || []
  }, [])

  /**
   * Récupère les appareils par plateforme
   */
  const getDevicesByPlatform = useCallback((platform) => {
    return devices.filter(d => d.platform === platform)
  }, [devices])

  /**
   * Récupère les appareils par modèle
   */
  const getDevicesByModel = useCallback((model) => {
    return devices.filter(d => d.model === model)
  }, [devices])

  /**
   * Vérifie si un appareil est bloqué
   */
  const isDeviceBlocked = useCallback((deviceId) => {
    return deviceSessions.isDeviceBlocked(deviceId)
  }, [])

  /**
   * Nettoie l'historique
   */
  const clearHistory = useCallback(() => {
    historyRef.current = []
    setHistory([])
  }, [])

  /**
   * Efface toutes les erreurs
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Définit un filtre
   */
  const setDeviceFilter = useCallback((filterText) => {
    setFilter(filterText || null)
  }, [])

  return {
    // États
    devices: sortedDevices,
    filteredDevices: sortedDevices,
    connectedDevices,
    blockedDevices,
    activeDevices,
    stats,
    metrics,
    history,
    loading,
    error,
    lastUpdate,

    // Actions
    refresh,
    blockDevice,
    unblockDevice,
    getDeviceDetails,
    getDeviceHistory,
    getDevicesBySession,
    getDevicesByPlatform,
    getDevicesByModel,
    isDeviceBlocked,
    clearHistory,
    clearError,
    setDeviceFilter,

    // Utilitaires
    totalDevices: devices.length,
    totalConnected: connectedDevices.length,
    totalBlocked: blockedDevices.length,
    totalActive: activeDevices.length
  }
}

export default useDeviceManager
