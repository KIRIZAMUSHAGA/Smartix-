/**
 * notificationService - Service de notifications
 * 
 * Rôle: Envoyer des notifications aux utilisateurs
 * - In-app
 * - Email
 * - Push (optionnel)
 */

import { EventEmitter } from 'events'

const logger = {
  debug: (...args) => console.debug('[Notifications]', ...args),
  info: (...args) => console.info('[Notifications]', ...args),
  warn: (...args) => console.warn('[Notifications]', ...args),
  error: (...args) => console.error('[Notifications]', ...args),
  createChild: (name) => ({
    debug: (...args) => console.debug(`[${name}]`, ...args),
    info: (...args) => console.info(`[${name}]`, ...args),
    warn: (...args) => console.warn(`[${name}]`, ...args),
    error: (...args) => console.error(`[${name}]`, ...args),
  }),
}

export class NotificationService extends EventEmitter {
  constructor(options = {}) {
    super()
    this.notifications = new Map() // userId -> [notifications]
    this.emailEnabled = options.emailEnabled || false
    this.pushEnabled = options.pushEnabled || false
    this.logger = logger.createChild('NotificationService')
  }

  /**
   * Notifie un utilisateur
   */
  async notifyUser(userId, notification) {
    const {
      type,
      title,
      message,
      data = {},
      priority = 'normal',
      expiresIn = 7 * 24 * 60 * 60 * 1000 // 7 jours
    } = notification

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`

    const notif = {
      id: notificationId,
      userId,
      type,
      title,
      message,
      data,
      priority,
      read: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn
    }

    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, [])
    }

    this.notifications.get(userId).unshift(notif)

    // Limiter le nombre de notifications en mémoire
    const userNotifs = this.notifications.get(userId)
    if (userNotifs.length > 100) {
      userNotifs.pop()
    }

    // Émettre l'événement
    this.emit('notification', notif)

    // Email (optionnel)
    if (this.emailEnabled && notification.email) {
      await this._sendEmail(userId, notification).catch(err => {
        this.logger.warn('Email non envoyé', err)
      })
    }

    // Push (optionnel)
    if (this.pushEnabled && notification.push) {
      await this._sendPush(userId, notification).catch(err => {
        this.logger.warn('Push non envoyé', err)
      })
    }

    return notif
  }

  /**
   * Récupère les notifications d'un utilisateur
   */
  getUserNotifications(userId, options = {}) {
    const {
      unreadOnly = false,
      limit = 50
    } = options

    const userNotifs = this.notifications.get(userId) || []

    let filtered = userNotifs
      .filter(n => n.expiresAt > Date.now())

    if (unreadOnly) {
      filtered = filtered.filter(n => !n.read)
    }

    return filtered.slice(0, limit)
  }

  /**
   * Marque une notification comme lue
   */
  markAsRead(userId, notificationId) {
    const userNotifs = this.notifications.get(userId)
    if (!userNotifs) return false

    const notif = userNotifs.find(n => n.id === notificationId)
    if (!notif) return false

    notif.read = true
    this.emit('notification:read', notif)

    return true
  }

  /**
   * Marque toutes les notifications comme lues
   */
  markAllAsRead(userId) {
    const userNotifs = this.notifications.get(userId)
    if (!userNotifs) return 0

    let count = 0
    userNotifs.forEach(n => {
      if (!n.read) {
        n.read = true
        count++
      }
    })

    this.emit('notification:allRead', { userId, count })
    return count
  }

  /**
   * Supprime une notification
   */
  deleteNotification(userId, notificationId) {
    const userNotifs = this.notifications.get(userId)
    if (!userNotifs) return false

    const index = userNotifs.findIndex(n => n.id === notificationId)
    if (index === -1) return false

    userNotifs.splice(index, 1)
    this.emit('notification:deleted', { userId, notificationId })

    return true
  }

  /**
   * Nettoie les notifications expirées
   */
  cleanupExpired() {
    const now = Date.now()
    let cleaned = 0

    for (const [userId, notifs] of this.notifications.entries()) {
      const filtered = notifs.filter(n => n.expiresAt > now)
      if (filtered.length !== notifs.length) {
        this.notifications.set(userId, filtered)
        cleaned += notifs.length - filtered.length
      }
    }

    if (cleaned > 0) {
      this.logger.info(`${cleaned} notifications expirées nettoyées`)
    }

    return cleaned
  }

  /**
   * Envoie un email (à implémenter)
   */
  async _sendEmail(userId, notification) {
    // TODO: Intégrer un service d'email (SendGrid, AWS SES, etc.)
    this.logger.debug('Email envoyé (simulé)', { userId, type: notification.type })
  }

  /**
   * Envoie une notification push (à implémenter)
   */
  async _sendPush(userId, notification) {
    // TODO: Intégrer Firebase Cloud Messaging, OneSignal, etc.
    this.logger.debug('Push envoyé (simulé)', { userId, type: notification.type })
  }
}

export const notificationService = new NotificationService()
