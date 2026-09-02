/**
 * AlertStore
 * Stockage et gestion des alertes
 */

export class AlertStore {
  /**
   * Crée une instance de AlertStore
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      maxAlerts: options.maxAlerts || 1000,
      retention: options.retention || 604800000, // 7 jours
      ...options
    };

    this.alerts = [];
    this.activeAlerts = new Set(); // IDs des alertes actives
    this.resolvedAlerts = new Set(); // IDs des alertes résolues
    this.bySeverity = new Map(); // Index par sévérité
    this.byType = new Map(); // Index par type
  }

  /**
   * Ajoute une alerte
   * @param {Object} alert - Alerte à ajouter
   */
  add(alert) {
    this.alerts.push(alert);

    if (!alert.resolved) {
      this.activeAlerts.add(alert.id);
    } else {
      this.resolvedAlerts.add(alert.id);
    }

    // Index par sévérité
    if (!this.bySeverity.has(alert.severity)) {
      this.bySeverity.set(alert.severity, []);
    }
    this.bySeverity.get(alert.severity).push(alert);

    // Index par type
    if (!this.byType.has(alert.type)) {
      this.byType.set(alert.type, []);
    }
    this.byType.get(alert.type).push(alert);

    this._cleanup();
  }

  /**
   * Met à jour une alerte
   * @param {string} alertId - ID de l'alerte
   * @param {Object} updates - Mises à jour
   * @returns {Object|null} Alerte mise à jour
   */
  update(alertId, updates) {
    const alert = this.get(alertId);
    if (!alert) return null;

    const wasActive = !alert.resolved;
    const wasResolved = alert.resolved;

    Object.assign(alert, updates);

    // Mettre à jour les ensembles actifs/résolus
    if (wasActive !== !alert.resolved) {
      if (alert.resolved) {
        this.activeAlerts.delete(alertId);
        this.resolvedAlerts.add(alertId);
      } else {
        this.activeAlerts.add(alertId);
        this.resolvedAlerts.delete(alertId);
      }
    }

    return alert;
  }

  /**
   * Récupère une alerte
   * @param {string} alertId - ID de l'alerte
   * @returns {Object|null} Alerte
   */
  get(alertId) {
    return this.alerts.find(a => a.id === alertId);
  }

  /**
   * Récupère toutes les alertes
   * @returns {Array} Toutes les alertes
   */
  getAll() {
    return [...this.alerts];
  }

  /**
   * Récupère les alertes actives
   * @returns {Array} Alertes actives
   */
  getActive() {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Récupère les alertes résolues
   * @returns {Array} Alertes résolues
   */
  getResolved() {
    return this.alerts.filter(a => a.resolved);
  }

  /**
   * Récupère les alertes non acquittées
   * @returns {Array} Alertes non acquittées
   */
  getUnacknowledged() {
    return this.alerts.filter(a => !a.acknowledged && !a.resolved);
  }

  /**
   * Récupère les alertes par sévérité
   * @param {string} severity - Niveau de sévérité
   * @returns {Array} Alertes
   */
  getBySeverity(severity) {
    return this.bySeverity.get(severity) || [];
  }

  /**
   * Récupère les alertes par type
   * @param {string} type - Type d'alerte
   * @returns {Array} Alertes
   */
  getByType(type) {
    return this.byType.get(type) || [];
  }

  /**
   * Récupère les alertes d'une période
   * @param {number} start - Timestamp de début
   * @param {number} end - Timestamp de fin
   * @returns {Array} Alertes
   */
  getInPeriod(start, end = Date.now()) {
    return this.alerts.filter(a => 
      a.createdAt >= start && a.createdAt <= end
    );
  }

  /**
   * Récupère les alertes récentes
   * @param {number} limit - Nombre d'alertes
   * @returns {Array} Alertes récentes
   */
  getRecent(limit = 50) {
    return [...this.alerts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Nettoie les anciennes alertes
   * @private
   */
  _cleanup() {
    const cutoff = Date.now() - this.options.retention;
    
    // Supprimer les alertes résolues trop anciennes
    this.alerts = this.alerts.filter(a => {
      if (a.resolved && a.resolvedAt < cutoff) {
        this.activeAlerts.delete(a.id);
        this.resolvedAlerts.delete(a.id);
        
        // Nettoyer les index
        const severityAlerts = this.bySeverity.get(a.severity);
        if (severityAlerts) {
          const index = severityAlerts.indexOf(a);
          if (index !== -1) severityAlerts.splice(index, 1);
        }

        const typeAlerts = this.byType.get(a.type);
        if (typeAlerts) {
          const index = typeAlerts.indexOf(a);
          if (index !== -1) typeAlerts.splice(index, 1);
        }

        return false;
      }
      return true;
    });

    // Limiter le nombre total
    if (this.alerts.length > this.options.maxAlerts) {
      const toRemove = this.alerts.length - this.options.maxAlerts;
      const removed = this.alerts.splice(0, toRemove);
      
      removed.forEach(a => {
        this.activeAlerts.delete(a.id);
        this.resolvedAlerts.delete(a.id);
        
        const severityAlerts = this.bySeverity.get(a.severity);
        if (severityAlerts) {
          const index = severityAlerts.indexOf(a);
          if (index !== -1) severityAlerts.splice(index, 1);
        }

        const typeAlerts = this.byType.get(a.type);
        if (typeAlerts) {
          const index = typeAlerts.indexOf(a);
          if (index !== -1) typeAlerts.splice(index, 1);
        }
      });
    }
  }

  /**
   * Nettoie manuellement
   * @param {number} cutoff - Timestamp limite
   */
  cleanup(cutoff) {
    this.alerts = this.alerts.filter(a => {
      if (a.createdAt < cutoff) {
        this.activeAlerts.delete(a.id);
        this.resolvedAlerts.delete(a.id);
        return false;
      }
      return true;
    });
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    const bySeverity = {};
    const byType = {};

    this.alerts.forEach(a => {
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      byType[a.type] = (byType[a.type] || 0) + 1;
    });

    return {
      total: this.alerts.length,
      active: this.activeAlerts.size,
      resolved: this.resolvedAlerts.size,
      bySeverity,
      byType,
      lastAlert: this.alerts[this.alerts.length - 1] || null
    };
  }

  /**
   * Vide le store
   */
  clear() {
    this.alerts = [];
    this.activeAlerts.clear();
    this.resolvedAlerts.clear();
    this.bySeverity.clear();
    this.byType.clear();
  }

  /**
   * Vérifie si une alerte existe
   * @param {string} alertId - ID de l'alerte
   * @returns {boolean} true si existe
   */
  has(alertId) {
    return this.alerts.some(a => a.id === alertId);
  }

  /**
   * Taille du store
   * @returns {number} Nombre d'alertes
   */
  size() {
    return this.alerts.length;
  }
}

export default AlertStore;
