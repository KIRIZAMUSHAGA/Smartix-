/**
 * useBuildProgress — Hook WebSocket pour suivre un build en temps réel
 *
 * Usage :
 *   const { logs, progress, status, isConnected } = useBuildProgress(buildId)
 *
 * - `buildId` : null → aucune connexion.  string → connexion au WS backend.
 * - Chaque message MongoDB streamed devient un log ou une mise à jour progress.
 * - Le hook se déconnecte automatiquement sur statut terminal ou démontage.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE_URL } from '../../config/api'

// ─── Calcul de l'URL WebSocket ────────────────────────────────────────────────
// API_BASE_URL est toujours "/api" (relatif). On dérive l'URL ws(s):// depuis window.location.
function getWsUrl(buildId) {
  const base = API_BASE_URL
  if (base.startsWith('/')) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}${base}/builds/ws/${buildId}`
  }
  return base.replace(/^http/, 'ws') + `/builds/ws/${buildId}`
}

// ─── Statuts terminaux ────────────────────────────────────────────────────────
const TERMINAL = new Set(['success', 'failed', 'cancelled'])

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBuildProgress(buildId) {
  const [logs,        setLogs]        = useState([])
  const [progress,    setProgress]    = useState(0)
  const [status,      setStatus]      = useState('pending')
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef(null)

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Reset + reconnexion à chaque nouveau buildId
  useEffect(() => {
    if (!buildId) {
      setLogs([])
      setProgress(0)
      setStatus('pending')
      setIsConnected(false)
      return
    }

    // Réinitialiser pour le nouveau build
    setLogs([])
    setProgress(0)
    setStatus('pending')

    const url = getWsUrl(buildId)
    let ws

    try {
      ws = new WebSocket(url)
    } catch {
      setLogs([{ type: 'error', message: '⚠️ Impossible d\'ouvrir la connexion WebSocket' }])
      setStatus('failed')
      return
    }

    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }

      switch (msg.type) {
        case 'log': {
          const level = msg.level || 'info'
          const logType =
            level === 'error'   ? 'error' :
            level === 'success' ? 'success' : 'info'
          setLogs(prev => [...prev, { type: logType, message: msg.message || '' }])
          break
        }
        case 'progress':
          setProgress(msg.progress ?? 0)
          setStatus(msg.status   ?? 'building')
          break
        case 'complete':
          setStatus(msg.status ?? 'success')
          setProgress(msg.status === 'success' ? 100 : 0)
          setIsConnected(false)
          ws.close()
          break
        case 'error':
          setLogs(prev => [...prev, { type: 'error', message: msg.message || 'Erreur inconnue' }])
          setStatus('failed')
          setIsConnected(false)
          ws.close()
          break
        default:
          break
      }
    }

    ws.onerror = () => {
      setLogs(prev => [
        ...prev,
        { type: 'error', message: '⚠️ Connexion WebSocket perdue' }
      ])
      setIsConnected(false)
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    // Nettoyage au démontage ou changement de buildId
    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [buildId])

  return { logs, progress, status, isConnected, disconnect }
}

export default useBuildProgress
