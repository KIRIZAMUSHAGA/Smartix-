/**
 * rateLimiter - Limitation de débit
 * 
 * Rôle: Limiter le nombre d'actions par utilisateur/période
 * - Par type d'action
 * - Par utilisateur
 * - Par IP
 */

class RateLimiter {
  constructor() {
    this.limits = new Map() // key -> { count, resetAt }
    this.defaultLimits = {
      publish: { max: 5, window: 3600000 }, // 5 par heure
      download: { max: 100, window: 3600000 }, // 100 par heure
      review: { max: 20, window: 3600000 } // 20 par heure
    }
  }

  /**
   * Vérifie si une action est autorisée
   */
  check(key, action = 'default', customWindow = null) {
    const limit = this.defaultLimits[action] || { max: 1000, window: 3600000 }
    const window = customWindow || limit.window
    
    const now = Date.now()
    const mapKey = `${key}:${action}`

    let record = this.limits.get(mapKey)
    
    if (!record || now > record.resetAt) {
      // Nouvelle fenêtre
      record = {
        count: 1,
        resetAt: now + window
      }
      this.limits.set(mapKey, record)
      return true
    }

    if (record.count >= limit.max) {
      return false
    }

    record.count++
    return true
  }

  /**
   * Récupère les stats pour une clé
   */
  getStats(key, action = 'default') {
    const mapKey = `${key}:${action}`
    const record = this.limits.get(mapKey)
    
    if (!record) {
      return {
        allowed: true,
        remaining: this.defaultLimits[action]?.max || 1000,
        resetIn: 0
      }
    }

    const limit = this.defaultLimits[action] || { max: 1000 }
    const remaining = Math.max(0, limit.max - record.count)

    return {
      allowed: remaining > 0,
      remaining,
      resetIn: Math.max(0, record.resetAt - Date.now())
    }
  }

  /**
   * Nettoie les entrées expirées
   */
  cleanup() {
    const now = Date.now()
    for (const [key, record] of this.limits.entries()) {
      if (now > record.resetAt) {
        this.limits.delete(key)
      }
    }
  }
}

export const rateLimiter = new RateLimiter()

// Nettoyage périodique
setInterval(() => rateLimiter.cleanup(), 60000)
