/**
 * AIChat - Interface de chat avec agent IA (style Replit)
 * Sprint 2 : streaming SSE réel, détection et affichage des diffs, contexte projet
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { 
  Bot, Send, Paperclip, Zap, Settings, ChevronDown,
  ChevronUp, MoreVertical, History, MessageSquarePlus,
  Loader2, CheckCircle, XCircle, Code, Package,
  Brain, FileText, Download, Copy, RefreshCw,
  AlertCircle, Terminal, Sparkles, X
} from 'lucide-react'
import { ChatMessageWithDiff } from './DiffViewer'
import { buildProjectContext } from '../ai/contextBuilder'
import { useSuggestions } from '../hooks/useSuggestions'
import { FileChangeDetector } from '../editor/FileChangeDetector'
import './SuggestionsPanel.css'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar'
import { Progress } from '../../components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import {

  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const MODES = {
  BUILD: 'build',
  DEBUG: 'debug',
  ASK: 'ask',
  EXPLAIN: 'explain'
}

const AGENT_STATUS = {
  READY: 'ready',
  WORKING: 'working',
  ERROR: 'error'
}

const ACTION_STATUS = {
  PENDING: 'pending',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
}

const ACTION_ICONS = {
  install: Package,
  analyze: Brain,
  evaluate: Code,
  fix: Terminal,
  generate: Sparkles,
  default: Zap
}

// =============================
// COMPOSANT D'ACTION (STYLE LOG)
// =============================

const ActionItem = ({ action, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const Icon = ACTION_ICONS[action.type] || ACTION_ICONS.default
  const status = action.status || ACTION_STATUS.PENDING

  const getStatusIcon = () => {
    switch (status) {
      case ACTION_STATUS.LOADING:
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
      case ACTION_STATUS.SUCCESS:
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case ACTION_STATUS.ERROR:
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <div className="w-4 h-4" />
    }
  }

  return (
    <div className={`border-l border-border/40 pl-3 py-1 hover:bg-muted/10 transition-all duration-200 ${!isLast ? 'mb-2' : ''}`}>
      {/* Header de l'action (cliquable) */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <Icon className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium">{action.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-xs text-muted-foreground">{action.duration}</span>
        </div>
      </div>

      {/* Contenu détaillé de l'action */}
      {isExpanded && (
        <div className="mt-2 pl-5">
          <p className="text-xs text-muted-foreground mb-2">{action.description}</p>
          
          {/* Logs de l'action (scrollables) */}
          {action.logs && action.logs.length > 0 && (
            <div className="font-mono text-xs space-y-1 mb-2 max-h-40 overflow-auto">
              {action.logs.map((log, i) => (
                <div key={i} className={`flex items-start gap-2 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  'text-gray-400'
                }`}>
                  <span className="select-none">
                    {log.type === 'error' ? '❌' :
                     log.type === 'success' ? '✅' :
                     '>'}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-2 mt-2">
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              <Copy className="w-3 h-3 mr-1" />
              Copier
            </Button>
            {action.type === 'install' && (
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                <Package className="w-3 h-3 mr-1" />
                Voir dépendance
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================
// COMPOSANT DE GROUPE D'ACTIONS
// =============================

const ActionGroup = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(true)

  if (!actions || actions.length === 0) return null

  return (
    <div className="mt-2 ml-6 opacity-90">
      {/* Header du groupe (cliquable) - CHEVRON CORRIGÉ */}
      <div 
        className="flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <span className="text-xs font-medium text-muted-foreground">
          {actions.length} action{actions.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Actions (repliables) */}
      {isOpen && (
        <div className="space-y-2">
          {actions.map((action, index) => (
            <ActionItem 
              key={index} 
              action={action} 
              isLast={index === actions.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================
// COMPOSANT DE MESSAGE
// =============================

const Message = ({ message, isUser, onCopy, onRegenerate }) => {
  const [isStreaming, setIsStreaming] = useState(false)
  const [displayedText, setDisplayedText] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const streamRef = useRef(null)

  // Simulation de streaming (à remplacer par WebSocket réel)
  useEffect(() => {
    if (message.streaming && !isUser) {
      setIsStreaming(true)
      let index = 0
      const text = message.content
      
      streamRef.current = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1))
          index++
        } else {
          clearInterval(streamRef.current)
          setIsStreaming(false)
        }
      }, 20)

      return () => clearInterval(streamRef.current)
    } else {
      setDisplayedText(message.content)
    }
  }, [message.content, message.streaming, isUser])

  return (
    <div 
      className={`flex items-start gap-3 mb-6 ${isUser ? 'justify-end' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar agent */}
      {!isUser && (
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-purple-500/20 text-purple-400">
            <Bot className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Bulle de message */}
      <div className={`max-w-[700px] ${isUser ? 'order-1' : ''}`}>
        {/* En-tête du message (pour l'agent) */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-purple-400">Agent</span>
            {message.timestamp && (
              <span className="text-xs text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            )}
            {isStreaming && (
              <span className="text-xs text-yellow-400 animate-pulse">● Écrit...</span>
            )}
          </div>
        )}

        {/* En-tête pour l'utilisateur */}
        {isUser && (
          <div className="flex items-center gap-2 mb-1 justify-end">
            <span className="text-xs text-muted-foreground">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-xs font-medium text-blue-400">Vous</span>
          </div>
        )}

        {/* Contenu textuel */}
        {isUser ? (
          <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400">
            <p className="text-sm whitespace-pre-wrap">{displayedText}</p>
          </div>
        ) : (
          <div 
            className={`text-foreground p-2 rounded-lg transition-colors ${isHovered ? 'bg-muted/10' : ''}`}
          >
            {/* Message avec détection et rendu des blocs diff */}
            <div className="text-sm mb-2">
              <ChatMessageWithDiff
                content={displayedText}
                onApplyDiff={(diff, filename) => {
                  console.log('[AIChat] Appliquer diff sur :', filename, diff);
                  // L'application réelle du diff est gérée via onAction prop
                }}
              />
            </div>
            
            {/* Groupe d'actions */}
            {message.actions && message.actions.length > 0 && (
              <ActionGroup actions={message.actions} />
            )}

            {/* Actions du message (au survol) */}
            {isHovered && !isUser && (
              <div className="flex gap-2 mt-3 pt-2 border-t border-border/30">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onCopy(message.content)}>
                  <Copy className="w-3 h-3 mr-1" />
                  Copier
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRegenerate}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Regenerate
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Avatar utilisateur */}
      {isUser && (
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-blue-500/20 text-blue-400">
            U
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// =============================
// BOUTON "SCROLL TO LATEST"
// =============================

const ScrollToLatest = ({ onClick, visible }) => {
  if (!visible) return null

  return (
    <button
      onClick={onClick}
      className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-card border border-border shadow-lg rounded-full px-4 py-2 text-sm flex items-center gap-2 hover:bg-card/80 transition-colors z-10 animate-in fade-in"
    >
      <ChevronDown className="w-4 h-4" />
      <span>Scroll to latest</span>
    </button>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================

const AIChat = ({ 
  projectId,
  onSendMessage,
  onAction,
  onRegenerate,
  initialMessages = [],
  streaming = true,
  projectFiles = {},
  currentFile = null,
  currentFileContent = null,
  selection = null,
  onClearSelection,
  onSelectionClick,
  openFiles = [],
  editor = null
}) => {
  const {
    suggestions,
    isLoading: suggestionsLoading,
    applyingSuggestionId,
    applySuggestion,
    dismissSuggestion,
    clearAllSuggestions
  } = useSuggestions()

  const getSuggestionIcon = (actionType) => {
    switch (actionType) {
      case 'create_file': return '📄'
      case 'modify_file': return '✏️'
      case 'install_package': return '📦'
      case 'run_command': return '⚡'
      default: return '💡'
    }
  }
  // Identifiant de session stable par projet (mémoire de conversation persistante)
  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return `mem-${projectId || 'default'}`
    const storageKey = `vibe-ai-session-${projectId || 'default'}`
    try {
      let id = window.localStorage.getItem(storageKey)
      if (!id) {
        id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        window.localStorage.setItem(storageKey, id)
      }
      return id
    } catch {
      return `mem-${projectId || 'default'}`
    }
  }, [projectId])
  // =============================
  // ÉTATS
  // =============================
  const [messages, setMessages] = useState(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [mode, setMode] = useState(MODES.BUILD)
  const [agentStatus, setAgentStatus] = useState(AGENT_STATUS.READY)
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  
  // Refs
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const textareaRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`
    }
  }, [inputValue])

  // =============================
  // AUTO-SCROLL INTELLIGENT
  // =============================
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }, [])

  useEffect(() => {
    if (!showScrollButton) {
      scrollToBottom()
    }
  }, [messages, showScrollButton, scrollToBottom])

  // =============================
  // STREAMING SSE — CHAT RÉEL
  // =============================
  const activeStreamRef = useRef(null)

  const sendWithStream = useCallback(async (userMessage, history) => {
    // Créer le message assistant vide (sera rempli token par token)
    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    }])

    const controller = new AbortController()
    activeStreamRef.current = controller

    try {
      // Construire le contexte structuré du projet
      let projectContext = { project_id: projectId }
      try {
        const summary = buildProjectContext(projectId, projectFiles || {}, currentFile)
        projectContext = {
          project_id: projectId,
          summary,
          files: Object.keys(projectFiles || {}).slice(0, 100),
          features: [],
        }
      } catch (e) {
        // Contexte best-effort : on n'empêche pas la requête si le builder échoue
      }

      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: history.slice(-10).map(m => ({ role: m.role, content: m.content })),
          mode,
          current_file: currentFile,
          current_file_content: currentFileContent,
          selection,
          open_files: openFiles,
          context: projectContext,
          session_id: sessionId,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.token) {
              fullText += parsed.token
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullText } : m
              ))
            }
          } catch (e) {
            if (e.name !== 'SyntaxError') throw e
          }
        }
      }

      // Marquer comme terminé (plus de streaming)
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, streaming: false } : m
      ))
      setAgentStatus(AGENT_STATUS.READY)
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[AIChat] Stream error:', err.message)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `⚠️ Erreur : ${err.message}`, streaming: false }
          : m
      ))
      setAgentStatus(AGENT_STATUS.ERROR)
    } finally {
      setIsTyping(false)
      activeStreamRef.current = null
    }
  }, [mode])

  // =============================
  // GESTION DE L'ENVOI
  // =============================
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return

    // Annuler le stream en cours si présent
    if (activeStreamRef.current) {
      activeStreamRef.current.abort()
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    }

    const prevMessages = messages
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setAgentStatus(AGENT_STATUS.WORKING)
    setIsTyping(true)

    await sendWithStream(userMessage, [...prevMessages, userMessage])
  }, [inputValue, isTyping, messages, sendWithStream])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content)
    // Toast optionnel
  }

  // =============================
  // ACTIONS RAPIDES
  // =============================
  const quickActions = [
    { icon: Package, label: 'Installer package', action: 'install' },
    { icon: Code, label: 'Générer code', action: 'generate' },
    { icon: Brain, label: 'Expliquer', action: 'explain' },
    { icon: Terminal, label: 'Debug', action: 'debug' }
  ]

  // =============================
  // RENDU
  // =============================
  return (
    <div className="h-full flex flex-col bg-black text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/90 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <span className="font-medium">Agent</span>
          
          {/* Status agent */}
          <Badge 
            variant="outline" 
            className={`text-xs ${
              agentStatus === AGENT_STATUS.READY ? 'text-green-400 border-green-400/30' :
              agentStatus === AGENT_STATUS.WORKING ? 'text-yellow-400 border-yellow-400/30 animate-pulse' :
              'text-red-400 border-red-400/30'
            }`}
          >
            {agentStatus === AGENT_STATUS.READY && '🟢 Ready'}
            {agentStatus === AGENT_STATUS.WORKING && '🟡 Working'}
            {agentStatus === AGENT_STATUS.ERROR && '🔴 Error'}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <History className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Effacer l'historique</DropdownMenuItem>
              <DropdownMenuItem>Exporter la conversation</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Paramètres</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Détecteur de changements de fichiers */}
      {editor && (
        <FileChangeDetector projectId={projectId} editor={editor} />
      )}

      {/* Panneau de suggestions proactives */}
      {(suggestions.length > 0 || suggestionsLoading) && (
        <div className="suggestions-panel">
          <div className="suggestions-header">
            <h4>💡 Suggestions IA</h4>
            <button
              className="clear-all-btn"
              onClick={clearAllSuggestions}
              title="Tout ignorer"
            >
              ×
            </button>
          </div>
          <div className="suggestions-list">
            {suggestionsLoading && (
              <div className="suggestion-loading">
                <span className="spinner"></span>
                <span>Analyse en cours...</span>
              </div>
            )}
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="suggestion-item"
                style={{ '--confidence': suggestion.confidence }}
              >
                <div className="suggestion-confidence">
                  <div
                    className="confidence-bar"
                    style={{ width: `${suggestion.confidence * 100}%` }}
                  />
                </div>
                <div className="suggestion-content">
                  <div className="suggestion-icon">
                    {getSuggestionIcon(suggestion.action_type)}
                  </div>
                  <div className="suggestion-text">
                    <div className="suggestion-title">{suggestion.title}</div>
                    <div className="suggestion-description">{suggestion.description}</div>
                  </div>
                </div>
                <div className="suggestion-actions">
                  <button
                    className="apply-btn"
                    onClick={() => applySuggestion(suggestion.id, projectId)}
                    disabled={applyingSuggestionId === suggestion.id}
                  >
                    {applyingSuggestionId === suggestion.id ? (
                      <span className="spinner-small"></span>
                    ) : (
                      '✨ Appliquer'
                    )}
                  </button>
                  <button
                    className="dismiss-btn"
                    onClick={() => dismissSuggestion(suggestion.id)}
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone des messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-auto p-4 relative"
        onScroll={handleScroll}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold mb-2">👋 Ask me anything</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Décrivez votre projet, demandez des améliorations, ou laissez-moi vous guider
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <Message
            key={msg.id || index}
            message={msg}
            isUser={msg.role === 'user'}
            onCopy={handleCopyMessage}
            onRegenerate={() => onRegenerate?.(msg.id)}
          />
        ))}

        {/* Indicateur de frappe */}
        {isTyping && (
          <div className="flex items-start gap-3 animate-in fade-in">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-purple-500/20 text-purple-400">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-transparent">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span className="text-sm">L'agent réfléchit...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bouton "Scroll to latest" */}
      <ScrollToLatest onClick={scrollToBottom} visible={showScrollButton} />

      {/* Input bar (style Replit) */}
      <div className="border-t border-border bg-card/90 p-3">
        {/* Indicateur de sélection courante envoyée à l'IA */}
        {selection && selection.text && (
          <div
            role={onSelectionClick ? 'button' : undefined}
            tabIndex={onSelectionClick ? 0 : undefined}
            onClick={onSelectionClick ? () => onSelectionClick(selection) : undefined}
            onKeyDown={onSelectionClick ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectionClick(selection) }
            } : undefined}
            title={onSelectionClick ? 'Aller à la sélection dans l\'éditeur' : undefined}
            className={`mb-2 flex items-center gap-2 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200 ${onSelectionClick ? 'cursor-pointer hover:bg-purple-500/20 transition-colors' : ''}`}
          >
            <Paperclip className="w-3 h-3 shrink-0" />
            <span className="font-mono truncate">
              {(selection.file || currentFile || 'sélection').split('/').pop()}
              {selection.range?.startLine != null && selection.range?.endLine != null && (
                <>
                  {' '}L{selection.range.startLine}
                  {selection.range.endLine !== selection.range.startLine
                    ? `–L${selection.range.endLine}`
                    : ''}
                </>
              )}
            </span>
            <span className="text-purple-300/70 ml-auto whitespace-nowrap">
              {(() => {
                const lines =
                  selection.range?.startLine != null && selection.range?.endLine != null
                    ? selection.range.endLine - selection.range.startLine + 1
                    : (selection.text.match(/\n/g)?.length || 0) + 1
                return `${lines} ligne${lines > 1 ? 's' : ''} · ${selection.length || selection.text.length} car.`
              })()}
            </span>
            {onClearSelection && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClearSelection() }}
                title="Retirer la sélection"
                className="ml-1 p-0.5 rounded hover:bg-purple-500/30 text-purple-200/70 hover:text-purple-100 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Mode selector */}
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-[90px] h-9">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MODES.BUILD}>Build</SelectItem>
              <SelectItem value={MODES.DEBUG}>Debug</SelectItem>
              <SelectItem value={MODES.ASK}>Ask</SelectItem>
              <SelectItem value={MODES.EXPLAIN}>Explain</SelectItem>
            </SelectContent>
          </Select>

                {/* Textarea avec auto-resize */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Make, test, iterate... (Shift + Enter pour nouvelle ligne)"
              rows={1}
              className="resize-none min-h-[36px] max-h-32 pr-24"
            />
            <div className="absolute right-1 bottom-1 flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Paperclip className="w-3 h-3" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Zap className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {quickActions.map((action, i) => {
                    const Icon = action.icon
                    return (
                      <DropdownMenuItem key={i} onClick={() => onAction?.(action.action)}>
                        <Icon className="w-4 h-4 mr-2" />
                        {action.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Settings */}
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Settings className="w-4 h-4" />
          </Button>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="h-9 px-3 bg-purple-600 hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

AIChat.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSendMessage: PropTypes.func.isRequired,
  onAction: PropTypes.func.isRequired,
  onRegenerate: PropTypes.func.isRequired,
  initialMessages: PropTypes.any,
  streaming: PropTypes.any,
  projectFiles: PropTypes.object,
  currentFile: PropTypes.string,
  currentFileContent: PropTypes.string,
  selection: PropTypes.string,
  openFiles: PropTypes.arrayOf(PropTypes.string),
  onClearSelection: PropTypes.func,
  onSelectionClick: PropTypes.func,
  editor: PropTypes.object,
};

export default AIChat
ActionItem.propTypes = {
  action: PropTypes.any.isRequired,
  isLast: PropTypes.bool.isRequired,
};
ActionGroup.propTypes = {
  actions: PropTypes.array.isRequired,
};
Message.propTypes = {
  message: PropTypes.object.isRequired,
  isUser: PropTypes.bool.isRequired,
  onCopy: PropTypes.func.isRequired,
  onRegenerate: PropTypes.func.isRequired,
};
ScrollToLatest.propTypes = {
  onClick: PropTypes.func.isRequired,
  visible: PropTypes.bool.isRequired,
};
