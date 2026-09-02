/**
 * AppConsole - Console d'application style Replit
 * Version ULTIME avec global search, protection mémoire, et UX améliorée
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { 
  Terminal, ChevronDown, Play, Square, Trash2, Download, X,
  Eye, EyeOff, Search, Filter, Clock, CheckCircle, AlertCircle,
  Globe, ExternalLink
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Card } from '../../components/ui/card'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/dropdown-menu'

// Import du composant existant
import RunCard from './RunCard'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const RUN_STATUS = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed',
  STARTING: 'starting'
}

const _wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_BASE = `${_wsProto}//${window.location.host}`
const MAX_RUNS = 10
const MAX_LOGS_PER_RUN = 2000
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 5

// =============================
// COMPOSANT PRINCIPAL
// =============================
const AppConsole = ({ projectId, onClose, onOpenPreview }) => {
  // États
  const [runs, setRuns] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pausedLogs, setPausedLogs] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [onlyLatest, setOnlyLatest] = useState(true)
  const [globalSearch, setGlobalSearch] = useState('')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  // Refs
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const runsRef = useRef(runs)

  // Mettre à jour la ref quand runs change
  useEffect(() => {
    runsRef.current = runs
  }, [runs])

  // =============================
  // CONNEXION WEBSOCKET
  // =============================
  useEffect(() => {
    if (!projectId) return

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${WS_BASE}/projects/${projectId}/logs/multiplex`)
        
        ws.onopen = () => {
          console.log('[AppConsole] WebSocket connecté')
          setIsConnected(true)
          setReconnectAttempts(0)
          toast.success('Connecté aux logs', { duration: 2000 })
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            handleIncomingData(data)
          } catch (error) {
            console.error('[AppConsole] Erreur parsing:', error)
          }
        }

        ws.onerror = (error) => {
          console.error('[AppConsole] Erreur WebSocket:', error)
          setIsConnected(false)
        }

        ws.onclose = () => {
          console.log('[AppConsole] WebSocket déconnecté')
          setIsConnected(false)
          
          // Tentative de reconnexion avec backoff exponentiel
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts)
            console.log(`[AppConsole] Reconnexion dans ${delay}ms (tentative ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
            
            reconnectTimerRef.current = setTimeout(() => {
              setReconnectAttempts(prev => prev + 1)
              connectWebSocket()
            }, delay)
          } else {
            toast.error('Impossible de se connecter aux logs', {
              description: 'Vérifiez votre connexion réseau'
            })
          }
        }

        wsRef.current = ws
      } catch (error) {
        console.error('[AppConsole] Erreur création WebSocket:', error)
      }
    }

    connectWebSocket()

    // Cleanup à la fermeture
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [projectId])

  // =============================
  // GESTION DES DONNÉES ENTRANTES
  // =============================
  const handleIncomingData = (data) => {
    const { type, payload } = data

    switch (type) {
      case 'run:start':
        handleRunStart(payload)
        break
      case 'run:stop':
        handleRunStop(payload)
        break
      case 'run:log':
        handleRunLog(payload)
        break
      case 'run:status':
        handleRunStatus(payload)
        break
      case 'run:clear':
        handleRunClear(payload)
        break
      case 'batch:logs':
        handleBatchLogs(payload)
        break
      default:
        console.warn('[AppConsole] Type inconnu:', type)
    }
  }

  const handleRunStart = (payload) => {
    const newRun = {
      id: payload.id || `run-${Date.now()}`,
      name: payload.name || 'process',
      command: payload.command,
      status: RUN_STATUS.RUNNING,
      logs: [],
      startedAt: payload.timestamp || new Date().toISOString(),
      endedAt: null,
      metadata: payload.metadata || {}
    }

    setRuns(prev => {
      const newRuns = [newRun, ...prev]
      if (newRuns.length > MAX_RUNS) {
        return newRuns.slice(0, MAX_RUNS)
      }
      return newRuns
    })

    toast.info(`Processus démarré: ${payload.name || 'process'}`, {
      duration: 3000
    })
  }

  const handleRunStop = (payload) => {
    setRuns(prev => prev.map(run => 
      run.id === payload.id 
        ? { 
            ...run, 
            status: RUN_STATUS.STOPPED, 
            endedAt: payload.timestamp || new Date().toISOString() 
          }
        : run
    ))

    toast.info(`Processus arrêté`, {
      duration: 3000
    })
  }

  const handleRunLog = (payload) => {
    const { runId, message, type = 'stdout', data } = payload

    const log = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      data
    }

    if (isPaused) {
      setPausedLogs(prev => [...prev, { runId, log }])
    } else {
      setRuns(prev => prev.map(run => {
        if (run.id === runId) {
          // ✅ Limitation mémoire
          const newLogs = [...run.logs, log]
          const limitedLogs = newLogs.slice(-MAX_LOGS_PER_RUN)
          return { ...run, logs: limitedLogs }
        }
        return run
      }))
    }
  }

  const handleRunStatus = (payload) => {
    setRuns(prev => prev.map(run => 
      run.id === payload.id 
        ? { ...run, status: payload.status }
        : run
    ))
  }

  const handleRunClear = (payload) => {
    setRuns(prev => prev.map(run => 
      run.id === payload.id 
        ? { ...run, logs: [] }
        : run
    ))
  }

  const handleBatchLogs = (payload) => {
    const { runId, logs } = payload
    
    if (isPaused) {
      const batch = logs.map(log => ({ runId, log }))
      setPausedLogs(prev => [...prev, ...batch])
    } else {
      setRuns(prev => prev.map(run => {
        if (run.id === runId) {
          // ✅ Limitation mémoire
          const newLogs = [...run.logs, ...logs]
          const limitedLogs = newLogs.slice(-MAX_LOGS_PER_RUN)
          return { ...run, logs: limitedLogs }
        }
        return run
      }))
    }
  }

  // =============================
  // ACTIONS SUR LES RUNS
  // =============================
  const handleStartRun = (runId) => {
    wsRef.current?.send(JSON.stringify({
      type: 'run:start',
      payload: { runId }
    }))
  }

  const handleStopRun = (runId) => {
    wsRef.current?.send(JSON.stringify({
      type: 'run:stop',
      payload: { runId }
    }))
  }

  const handleClearRun = (runId) => {
    setRuns(prev => prev.map(run => 
      run.id === runId ? { ...run, logs: [] } : run
    ))
    
    wsRef.current?.send(JSON.stringify({
      type: 'run:clear',
      payload: { runId }
    }))
    
    toast.success('Logs effacés')
  }

  const handleInput = (runId, input) => {
    wsRef.current?.send(JSON.stringify({
      type: 'run:input',
      payload: { runId, input }
    }))
    toast.success(`Commande envoyée: ${input}`)
  }

  const handleCopyLogs = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papiers')
  }

  const handleUrlClick = (url) => {
    if (onOpenPreview) {
      onOpenPreview(url)
    } else {
      window.open(url, '_blank')
    }
  }

  // =============================
  // ACTIONS GLOBALES
  // =============================
  const handlePause = () => {
    setIsPaused(true)
    toast.info('Console en pause', { duration: 2000 })
  }

  const handleResume = () => {
    setIsPaused(false)
    
    // ✅ Optimisation : un seul setState
    setRuns(prev => {
      const updated = [...prev]
      pausedLogs.forEach(({ runId, log }) => {
        const index = updated.findIndex(r => r.id === runId)
        if (index !== -1) {
          const newLogs = [...updated[index].logs, log]
          updated[index] = { 
            ...updated[index], 
            logs: newLogs.slice(-MAX_LOGS_PER_RUN) 
          }
        }
      })
      return updated
    })
    
    setPausedLogs([])
    toast.success('Reprise des logs')
  }

  const handleClearAll = () => {
    setRuns([])
    setPausedLogs([])
    toast.success('Console entièrement effacée')
  }

  const handleExport = () => {
    const exportData = {
      projectId,
      exportedAt: new Date().toISOString(),
      totalRuns: runs.length,
      totalLogs: runs.reduce((acc, run) => acc + run.logs.length, 0),
      runs: runs.map(run => ({
        id: run.id,
        name: run.name,
        command: run.command,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        logs: run.logs.map(log => ({
          timestamp: log.timestamp,
          type: log.type,
          message: log.message,
          data: log.data
        }))
      }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `console-logs-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Logs exportés')
  }

  // =============================
  // FILTRAGE DES RUNS (AVEC GLOBAL SEARCH)
  // =============================
  
  // ✅ Étape 1 : Filtrer par statut
  const filteredByStatus = runs.filter(run => {
    if (activeFilter === 'running') return run.status === RUN_STATUS.RUNNING
    if (activeFilter === 'stopped') return run.status === RUN_STATUS.STOPPED
    if (activeFilter === 'failed') return run.status === RUN_STATUS.FAILED
    return true
  })

  // ✅ Étape 2 : Appliquer la recherche globale sur les logs
  const filteredRuns = useMemo(() => {
    if (!globalSearch.trim()) return filteredByStatus

    const searchLower = globalSearch.toLowerCase()
    
    return filteredByStatus
      .map(run => ({
        ...run,
        // Filtrer les logs du run
        logs: run.logs.filter(log => 
          log.message.toLowerCase().includes(searchLower)
        )
      }))
      .filter(run => run.logs.length > 0) // Garder seulement les runs avec des résultats
  }, [filteredByStatus, globalSearch])

  // ✅ Étape 3 : Appliquer "onlyLatest"
  const displayedRuns = onlyLatest && filteredRuns.length > 0 
    ? [filteredRuns[0]] 
    : filteredRuns

  // Statistiques
  const stats = {
    total: runs.length,
    running: runs.filter(r => r.status === RUN_STATUS.RUNNING).length,
    stopped: runs.filter(r => r.status === RUN_STATUS.STOPPED).length,
    failed: runs.filter(r => r.status === RUN_STATUS.FAILED).length,
    totalLogs: runs.reduce((acc, run) => acc + run.logs.length, 0)
  }

  // =============================
  // RENDU
  // =============================
  return (
    <Card className="h-full flex flex-col bg-black text-green-400 font-mono overflow-hidden rounded-none">
      {/* Barre d'en-tête */}
      <div className="flex items-center justify-between p-2 border-b border-green-500/30 bg-black/90 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span className="text-sm font-medium">Console</span>
            <Badge 
              variant={isConnected ? 'default' : 'destructive'}
              className="text-xs"
            >
              {isConnected ? 'Connecté' : 'Déconnecté'}
            </Badge>
          </div>

          {/* Statistiques rapides */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-blue-400">📊 {stats.total}</span>
            <span className="text-green-400">▶ {stats.running}</span>
            <span className="text-gray-400">⏹️ {stats.stopped}</span>
            <span className="text-red-400">❌ {stats.failed}</span>
            <span className="text-purple-400">📝 {stats.totalLogs}</span>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  {activeFilter === 'all' ? 'Tous' :
                   activeFilter === 'running' ? 'En cours' :
                   activeFilter === 'stopped' ? 'Arrêtés' :
                   'Échecs'}
                  <ChevronDown className="w-3 h-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setActiveFilter('all')}>
                  Tous les processus
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveFilter('running')}>
                  En cours uniquement
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveFilter('stopped')}>
                  Arrêtés uniquement
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveFilter('failed')}>
                  Échecs uniquement
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOnlyLatest(!onlyLatest)}
              className="h-7 text-xs"
            >
              {onlyLatest ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
              {onlyLatest ? 'Dernier run' : 'Tous les runs'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Pause/Resume */}
          <Button
            variant="ghost"
            size="icon"
            onClick={isPaused ? handleResume : handlePause}
            className="h-7 w-7"
            title={isPaused ? 'Reprendre' : 'Pause'}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          </Button>

          {/* Effacer tout */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearAll}
            className="h-7 w-7"
            title="Tout effacer"
          >
            <Trash2 className="w-3 h-3" />
          </Button>

          {/* Exporter */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExport}
            className="h-7 w-7"
            title="Exporter"
          >
            <Download className="w-3 h-3" />
          </Button>

          {/* Fermer */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7"
              title="Fermer"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Indicateur de pause */}
      {isPaused && (
        <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 text-xs flex items-center justify-between">
          <span>⏸️ Console en pause - {pausedLogs.length} logs en attente</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResume}
            className="h-6 text-xs text-yellow-400 hover:text-yellow-300"
          >
            Reprendre
          </Button>
        </div>
      )}

      {/* Barre de recherche globale - MAINTENANT FONCTIONNELLE */}
      <div className="p-2 border-b border-green-500/30 bg-black/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Rechercher dans tous les logs..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full pl-10 bg-black/30 border-green-500/30 text-sm"
          />
          {globalSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGlobalSearch('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 text-xs"
            >
              ✕
            </Button>
          )}
        </div>
        {globalSearch && (
          <div className="text-xs text-gray-500 mt-1">
            {filteredRuns.reduce((acc, run) => acc + run.logs.length, 0)} résultats
          </div>
        )}
      </div>

      {/* Zone des runs */}
      <div className="flex-1 overflow-auto p-2">
        {displayedRuns.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600">
            <div className="text-center">
              <Terminal className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucun processus</p>
              <p className="text-xs text-gray-700 mt-1">
                {globalSearch 
                  ? 'Aucun log ne correspond à la recherche'
                  : activeFilter !== 'all' 
                    ? 'Aucun processus ne correspond au filtre'
                    : 'Lancez une commande pour voir les logs'
                }
              </p>
              {globalSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGlobalSearch('')}
                  className="mt-2 text-xs"
                >
                  Effacer la recherche
                </Button>
              )}
            </div>
          </div>
        ) : (
          displayedRuns.map(run => (
            <RunCard
              key={run.id}
              run={run}
              onStart={handleStartRun}
              onStop={handleStopRun}
              onClear={handleClearRun}
              onCopy={handleCopyLogs}
              onInput={handleInput}
              onUrlClick={handleUrlClick}
            />
          ))
        )}
      </div>

       {/* Barre d'état */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-green-500/30 bg-black/90 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>{displayedRuns.length} processus affichés</span>
          {isPaused && <span>⏸️ {pausedLogs.length} logs en attente</span>}
          {globalSearch && (
            <span>🔍 {filteredRuns.reduce((acc, run) => acc + run.logs.length, 0)} résultats</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span>{isConnected ? 'Connecté' : 'Déconnecté'}</span>
          {reconnectAttempts > 0 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && (
            <span className="text-yellow-400">Reconnexion...</span>
          )}
        </div>
      </div>
    </Card>
  )
}

AppConsole.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onClose: PropTypes.func.isRequired,
  onOpenPreview: PropTypes.func.isRequired,
};

export default AppConsole
