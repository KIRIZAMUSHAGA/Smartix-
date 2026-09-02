/**
 * AppDetail - Page de détail d'une application
 * Version EXPERT avec cache cohérent, optimisations et accessibilité
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { 
  ArrowLeft, Download, Star, Eye, Clock, Users, 
  GitFork, Code2, Smartphone, Tablet, Monitor,
  Share2, Heart, Flag, MessageCircle, Check,
  AlertCircle, Loader2, ChevronRight, Calendar,
  ExternalLink, Copy, ThumbsUp, Award, TrendingUp,
  Filter, ChevronDown, X, RefreshCw
} from 'lucide-react'

// Hooks
import { useAuth } from '../hooks/useAuth'

// Services marketplace
import { getPublishService } from '../marketplace/publishService'
import { getForkService } from '../vibe-coding/marketplace/forkService'
import { getReviewService } from '../vibe-coding/marketplace/reviewService'
import { getTrendingService } from '../vibe-coding/marketplace/trendingService'

// Composants UI
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const VISIBILITY_LABELS = {
  public: { label: 'Public', color: 'green' },
  private: { label: 'Privé', color: 'red' },
  unlisted: { label: 'Non listé', color: 'yellow' }
}

const REVIEW_SORT_OPTIONS = [
  { value: 'recent', label: 'Les plus récents' },
  { value: 'helpful', label: 'Les plus utiles' },
  { value: 'rating', label: 'Les mieux notés' }
]

// =============================
// UTILITAIRES
// =============================

const parseList = (str) => str.split(',').map(s => s.trim()).filter(Boolean)

// =============================
// HOOK D'AUTH GARD
// =============================

const useRequireAuth = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback((action) => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: location.pathname } })
      return false
    }
    return true
  }, [isAuthenticated, navigate, location])
}

// =============================
// COMPOSANTS MEMOÏSÉS
// =============================

const Stars = React.memo(({ rating, interactive = false, onChange, size = 'md' }) => {
  const [hoverRating, setHoverRating] = useState(0)
  const starSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <div className="flex gap-0.5" role="group" aria-label={`Note: ${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
          disabled={!interactive}
          aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
        >
          <Star
            className={`${starSize} ${
              star <= (hoverRating || rating)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  )
})

Stars.displayName = 'Stars'

const ReviewCard = React.memo(({ review, onHelpful, isAuthenticated }) => {
  const [isHelpful, setIsHelpful] = useState(false)

  const handleHelpful = () => {
    if (!isAuthenticated) return
    setIsHelpful(true)
    onHelpful(review.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback>
              {review.userId?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {review.userName || `Utilisateur ${review.userId?.slice(-4)}`}
                </span>
                <Stars rating={review.rating} size="sm" />
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>
            
            {review.title && (
              <h4 className="font-medium mb-1">{review.title}</h4>
            )}
            
            <p className="text-sm text-muted-foreground mb-2">
              {review.comment}
            </p>
            
            {review.pros && review.pros.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-green-400">👍 {review.pros.join(', ')}</span>
              </div>
            )}
            
            {review.cons && review.cons.length > 0 && (
              <div className="mt-1">
                <span className="text-xs text-red-400">👎 {review.cons.join(', ')}</span>
              </div>
            )}
            
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleHelpful}
                disabled={isHelpful || !isAuthenticated}
                aria-label="Marquer comme utile"
              >
                <ThumbsUp className={`w-3 h-3 mr-1 ${isHelpful ? 'fill-current' : ''}`} />
                {review.helpful || 0} utile
              </Button>
              {review.verified && (
                <Badge variant="outline" className="text-green-400 border-green-400">
                  <Check className="w-3 h-3 mr-1" />
                  Installation vérifiée
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
})

ReviewCard.displayName = 'ReviewCard'

const ReviewSkeleton = () => (
  <div className="animate-pulse">
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-muted rounded-full" />
        <div className="flex-1">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
          <div className="h-4 w-full bg-muted rounded mb-2" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
      </div>
    </Card>
  </div>
)

// =============================
// HOOKS SPÉCIALISÉS
// =============================

const useAppDetail = (appId, { onError } = {}) => {
  const publishService = getPublishService()
  
  return useQuery({
    queryKey: ['app', appId],
    queryFn: async () => {
      try {
        const app = await publishService.getApp(appId)
        if (!app) throw new Error('Application non trouvée')
        return app
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    enabled: !!appId,
    staleTime: 2 * 60 * 1000,
  })
}

const useAppReviews = (appId, sortBy = 'recent', { onError } = {}) => {
  const reviewService = getReviewService()
  
  return useQuery({
    queryKey: ['app', appId, 'reviews', sortBy],
    queryFn: async () => {
      try {
        return await reviewService.getAppReviews(appId, { 
          limit: 50,
          sortBy
        })
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    enabled: !!appId,
    staleTime: 2 * 60 * 1000,
  })
}

const useSimilarApps = (appId, { onError } = {}) => {
  const trendingService = getTrendingService()
  
  return useQuery({
    queryKey: ['app', appId, 'similar'],
    queryFn: async () => {
      try {
        return await trendingService.getSimilarApps(appId, 5)
      } catch (error) {
        onError?.(error)
        throw error
      }
    },
    enabled: !!appId,
    staleTime: 10 * 60 * 1000,
  })
}

const useAddReview = ({ appId, onSuccess, onError } = {}) => {
  const reviewService = getReviewService()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ userId, review }) => {
      return reviewService.addReview(appId, userId, review)
    },
    onMutate: async (newReview) => {
      // Annuler les requêtes en cours
      await queryClient.cancelQueries({ 
        queryKey: ['app', appId, 'reviews'] 
      })

      // Sauvegarder l'état précédent
      const previous = queryClient.getQueriesData({ 
        queryKey: ['app', appId, 'reviews'] 
      })

      // ✅ Mettre à jour TOUS les sorts
      queryClient.setQueriesData(
        { queryKey: ['app', appId, 'reviews'] },
        (old) => {
          if (!old) return old
          
          const total = old.stats?.total || 0
          const avg = old.stats?.average || 0
          const newRating = newReview.review.rating
          
          // ✅ Calcul de la nouvelle moyenne
          const newAverage = ((avg * total) + newRating) / (total + 1)
          
          return {
            ...old,
            reviews: [{
              id: `temp-${Date.now()}`,
              ...newReview.review,
              userId: newReview.userId,
              createdAt: new Date().toISOString(),
              helpful: 0,
              verified: false
            }, ...(old.reviews || [])],
            stats: {
              ...old.stats,
              total: total + 1,
              average: newAverage,
              distribution: {
                ...old.stats?.distribution,
                [newRating]: (old.stats?.distribution?.[newRating] || 0) + 1
              }
            }
          }
        }
      )

      return { previous }
    },
    onError: (err, _, context) => {
      // Restaurer l'état précédent
      if (context?.previous) {
        context.previous.forEach(([key, data]) => {
          queryClient.setQueryData(key, data)
        })
      }
      onError?.(err)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', appId, 'reviews'] })
      onSuccess?.()
    },
  })
}

const useForkApp = ({ onSuccess, onError } = {}) => {
  const forkService = getForkService()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ userId, appId, options }) => {
      return forkService.forkApp(appId, userId, options)
    },
    onSuccess: (_, { appId }) => {
      queryClient.invalidateQueries({ queryKey: ['app', appId] })
      onSuccess?.()
    },
    onError: onError,
  })
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const AppDetail = () => {
  const { appId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()

  // États UI
  const [activeTab, setActiveTab] = useState('overview')
  const [showForkDialog, setShowForkDialog] = useState(false)
  const [forkOptions, setForkOptions] = useState({ name: '', publish: true, visibility: 'public' })
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '', pros: '', cons: '' })
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewSortBy, setReviewSortBy] = useState('recent')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Données
  const { 
    data: app, 
    isLoading: appLoading, 
    error: appError 
  } = useAppDetail(appId, {
    onError: () => toast.error("Erreur chargement de l'application")
  })

  const { 
    data: reviewsData, 
    isLoading: reviewsLoading 
  } = useAppReviews(appId, reviewSortBy, {
    onError: () => toast.error("Erreur chargement des avis")
  })

  const { 
    data: similarApps = [], 
    isLoading: similarLoading 
  } = useSimilarApps(appId, {
    onError: () => toast.error("Erreur chargement des apps similaires")
  })

  // Mutations
  const addReviewMutation = useAddReview({
    appId,
    onSuccess: () => {
      toast.success("Avis publié !")
      setShowReviewForm(false)
      setReviewForm({ rating: 5, title: '', comment: '', pros: '', cons: '' })
    },
    onError: () => toast.error("Erreur lors de la publication")
  })

  const forkAppMutation = useForkApp({
    onSuccess: () => {
      toast.success("Fork créé avec succès !")
      setShowForkDialog(false)
    },
    onError: () => toast.error("Erreur lors du fork")
  })

  // Vérifier si l'utilisateur a déjà forké (basé sur localStorage + backend)
  const hasForked = useMemo(() => {
    const localFork = localStorage.getItem(`forked_${appId}`)
    if (localFork) return true
    return app?.hasForked || false
  }, [appId, app])

  // Statistiques dérivées
  const stats = useMemo(() => ({
    downloads: app?.stats?.downloads || 0,
    installs: app?.stats?.installs || 0,
    views: app?.stats?.views || 0,
    forks: app?.stats?.forks || 0,
    rating: app?.stats?.rating || 0,
    reviewsCount: app?.stats?.reviewsCount || 0
  }), [app])

  const reviews = reviewsData?.reviews || []
  const averageRating = reviewsData?.stats?.average || 0
  const ratingDistribution = reviewsData?.stats?.distribution || {}
  const reviewsTotal = reviewsData?.stats?.total || 0

  // ✅ Utiliser les données des avis pour les stats
  const distributionPercent = useMemo(() => {
    const total = reviewsTotal || 1
    return {
      5: ((ratingDistribution[5] || 0) / total) * 100,
      4: ((ratingDistribution[4] || 0) / total) * 100,
      3: ((ratingDistribution[3] || 0) / total) * 100,
      2: ((ratingDistribution[2] || 0) / total) * 100,
      1: ((ratingDistribution[1] || 0) / total) * 100
    }
  }, [ratingDistribution, reviewsTotal])

  // Prefetch des apps similaires
  useEffect(() => {
    if (similarApps.length > 0) {
      similarApps.forEach(similar => {
        queryClient.prefetchQuery({
          queryKey: ['app', similar.id],
          queryFn: () => getPublishService().getApp(similar.id),
          staleTime: 10 * 60 * 1000,
        })
      })
    }
  }, [similarApps, queryClient])

  // Gestionnaires
  const handleDownload = () => {
    if (!requireAuth()) return

    if (!app?.apkUrl) {
      toast.error("Fichier indisponible")
      return
    }

    // ✅ Meilleure UX mobile
    window.location.href = app.apkUrl
    toast.success("Téléchargement démarré")
  }

  const handleFork = () => {
    if (!requireAuth()) return
    setShowForkDialog(true)
  }

  const handleSubmitFork = () => {
    forkAppMutation.mutate({
      userId: user.id,
      appId,
      options: {
        newName: forkOptions.name,
        publish: forkOptions.publish,
        visibility: forkOptions.visibility
      }
    }, {
      onSuccess: () => {
        localStorage.setItem(`forked_${appId}`, 'true')
      }
    })
  }

  const handleSubmitReview = async () => {
    if (!requireAuth()) return

    if (!reviewForm.comment.trim()) {
      toast.error("Le commentaire est requis")
      return
    }

    const review = {
      rating: reviewForm.rating,
      title: reviewForm.title,
      comment: reviewForm.comment,
      pros: parseList(reviewForm.pros),
      cons: parseList(reviewForm.cons)
    }

    addReviewMutation.mutate({
      userId: user.id,
      review
    })
  }

  const handleHelpful = (reviewId) => {
    toast.success("Merci pour votre vote !")
    // TODO: Appel API
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Lien copié !")
    } catch {
      toast.error("Impossible de copier le lien")
    }
  }

  // États de chargement
  if (appLoading) {
    return (
      <div className="min-h-screen bg-background pb-12">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 rounded-lg mb-4" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
            <div>
              <Skeleton className="h-96 rounded-lg mb-4" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (appError || !app) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Application non trouvée</h2>
          <p className="text-muted-foreground mb-4">
            Cette application n'existe pas ou a été supprimée
          </p>
          <Button onClick={() => navigate('/apps')} aria-label="Retour au marketplace">
            Retour au marketplace
          </Button>
        </Card>
      </div>
    )
  }

  const visibilityInfo = VISIBILITY_LABELS[app.visibility] || VISIBILITY_LABELS.public

  return (
    <div className="app-detail min-h-screen bg-background pb-12">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 text-white px-4 py-8">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Icône */}
            <div className="lg:col-span-1">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative aspect-square max-w-[200px] rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-white/20"
              >
                <span className="absolute inset-0 flex items-center justify-center text-6xl">
                  <Smartphone className="w-24 h-24" />
                </span>
              </motion.div>
            </div>

                  {/* Infos principales */}
            <div className="lg:col-span-2">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{app.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      <span className="font-bold">{averageRating.toFixed(1)}</span>
                      <span className="text-white/60">({reviewsTotal} avis)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      <span>{stats.downloads.toLocaleString()} téléchargements</span>
                    </div>
                    <Badge className={`bg-${visibilityInfo.color}-500/20 text-${visibilityInfo.color}-400`}>
                      {visibilityInfo.label}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white" aria-label="Partager">
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopyLink}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copier le lien
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share2 className="w-4 h-4 mr-2" />
                        Partager sur Twitter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleDownload}
                    className="bg-purple-500 hover:bg-purple-600"
                    aria-label="Télécharger l'application"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                </div>
              </div>

              <p className="text-white/80 mb-6">{app.description}</p>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/30 text-white">
                  {app.category}
                </Badge>
                {app.tags?.map(tag => (
                  <Badge key={tag} variant="outline" className="border-white/30 text-white/80">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-6xl mx-auto px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="overview">Aperçu</TabsTrigger>
                <TabsTrigger value="reviews">Avis ({reviewsTotal})</TabsTrigger>
                <TabsTrigger value="technical">Infos techniques</TabsTrigger>
              </TabsList>

              {/* Onglet Aperçu */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card className="p-6">
                  <h3 className="font-bold mb-4">À propos de l'application</h3>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {app.description}
                  </p>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-4">Captures d'écran</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                      <motion.div 
                        key={i} 
                        whileHover={{ scale: 1.05 }}
                        className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center cursor-pointer"
                      >
                        <Smartphone className="w-12 h-12 text-muted-foreground" />
                      </motion.div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-4">Fonctionnalités</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {app.features?.map((feature, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-2"
                      >
                        <Check className="w-4 h-4 text-green-400" />
                        <span>{feature}</span>
                      </motion.div>
                    ))}
                    {!app.features && (
                      <p className="text-muted-foreground">Aucune fonctionnalité listée</p>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* Onglet Avis */}
              <TabsContent value="reviews" className="space-y-4 mt-4">
                {/* Statistiques des avis */}
                <Card className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-5xl font-bold mb-2">
                        {averageRating.toFixed(1)}
                      </div>
                      <div className="flex justify-center mb-2">
                        <Stars rating={Math.round(averageRating)} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {reviewsTotal} avis
                      </p>
                    </div>

                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((stars) => (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="text-sm w-8">{stars}★</span>
                          <Progress
                            value={distributionPercent[stars]}
                            className="h-2"
                            aria-label={`${stars} étoiles : ${ratingDistribution[stars] || 0} avis`}
                          />
                          <span className="text-sm text-muted-foreground w-12">
                            {ratingDistribution[stars] || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tri des avis */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <span className="text-sm text-muted-foreground">Trier par</span>
                    <Select value={reviewSortBy} onValueChange={setReviewSortBy}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Trier par" />
                      </SelectTrigger>
                      <SelectContent>
                        {REVIEW_SORT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Card>

                {/* Formulaire d'avis */}
                {isAuthenticated && !showReviewForm && (
                  <Card className="p-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowReviewForm(true)}
                      aria-label="Donner mon avis"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Donner mon avis
                    </Button>
                  </Card>
                )}

                <AnimatePresence>
                  {showReviewForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="p-4">
                        <h4 className="font-bold mb-4">Donner mon avis</h4>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="rating" className="text-sm text-muted-foreground mb-2 block">
                              Note
                            </label>
                            <Stars
                              rating={reviewForm.rating}
                              interactive
                              onChange={(rating) => setReviewForm(prev => ({ ...prev, rating }))}
                            />
                          </div>
                          <div>
                            <label htmlFor="title" className="text-sm text-muted-foreground mb-2 block">
                              Titre (optionnel)
                            </label>
                            <Input
                              id="title"
                              type="text"
                              value={reviewForm.title}
                              onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Résumé de votre avis"
                            />
                          </div>
                          <div>
                            <label htmlFor="comment" className="text-sm text-muted-foreground mb-2 block">
                              Commentaire *
                            </label>
                            <Textarea
                              id="comment"
                              value={reviewForm.comment}
                              onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                              rows={4}
                              placeholder="Partagez votre expérience..."
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="pros" className="text-sm text-muted-foreground mb-2 block">
                                Points positifs (séparés par des virgules)
                              </label>
                              <Input
                                id="pros"
                                type="text"
                                value={reviewForm.pros}
                                onChange={(e) => setReviewForm(prev => ({ ...prev, pros: e.target.value }))}
                                placeholder="rapide, intuitif, etc."
                              />
                            </div>
                            <div>
                              <label htmlFor="cons" className="text-sm text-muted-foreground mb-2 block">
                                Points négatifs (séparés par des virgules)
                              </label>
                              <Input
                                id="cons"
                                type="text"
                                value={reviewForm.cons}
                                onChange={(e) => setReviewForm(prev => ({ ...prev, cons: e.target.value }))}
                                placeholder="lent, bug, etc."
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSubmitReview}
                              disabled={addReviewMutation.isLoading}
                              aria-label="Publier mon avis"
                            >
                              {addReviewMutation.isLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Publication...
                                </>
                              ) : (
                                'Publier'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowReviewForm(false)}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Liste des avis */}
                {reviewsLoading ? (
                  [...Array(3)].map((_, i) => <ReviewSkeleton key={i} />)
                ) : reviews.length === 0 ? (
                  <Card className="p-12 text-center">
                    <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-bold mb-2">Aucun avis pour le moment</h3>
                    <p className="text-sm text-muted-foreground">
                      Soyez le premier à donner votre avis !
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {reviews.map(review => (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          onHelpful={handleHelpful}
                          isAuthenticated={isAuthenticated}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>

              {/* Onglet Infos techniques */}
              <TabsContent value="technical" className="space-y-4 mt-4">
                <Card className="p-6">
                  <h3 className="font-bold mb-4">Informations techniques</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="font-medium">{app.version || '1.0.0'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Taille</p>
                      <p className="font-medium">{app.size ? `${(app.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Catégorie</p>
                      <p className="font-medium">{app.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dernière mise à jour</p>
                      <p className="font-medium">
                        {new Date(app.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Créée le</p>
                      <p className="font-medium">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Compatibilité</p>
                      <p className="font-medium">Android 5.0+</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Colonne latérale */}
          <div className="space-y-4">
            {/* Développeur */}
            <Card className="p-4">
              <h3 className="font-bold mb-3">Développeur</h3>
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback>
                    {app.developerName?.[0]?.toUpperCase() || 'D'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{app.developerName || 'Développeur'}</p>
                  <Link to={`/developer/${app.userId}`} className="text-sm text-purple-400 hover:text-purple-300">
                    Voir tous les projets
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-400" />
                <span>Développeur vérifié</span>
              </div>
            </Card>

            {/* Actions */}
            <Card className="p-4">
              <h3 className="font-bold mb-3">Actions</h3>
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleDownload}
                  aria-label="Télécharger l'APK"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger l'APK
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleFork}
                  aria-label="Fork ce projet"
                  disabled={hasForked}
                >
                  <GitFork className="w-4 h-4 mr-2" />
                  {hasForked ? 'Déjà forké' : 'Fork ce projet'}
                </Button>
              </div>
            </Card>

            {/* Applications similaires */}
            {!similarLoading && similarApps.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold mb-3">Applications similaires</h3>
                <div className="space-y-3">
                  {similarApps.map(similar => (
                    <motion.div
                      key={similar.id}
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link
                        to={`/apps/${similar.id}`}
                        className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{similar.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span>{similar.stats?.rating?.toFixed(1) || 0}</span>
                            <Download className="w-3 h-3 ml-1" />
                            <span>{similar.stats?.downloads || 0}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de fork */}
      <Dialog open={showForkDialog} onOpenChange={setShowForkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork de l'application</DialogTitle>
            <DialogDescription>
              Créez votre propre version de {app.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="fork-name" className="text-sm font-medium mb-2 block">
                Nom du projet
              </label>
              <Input
                id="fork-name"
                type="text"
                value={forkOptions.name}
                onChange={(e) => setForkOptions(prev => ({ ...prev, name: e.target.value }))}
                placeholder={`${app.name} (fork)`}
              />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={forkOptions.publish}
                  onChange={(e) => setForkOptions(prev => ({ ...prev, publish: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Publier automatiquement</span>
              </label>
            </div>
            <div>
              <label htmlFor="fork-visibility" className="text-sm font-medium mb-2 block">
                Visibilité
              </label>
              <select
                id="fork-visibility"
                value={forkOptions.visibility}
                onChange={(e) => setForkOptions(prev => ({ ...prev, visibility: e.target.value }))}
                className="w-full p-2 bg-background border border-border rounded-md"
              >
                <option value="public">Public</option>
                <option value="unlisted">Non listé</option>
                <option value="private">Privé</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForkDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmitFork} disabled={forkAppMutation.isLoading}>
              {forkAppMutation.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fork en cours...
                </>
              ) : (
                <>
                  <GitFork className="w-4 h-4 mr-2" />
                  Forker
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

AppDetail.propTypes = {};

export default AppDetail
ReviewSkeleton.propTypes = {};
