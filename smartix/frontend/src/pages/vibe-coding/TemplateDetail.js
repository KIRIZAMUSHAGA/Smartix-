/**
 * TemplateDetail - Page de détail d'un template
 * Version PRO avec architecture scalable et accessibilité
 */

import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  Rocket, Star, ArrowLeft, Download, Eye,
  Clock, Users, Code2, Smartphone, Globe,
  Shield, Zap, Award, TrendingUp, Check,
  MessageCircle, Heart, Share2, Flag,
  ChevronRight, Play, Pause, Maximize2,
  Loader2, AlertCircle
} from 'lucide-react'

// Hooks d'authentification
import { useAuth } from '../../hooks/useAuth'

// Services
import { templateService } from '../../vibe-coding/services/templateService'
import PropTypes from 'prop-types';

// Feature flags (configurable via .env)
const MARKETPLACE_ENABLED = process.env.REACT_APP_MARKETPLACE_ENABLED === 'true'

// Composants UI
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Progress } from '../../components/ui/progress'
import { Skeleton } from '../../components/ui/skeleton'
import {

  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'

// =============================
// CONSTANTES
// =============================

const COMPLEXITY_CONFIG = {
  simple: { label: 'Simple', color: 'green' },
  medium: { label: 'Intermédiaire', color: 'yellow' },
  hard: { label: 'Avancé', color: 'red' }
}

// ✅ Classes Tailwind statiques (évite le dynamic className)
const COMPLEXITY_CLASSES = {
  simple: 'border-green-400 text-green-400',
  medium: 'border-yellow-400 text-yellow-400',
  hard: 'border-red-400 text-red-400'
}

const LICENSE_TYPES = {
  personal: { 
    label: 'Personnelle', 
    price: 0, 
    features: ['Usage personnel uniquement'] 
  },
  commercial: { 
    label: 'Commerciale', 
    price: 49, 
    features: ['Usage commercial', '1 projet'] 
  },
  extended: { 
    label: 'Étendue', 
    price: 199, 
    features: ['Usage commercial illimité', 'Support prioritaire'] 
  },
  enterprise: { 
    label: 'Enterprise', 
    price: 499, 
    features: ['Licence multi-projets', 'Support dédié', 'Formation'] 
  }
}

// =============================
// HOOKS SPÉCIALISÉS
// =============================

// ✅ Hook séparé pour le template
const useTemplateQuery = (templateId) => {
  return useQuery({
    queryKey: ['template', templateId],
    queryFn: () => templateService.getTemplate(templateId),
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000,
  })
}

// ✅ Hook séparé pour les templates similaires
const useSimilarTemplates = (templateId) => {
  return useQuery({
    queryKey: ['templates', 'similar', templateId],
    queryFn: () => templateService.getSimilarTemplates(templateId, 4),
    enabled: !!templateId,
    staleTime: 10 * 60 * 1000,
  })
}

// ✅ Hook séparé pour les avis
const useReviews = (templateId, page = 1) => {
  return useQuery({
    queryKey: ['template', templateId, 'reviews', page],
    queryFn: () => templateService.getTemplateReviews(templateId, { 
      limit: 10, 
      page 
    }),
    enabled: !!templateId,
    staleTime: 2 * 60 * 1000,
    keepPreviousData: true,
  })
}

// ✅ Hook pour l'achat
const usePurchase = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, templateId, license }) => {
      if (!MARKETPLACE_ENABLED) {
        throw new Error('Marketplace non activé')
      }
      return templateService.purchaseTemplate(userId, templateId, license)
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ['template', templateId] })
      toast.success('Achat réussi !')
    },
    onError: (error) => {
      toast.error('Erreur lors de l\'achat', {
        description: error.message
      })
    }
  })
}

// ✅ Hook pour les avis
const useReviewMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, templateId, review }) => {
      return templateService.addReview(userId, templateId, review)
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ 
        queryKey: ['template', templateId, 'reviews'] 
      })
      toast.success('Avis publié !')
    },
    onError: (error) => {
      toast.error('Erreur lors de la publication', {
        description: error.message
      })
    }
  })
}

// =============================
// COMPOSANTS
// =============================

