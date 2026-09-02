/**
 * MarketplaceApps - Page principale du marketplace d'applications
 * Version ULTIME avec optimisations senior
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  Search, Filter, Grid, List, Star, Download, 
  Eye, Clock, TrendingUp, Sparkles, Code2,
  Smartphone, Tablet, Monitor, Globe, Zap,
  ChevronDown, X, Loader2, AlertCircle
} from 'lucide-react'

// Services marketplace
import { getPublishService } from '../marketplace/publishService'
import { getSearchService } from '../vibe-coding/marketplace/searchService'
import { getTrendingService } from '../vibe-coding/marketplace/trendingService'

// Composants UI
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '../components/ui/pagination'
import { Skeleton } from '../components/ui/skeleton'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES (gelées)
// =============================

const CATEGORIES = Object.freeze([
  { id: 'all', name: 'Toutes', icon: '📱' },
  { id: 'games', name: 'Jeux', icon: '🎮' },
  { id: 'productivity', name: 'Productivité', icon: '✅' },
  { id: 'education', name: 'Éducation', icon: '📚' },
  { id: 'entertainment', name: 'Divertissement', icon: '🎬' },
  { id: 'utilities', name: 'Utilitaires', icon: '🔧' },
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'social', name: 'Social', icon: '👥' }
])

const SORT_OPTIONS = Object.freeze([
  { value: 'trending', label: 'Tendances' },
  { value: 'downloads', label: 'Téléchargements' },
  { value: 'rating', label: 'Note' },
  { value: 'newest', label: 'Nouveautés' },
  { value: 'name', label: 'Nom' }
])

const ITEMS_PER_PAGE = 12
const SEARCH_DEBOUNCE = 300

// =============================
// COMPOSANTS MEMOÏSÉS
// =============================

const AppCard = React.memo(({ app }) => {
  const rating = app.stats?.rating || 0
  const downloads = app.stats?.downloads || 0
  const reviews = app.stats?.reviewsCount || 0

  return (
    <Link to={`/apps/${app.id}`}>
      <Card className="p-4 hover:shadow-lg transition-all hover:scale-[1.02] h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-purple-400" />
          </div>
          <Badge variant="outline" className="capitalize">
            {app.category || 'général'}
          </Badge>
        </div>

        <h3 className="font-bold mb-1 line-clamp-1">{app.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">
          {app.description || 'Aucune description'}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Star className={`w-3 h-3 ${rating > 0 ? 'text-yellow-400 fill-yellow-400' : ''}`} />
            <span>{rating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            <span>{downloads.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span>{reviews}</span>
          </div>
        </div>

        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {app.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </Link>
  )
})

AppCard.displayName = 'AppCard'

// =============================
// HOOKS DÉCOUPLÉS (sans toast)
// =============================

const useTrendingApps = ({ onError } = {}) => {
  const trendingService = getTrendingService()
  
  return useQuery({
    queryKey: ['marketplace', 'trending'],
    queryFn: async () => {
      try {
        return await trendingService.getTrending({ limit: 10 })
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

const useRecentApps = ({ onError } = {}) => {
  const publishService = getPublishService()
  
  return useQuery({
    queryKey: ['marketplace', 'recent'],
    queryFn: async () => {
      try {
        const result = await publishService.listApps({ 
          sortBy: 'createdAt', 
          sortOrder: 'desc',
          limit: 10 
        })
        return result.items || []
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

const usePopularApps = ({ onError } = {}) => {
  const publishService = getPublishService()
  
  return useQuery({
    queryKey: ['marketplace', 'popular'],
    queryFn: async () => {
      try {
        const result = await publishService.listApps({ 
          sortBy: 'downloads', 
          sortOrder: 'desc',
          limit: 10 
        })
        return result.items || []
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

const useSearchApps = (filters, { onError } = {}) => {
  const searchService = getSearchService()
  const queryClient = useQueryClient()

  // ✅ Cache stable (pas de référence objet)
  const queryKey = useMemo(() => [
    'marketplace',
    'search',
    filters.query,
    filters.category,
    filters.minRating,
    filters.sortBy,
    filters.page
  ], [filters])

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await searchService.search(filters.query || '', {
          category: filters.category !== 'all' ? filters.category : undefined,
          minRating: filters.minRating,
          sortBy: filters.sortBy,
          page: filters.page,
          limit: ITEMS_PER_PAGE
        })
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    enabled: !!filters?.query?.trim(),
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
  })

  // ✅ Prefetch de la page suivante
  useEffect(() => {
    if (query.data?.total > filters.page * ITEMS_PER_PAGE) {
      const nextPage = filters.page + 1
      queryClient.prefetchQuery({
        queryKey: [...queryKey.slice(0, -1), nextPage],
        queryFn: () => searchService.search(filters.query || '', {
          category: filters.category !== 'all' ? filters.category : undefined,
          minRating: filters.minRating,
          sortBy: filters.sortBy,
          page: nextPage,
          limit: ITEMS_PER_PAGE
        }),
        staleTime: 2 * 60 * 1000,
      })
    }
  }, [query.data, filters, queryClient, queryKey])

  return query
}

// =============================
// SKELETON INTELLIGENT
// =============================

const AppSkeleton = React.memo(() => (
  <Card className="p-4 animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="w-12 h-12 bg-muted rounded-xl" />
      <div className="w-16 h-6 bg-muted rounded-full" />
    </div>
    <div className="h-6 w-3/4 bg-muted rounded mb-2" />
    <div className="h-4 w-full bg-muted rounded mb-1" />
    <div className="h-4 w-2/3 bg-muted rounded mb-3" />
    <div className="flex gap-3 mb-3">
      <div className="h-4 w-12 bg-muted rounded" />
      <div className="h-4 w-12 bg-muted rounded" />
      <div className="h-4 w-12 bg-muted rounded" />
    </div>
  </Card>
))

AppSkeleton.displayName = 'AppSkeleton'

// =============================
// COMPOSANTS DE SECTIONS
// =============================

const TrendingSection = ({ data, isLoading }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-purple-400" />
        Applications tendances
      </h2>
      <Link to="/apps?sort=trending" className="text-sm text-purple-400 hover:text-purple-300">
        Voir tout →
      </Link>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {isLoading ? (
        [...Array(5)].map((_, i) => <AppSkeleton key={i} />)
      ) : (
        data.slice(0, 5).map(app => <AppCard key={app.id} app={app} />)
      )}
    </div>
  </div>
)

const RecentSection = ({ data, isLoading }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-yellow-400" />
        Nouveautés
      </h2>
      <Link to="/apps?sort=newest" className="text-sm text-yellow-400 hover:text-yellow-300">
        Voir tout →
      </Link>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {isLoading ? (
        [...Array(5)].map((_, i) => <AppSkeleton key={i} />)
      ) : (
        data.slice(0, 5).map(app => <AppCard key={app.id} app={app} />)
      )}
    </div>
  </div>
)

const PopularSection = ({ data, isLoading }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Download className="w-5 h-5 text-green-400" />
        Les plus téléchargées
      </h2>
      <Link to="/apps?sort=downloads" className="text-sm text-green-400 hover:text-green-300">
        Voir tout →
      </Link>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {isLoading ? (
        [...Array(5)].map((_, i) => <AppSkeleton key={i} />)
      ) : (
        data.slice(0, 5).map(app => <AppCard key={app.id} app={app} />)
      )}
    </div>
  </div>
)

// =============================
// COMPOSANT PRINCIPAL
// =============================
const MarketplaceApps = () => {
  // États des filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [minRating, setMinRating] = useState(0)
  const [sortBy, setSortBy] = useState('trending')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState('grid')

  // États UI
  const [showFilters, setShowFilters] = useState(false)
  const searchTimeoutRef = useRef(null)

  // Hooks avec callbacks (découplés)
  const { 
    data: trending = [], 
    isLoading: trendingLoading 
  } = useTrendingApps({
    onError: () => toast.error("Erreur chargement des tendances")
  })

  const { 
    data: recent = [], 
    isLoading: recentLoading 
  } = useRecentApps({
    onError: () => toast.error("Erreur chargement des nouveautés")
  })

  const { 
    data: popular = [], 
    isLoading: popularLoading 
  } = usePopularApps({
    onError: () => toast.error("Erreur chargement des populaires")
  })

  // Filtres stables
  const filters = useMemo(() => ({
    query: debouncedSearch,
    category: selectedCategory,
    minRating: minRating > 0 ? minRating : undefined,
    sortBy,
    page: currentPage
  }), [debouncedSearch, selectedCategory, minRating, sortBy, currentPage])

  // Recherche avec cache stable
  const { 
    data: searchData, 
    isLoading: isSearching,
    isFetching: isSearchFetching 
  } = useSearchApps(filters, {
    onError: () => toast.error("Erreur lors de la recherche")
  })

  const searchResults = searchData?.results || []
  const searchTotal = searchData?.total || 0

  // Debounce recherche
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

  // Flag de recherche active
  const isSearchActive = !!debouncedSearch

  // Pagination sécurisée
  const totalPages = isSearchActive ? Math.ceil(searchTotal / ITEMS_PER_PAGE) : 1

  const handlePageChange = useCallback((page) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [totalPages])

  const resetFilters = useCallback(() => {
    setSelectedCategory('all')
    setMinRating(0)
    setSortBy('trending')
    setCurrentPage(1)
  }, [])

  // États de chargement précis
  const isLoadingSearch = isSearchActive && isSearching && !searchData
  const isLoadingHome = trendingLoading || recentLoading || popularLoading

  // =============================
  // RENDU
  // =============================
  return (
    <div className="marketplace-apps min-h-screen bg-background pb-12">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 text-white px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-black mb-3">📱 Marketplace d'applications</h1>
          <p className="text-xl text-white/80 max-w-2xl mb-8">
            Découvrez des applications créées par la communauté
          </p>

          {/* Barre de recherche */}
          <div className="flex gap-3 max-w-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Rechercher une application..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                aria-label="Rechercher une application"
              />
              {searchQuery && (
                <X
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50 hover:text-white cursor-pointer"
                  aria-label="Effacer la recherche"
                />
              )}
              {isSearchFetching && (
                <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-white/50" />
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
              <SelectTrigger className="w-[180px] border-white/20 text-white" aria-label="Trier par">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Catégorie
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Note minimum
                </label>
                <Select value={minRating.toString()} onValueChange={(v) => setMinRating(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Toutes</SelectItem>
                    <SelectItem value="3">3★ et plus</SelectItem>
                    <SelectItem value="4">4★ et plus</SelectItem>
                    <SelectItem value="5">5★ uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end mt-4 pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                aria-label="Réinitialiser les filtres"
              >
                <X className="w-4 h-4 mr-2" />
                Réinitialiser
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4">
        {isSearchActive ? (
          // Mode recherche
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                Résultats pour "{debouncedSearch}"
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({searchTotal} application{searchTotal > 1 ? 's' : ''})
                </span>
              </h2>
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

            {isLoadingSearch ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <AppSkeleton key={i} />)}
              </div>
            ) : searchResults.length === 0 ? (
              <Card className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Aucune application trouvée</h3>
                <p className="text-muted-foreground mb-4">
                  Essayez de modifier vos critères de recherche
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Suggestions :</p>
                  <ul className="list-disc list-inside">
                    <li>Choisir une autre catégorie</li>
                    <li>Enlever les filtres</li>
                    <li>Utiliser un mot-clé plus simple</li>
                  </ul>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery('')}
                  className="mt-6"
                >
                  Effacer la recherche
                </Button>
              </Card>
            ) : (
              <>
                <div className={`grid ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4'
                    : 'grid-cols-1 gap-3'
                }`}>
                  {searchResults.map(app => (
                    viewMode === 'grid' ? (
                      <AppCard key={app.id} app={app} />
                    ) : (
                      <Card key={app.id} className="p-4 hover:bg-card/80 transition-all">
                        <Link to={`/apps/${app.id}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                              <Smartphone className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                              <h3 className="font-bold">{app.name}</h3>
                              <p className="text-sm text-muted-foreground">{app.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                              <span>{app.stats?.rating?.toFixed(1) || 0}</span>
                            </div>
                            <Badge variant="outline">{app.category}</Badge>
                          </div>
                        </Link>
                      </Card>
                    )
                  ))}
                </div>

                {/* Pagination avec préfetch */}
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
                        
                        {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                          let pageNum
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (currentPage <= 3) {
                            pageNum = i + 1
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = currentPage - 2 + i
                          }

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
          </>
        ) : (
          // Mode accueil (sections)
          <>
            <TrendingSection data={trending} isLoading={trendingLoading} />
            <RecentSection data={recent} isLoading={recentLoading} />
            <PopularSection data={popular} isLoading={popularLoading} />
          </>
        )}
      </div>
    </div>
  )
}

MarketplaceApps.propTypes = {};

export default MarketplaceApps
TrendingSection.propTypes = {
  data: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
};
RecentSection.propTypes = {
  data: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
};
PopularSection.propTypes = {
  data: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
};
