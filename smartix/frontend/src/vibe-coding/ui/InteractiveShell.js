/**
 * InteractiveShell - Terminal interactif style Replit
 * Version ULTIME avec VariableSizeList, curseur isolé, et architecture robuste
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { VariableSizeList as List } from 'react-window'
import { Terminal, Send, X, RefreshCw, Copy, Search, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card } from '../../components/ui/card'
import { toast } from 'sonner'

// Service shell sécurisé
import { shellService } from '../services/shellService'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const COMMANDS = {
  HELP: 'help',
  CLEAR: 'clear',
  LS: 'ls',
  PWD: 'pwd',
  CAT: 'cat',
  NPM_INSTALL: 'npm install',
  NPM_RUN_BUILD: 'npm run build',
  NPM_START: 'npm start',
  GIT_STATUS: 'git status'
}

const AUTOCOMPLETE_MAP = {
  'np': 'npm',
  'npm i': 'npm install',
  'npm ru': 'npm run',
  'npm run bu': 'npm run build',
  'npm run star': 'npm start',
  'gi': 'git',
  'git st': 'git status'
}

const MAX_VISIBLE_LINES = 1000
const BASE_LINE_HEIGHT = 24
const INPUT_LINE_HEIGHT = 28

// =============================
// UTILITAIRES DE TEXTE
// =============================

const measureTextWidth = (text, fontSize = 14) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${fontSize}px Menlo, Monaco, Consolas, monospace`
  return ctx.measureText(text).width
}

const getLineHeight = (content, maxWidth = 800) => {
  const width = measureTextWidth(content)
  const lines = Math.ceil(width / maxWidth)
  return BASE_LINE_HEIGHT * (lines || 1)
}

// =============================
// UTILITAIRES DE CURSEUR ROBUSTES
// =============================

class CaretManager {
  constructor(element) {
    this.element = element
    this.treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  }

  setPosition(absolutePosition) {
    if (!this.element) return false

    const range = document.createRange()
    const sel = window.getSelection()
    
    this.treeWalker = document.createTreeWalker(this.element, NodeFilter.SHOW_TEXT)
    let currentPos = 0
    let targetNode = null
    let targetOffset = 0

    while (this.treeWalker.nextNode()) {
      const node = this.treeWalker.currentNode
      const nodeLength = node.length
      const nextPos = currentPos + nodeLength

      if (absolutePosition <= nextPos) {
        targetNode = node
        targetOffset = absolutePosition - currentPos
        break
      }

      currentPos = nextPos
    }

    if (!targetNode && this.element.lastChild) {
      const lastTextNode = this._findLastTextNode(this.element)
      if (lastTextNode) {
        targetNode = lastTextNode
        targetOffset = lastTextNode.length
      }
    }

    if (targetNode) {
      range.setStart(targetNode, Math.min(targetOffset, targetNode.length))
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return true
    }

    return false
  }

  getPosition() {
    const sel = window.getSelection()
    if (!sel.rangeCount) return 0

    const range = sel.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(this.element)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    return preCaretRange.toString().length
  }

  _findLastTextNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node
    
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const found = this._findLastTextNode(node.childNodes[i])
      if (found) return found
    }
    return null
  }

  insertAtCaret(text) {
    const sel = window.getSelection()
    if (!sel.rangeCount) return

    const range = sel.getRangeAt(0)
    range.deleteContents()
    
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    
    sel.removeAllRanges()
    sel.addRange(range)
  }

  insertNewLine() {
    const sel = window.getSelection()
    if (!sel.rangeCount) return

    const range = sel.getRangeAt(0)
    const br = document.createElement('br')
    range.deleteContents()
    range.insertNode(br)
    
    const textNode = document.createTextNode('')
    range.setStartAfter(br)
    range.insertNode(textNode)
    range.setStart(textNode, 0)
    range.collapse(true)
    
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

// =============================
// COMPOSANT DE LIGNE VIRTUALISÉE
// =============================
const HistoryLine = ({ data, index, style, onCopyLine, containerWidth }) => {
  const item = data[index]
  if (!item) return null

  const lineHeight = item.type === 'input' 
    ? INPUT_LINE_HEIGHT 
    : getLineHeight(item.content, containerWidth)

  const getLineContent = () => {
    if (item.type === 'input') {
      return (
        <div className="flex items-start gap-2">
          <span className="text-blue-400 select-none shrink-0 font-bold">
            {item.cwd || '/project'}
          </span>
          <span className="text-green-400 select-none shrink-0">$</span>
          <span className="text-white break-words flex-1">{item.content.substring(2)}</span>
        </div>
      )
    }
    if (item.type === 'output') {
      return <div className="text-gray-300 ml-8 break-words">{item.content}</div>
    }
    if (item.type === 'error') {
      return <div className="text-red-400 ml-8 break-words">{item.content}</div>
    }
    if (item.type === 'system') {
      return <div className="text-blue-400 ml-8 break-words">{item.content}</div>
    }
    return null
  }

  return (
    <div 
      style={{ ...style, height: lineHeight }}
      className="whitespace-pre-wrap group relative hover:bg-green-500/5"
      onDoubleClick={() => onCopyLine(item.content)}
    >
      {getLineContent()}
      <button
        onClick={() => onCopyLine(item.content)}
        className="absolute right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Copy className="w-3 h-3 text-gray-500 hover:text-green-400" />
      </button>
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL
//==============================
const InteractiveShell = ({ projectId, userId, onClose }) => {
  // États
  const [history, setHistory] = useState([])
  const [command, setCommand] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 })
  const [loading, setLoading] = useState(false)
  const [cwd, setCwd] = useState('/project')
  const [sessionId, setSessionId] = useState(null)
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [lastCommand, setLastCommand] = useState('')
  const [absoluteCaretPosition, setAbsoluteCaretPosition] = useState(0)
  const [isMultiline, setIsMultiline] = useState(false)
  const [streamQueue, setStreamQueue] = useState([])
  const [userScrolled, setUserScrolled] = useState(false)
  const [containerWidth, setContainerWidth] = useState(800)

  // Refs
  const listRef = useRef(null)
  const containerRef = useRef(null)
  const commandLineRef = useRef(null)
  const searchInputRef = useRef(null)
  const animationFrameRef = useRef(null)
  const caretManagerRef = useRef(null)
  const lineHeightsRef = useRef(new Map())
  const lastScrollTopRef = useRef(0)

  // =============================
  // INITIALISATION
  // =============================
  useEffect(() => {
    const initSession = async () => {
      try {
        const id = await shellService.createSession(projectId)
        setSessionId(id)
        
        const currentDir = await shellService.getWorkingDirectory(projectId, id)
        setCwd(currentDir)
        
        setHistory([{ 
          id: `init-${Date.now()}`, 
          type: 'system', 
          content: 'Shell interactif prêt. Tapez "help" pour les commandes disponibles.' 
        }])
        
        toast.success('Session shell initialisée')
      } catch (error) {
        toast.error('Erreur initialisation shell', {
          description: error.message
        })
      }
    }

    if (projectId) {
      initSession()
    }

    return () => {
      if (sessionId) {
        shellService.closeSession(projectId, sessionId)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      shellService.destroy?.()
    }
  }, [projectId])

  // =============================
  // MESURE DES LIGNES
  // =============================
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateContainerWidth()
    window.addEventListener('resize', updateContainerWidth)
    return () => window.removeEventListener('resize', updateContainerWidth)
  }, [])

  const getLineHeight = useCallback((index) => {
    const item = history[index]
    if (!item) return BASE_LINE_HEIGHT
    
    const key = `${item.id}-${containerWidth}`
    if (lineHeightsRef.current.has(key)) {
      return lineHeightsRef.current.get(key)
    }

    let height
    if (item.type === 'input') {
      height = INPUT_LINE_HEIGHT
    } else {
      height = (() => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        ctx.font = '14px Menlo, Monaco, Consolas, monospace'
        const width = ctx.measureText(item.content).width
        const lines = Math.ceil(width / (containerWidth - 32))
        return BASE_LINE_HEIGHT * (lines || 1)
      })()
    }

    lineHeightsRef.current.set(key, height)
    return height
  }, [history, containerWidth])

  // =============================
  // DÉTECTION SCROLL UTILISATEUR
  // =============================
  const handleScroll = useCallback(({ scrollOffset }) => {
    const isUserScrolling = Math.abs(scrollOffset - lastScrollTopRef.current) > 10
    if (isUserScrolling) {
      setUserScrolled(true)
    }
    lastScrollTopRef.current = scrollOffset
  }, [])

  // =============================
  // STREAMING OPTIMISÉ
  // =============================
  useEffect(() => {
    if (streamQueue.length === 0) return

    const flushStream = () => {
      setHistory(prev => {
        const newHistory = [...prev, ...streamQueue]
        if (newHistory.length > MAX_VISIBLE_LINES) {
          return newHistory.slice(-MAX_VISIBLE_LINES)
        }
        return newHistory
      })
      setStreamQueue([])
      lineHeightsRef.current.clear()
      animationFrameRef.current = null

      // Auto-scroll seulement si l'utilisateur n'a pas scrollé
      if (!userScrolled && listRef.current) {
        listRef.current.scrollToItem(history.length + streamQueue.length - 1, 'end')
      }
    }

    animationFrameRef.current = requestAnimationFrame(flushStream)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [streamQueue, history.length, userScrolled])

  const addToHistory = useCallback((items) => {
    setStreamQueue(prev => [...prev, ...items])
  }, [])

  // =============================
  // GESTION DU CURSEUR
  // =============================
  useEffect(() => {
    if (commandLineRef.current && !loading) {
      if (!caretManagerRef.current) {
        caretManagerRef.current = new CaretManager(commandLineRef.current)
      }
      caretManagerRef.current.setPosition(absoluteCaretPosition)
    }
  }, [absoluteCaretPosition, command, loading])

  // Focus automatique
  useEffect(() => {
    commandLineRef.current?.focus()
  }, [])

  // Mise à jour de la position de la suggestion
  const updateSuggestionPosition = useCallback(() => {
    if (!commandLineRef.current || !suggestion) return

    const sel = window.getSelection()
    if (!sel.rangeCount) return

    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = commandLineRef.current.getBoundingClientRect()

    setSuggestionPosition({
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left
    })
  }, [suggestion])

  // =============================
  // GESTION DU CONTENTEDITABLE
  // =============================
  const handleCommandInput = (e) => {
    const newCommand = e.target.textContent || ''
    setCommand(newCommand)
    
    if (caretManagerRef.current) {
      setAbsoluteCaretPosition(caretManagerRef.current.getPosition())
    }
    
    updateSuggestion(newCommand)
    updateSuggestionPosition()
  }

  const handleCommandKeyDown = (e) => {
    // Ctrl+C (annulation)
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault()
      if (loading) {
        executeCommand('ctrl+c')
      }
      return
    }

    // Ctrl+F (recherche)
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      setSearchMode(true)
      setTimeout(() => searchInputRef.current?.focus(), 100)
      return
    }

    // Shift+Enter (multiline)
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      setIsMultiline(true)
      caretManagerRef.current?.insertNewLine()
      if (caretManagerRef.current) {
        setAbsoluteCaretPosition(caretManagerRef.current.getPosition())
      }
      setCommand(commandLineRef.current?.textContent || '')
      return
    }

    // Entrée (exécution)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (searchMode) {
        setSearchMode(false)
      } else {
        executeCommand()
      }
    }

    // Échap (sortir de recherche)
    if (e.key === 'Escape') {
      setSearchMode(false)
      setSearchQuery('')
      commandLineRef.current?.focus()
    }

    // Tab (autocomplétion)
    if (e.key === 'Tab' && !searchMode) {
      e.preventDefault()
      if (suggestion) {
        setCommand(suggestion)
        commandLineRef.current.textContent = suggestion
        caretManagerRef.current?.setPosition(suggestion.length)
        setAbsoluteCaretPosition(suggestion.length)
        setSuggestion('')
      }
    }

    // Flèche haut (historique)
    if (e.key === 'ArrowUp' && !searchMode) {
      e.preventDefault()
      if (commandHistory.length === 0) return
      
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
      setHistoryIndex(newIndex)
      const previousCmd = commandHistory[commandHistory.length - 1 - newIndex]
      setCommand(previousCmd || '')
      commandLineRef.current.textContent = previousCmd || ''
      caretManagerRef.current?.setPosition(previousCmd?.length || 0)
      setAbsoluteCaretPosition(previousCmd?.length || 0)
      updateSuggestion(previousCmd || '')
    }

    // Flèche bas (historique)
    if (e.key === 'ArrowDown' && !searchMode) {
      e.preventDefault()
      const newIndex = Math.max(historyIndex - 1, -1)
      setHistoryIndex(newIndex)
      
      if (newIndex === -1) {
        setCommand('')
        commandLineRef.current.textContent = ''
        caretManagerRef.current?.setPosition(0)
        setAbsoluteCaretPosition(0)
        setSuggestion('')
      } else {
        const nextCmd = commandHistory[commandHistory.length - 1 - newIndex]
        setCommand(nextCmd || '')
        commandLineRef.current.textContent = nextCmd || ''
        caretManagerRef.current?.setPosition(nextCmd?.length || 0)
        setAbsoluteCaretPosition(nextCmd?.length || 0)
        updateSuggestion(nextCmd || '')
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Supprime les caractères non ASCII
      .replace(/\r\n/g, '\n')
    
    caretManagerRef.current?.insertAtCaret(text)
    setCommand(commandLineRef.current?.textContent || '')
    if (caretManagerRef.current) {
      setAbsoluteCaretPosition(caretManagerRef.current.getPosition())
    }
  }

  // =============================
  // COMMANDES
  // =============================
  const handleBuiltInCommand = (cmd) => {
    if (cmd === COMMANDS.CLEAR) {
      setHistory([])
      lineHeightsRef.current.clear()
      return true
    }

    if (cmd === COMMANDS.HELP) {
      const helpOutput = [
        { type: 'output', content: 'Commandes disponibles:' },
        { type: 'output', content: '  help              - Affiche cette aide' },
        { type: 'output', content: '  clear             - Efface le terminal' },
        { type: 'output', content: '  ls                - Liste les fichiers' },
        { type: 'output', content: '  pwd               - Affiche le répertoire courant' },
        { type: 'output', content: '  cat <file>        - Affiche le contenu d\'un fichier' },
        { type: 'output', content: '  npm install       - Installe les dépendances' },
        { type: 'output', content: '  npm run build     - Lance le build' },
        { type: 'output', content: '  npm start         - Lance le serveur de dev' },
        { type: 'output', content: '  git status        - État Git' },
      ]
      
      addToHistory([
        { id: `input-${Date.now()}`, type: 'input', content: `$ ${cmd}`, cwd },
        ...helpOutput.map(line => ({ 
          ...line, 
          id: `help-${Date.now()}-${Math.random()}` 
        }))
      ])
      return true
    }

    return false
  }

  const executeCommand = async (customCmd = null) => {
    const cmd = customCmd || command.trim()
    if (!cmd || !sessionId) return

    setLastCommand(cmd)
    setCommandHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)
    setCommand('')
    commandLineRef.current.textContent = ''
    setAbsoluteCaretPosition(0)
    setSuggestion('')
    setLoading(true)
    setIsMultiline(false)
    setUserScrolled(false)

    if (handleBuiltInCommand(cmd)) {
      setLoading(false)
      return
    }

    if (cmd === 'ctrl+c') {
      shellService.cancelCommand(sessionId)
      addToHistory([
        { id: `input-${Date.now()}`, type: 'input', content: `$ ${cmd}`, cwd },
        { id: `system-${Date.now()}`, type: 'system', content: 'Commande annulée' }
      ])
      setLoading(false)
      return
    }

    try {
      addToHistory([
        { id: `input-${Date.now()}`, type: 'input', content: `$ ${cmd}`, cwd }
      ])

      const result = await shellService.executeCommand(
        projectId,
        sessionId,
        cmd,
        {
          onProgress: (data) => {
            if (data.type === 'logs') {
              const logs = data.payload.map(log => ({
                id: `log-${Date.now()}-${Math.random()}`,
                type: log.channel === 'stderr' ? 'error' : 'output',
                content: log.data
              }))
              addToHistory(logs)
            }
          },
          useCache: cmd.startsWith('ls') || cmd === 'pwd'
        },
        { cwd }
      )

      if (result.cwd) setCwd(result.cwd)

      if (result.output) {
        const outputLines = result.output.split('\n').map(line => ({
          id: `out-${Date.now()}-${Math.random()}`,
          type: 'output',
          content: line
        }))
        addToHistory(outputLines)
      }

      if (result.error) {
        addToHistory([
          { id: `err-${Date.now()}`, type: 'error', content: result.error }
        ])
      }

    } catch (error) {
      addToHistory([
        { id: `err-${Date.now()}`, type: 'error', content: `Erreur: ${error.message}` }
      ])
    } finally {
      setLoading(false)
    }
  }

  
  // =============================
  // AUTOCOMPLÉTION
  // =============================
  const updateSuggestion = (currentCmd) => {
    if (!currentCmd) {
      setSuggestion('')
      return
    }

    for (const [partial, full] of Object.entries(AUTOCOMPLETE_MAP)) {
      if (partial === currentCmd || full.startsWith(currentCmd)) {
        setSuggestion(full)
        return
      }
    }
    setSuggestion('')
  }

  // =============================
  // UTILITAIRES
  // =============================
  const clearTerminal = () => {
    setHistory([])
    lineHeightsRef.current.clear()
  }

  const copyToClipboard = () => {
    const text = history
      .map(item => {
        if (item.type === 'input') return item.content
        return item.content
      })
      .join('\n')
    
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papiers')
  }

  const copyLine = (content) => {
    navigator.clipboard.writeText(content)
    toast.success('Ligne copiée')
  }

  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history
    return history.filter(item => 
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [history, searchQuery])

  const userPrompt = `${userId?.substring(0, 4) || 'user'}@vibe:${cwd}$`

  // =============================
  // RENDU
  // =============================
  return (
    <Card className="h-full flex flex-col bg-black text-green-400 font-mono overflow-hidden">
      {/* Barre de contexte */}
      <div className="flex items-center justify-between p-2 border-b border-green-500/30 bg-black/90 shrink-0 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-blue-400">{cwd}</span>
            <span className="text-gray-500">:</span>
            <span className="text-white/80">{lastCommand || ' '}</span>
          </div>
          {loading && (
            <span className="text-yellow-400 animate-pulse flex items-center gap-1">
              <span className="w-1 h-1 bg-yellow-400 rounded-full animate-ping" />
              En cours...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchMode(true)}
            className="h-5 w-5 text-green-400 hover:text-green-300"
            title="Rechercher (Ctrl+F)"
          >
            <Search className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearTerminal}
            className="h-5 w-5 text-green-400 hover:text-green-300"
            title="Effacer"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-5 w-5 text-green-400 hover:text-green-300"
            title="Fermer"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Barre de recherche */}
      {searchMode && (
        <div className="p-2 border-b border-green-500/30 bg-black/90 flex items-center gap-2">
          <Search className="w-3 h-3 text-green-400" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans le terminal..."
            className="flex-1 bg-transparent border-0 text-green-400 placeholder:text-green-800 focus-visible:ring-0 h-6 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && setSearchMode(false)}
          />
          <span className="text-xs text-gray-500">
            {filteredHistory.length} résultat(s)
          </span>
        </div>
      )}

      {/* Zone de terminal virtualisée */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
      >
        <List
          ref={listRef}
          height={containerRef.current?.clientHeight || 400}
          itemCount={filteredHistory.length}
          itemSize={getLineHeight}
          itemData={filteredHistory}
          width="100%"
          onScroll={handleScroll}
          className="scrollbar-thin scrollbar-thumb-green-500/30"
        >
          {({ data, index, style }) => (
            <HistoryLine
              data={data}
              index={index}
              style={style}
              onCopyLine={copyLine}
              containerWidth={containerWidth}
            />
          )}
        </List>
      </div>

      {/* Ligne de commande active (non virtualisée) */}
      <div className="p-2 border-t border-green-500/30 bg-black/90 shrink-0">
        <div className="flex items-start gap-2 relative">
          <span className="text-blue-400 select-none shrink-0 font-bold whitespace-nowrap">
            {cwd}
          </span>
          <span className="text-green-400 select-none shrink-0">$</span>
          <div className="relative flex-1 min-w-0">
            <div
              ref={commandLineRef}
              contentEditable={!loading}
              onInput={handleCommandInput}
              onKeyDown={handleCommandKeyDown}
              onPaste={handlePaste}
              className="outline-none text-white whitespace-pre-wrap break-words"
              style={{ 
                minHeight: '1.5em',
                wordBreak: 'break-word'
              }}
              suppressContentEditableWarning={true}
            />
            {suggestion && !loading && (
              <div 
                className="absolute pointer-events-none text-green-700"
                style={{
                  top: suggestionPosition.top,
                  left: suggestionPosition.left
                }}
              >
                {suggestion}
              </div>
            )}
          </div>
        </div>

        {/* Indicateur de multiligne */}
        {isMultiline && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <ChevronRight className="w-3 h-3" />
            <span>Mode multiligne - Shift+Enter pour continuer, Enter pour exécuter</span>
          </div>
        )}
      </div>
    </Card>
  )
}

InteractiveShell.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default InteractiveShell
HistoryLine.propTypes = {
  data: PropTypes.array.isRequired,
  index: PropTypes.number.isRequired,
  style: PropTypes.object.isRequired,
  onCopyLine: PropTypes.func.isRequired,
  containerWidth: PropTypes.any.isRequired,
};