const Stars = ({ rating, interactive = false, onChange, 'aria-label': ariaLabel }) => {
  const [hoverRating, setHoverRating] = useState(0)

  return (
    <div 
      className="flex gap-0.5"
      role={interactive ? 'slider' : 'img'}
      aria-label={ariaLabel || `Note: ${rating} sur 5 étoiles`}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={rating}
    >
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
            className={`w-4 h-4 ${
              star <= (hoverRating || rating)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const TemplateDetail = () => {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // États UI
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedLicense, setSelectedLicense] = useState('personal')
  const [showDemo, setShowDemo] = useState(false)
  const [reviewsPage, setReviewsPage] = useState(1)
  const [userReview, setUserReview] = useState({ rating: 5, comment: '' })
  const [showReviewForm, setShowReviewForm] = useState(false)

  // Hooks spécialisés
  const { 
    data: template, 
    isLoading: templateLoading, 
    error: templateError 
  } = useTemplateQuery(templateId)

  const { 
    data: similarTemplates = [], 
    isLoading: similarLoading 
  } = useSimilarTemplates(templateId)

  const { 
    data: reviewsData, 
    isLoading: reviewsLoading,
    hasNextPage,
    fetchNextPage
  } = useReviews(templateId, reviewsPage)

  const purchaseMutation = usePurchase()
  const reviewMutation = useReviewMutation()

  // ✅ Déduire de l'état d'achat depuis le template
  const hasPurchased = template?.isPurchased || false

  // =============================
  // GESTIONNAIRES
  // =============================

  const handleUseTemplate = () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/vibe/templates/${templateId}` } })
      return
    }

    if (hasPurchased || template?.price === 0) {
      // Gratuit ou déjà acheté → utiliser
      navigate(`/vibe/projects/create?template=${templateId}`)
    } else {
      // Payant → aller vers les tarifs
      setActiveTab('pricing')
    }
  }

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: `/vibe/templates/${templateId}` } })
      return
    }

    if (!MARKETPLACE_ENABLED) {
      toast.error('Marketplace temporairement indisponible')
      return
    }

    purchaseMutation.mutate({
      userId: user.id,
      templateId,
      license: selectedLicense
    })
  }

  const handleSubmitReview = async () => {
    if (!isAuthenticated) {
      navigate('/auth')
      return
    }

    reviewMutation.mutate({
      userId: user.id,
      templateId,
      review: userReview
    }, {
      onSuccess: () => {
        setShowReviewForm(false)
        setUserReview({ rating: 5, comment: '' })
      }
    })
  }

  const handleHelpful = async (reviewId) => {
    if (!isAuthenticated) return
    try {
      await templateService.markHelpful(reviewId, user.id)
      toast.success('Merci !')
    } catch (err) {
      toast.error('Erreur')
    }
  }

  // =============================
  // ÉTATS DE CHARGEMENT
  // =============================
  if (templateLoading) {
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

  if (templateError || !template) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Template non trouvé</h2>
          <p className="text-muted-foreground mb-4">
            {templateError?.message || 'Ce template n\'existe pas'}
          </p>
          <Button 
            onClick={() => navigate('/vibe/templates')}
            aria-label="Retour à la liste des templates"
          >
            Retour aux templates
          </Button>
        </Card>
      </div>
    )
  }

  const complexityClass = COMPLEXITY_CLASSES[template.complexity] || 'border-gray-400 text-gray-400'

  // =============================
  // RENDU PRINCIPAL
  // =============================
  return (
    <div className="template-detail min-h-screen bg-background pb-12">
      {/* En-tête avec image */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 text-white px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            className="text-white/80 hover:text-white mb-4"
            onClick={() => navigate(-1)}
            aria-label="Retour à la page précédente"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Image du template */}
            <div className="lg:col-span-1">
              <div 
                className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-white/20"
                role="img"
                aria-label={`Aperçu du template ${template.name}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-6xl">
                  {template.icon || '📦'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setShowDemo(true)}
                  aria-label="Voir la démo"
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Infos principales */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{template.name}</h1>
                {template.featured && (
                  <Badge className="bg-yellow-500/20 text-yellow-400">
                    <Award className="w-3 h-3 mr-1" />
                    Vedette
                  </Badge>
                )}
              </div>

              <p className="text-white/80 mb-4">{template.description}</p>

              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold">{reviewsData?.average || 0}</span>
                  <span className="text-white/60">({reviewsData?.total || 0} avis)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  <span>{template.usageCount || 0} utilisations</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Mis à jour {new Date(template.updatedAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="outline" className="border-white/30 text-white">
                  {template.category}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={complexityClass}
                >
                  {COMPLEXITY_CONFIG[template.complexity]?.label || template.complexity}
                </Badge>
                {(template.tags || []).map(tag => (
                  <Badge key={tag} variant="outline" className="border-white/30 text-white/80">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  size="lg"
                  className={hasPurchased ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'}
                  onClick={handleUseTemplate}
                  aria-label={hasPurchased ? 'Utiliser le template' : 'Commencer avec ce template'}
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  {hasPurchased 
                    ? 'Utiliser le template' 
                    : template.price === 0 
                      ? 'Commencer gratuitement' 
                      : `À partir de ${template.price} €`
                  }
                </Button>
                {MARKETPLACE_ENABLED && template.price > 0 && !hasPurchased && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10"
                    onClick={() => setActiveTab('pricing')}
                    aria-label="Voir les options d'achat"
                  >
                    <Rocket className="w-4 h-4 mr-2" />
                    Voir les options
                  </Button>
                )}
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
                <TabsTrigger value="features">Fonctionnalités</TabsTrigger>
                <TabsTrigger value="reviews">Avis</TabsTrigger>
                {MARKETPLACE_ENABLED && (
                  <TabsTrigger value="pricing">Tarifs</TabsTrigger>
                )}
              </TabsList>

              {/* Onglet Aperçu */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card className="p-6">
                  <h3 className="font-bold mb-4">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {template.description}
                  </p>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-4">Capture d'écran</h3>
                  <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-6xl">{template.icon || '📱'}</span>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-4">Technologies utilisées</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-sm py-1">
                      {template.framework || 'React'}
                    </Badge>
                    {template.dependencies && Object.keys(template.dependencies).map(dep => (
                      <Badge key={dep} variant="outline" className="text-sm py-1">
                        {dep}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Onglet Fonctionnalités */}
              <TabsContent value="features" className="space-y-4 mt-4">
                <Card className="p-6">
                  <h3 className="font-bold mb-4">Fonctionnalités incluses</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(template.features || []).map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-4">Structure du projet</h3>
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto max-h-96">
                    {template.structure || `
src/
  components/
  pages/
  utils/
  styles/
  App.js
  index.js
package.json
README.md
                    `}
                  </pre>
                </Card>
              </TabsContent>

              {/* Onglet Avis */}
              <TabsContent value="reviews" className="space-y-4 mt-4">
                {/* Résumé des avis */}
                <Card className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-5xl font-bold mb-2">
                        {reviewsData?.average || 0}
                      </div>
                      <div className="flex justify-center mb-2">
                        <Stars 
                          rating={Math.round(reviewsData?.average || 0)} 
                          aria-label={`Note moyenne : ${reviewsData?.average || 0} sur 5`}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {reviewsData?.total || 0} avis
                      </p>
                    </div>

                     {/* Distribution */}
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((stars) => (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="text-sm w-8">{stars}★</span>
                          <Progress
                            value={((reviewsData?.distribution?.[stars] || 0) / (reviewsData?.total || 1)) * 100}
                            className="h-2"
                            aria-label={`${stars} étoiles : ${reviewsData?.distribution?.[stars] || 0} avis`}
                          />
                          <span className="text-sm text-muted-foreground w-12">
                            {reviewsData?.distribution?.[stars] || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Liste des avis */}
                <div className="space-y-4">
                  {(reviewsData?.reviews || []).map((review) => (
                    <Card key={review.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {review.userId?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium">Utilisateur {review.userId?.slice(-4)}</p>
                              <div className="flex items-center gap-2">
                                <Stars rating={review.rating} />
                                <span className="text-xs text-muted-foreground">
                                  {new Date(review.createdAt || Date.now()).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            {review.verified && (
                              <Badge variant="outline" className="text-green-400 border-green-400">
                                Achat vérifié
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {review.comment}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleHelpful(review.id)}
                              aria-label={`Marquer cet avis comme utile (${review.helpful || 0})`}
                            >
                              <Heart className="w-3 h-3 mr-1" />
                              {review.helpful || 0} utile
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {/* Pagination des avis */}
                  {hasNextPage && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setReviewsPage(p => p + 1)
                          fetchNextPage()
                        }}
                        disabled={reviewsLoading}
                      >
                        {reviewsLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Voir plus d\'avis'
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Formulaire d'avis */}
                {isAuthenticated && (
                  <Card className="p-4">
                    {showReviewForm ? (
                      <div className="space-y-4">
                        <h4 className="font-bold">Donner mon avis</h4>
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">
                            Note
                          </label>
                          <Stars
                            rating={userReview.rating}
                            interactive
                            onChange={(rating) => setUserReview(prev => ({ ...prev, rating }))}
                            aria-label="Sélectionnez une note"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground mb-2 block">
                            Commentaire
                          </label>
                          <textarea
                            value={userReview.comment}
                            onChange={(e) => setUserReview(prev => ({ ...prev, comment: e.target.value }))}
                            rows={4}
                            className="w-full p-2 bg-background border border-border rounded-md"
                            placeholder="Partagez votre expérience..."
                            aria-label="Votre commentaire"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleSubmitReview}
                            disabled={reviewMutation.isLoading}
                          >
                            {reviewMutation.isLoading ? (
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
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowReviewForm(true)}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Donner mon avis
                      </Button>
                    )}
                  </Card>
                )}
              </TabsContent>

              {/* Onglet Tarifs */}
              {MARKETPLACE_ENABLED && (
                <TabsContent value="pricing" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(LICENSE_TYPES).map(([key, license]) => (
                      <Card
                        key={key}
                        className={`p-4 cursor-pointer transition-all ${
                          selectedLicense === key
                            ? 'ring-2 ring-purple-500 bg-purple-500/10'
                            : 'hover:ring-2 hover:ring-purple-500/50'
                        }`}
                        onClick={() => setSelectedLicense(key)}
                        role="radio"
                        aria-checked={selectedLicense === key}
                        tabIndex={0}
                        onKeyPress={(e) => e.key === 'Enter' && setSelectedLicense(key)}
                      >
                        <h3 className="font-bold mb-2">{license.label}</h3>
                        <p className="text-2xl font-bold mb-3">
                          {license.price === 0 ? 'Gratuit' : `${license.price} €`}
                        </p>
                        <ul className="space-y-2">
                          {license.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </div>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">Total</p>
                        <p className="text-2xl font-bold text-purple-400">
                          {LICENSE_TYPES[selectedLicense].price === 0
                            ? 'Gratuit'
                            : `${LICENSE_TYPES[selectedLicense].price} €`}
                        </p>
                      </div>
                      <Button
                        size="lg"
                        onClick={handlePurchase}
                        disabled={purchaseMutation.isLoading}
                      >
                        {purchaseMutation.isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Traitement...
                          </>
                        ) : (
                          <>
                            <Rocket className="w-4 h-4 mr-2" />
                            {LICENSE_TYPES[selectedLicense].price === 0
                              ? 'Obtenir gratuitement'
                              : 'Acheter maintenant'}
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Colonne latérale */}
          <div className="space-y-4">
            {/* Informations du vendeur */}
            <Card className="p-4">
              <h3 className="font-bold mb-3">Vendeur</h3>
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback>
                    {template.author?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{template.author || 'VibeCoding'}</p>
                  <p className="text-sm text-muted-foreground">
                    Membre depuis {new Date(template.createdAt || Date.now()).getFullYear()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-400" />
                <span>Vendeur vérifié</span>
              </div>
            </Card>

            {/* Statistiques */}
            <Card className="p-4">
              <h3 className="font-bold mb-3">Statistiques</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Utilisations</span>
                  <span className="font-medium">{template.usageCount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">{template.version || '1.0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dernière mise à jour</span>
                  <span className="font-medium">
                    {new Date(template.updatedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Framework</span>
                  <span className="font-medium">{template.framework || 'React'}</span>
                </div>
              </div>
            </Card>

            {/* Templates similaires */}
            {!similarLoading && similarTemplates.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold mb-3">Templates similaires</h3>
                <div className="space-y-3">
                  {similarTemplates.map(similar => (
                    <Link
                      key={similar.id}
                      to={`/vibe/templates/${similar.id}`}
                      className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
                      aria-label={`Voir le template ${similar.name}`}
                    >
                      <span className="text-2xl">{similar.icon || '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{similar.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {similar.description}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de démo */}
      <Dialog open={showDemo} onOpenChange={setShowDemo}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Aperçu de {template.name}</DialogTitle>
            <DialogDescription>
              Version de démonstration du template
            </DialogDescription>
          </DialogHeader>

          <div className="aspect-video bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <span className="text-6xl mb-4 block">{template.icon || '📱'}</span>
              <p className="text-muted-foreground">
                Démo interactive disponible dans la version payante
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

TemplateDetail.propTypes = {};

export default TemplateDetail
Stars.propTypes = {
  rating: PropTypes.number.isRequired,
  interactive: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  aria: PropTypes.any.isRequired,
  label: PropTypes.string.isRequired,
  ariaLabel: PropTypes.any.isRequired,
};
