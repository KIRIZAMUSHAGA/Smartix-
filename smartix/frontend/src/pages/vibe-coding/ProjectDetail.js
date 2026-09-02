/**
 * ProjectDetail - Page de détail d'un projet
 * Version ULTIME avec React Query, Optimistic UI, et corrections PRO
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  ArrowLeft, Edit, Play, Rocket, Share2, 
  MoreVertical, Download, Archive, Trash2,
  Code2, FileText, Activity, Users, Clock,
  Star, GitBranch, Eye, Settings, Copy,
  CheckCircle, AlertCircle, Loader2, Zap,
  BarChart, Calendar, HardDrive, Cpu,
  FolderTree, FileJson, FileCode, File
} from 'lucide-react'

// Hooks d'authentification
import { useAuth } from '../../hooks/useAuth'

// Services Vibe-coding
import { projectService } from '../../vibe-coding/services/projectService'
import { buildService } from '../../vibe-coding/services/buildService'
import { publisher } from '../../vibe-coding/publishing/publisher'
import { permissionService } from '../../vibe-coding/services/permissionService'

// Composants UI
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Progress } from '../../components/ui/progress'
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
  DialogTitle,
  DialogTrigger
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Label } from '../../components/ui/label'
import { Skeleton } from '../../components/ui/skeleton'
import {

  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const PROJECT_STATUS = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  EDITING: 'editing',
  RUNNING: 'running',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
}

const BUILD_STATUS = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

const CONFIRM_DELETE_TEXT = 'DELETE'

// =============================
// HOOK PERSONNALISÉ OPTIMISÉ
// =============================

const useProjectFullData = (projectId, userId) => {
  const queryClient = useQueryClient()

  // Query unique pour toutes les données
  const fullQuery = useQuery({
    queryKey: ['project-full', projectId],
    queryFn: () => projectService.getProjectFull(projectId, userId),
    enabled: !!projectId && !!userId,
    retry: 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const project = fullQuery.data?.project
  const permissions = fullQuery.data?.permissions
  const stats = fullQuery.data?.stats
  const builds = fullQuery.data?.builds || []
  const collaborators = fullQuery.data?.collaborators || []

  // Mutation build avec Optimistic UI
  const buildMutation = useMutation({
    mutationFn: () => buildService.startBuild(projectId, userId, {
      type: 'development',
      target: 'web'
    }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['project-full', projectId] })

      const previous = queryClient.getQueryData(['project-full', projectId])

      // Optimistic update
      queryClient.setQueryData(['project-full', projectId], (old) => ({
        ...old,
        builds: [
          {
            id: `temp-${Date.now()}`,
            status: BUILD_STATUS.BUILDING,
            createdAt: new Date().toISOString(),
            isOptimistic: true
          },
          ...(old?.builds || [])
        ]
      }))

      return { previous }
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['project-full', projectId], context.previous)
      toast.error('Erreur lors du démarrage du build', {
        description: err.message
      })
    },
    onSuccess: () => {
      toast.success('Build démarré avec succès')
    }
  })

  // Mutation publication
  const publishMutation = useMutation({
    mutationFn: () => publisher.publishProject(projectId, userId, 'marketplace', {
      version: '1.0.0',
      visibility: 'public'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-full', projectId] })
      toast.success('Projet publié avec succès')
    },
    onError: (error) => {
      toast.error('Erreur lors de la publication', {
        description: error.message
      })
    }
  })

  // Mutation archive avec navigation
  const archiveMutation = useMutation({
    mutationFn: () => projectService.archiveProject(projectId, userId),
    onSuccess: () => {
      toast.success('Projet archivé avec succès')
      // Navigation dans le hook, pas dans le handler
    },
    onError: (error) => {
      toast.error('Erreur lors de l\'archivage', {
        description: error.message
      })
    }
  })

  // Mutation suppression avec navigation
  const deleteMutation = useMutation({
    mutationFn: () => projectService.deleteProject(projectId, userId),
    onSuccess: () => {
      toast.success('Projet supprimé avec succès')
      // Navigation dans le hook, pas dans le handler
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression', {
        description: error.message
      })
    }
  })

  return {
    project,
    permissions,
    stats,
    builds,
    collaborators,
    isLoading: fullQuery.isLoading,
    isError: fullQuery.isError,
    error: fullQuery.error,
    refetch: fullQuery.refetch,
    build: buildMutation.mutate,
    isBuilding: buildMutation.isLoading,
    publish: publishMutation.mutate,
    isPublishing: publishMutation.isLoading,
    archive: archiveMutation.mutate,
    isArchiving: archiveMutation.isLoading,
    delete: deleteMutation.mutate,
    isDeleting: deleteMutation.isLoading
  }
}

// =============================
// SOUS-COMPOSANTS
// =============================

const FileTree = ({ files = [], formatSize }) => {
  const renderTree = (items, level = 0) => {
    return items.map((item, index) => (
      <div key={index}>
        <div 
          className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer"
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {item.type === 'folder' ? (
            <FolderTree className="w-4 h-4 text-yellow-400" />
          ) : (
            <FileCode className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-sm">{item.name}</span>
          {item.size && formatSize && (
            <span className="text-xs text-muted-foreground ml-auto">
              {formatSize(item.size)}
            </span>
          )}
        </div>
        {item.children && renderTree(item.children, level + 1)}
      </div>
    ))
  }

  return <div className="space-y-1">{renderTree(files)}</div>
}

const ActivityItem = ({ activity }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'edit': return <Edit className="w-4 h-4 text-blue-400" />
      case 'build': return <Play className="w-4 h-4 text-green-400" />
      case 'publish': return <Rocket className="w-4 h-4 text-purple-400" />
      case 'share': return <Share2 className="w-4 h-4 text-yellow-400" />
      default: return <Activity className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <Avatar className="w-8 h-8">
        <AvatarFallback>{activity.user?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-medium">{activity.user}</span> {activity.action}
        </p>
        <p className="text-xs text-muted-foreground">{activity.time}</p>
      </div>
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ProjectDetail = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // États UI
  const [activeTab, setActiveTab] = useState('overview')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState('viewer')
  const [confirmDeleteText, setConfirmDeleteText] = useState('')

  // Hook personnalisé optimisé
  const {
    project,
    permissions,
    stats,
    builds,
    collaborators,
    isLoading,
    isError,
    error,
    build,
    isBuilding,
    publish,
    isPublishing,
    archive,
    delete: deleteProject
  } = useProjectFullData(projectId, user?.id)

  // Redirection si non authentifié
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/vibe/projects/${projectId}` } })
    }
  }, [isAuthenticated, navigate, projectId])

  // =============================
  // GESTIONNAIRES
  // =============================

  const handleEdit = () => {
    navigate(`/vibe/projects/${projectId}/edit`)
  }

  const handleRun = () => build()

  const handlePublish = () => publish()

  const handleShare = async () => {
    if (!shareEmail) {
      toast.error('Veuillez saisir une adresse email')
      return
    }

    try {
      await permissionService.inviteUser(projectId, shareEmail, shareRole, user.id)
      toast.success('Invitation envoyée', {
        description: `${shareEmail} a été invité(e)`
      })
      setShowShareDialog(false)
      setShareEmail('')
    } catch (err) {
      toast.error('Erreur lors de l\'envoi de l\'invitation', {
        description: err.message
      })
    }
  }

  const handleArchive = () => {
    archive(undefined, {
      onSuccess: () => navigate('/vibe/projects')
    })
  }

  const handleDelete = () => {
    deleteProject(undefined, {
      onSuccess: () => navigate('/vibe/projects')
    })
  }

  const handleExport = async () => {
    try {
      const data = await projectService.exportProject(projectId, user.id)
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'project'}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Projet exporté avec succès')
    } catch (err) {
      toast.error('Erreur lors de l\'export', {
        description: err.message
      })
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/vibe/projects/${projectId}`)
    toast.success('Lien copié dans le presse-papiers')
  }

  // =============================
  // FORMATAGE
  // =============================

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Date inconnue'
    
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'à l\'instant'
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }, [])

  const formatSize = useCallback((bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }, [])

  const getStatusBadge = useCallback((status) => {
    const styles = {
      [PROJECT_STATUS.DRAFT]: 'bg-gray-500/20 text-gray-400',
      [PROJECT_STATUS.GENERATED]: 'bg-blue-500/20 text-blue-400',
      [PROJECT_STATUS.EDITING]: 'bg-yellow-500/20 text-yellow-400',
      [PROJECT_STATUS.RUNNING]: 'bg-green-500/20 text-green-400',
      [PROJECT_STATUS.PUBLISHED]: 'bg-purple-500/20 text-purple-400',
      [PROJECT_STATUS.ARCHIVED]: 'bg-red-500/20 text-red-400'
    }

    return (
      <Badge className={styles[status] || 'bg-gray-500/20 text-gray-400'}>
        {status || 'inconnu'}
      </Badge>
    )
  }, [])

  const getBuildStatusBadge = useCallback((status) => {
    const styles = {
      [BUILD_STATUS.PENDING]: 'bg-gray-500/20 text-gray-400',
      [BUILD_STATUS.BUILDING]: 'bg-blue-500/20 text-blue-400',
      [BUILD_STATUS.SUCCESS]: 'bg-green-500/20 text-green-400',
      [BUILD_STATUS.FAILED]: 'bg-red-500/20 text-red-400',
      [BUILD_STATUS.CANCELLED]: 'bg-yellow-500/20 text-yellow-400'
    }

    return (
      <Badge className={styles[status] || 'bg-gray-500/20 text-gray-400'}>
        {status || 'inconnu'}
      </Badge>
    )
  }, [])

  // =============================
  // ÉTATS DE CHARGEMENT/ERREUR
  // =============================

  if (isLoading) {
    return (
      <div className="project-detail min-h-screen bg-background pb-12">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-64 rounded-lg mb-4" />
              <Skeleton className="h-96 rounded-lg" />
            </div>
            <div>
              <Skeleton className="h-64 rounded-lg mb-4" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Erreur</h2>
          <p className="text-muted-foreground mb-4">
            {error?.message || 'Projet non trouvé ou accès non autorisé'}
          </p>
          <Button onClick={() => navigate('/vibe/projects')}>
            Retour aux projets
          </Button>
        </Card>
      </div>
    )
  }

  // =============================
  // RENDU PRINCIPAL
  // =============================
  return (
    <div className="project-detail min-h-screen bg-background pb-12">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-900 to-pink-900 text-white px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white"
              onClick={() => navigate('/vibe/projects')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold">{project.name}</h1>
                {getStatusBadge(project.status)}
                {project.isPublic && (
                  <Badge className="bg-green-500/20 text-green-400">
                    Public
                  </Badge>
                )}
              </div>
              <p className="text-white/80 mt-1">
                {project.description || 'Aucune description'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {permissions?.canEdit && (
                <Button
                  size="lg"
                  className="bg-white text-purple-900 hover:bg-white/90"
                  onClick={handleEdit}
                  disabled={isBuilding || isPublishing}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Éditer
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  
                  <DropdownMenuItem onClick={handleRun} disabled={isBuilding}>
                    <Play className="w-4 h-4 mr-2" />
                    {isBuilding ? 'Build en cours...' : 'Lancer le build'}
                  </DropdownMenuItem>

                  {permissions?.canPublish && (
                    <DropdownMenuItem onClick={handlePublish} disabled={isPublishing}>
                      <Rocket className="w-4 h-4 mr-2" />
                      {isPublishing ? 'Publication...' : 'Publier'}
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copier le lien
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Partager
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="w-4 h-4 mr-2" />
                    Archiver
                  </DropdownMenuItem>

                  {permissions?.canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-500"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="overview">Aperçu</TabsTrigger>
                <TabsTrigger value="builds">Builds</TabsTrigger>
                <TabsTrigger value="files">Fichiers</TabsTrigger>
                <TabsTrigger value="activity">Activité</TabsTrigger>
              </TabsList>

              {/* Onglet Aperçu */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                   {/* Stats rapides */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <FileText className="w-5 h-5 text-purple-400 mb-2" />
                    <p className="text-2xl font-bold">{stats?.filesCount || 0}</p>
                    <p className="text-xs text-muted-foreground">Fichiers</p>
                  </Card>
                  <Card className="p-4">
                    <Code2 className="w-5 h-5 text-pink-400 mb-2" />
                    <p className="text-2xl font-bold">{stats?.totalLines || 0}</p>
                    <p className="text-xs text-muted-foreground">Lignes</p>
                  </Card>
                  <Card className="p-4">
                    <HardDrive className="w-5 h-5 text-blue-400 mb-2" />
                    <p className="text-2xl font-bold">{formatSize(stats?.totalSize || 0)}</p>
                    <p className="text-xs text-muted-foreground">Taille</p>
                  </Card>
                  <Card className="p-4">
                    <GitBranch className="w-5 h-5 text-green-400 mb-2" />
                    <p className="text-2xl font-bold">{builds.length}</p>
                    <p className="text-xs text-muted-foreground">Builds</p>
                  </Card>
                </div>

                {/* Extensions */}
                {stats?.extensions && Object.keys(stats.extensions).length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3">Types de fichiers</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.extensions).map(([ext, count]) => (
                        <Badge key={ext} variant="outline">
                          {ext || 'sans extension'} : {count}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Actions rapides */}
                <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                  <h3 className="font-bold mb-3">Actions rapides</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={handleEdit}
                      disabled={!permissions?.canEdit}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Éditer le code
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={handleRun}
                      disabled={isBuilding}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {isBuilding ? 'Build...' : 'Lancer le build'}
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => setShowShareDialog(true)}
                      disabled={!permissions?.canShare}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Partager
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={handleExport}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exporter
                    </Button>
                  </div>
                </Card>
              </TabsContent>

              {/* Onglet Builds */}
              <TabsContent value="builds" className="space-y-4 mt-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">Builds récents</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRun}
                      disabled={isBuilding}
                    >
                      {isBuilding ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Build en cours
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Nouveau build
                        </>
                      )}
                    </Button>
                  </div>

                  {builds.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aucun build pour le moment</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {builds.map((build) => (
                        <div
                          key={build.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getBuildStatusBadge(build.status)}
                            <div>
                              <p className="font-medium">Build #{build.id.slice(-8)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(build.createdAt)}
                              </p>
                            </div>
                          </div>
                          <Link to={`/vibe/projects/${projectId}/builds/${build.id}`}>
                            <Button variant="ghost" size="sm">
                              Détails
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Onglet Fichiers */}
              <TabsContent value="files" className="space-y-4 mt-4">
                <Card className="p-4">
                  <h3 className="font-bold mb-4">Structure du projet</h3>
                  <FileTree files={stats?.files || []} formatSize={formatSize} />
                </Card>
              </TabsContent>

              {/* Onglet Activité */}
              <TabsContent value="activity" className="space-y-4 mt-4">
                <Card className="p-4">
                  <h3 className="font-bold mb-4">Activité récente</h3>
                  <div className="space-y-2">
                    {stats?.activity?.map((activity, index) => (
                      <ActivityItem key={index} activity={activity} />
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Colonne latérale */}
          <div className="space-y-6">
            {/* Informations */}
            <Card className="p-4">
              <h3 className="font-bold mb-3">Informations</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{project.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créé le</span>
                  <span>{formatDate(project.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modifié le</span>
                  <span>{formatDate(project.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>{project.version || '1.0.0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visibilité</span>
                  <span>{project.isPublic ? 'Public' : 'Privé'}</span>
                </div>
              </div>
            </Card>

            {/* Collaborateurs */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">Collaborateurs</h3>
                {permissions?.canShare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowShareDialog(true)}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Inviter
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {/* Propriétaire */}
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>{user?.email?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">Propriétaire</p>
                  </div>
                </div>

                {/* Autres collaborateurs */}
                {collaborators
                  .filter(c => c.userId !== user?.id)
                  .map(collab => (
                    <div key={collab.userId} className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 bg-blue-500/20">
                        <AvatarFallback>
                          {collab.email?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{collab.email}</p>
                        <p className="text-xs text-muted-foreground">{collab.role}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>

  {/* Dernier build */}
            {builds.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold mb-3">Dernier build</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    {getBuildStatusBadge(builds[0].status)}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(builds[0].createdAt)}
                    </span>
                  </div>
                  {builds[0].duration && (
                    <p className="text-sm">
                      Durée : {Math.round(builds[0].duration / 1000)}s
                    </p>
                  )}
                  {builds[0].size && (
                    <p className="text-sm">
                      Taille : {formatSize(builds[0].size)}
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

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
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="collaborateur@exemple.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="role">Rôle</Label>
              <Select value={shareRole} onValueChange={setShareRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Lecteur</SelectItem>
                  <SelectItem value="editor">Éditeur</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              Les collaborateurs recevront une invitation par email
            </p>
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

      {/* Dialog de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le projet</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Tapez <strong>{CONFIRM_DELETE_TEXT}</strong> pour confirmer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Input
              placeholder={`Tapez ${CONFIRM_DELETE_TEXT} pour confirmer`}
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={confirmDeleteText !== CONFIRM_DELETE_TEXT}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

ProjectDetail.propTypes = {};

export default ProjectDetail
FileTree.propTypes = {
  files: PropTypes.array,
  formatSize: PropTypes.any.isRequired,
};
ActivityItem.propTypes = {
  activity: PropTypes.any.isRequired,
};
