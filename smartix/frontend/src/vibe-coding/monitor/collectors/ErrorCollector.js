/**
 * ErrorCollector
 * Collecte et groupe les erreurs d'exécution
 */

import EventEmitter from 'events';

export class ErrorCollector extends EventEmitter {
  /**
   * Crée une instance de ErrorCollector
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      maxGroups: options.maxGroups || 100,
      groupSimilar: options.groupSimilar !== false,
      captureConsole: options.captureConsole !== false,
      captureUnhandled: options.captureUnhandled !== false,
      ...options
    };

    this.running = false;
    this.errors = [];
    this.errorGroups = new Map();
    this.maxErrors = 1000;
    
    // Statistiques
    this.stats = {
      total: 0,
      grouped: 0,
      lastError: null,
      lastHour: 0
    };

    this._setupGlobalHandlers();
  }

  /**
   * Configure les gestionnaires globaux d'erreurs
   * @private
   */
  _setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Capturer les erreurs globales
    if (this.options.captureUnhandled) {
      window.addEventListener('error', (event) => {
        this.captureError(event.error, {
          type: 'uncaught',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.captureError(event.reason, {
          type: 'unhandled-rejection'
        });
      });
    }

    // Capturer les erreurs console
    if (this.options.captureConsole) {
      this._captureConsoleErrors();
    }
  }

  /**
   * Capture les erreurs console.error
   * @private
   */
  _captureConsoleErrors() {
    const originalConsoleError = console.error;
    
    console.error = (...args) => {
      // Appeler l'original
      originalConsoleError.apply(console, args);

      // Capturer l'erreur
      const error = args.find(arg => arg instanceof Error) || 
                    new Error(args.map(String).join(' '));
      
      this.captureError(error, {
        type: 'console',
        args: args.map(String)
      });
    };
  }

  /**
   * Démarre le collecteur
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.emit('started');
  }

  /**
   * Arrête le collecteur
   */
  stop() {
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Capture une erreur
   * @param {Error|string} error - Erreur à capturer
   * @param {Object} context - Contexte supplémentaire
   * @returns {Object} Erreur capturée
   */
  captureError(error, context = {}) {
    const message = error?.message || String(error);
    const stack = error?.stack || null;
    const name = error?.name || 'Error';

    // Générer une signature pour le groupement
    const signature = this._generateSignature(message, stack);

    // Grouper les erreurs similaires
    if (this.options.groupSimilar) {
      return this._addToGroup(signature, {
        message,
        stack,
        name,
        context,
        timestamp: Date.now()
      });
    }

    // Ajouter individuellement
    const errorEntry = {
      id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      signature,
      message,
      stack,
      name,
      context,
      timestamp: Date.now(),
      count: 1
    };

    this.errors.push(errorEntry);
    this.stats.total++;

    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.emit('error', errorEntry);

    return errorEntry;
  }

  /**
   * Ajoute une erreur à un groupe
   * @private
   * @param {string} signature - Signature de l'erreur
   * @param {Object} error - Erreur à ajouter
   * @returns {Object} Groupe mis à jour
   */
  _addToGroup(signature, error) {
    if (!this.errorGroups.has(signature)) {
      this.errorGroups.set(signature, {
        signature,
        message: error.message,
        name: error.name,
        stack: error.stack,
        count: 0,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        samples: []
      });
    }

    const group = this.errorGroups.get(signature);
    group.count++;
    group.lastSeen = error.timestamp;

    // Garder un échantillon des stacks
    if (group.samples.length < 5 && error.stack) {
      group.samples.push({
        stack: error.stack,
        timestamp: error.timestamp,
        context: error.context
      });
    }

    this.stats.total++;
    this.stats.grouped++;

    // Nettoyer les vieux groupes si nécessaire
    if (this.errorGroups.size > this.options.maxGroups) {
      this._cleanupOldGroups();
    }

    this.emit('error-grouped', { signature, group });

    return group;
  }

  /**
   * Génère une signature pour le groupement
   * @private
   * @param {string} message - Message d'erreur
   * @param {string} stack - Stack trace
   * @returns {string} Signature
   */
  _generateSignature(message, stack) {
    // Nettoyer le message des nombres variables
    const cleanMessage = message.replace(/\d+/g, '0');
    
    // Prendre les premières lignes de la stack
    const stackLines = stack?.split('\n').slice(0, 3).join('\n') || '';
    
    return `${cleanMessage}|${stackLines}`;
  }

  /**
   * Nettoie les vieux groupes
   * @private
   */
  _cleanupOldGroups() {
    const groups = Array.from(this.errorGroups.entries());
    
    // Trier par dernière apparition (plus vieux d'abord)
    groups.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    
    // Supprimer les 20% les plus vieux
    const toRemove = Math.floor(groups.length * 0.2);
    groups.slice(0, toRemove).forEach(([signature]) => {
      this.errorGroups.delete(signature);
    });
  }

  /**
   * Récupère les erreurs récentes
   * @param {number} limit - Nombre d'erreurs
   * @returns {Array} Erreurs récentes
   */
  getRecentErrors(limit = 100) {
    return this.errors.slice(-limit);
  }

  /**
   * Récupère les groupes d'erreurs
   * @param {number} minCount - Nombre minimum d'occurrences
   * @returns {Array} Groupes d'erreurs
   */
  getErrorGroups(minCount = 1) {
    const groups = Array.from(this.errorGroups.values());
    return groups.filter(g => g.count >= minCount)
                .sort((a, b) => b.count - a.count);
  }

  /**
   * Récupère les erreurs d'une période
   * @param {number} duration - Durée en ms
   * @returns {Array} Erreurs
   */
  getErrorsInPeriod(duration = 3600000) { // 1 heure
    const cutoff = Date.now() - duration;
    return this.errors.filter(e => e.timestamp > cutoff);
  }

  /**
   * Calcule le taux d'erreur
   * @param {number} duration - Durée en ms
   * @returns {number} Taux d'erreur par minute
   */
  getErrorRate(duration = 60000) { // 1 minute
    const errors = this.getErrorsInPeriod(duration);
    return (errors.length / (duration / 60000)).toFixed(2);
  }

  /**
   * Réinitialise le collecteur
   */
  clear() {
    this.errors = [];
    this.errorGroups.clear();
    this.stats = {
      total: 0,
      grouped: 0,
      lastError: null,
      lastHour: 0
    };
    this.emit('cleared');
  }

  /**
   * Obtient les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    const lastHour = this.getErrorsInPeriod(3600000).length;

    return {
      running: this.running,
      total: this.stats.total,
      grouped: this.errorGroups.size,
      lastHour,
      rate: this.getErrorRate(),
      topErrors: this.getErrorGroups(5).slice(0, 5).map(g => ({
        message: g.message.substring(0, 50),
        count: g.count,
        firstSeen: new Date(g.firstSeen).toLocaleString()
      }))
    };
  }

  /**
   * Génère un rapport d'erreurs
   * @returns {Object} Rapport
   */
  generateReport() {
    const groups = this.getErrorGroups();
    
    return {
      summary: {
        total: this.stats.total,
        unique: groups.length,
        rate: this.getErrorRate(),
        lastHour: this.getErrorsInPeriod(3600000).length
      },
      groups: groups.map(g => ({
        message: g.message,
        count: g.count,
        firstSeen: new Date(g.firstSeen).toISOString(),
        lastSeen: new Date(g.lastSeen).toISOString(),
        samples: g.samples
      })),
      timeline: this._generateTimeline()
    };
  }

  /**
   * Génère une timeline des erreurs
   * @private
   * @returns {Array} Timeline
   */
  _generateTimeline() {
    const now = Date.now();
    const timeline = [];
    
    for (let i = 0; i < 60; i++) {
      const start = now - (i + 1) * 60000;
      const end = now - i * 60000;
      
      const count = this.errors.filter(e => 
        e.timestamp >= start && e.timestamp < end
      ).length;
      
      timeline.unshift({
        time: new Date(end).toISOString(),
        count
      });
    }
    
    return timeline;
  }
}

export default ErrorCollector;
