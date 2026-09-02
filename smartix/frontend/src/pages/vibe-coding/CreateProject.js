/**
 * CreateProject - Page de création de projet
 * Version PRO avec React Query, WebSocket, validation et accessibilité
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Plus, Rocket, Sparkles, ArrowLeft, Loader2,
  Check, AlertCircle, Zap, Code2, Eye,
  ChevronRight, Wand2, Upload, FileText,
  Settings, Globe, Smartphone, Cpu,
  FolderTree, Github, Archive
} from 'lucide-react'

// Hooks d'authentification
import { useAuth } from '../../hooks/useAuth'

// Services Vibe-coding
import { projectService } from '../../vibe-coding/services/projectService'
import { templateService } from '../../vibe-coding/services/templateService'
import { appGenerator } from '../../vibe-coding/ai/appGenerator'
import { importService } from '../../vibe-coding/services/importService'

// Composants UI
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { Label } from '../../components/ui/label'
import { Progress } from '../../components/ui/progress'
import {

  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const PROJECT_TYPES = [
  { id: 'react', name: 'React', icon: '⚛️', description: 'Application web React' },
  { id: 'react-native', name: 'React Native', icon: '📱', description: 'Application mobile React Native' },
  { id: 'node', name: 'Node.js', icon: '🟢', description: 'API Node.js' },
  { id: 'html', name: 'HTML/CSS', icon: '🌐', description: 'Site statique' },
  { id: 'vue', name: 'Vue.js', icon: '🟢', description: 'Application Vue.js' },
  { id: 'angular', name: 'Angular', icon: '🔺', description: 'Application Angular' },
  { id: 'next', name: 'Next.js', icon: '▲', description: 'Application Next.js' },
  { id: 'gatsby', name: 'Gatsby', icon: '⚡', description: 'Site Gatsby' }
]

const COMPLEXITY_LEVELS = [
  { id: 'simple', name: 'Simple', icon: '🌱', description: 'Application basique' },
  { id: 'medium', name: 'Moyen', icon: '🌿', description: 'Fonctionnalités standards' },
  { id: 'complex', name: 'Complexe', icon: '🌳', description: 'Architecture avancée' }
]

const TEMPLATE_CATEGORIES = [
  'productivity',
  'social',
  'lifestyle',
  'finance',
  'education',
  'utilities',
  'games'
]

const IMPORT_TYPES = [
  { id: 'github', name: 'GitHub', icon: Github, description: 'Importer depuis GitHub' },
  { id: 'zip', name: 'Archive ZIP', icon: Archive, description: 'Importer un fichier ZIP' },
  { id: 'local', name: 'Projet local', icon: FolderTree, description: 'Importer un dossier local' }
]

// =============================
// VALIDATION SCHEMA
// =============================

const projectSchema = z.object({
  name: z.string()
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Le nom ne peut contenir que des lettres, chiffres, espaces, tirets et underscores'),
  description: z.string().max(500).optional(),
  type: z.enum(['react', 'react-native', 'node', 'html', 'vue', 'angular', 'next', 'gatsby']),
  complexity: z.enum(['simple', 'medium', 'complex']),
  templateId: z.string().optional(),
  features: z.array(z.string()),
  includeReadme: z.boolean(),
  includeGitignore: z.boolean(),
  includeTests: z.boolean(),
  useTypeScript: z.boolean()
})

// =============================
// HOOKS PERSONNALISÉS
// =============================

const useTemplates = () => {
  return useQuery({
    queryKey: ['templates', 'all'],
    queryFn: () => templateService.getAllTemplates({ limit: 50 }),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  })
}

// =============================
// COMPOSANTS
// =============================

const ProjectPreview = ({ structure }) => {
  if (!structure) return null

  const renderTree = (items, level = 0) => {
    return items?.map((item, index) => (
      <div key={index} style={{ marginLeft: level * 20 }} className="flex items-center gap-2 py-1">
        <span className="text-muted-foreground">{item.type === 'folder' ? '📁' : '📄'}</span>
        <span className="text-sm">{item.name}</span>
        {item.type === 'folder' && item.children && renderTree(item.children, level + 1)}
      </div>
    ))
  }

  return (
    <Card className="p-4 mt-4 bg-card/50">
      <h4 className="font-bold mb-3 flex items-center gap-2">
        <FolderTree className="w-4 h-4" />
        Aperçu de l'architecture
      </h4>
      <div className="font-mono text-xs">
        {renderTree(structure)}
      </div>
    </Card>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CreateProject = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const mountedRef = useRef(true)
  const wsRef = useRef(null)
  const intervalRef = useRef(null)

  // États du formulaire
  const [mode, setMode] = useState('template') // 'template', 'empty', 'ai', 'import'
  const [step, setStep] = useState(1)
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Données du projet
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    type: 'react',
    complexity: 'medium',
    templateId: null,
    features: [],
    includeReadme: true,
    includeGitignore: true,
    includeTests: false,
    useTypeScript: true
  })

  // États pour les templates
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templateCategory, setTemplateCategory] = useState('all')
  const [templateSearch, setTemplateSearch] = useState('')

  // États pour l'IA
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiPreview, setAiPreview] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // États pour l'import
  const [importUrl, setImportUrl] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [importType, setImportType] = useState('github')

  // Query templates
  const { data: templatesData, isLoading: templatesLoading, error: templatesError } = useTemplates()
  const templates = templatesData?.templates || []

  // Mutation création projet
  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      if (mode === 'template' && selectedTemplate) {
        return templateService.createProjectFromTemplate(
          selectedTemplate.id,
          user.id,
          data.name
        )
      } else if (mode === 'import') {
        return importService.importProject({
          type: importType,
          url: importUrl,
          file: importFile,
          userId: user.id,
          name: data.name
        })
      } else {
        return projectService.createProject(user.id, {
          name: data.name,
          description: data.description,
          type: data.type,
          config: {
            complexity: data.complexity,
            features: data.features,
            includeReadme: data.includeReadme,
            includeGitignore: data.includeGitignore,
            includeTests: data.includeTests,
            useTypeScript: data.useTypeScript
          }
        })
      }
    },
    onSuccess: (project) => {
      toast.success('Projet créé avec succès')
      
      // ✅ LOGIQUE DE REDIRECTION OFFICIELLE
      if (mode === 'template') {
        // Template → page détails (pour choisir)
        navigate(`/vibe/projects/${project.id}`)
      } else if (mode === 'import') {
        // Import → éditeur IA
        navigate(`/vibe/projects/${project.id}/edit/ai`)
      } else if (mode === 'empty') {
        // Projet vide → éditeur classique
        navigate(`/vibe/projects/${project.id}/edit`)
      } else if (mode === 'ai') {
        // IA → éditeur IA
        navigate(`/vibe/projects/${project.id}/edit/ai`)
      }
    },
    onError: (error) => {
      toast.error('Impossible de créer le projet', {
        description: error.message
      })
    }
  })

  // Redirection si non authentifié
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: '/vibe/projects/create' } })
    }
    return () => {
      mountedRef.current = false
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isAuthenticated, navigate])

  // Skip step 2 pour le mode empty
  useEffect(() => {
    if (mode === 'empty' && step === 1) {
      setStep(3)
    }
  }, [mode, step])

  // =============================
  // ✅ LOGIQUE DE REDIRECTION INITIALE
  // =============================
  const handleModeSelect = useCallback((selectedMode) => {
    setMode(selectedMode)
    
    // Redirection immédiate pour certains modes
    if (selectedMode === 'template') {
      navigate('/vibe/templates') // Page de sélection des templates
    } else if (selectedMode === 'ai') {
      navigate('/vibe/projects/create/ai') // Interface IA dédiée
    }
    // Pour 'import' et 'empty', on continue le flux normal
  }, [navigate])

  // =============================
  // GESTIONNAIRES
  // =============================

  const handleInputChange = useCallback((field, value) => {
    setProjectData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplate(template)
    setProjectData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      type: template.framework || 'react',
      templateId: template.id
    }))
  }, [])

  const handleGenerateWithAI = useCallback(async () => {
    if (!aiPrompt.trim()) {
      toast.error('Veuillez décrire votre projet')
      return
    }

    setIsGenerating(true)
    setAiProgress(0)

    try {
      // Connexion WebSocket pour progression réelle
      const _wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsRef.current = new WebSocket(`${_wsProto}//${window.location.host}/ws/ai-progress`)
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'progress' && mountedRef.current) {
          setAiProgress(data.progress)
        }
        if (data.type === 'preview' && mountedRef.current) {
          setAiPreview(data.structure)
        }
        if (data.type === 'complete' && mountedRef.current) {
          setAiResult(data.result)
          setAiPreview(data.result.structure)
          setProjectData(prev => ({
            ...prev,
            name: data.result.name || prev.name,
            description: data.result.description || prev.description,
            features: data.result.features || []
          }))
          setIsGenerating(false)
          wsRef.current.close()
        }
      }

      // Envoyer la requête
      wsRef.current.onopen = () => {
        wsRef.current.send(JSON.stringify({
          type: 'generate',
          prompt: aiPrompt,
          userId: user.id,
          options: {
            type: projectData.type,
            complexity: projectData.complexity
          }
        }))
      }

    } catch (error) {
      console.error('Erreur génération IA:', error)
      toast.error('Impossible de générer le projet', {
        description: error.message
      })
      setIsGenerating(false)
    }
  }, [aiPrompt, projectData.type, projectData.complexity, user.id])

  const handleCreateProject = useCallback(async () => {
    try {
      // Validation
      const validated = projectSchema.parse(projectData)
      
      createProjectMutation.mutate(validated)
    } catch (error) {
      if (error.errors) {
        error.errors.forEach(err => {
          toast.error(err.message)
        })
      } else {
        toast.error('Données invalides')
      }
    }
  }, [projectData, createProjectMutation])

  const handleImport = useCallback(async () => {
    setShowImportDialog(false)
    setMode('import')
    setStep(3)
  }, [])

  // Templates filtrés avec useMemo
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (templateCategory !== 'all' && t.category !== templateCategory) return false
      if (templateSearch && !t.name.toLowerCase().includes(templateSearch.toLowerCase())) return false
      return true
    })
  }, [templates, templateCategory, templateSearch])

  // =============================
  // RENDU DES ÉTAPES
  // =============================

  const renderModeSelection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        role="button"
        tabIndex={0}
        className={`p-6 cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
          mode === 'template' ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
        }`}
        onClick={() => handleModeSelect('template')}
        onKeyPress={(e) => e.key === 'Enter' && handleModeSelect('template')}
      >
        <Rocket className="w-8 h-8 text-purple-400 mb-3" />
        <h3 className="font-bold text-lg mb-1">Template</h3>
        <p className="text-sm text-muted-foreground">
          Commencez avec un template prêt à l'emploi
        </p>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        className={`p-6 cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-pink-500 ${
          mode === 'empty' ? 'ring-2 ring-pink-500 bg-pink-500/10' : ''
        }`}
        onClick={() => setMode('empty')}
        onKeyPress={(e) => e.key === 'Enter' && setMode('empty')}
      >
        <Code2 className="w-8 h-8 text-pink-400 mb-3" />
        <h3 className="font-bold text-lg mb-1">Projet vide</h3>
        <p className="text-sm text-muted-foreground">
          Partez d'une configuration de base
        </p>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        className={`p-6 cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          mode === 'ai' ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
        }`}
        onClick={() => handleModeSelect('ai')}
        onKeyPress={(e) => e.key === 'Enter' && handleModeSelect('ai')}
      >
        <Sparkles className="w-8 h-8 text-blue-400 mb-3" />
        <h3 className="font-bold text-lg mb-1">Générer IA</h3>
        <p className="text-sm text-muted-foreground">
          Décrivez votre projet et laissez l'IA le créer
        </p>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        className={`p-6 cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 ${
          mode === 'import' ? 'ring-2 ring-green-500 bg-green-500/10' : ''
        }`}
        onClick={() => setShowImportDialog(true)}
        onKeyPress={(e) => e.key === 'Enter' && setShowImportDialog(true)}
      >
        <Upload className="w-8 h-8 text-green-400 mb-3" />
        <h3 className="font-bold text-lg mb-1">Importer</h3>
        <p className="text-sm text-muted-foreground">
          Importer depuis GitHub, ZIP ou dossier local
        </p>
      </Card>
    </div>
  )

  const renderTemplateSelection = () => (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Rechercher un template..."
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={templateCategory} onValueChange={setTemplateCategory}>
          <SelectTrigger className="md:w-[200px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {TEMPLATE_CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {templatesLoading && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Chargement des templates...</p>
        </div>
      )}

      {/* Error */}
      {templatesError && (
        <Card className="p-4 bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <p>Erreur de chargement des templates</p>
          </div>
        </Card>
      )}

      {/* Liste des templates */}
      {!templatesLoading && !templatesError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-1">
          {filteredTemplates.map(template => (
            <Card
              key={template.id}
              role="button"
              tabIndex={0}
              className={`p-4 cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                selectedTemplate?.id === template.id ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
              }`}
              onClick={() => handleSelectTemplate(template)}
              onKeyPress={(e) => e.key === 'Enter' && handleSelectTemplate(template)}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{template.icon || '📦'}</span>
                <div>
                  <h4 className="font-bold">{template.name}</h4>
                  <p className="text-xs text-muted-foreground">{template.category}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {template.description}
              </p>
              <div className="flex flex-wrap gap-1">
                {template.tags?.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  const renderAIInput = () => (
    <div className="space-y-6">
      <div className="relative">
        <Textarea
          placeholder="Décrivez votre projet en détail... Exemple: 'Une application de todo list avec React et TypeScript, avec authentification et base de données'"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={6}
          className="resize-none"
          disabled={isGenerating}
        />
        <Wand2 className="absolute bottom-3 right-3 w-5 h-5 text-muted-foreground" />
      </div>

      {isGenerating && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Génération en cours...</span>
            <span>{aiProgress}%</span>
          </div>
          <Progress value={aiProgress} />
        </div>
      )}

      {aiResult && (
        <Card className="p-4 bg-green-500/10 border-green-500/30">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Check className="w-5 h-5" />
            <span className="font-bold">Projet généré</span>
          </div>
          <p className="text-sm">Analyse terminée, vous pouvez ajuster les paramètres ci-dessous.</p>
        </Card>
      )}

      {aiPreview && <ProjectPreview structure={aiPreview} />}

      <Button
        onClick={handleGenerateWithAI}
        disabled={isGenerating || !aiPrompt.trim()}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Génération en cours...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Générer avec l'IA
          </>
        )}
      </Button>
    </div>
  )

  const renderProjectConfig = () => (
    <div className="space-y-6">
      {/* Nom et description */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nom du projet *</Label>
          <Input
            id="name"
            value={projectData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Mon super projet"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Min 3 caractères, lettres, chiffres, espaces, tirets et underscores uniquement
          </p>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={projectData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Description de votre projet..."
            rows={3}
            className="mt-1 resize-none"
          />
        </div>
      </div>

      {/* Type de projet */}
      <div>
        <Label>Type de projet</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {PROJECT_TYPES.map(type => (
            <Card
              key={type.id}
              role="button"
              tabIndex={0}
              className={`p-3 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                projectData.type === type.id ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
              }`}
              onClick={() => handleInputChange('type', type.id)}
              onKeyPress={(e) => e.key === 'Enter' && handleInputChange('type', type.id)}
            >
              <div className="text-center">
                <span className="text-2xl mb-1 block">{type.icon}</span>
                <span className="text-sm font-medium">{type.name}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

  {/* Complexité */}
      <div>
        <Label>Complexité</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {COMPLEXITY_LEVELS.map(level => (
            <Card
              key={level.id}
              role="button"
              tabIndex={0}
              className={`p-3 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                projectData.complexity === level.id ? 'ring-2 ring-pink-500 bg-pink-500/10' : ''
              }`}
              onClick={() => handleInputChange('complexity', level.id)}
              onKeyPress={(e) => e.key === 'Enter' && handleInputChange('complexity', level.id)}
            >
              <div className="text-center">
                <span className="text-xl mb-1 block">{level.icon}</span>
                <span className="text-sm font-medium">{level.name}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Options avancées */}
      <Card className="p-4">
        <h4 className="font-bold mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Options avancées
        </h4>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="typescript">Utiliser TypeScript</Label>
            <Switch
              id="typescript"
              checked={projectData.useTypeScript}
              onCheckedChange={(v) => handleInputChange('useTypeScript', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="readme">Inclure README.md</Label>
            <Switch
              id="readme"
              checked={projectData.includeReadme}
              onCheckedChange={(v) => handleInputChange('includeReadme', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="gitignore">Inclure .gitignore</Label>
            <Switch
              id="gitignore"
              checked={projectData.includeGitignore}
              onCheckedChange={(v) => handleInputChange('includeGitignore', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="tests">Inclure des tests</Label>
            <Switch
              id="tests"
              checked={projectData.includeTests}
              onCheckedChange={(v) => handleInputChange('includeTests', v)}
            />
          </div>
        </div>
      </Card>
    </div>
  )

  // =============================
  // RENDU PRINCIPAL
  // =============================
  return (
    <div className="create-project min-h-screen bg-background pb-12">
      {/* Dialog d'import */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer un projet</DialogTitle>
            <DialogDescription>
              Choisissez la source de votre projet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-2">
              {IMPORT_TYPES.map(type => {
                const Icon = type.icon
                return (
                  <Card
                    key={type.id}
                    role="button"
                    tabIndex={0}
                    className={`p-3 cursor-pointer transition-all text-center ${
                      importType === type.id ? 'ring-2 ring-green-500 bg-green-500/10' : ''
                    }`}
                    onClick={() => setImportType(type.id)}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">{type.name}</span>
                  </Card>
                )
              })}
            </div>

            {importType === 'github' && (
              <Input
                placeholder="URL du repository GitHub (ex: https://github.com/user/repo)"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
              />
            )}

            {importType === 'zip' && (
              <Input
                type="file"
                accept=".zip"
                onChange={(e) => setImportFile(e.target.files?.[0])}
              />
            )}

            {importType === 'local' && (
              <Input
                type="file"
                webkitdirectory=""
                directory=""
                onChange={(e) => setImportFile(e.target.files?.[0])}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleImport} className="bg-green-500 hover:bg-green-600">
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-900 to-pink-900 text-white px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            className="text-white/80 hover:text-white mb-4"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plus className="w-8 h-8" />
            Créer un nouveau projet
          </h1>
          <p className="text-white/80 mt-1">
            Suivez les étapes pour créer votre projet Vibe Coding
          </p>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-3xl mx-auto px-4 -mt-4 relative z-10">
        <Card className="p-6 bg-card/80 backdrop-blur-sm border border-border/50">
          {/* Indicateur d'étapes */}
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step > num 
                    ? 'bg-green-500 text-white'
                    : step === num
                      ? 'bg-purple-500 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {step > num ? <Check className="w-4 h-4" /> : num}
                </div>
                {num < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    step > num ? 'bg-green-500' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Contenu de l'étape */}
          <div className="mb-8">
            {step === 1 && renderModeSelection()}
            {step === 2 && mode === 'template' && renderTemplateSelection()}
            {step === 2 && mode === 'ai' && renderAIInput()}
            {step === 3 && renderProjectConfig()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              Précédent
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 2 && mode === 'template' && !selectedTemplate) ||
                  (step === 2 && mode === 'ai' && !aiResult)
                }
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleCreateProject}
                disabled={createProjectMutation.isLoading || !projectData.name}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {createProjectMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Créer le projet
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

CreateProject.propTypes = {};

export default CreateProject
ProjectPreview.propTypes = {
  structure: PropTypes.any.isRequired,
};
