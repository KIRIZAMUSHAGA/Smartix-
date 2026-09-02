/**
 * activityService - Service de suivi d'activité
 * 
 * Gère:
 * - Activité récente
 * - Historique des actions
 * - Notifications en temps réel
 * - Statistiques d'activité
 * 
 * @version 3.0.0
 */

import axios, { AxiosInstance, CancelTokenSource } from 'axios'

// Types et interfaces

export const CONFIG = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  CACHE_DURATION: 2 * 60 * 1000, // 2 minutes
  RECONNECT_INTERVAL: 5000, // 5 secondes
  MAX_RETRIES: 3,
  BATCH_SIZE: 50,
  DEBOUNCE_DELAY: 300, // ms
  WS_HEARTBEAT_INTERVAL: 30000, // 30 secondes
  MAX_CACHE_SIZE: 100 // Nombre maximum d'entrées en cache
}



export const ACTIVITY_TYPES = {
  PROJECT_CREATED: {
    type: 'project_created',
    label: 'Projet créé',
    icon: '📁',
    color: 'success',
    requiresNotification: true,
    category: 'project'
  },
  PROJECT_DELETED: {
    type: 'project_deleted',
    label: 'Projet supprimé',
    icon: '🗑️',
    color: 'error',
    requiresNotification: true,
    category: 'project'
  },
  PROJECT_RENAMED: {
    type: 'project_renamed',
    label: 'Projet renommé',
    icon: '✏️',
    color: 'info',
    requiresNotification: false,
    category: 'project'
  },
  FILE_CREATED: {
    type: 'file_created',
    label: 'Fichier créé',
    icon: '📄',
    color: 'info',
    requiresNotification: false,
    category: 'file'
  },
  FILE_UPDATED: {
    type: 'file_updated',
    label: 'Fichier modifié',
    icon: '✏️',
    color: 'warning',
    requiresNotification: false,
    category: 'file'
  },
  FILE_DELETED: {
    type: 'file_deleted',
    label: 'Fichier supprimé',
    icon: '🗑️',
    color: 'error',
    requiresNotification: false,
    category: 'file'
  },
  FILE_RENAMED: {
    type: 'file_renamed',
    label: 'Fichier renommé',
    icon: '📝',
    color: 'info',
    requiresNotification: false,
    category: 'file'
  },
  FILE_MOVED: {
    type: 'file_moved',
    label: 'Fichier déplacé',
    icon: '🚚',
    color: 'info',
    requiresNotification: false,
    category: 'file'
  },
  BUILD_STARTED: {
    type: 'build_started',
    label: 'Build démarré',
    icon: '🔨',
    color: 'info',
    requiresNotification: true,
    category: 'build'
  },
  BUILD_COMPLETED: {
    type: 'build_completed',
    label: 'Build terminé',
    icon: '✅',
    color: 'success',
    requiresNotification: true,
    category: 'build'
  },
  BUILD_FAILED: {
    type: 'build_failed',
    label: 'Build échoué',
    icon: '❌',
    color: 'error',
    requiresNotification: true,
    category: 'build'
  },
  BUILD_CANCELLED: {
    type: 'build_cancelled',
    label: 'Build annulé',
    icon: '⏹️',
    color: 'warning',
    requiresNotification: true,
    category: 'build'
  },
  DEPLOYED: {
    type: 'deployed',
    label: 'Déploiement effectué',
    icon: '🚀',
    color: 'success',
    requiresNotification: true,
    category: 'build'
  },
  DEPLOY_FAILED: {
    type: 'deploy_failed',
    label: 'Déploiement échoué',
    icon: '💥',
    color: 'error',
    requiresNotification: true,
    category: 'build'
  },
  COLLABORATOR_ADDED: {
    type: 'collaborator_added',
    label: 'Collaborateur ajouté',
    icon: '👥',
    color: 'success',
    requiresNotification: true,
    category: 'collaboration'
  },
  COLLABORATOR_REMOVED: {
    type: 'collaborator_removed',
    label: 'Collaborateur retiré',
    icon: '👤',
    color: 'error',
    requiresNotification: true,
    category: 'collaboration'
  },
  COLLABORATOR_UPDATED: {
    type: 'collaborator_updated',
    label: 'Rôle modifié',
    icon: '🔧',
    color: 'warning',
    requiresNotification: true,
    category: 'collaboration'
  },
  SETTINGS_CHANGED: {
    type: 'settings_changed',
    label: 'Paramètres modifiés',
    icon: '⚙️',
    color: 'warning',
    requiresNotification: false,
    category: 'system'
  },
  COMMENT_ADDED: {
    type: 'comment_added',
    label: 'Commentaire ajouté',
    icon: '💬',
    color: 'info',
    requiresNotification: true,
    category: 'collaboration'
  },
  COMMENT_EDITED: {
    type: 'comment_edited',
    label: 'Commentaire modifié',
    icon: '📝',
    color: 'info',
    requiresNotification: false,
    category: 'collaboration'
  },
  COMMENT_DELETED: {
    type: 'comment_deleted',
    label: 'Commentaire supprimé',
    icon: '🗑️',
    color: 'warning',
    requiresNotification: false,
    category: 'collaboration'
  },
  TASK_COMPLETED: {
    type: 'task_completed',
    label: 'Tâche terminée',
    icon: '✓',
    color: 'success',
    requiresNotification: true,
    category: 'system'
  },
  TASK_CREATED: {
    type: 'task_created',
    label: 'Tâche créée',
    icon: '📋',
    color: 'info',
    requiresNotification: false,
    category: 'system'
  },
  MERGE_CONFLICT: {
    type: 'merge_conflict',
    label: 'Conflit de fusion',
    icon: '⚠️',
    color: 'error',
    requiresNotification: true,
    category: 'file'
  },
  BRANCH_CREATED: {
    type: 'branch_created',
    label: 'Branche créée',
    icon: '🌿',
    color: 'success',
    requiresNotification: false,
    category: 'file'
  },
  BRANCH_MERGED: {
    type: 'branch_merged',
    label: 'Branche fusionnée',
    icon: '🔀',
    color: 'success',
    requiresNotification: true,
    category: 'file'
  }
}











