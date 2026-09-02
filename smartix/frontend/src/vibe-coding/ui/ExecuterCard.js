/**
 * RunCard - Carte d'exécution de projet
 * 
 * Affiche:
 * - Statut du build et de l'exécution
 * - Progression en temps réel
 * - Actions (run/stop/restart)
 * - Logs d'exécution
 * - Métriques de performance
 */

import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { 
  Play, Square, Loader2, CheckCircle, XCircle, Clock, 
  RefreshCw, Terminal, Cpu, HardDrive, Network, 
  Maximize2, Minimize2, Download, Trash2, AlertTriangle 
} from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Progress } from '../../components/ui/progress'
import { Badge } from '../../components/ui/badge'
import { Tooltip } from '../../components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'

// Constantes de configuration
const CONFIG = {
  POLLING_INTERVAL: 2000, // 2 secondes
  MAX_LOG_LINES: 1000,
  AUTO_SCROLL: true,
  BUILD_TIMEOUT: 300000, // 5 minutes
  METRICS_HISTORY: 60, // 60 points de données
}

const RunCard = ({ 
  projectId,
  isRunning,
  onRun,
  onStop,
  onRestart,
  onClearLogs,
  buildProgress = 0,
  status = 'idle',
  lastBuildTime,
  error,
  logs = [],
  metrics = {},
  environment = 'development',
  onFetchLogs,
  onFetchMetrics,
  showAdvanced = false,
  className = '',
  size = 'default' // 'small', 'default', 'large'
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [autoScroll, setAutoScroll] = useState(CONFIG.AUTO_SCROLL)
  const [confirmStop, setConfirmStop] = useState(false)
  const [buildTimeElapsed, setBuildTimeElapsed] = useState(0)
  const logsEndRef = useRef(null)
  const buildStartTimeRef = useRef(null)

  // Gestion du timer de build
  useEffect(() => {
    if (status === 'building') {
      buildStartTimeRef.current = Date.now()
      const timer = setInterval(() => {
        setBuildTimeElapsed(Math.floor((Date.now() - buildStartTimeRef.current) / 1000))
      }, 1000)
      return () => clearInterval(timer)
    } else {
      setBuildTimeElapsed(0)
    }
  }, [status])

  // Auto-scroll des logs
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Polling des logs et métriques
  useEffect(() => {
    if (isRunning && onFetchLogs) {
      const interval = setInterval(() => {
        onFetchLogs(projectId)
        if (onFetchMetrics) onFetchMetrics(projectId)
      }, CONFIG.POLLING_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [isRunning, projectId, onFetchLogs, onFetchMetrics])

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-green-400" />
      case 'building':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'stopped':
        return <Square className="w-4 h-4 text-gray-400" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'text-green-400 border-green-400/30 bg-green-400/10'
      case 'building':
        return 'text-blue-400 border-blue-400/30 bg-blue-400/10'
      case 'success':
        return 'text-green-400 border-green-400/30 bg-green-400/10'
      case 'failed':
      case 'error':
        return 'text-red-400 border-red-400/30 bg-red-400/10'
      case 'stopped':
        return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
      default:
        return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'running':
        return 'En cours d\'exécution'
      case 'building':
        return `Build en cours... (${formatTime(buildTimeElapsed)})`
      case 'success':
        return 'Build réussi'
      case 'failed':
        return 'Échec du build'
      case 'stopped':
        return 'Arrêté'
      case 'error':
        return 'Erreur'
      default:
        return 'Prêt'
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const handleRun = () => {
    if (onRun) {
      onRun(projectId, { environment })
    }
  }

  const handleStop = () => {
    if (confirmStop) {
      onStop(projectId)
      setConfirmStop(false)
    } else {
      setConfirmStop(true)
      setTimeout(() => setConfirmStop(false), 3000)
    }
  }

  const handleRestart = () => {
    if (onRestart) {
      onRestart(projectId)
    }
  }

  const handleDownloadLogs = () => {
    const logText = logs.join('\n')
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${projectId}-${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderMetrics = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
      <Tooltip content="Utilisation CPU">
        <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
          <Cpu className="w-4 h-4 text-blue-400" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">CPU</div>
            <div className="text-sm font-medium">{metrics.cpu || 0}%</div>
          </div>
        </div>
      </Tooltip>

      <Tooltip content="Utilisation mémoire">
        <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
          <HardDrive className="w-4 h-4 text-green-400" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Mémoire</div>
            <div className="text-sm font-medium">{formatBytes(metrics.memory || 0)}</div>
          </div>
        </div>
      </Tooltip>

      <Tooltip content="Requêtes réseau">
        <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
          <Network className="w-4 h-4 text-purple-400" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Requêtes</div>
            <div className="text-sm font-medium">{metrics.requests || 0}/s</div>
          </div>
        </div>
      </Tooltip>

      <Tooltip content="Temps de réponse">
        <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
          <Clock className="w-4 h-4 text-yellow-400" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Latence</div>
            <div className="text-sm font-medium">{metrics.latency || 0}ms</div>
          </div>
        </div>
      </Tooltip>
    </div>
  )

  const renderLogs = () => (
    <Dialog open={showLogs} onOpenChange={setShowLogs}>
      <DialogContent className="max-w-4xl h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Logs d'exécution - {projectId}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
              >
                {autoScroll ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadLogs}
              >
                <Download className="w-4 h-4" />
              </Button>
              {onClearLogs && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onClearLogs(projectId)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[500px] font-mono text-sm">
          <div className="p-4 space-y-1">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                Aucun log disponible
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`text-xs ${
                    log.includes('ERROR') ? 'text-red-400' :
                    log.includes('WARN') ? 'text-yellow-400' :
                    log.includes('INFO') ? 'text-blue-400' :
                    'text-gray-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      <Card className={`p-4 bg-card/50 backdrop-blur-sm border border-border/50 ${className}`}>
        {/* En-tête */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-medium">Exécution</h3>
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1 ${getStatusColor()}`}
            >
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </Badge>
            
            {environment && (
              <Badge variant="secondary" className="text-xs">
                {environment}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {lastBuildTime && (
              <Tooltip content="Dernier build">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(lastBuildTime).toLocaleTimeString()}
                </span>
              </Tooltip>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Barre de progression */}
        {(status === 'building' || buildProgress > 0) && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progression du build</span>
              <span className="text-blue-400">{buildProgress}%</span>
            </div>
            <Progress 
              value={buildProgress} 
              className="h-2"
              indicatorClassName={
                status === 'failed' ? 'bg-red-500' :
                status === 'success' ? 'bg-green-500' :
                'bg-blue-500'
              }
            />
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-red-400 font-medium mb-1">Erreur d'exécution</p>
                <p className="text-xs text-red-400/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions principales */}
        <div className="flex gap-2">
          {isRunning ? (
            <>
              <Button
                variant="destructive"
                size={size === 'small' ? 'sm' : 'default'}
                onClick={handleStop}
                className="flex-1"
                disabled={status === 'building'}
              >
                {confirmStop ? (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2 animate-pulse" />
                    Confirmer
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Arrêter
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size={size === 'small' ? 'sm' : 'default'}
                onClick={handleRestart}
                disabled={status === 'building'}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size={size === 'small' ? 'sm' : 'default'}
              onClick={handleRun}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={status === 'building'}
            >
              <Play className="w-4 h-4 mr-2" />
              Lancer
            </Button>
          )}

          <Button
            variant="outline"
            size={size === 'small' ? 'sm' : 'default'}
            onClick={() => setShowLogs(true)}
          >
            <Terminal className="w-4 h-4 mr-2" />
            Logs
          </Button>
        </div>

        {/* Zone étendue */}
        {isExpanded && (
          <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
            {/* Métriques */}
            {(showMetrics || showAdvanced) && renderMetrics()}

            {/* Informations supplémentaires */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">ID du projet</div>
                <div className="font-mono bg-secondary/30 p-2 rounded">{projectId}</div>
              </div>
              
              <div className="space-y-1">
                <div className="text-muted-foreground">Statut détaillé</div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span>{isRunning ? 'Processus actif' : 'Processus inactif'}</span>
                </div>
              </div>

              {metrics.uptime && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Temps d'activité</div>
                  <div>{formatTime(metrics.uptime)}</div>
                </div>
              )}

              {logs.length > 0 && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Derniers logs</div>
                  <div className="truncate">{logs[logs.length - 1]}</div>
                </div>
              )}
            </div>

            {/* Boutons avancés */}
            {showAdvanced && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMetrics(!showMetrics)}
                >
                  {showMetrics ? 'Cacher' : 'Afficher'} les métriques
                </Button>
                
                {onFetchLogs && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFetchLogs(projectId)}
                  >
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Rafraîchir
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Badge de confirmation d'arrêt */}
        {confirmStop && (
          <div className="mt-2 text-xs text-yellow-400 animate-pulse">
            Cliquez à nouveau sur Arrêter pour confirmer
          </div>
        )}
      </Card>

      {/* Modal des logs */}
      {renderLogs()}
    </>
  )
}

RunCard.propTypes = {
  projectId: PropTypes.string.isRequired,
  isRunning: PropTypes.bool,
  onRun: PropTypes.func,
  onStop: PropTypes.func,
  onRestart: PropTypes.func,
  onClearLogs: PropTypes.func,
  buildProgress: PropTypes.number,
  status: PropTypes.oneOf(['idle', 'building', 'running', 'success', 'failed', 'stopped', 'error']),
  lastBuildTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  error: PropTypes.string,
  logs: PropTypes.arrayOf(PropTypes.string),
  metrics: PropTypes.shape({
    cpu: PropTypes.number,
    memory: PropTypes.number,
    requests: PropTypes.number,
    latency: PropTypes.number,
    uptime: PropTypes.number
  }),
  environment: PropTypes.string,
  onFetchLogs: PropTypes.func,
  onFetchMetrics: PropTypes.func,
  showAdvanced: PropTypes.bool,
  className: PropTypes.string,
  size: PropTypes.oneOf(['small', 'default', 'large'])
}

RunCard.defaultProps = {
  isRunning: false,
  buildProgress: 0,
  status: 'idle',
  logs: [],
  metrics: {},
  environment: 'development',
  showAdvanced: false,
  size: 'default'
}

export default RunCard
