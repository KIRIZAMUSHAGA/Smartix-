/**
 * ProjectEditor - Éditeur de code complet
 * Version ULTIME avec Preview avancé, Chat IA, terminal, console et debug
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { 
  Save, Play, Terminal, Eye, X, Menu, 
  Maximize2, Minimize2, Settings, GitBranch,
  Code2, FileText, FolderTree, Bug, Zap,
  RefreshCw, Download, Share2, ChevronRight,
  ChevronLeft, Plus, MoreVertical, Search,
  AlertCircle, CheckCircle, Loader2,
  // Nouvelles icônes
  Radio, Activity, Cpu, Server, Globe,
  MessageSquare, Sparkles
} from 'lucide-react'

// =============================
// HOOKS ET SERVICES
// =============================

// Hooks d'authentification
import { useAuth } from '../../hooks/useAuth'

// Services Vibe-coding
import { projectService } from '../../vibe-coding/services/projectService'
import { buildService } from '../../vibe-coding/services/buildService'
import { livePreview } from '../../vibe-coding/mobile/core/livePreview'
import { runtimeDebugger } from '../../vibe-coding/runtime/RuntimeDebugger'
import { shellService } from '../../vibe-coding/services/shellService'
import { useBuildProgress } from '../../vibe-coding/hooks/useBuildProgress'
import { API_BASE_URL } from '../../config/api'

// =============================
// COMPOSANTS VIBE-CODING
// =============================
import { CodeEditor } from '../../vibe-coding/editor/CodeEditor'
import { FileTreeBuilder } from '../../vibe-coding/editor/FileTreeBuilder'
import { DebugPanel } from '../../vibe-coding/ui/DebugPanel'
import { LivePreviewBar } from '../../vibe-coding/mobile/components/LivePreviewBar'
import InteractiveShell from '../../vibe-coding/ui/InteractiveShell'
import AppConsole from '../../vibe-coding/ui/AppConsole'
import RunCard from '../../vibe-coding/ui/RunCard'

// ✅ NOUVEAUX IMPORTS
import Preview from '../../vibe-coding/ui/Preview'
import AIChat from '../../vibe-coding/ui/AIChat'

// =============================
// COMPOSANTS UI
// =============================
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Skeleton } from '../../components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../../components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog'
import {

  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle
} from '../../components/ui/resizable'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const EDITOR_LAYOUTS = {
  DEFAULT: 'default',
  PREVIEW: 'preview',
  DEBUG: 'debug',
  FULLSCREEN: 'fullscreen'
}

const VIEWS = {
  CODE: 'code',
  PREVIEW: 'preview',
  CHAT: 'chat',
  CONSOLE: 'console',
  SHELL: 'shell',
  DEBUG: 'debug',
  FILETREE: 'filetree'
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ProjectEditor = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // États du projet
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState({})
  const [currentFile, setCurrentFile] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // États de l'éditeur
  const [layout, setLayout] = useState(EDITOR_LAYOUTS.DEFAULT)
  const [showFileTree, setShowFileTree] = useState(true)
  const [activeView, setActiveView] = useState(VIEWS.CODE) // ✅ Vue active
  const [showDebug, setShowDebug] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showShell, setShowShell] = useState(false)
  const [showAppConsole, setShowAppConsole] = useState(false)
  const [showAIChat, setShowAIChat] = useState(false) // ✅ Nouvel état
  const [editorSelection, setEditorSelection] = useState(null) // ✅ Sélection courante dans Monaco
  const monacoEditorRef = useRef(null) // ✅ Instance Monaco active
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [previewWidth, setPreviewWidth] = useState(400)
  const [terminalHeight, setTerminalHeight] = useState(300)

  // ✅ ÉTATS POUR LA PREVIEW (multi-ports)
  const [ports, setPorts] = useState([3000])
  const [currentPort, setCurrentPort] = useState(3000)
  const [previewUrls, setPreviewUrls] = useState({ 3000: null })

  // États du build
  const [building, setBuilding] = useState(false)
  const [buildLogs, setBuildLogs] = useState([])
  const [buildProgress, setBuildProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)

  // ─── Build temps réel via WebSocket ───────────────────────────────────────
  const [activeBuildId,   setActiveBuildId]   = useState(null)
  const [lastBuildStatus, setLastBuildStatus] = useState(null) // 'success' | 'failed' | 'cancelled'
  const { logs: wsBuildLogs, progress: wsBuildProgress, status: wsBuildStatus } =
    useBuildProgress(activeBuildId)

  // ✅ ÉTATS POUR LE CHAT IA
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '👋 Bonjour ! Je suis votre assistant IA. Je peux vous aider à améliorer votre code, corriger des bugs ou ajouter des fonctionnalités.'
    }
  ])

  // États de recherche
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)

  // États des dialogs
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState('viewer')

  // États du dialogue de génération IA
  const [showAIGenDialog, setShowAIGenDialog]   = useState(false)
  const [aiGenPrompt,     setAiGenPrompt]       = useState('')
  const [aiGenLoading,    setAiGenLoading]      = useState(false)
  const [aiGenError,      setAiGenError]        = useState(null)

  // Refs
  const editorRef = useRef(null)
  const terminalRef = useRef(null)
  const searchInputRef = useRef(null)

  // =============================
  // INITIALISATION
  // =============================

  // Redirection si non authentifié
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/vibe/projects/${projectId}/edit` } })
    }
  }, [isAuthenticated, navigate, projectId])

  // Chargement du projet
  useEffect(() => {
    if (!isAuthenticated || !user) return
    loadProject()
  }, [projectId, isAuthenticated, user])

  const loadProject = async () => {
    setLoading(true)
    try {
      const projectData = await projectService.getProject(projectId, user.id)
      setProject(projectData)
      setFiles(projectData.files || {})

      // Sélectionner le premier fichier
      const fileList = Object.keys(projectData.files || {})
      if (fileList.length > 0) {
        setCurrentFile(fileList[0])
      }

    } catch (error) {
      console.error('Erreur chargement projet:', error)
      toast.error('Impossible de charger le projet', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  // =============================
  // GESTION DES FICHIERS
  // =============================

  const handleFileSelect = useCallback((filePath) => {
    if (isDirty) {
      if (!window.confirm('Vous avez des modifications non sauvegardées. Continuer ?')) {
        return
      }
    }
    setCurrentFile(filePath)
  }, [isDirty])

  const handleFileChange = useCallback((content) => {
    setFiles(prev => ({
      ...prev,
      [currentFile]: content
    }))
    setIsDirty(true)
  }, [currentFile])

  const handleSave = useCallback(async () => {
    if (!currentFile || !isDirty) return

    setSaving(true)
    try {
      await projectService.updateProject(projectId, {
        files
      }, user.id)

      setIsDirty(false)
      toast.success('Fichier sauvegardé avec succès')

    } catch (error) {
      toast.error('Impossible de sauvegarder le fichier', {
        description: error.message
      })
    } finally {
      setSaving(false)
    }
  }, [currentFile, isDirty, files, projectId, user?.id])

  const handleCreateFile = useCallback(async () => {
    const fileName = window.prompt('Nom du fichier:')
    if (!fileName) return

    const newFiles = {
      ...files,
      [fileName]: ''
    }

    try {
      await projectService.updateProject(projectId, {
        files: newFiles
      }, user.id)

      setFiles(newFiles)
      setCurrentFile(fileName)
      toast.success('Fichier créé avec succès')

    } catch (error) {
      toast.error('Impossible de créer le fichier', {
        description: error.message
      })
    }
  }, [files, projectId, user?.id])

  const handleDeleteFile = useCallback(async (filePath) => {
    if (!window.confirm(`Supprimer ${filePath} ?`)) return

    const { [filePath]: _, ...newFiles } = files

    try {
      await projectService.updateProject(projectId, {
        files: newFiles
      }, user.id)

      setFiles(newFiles)
      if (currentFile === filePath) {
        setCurrentFile(Object.keys(newFiles)[0] || null)
      }
      toast.success('Fichier supprimé avec succès')

    } catch (error) {
      toast.error('Impossible de supprimer le fichier', {
        description: error.message
      })
    }
  }, [files, currentFile, projectId, user?.id])

  // =============================
  // GESTION DU BUILD
  // =============================

  // ─── Génération IA sur projet vide, puis build ────────────────────────────
  const handleAIGenAndBuild = useCallback(async () => {
    if (!aiGenPrompt.trim()) return
    setAiGenLoading(true)
    setAiGenError(null)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API_BASE_URL}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prompt: aiGenPrompt,
          project_type: project?.type || 'react',
          project_name: project?.name || 'mon-app'
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Erreur IA ${res.status}`)
      }
      const data = await res.json()
      const generatedFiles = data.files || {}
      if (Object.keys(generatedFiles).length === 0)
        throw new Error('Aucun fichier généré par l\'IA')

      // Persister les fichiers générés
      await projectService.updateProject(projectId, { files: generatedFiles }, user.id)
      setFiles(generatedFiles)
      const firstFile = data.entryPoint || Object.keys(generatedFiles)[0]
      if (firstFile) setCurrentFile(firstFile)

      toast.success('✨ Code généré !', { description: `${Object.keys(generatedFiles).length} fichier(s) créé(s)` })
      setShowAIGenDialog(false)
      setAiGenPrompt('')
    } catch (error) {
      setAiGenError(error.message)
    } finally {
      setAiGenLoading(false)
    }
  }, [aiGenPrompt, project, projectId, user?.id])

  const handleRun = useCallback(async () => {
    // Si le projet est vide, proposer la génération IA
    if (Object.keys(files).length === 0) {
      setShowAIGenDialog(true)
      return
    }

    setBuilding(true)
    setBuildLogs([])
    setBuildProgress(0)
    setLastBuildStatus(null)
    setActiveBuildId(null)
    setShowTerminal(true)
    setActiveView(VIEWS.PREVIEW)

    try {
      // Sauvegarder automatiquement avant de builder
      if (isDirty) {
        await handleSave()
      }

      // ── Appel backend : démarre le vrai build ──────────────────────────────
      const token = localStorage.getItem('access_token')
      const res = await fetch(
        `${API_BASE_URL}/builds/project/${projectId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ type: 'production', target: 'web' })
        }
      )

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur serveur ${res.status}`)
      }

      const data = await res.json()
      const buildId = data.id

      if (!buildId) throw new Error('ID de build non reçu')

      // ── Connecter le WebSocket de suivi temps réel ─────────────────────────
      setBuildLogs([{ type: 'info', message: `🚀 Build ${buildId} démarré — connexion au flux...` }])
      setActiveBuildId(buildId)

      // Le useEffect sur wsBuildStatus gère la fin (toast + setBuilding(false))

    } catch (error) {
      setBuildLogs(prev => [...prev, {
        type: 'error',
        message: `❌ Erreur: ${error.message}`
      }])
      setActiveView(VIEWS.CONSOLE)
      toast.error('Le build a échoué', { description: error.message })
      setBuilding(false)
    }
  }, [projectId, isDirty, handleSave])

  const handleStop = useCallback(async () => {
    try {
      await livePreview.stopSession(projectId)
      setPreviewUrl(null)
      setActiveView(VIEWS.CODE)
    } catch (error) {
      console.error('Erreur arrêt preview:', error)
    }
  }, [projectId])

  // ─── Annulation d'un build en cours ──────────────────────────────────────
  const handleCancelBuild = useCallback(async () => {
    if (!activeBuildId) return
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(
        `${API_BASE_URL}/builds/${activeBuildId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        }
      )
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Erreur ${res.status}`)
      }
      // Le WebSocket recevra le statut "cancelled" → useEffect nettoiera automatiquement
      toast.info('Build annulé')
    } catch (error) {
      toast.error("Impossible d'annuler", { description: error.message })
    }
  }, [activeBuildId])

  // =============================
  // ✅ GESTION DE LA PREVIEW
  // =============================

  const handlePortChange = useCallback((port) => {
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
    // Logique de publication à implémenter
  }, [])

  // =============================
  // ✅ GESTION DU CHAT IA
  // =============================

  const handleSendMessage = useCallback((message) => {
    // Ajouter le message utilisateur
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: message
    }])

    // Simuler une réponse (à remplacer par appel API)
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `J'ai bien reçu votre demande : "${message}"\n\nJe vais analyser le projet et vous proposer des améliorations.`,
        timestamp: new Date().toISOString(),
        streaming: true,
        actions: [
          {
            type: 'analyze',
            title: 'Analyse du projet',
            description: 'Analyse de la structure et des dépendances',
            status: 'loading',
            duration: 'en cours',
            logs: [
              { type: 'info', message: '📁 Scan des fichiers...' }
            ]
          }
        ]
      }])
    }, 1000)
  }, [])

  const handleAction = useCallback((action) => {
    toast.info(`Action: ${action}`)
    // Logique d'action à implémenter
  }, [])

  // =============================
  // GESTION DE LA CONSOLE
  // =============================

  const handleOpenPreviewFromConsole = useCallback((url) => {
    setPreviewUrls(prev => ({
      ...prev,
      [currentPort]: url
    }))
    setActiveView(VIEWS.PREVIEW)
  }, [currentPort])

  // =============================
  // RECHERCHE
  // =============================

  const handleSearch = useCallback((query) => {
    if (!query || !files) return

    const results = []
    Object.entries(files).forEach(([path, content]) => {
      if (content.includes(query)) {
        results.push({ path, content })
      }
    })
    setSearchResults(results)
  }, [files])

  // =============================
  // PARTAGE
  // =============================

  const handleShare = useCallback(async () => {
    if (!shareEmail) {
      toast.error('Veuillez saisir une adresse email')
      return
    }

    try {
      // À implémenter avec le service de permissions
      toast.success('Invitation envoyée', {
        description: `${shareEmail} a été invité(e)`
      })
      setShowShareDialog(false)
      setShareEmail('')
    } catch (error) {
      toast.error('Erreur lors de l\'envoi de l\'invitation', {
        description: error.message
      })
    }
  }, [shareEmail])

  // =============================
  // RACCOURCIS CLAVIER
  // =============================

  // ─── Réagir au statut terminal du build WebSocket ────────────────────────
  useEffect(() => {
    if (!activeBuildId) return
    if (!['success', 'failed', 'cancelled'].includes(wsBuildStatus)) return

    // Persister les logs et la progression finale avant de couper le WS
    setBuildLogs(wsBuildLogs)
    setBuildProgress(wsBuildStatus === 'success' ? 100 : wsBuildProgress)
    setLastBuildStatus(wsBuildStatus)

    setBuilding(false)
    setActiveBuildId(null)

    if (wsBuildStatus === 'success') {
      toast.success('Build réussi', { description: 'Application compilée et prête' })
    } else if (wsBuildStatus === 'failed') {
      toast.error('Build échoué', { description: 'Consultez les logs pour le détail' })
      setActiveView(VIEWS.CONSOLE)
    }
  }, [activeBuildId, wsBuildStatus, wsBuildProgress, wsBuildLogs])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S : Sauvegarder
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleSave()
      }

      // Ctrl+F : Rechercher
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }

      // Ctrl+B : Basculer l'arborescence
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        setShowFileTree(prev => !prev)
      }

      // Ctrl+Shift+P : Preview
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setActiveView(activeView === VIEWS.PREVIEW ? VIEWS.CODE : VIEWS.PREVIEW)
      }

      // Ctrl+Shift+A : Chat IA
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        setActiveView(activeView === VIEWS.CHAT ? VIEWS.CODE : VIEWS.CHAT)
      }

      // Ctrl+Shift+D : Debug
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setShowDebug(prev => !prev)
      }

      // Ctrl+Shift+T : Terminal (Build)
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        setShowTerminal(prev => !prev)
      }

      // Ctrl+Shift+S : Shell interactif
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        setShowShell(prev => !prev)
      }

      // Ctrl+Shift+C : Console application
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        setShowAppConsole(prev => !prev)
      }

      // Ctrl+R : Run
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        handleRun()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleRun, activeView])

  // ─── Variables dérivées : logs et progress à afficher ────────────────────
  // Si un build WS est actif, les logs/progress viennent du hook en temps réel.
  // Sinon on conserve les valeurs locales (erreurs pré-WS, état initial).
  const displayedBuildLogs     = activeBuildId ? wsBuildLogs : buildLogs
  const displayedBuildProgress = activeBuildId ? wsBuildProgress : buildProgress

  // =============================
  // RENDU DES VUES
  // =============================

  const renderCodeEditor = () => (
    <div className="flex-1 flex">
      <div className="flex-1 flex flex-col">
        {currentFile ? (
          <CodeEditor
            key={currentFile}
            projectId={projectId}
            userId={user?.id}
            filePath={currentFile}
            onFileChange={handleFileChange}
            onSave={handleSave}
            onSelectionChange={setEditorSelection}
            onEditorReady={(editor) => { monacoEditorRef.current = editor }}
            readOnly={false}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-bold mb-2">Aucun fichier sélectionné</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sélectionnez un fichier dans l'arborescence
              </p>
              <Button onClick={handleCreateFile}>
                <Plus className="w-4 h-4 mr-2" />
                Créer un fichier
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  )

  const renderPreview = () => (
    <Preview
      isRunning={isRunning}
      building={building}
      buildProgress={displayedBuildProgress}
      ports={ports}
      currentPort={currentPort}
      previewUrls={previewUrls}
      onPortChange={handlePortChange}
      onRefresh={handleRefreshPreview}
      onOpenExternal={handleOpenExternal}
      onPublish={handlePublish}
      onBack={() => setActiveView(VIEWS.CODE)}
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
      initialMessages={chatMessages}
      streaming={true}
      projectFiles={files}
      currentFile={currentFile}
      currentFileContent={currentFile ? files[currentFile] : null}
      selection={editorSelection}
      onClearSelection={() => setEditorSelection(null)}
      onSelectionClick={(sel) => {
        const editor = monacoEditorRef.current
        if (!editor || !sel?.range) {
          setActiveView(VIEWS.CODE)
          return
        }
        setActiveView(VIEWS.CODE)
        // Laisser le temps au layout de basculer avant de scroller
        setTimeout(() => {
          try {
            const range = {
              startLineNumber: sel.range.startLine,
              startColumn: sel.range.startColumn || 1,
              endLineNumber: sel.range.endLine,
              endColumn: sel.range.endColumn || 1,
            }
            editor.revealRangeInCenter(range)
            editor.setSelection(range)
            editor.focus()
          } catch (_) { /* best-effort */ }
        }, 50)
      }}
      openFiles={currentFile ? [currentFile] : []}
    />
  )

  const renderConsole = () => (
    <AppConsole
      projectId={projectId}
      onClose={() => setActiveView(VIEWS.CODE)}
      onOpenPreview={handleOpenPreviewFromConsole}
    />
  )

  const renderShell = () => (
    <InteractiveShell
      projectId={projectId}
      userId={user?.id}
      onClose={() => setActiveView(VIEWS.CODE)}
    />
  )

  const renderDebug = () => (
    <DebugPanel projectId={projectId} />
  )

  // =============================
  // RENDU PRINCIPAL
  // =============================

  if (loading) {
    return (
      <div className="project-editor min-h-screen bg-background">
        <div className="h-12 border-b border-border bg-card flex items-center px-4">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex h-[calc(100vh-48px)]">
          <Skeleton className="w-64 h-full rounded-none" />
          <Skeleton className="flex-1 h-full rounded-none" />
        </div>
      </div>
    )
  }

  return (
    <div className="project-editor h-screen flex flex-col bg-background">
        {/* Dialog de partage */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager le projet</DialogTitle>
            <DialogDescription>
              Invitez des collaborateurs à rejoindre ce projet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Adresse email
              </label>
              <Input
                type="email"
                placeholder="collaborateur@exemple.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleShare}>
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog : Génération IA sur projet vide ─────────────────────────── */}
      <Dialog open={showAIGenDialog} onOpenChange={(open) => { setShowAIGenDialog(open); setAiGenError(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" />
              Générer l'application avec l'IA
            </DialogTitle>
            <DialogDescription>
              Ce projet est vide. Décrivez votre application et l'IA va créer le code complet, puis lancer le build.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Ex : Une application de liste de tâches avec React, persistence localStorage, dark mode, et un design moderne avec Tailwind CSS..."
              value={aiGenPrompt}
              onChange={(e) => setAiGenPrompt(e.target.value)}
              className="min-h-[120px] resize-none font-mono text-sm"
              disabled={aiGenLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAIGenAndBuild()
              }}
            />
            {aiGenError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <span>⚠</span> {aiGenError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Conseil : soyez précis — mentionnez le framework, les fonctionnalités et le style souhaité. <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Entrée</kbd> pour générer.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAIGenDialog(false); setAiGenError(null) }} disabled={aiGenLoading}>
              Annuler
            </Button>
            <Button
              onClick={handleAIGenAndBuild}
              disabled={aiGenLoading || !aiGenPrompt.trim()}
              className="gap-2"
            >
              {aiGenLoading
                ? <><span className="animate-spin">⠋</span> Génération en cours...</>
                : <><Sparkles className="w-4 h-4" /> Générer &amp; Builder</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barre d'outils */}
      <div className="h-12 border-b border-border bg-card flex items-center px-2 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFileTree(!showFileTree)}
            title="Basculer l'arborescence (Ctrl+B)"
          >
            <Menu className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={!isDirty || saving}
            title="Sauvegarder (Ctrl+S)"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(true)}
            title="Rechercher (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-2" />

          <Button
            variant="default"
            size="sm"
            onClick={handleRun}
            disabled={building}
            className="bg-green-600 hover:bg-green-700"
          >
            {building ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run
          </Button>

          <Button
            variant={activeView === VIEWS.PREVIEW ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setActiveView(VIEWS.PREVIEW)}
            title="Preview (Ctrl+Shift+P)"
            className={activeView === VIEWS.PREVIEW ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <Eye className="w-4 h-4" />
          </Button>

          <Button
            variant={activeView === VIEWS.CHAT ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setActiveView(VIEWS.CHAT)}
            title="Chat IA (Ctrl+Shift+A)"
            className={activeView === VIEWS.CHAT ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>

          <Button
            variant={showDebug ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowDebug(!showDebug)}
            title="Debug (Ctrl+Shift+D)"
            className={showDebug ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
          >
            <Bug className="w-4 h-4" />
          </Button>

          <Button
            variant={showTerminal ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowTerminal(!showTerminal)}
            title="Terminal (Ctrl+Shift+T)"
            className={showTerminal ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            <Terminal className="w-4 h-4" />
          </Button>

          <Button
            variant={showShell ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowShell(!showShell)}
            title="Shell interactif (Ctrl+Shift+S)"
            className={showShell ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <Terminal className="w-4 h-4" />
          </Button>

          <Button
            variant={showAppConsole ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setShowAppConsole(!showAppConsole)}
            title="Console application (Ctrl+Shift+C)"
            className={showAppConsole ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            <Radio className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShareDialog(true)}
            title="Partager"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Code2 className="w-3 h-3" />
            {project?.type}
          </Badge>

          {isDirty && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500">
              Modifié
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/vibe/projects/${projectId}`)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Barre de recherche */}
      {showSearch && (
        <div className="h-12 border-b border-border bg-card px-4 flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Rechercher dans les fichiers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              handleSearch(e.target.value)
            }}
            className="flex-1"
          />
          {searchResults.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {searchResults.length} résultat(s)
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowSearch(false)
              setSearchQuery('')
              setSearchResults([])
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Zone d'édition principale avec redimensionnement */}
      <div className="flex-1 flex overflow-hidden">
        {/* Arborescence */}
        {showFileTree && (
          <ResizablePanel
            defaultSize={sidebarWidth}
            onResize={setSidebarWidth}
            minSize={200}
            maxSize={400}
            className="border-r border-border"
          >
            <div className="h-full flex flex-col">
              <div className="p-2 border-b border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleCreateFile}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau fichier
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                <FileTreeBuilder
                  files={files}
                  selectedFile={currentFile}
                  onFileSelect={handleFileSelect}
                  onFileDelete={handleDeleteFile}
                />
              </div>
            </div>
          </ResizablePanel>
        )}

  {/* Vue active */}
        <div className="flex-1">
          {activeView === VIEWS.CODE && renderCodeEditor()}
          {activeView === VIEWS.PREVIEW && renderPreview()}
          {activeView === VIEWS.CHAT && renderChat()}
          {activeView === VIEWS.CONSOLE && renderConsole()}
          {activeView === VIEWS.SHELL && renderShell()}
          {activeView === VIEWS.DEBUG && renderDebug()}
        </div>
      </div>

      {/* Panneaux du bas (redimensionnables) */}
      {(showTerminal || showDebug || showShell || showAppConsole) && (
        <ResizablePanel
          defaultSize={terminalHeight}
          onResize={setTerminalHeight}
          minSize={200}
          maxSize={600}
          className="border-t border-border"
        >
          <Tabs 
            defaultValue={
              showTerminal ? 'terminal' : 
              showDebug ? 'debug' : 
              showShell ? 'shell' : 
              'appconsole'
            }
          >
            <div className="px-4 pt-2 border-b border-border">
              <TabsList>
                {showTerminal && (
                  <TabsTrigger value="terminal">
                    <Terminal className="w-4 h-4 mr-2" />
                    Build
                  </TabsTrigger>
                )}
                {showDebug && (
                  <TabsTrigger value="debug">
                    <Bug className="w-4 h-4 mr-2" />
                    Debug
                  </TabsTrigger>
                )}
                {showShell && (
                  <TabsTrigger value="shell">
                    <Terminal className="w-4 h-4 mr-2" />
                    Shell
                  </TabsTrigger>
                )}
                {showAppConsole && (
                  <TabsTrigger value="appconsole">
                    <Radio className="w-4 h-4 mr-2" />
                    Console
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="terminal" className="h-[calc(100%-40px)] flex flex-col overflow-hidden">

              {/* ── Barre de progression ── */}
              {(building || displayedBuildProgress > 0) && (
                <div className="flex-shrink-0 px-4 py-2 border-b border-border/40 bg-background">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium ${
                      building                       ? 'text-blue-400' :
                      lastBuildStatus === 'success'  ? 'text-green-400' :
                      lastBuildStatus === 'failed'   ? 'text-red-400' :
                      'text-muted-foreground'
                    }`}>
                      {building
                        ? 'Compilation en cours...'
                        : lastBuildStatus === 'success'  ? '✅ Build réussi'
                        : lastBuildStatus === 'failed'   ? '❌ Build échoué'
                        : lastBuildStatus === 'cancelled'? '⛔ Annulé'
                        : ''}
                    </span>
                    <span className="text-xs font-mono font-bold text-muted-foreground">
                      {displayedBuildProgress}%
                    </span>
                  </div>

                  {/* Piste */}
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        building
                          ? 'bg-blue-500'
                          : lastBuildStatus === 'success'  ? 'bg-green-500'
                          : lastBuildStatus === 'failed'   ? 'bg-red-500'
                          : 'bg-muted-foreground/40'
                      }`}
                      style={{ width: `${displayedBuildProgress}%` }}
                    />
                  </div>

                  {/* Shimmer animé uniquement pendant le build */}
                  {building && (
                    <div className="mt-1 w-full h-0.5 rounded-full overflow-hidden bg-muted">
                      <div
                        className="h-full bg-blue-400/60 rounded-full"
                        style={{
                          animation: 'shimmer 1.4s ease-in-out infinite',
                          backgroundImage: 'linear-gradient(90deg, transparent 0%, #60a5fa 50%, transparent 100%)',
                          backgroundSize: '200% 100%'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Logs scrollables ── */}
              <div className="flex-1 overflow-auto p-4 font-mono text-sm space-y-1 bg-black/5">
                {displayedBuildLogs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-2 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    'text-muted-foreground'
                  }`}>
                    <span className="select-none">
                      {log.type === 'error' ? '❌' :
                       log.type === 'success' ? '✅' :
                       '>'}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}

                {/* Spinner + bouton Annuler */}
                {building && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>En attente de logs...</span>
                    </div>
                    {activeBuildId && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleCancelBuild}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Annuler
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="debug" className="h-[calc(100%-40px)]">
              <DebugPanel projectId={projectId} />
            </TabsContent>

            <TabsContent value="shell" className="h-[calc(100%-40px)]">
              <InteractiveShell
                projectId={projectId}
                userId={user?.id}
                onClose={() => setShowShell(false)}
              />
            </TabsContent>

            <TabsContent value="appconsole" className="h-[calc(100%-40px)]">
              <AppConsole
                projectId={projectId}
                onClose={() => setShowAppConsole(false)}
                onOpenPreview={handleOpenPreviewFromConsole}
              />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      )}

      {/* Live preview bar (mobile) */}
      {previewUrl && <LivePreviewBar projectId={projectId} />}
    </div>
  )
}

ProjectEditor.propTypes = {};

export default ProjectEditor