// Erreur personnalisée typée
export class ActivityError extends Error {
  name = 'ActivityError'
  constructor(
    message,
    code,
    details = {},
    retryable = false
  ) {
    super(message)
    this.code = code
    this.details = details
    this.retryable = retryable
    this.timestamp = new Date().toISOString()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ActivityError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      retryable: this.retryable,
      stack: this.stack
    }
  }
}

// Service principal
export class ActivityService {
  async addActivity(projectId, userId, type, data, options = {}) {
    const activityData = { projectId, userId, type, ...data }
    return new Promise((resolve) => {
      // TODO: Implémenter le système de batch
      resolve(this.formatActivity(activityData))
    })
  }

  async retryAddActivity(
    projectId,
    userId,
    type,
    data,
    options
  ) {
    const retryKey = `${projectId}_${userId}_${type}`
    const currentRetries = this.retryCount.get(retryKey) || 0

    if (currentRetries >= CONFIG.MAX_RETRIES) {
      this.retryCount.delete(retryKey)
      throw new ActivityError(
        'Échec après plusieurs tentatives',
        'MAX_RETRIES_EXCEEDED',
        { projectId, userId, type },
        false
      )
    }

    this.retryCount.set(retryKey, currentRetries + 1)

    // Attente exponentielle
    const delay = Math.pow(2, currentRetries) * 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    return this.addActivity(projectId, userId, type, data, { ...options, retry: true })
  }

