/**
 * VibeDashboard - Page d'accueil du module Vibe-coding
 * Version PRO avec optimisations React, cache et UX améliorée
 * ✅ Ajout de la section Marketplace Applications
 */

import React, { useState, useEffect, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Code2, FolderGit2, Rocket, TrendingUp, 
  Clock, Users, Star, ArrowRight, Plus,
  Activity, Zap, Award, Grid, Layout,
  CheckCircle, XCircle, AlertCircle, Smartphone,
  Download, Eye, Sparkles
} from 'lucide-react'

// Hooks existants
import { useAuth } from '../../hooks/useAuth'

// Services Vibe-coding
import { projectService } from '../../vibe-coding/services/projectService'
import { templateService } from '../../vibe-coding/services/templateService'
import { publisher } from '../../vibe-coding/publishing/publisher'
import { activityService } from '../../vibe-coding/services/activityService'

// ✅ NOUVEAU : Service marketplace applications
import { getPublishService } from '../../marketplace/publishService'

// Composants UI
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Progress } from '../../components/ui/progress'
import { Badge } from '../../components/ui/badge'
import PropTypes from 'prop-types';

// =============================
// QUERIES REACT QUERY
// =============================

const useDashboardQueries = (userId) => {
  // Projets récents
  const projectsQuery = useQuery({
    queryKey: ['projects', 'recent', userId],
    queryFn: () => projectService.listUserProjects(userId, { 
      limit: 4, 
      sortBy: 'updatedAt', 
      sortOrder: 'desc' 
    }),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  // Templates populaires
  const templatesQuery = useQuery({
    queryKey: ['templates', 'popular'],
    queryFn: () => templateService.getPopularTemplates(4),
    staleTime: 10 * 60 * 1000,
  })

  // Stats utilisateur
  const userStatsQuery = useQuery({
    queryKey: ['user', 'stats', userId],
    queryFn: () => projectService.getUserStats(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })

  // Stats templates
  const templateStatsQuery = useQuery({
    queryKey: ['templates', 'stats'],
    queryFn: () => templateService.getStats(),
    staleTime: 10 * 60 * 1000,
  })

  // Stats publications
  const publisherStatsQuery = useQuery({
    queryKey: ['publisher', 'stats', userId],
    queryFn: () => publisher.getStats(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  // Activité récente
  const activityQuery = useQuery({
    queryKey: ['activity', 'recent', userId],
    queryFn: () => activityService.getRecentActivity(userId, 5),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })

  // ✅ NOUVEAU : Applications populaires du marketplace
  const popularAppsQuery = useQuery({
    queryKey: ['marketplace', 'popular', 'apps'],
    queryFn: async () => {
      const publishService = getPublishService()
      const result = await publishService.listApps({
        sortBy: 'downloads',
        sortOrder: 'desc',
        visibility: 'public',
        limit: 4
      })
      return result.items || []
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    projects: projectsQuery.data?.projects || [],
    templates: templatesQuery.data || [],
    userStats: userStatsQuery.data || {},
    templateStats: templateStatsQuery.data || {},
    publisherStats: publisherStatsQuery.data || {},
    activities: activityQuery.data || [],
    popularApps: popularAppsQuery.data || [],
    isLoading: projectsQuery.isLoading || templatesQuery.isLoading,
    isError: projectsQuery.isError || templatesQuery.isError,
    refetch: () => {
      projectsQuery.refetch()
      templatesQuery.refetch()
      userStatsQuery.refetch()
      activityQuery.refetch()
      popularAppsQuery.refetch()
    }
  }
}

// =============================
// COMPOSANTS MEMOÏSÉS (inchangés)
// =============================

const StatCard = memo(({ icon, label, value, color }) => {
  const colors = {
    purple: 'from-purple-500/20 to-purple-600/20 text-purple-400',
    pink: 'from-pink-500/20 to-pink-600/20 text-pink-400',
    yellow: 'from-yellow-500/20 to-yellow-600/20 text-yellow-400',
    blue: 'from-blue-500/20 to-blue-600/20 text-blue-400',
    green: 'from-green-500/20 to-green-600/20 text-green-400'
  }

  return (
    <Card className={`p-4 bg-gradient-to-br ${colors[color]} backdrop-blur-sm border-0`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-background/30">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs opacity-80">{label}</p>
        </div>
      </div>
    </Card>
  )
})

const ProjectCard = memo(({ project, formatDate }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'built': return <CheckCircle className="w-3 h-3 text-green-400" />
      case 'building': return <Activity className="w-3 h-3 text-yellow-400 animate-spin" />
      case 'error': return <XCircle className="w-3 h-3 text-red-400" />
      default: return <Clock className="w-3 h-3 text-muted-foreground" />
    }
  }

  return (
    <Link to={`/vibe/projects/${project.id}`} className="block group">
      <Card className="p-4 hover:shadow-lg transition-all hover:scale-[1.02] bg-card/50 backdrop-blur-sm border border-border/50">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Code2 className="w-5 h-5 text-purple-400" />
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-muted">
            {project.type || 'react'}
          </span>
        </div>
        
        <h3 className="font-bold mb-1 line-clamp-1">{project.name}</h3>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {project.description || 'Aucune description'}
        </p>

        {project.progress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Build</span>
              <span className="font-bold text-purple-400">{project.progress}%</span>
            </div>
            <Progress value={project.progress} max={100} className="h-1" />
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {getStatusIcon(project.status)}
            <span className="capitalize text-muted-foreground">{project.status || 'draft'}</span>
          </div>
          <span className="text-muted-foreground">
            {formatDate(project.updatedAt)}
          </span>
        </div>
      </Card>
    </Link>
  )
})

const TemplateCard = memo(({ template }) => (
  <Link to={`/vibe/templates/${template.id}`} className="block group">
    <Card className="p-4 hover:shadow-lg transition-all hover:scale-[1.02] bg-card/50 backdrop-blur-sm border border-border/50">
      <div className="h-24 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg mb-3 flex items-center justify-center group-hover:scale-105 transition-transform">
        <span className="text-4xl">{template.icon || '📦'}</span>
      </div>
      
      <h3 className="font-bold mb-1 line-clamp-1">{template.name}</h3>
      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
        {template.description}
      </p>
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-green-400">
          {template.price === 0 ? 'Gratuit' : `${template.price} €`}
        </span>
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-xs">{template.popularity || '4.5'}</span>
        </div>
      </div>
    </Card>
  </Link>
))

// ✅ NOUVEAU : Composant AppCard pour le marketplace
const AppCard = memo(({ app }) => {
  const rating = app.stats?.rating || 0
  const downloads = app.stats?.downloads || 0

  return (
    <Link to={`/apps/${app.id}`} className="block group">
      <Card className="p-4 hover:shadow-lg transition-all hover:scale-[1.02] bg-card/50 backdrop-blur-sm border border-border/50">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Smartphone className="w-5 h-5 text-green-400" />
          </div>
          <Badge variant="outline" className="text-xs">
            {app.category || 'général'}
          </Badge>
        </div>
        
        <h3 className="font-bold mb-1 line-clamp-1">{app.name}</h3>
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {app.description || 'Aucune description'}
        </p>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
            <span>{app.stats?.reviewsCount || 0}</span>
          </div>
        </div>
      </Card>
    </Link>
  )
})

const ActivityItem = memo(({ activity }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'build': return <Rocket className="w-4 h-4 text-green-400" />
      case 'deploy': return <CheckCircle className="w-4 h-4 text-blue-400" />
      case 'template': return <Star className="w-4 h-4 text-yellow-400" />
      default: return <Activity className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className="flex items-center gap-3 p-2 hover:bg-card/60 rounded-lg transition-colors">
      <div className="w-8 h-8 rounded-full bg-card/80 flex items-center justify-center">
        {getIcon(activity.type)}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{activity.message}</p>
        <p className="text-xs text-muted-foreground">{activity.time}</p>
      </div>
    </div>
  )
})

const QuickAction = memo(({ to, icon, label, color, variant = 'solid' }) => {
  const colors = {
    purple: variant === 'solid' 
      ? 'bg-purple-500 hover:bg-purple-600 text-white' 
      : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10',
    pink: variant === 'solid'
      ? 'bg-pink-500 hover:bg-pink-600 text-white'
      : 'border-pink-500/30 text-pink-400 hover:bg-pink-500/10',
    blue: variant === 'solid'
      ? 'bg-blue-500 hover:bg-blue-600 text-white'
      : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
    green: variant === 'solid'
      ? 'bg-green-500 hover:bg-green-600 text-white'
      : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
  }

  return (
    <Link to={to}>
      <Button 
        className={`w-full ${colors[color]}`}
        variant={variant === 'outline' ? 'outline' : 'default'}
      >
        {icon}
        {label}
      </Button>
    </Link>
  )
})

const EmptyState = memo(({ icon, title, description, action }) => (
  <Card className="p-12 text-center">
    <div className="text-muted-foreground mb-3">{icon}</div>
    <h3 className="font-bold text-lg mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4">{description}</p>
    {action && (
      <Link to={action.link}>
        <Button className="bg-purple-500 hover:bg-purple-600">
          <Plus className="w-4 h-4 mr-2" />
          {action.label}
        </Button>
      </Link>
    )}
  </Card>
))

// =============================
// SKELETON AMÉLIORÉ
// =============================

const EnhancedSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
    <div className="h-48 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl mb-8" />
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-lg" />
            <div className="flex-1">
              <div className="h-6 w-16 bg-muted rounded mb-1" />
              <div className="h-3 w-12 bg-muted rounded" />
            </div>
          </div>
        </Card>
      ))}
    </div>
    <div className="mb-12">
      <div className="h-8 w-48 bg-muted rounded mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="h-5 w-3/4 bg-muted rounded mb-2" />
            <div className="h-4 w-full bg-muted rounded mb-1" />
            <div className="h-4 w-2/3 bg-muted rounded mb-3" />
            <div className="flex justify-between">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  </div>
)

// =============================
// COMPOSANT PRINCIPAL
// =============================

const VibeDashboard = () => {
  const { user } = useAuth()
  const userId = user?.id

  const {
    projects,
    templates,
    userStats,
    templateStats,
    publisherStats,
    activities,
    popularApps,
    isLoading,
    isError,
    refetch
  } = useDashboardQueries(userId)

  const formatRelativeDate = useCallback((dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'à l\'instant'
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`
    if (diff < 604800000) return `il y a ${Math.floor(diff / 86400000)} j`
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }, [])

  const stats = {
    totalProjects: userStats?.totalProjects || 0,
    totalBuilds: userStats?.byStatus?.built || 0,
    totalCollaborators: userStats?.collaborators || 0,
    totalTemplates: templateStats?.total || 0,
    publishedApps: publisherStats?.totalPublished || 0
  }

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connexion requise</h2>
          <p className="text-muted-foreground mb-6">
            Veuillez vous connecter pour accéder à Vibe Coding
          </p>
          <Link to="/auth">
            <Button className="bg-purple-500 hover:bg-purple-600">
              Se connecter
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (isLoading) return <EnhancedSkeleton />

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erreur de chargement</h2>
          <p className="text-muted-foreground mb-6">
            Impossible de charger les données du dashboard
          </p>
          <Button onClick={handleRefresh} className="bg-purple-500 hover:bg-purple-600">
            Réessayer
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="vibe-dashboard min-h-screen bg-gradient-to-b from-background to-background/95 pb-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('/grid.svg')" }} />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <h1 className="text-5xl font-black mb-3 flex items-center gap-3">
                ⚡ Vibe Coding
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-normal">
                  v1.0.0
                </span>
              </h1>
              <p className="text-xl text-white/80 max-w-2xl">
                Créez, build et déployez vos applications plus vite que jamais.
                De l'idée à la production en quelques clics.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Link to="/vibe/projects/create">
                <Button size="lg" className="bg-white text-purple-900 hover:bg-white/90 font-bold px-6">
                  <Plus className="w-5 h-5 mr-2" />
                  Nouveau projet
                </Button>
              </Link>
              <Link to="/vibe/templates">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  <Layout className="w-5 h-5 mr-2" />
                  Templates
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-12">
            <StatCard
              icon={<FolderGit2 className="w-5 h-5" />}
              label="Projets"
              value={stats.totalProjects}
              color="purple"
            />
            <StatCard
              icon={<Rocket className="w-5 h-5" />}
              label="Builds"
              value={stats.totalBuilds}
              color="pink"
            />
            <StatCard
              icon={<Award className="w-5 h-5" />}
              label="Publiées"
              value={stats.publishedApps}
              color="yellow"
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Collaborateurs"
              value={stats.totalCollaborators}
              color="blue"
            />
            <StatCard
              icon={<Grid className="w-5 h-5" />}
              label="Templates"
              value={stats.totalTemplates}
              color="green"
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" 
              fill="currentColor" 
              className="text-background"
            />
          </svg>
        </div>
      </div>

            {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale (projets + templates) */}
          <div className="lg:col-span-2 space-y-12">
            {/* Projets récents */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Clock className="w-6 h-6 text-purple-400" />
                  Projets récents
                </h2>
                <Link to="/vibe/projects">
                  <Button variant="ghost" className="text-purple-400 hover:text-purple-300">
                    Voir tous <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>

              {projects.length === 0 ? (
                <EmptyState
                  icon={<FolderGit2 className="w-12 h-12" />}
                  title="Aucun projet"
                  description="Commencez par créer votre premier projet"
                  action={{
                    label: "Créer un projet",
                    link: "/vibe/projects/create"
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project) => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      formatDate={formatRelativeDate}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ✅ NOUVEAU : Marketplace Applications */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Smartphone className="w-6 h-6 text-green-400" />
                  Applications populaires
                </h2>
                <Link to="/apps">
                  <Button variant="ghost" className="text-green-400 hover:text-green-300">
                    Voir toutes <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>

              {popularApps.length === 0 ? (
                <EmptyState
                  icon={<Smartphone className="w-12 h-12" />}
                  title="Aucune application"
                  description="Découvrez les applications créées par la communauté"
                  action={{
                    label: "Explorer les apps",
                    link: "/apps"
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {popularApps.map((app) => (
                    <AppCard key={app.id} app={app} />
                  ))}
                </div>
              )}
            </section>

            {/* Templates populaires */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-pink-400" />
                  Templates populaires
                </h2>
                <Link to="/vibe/templates">
                  <Button variant="ghost" className="text-pink-400 hover:text-pink-300">
                    Voir tous <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>

              {templates.length === 0 ? (
                <EmptyState
                  icon={<Rocket className="w-12 h-12" />}
                  title="Aucun template"
                  description="Explorez le marketplace pour trouver des templates"
                  action={{
                    label: "Explorer",
                    link: "/vibe/templates"
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Colonne latérale (activité + actions) */}
          <div className="space-y-6">
            {/* Activité récente */}
            <Card className="p-6 bg-card/50 backdrop-blur-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Activité récente
              </h3>
              
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune activité récente
                </p>
              ) : (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </Card>

            {/* Actions rapides */}
            <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Actions rapides
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <QuickAction
                  to="/vibe/projects/create"
                  icon={<FolderGit2 className="w-4 h-4 mr-2" />}
                  label="Nouveau projet"
                  color="purple"
                />
                <QuickAction
                  to="/vibe/templates"
                  icon={<Rocket className="w-4 h-4 mr-2" />}
                  label="Templates"
                  color="pink"
                  variant="outline"
                />
                <QuickAction
                  to="/apps"
                  icon={<Smartphone className="w-4 h-4 mr-2" />}
                  label="Applications"
                  color="green"
                  variant="outline"
                />
                <QuickAction
                  to="/vibe/collaborate"
                  icon={<Users className="w-4 h-4 mr-2" />}
                  label="Collaborer"
                  color="blue"
                  variant="outline"
                />
              </div>
            </Card>
   {/* Bouton de rafraîchissement */}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleRefresh}
            >
              <Activity className="w-4 h-4 mr-2" />
              Rafraîchir
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

VibeDashboard.propTypes = {};

export default VibeDashboard
EnhancedSkeleton.propTypes = {};
