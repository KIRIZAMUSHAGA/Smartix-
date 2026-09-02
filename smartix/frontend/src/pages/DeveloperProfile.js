/**
 * DeveloperProfile - Page de profil d'un développeur
 * Version PRO avec corrections, optimisations et UX premium
 */

import React, { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  ArrowLeft, Star, Download, Eye, Clock, Users, 
  GitFork, Code2, Smartphone, Award, TrendingUp,
  Check, AlertCircle, Loader2, ChevronRight, Calendar,
  ExternalLink, Copy, ThumbsUp, MessageCircle, Heart,
  MapPin, Globe, Twitter, Github, Linkedin, Mail,
  Shield, Zap, Sparkles, Crown, Trophy, Flame
} from 'lucide-react'

// Hooks
import { useAuth } from '../hooks/useAuth'
import { useRequireAuth } from '../hooks/useRequireAuth'

// Services
import { getPublishService } from '../marketplace/publishService'
import { getForkService } from '../vibe-coding/marketplace/forkService'
import { getReviewService } from '../vibe-coding/marketplace/reviewService'

// Composants UI
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination'
import {

  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const ITEMS_PER_PAGE = 12
const RATING_BADGES = {
  GOLD: { threshold: 4.5, icon: Crown, color: 'text-yellow-400', label: 'Top Développeur' },
  SILVER: { threshold: 4.0, icon: Award, color: 'text-gray-400', label: 'Excellent' },
  BRONZE: { threshold: 3.5, icon: Star, color: 'text-orange-400', label: 'Très bien' }
}

const TRENDING_BADGES = {
  HOT: { threshold: 1000, icon: Flame, color: 'text-red-400', label: '🔥 En vogue' },
  RISING: { threshold: 500, icon: TrendingUp, color: 'text-green-400', label: '📈 En croissance' },
  NEW: { threshold: 30, icon: Sparkles, color: 'text-blue-400', label: '✨ Nouveau' }
}

// =============================
// UTILITAIRES
// =============================

const formatDate = (dateString) => {
  if (!dateString) return 'Date inconnue'
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

const calculateScore = (stats) => {
  const downloadsScore = Math.min(stats.totalDownloads / 1000, 100)
  const ratingScore = stats.averageRating * 20
  return Math.round((downloadsScore * 0.4 + ratingScore * 0.6) * 10) / 10
}

// =============================
// HOOKS SPÉCIALISÉS
// =============================

const useDeveloperApps = (userId, page = 1, { onError } = {}) => {
  const publishService = getPublishService()
  
  return useQuery({
    queryKey: ['developer', userId, 'apps', page],
    queryFn: async () => {
      try {
        const result = await publishService.listApps({
          developerId: userId,
          visibility: 'public',
          limit: ITEMS_PER_PAGE,
          offset: (page - 1) * ITEMS_PER_PAGE,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })
        return {
          apps: result.items || [],
          total: result.total || 0
        }
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

const useDeveloperStats = (apps) => {
  // ✅ Calcul des stats en useMemo (pas de query inutile)
  return useMemo(() => {
    const stats = apps.reduce((acc, app) => ({
      totalApps: acc.totalApps + 1,
      totalDownloads: acc.totalDownloads + (app.stats?.downloads || 0),
      totalInstalls: acc.totalInstalls + (app.stats?.installs || 0),
      totalViews: acc.totalViews + (app.stats?.views || 0),
      totalForks: acc.totalForks + (app.stats?.forks || 0),
      totalReviews: acc.totalReviews + (app.stats?.reviewsCount || 0),
      ratingSum: acc.ratingSum + (app.stats?.rating || 0) * (app.stats?.reviewsCount || 0)
    }), {
      totalApps: 0,
      totalDownloads: 0,
      totalInstalls: 0,
      totalViews: 0,
      totalForks: 0,
      totalReviews: 0,
      ratingSum: 0
    })

    return {
      ...stats,
      averageRating: stats.totalReviews > 0 
        ? stats.ratingSum / stats.totalReviews 
        : 0,
      score: calculateScore(stats)
    }
  }, [apps])
}

const useDeveloperInfo = (userId, { onError } = {}) => {
  // Simuler la récupération des infos développeur
  // À remplacer par un vrai appel API
  return useQuery({
    queryKey: ['developer', userId, 'info'],
    queryFn: async () => {
      try {
        // TODO: Remplacer par appel API réel
        return {
          id: userId,
          name: `Développeur ${userId?.slice(-4)}`,
          bio: 'Développeur passionné créant des applications innovantes pour la communauté.',
          location: 'France',
          website: 'https://example.com',
          twitter: '@developer',
          github: 'developer',
          linkedin: 'developer',
          joinedAt: new Date().toISOString(),
          avatar: null,
          isVerified: true
        }
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  })
}

// =============================
// COMPOSANTS
// =============================

const AppCard = React.memo(({ app }) => {
  const rating = app.stats?.rating || 0
  const downloads = app.stats?.downloads || 0
  const reviews = app.stats?.reviewsCount || 0
  const isNew = new Date(app.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const isTrending = downloads > 500

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] group">
      <Link to={`/apps/${app.id}`} className="block">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex gap-1">
              {isNew && (
                <Badge variant="outline" className="text-blue-400 border-blue-400 text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Nouveau
                </Badge>
              )}
              {isTrending && (
                <Badge variant="outline" className="text-orange-400 border-orange-400 text-xs">
                  <Flame className="w-3 h-3 mr-1" />
                  Tendance
                </Badge>
              )}
            </div>
          </div>

          <h3 className="font-bold mb-1 line-clamp-1 group-hover:text-purple-400 transition-colors">
            {app.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {app.description || 'Aucune description'}
          </p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className={`w-3 h-3 ${rating > 0 ? 'text-yellow-400 fill-yellow-400' : ''}`} />
              <span>{rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>{formatNumber(downloads)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{formatNumber(reviews)}</span>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  )
})

AppCard.displayName = 'AppCard'

const AppSkeleton = () => (
  <Card className="p-4 animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="w-12 h-12 bg-muted rounded-xl" />
      <div className="w-16 h-6 bg-muted rounded-full" />
    </div>
    <div className="h-6 w-3/4 bg-muted rounded mb-2" />
    <div className="h-4 w-full bg-muted rounded mb-1" />
    <div className="h-4 w-2/3 bg-muted rounded mb-3" />
    <div className="flex gap-3">
      <div className="h-4 w-12 bg-muted rounded" />
      <div className="h-4 w-12 bg-muted rounded" />
      <div className="h-4 w-12 bg-muted rounded" />
    </div>
  </Card>
)

const StatCard = ({ icon: Icon, label, value, color }) => (
  <Card className="p-4 text-center">
    <Icon className={`w-8 h-8 mx-auto mb-2 ${color}`} />
    <p className="text-2xl font-bold">{formatNumber(value)}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </Card>
)

// =============================
// COMPOSANT PRINCIPAL
// =============================
const DeveloperProfile = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const requireAuth = useRequireAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [isFollowing, setIsFollowing] = useState(false)

  // Données
  const { 
    data: appsData, 
    isLoading: appsLoading,
    isError: appsError
  } = useDeveloperApps(userId, currentPage, {
    onError: () => toast.error("Erreur chargement des applications")
  })

  const { 
    data: developer, 
    isLoading: devLoading 
  } = useDeveloperInfo(userId, {
    onError: () => toast.error("Erreur chargement du profil")
  })

  const apps = appsData?.apps || []
  const totalApps = appsData?.total || 0
  const totalPages = Math.ceil(totalApps / ITEMS_PER_PAGE)

  // ✅ Stats calculées en useMemo (pas de query inutile)
  const stats = useDeveloperStats(apps)

  // Badges
  const ratingBadge = Object.values(RATING_BADGES).find(
    badge => stats.averageRating >= badge.threshold
  )

  const trendingBadge = Object.values(TRENDING_BADGES).find(
    badge => stats.totalDownloads >= badge.threshold
  )

  // Gestionnaires
  const handleFollow = () => {
    if (!requireAuth()) return
    setIsFollowing(!isFollowing)
    toast.success(isFollowing ? "Désabonné" : "Abonné")
  }

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // États de chargement
  if (appsLoading || devLoading) {
    return (
      <div className="min-h-screen bg-background pb-12">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Skeleton className="h-64 rounded-lg mb-4" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-12 w-48 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <AppSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (appsError || !developer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Développeur non trouvé</h2>
          <p className="text-muted-foreground mb-4">
            Ce profil n'existe pas ou a été supprimé
          </p>
          <Button onClick={() => navigate('/apps')}>
            Retour au marketplace
          </Button>
        </Card>
      </div>
    )
  }

  const isOwnProfile = user?.id === userId

  return (
    <div className="developer-profile min-h-screen bg-background pb-12">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 text-white px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            className="text-white/80 hover:text-white mb-4"
            onClick={() => navigate('/apps')}
            aria-label="Retour"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Avatar */}
            <Avatar className="w-32 h-32 border-4 border-white/20">
              {developer.avatar ? (
                <AvatarImage src={developer.avatar} alt={developer.name} />
              ) : (
                <AvatarFallback className="text-4xl bg-purple-500/30">
                  {developer.name?.[0]?.toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>

            {/* Infos */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{developer.name}</h1>
                {developer.isVerified && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className="bg-blue-500/20 text-blue-400">
                          <Check className="w-3 h-3 mr-1" />
                          Vérifié
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Développeur vérifié</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {ratingBadge && (
                  <Badge className={`${ratingBadge.color} border-${ratingBadge.color}`}>
                    <ratingBadge.icon className="w-3 h-3 mr-1" />
                    {ratingBadge.label}
                  </Badge>
                )}
                {trendingBadge && (
                  <Badge className={`${trendingBadge.color} border-${trendingBadge.color}`}>
                    <trendingBadge.icon className="w-3 h-3 mr-1" />
                    {trendingBadge.label}
                  </Badge>
                )}
              </div>

              <p className="text-white/80 mb-4 max-w-2xl">{developer.bio}</p>

              <div className="flex flex-wrap gap-4 text-sm text-white/60 mb-6">
                {developer.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{developer.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Membre depuis {formatDate(developer.joinedAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{formatNumber(stats.totalApps)} applications</span>
                </div>
              </div>

              <div className="flex gap-3">
                {!isOwnProfile && (
                  <Button
                    onClick={handleFollow}
                    variant={isFollowing ? 'outline' : 'default'}
                    className={isFollowing ? 'border-white/30 text-white' : 'bg-purple-500 hover:bg-purple-600'}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${isFollowing ? 'fill-red-500 text-red-500' : ''}`} />
                    {isFollowing ? 'Abonné' : 'Suivre'}
                  </Button>
                )}
                {developer.website && (
                  <a href={developer.website} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                      <Globe className="w-4 h-4 mr-2" />
                      Site web
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne latérale - Stats */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-bold mb-3">Statistiques</h3>
              <div className="space-y-3">
                <StatCard 
                  icon={Download} 
                  label="Téléchargements totaux" 
                  value={stats.totalDownloads}
                  color="text-green-400"
                />
                <StatCard 
                  icon={Eye} 
                  label="Vues totales" 
                  value={stats.totalViews}
                  color="text-blue-400"
                />
                <StatCard 
                  icon={Star} 
                  label="Note moyenne" 
                  value={stats.averageRating.toFixed(1)}
                  color="text-yellow-400"
                />
                <StatCard 
                  icon={GitFork} 
                  label="Forks" 
                  value={stats.totalForks}
                  color="text-purple-400"
                />
              </div>

              {stats.score > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Score développeur</span>
                    <span className="text-sm font-bold text-purple-400">{stats.score}/100</span>
                  </div>
                  <Progress value={stats.score} max={100} className="h-2" />
                </div>
              )}
            </Card>

            {/* Réseaux sociaux */}
            {(developer.twitter || developer.github || developer.linkedin) && (
              <Card className="p-4">
                <h3 className="font-bold mb-3">Réseaux sociaux</h3>
                <div className="space-y-2">
                  {developer.github && (
                    <a 
                      href={`https://github.com/${developer.github}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Github className="w-5 h-5" />
                      <span className="text-sm">@{developer.github}</span>
                    </a>
                  )}
                  {developer.twitter && (
                    <a 
                      href={`https://twitter.com/${developer.twitter}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Twitter className="w-5 h-5" />
                      <span className="text-sm">@{developer.twitter}</span>
                    </a>
                  )}
                  {developer.linkedin && (
                    <a 
                      href={`https://linkedin.com/in/${developer.linkedin}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Linkedin className="w-5 h-5" />
                      <span className="text-sm">{developer.linkedin}</span>
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Applications */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                Applications ({totalApps})
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {stats.totalApps} applications publiées
                </span>
              </h2>
            </div>

            {apps.length === 0 ? (
              <Card className="p-12 text-center">
                <Code2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Aucune application</h3>
                <p className="text-muted-foreground mb-4">
                  {isOwnProfile 
                    ? "Vous n'avez pas encore publié d'application."
                    : "Ce développeur n'a pas encore publié d'application."}
                </p>
                {isOwnProfile && (
                  <Button onClick={() => navigate('/vibe/projects/create')}>
                    Créer une application
                  </Button>
                )}
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {apps.map(app => (
                    <AppCard key={app.id} app={app} />
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
          </div>
        </div>
      </div>
    </div>
  )
}

DeveloperProfile.propTypes = {};

export default DeveloperProfile
AppSkeleton.propTypes = {};
StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  Icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};