  /**
   * Récupère les statistiques d'activité
   */
  async getActivityStats(
    projectId,
    options = {}
  ) {
    this.validateProjectId(projectId)

    const cacheKey = `stats_${projectId}_${options.period || '30d'}_${options.interval || 'day'}`

    try {
      const response = await this.axiosInstance.get(
        `/vibe/projects/${projectId}/activity/stats`,
        { params: options }
      )

      return this.formatStats(response.data)
    } catch (error) {
      console.error('Erreur chargement stats activité:', error)
      return this.getDefaultStats()
    }
  }

  /**
   * Récupère les activités groupées par jour
   */
  async getActivitiesByDay(
    projectId,
    days = 7,
    filters
  ) {
    try {
      const response = await this.getRecentActivity(projectId, 1000, undefined, filters)
      const activities = response.data

      const groups = new Map()
      const now = new Date()

      // Initialiser les groupes
      for (let i = 0; i < days; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const key = date.toISOString().split('T')[0]
        groups.set(key, [])
      }

      // Grouper les activités
      activities.forEach(activity => {
        const date = new Date(activity.timestamp).toISOString().split('T')[0]
        const group = groups.get(date)
        if (group) {
          group.push(activity)
        }
      })

      // Convertir en tableau trié
      return Array.from(groups.entries())
        .map(([date, activities]) => ({
          date,
          activities,
          count: activities.length
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    } catch (error) {
      console.error('Erreur groupement activités:', error)
      return []
    }
  }

   /**
   * Nettoie les activités anciennes
   */
  async cleanup(
    projectId,
    olderThan,
    options = {}
  ) {
    this.validateProjectId(projectId)

    try {
      const response = await this.axiosInstance.delete(
        `/vibe/projects/${projectId}/activity`,
        {
          data: {
            olderThan,
            types: options.types,
            dryRun: options.dryRun
          }
        }
      )

      // Invalider le cache
      this.invalidateProjectCache(projectId)

      return response.data
    } catch (error) {
      throw this.handleError(error, { projectId, operation: 'cleanup' })
    }
  }

  /**
   * Connexion WebSocket améliorée
   */
  connectWebSocket(projectId, token) {
    this.disconnectWebSocket()
    this.currentProjectId = projectId

    const _wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${_wsProto}//${window.location.host}`
    this.webSocket = new WebSocket(`${wsUrl}/ws/projects/${projectId}?token=${token}`)

    this.webSocket.onopen = () => {
      console.log('WebSocket connecté')
      this.isConnected = true
      this.connectionAttempts = 0
      this.reconnectTimer = null

      // Envoyer les messages en attente
      this.flushMessageQueue()

      // Démarrer le heartbeat
      this.startHeartbeat()
    }

    this.webSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'activity':
            if (message.activity) {
              this.handleIncomingActivity(message.activity)
            }
            break

          case 'heartbeat':
            this.handleHeartbeat()
            break

          case 'ack':
            this.handleAcknowledgement(message)
            break

          case 'read_receipt':
            this.handleReadReceipt(message)
            break
        }
      } catch (error) {
        console.error('Erreur traitement message WebSocket:', error)
      }
    }

    this.webSocket.onclose = (event) => {
      console.log('WebSocket déconnecté:', event.code, event.reason)
      this.isConnected = false
      this.stopHeartbeat()

      // Reconnexion automatique sauf si fermeture normale
      if (event.code !== 1000) {
        this.scheduleReconnect(projectId, token)
      }
    }

    this.webSocket.onerror = (error) => {
      console.error('Erreur WebSocket:', error)
      this.isConnected = false
    }
  }

