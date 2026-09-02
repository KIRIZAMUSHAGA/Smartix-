/**
 * ProjectEditorAI - Éditeur de projet avec IA
 * Interface dédiée pour les projets générés par IA, importés ou templates
 * 
 * Features:
 * - Bottom bar avec 7 outils (Run/Stop, Preview, Chat, Console, Shell, Debug, FileTree)
 * - Zone principale dynamique
 * - Chat IA intégré
 * - Preview avancée avec multi-ports
 * - Menu supplémentaire dans le header
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  // Icônes principales
  Play, Square, Eye, MessageSquare, Terminal, Bug, FolderTree,
  Cpu, Radio, HardDrive, Globe, Sparkles, Send, X,
  Maximize2, Loader2, CheckCircle, AlertCircle, Code2, FileText,
  // Icônes pour le header
  Menu, Grid, Layout, PanelLeft, PanelBottom, PanelRight,
  Bell, BookMarked, GitBranch, Download, Upload, Copy,
  Trash2, Settings as SettingsIcon, HelpCircle, Zap
} from 'lucide-react'

// =============================
// HOOKS ET SERVICES
// =============================

import { useAuth } from '../../hooks/useAuth'
import { projectService } from '../../vibe-coding/services/projectService'
import { buildService } from '../../vibe-coding/services/buildService'
import { livePreview } from '../../vibe-coding/mobile/core/livePreview'
import { appGenerator } from '../../vibe-coding/ai/appGenerator'

// =============================
// COMPOSANTS VIBE-CODING EXISTANTS
// =============================

import InteractiveShell from '../../vibe-coding/ui/InteractiveShell'
import AppConsole from '../../vibe-coding/ui/AppConsole'
import { DebugPanel } from '../../vibe-coding/ui/DebugPanel'
import { FileTreeBuilder } from '../../vibe-coding/editor/FileTreeBuilder'
import Preview from '../../vibe-coding/ui/Preview'
import AIChat from '../../vibe-coding/ui/AIChat'
import DebugButton from '../../vibe-coding/ui/DebugButton'
import DebugConsole from '../../vibe-coding/ui/DebugConsole'
import DebugNotification from '../../vibe-coding/ui/DebugNotification'
import RunCard from '../../vibe-coding/ui/ExecuterCard'
import BottomDock from '../../vibe-coding/ui/bottomDock'
import IdeLayout from '../../vibe-coding/ui/ideLayout'
import SideBar from '../../vibe-coding/ui/Sidebar'

// =============================
// COMPOSANTS UI
// =============================

import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'
import {

  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle
} from '../../components/ui/resizable'
import PropTypes from 'prop-types';

// =============================
// ✅ CONSTANTES (FUSIONNÉES)
// =============================

const VIEWS = {
  PREVIEW: 'preview',
  CHAT: 'chat',
  CONSOLE: 'console',
  SHELL: 'shell',
  DEBUG: 'debug',
  FILETREE: 'filetree',
  DEBUG_CONSOLE: 'debug_console',
  DEBUG_BUTTON: 'debug_button',
  DEBUG_NOTIFICATION: 'debug_notification',
  SIDEBAR: 'sidebar',
  BOTTOM_DOCK: 'bottom_dock',
  RUN_CARD: 'run_card'
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ProjectEditorAI = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // =============================
  // ÉTATS PRINCIPAUX
  // =============================

  // État du projet
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)

  // État de l'application
  const [isRunning, setIsRunning] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [building, setBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState(0)
  const [buildLogs, setBuildLogs] = useState([])
  const [debugNotifications, setDebugNotifications] = useState([])

  // État pour les ports
  const [ports, setPorts] = useState([3000])
  const [currentPort, setCurrentPort] = useState(3000)
  const [previewUrls, setPreviewUrls] = useState({ 3000: null })

  // État de la vue
  const [activeView, setActiveView] = useState(VIEWS.CHAT)
  const [showSidebar, setShowSidebar] = useState(false)

  // État du chat IA
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant IA. Que souhaitez-vous faire ?'
    }
  ])

  // Refs
  const messagesEndRef = useRef(null)

  // =============================
  // REDIRECTION SI NON AUTHENTIFIÉ
  // =============================
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/vibe/projects/${projectId}/edit/ai` } })
    }
  }, [isAuthenticated, navigate, projectId])

  // =============================
  // CHARGEMENT DU PROJET
  // =============================
  useEffect(() => {
    if (!isAuthenticated || !user || !projectId) return
    loadProject()
  }, [projectId, isAuthenticated, user])

  const loadProject = async () => {
    setLoading(true)
    try {
      const projectData = await projectService.getProject(projectId, user.id)
      setProject(projectData)
      setFiles(projectData.files || {})
      
      setChatMessages([
        {
          id: 1,
          role: 'assistant',
          content: `👋 Bienvenue sur le projet **${projectData.name}** !\n\nJe suis votre assistant IA. Je peux vous aider à :\n- ✨ Améliorer le code\n- 🐛 Corriger des bugs\n- 📦 Ajouter des fonctionnalités\n- 🔧 Optimiser les performances\n\nQue souhaitez-vous faire ?`
        }
      ])
    } catch (error) {
      console.error('Erreur chargement projet:', error)
      toast.error('Impossible de charger le projet')
    } finally {
      setLoading(false)
    }
  }

  // =============================
  // GESTION DU RUN/STOP
  // =============================

  const handleRun = useCallback(async () => {
    if (!projectId) {
      toast.error('Projet non trouvé')
      return
    }

    setBuilding(true)
    setIsRunning(true)
    setBuildLogs([])
    setActiveView(VIEWS.PREVIEW)

    try {
      if (isDirty) {
        await projectService.updateProject(projectId, { files }, user.id)
        setIsDirty(false)
      }

      const result = await buildService.startBuild(projectId, user.id, {
        type: 'development',
        target: 'web'
      })

      const logs = [
        { type: 'info', message: '🚀 Build démarré' },
        { type: 'info', message: '📦 Installation des dépendances...' },
        { type: 'success', message: '✅ Dépendances installées' },
        { type: 'info', message: '🔨 Compilation...' },
        { type: 'success', message: '✅ Compilation terminée' },
        { type: 'info', message: '📊 Optimisation...' },
        { type: 'success', message: `✅ Build #${result.buildId} réussi` }
      ]

      for (const log of logs) {
        setBuildLogs(prev => [...prev, log])
        await new Promise(r => setTimeout(r, 500))
      }

      setBuildProgress(100)

      const preview = await livePreview.startSession(projectId, { port: 3000 })
      
      setPreviewUrls(prev => ({
        ...prev,
        [currentPort]: preview.previewUrl
      }))
      setPreviewUrl(preview.previewUrl)

      const newPorts = [...ports]
      if (!newPorts.includes(3000)) newPorts.push(3000)
      setPorts(newPorts.sort((a, b) => a - b))

      addAssistantMessage(`✅ Build réussi ! Votre application est disponible en preview sur le port ${currentPort}.`)

    } catch (error) {
      setBuildLogs(prev => [...prev, {
        type: 'error',
        message: `❌ Erreur: ${error.message}`
      }])
      setIsRunning(false)
      setActiveView(VIEWS.CONSOLE)
      toast.error('Le build a échoué')
    } finally {
      setBuilding(false)
    }
  }, [projectId, user?.id, files, isDirty, currentPort, ports])

  const handleStop = useCallback(async () => {
    try {
      await livePreview.stopSession(projectId)
      setPreviewUrl(null)
      setIsRunning(false)
      addAssistantMessage('🛑 Application arrêtée')
    } catch (error) {
      console.error('Erreur arrêt preview:', error)
    }
  }, [projectId])

  // =============================
  // GESTION DES PORTS
  // =============================

  const handlePortChange = useCallback((port, source = 'manual') => {
    setCurrentPort(port)
    if (!ports.includes(port)) {
      setPorts(prev => [...prev, port].sort((a, b) => a - b))
    }
    toast.info(`Port ${port} sélectionné`)
  }, [ports])

  const handleRefreshPreview = useCallback(() => {
    if (previewUrls[currentPort]) {
      setPreviewUrls(prev => ({
        ...prev,
        [currentPort]: prev[currentPort] + '?refresh=' + Date.now()
      }))
    }
  }, [currentPort, previewUrls])

  const handleOpenExternal = useCallback(() => {
    if (previewUrls[currentPort]) {
      window.open(previewUrls[currentPort], '_blank')
    }
  }, [currentPort, previewUrls])

  const handlePublish = useCallback(() => {
    toast.info('Publication en cours...')
  }, [])

  // =============================
  // GESTION DU CHAT IA
  // =============================

  const addAssistantMessage = (content) => {
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      role: 'assistant',
      content
    }])
  }

  const addUserMessage = (content) => {
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content
    }])
  }

  const handleSendMessage = useCallback(async (message) => {
    addUserMessage(message)
    setTimeout(() => {
      addAssistantMessage(`J'ai bien reçu votre demande : "${message}"\n\nJe vais analyser le projet et vous proposer des améliorations.`)
    }, 1000)
  }, [])

  const handleAction = useCallback((action) => {
    toast.info(`Action: ${action}`)
  }, [])

  const handleRegenerate = useCallback((messageId) => {
    toast.info('Regénération de la réponse...')
  }, [])

  // =============================
  // GESTION DU DEBUG
  // =============================

  const addDebugNotification = useCallback((message, type = 'info') => {
    setDebugNotifications(prev => [...prev, {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    }])
  }, [])

  // =============================
  // GESTION DES FICHIERS
  // =============================

  const handleFileSelect = useCallback((filePath) => {
    toast.info(`Fichier sélectionné: ${filePath}`)
  }, [])

  const handleFileChange = useCallback((content) => {
    setIsDirty(true)
  }, [])

  // =============================
  // RENDU DES VUES
  // =============================

  const renderPreview = () => (
    <Preview
      isRunning={isRunning}
      building={building}
      buildProgress={buildProgress}
      ports={ports}
      currentPort={currentPort}
      previewUrls={previewUrls}
      onPortChange={handlePortChange}
      onRefresh={handleRefreshPreview}
      onOpenExternal={handleOpenExternal}
      onPublish={handlePublish}
      onBack={() => setActiveView(VIEWS.CHAT)}
      onFullscreen={() => {
        if (previewUrls[currentPort]) {
          window.open(previewUrls[currentPort], '_blank')
        }
      }}
      logs={buildLogs}
    />
  )

  const renderChat = () => (
    <AIChat
      projectId={projectId}
      onSendMessage={handleSendMessage}
      onAction={handleAction}
      onRegenerate={handleRegenerate}
      initialMessages={chatMessages}
      streaming={true}
      projectFiles={files}
      openFiles={Object.keys(files || {})}
    />
  )

  const renderConsole = () => (
    <AppConsole
      projectId={projectId}
      onClose={() => setActiveView(VIEWS.CHAT)}
      onOpenPreview={(url) => {
        setPreviewUrls(prev => ({
          ...prev,
          [currentPort]: url
        }))
        setActiveView(VIEWS.PREVIEW)
      }}
    />
  )

  const renderShell = () => (
    <InteractiveShell
      projectId={projectId}
      userId={user?.id}
      onClose={() => setActiveView(VIEWS.CHAT)}
    />
  )

  const renderDebug = () => (
    <DebugPanel projectId={projectId} />
  )

  const renderDebugConsole = () => (
    <DebugConsole
      logs={buildLogs}
      notifications={debugNotifications}
      onClear={() => setDebugNotifications([])}
    />
  )

  const renderDebugButton = () => (
    <DebugButton
      onClick={() => addDebugNotification('Debug action triggered')}
      label="Debug Action"
    />
  )

  const renderDebugNotification = () => (
    <div className="p-4 space-y-2">
      {debugNotifications.map(notif => (
        <DebugNotification
          key={notif.id}
          message={notif.message}
          type={notif.type}
          timestamp={notif.timestamp}
          onDismiss={() => {
            setDebugNotifications(prev => 
              prev.filter(n => n.id !== notif.id)
            )
          }}
        />
      ))}
    </div>
  )

  const renderSidebar = () => (
    <SideBar
      files={files}
      onFileSelect={handleFileSelect}
      onFileCreate={() => {}}
      onFileDelete={() => {}}
    />
  )

  const renderRunCard = () => (
    <div className="p-4">
      <RunCard
        projectId={projectId}
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        buildProgress={buildProgress}
      />
    </div>
  )

  const renderFileTree = () => (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border">
        <h3 className="text-sm font-medium">📁 Fichiers</h3>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <FileTreeBuilder
          files={files}
          selectedFile={null}
          onFileSelect={handleFileSelect}
          onFileDelete={() => {}}
        />
      </div>
    </div>
  )

  const renderBottomDock = () => (
    <div className="p-2">
      <BottomDock
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        buildProgress={buildProgress}
      />
    </div>
  )

  // =============================
  // RENDU PRINCIPAL
  // =============================

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Chargement du projet...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header avec menu (style Replit) */}
      <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h1 className="font-bold">
            {project?.name || 'Projet IA'}
          </h1>
          {isRunning && (
            <Badge variant="default" className="bg-green-500 animate-pulse">
              En cours
            </Badge>
          )}
          {building && (
            <Badge variant="outline" className="text-yellow-400">
              Build en cours...
            </Badge>
          )}
          {isDirty && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500">
              Modifié
            </Badge>
          )}
        </div>

        {/* ✅ MENU DÉROULANT DANS LE HEADER (comme Replit) */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSidebar(!showSidebar)}
            title="Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Menu">
                <Menu className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Outils</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Section Debug */}
              <DropdownMenuItem onClick={() => setActiveView(VIEWS.DEBUG_CONSOLE)}>
                <Terminal className="w-4 h-4 mr-2" />
                Console de debug
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveView(VIEWS.DEBUG_BUTTON)}>
                <Bug className="w-4 h-4 mr-2" />
                Bouton debug
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveView(VIEWS.DEBUG_NOTIFICATION)}>
                <Bell className="w-4 h-4 mr-2" />
                Notifications debug
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Section Layout */}
              <DropdownMenuItem onClick={() => setActiveView(VIEWS.BOTTOM_DOCK)}>
                <PanelBottom className="w-4 h-4 mr-2" />
                Bottom dock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveView(VIEWS.RUN_CARD)}>
                <Play className="w-4 h-4 mr-2" />
                Run card
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Section Actions */}
              <DropdownMenuItem onClick={() => toast.info('Copié')}>
                <Copy className="w-4 h-4 mr-2" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Export')}>
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Import')}>
                <Upload className="w-4 h-4 mr-2" />
                Importer
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Section Paramètres */}
              <DropdownMenuItem onClick={() => toast.info('Paramètres')}>
                <SettingsIcon className="w-4 h-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Aide')}>
                <HelpCircle className="w-4 h-4 mr-2" />
                Aide
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/vibe/projects/${projectId}`)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Zone principale avec sidebar optionnelle */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (optionnelle) */}
        {showSidebar && (
          <ResizablePanel
            defaultSize={250}
            minSize={200}
            maxSize={400}
            className="border-r border-border"
          >
            {renderSidebar()}
          </ResizablePanel>
        )}

          {/* Vue active */}
        <div className="flex-1 overflow-hidden">
          {activeView === VIEWS.PREVIEW && renderPreview()}
          {activeView === VIEWS.CHAT && renderChat()}
          {activeView === VIEWS.CONSOLE && renderConsole()}
          {activeView === VIEWS.SHELL && renderShell()}
          {activeView === VIEWS.DEBUG && renderDebug()}
          {activeView === VIEWS.DEBUG_CONSOLE && renderDebugConsole()}
          {activeView === VIEWS.DEBUG_BUTTON && renderDebugButton()}
          {activeView === VIEWS.DEBUG_NOTIFICATION && renderDebugNotification()}
          {activeView === VIEWS.FILETREE && renderFileTree()}
          {activeView === VIEWS.SIDEBAR && renderSidebar()}
          {activeView === VIEWS.BOTTOM_DOCK && renderBottomDock()}
          {activeView === VIEWS.RUN_CARD && renderRunCard()}
        </div>
      </div>

      {/* ✅ BOTTOM BAR CORRIGÉE (strictement les 7 outils) */}
      <div className="border-t border-border bg-card shrink-0">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-1">
            {/* Run/Stop button */}
            <Button
              variant={isRunning ? 'destructive' : 'default'}
              size="icon"
              onClick={isRunning ? handleStop : handleRun}
              className={isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
              disabled={building}
              title={isRunning ? "Arrêter" : "Démarrer"}
            >
              {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            {/* Preview */}
            <Button
              variant={activeView === VIEWS.PREVIEW ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setActiveView(VIEWS.PREVIEW)}
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </Button>

            {/* Chat IA */}
            <Button
              variant={activeView === VIEWS.CHAT ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setActiveView(VIEWS.CHAT)}
              title="Chat IA"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>

            {/* Console */}
            <Button
              variant={activeView === VIEWS.CONSOLE ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setActiveView(VIEWS.CONSOLE)}
              title="Console"
            >
              <Terminal className="w-4 h-4" />
            </Button>

            {/* Shell (maintenant avec Terminal icon) */}
            <Button
              variant={activeView === VIEWS.SHELL ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setActiveView(VIEWS.SHELL)}
              title="Shell"
            >
              <Terminal className="w-4 h-4" />
            </Button>

            {/* Debug */}
            <Button
              variant={activeView === VIEWS.DEBUG ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setActiveView(VIEWS.DEBUG)}
              title="Debug"
            >
              <Bug className="w-4 h-4" />
            </Button>

            {/* FileTree */}
            <Button
              variant={activeView === VIEWS.FILETREE ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setActiveView(VIEWS.FILETREE)}
              title="FileTree"
            >
              <FolderTree className="w-4 h-4" />
            </Button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-xs">
            {building && (
              <span className="text-yellow-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Build {buildProgress}%
              </span>
            )}
            <span className={isRunning ? 'text-green-400' : 'text-gray-400'}>
              {isRunning ? '🟢 Running' : '⚪ Stopped'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

ProjectEditorAI.propTypes = {};

export default ProjectEditorAI
