/**
 * RunCard - Carte de processus style Replit
 * Version FINALE avec logs persistants après arrêt et Clear uniquement quand stoppé
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { 
  ChevronDown, ChevronRight, Play, Square, Trash2, Copy,
  Clock, MoreVertical, Edit, Terminal as TerminalIcon,
  Eye, EyeOff, Search, X, Download, ExternalLink
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

const LOG_TYPES = {
  STDOUT: 'stdout',
  STDERR: 'stderr',
  SYSTEM: 'system'
}

const STATUS_COLORS = {
  [RUN_STATUS.RUNNING]: 'border-green-500/30 bg-green-500/5',
  [RUN_STATUS.STOPPED]: 'border-gray-500/30 bg-gray-500/5',
  [RUN_STATUS.FAILED]: 'border-red-500/30 bg-red-500/5',
  [RUN_STATUS.STARTING]: 'border-yellow-500/30 bg-yellow-500/5'
}

const STATUS_BADGE = {
  [RUN_STATUS.RUNNING]: { text: 'En cours', color: 'text-green-400 border-green-500/30' },
  [RUN_STATUS.STOPPED]: { text: 'Arrêté', color: 'text-gray-400 border-gray-500/30' },
  [RUN_STATUS.FAILED]: { text: 'Échec', color: 'text-red-400 border-red-500/30' },
  [RUN_STATUS.STARTING]: { text: 'Démarrage', color: 'text-yellow-400 border-yellow-500/30' }
}

const VIRTUAL_LIST_HEIGHT = 400
const LOG_LINE_HEIGHT = 20

// =============================
// UTILITAIRES
// =============================

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

const extractLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

const isNearBottom = (element, threshold = 100) => {
  if (!element) return true
  const { scrollTop, scrollHeight, clientHeight } = element
  return scrollHeight - scrollTop - clientHeight < threshold
}

// =============================
// COMPOSANT LOG LINE (virtualisé)
// =============================
const LogLine = ({ data, index, style, onCopy, onUrlClick }) => {
  const log = data[index]
  if (!log) return null

  const links = extractLinks(log.message)
  const isStderr = log.type === LOG_TYPES.STDERR
  const isSystem = log.type === LOG_TYPES.SYSTEM

  return (
    <div 
      style={style}
      className={`group relative py-0.5 px-2 hover:bg-white/5 cursor-pointer font-mono text-xs ${
        isStderr ? 'text-red-400' : 
        isSystem ? 'text-blue-400' : 
        'text-gray-300'
      }`}
      onClick={() => log.data && toast.info(JSON.stringify(log.data, null, 2))}
    >
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span className="text-gray-500 shrink-0 w-16 select-none">
          {formatTimestamp(log.timestamp)}
        </span>

        {/* Type indicator */}
        <span className="shrink-0 w-8 select-none opacity-50">
          {isStderr ? '⚠️' : isSystem ? '🔧' : '>'}
        </span>

        {/* Message avec liens */}
        <span className="flex-1 break-words select-text">
          {links.length > 0 ? (
            <span>
              {log.message.split(/(https?:\/\/[^\s]+)/).map((part, i) => {
                if (part.match(/https?:\/\//)) {
                  return (
                    <a
                      key={i}
                      href={part}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUrlClick?.(part)
                      }}
                    >
                      {part}
                    </a>
                  )
                }
                return <span key={i}>{part}</span>
              })}
            </span>
          ) : (
            <span>{log.message}</span>
          )}
        </span>

        {/* Copie rapide */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCopy(log.message)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <Copy className="w-3 h-3 text-gray-500 hover:text-green-400" />
        </button>
      </div>
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL RUN CARD
// =============================
const RunCard = ({ 
  run, 
  onStart, 
  onStop, 
  onClear, 
  onCopy, 
  onInput, 
  onUrlClick 
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showStdin, setShowStdin] = useState(false)
  
  const logsContainerRef = useRef(null)
  const listRef = useRef(null)
  const userScrolledRef = useRef(false)

  // ✅ Indicateur si le processus est arrêté ET a des logs
  const hasEndedLogs = run.status !== RUN_STATUS.RUNNING && run.logs.length > 0
  
  // ✅ Style spécifique pour l'état arrêté (effet figé)
  const isStopped = run.status === RUN_STATUS.STOPPED
  const isRunning = run.status === RUN_STATUS.RUNNING

  // Filtrage des logs
  const filteredLogs = useMemo(() => {
    return run.logs.filter(log => {
      if (filter !== 'all') {
        if (filter === 'stderr' && log.type !== LOG_TYPES.STDERR) return false
        if (filter === 'stdout' && log.type !== LOG_TYPES.STDOUT) return false
        if (filter === 'system' && log.type !== LOG_TYPES.SYSTEM) return false
      }
      if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [run.logs, filter, search])

  // Détection scroll utilisateur
  const handleScroll = ({ scrollOffset }) => {
    const container = logsContainerRef.current
    if (!container) return
    userScrolledRef.current = !isNearBottom(container)
  }

  // Auto-scroll intelligent (uniquement si running et en bas)
  useEffect(() => {
    if (isRunning && isExpanded && listRef.current && !userScrolledRef.current) {
      listRef.current.scrollToItem(filteredLogs.length - 1, 'end')
    }
  }, [filteredLogs.length, isExpanded, isRunning])

  // Message système quand le processus s'arrête
  const stopMessage = useMemo(() => {
    if (run.status === RUN_STATUS.STOPPED && run.endedAt) {
      return {
        id: `stop-${Date.now()}`,
        type: LOG_TYPES.SYSTEM,
        timestamp: run.endedAt,
        message: `🛑 Processus arrêté à ${new Date(run.endedAt).toLocaleTimeString()}`
      }
    }
    return null
  }, [run.status, run.endedAt])

  return (
    <Card className={`mb-2 border overflow-hidden transition-opacity duration-300 ${
      STATUS_COLORS[run.status] || 'border-gray-500/30'
    } ${isStopped ? 'opacity-90' : ''}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-2 bg-black/30 cursor-pointer hover:bg-black/40 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1">
          <button className="text-gray-400 hover:text-white">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          <div className="flex items-center gap-2">
            {/* Indicateur de statut avec pulse uniquement si running */}
            <span className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-green-500 animate-pulse' :
              run.status === RUN_STATUS.STOPPED ? 'bg-gray-500' :
              run.status === RUN_STATUS.FAILED ? 'bg-red-500' :
              'bg-yellow-500'
            }`} />
            
            <span className={`font-medium ${isRunning ? 'text-green-400' : 'text-gray-300'}`}>
              {run.name}
            </span>
            
            {/* Commande exécutée */}
            {run.command && (
              <Badge variant="outline" className="text-xs font-mono ml-2">
                {run.command}
              </Badge>
            )}
          </div>

          {/* Badge de statut */}
          <Badge variant="outline" className={`text-xs ${STATUS_BADGE[run.status]?.color || ''}`}>
            {STATUS_BADGE[run.status]?.text || run.status}
          </Badge>

          {/* Compteur de logs */}
          <span className="text-xs text-gray-500">
            {run.logs.length} logs
          </span>

          {/* Horodatage */}
          {run.startedAt && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(run.startedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Filtres rapides */}
          <div className="flex items-center gap-1 mr-2">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
              className="h-6 text-xs"
            >
              Tous
            </Button>
            <Button
              variant={filter === 'stdout' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('stdout')}
              className="h-6 text-xs px-1"
              title="Stdout"
            >
              {'>'}
            </Button>
            <Button
              variant={filter === 'stderr' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('stderr')}
              className="h-6 text-xs px-1"
              title="Stderr"
            >
              ⚠️
            </Button>
          </div>

          {/* Recherche */}
          <div className="relative w-32">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-500" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-6 text-xs bg-black/50 border-green-500/30"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* ✅ Bouton Clear visible UNIQUEMENT si arrêté ET avec logs */}
          {hasEndedLogs && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClear(run.id)}
              className="h-6 text-xs text-red-400 hover:text-red-300"
              title="Effacer les logs (disponible car processus arrêté)"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}

          {/* Input toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowStdin(!showStdin)}
            className="h-6 w-6"
            title={showStdin ? 'Masquer input' : 'Envoyer commande'}
            disabled={!isRunning}
          >
            <Edit className="w-3 h-3" />
          </Button>

          {/* Menu d'actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              
              {!isRunning ? (
                <DropdownMenuItem onClick={() => onStart(run.id)}>
                  <Play className="w-4 h-4 mr-2" />
                  Démarrer
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onStop(run.id)}>
                  <Square className="w-4 h-4 mr-2" />
                  Arrêter
                </DropdownMenuItem>
              )}

              {/* ✅ Clear dans le menu (toujours là mais désactivé si running) */}
              <DropdownMenuItem 
                onClick={() => onClear(run.id)}
                disabled={isRunning}
                className={isRunning ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isRunning ? 'Indisponible (processus en cours)' : 'Effacer les logs'}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => {
                const text = run.logs.map(l => l.message).join('\n')
                navigator.clipboard.writeText(text)
                toast.success('Logs copiés')
              }}>
                <Copy className="w-4 h-4 mr-2" />
                Copier tout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Logs */}
      {isExpanded && (
        <div 
          ref={logsContainerRef}
          className={`overflow-auto bg-black/20 transition-opacity ${
            isStopped ? 'opacity-75' : ''
          }`}
          style={{ height: VIRTUAL_LIST_HEIGHT, fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
        >
          {filteredLogs.length === 0 && !stopMessage ? (
            <div className="text-center py-4 text-gray-600 text-xs">
              {search ? 'Aucun log correspondant' : 'En attente des logs...'}
            </div>
          ) : (
            <List
              ref={listRef}
              height={VIRTUAL_LIST_HEIGHT}
              itemCount={filteredLogs.length + (stopMessage ? 1 : 0)}
              itemSize={LOG_LINE_HEIGHT}
              width="100%"
              itemData={filteredLogs}
              onScroll={handleScroll}
            >
              {({ data, index, style }) => {
                // Afficher le message d'arrêt à la fin si présent
                if (stopMessage && index === filteredLogs.length) {
                  return (
                    <div style={style} className="py-0.5 px-2 text-blue-400 font-mono text-xs">
                      <span className="text-gray-500 w-16 inline-block">
                        {formatTimestamp(stopMessage.timestamp)}
                      </span>
                      <span className="ml-11">{stopMessage.message}</span>
                    </div>
                  )
                }
                return (
                  <LogLine
                    data={data}
                    index={index}
                    style={style}
                    onCopy={onCopy}
                    onUrlClick={onUrlClick}
                  />
                )
              }}
            </List>
          )}
        </div>
      )}

      {/* Input stdin (uniquement si running) */}
      {showStdin && isRunning && (
        <div className="p-2 border-t border-green-500/30 bg-black/90">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-green-400 shrink-0" />
            <Input
              placeholder="Entrez une commande..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  onInput(run.id, e.target.value)
                  e.target.value = ''
                }
              }}
              className="flex-1 bg-transparent border-0 text-green-400 placeholder:text-green-800 focus-visible:ring-0 font-mono text-sm"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Message d'aide pour le bouton Clear */}
      {hasEndedLogs && (
        <div className="px-2 pb-1 text-[10px] text-gray-600 text-right">
          Les logs sont conservés après arrêt. Utilisez "Clear" pour les supprimer.
        </div>
      )}
    </Card>
  )
}

RunCard.propTypes = {
  run: PropTypes.any.isRequired,
  onStart: PropTypes.func.isRequired,
  onStop: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onCopy: PropTypes.func.isRequired,
  onInput: PropTypes.func.isRequired,
  onUrlClick: PropTypes.func.isRequired,
};

export default RunCard
LogLine.propTypes = {
  data: PropTypes.array.isRequired,
  index: PropTypes.number.isRequired,
  style: PropTypes.object.isRequired,
  onCopy: PropTypes.func.isRequired,
  onUrlClick: PropTypes.func.isRequired,
};
