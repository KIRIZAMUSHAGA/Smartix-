/**
 * TemplatesList - Liste des templates disponibles
 * Version SCALABLE avec filtres backend, pagination réelle et accessibilité
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  Rocket, Star, Search, Filter, Grid, 
  LayoutGrid, List, ChevronDown, Download,
  Eye, Clock, Users, Zap, Award, TrendingUp,
  Sparkles, Code2, Smartphone, Globe, Database,
  Shield, Wifi, Cpu, HardDrive, X
} from 'lucide-react'

// Hooks d'authentification
import { useAuth } from '../../hooks/useAuth'

// Services Vibe-coding
import { templateService } from '../../vibe-coding/services/templateService'

// Composants UI
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '../../components/ui/pagination'
import { Skeleton } from '../../components/ui/skeleton'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'Tous', icon: '📋' },
  { id: 'productivity', name: 'Productivité', icon: '✅' },
  { id: 'social', name: 'Social', icon: '👥' },
  { id: 'lifestyle', name: 'Lifestyle', icon: '🌟' },
  { id: 'finance', name: 'Finance', icon: '💰' },
  { id: 'education', name: 'Éducation', icon: '📚' },
  { id: 'utilities', name: 'Utilitaires', icon: '🔧' },
  { id: 'games', name: 'Jeux', icon: '🎮' },
  { id: 'ecommerce', name: 'E-commerce', icon: '🛒' },
  { id: 'analytics', name: 'Analytics', icon: '📊' }
]

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Popularité' },
  { value: 'recent', label: 'Récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom' }
]

const ITEMS_PER_PAGE = 12
const SEARCH_DEBOUNCE = 300

// =============================
// HOOK PERSONNALISÉ (SCALABLE)
// =============================

const useTemplatesData = (filters) => {
  const queryClient = useQueryClient()

  // ✅ Query principale avec filtres backend
  const templatesQuery = useQuery({
    queryKey: ['templates', 'list', filters],
    queryFn: () => templateService.getTemplates(filters),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Query pour les templates en vedette (indépendante des filtres)
  const featuredQuery = useQuery({
    queryKey: ['templates', 'featured'],
    queryFn: () => templateService.getFeaturedTemplates(6),
    staleTime: 10 * 60 * 1000,
  })

  // Query pour les statistiques (catégories, etc.)
  const statsQuery = useQuery({
    queryKey: ['templates', 'stats'],
    queryFn: () => templateService.getTemplateStats(),
    staleTime: 10 * 60 * 1000,
  })

  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['templates'] })
  }, [queryClient])

  return {
    templates: templatesQuery.data?.templates || [],
    total: templatesQuery.data?.total || 0,
    featuredTemplates: featuredQuery.data || [],
    stats: statsQuery.data || {},
    isLoading: templatesQuery.isLoading || featuredQuery.isLoading,
    isFetching: templatesQuery.isFetching,
    isError: templatesQuery.isError,
    error: templatesQuery.error,
    refetch: refetchAll
  }
}

// =============================
// COMPOSANT SKELETON
// =============================

const TemplateSkeleton = () => (
  <Card className="p-4 animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="w-12 h-12 bg-muted rounded-lg" />
      <div className="w-16 h-6 bg-muted rounded-full" />
    </div>
    <div className="h-6 w-3/4 bg-muted rounded mb-2" />
    <div className="h-4 w-full bg-muted rounded mb-1" />
    <div className="h-4 w-2/3 bg-muted rounded mb-3" />
    <div className="flex gap-2 mt-4">
      <div className="h-8 w-16 bg-muted rounded flex-1" />
      <div className="h-8 w-16 bg-muted rounded flex-1" />
    </div>
  </Card>
)

// =============================
// COMPOSANT PRINCIPAL
// =============================
const TemplatesList = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const searchTimeoutRef = useRef(null)

  // =============================
  // ÉTATS DES FILTRES (backend)
  // =============================
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [priceRange, setPriceRange] = useState({ min: null, max: null })
  const [complexity, setComplexity] = useState('all')
  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const [sortBy, setSortBy] = useState('popularity')
  const [currentPage, setCurrentPage] = useState(1)

  // États UI
  const [viewMode, setViewMode] = useState('grid')
  const [showFilters, setShowFilters] = useState(false)

  // ✅ Debounce pour la recherche
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, SEARCH_DEBOUNCE)

    return () => clearTimeout(searchTimeoutRef.current)
  }, [searchQuery])

  // ✅ Construction des filtres pour le backend
  const filters = useMemo(() => ({
    search: debouncedSearch || undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    complexity: complexity !== 'all' ? complexity : undefined,
    freeOnly: showFreeOnly || undefined,
    minPrice: priceRange.min || undefined,
    maxPrice: priceRange.max || undefined,
    sortBy,
    page: currentPage,
    limit: ITEMS_PER_PAGE
  }), [debouncedSearch, selectedCategory, complexity, showFreeOnly, priceRange, sortBy, currentPage])

  // Données avec React Query
  const {
    templates,
    total,
    featuredTemplates,
    stats,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useTemplatesData(filters)

  // Catégories avec compteurs (depuis stats)
  const categories = useMemo(() => {
    const cats = Object.entries(stats.byCategory || {}).map(([id, count]) => ({
      id,
      name: TEMPLATE_CATEGORIES.find(c => c.id === id)?.name || id,
      icon: TEMPLATE_CATEGORIES.find(c => c.id === id)?.icon || '📦',
      count
    }))
    
    return [
      { id: 'all', name: 'Tous', icon: '📋', count: stats.total || 0 },
      ...cats
    ]
  }, [stats])

  // Calcul de la pagination
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  // =============================
  // GESTIONNAIRES
  // =============================
  const handleUseTemplate = (template) => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: '/vibe/templates' } })
      return
    }
    navigate(`/vibe/projects/create?template=${template.id}`)
  }

  const handlePreview = (templateId) => {
    window.open(`/vibe/templates/${templateId}/preview`, '_blank')
  }

  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setDebouncedSearch('')
    setSelectedCategory('all')
    setComplexity('all')
    setShowFreeOnly(false)
    setPriceRange({ min: null, max: null })
    setSortBy('popularity')
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Gestion des erreurs
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">Erreur de chargement</h2>
          <p className="text-muted-foreground mb-4">
            {error?.message || "Impossible de charger les templates"}
          </p>
          <Button onClick={() => refetch()} aria-label="Réessayer de charger">
            Réessayer
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="templates-list min-h-screen bg-background pb-12">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 text-white px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-black mb-3">📦 Templates</h1>
          <p className="text-xl text-white/80 max-w-2xl mb-8">
            Des templates prêts à l'emploi pour démarrer vos projets plus rapidement
          </p>

          {/* Barre de recherche */}
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Rechercher un template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                aria-label="Rechercher des templates"
              />
              {isFetching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Afficher les filtres"
              aria-expanded={showFilters}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger 
                className="w-[180px] border-white/20 text-white"
                aria-label="Trier par"
              >
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Panneau de filtres */}
      {showFilters && (
        <div className="max-w-7xl mx-auto px-4 -mt-4 relative z-10 mb-6">
          <Card className="p-4 bg-card/80 backdrop-blur-sm border border-border/50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Catégories */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Catégorie
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name} ({cat.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Complexité */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Complexité
                </label>
                <Select value={complexity} onValueChange={setComplexity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="medium">Intermédiaire</SelectItem>
                    <SelectItem value="hard">Avancé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Prix min */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Prix min
                </label>
                <Input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min || ''}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value ? Number(e.target.value) : null }))}
                  min={0}
                />
              </div>

              {/* Prix max */}
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Prix max
                </label>
                <Input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max || ''}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value ? Number(e.target.value) : null }))}
                  min={0}
                />
              </div>
            </div>

            {/* Options supplémentaires */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showFreeOnly}
                    onChange={(e) => setShowFreeOnly(e.target.checked)}
                    className="rounded border-border"
                    aria-label="Afficher uniquement les templates gratuits"
                  />
                  <span className="text-sm">Gratuits uniquement</span>
                </label>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                aria-label="Réinitialiser tous les filtres"
              >
                <X className="w-4 h-4 mr-2" />
                Réinitialiser
              </Button>
        </div>
      </Card>
    </div>
      )}

      {/* Templates en vedette */}
      {featuredTemplates.length > 0 && !debouncedSearch && selectedCategory === 'all' && (
        <div className="max-w-7xl mx-auto px-4 mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              Templates en vedette
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredTemplates.map((template) => (
              <Card key={template.id} className="group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-pink-500" />
                
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{template.icon || '📦'}</span>
                    <div>
                      <h3 className="font-bold">{template.name}</h3>
                      <p className="text-xs text-muted-foreground">{template.category}</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {template.description}
                  </p>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{template.rating || '4.5'}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {template.complexity}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleUseTemplate(template)}
                      aria-label={`Utiliser le template ${template.name}`}
                    >
                      Utiliser
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePreview(template.id)}
                      aria-label={`Aperçu du template ${template.name}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Liste des templates */}
      <div className="max-w-7xl mx-auto px-4">
        {/* En-tête de la liste */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">
              Tous les templates
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({total} résultats)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              aria-label="Vue en grille"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              aria-label="Vue en liste"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

            {/* Résultats */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <TemplateSkeleton key={i} />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-bold mb-2">Aucun template trouvé</h3>
            <p className="text-muted-foreground mb-6">
              Essayez de modifier vos filtres ou d'effectuer une nouvelle recherche
            </p>
            <Button onClick={resetFilters} aria-label="Réinitialiser les filtres">
              Réinitialiser les filtres
            </Button>
          </Card>
        ) : (
          <>
            <div className={`grid ${
              viewMode === 'grid' 
                ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4'
                : 'grid-cols-1 gap-3'
            }`}>
              {templates.map((template) => (
                viewMode === 'grid' ? (
                  <Card key={template.id} className="p-4 hover:shadow-lg transition-all hover:scale-[1.02]">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl">{template.icon || '📦'}</span>
                      {template.price === 0 ? (
                        <Badge variant="outline" className="text-green-400 border-green-400">
                          Gratuit
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-purple-400 border-purple-400 text-xs">
                          {template.price} €
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-bold mb-2">{template.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {template.description}
                    </p>

                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs">{template.popularity || '4.5'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{new Date(template.createdAt || 0).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        <span className="text-xs">{template.usageCount || 0}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handlePreview(template.id)}
                        aria-label={`Aperçu du template ${template.name}`}
                      >
                        Aperçu
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                        onClick={() => handleUseTemplate(template)}
                        aria-label={`Utiliser le template ${template.name}`}
                      >
                        Utiliser
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Card key={template.id} className="p-4 hover:bg-card/80 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">{template.icon || '📦'}</span>
                        <div>
                          <h3 className="font-bold">{template.name}</h3>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {template.price === 0 ? (
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            Gratuit
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-purple-400 border-purple-400">
                            {template.price} €
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleUseTemplate(template)}
                          aria-label={`Utiliser le template ${template.name}`}
                        >
                          Utiliser
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Page précédente"
                      />
                    </PaginationItem>
                    
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1
                      // Afficher seulement les pages pertinentes
                      if (
                        totalPages <= 7 ||
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                      ) {
                        return (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNum)}
                              isActive={currentPage === pageNum}
                              aria-label={`Page ${pageNum}`}
                              aria-current={currentPage === pageNum ? 'page' : undefined}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      } else if (
                        pageNum === currentPage - 3 ||
                        pageNum === currentPage + 3
                      ) {
                        return (
                          <PaginationItem key={i}>
                            <span className="px-2" aria-hidden="true">...</span>
                          </PaginationItem>
                        )
                      }
                      return null
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Page suivante"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

TemplatesList.propTypes = {};

export default TemplatesList
TemplateSkeleton.propTypes = {};
