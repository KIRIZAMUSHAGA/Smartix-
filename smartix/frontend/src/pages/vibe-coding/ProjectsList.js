/**
 * ProjectsList - Liste des projets Vibe-coding
 * Version PRO avec optimisations SaaS
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  FolderGit2, Code2, Clock, Users, Star, 
  ArrowRight, Plus, Search, Filter, X,
  Calendar, Activity, GitBranch, Download,
  MoreVertical, Edit, Copy, Archive, Trash2,
  CheckCircle, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import { toast } from 'sonner'

// Hooks d'authentification
import { useAuth } from '../../hooks/useAuth'

// Services Vibe-coding
import { projectService } from '../../vibe-coding/services/projectService'

// Composants UI
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select'
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

const PROJECT_STATUS = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  EDITING: 'editing',
  RUNNING: 'running',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
}

const PROJECT_TYPES = [
  'react',
  'react-native',
  'node',
  'html',
  'vue',
  'angular',
  'next',
  'gatsby'
]

const ITEMS_PER_PAGE = 12
const MAX_PAGE_BUTTONS = 7

// =============================
// SKELETON
// =============================

const ProjectSkeleton = () => (
  <div className="animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-muted rounded-lg" />
            <div className="flex-1">
              <div className="h-5 w-3/4 bg-muted rounded mb-2" />
              <div className="h-4 w-1/2 bg-muted rounded" />
            </div>
          </div>
          <div className="h-4 w-full bg-muted rounded mb-2" />
          <div className="h-4 w-2/3 bg-muted rounded mb-3" />
          <div className="flex justify-between">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
        </Card>
      ))}
    </div>
  </div>
)

// =============================
// HOOK PERSONNALISÉ
// =============================

const useProjects = (userId, filters) => {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(null)

  const {
    page,
    sortBy,
    sortOrder,
    searchQuery,
    statusFilter,
    typeFilter
  } = filters

  // Query principale avec tous les filtres (server-side)
  const projectsQuery = useQuery({
    queryKey: [
      'projects',
      'list',
      userId,
      page,
      sortBy,
      sortOrder,
      searchQuery,
      statusFilter,
      typeFilter
    ],
    queryFn: async () => {
      const offset = (page - 1) * ITEMS_PER_PAGE
      return projectService.listUserProjects(userId, {
        limit: ITEMS_PER_PAGE,
        offset,
        sortBy,
        sortOrder,
        search: searchQuery,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined
      })
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  })

  // Stats utilisateur
  const statsQuery = useQuery({
    queryKey: ['projects', 'stats', userId],
    queryFn: () => projectService.getUserStats(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  // Mutations
  const duplicateMutation = useMutation({
    mutationFn: (projectId) => projectService.cloneProject(projectId, userId),
    onSuccess: () => {
      // ✅ CORRECTION: Invalidation partielle
      queryClient.invalidateQueries({
        queryKey: ['projects', 'list', userId]
      })
      toast.success('Projet dupliqué avec succès')
    },
    onError: () => {
      toast.error('Impossible de dupliquer le projet')
    }
  })

  const archiveMutation = useMutation({
    mutationFn: (projectId) => projectService.archiveProject(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', 'list', userId]
      })
      toast.success('Projet archivé')
    },
    onError: () => {
      toast.error('Impossible d\'archiver le projet')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (projectId) => projectService.deleteProject(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', 'list', userId]
      })
      toast.success('Projet supprimé')
      setConfirmDelete(null)
    },
    onError: () => {
      toast.error('Impossible de supprimer le projet')
      setConfirmDelete(null)
    }
  })

  // ✅ NOUVEAU: Bulk archive
  const bulkArchiveMutation = useMutation({
    mutationFn: (projectIds) => 
      projectService.bulkArchiveProjects(projectIds, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', 'list', userId]
      })
      toast.success('Projets archivés avec succès')
    },
    onError: () => {
      toast.error('Erreur lors de l\'archivage')
    }
  })

  return {
    projects: projectsQuery.data?.projects || [],
    total: projectsQuery.data?.total || 0,
    stats: statsQuery.data || null,
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
    error: projectsQuery.error,
    duplicateProject: duplicateMutation.mutate,
    archiveProject: archiveMutation.mutate,
    deleteProject: deleteMutation.mutate,
    bulkArchive: bulkArchiveMutation.mutate,
    isDuplicating: duplicateMutation.isLoading,
    isArchiving: archiveMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
    isBulkArchiving: bulkArchiveMutation.isLoading,
    confirmDelete,
    setConfirmDelete,
    refetch: () => {
      projectsQuery.refetch()
      statsQuery.refetch()
    }
  }
}

// =============================
// COMPOSANT PAGINATION INTELLIGENTE
// =============================

const SmartPagination = ({ currentPage, totalPages, onPageChange }) => {
  const getPageNumbers = useCallback(() => {
    if (totalPages <= MAX_PAGE_BUTTONS) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const half = Math.floor(MAX_PAGE_BUTTONS / 2)
    let start = Math.max(currentPage - half, 1)
    let end = Math.min(start + MAX_PAGE_BUTTONS - 1, totalPages)

    if (end - start + 1 < MAX_PAGE_BUTTONS) {
      start = Math.max(end - MAX_PAGE_BUTTONS + 1, 1)
    }

    const pages = []
    
    if (start > 1) {
      pages.push(1)
      if (start > 2) pages.push('...')
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...')
      pages.push(totalPages)
    }

    return pages
  }, [currentPage, totalPages])

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
      >
        <ChevronsLeft className="w-4 h-4" />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {getPageNumbers().map((page, index) => (
        page === '...' ? (
          <span key={`ellipsis-${index}`} className="px-2">...</span>
        ) : (
          <Button
            key={page}
            variant={currentPage === page ? 'default' : 'outline'}
            className={currentPage === page ? 'bg-purple-500 hover:bg-purple-600' : ''}
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        )
      ))}

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
      >
        <ChevronsRight className="w-4 h-4" />
      </Button>
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ProjectsList = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const userId = user?.id

  // États des filtres (server-side)
  const [filters, setFilters] = useState({
    page: 1,
    searchQuery: '',
    statusFilter: 'all',
    typeFilter: 'all',
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  })

  // États UI
  const [selectedProjects, setSelectedProjects] = useState(new Set())
  const [showFilters, setShowFilters] = useState(false)

  // Redirection si non connecté
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: '/vibe/projects' } })
    }
  }, [isAuthenticated, navigate])

  // Hook personnalisé
  const {
    projects,
    total,
    stats,
    isLoading,
    isError,
    error,
    duplicateProject,
    archiveProject,
    deleteProject,
    bulkArchive,
    isBulkArchiving,
    confirmDelete,
    setConfirmDelete,
    refetch
  } = useProjects(userId, filters)

  // =============================
  // GESTIONNAIRES
  // =============================
  const handleCreateProject = useCallback(() => {
    navigate('/vibe/projects/create')
  }, [navigate])

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const handlePageChange = useCallback((page) => {
    setFilters(prev => ({ ...prev, page }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleDuplicateProject = useCallback(async (projectId) => {
    duplicateProject(projectId)
  }, [duplicateProject])

  const handleArchiveProject = useCallback(async (projectId) => {
    archiveProject(projectId)
  }, [archiveProject])

  const handleDeleteProject = useCallback(async (projectId) => {
    setConfirmDelete(projectId)
  }, [setConfirmDelete])

  const confirmDeleteProject = useCallback(async () => {
    if (confirmDelete) {
      deleteProject(confirmDelete)
    }
  }, [confirmDelete, deleteProject])

  const handleExportProject = useCallback(async (projectId) => {
    try {
      const data = await projectService.exportProject(projectId, userId)
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/octet-stream' 
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `project-${projectId}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Projet exporté')
    } catch (error) {
      toast.error('Impossible d\'exporter le projet')
    }
  }, [userId])

  const handleSelectProject = useCallback((e, projectId) => {
    e.stopPropagation()
    e.preventDefault()
    
    setSelectedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback((e) => {
    e.stopPropagation()
    
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set())
    } else {
      setSelectedProjects(new Set(projects.map(p => p.id)))
    }
  }, [projects, selectedProjects])

  const handleBulkArchive = useCallback(async () => {
    if (selectedProjects.size === 0) return
    
    bulkArchive(Array.from(selectedProjects), {
      onSuccess: () => setSelectedProjects(new Set())
    })
  }, [selectedProjects, bulkArchive])

  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      searchQuery: '',
      statusFilter: 'all',
      typeFilter: 'all',
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    })
  }, [])

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
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
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

  const getTypeIcon = useCallback((type) => {
    const icons = {
      'react': '⚛️',
      'react-native': '📱',
      'node': '🟢',
      'html': '🌐',
      'vue': '🟢',
      'angular': '🔺',
      'next': '▲',
      'gatsby': '⚡'
    }
    return icons[type] || '📦'
  }, [])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erreur de chargement</h2>
          <p className="text-muted-foreground mb-6">
            {error?.message || 'Impossible de charger les projets'}
          </p>
          <Button onClick={() => refetch()} className="bg-purple-500 hover:bg-purple-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="projects-list min-h-screen bg-background pb-12">
      {/* Modal de confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le projet sera définitivement supprimé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteProject}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-900 to-pink-900 text-white px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FolderGit2 className="w-8 h-8" />
                Mes projets
              </h1>
              <p className="text-white/80 mt-1">
                {stats?.totalProjects || total} projet(s) au total
              </p>
            </div>
            
            <Button 
              onClick={handleCreateProject}
              size="lg" 
              className="bg-white text-purple-900 hover:bg-white/90 font-bold"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouveau projet
            </Button>
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="max-w-7xl mx-auto px-4 -mt-4 relative z-10 mb-6">
        <Card className="p-4 bg-card/80 backdrop-blur-sm border border-border/50">
          <div className="flex flex-col gap-4">
            {/* Recherche et filtres */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un projet..."
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="md:w-auto"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtres
                {(filters.statusFilter !== 'all' || filters.typeFilter !== 'all') && (
                  <span className="ml-2 w-2 h-2 bg-purple-500 rounded-full" />
                )}
              </Button>

              <Select value={filters.sortBy} onValueChange={(v) => handleFilterChange('sortBy', v)}>
                <SelectTrigger className="md:w-[180px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt">Date de modification</SelectItem>
                  <SelectItem value="createdAt">Date de création</SelectItem>
                  <SelectItem value="name">Nom</SelectItem>
                  <SelectItem value="status">Statut</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleFilterChange('sortOrder', 
                  filters.sortOrder === 'desc' ? 'asc' : 'desc'
                )}
                title={filters.sortOrder === 'desc' ? 'Décroissant' : 'Croissant'}
              >
                {filters.sortOrder === 'desc' ? '↓' : '↑'}
              </Button>
            </div>
  {/* Panneau de filtres */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Statut
                  </label>
                  <Select 
                    value={filters.statusFilter} 
                    onValueChange={(v) => handleFilterChange('statusFilter', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value={PROJECT_STATUS.DRAFT}>Brouillon</SelectItem>
                      <SelectItem value={PROJECT_STATUS.GENERATED}>Généré</SelectItem>
                      <SelectItem value={PROJECT_STATUS.EDITING}>En édition</SelectItem>
                      <SelectItem value={PROJECT_STATUS.RUNNING}>En cours</SelectItem>
                      <SelectItem value={PROJECT_STATUS.PUBLISHED}>Publié</SelectItem>
                      <SelectItem value={PROJECT_STATUS.ARCHIVED}>Archivé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Type
                  </label>
                  <Select 
                    value={filters.typeFilter} 
                    onValueChange={(v) => handleFilterChange('typeFilter', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {PROJECT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>
                          {getTypeIcon(type)} {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Actions groupées */}
            {selectedProjects.size > 0 && (
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <span className="text-sm text-muted-foreground">
                  {selectedProjects.size} projet(s) sélectionné(s)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkArchive}
                    disabled={isBulkArchiving}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {isBulkArchiving ? 'Archivage...' : 'Archiver'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProjects(new Set())}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Désélectionner
                  </Button>
                </div>
              </div>
            )}

            {/* Checkbox "Tout sélectionner" */}
            {projects.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={selectedProjects.size === projects.length}
                  onChange={handleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded border-border bg-background"
                />
                <span className="text-sm text-muted-foreground">
                  Tout sélectionner
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Liste des projets */}
      <div className="max-w-7xl mx-auto px-4">
        {isLoading ? (
          <ProjectSkeleton />
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderGit2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold mb-2">Aucun projet</h3>
            <p className="text-muted-foreground mb-6">
              {filters.searchQuery || filters.statusFilter !== 'all' || filters.typeFilter !== 'all'
                ? "Aucun projet ne correspond aux filtres"
                : "Commencez par créer votre premier projet"}
            </p>
            {(filters.searchQuery || filters.statusFilter !== 'all' || filters.typeFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={resetFilters}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réinitialiser les filtres
              </Button>
            )}
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card key={project.id} className="relative group hover:shadow-lg transition-all">
                  {/* Checkbox de sélection */}
                  <div className="absolute top-3 left-3 z-10">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={(e) => handleSelectProject(e, project.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-border bg-background"
                    />
                  </div>

                  {/* Menu d'actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link to={`/vibe/projects/${project.id}/edit`}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateProject(project.id)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Dupliquer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExportProject(project.id)}>
                        <Download className="w-4 h-4 mr-2" />
                        Exporter
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchiveProject(project.id)}>
                        <Archive className="w-4 h-4 mr-2" />
                        Archiver
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Lien principal */}
                  <Link 
                    to={`/vibe/projects/${project.id}`} 
                    className="block p-4"
                    onClick={(e) => {
                      if (selectedProjects.has(project.id)) {
                        e.preventDefault()
                      }
                    }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                        <Code2 className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(project.status)}
                          <span className="text-xs text-muted-foreground">
                            {getTypeIcon(project.type)} {project.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3 min-h-[40px]">
                      {project.description || 'Aucune description'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span className="capitalize">{project.status}</span>
                      </div>
                      <span>{formatDate(project.updatedAt)}</span>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>

            {/* Pagination intelligente */}
            {totalPages > 1 && (
              <div className="mt-8">
                <SmartPagination
                  currentPage={filters.page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

ProjectsList.propTypes = {};

export default ProjectsList
ProjectSkeleton.propTypes = {};
SmartPagination.propTypes = {
  currentPage: PropTypes.any.isRequired,
  totalPages: PropTypes.any.isRequired,
  onPageChange: PropTypes.func.isRequired,
};
