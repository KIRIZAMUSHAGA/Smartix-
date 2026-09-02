/**
 * AlertManager
 * Gère la création, le stockage et le cycle de vie des alertes
 */

import EventEmitter from 'events';
import { SEVERITY_LEVELS, SEVERITY_COLORS } from '../core/constants';

export class AlertManager extends EventEmitter {
  /**
   * Crée une instance de AlertManager
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      maxAlerts: options.maxAlerts || 1000,
      autoResolve: options.autoResolve !== false,
      resolveTimeout: options.resolveTimeout || 300000, // 5 minutes
      ...options
    };

    this.alerts = [];
    this.activeAlerts = new Map(); // Par type pour éviter les doublons
    this.resolvedAlerts = [];
    this.alertCount = 0;
  }

  /**
   * Crée une nouvelle alerte
   * @param {Object} alert - Données de l'alerte
   * @returns {Object} Alerte créée
   */
  create(alert) {
    const alertId = `alert-${Date.now()}-${this.alertCount++}`;
    
    const newAlert = {
      id: alertId,
      ...alert,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      acknowledged: false,
      resolved: false
    };

    // Vérifier les doublons
    const key = `${alert.type}-${alert.metric}`;
    if (this.activeAlerts.has(key)) {
      const existing = this.activeAlerts.get(key);
      existing.count = (existing.count || 1) + 1;
      existing.updatedAt = Date.now();
      existing.lastValue = alert.value;
      this.emit('alert-updated', existing);
      return existing;
    }

    this.alerts.push(newAlert);
    this.activeAlerts.set(key, newAlert);

    // Limiter le nombre d'alertes
    if (this.alerts.length > this.options.maxAlerts) {
      const removed = this.alerts.shift();
      if (removed && !removed.resolved) {
        this.activeAlerts.delete(`${removed.type}-${removed.metric}`);
      }
    }

    // Planifier la résolution automatique
    if (this.options.autoResolve) {
      setTimeout(() => {
        this.resolve(alertId, 'auto-resolve');
      }, this.options.resolveTimeout);
    }

    this.emit('alert-created', newAlert);
    return newAlert;
  }

  /**
   * Acquitte une alerte
   * @param {string} alertId - ID de l'alerte
   * @returns {boolean} Succès
   */
  acknowledge(alertId) {
    const alert = this.findAlert(alertId);
    if (!alert || alert.acknowledged) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();
    alert.updatedAt = Date.now();

    this.emit('alert-acknowledged', alert);
    return true;
  }

  /**
   * Résout une alerte
   * @param {string} alertId - ID de l'alerte
   * @param {string} reason - Raison de la résolution
   * @returns {boolean} Succès
   */
  resolve(alertId, reason = 'manual') {
    const alert = this.findAlert(alertId);
    if (!alert || alert.resolved) return false;

    alert.status = 'resolved';
    alert.resolved = true;
    alert.resolvedAt = Date.now();
    alert.resolvedReason = reason;
    alert.updatedAt = Date.now();

    // Retirer des actives
    const key = `${alert.type}-${alert.metric}`;
    this.activeAlerts.delete(key);
    
    // Ajouter aux résolues
    this.resolvedAlerts.push(alert);

    this.emit('alert-resolved', alert);
    return true;
  }

  /**
   * Résout toutes les alertes d'un type
   * @param {string} type - Type d'alerte
   * @param {string} reason - Raison
   * @returns {number} Nombre d'alertes résolues
   */
  resolveByType(type, reason = 'bulk-resolve') {
    let count = 0;
    
    this.activeAlerts.forEach((alert, key) => {
      if (alert.type === type) {
        this.resolve(alert.id, reason);
        count++;
      }
    });

    return count;
  }

  /**
   * Résout toutes les alertes
   * @param {string} reason - Raison
   * @returns {number} Nombre d'alertes résolues
   */
  resolveAll(reason = 'bulk-resolve') {
    let count = 0;
    
    this.activeAlerts.forEach((alert) => {
      this.resolve(alert.id, reason);
      count++;
    });

    return count;
  }

