/**
 * CooldownManager
 * Gère les périodes de refroidissement entre alertes similaires
 */

export class CooldownManager {
  /**
   * Crée une instance de CooldownManager
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      defaultCooldown: options.defaultCooldown || 15000, // 15 secondes
      maxCooldown: options.maxCooldown || 300000, // 5 minutes
      enableBackoff: options.enableBackoff !== false,
      ...options
    };

    this.cooldowns = new Map();
    this.backoffFactors = new Map();
    this.stats = {
      total: 0,
      prevented: 0,
      active: 0
    };
  }

  /**
   * Vérifie si une alerte peut être envoyée
   * @param {string} key - Clé d'identification (ex: 'cpu-high')
   * @returns {boolean} true si peut être envoyée
   */
  canSend(key) {
    const now = Date.now();
    const cooldown = this.cooldowns.get(key);

    if (!cooldown) {
      this._recordSend(key, now);
      return true;
    }

    if (now > cooldown.expiresAt) {
      this.cooldowns.delete(key);
      this.backoffFactors.delete(key);
      this._recordSend(key, now);
      return true;
    }

    this.stats.prevented++;
    return false;
  }

  /**
   * Enregistre l'envoi d'une alerte
   * @private
   * @param {string} key - Clé
   * @param {number} now - Timestamp
   */
  _recordSend(key, now) {
    const duration = this._getCooldownDuration(key);
    
    this.cooldowns.set(key, {
      lastSent: now,
      expiresAt: now + duration,
      count: (this.cooldowns.get(key)?.count || 0) + 1
    });

    this.stats.total++;
    this.stats.active = this.cooldowns.size;
  }

  /**
   * Calcule la durée de cooldown
   * @private
   * @param {string} key - Clé
   * @returns {number} Durée en ms
   */
  _getCooldownDuration(key) {
    let duration = this.options.defaultCooldown;

    if (this.options.enableBackoff) {
      const factor = this.backoffFactors.get(key) || 1;
      duration = Math.min(duration * factor, this.options.maxCooldown);
      this.backoffFactors.set(key, factor * 1.5);
    }

    return duration;
  }

  /**
   * Réinitialise le cooldown pour une clé
   * @param {string} key - Clé
   */
  reset(key) {
    this.cooldowns.delete(key);
    this.backoffFactors.delete(key);
    this.stats.active = this.cooldowns.size;
  }

  /**
   * Réinitialise tous les cooldowns
   */
  resetAll() {
    this.cooldowns.clear();
    this.backoffFactors.clear();
    this.stats.active = 0;
  }

  /**
   * Obtient le temps restant pour une clé
   * @param {string} key - Clé
   * @returns {number} Temps restant en ms (0 si pas de cooldown)
   */
  getRemainingTime(key) {
    const cooldown = this.cooldowns.get(key);
    if (!cooldown) return 0;

    const remaining = cooldown.expiresAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Vérifie si une clé est en cooldown
   * @param {string} key - Clé
   * @returns {boolean} true si en cooldown
   */
  isInCooldown(key) {
    return this.getRemainingTime(key) > 0;
  }

  /**
   * Obtient le nombre d'occurrences pour une clé
   * @param {string} key - Clé
   * @returns {number} Nombre d'occurrences
   */
  getOccurrenceCount(key) {
    return this.cooldowns.get(key)?.count || 0;
  }

  /**
   * Définit un cooldown personnalisé pour une clé
   * @param {string} key - Clé
   * @param {number} duration - Durée en ms
   */
  setCustomCooldown(key, duration) {
    const now = Date.now();
    this.cooldowns.set(key, {
      lastSent: now,
      expiresAt: now + duration,
      count: 1,
      custom: true
    });
    this.stats.active = this.cooldowns.size;
  }

  /**
   * Obtient les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    const activeCooldowns = Array.from(this.cooldowns.entries()).map(([key, data]) => ({
      key,
      remaining: data.expiresAt - Date.now(),
      count: data.count,
      custom: data.custom || false
    }));

    return {
      ...this.stats,
      activeCooldowns: activeCooldowns.sort((a, b) => a.remaining - b.remaining)
    };
  }

  /**
   * Nettoie les cooldowns expirés
   * @returns {number} Nombre de cooldowns nettoyés
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    this.cooldowns.forEach((data, key) => {
      if (now > data.expiresAt) {
        this.cooldowns.delete(key);
        this.backoffFactors.delete(key);
        cleaned++;
      }
    });

    this.stats.active = this.cooldowns.size;
    return cleaned;
  }

  /**
   * Applique un facteur de backoff différent
   * @param {number} factor - Nouveau facteur
   */
  setBackoffFactor(factor) {
    this.options.enableBackoff = true;
    this.backoffFactors.forEach((_, key) => {
      this.backoffFactors.set(key, factor);
    });
  }

  /**
   * Désactive le backoff
   */
  disableBackoff() {
    this.options.enableBackoff = false;
    this.backoffFactors.clear();
  }

  /**
   * Obtient le taux de prévention
   * @returns {number} Taux de prévention (%)
   */
  getPreventionRate() {
    if (this.stats.total === 0) return 0;
    return (this.stats.prevented / this.stats.total) * 100;
  }
}

export default CooldownManager;
