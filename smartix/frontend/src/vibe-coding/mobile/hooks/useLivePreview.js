/**
 * useLivePreview - Hook React pour le live preview mobile
 * 
 * Rôle: Interface React pour le module livePreview
 * - Démarrage/arrêt de session preview
 * - Connexion WebSocket avec reconnexion auto
 * - Gestion des appareils connectés
 * - Push des mises à jour avec debounce
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { livePreview } from '../core/livePreview'
import { previewServer } from '../server/previewServer'
import { deviceManager } from '../core/deviceManager'
import { logger } from '../utils/logger'

// =============================
// CONSTANTES
// =============================

const PREVIEW_STATUS = {
  IDLE: 'idle',
  STARTING: 'starting',
  ACTIVE: 'active',
  RECONNECTING: 'reconnecting',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error'
}

const RECONNECT_DELAY = 2000 // 2 secondes
const PING_INTERVAL = 30000 // 30 secondes
const UPDATE_DEBOUNCE = 500 // 500ms

// =============================
// HOOK PRINCIPAL
// =============================

export const useLivePreview = (projectId, options = {}) => {
  const {
    autoStart = false,
    port = 3000,
    onDeviceConnected,
    onDeviceDisconnected,
    onUpdateSent,
    onError
  } = options

  const [state, setState] = useState({
    status: PREVIEW_STATUS.IDLE,
    sessionId: null,
    previewUrl: null,
    mobilePreviewUrl: null,
    qrCode: null,
    wsUrl: null,
    port: null,
    expiresAt: null,
    reconnectAttempt: 0,
    error: null
  })

  const [connectedDevices, setConnectedDevices] = useState([])
  const [deviceCount, setDeviceCount] = useState(0)
  const [stats, setStats] = useState(null)
  const [updatesSent, setUpdatesSent] = useState(0)
  
  const mountedRef = useRef(true)
  const wsRef = useRef(null)
  const pingIntervalRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const statsIntervalRef = useRef(null)
  const expiryTimerRef = useRef(null)
  const updateQueueRef = useRef([])
  const updateTimerRef = useRef(null)

  // =============================
  // UTILITAIRES
  // =============================

  const updateDeviceCount = useCallback((delta) => {
    setDeviceCount(prev => Math.max(0, prev + delta))
  }, [])

  const addConnectedDevice = useCallback((clientId, deviceInfo) => {
    setConnectedDevices(prev => {
      const exists = prev.find(d => d.clientId === clientId)
      if (exists) return prev
      return [...prev, { clientId, ...deviceInfo }]
    })
  }, [])

  const removeConnectedDevice = useCallback((clientId) => {
    setConnectedDevices(prev => prev.filter(d => d.clientId !== clientId))
  }, [])

  // =============================
  // GESTIONNAIRES D'ÉVÉNEMENTS
  // =============================

  const handleDeviceConnected = useCallback(({ sessionId, clientId, deviceInfo }) => {
    if (!mountedRef.current) return
    if (sessionId !== state.sessionId) return

    addConnectedDevice(clientId, deviceInfo)
    updateDeviceCount(1)
    onDeviceConnected?.({ clientId, deviceInfo })
  }, [state.sessionId, addConnectedDevice, updateDeviceCount, onDeviceConnected])

  const handleDeviceDisconnected = useCallback(({ sessionId, clientId }) => {
    if (!mountedRef.current) return
    if (sessionId !== state.sessionId) return

    removeConnectedDevice(clientId)
    updateDeviceCount(-1)
    onDeviceDisconnected?.({ clientId })
  }, [state.sessionId, removeConnectedDevice, updateDeviceCount, onDeviceDisconnected])

  const handleUpdateSent = useCallback(({ sessionId, sentCount, changes }) => {
    if (!mountedRef.current) return
    if (sessionId !== state.sessionId) return

    setUpdatesSent(prev => prev + 1)
    onUpdateSent?.({ sentCount, changes })
  }, [state.sessionId, onUpdateSent])

  // =============================
  // CONNEXION WEBSOCKET
  // =============================

  const connectWebSocket = useCallback((wsUrl, sessionId) => {
    if (!wsUrl || !sessionId) return

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return

        logger.info('WebSocket monitoring connecté')
        
        setState(prev => ({ 
          ...prev, 
          status: PREVIEW_STATUS.ACTIVE,
          reconnectAttempt: 0 
        }))

        // Envoyer un message d'identification
        ws.send(JSON.stringify({
          type: 'monitor',
          sessionId,
          timestamp: Date.now()
        }))

        // Ping régulier
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
        }
        
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, PING_INTERVAL)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'device:connected') {
            logger.info(`Appareil connecté`, data)
          }
          
          if (data.type === 'device:disconnected') {
            logger.info(`Appareil déconnecté`, data)
          }
        } catch (error) {
          logger.warn('Erreur parsing message WebSocket', error)
        }
      }

      ws.onerror = (error) => {
        if (!mountedRef.current) return
        logger.error('Erreur WebSocket monitoring', error)
      }

      ws.onclose = () => {
        if (!mountedRef.current) return

        logger.warn('WebSocket monitoring déconnecté')
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Reconnexion automatique si la session est toujours active
        if (state.status === PREVIEW_STATUS.ACTIVE && mountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            status: PREVIEW_STATUS.RECONNECTING,
            reconnectAttempt: prev.reconnectAttempt + 1
          }))

          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
          }

          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connectWebSocket(wsUrl, sessionId)
            }
          }, RECONNECT_DELAY)
        }
      }

    } catch (error) {
      logger.error('Erreur connexion WebSocket', error)
    }
  }, [state.status])

  // =============================
  // GESTION EXPIRATION
  // =============================

  useEffect(() => {
    if (!state.expiresAt) return

    const timeLeft = state.expiresAt - Date.now()
    
    if (timeLeft <= 0) {
      stopPreview()
      return
    }

    expiryTimerRef.current = setTimeout(() => {
      stopPreview()
    }, timeLeft)

    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current)
      }
    }
  }, [state.expiresAt])

  // =============================
  // NETTOYAGE
  // =============================
  useEffect(() => {
    return () => {
      mountedRef.current = false
      
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
        statsIntervalRef.current = null
      }

      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current)
        expiryTimerRef.current = null
      }

      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
        updateTimerRef.current = null
      }
    }
  }, [])

  // =============================
  // AUTO-START
  // =============================
  useEffect(() => {
    if (!projectId || !autoStart) return

    startPreview()

    return () => {
      stopPreview()
    }
  }, [projectId, autoStart, startPreview, stopPreview])

  // =============================
  // ÉCOUTEURS D'ÉVÉNEMENTS
  // =============================
  useEffect(() => {
    if (!projectId) return

    livePreview.on('device:connected', handleDeviceConnected)
    livePreview.on('device:disconnected', handleDeviceDisconnected)
    livePreview.on('update:sent', handleUpdateSent)

    return () => {
      livePreview.off('device:connected', handleDeviceConnected)
      livePreview.off('device:disconnected', handleDeviceDisconnected)
      livePreview.off('update:sent', handleUpdateSent)
    }
  }, [projectId, handleDeviceConnected, handleDeviceDisconnected, handleUpdateSent])

  // =============================
  // MISE À JOUR STATS
  // =============================
  useEffect(() => {
    if (state.status !== PREVIEW_STATUS.ACTIVE) return

    const updateStats = () => {
      if (!mountedRef.current) return

      const serverInfo = previewServer.getServerInfo(state.sessionId)
      const deviceStats = deviceManager.getStats()
      
      setStats({
        server: serverInfo,
        devices: deviceStats,
        uptime: serverInfo ? Date.now() - serverInfo.startedAt : 0
      })
    }

    statsIntervalRef.current = setInterval(updateStats, deviceCount > 0 ? 2000 : 5000)
    updateStats()

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
      }
    }
  }, [state.status, state.sessionId, deviceCount])

  // =============================
  // DÉMARRAGE PREVIEW
  // =============================
  const startPreview = useCallback(async (customOptions = {}) => {
    if (!projectId) {
      const error = new Error('projectId requis')
      setState(prev => ({ ...prev, status: PREVIEW_STATUS.ERROR, error }))
      onError?.(error)
      return
    }

    try {
      setState(prev => ({ 
        ...prev, 
        status: PREVIEW_STATUS.STARTING,
        error: null 
      }))

      const result = await livePreview.startSession(projectId, {
        port: customOptions.port || port,
        expiresIn: customOptions.expiresIn || 60 * 60 * 1000
      })

      if (!mountedRef.current) return

      const mobilePreviewUrl = `${result.previewUrl}?mobile=true`

      setState({
        status: PREVIEW_STATUS.ACTIVE,
        sessionId: result.sessionId,
        previewUrl: result.previewUrl,
        mobilePreviewUrl,
        qrCode: result.qrCode,
        wsUrl: result.wsUrl,
        port: result.port,
        expiresAt: result.expiresAt,
        reconnectAttempt: 0,
        error: null
      })

      // Connexion WebSocket pour monitoring
      connectWebSocket(result.wsUrl, result.sessionId)

      logger.info(`Preview démarrée`, {
        sessionId: result.sessionId,
        previewUrl: result.previewUrl,
        mobileUrl: mobilePreviewUrl
      })

    } catch (error) {
      if (!mountedRef.current) return

      setState(prev => ({
        ...prev,
        status: PREVIEW_STATUS.ERROR,
        error: error.message
      }))

      logger.error('Erreur démarrage preview', error)
      onError?.(error)
    }
  }, [projectId, port, connectWebSocket, onError])

  // =============================
  // ARRÊT PREVIEW
  // =============================
  const stopPreview = useCallback(async () => {
    if (!projectId) return

    try {
      setState(prev => ({ ...prev, status: PREVIEW_STATUS.STOPPING }))

      await livePreview.stopSession(projectId)

      if (!mountedRef.current) return

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      setState(prev => ({
        ...prev,
        status: PREVIEW_STATUS.STOPPED,
        sessionId: null,
        previewUrl: null,
        mobilePreviewUrl: null,
        qrCode: null,
        wsUrl: null
      }))

      setConnectedDevices([])
      setDeviceCount(0)

      logger.info(`Preview arrêtée`)

    } catch (error) {
      if (!mountedRef.current) return

      setState(prev => ({
        ...prev,
        status: PREVIEW_STATUS.ERROR,
        error: error.message
      }))

      logger.error('Erreur arrêt preview', error)
      onError?.(error)
    }
  }, [projectId, onError])

  // =============================
  // ENVOI MISE À JOUR (AVEC DEBOUNCE)
  // =============================
  const pushUpdate = useCallback(async (changes) => {
    if (!projectId || state.status !== PREVIEW_STATUS.ACTIVE) {
      throw new Error('Aucune session active')
    }

    // Ajouter à la queue
    updateQueueRef.current.push(changes)

    // Debounce l'envoi
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current)
    }

    return new Promise((resolve) => {
      updateTimerRef.current = setTimeout(async () => {
        try {
          // Fusionner les changements
          const mergedChanges = updateQueueRef.current.reduce((acc, curr) => {
            return { ...acc, ...curr }
          }, {})

          updateQueueRef.current = []

          const result = await livePreview.pushUpdate(projectId, mergedChanges)
          resolve(result)
        } catch (error) {
          logger.error('Erreur envoi mise à jour', error)
          throw error
        }
      }, UPDATE_DEBOUNCE)
    })
  }, [projectId, state.status])

  // =============================
  // AUTRES FONCTIONS
  // =============================

  const refreshDevices = useCallback(async () => {
    if (!projectId || state.status !== PREVIEW_STATUS.ACTIVE) return

    const devices = livePreview.getConnectedDevices(projectId)
    setConnectedDevices(devices)
    setDeviceCount(devices.length)
  }, [projectId, state.status])

  const isSessionActive = useCallback(() => {
    return livePreview.isSessionActive(projectId)
  }, [projectId])

  const extendSession = useCallback(async (duration) => {
    if (!state.sessionId) return false

    try {
      const result = await livePreview.extendSession(state.sessionId, duration)
      if (result) {
        const session = livePreview.getSessionInfo(state.sessionId)
        setState(prev => ({ ...prev, expiresAt: session.expiresAt }))
      }
      return result
    } catch (error) {
      logger.error('Erreur prolongation session', error)
      return false
    }
  }, [state.sessionId])

  return {
    // État
    state,
    connectedDevices,
    deviceCount,
    updatesSent,
    stats,
    isIdle: state.status === PREVIEW_STATUS.IDLE,
    isStarting: state.status === PREVIEW_STATUS.STARTING,
    isActive: state.status === PREVIEW_STATUS.ACTIVE,
    isReconnecting: state.status === PREVIEW_STATUS.RECONNECTING,
    isStopping: state.status === PREVIEW_STATUS.STOPPING,
    isStopped: state.status === PREVIEW_STATUS.STOPPED,
    isError: state.status === PREVIEW_STATUS.ERROR,

    // Actions
    startPreview,
    stopPreview,
    pushUpdate,
    refreshDevices,
    isSessionActive,
    extendSession,

    // Utilitaires
    sessionId: state.sessionId,
    previewUrl: state.previewUrl,
    mobilePreviewUrl: state.mobilePreviewUrl,
    qrCode: state.qrCode,
    wsUrl: state.wsUrl,
    reconnectAttempt: state.reconnectAttempt,
    error: state.error
  }
}

export default useLivePreview