  /**
   * Supprime une alerte
   * @param {string} alertId - ID de l'alerte
   * @returns {boolean} Succès
   */
  delete(alertId) {
    const index = this.alerts.findIndex(a => a.id === alertId);
    if (index === -1) return false;

    const alert = this.alerts[index];
    this.alerts.splice(index, 1);

    if (!alert.resolved) {
      const key = `${alert.type}-${alert.metric}`;
      this.activeAlerts.delete(key);
    } else {
      const resolvedIndex = this.resolvedAlerts.findIndex(a => a.id === alertId);
      if (resolvedIndex !== -1) {
        this.resolvedAlerts.splice(resolvedIndex, 1);
      }
    }

    this.emit('alert-deleted', alert);
    return true;
  }

  /**
   * Trouve une alerte par ID
   * @param {string} alertId - ID de l'alerte
   * @returns {Object|null} Alerte
   */
  findAlert(alertId) {
    return this.alerts.find(a => a.id === alertId);
  }

  /**
   * Récupère les alertes actives
   * @returns {Array} Alertes actives
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Récupère les alertes non acquittées
   * @returns {Array} Alertes non acquittées
   */
  getUnacknowledgedAlerts() {
    return this.alerts.filter(a => !a.acknowledged && !a.resolved);
  }

  /**
   * Récupère les alertes par sévérité
   * @param {string} severity - Niveau de sévérité
   * @returns {Array} Alertes
   */
  getAlertsBySeverity(severity) {
    return this.alerts.filter(a => a.severity === severity && !a.resolved);
  }

  /**
   * Récupère les alertes récentes
   * @param {number} limit - Nombre d'alertes
   * @returns {Array} Alertes récentes
   */
  getRecentAlerts(limit = 50) {
    return [...this.alerts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Récupère les alertes d'une période
   * @param {number} start - Timestamp de début
   * @param {number} end - Timestamp de fin
   * @returns {Array} Alertes
   */
  getAlertsInPeriod(start, end = Date.now()) {
    return this.alerts.filter(a => 
      a.createdAt >= start && a.createdAt <= end
    );
  }

  /**
   * Obtient les statistiques des alertes
   * @returns {Object} Statistiques
   */
  getStats() {
    const active = this.getActiveAlerts();
    const bySeverity = {};

    Object.values(SEVERITY_LEVELS).forEach(level => {
      bySeverity[level] = active.filter(a => a.severity === level).length;
    });

    return {
      total: this.alerts.length,
      active: active.length,
      resolved: this.resolvedAlerts.length,
      unacknowledged: this.getUnacknowledgedAlerts().length,
      bySeverity,
      lastAlert: this.alerts[this.alerts.length - 1] || null
    };
  }

  /**
   * Nettoie les alertes résolues anciennes
   * @param {number} olderThan - Âge maximum en ms
   */
  cleanup(olderThan = 86400000) { // 24 heures
    const cutoff = Date.now() - olderThan;
    
    this.resolvedAlerts = this.resolvedAlerts.filter(a => 
      a.resolvedAt > cutoff
    );
    
    this.alerts = [
      ...this.getActiveAlerts(),
      ...this.resolvedAlerts
    ];
  }

  /**
   * Réinitialise toutes les alertes
   */
  clear() {
    this.alerts = [];
    this.activeAlerts.clear();
    this.resolvedAlerts = [];
    this.alertCount = 0;
    this.emit('alerts-cleared');
  }

  /**
   * Génère un rapport des alertes
   * @returns {Object} Rapport
   */
  generateReport() {
    const stats = this.getStats();
    const alertsByHour = this._groupByHour();

    return {
      summary: stats,
      timeline: alertsByHour,
      activeAlerts: this.getActiveAlerts().map(a => ({
        id: a.id,
        title: a.title,
        severity: a.severity,
        createdAt: new Date(a.createdAt).toISOString(),
        message: a.message
      })),
      resolvedAlerts: this.resolvedAlerts.slice(-10).map(a => ({
        title: a.title,
        resolvedAt: new Date(a.resolvedAt).toISOString(),
        reason: a.resolvedReason
      }))
    };
  }

  /**
   * Groupe les alertes par heure
   * @private
   * @returns {Object} Alertes par heure
   */
  _groupByHour() {
    const groups = {};
    const now = Date.now();

    for (let i = 0; i < 24; i++) {
      const hour = new Date(now - i * 3600000).toISOString().slice(0, 13);
      groups[hour] = 0;
    }

    this.alerts.forEach(alert => {
      const hour = new Date(alert.createdAt).toISOString().slice(0, 13);
      if (groups[hour] !== undefined) {
        groups[hour]++;
      }
    });

    return groups;
  }
}

export default AlertManager;