  startHeartbeat() {
    this.wsHeartbeatInterval = setInterval(() => {
      if (this.isConnected && this.webSocket?.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        }))
      }
    }, CONFIG.WS_HEARTBEAT_INTERVAL)
  }

  stopHeartbeat() {
    if (this.wsHeartbeatInterval) {
      clearInterval(this.wsHeartbeatInterval)
      this.wsHeartbeatInterval = null
    }
  }

  handleHeartbeat() {
    // Répondre au heartbeat si nécessaire
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      }))
    }
  }

  handleIncomingActivity(activity) {
    // Mettre en cache
    this.activityCache.set(activity.id, activity)

    // Notifier les listeners
    this.notifyListeners(activity.projectId, activity)

    // Si non lue, ajouter au set
    if (!activity.isRead) {
      this.unreadActivities.add(activity.id)
    }
  }

  handleAcknowledgement(message) {
    // Retirer le message de la file d'attente
    const index = this.messageQueue.findIndex(m => m.messageId === message.messageId)
    if (index !== -1) {
      this.messageQueue.splice(index, 1)
    }
  }

  handleReadReceipt(message) {
    if (message.activity?.id) {
      this.unreadActivities.delete(message.activity.id)
    }
  }

  sendWebSocketMessage(message) {
    if (this.isConnected && this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(message))
    } else {
      // Mettre en file d'attente
      this.messageQueue.push(message)
    }
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.sendWebSocketMessage(message)
      }
    }
  }

  scheduleReconnect(projectId, token) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const delay = Math.min(
      CONFIG.RECONNECT_INTERVAL * Math.pow(2, this.connectionAttempts),
      60000 // Max 1 minute
    )

    this.reconnectTimer = setTimeout(() => {
      this.connectionAttempts++
      console.log(`Tentative de reconnexion WebSocket #${this.connectionAttempts}...`)
      this.connectWebSocket(projectId, token)
    }, delay)
  }

  /**
   * Déconnecte le WebSocket
   */
  disconnectWebSocket() {
    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.webSocket) {
      this.webSocket.close(1000, 'Déconnexion normale')
      this.webSocket = null
    }

    this.isConnected = false
    this.currentProjectId = null
    this.connectionAttempts = 0
    this.messageQueue = []
  }

  /**
   * Abonnement amélioré avec filtres
   */
  subscribe(
    projectId,
    callback,
    filter,
    debounceDelay
  ) {
    this.validateProjectId(projectId)

    const subscriptionId = this.generateRequestId()
    let wrappedCallback = callback

    if (debounceDelay) {
      wrappedCallback = this.debounce(callback, debounceDelay)
    }

    const subscription = {
      id: subscriptionId,
      projectId,
      callback: wrappedCallback,
      filter
    }

    this.subscriptions.set(subscriptionId, subscription)

    if (!this.listeners.has(projectId)) {
      this.listeners.set(projectId, new Set())
    }
    this.listeners.get(projectId).add(wrappedCallback)

    // Retourner une fonction de désabonnement
    return () => this.unsubscribe(subscriptionId)
  }

  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId)
    if (subscription) {
      const listeners = this.listeners.get(subscription.projectId)
      if (listeners) {
        listeners.delete(subscription.callback)
        if (listeners.size === 0) {
          this.listeners.delete(subscription.projectId)
        }
      }
      this.subscriptions.delete(subscriptionId)
    }
  }

  async notifyListeners(projectId, activity) {
    const listeners = this.listeners.get(projectId)
    if (!listeners) return

    const promises = []

    listeners.forEach(callback => {
      promises.push(
        new Promise((resolve) => {
          try {
            callback(activity)
          } catch (error) {
            console.error('Erreur dans un listener:', error)
          }
          resolve()
        })
      )
    })

    await Promise.all(promises)
  }

  /**
   * Abonnement avec debounce
   */
  subscribeDebounced(
    projectId,
    callback,
    delay = CONFIG.DEBOUNCE_DELAY
  ) {
    return this.subscribe(projectId, callback, undefined, delay)
  }

  debounce(
    func,
    delay
  ) {
    const debounced = (...args) => {
      const key = JSON.stringify(args)

      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key))
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(key)
        func(...args)
      }, delay)

      this.debounceTimers.set(key, timer)
    }

    return debounced
  }

  /**
   * Récupère les activités de tous les projets
   */
  async getAllUserProjectsActivity(
    userId,
    limit = 5
  ) {
    this.validateUserId(userId)

    try {
      // Récupérer les projets
      const projectsResponse = await this.axiosInstance.get(`/vibe/users/${userId}/projects`)
      const projects = projectsResponse.data

      // Récupérer les activités en parallèle avec limite
      const activitiesPromises = projects.map(async (project) => {
        try {
          const response = await this.getRecentActivity(project.id, limit)
          return {
            projectId: project.id,
            projectName: project.name,
            activities: response.data
          }
        } catch (error) {
          console.error(`Erreur pour le projet ${project.id}:`, error)
          return {
            projectId: project.id,
            projectName: project.name,
            activities: []
          }
        }
      })

      const results = await Promise.all(activitiesPromises)

      const map = new Map()
      results.forEach(({ projectId, projectName, activities }) => {
        map.set(projectId, { projectName, activities })
      })

      return map
    } catch (error) {
      console.error('Erreur chargement activités multi-projets:', error)
      return new Map()
    }
  }

  /**
   * Recherche avancée d'activités
   */
  async searchActivities(
    projectId,
    query,
    options = {}
  ) {
    this.validateProjectId(projectId)

    try {
      const response = await this.axiosInstance.get(
        `/vibe/projects/${projectId}/activity/search`,
        {
          params: {
            q: query,
            ...options
          }
        }
      )

      return this.formatActivities(response.data)
    } catch (error) {
      throw this.handleError(error, { projectId, operation: 'searchActivities' })
    }
  }

  /**
   * Récupère les activités non lues
   */
  async getUnreadCount(projectId, userId) {
    try {
      const response = await this.axiosInstance.get(
        `/vibe/projects/${projectId}/unread/${userId}`
      )
      return response.data.count || 0
    } catch (error) {
      console.error('Erreur chargement activités non lues:', error)
      return this.unreadActivities.size
    }
  }

  /**
   * Marque les activités comme lues
   */
  async markAsRead(
    projectId,
    userId,
    activityIds = []
  ) {
    try {
      await this.axiosInstance.post(`/vibe/projects/${projectId}/read`, {
        userId,
        activityIds: activityIds.length ? activityIds : []
      })

      // Mettre à jour le cache local
      activityIds.forEach(id => this.unreadActivities.delete(id))

      // Notifier via WebSocket
      this.sendWebSocketMessage({
        type: 'read_receipt',
        projectId,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Erreur marquage activités comme lues:', error)
    }
  }

  /**
   * Exporte les activités
   */
  async exportActivities(
    projectId,
    format = 'csv',
    options = {}
  ) {
    try {
      const activities = await this.getRecentActivity(projectId, 1000, undefined, options.filters)

      if (format === 'json') {
        return JSON.stringify(activities.data, null, 2)
      }

      // Format CSV
      return this.convertToCSV(activities.data, options.includeMetadata)
    } catch (error) {
      console.error('Erreur export activités:', error)
      throw error
    }
  }

  convertToCSV(activities, includeMetadata = false) {
    const headers = ['Date', 'Type', 'Utilisateur', 'Description', 'Importance', 'Tags']
    if (includeMetadata) {
      headers.push('Métadonnées')
    }

    const rows = activities.map(a => [
      a.timestamp,
      a.label,
      a.userName || a.userId,
      a.data?.description || '',
      a.importance || 'medium',
      (a.tags || []).join(';'),
      ...(includeMetadata ? [JSON.stringify(a.data?.metadata || {})] : [])
    ])

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
  }

  /**
   * Formattage des activités
   */
  formatActivity(activity) {
    const typeInfo = ACTIVITY_TYPES[activity.type] || {
      type: activity.type,
      label: activity.type,
      icon: '📌',
      color: 'default',
      requiresNotification: false
    }

    return {
      ...activity,
      ...typeInfo,
      formattedTimestamp: this.formatTimestamp(activity.timestamp),
      timeAgo: this.getTimeAgo(activity.timestamp)
    }
  }

  formatActivities(activities) {
    return activities.map(a => this.formatActivity(a))
  }

  formatStats(stats) {
    // Calculer le trend
    const timeline = stats.last7Days || []
    const trend = this.calculateTrend(timeline)

    return {
      total: stats.total || 0,
      byType: stats.byType || {},
      byUser: stats.byUser || {},
      byCategory: stats.byCategory || {},
      timeline: stats.timeline || [],
      last7Days: timeline,
      mostActiveDay: stats.mostActiveDay || null,
      averagePerDay: stats.averagePerDay || 0,
      peakHour: stats.peakHour || 0,
      uniqueUsers: stats.uniqueUsers || 0,
      activityScore: stats.activityScore || 0,
      trend: trend.direction,
      trendPercentage: trend.percentage,
      ...stats
    }
  }

  /**
   * @param {Array} timeline
   * @returns {{ direction: 'up'|'down'|'stable', percentage: number }}
   */
  calculateTrend(timeline) {
    if (timeline.length < 2) {
      return { direction: 'stable', percentage: 0 }
    }

    const firstHalf = timeline.slice(0, Math.floor(timeline.length / 2))
    const secondHalf = timeline.slice(Math.floor(timeline.length / 2))

    const avgFirst = firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length

    if (avgSecond === 0) return { direction: 'stable', percentage: 0 }

    const percentage = ((avgSecond - avgFirst) / avgFirst) * 100

    if (percentage > 5) return { direction: 'up', percentage }
    if (percentage < -5) return { direction: 'down', percentage }
    return { direction: 'stable', percentage }
  }

  getDefaultStats() {
    return {
      total: 0,
      byType: {},
      byUser: {},
      byCategory: {},
      timeline: [],
      last7Days: [],
      mostActiveDay,
      averagePerDay: 0,
      peakHour: 0,
      uniqueUsers: 0,
      activityScore: 0,
      trend: 'stable',
      trendPercentage: 0
    }
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp)
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  getTimeAgo(timestamp) {
    const now = new Date()
    const past = new Date(timestamp)
    const diffMs = now.getTime() - past.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    const diffWeek = Math.floor(diffDay / 7)
    const diffMonth = Math.floor(diffDay / 30)
    const diffYear = Math.floor(diffDay / 365)

    if (diffSec < 60) return 'à l\'instant'
    if (diffMin < 60) return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`
    if (diffHour < 24) return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`
    if (diffDay < 7) return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`
    if (diffWeek < 4) return `il y a ${diffWeek} semaine${diffWeek > 1 ? 's' : ''}`
    if (diffMonth < 12) return `il y a ${diffMonth} mois`
    return `il y a ${diffYear} an${diffYear > 1 ? 's' : ''}`
  }

/**
   * Gestion du cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key)
    if (!cached) return null

    const cacheAge = Date.now() - cached.timestamp
    if (cacheAge > CONFIG.CACHE_DURATION) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  setInCache(key, data, etag) {
    // Estimer la taille (approximatif)
    const size = new TextEncoder().encode(JSON.stringify(data)).length

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
      version: this.version++,
      size
    })
  }

  invalidateProjectCache(projectId) {
    const keysToDelete = []

    for (const [key] of this.cache) {
      if (key.includes(projectId)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Validation
   */
  validateProjectId(projectId) {
    if (!projectId) {
      throw new ActivityError('ID de projet requis', 'MISSING_PROJECT_ID', {}, false)
    }
    if (typeof projectId !== 'string') {
      throw new ActivityError('ID de projet invalide', 'INVALID_PROJECT_ID', {}, false)
    }
  }

  validateUserId(userId) {
    if (!userId) {
      throw new ActivityError('ID utilisateur requis', 'MISSING_USER_ID', {}, false)
    }
    if (typeof userId !== 'string') {
      throw new ActivityError('ID utilisateur invalide', 'INVALID_USER_ID', {}, false)
    }
  }

  validateActivityType(type) {
    if (!ACTIVITY_TYPES[type]) {
      throw new ActivityError(
        `Type d'activité invalide: ${type}`,
        'INVALID_TYPE',
        { validTypes: Object.keys(ACTIVITY_TYPES) },
        false
      )
    }
  }

  /**
   * Gestion des erreurs
   */
  handleAxiosError(error) {
    if (error.response) {
      const { status, data } = error.response
      const message = data.error || data.message || error.message
      const retryable = status >= 500 || status === 429

      switch (status) {
        case 400:
          throw new ActivityError(message || 'Requête invalide', 'BAD_REQUEST', { data }, retryable)
        case 401:
          throw new ActivityError('Non authentifié', 'UNAUTHORIZED', {}, retryable)
        case 403:
          throw new ActivityError('Accès non autorisé', 'FORBIDDEN', {}, retryable)
        case 404:
          throw new ActivityError('Ressource non trouvée', 'NOT_FOUND', {}, retryable)
        case 429:
          throw new ActivityError('Trop de requêtes', 'RATE_LIMIT', { retryAfter: data.retryAfter }, true)
        default:
          throw new ActivityError(
            message || `Erreur serveur (${status})`,
            'API_ERROR',
            { status, data },
            retryable
          )
      }
    } else if (error.request) {
      throw new ActivityError(
        'Impossible de contacter le serveur',
        'NETWORK_ERROR',
        { request: error.request },
        true
      )
    } else {
      throw new ActivityError(
        error.message || 'Erreur inconnue',
        'UNKNOWN_ERROR',
        { originalError: error },
        false
      )
    }
  }

  handleError(error, context) {
    if (error instanceof ActivityError) {
      return error
    }

    const retryable = this.shouldRetry(error)

    if (error.name === 'TimeoutError' || (error).code === 'ECONNABORTED') {
      return new ActivityError(
        'Délai d\'attente dépassé',
        'TIMEOUT',
        context,
        true
      )
    }

    if (error.name === 'NetworkError' || (error).code === 'ERR_NETWORK') {
      return new ActivityError(
        'Erreur réseau',
        'NETWORK_ERROR',
        context,
        true
      )
    }

    return new ActivityError(
      error.message,
      'UNKNOWN_ERROR',
      { ...context, originalError: error },
      retryable
    )
  }

  shouldRetry(error) {
    if (error.response) {
      const status = error.response.status
      return status >= 500 || status === 429
    }
    return error.code === 'ECONNABORTED' || !error.response
  }

  /**
   * Utilitaires
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * API publique
   */
  getUnreadActivities() {
    return new Set(this.unreadActivities)
  }

  getCachedActivity(activityId) {
    return this.activityCache.get(activityId)
  }

  getConnectionStatus() {
    return this.isConnected
  }

  getCurrentProjectId() {
    return this.currentProjectId
  }

  getCacheStats() {
    return {
      size: Array.from(this.cache.values()).reduce((sum, e) => sum + e.size, 0),
      entries: this.cache.size
    }
  }

  clearCache() {
    this.cache.clear()
    this.activityCache.clear()
    console.log('Cache vidé')
  }

  clearUnread() {
    this.unreadActivities.clear()
  }

  cleanup() {
    this.disconnectWebSocket()

    // Nettoyer les timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Nettoyer les structures de données
    this.listeners.clear()
    this.subscriptions.clear()
    this.cache.clear()
    this.activityCache.clear()
    this.pendingRequests.clear()
    this.retryCount.clear()
    this.unreadActivities.clear()
    this.messageQueue = []

    console.log('Nettoyage terminé')
  }
}

// Export d'une instance unique
export const activityService = new ActivityService()

// Export des types et constantes
export default activityService
