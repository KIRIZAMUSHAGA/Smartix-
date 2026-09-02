/**
 * EventStore
 * Stockage et gestion des événements
 */

export class EventStore {
  /**
   * Crée une instance de EventStore
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      maxEvents: options.maxEvents || 1000,
      retention: options.retention || 3600000, // 1 heure
      ...options
    };

    this.events = [];
    this.indices = new Map(); // Index par type
    this.stats = {
      total: 0,
      byType: {},
      lastEvent: null
    };
  }

  /**
   * Ajoute un événement
   * @param {Object} event - Événement à ajouter
   */
  add(event) {
    // Ajouter l'événement
    this.events.push(event);

    // Mettre à jour l'index
    if (!this.indices.has(event.type)) {
      this.indices.set(event.type, []);
    }
    this.indices.get(event.type).push(event);

    // Mettre à jour les statistiques
    this.stats.total++;
    this.stats.byType[event.type] = (this.stats.byType[event.type] || 0) + 1;
    this.stats.lastEvent = event;

    // Nettoyer si nécessaire
    this._cleanup();
  }

  /**
   * Ajoute plusieurs événements
   * @param {Array} events - Événements à ajouter
   */
  addMany(events) {
    events.forEach(event => this.add(event));
  }

  /**
   * Récupère tous les événements
   * @returns {Array} Tous les événements
   */
  getAll() {
    return [...this.events];
  }

  /**
   * Récupère les événements récents
   * @param {number} limit - Nombre d'événements
   * @param {string} type - Type d'événement (optionnel)
   * @returns {Array} Événements récents
   */
  getRecent(limit = 100, type = null) {
    let events = type ? this.getByType(type) : this.events;
    return events.slice(-limit);
  }

  /**
   * Récupère les événements par type
   * @param {string} type - Type d'événement
   * @returns {Array} Événements du type
   */
  getByType(type) {
    return this.indices.get(type) || [];
  }

  /**
   * Récupère les événements d'une période
   * @param {number} start - Timestamp de début
   * @param {number} end - Timestamp de fin
   * @returns {Array} Événements
   */
  getInPeriod(start, end = Date.now()) {
    return this.events.filter(e => 
      e.timestamp >= start && e.timestamp <= end
    );
  }

  /**
   * Récupère les événements depuis un timestamp
   * @param {number} since - Timestamp
   * @returns {Array} Événements depuis
   */
  getSince(since) {
    return this.events.filter(e => e.timestamp > since);
  }

  /**
   * Nettoie les événements
   * @private
   */
  _cleanup() {
    // Nettoyer par nombre
    if (this.events.length > this.options.maxEvents) {
      const toRemove = this.events.length - this.options.maxEvents;
      const removed = this.events.splice(0, toRemove);
      
      // Mettre à jour les indices
      removed.forEach(event => {
        const typeEvents = this.indices.get(event.type);
        if (typeEvents) {
          const index = typeEvents.indexOf(event);
          if (index !== -1) typeEvents.splice(index, 1);
        }
        
        // Mettre à jour les stats
        this.stats.byType[event.type]--;
      });
    }

    // Nettoyer par âge
    const cutoff = Date.now() - this.options.retention;
    const toRemove = this.events.filter(e => e.timestamp < cutoff);
    
    toRemove.forEach(event => {
      const index = this.events.indexOf(event);
      if (index !== -1) {
        this.events.splice(index, 1);
        
        const typeEvents = this.indices.get(event.type);
        if (typeEvents) {
          const typeIndex = typeEvents.indexOf(event);
          if (typeIndex !== -1) typeEvents.splice(typeIndex, 1);
        }
        
        this.stats.byType[event.type]--;
        this.stats.total--;
      }
    });
  }

  /**
   * Nettoie manuellement
   * @param {number} cutoff - Timestamp limite
   */
  cleanup(cutoff) {
    const toRemove = this.events.filter(e => e.timestamp < cutoff);
    toRemove.forEach(event => {
      const index = this.events.indexOf(event);
      if (index !== -1) {
        this.events.splice(index, 1);
        
        const typeEvents = this.indices.get(event.type);
        if (typeEvents) {
          const typeIndex = typeEvents.indexOf(event);
          if (typeIndex !== -1) typeEvents.splice(typeIndex, 1);
        }
        
        this.stats.byType[event.type]--;
        this.stats.total--;
      }
    });
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      total: this.stats.total,
      byType: { ...this.stats.byType },
      lastEvent: this.stats.lastEvent,
      oldest: this.events[0]?.timestamp || null,
      newest: this.events[this.events.length - 1]?.timestamp || null
    };
  }

  /**
   * Recherche des événements
   * @param {Function} predicate - Fonction de filtrage
   * @returns {Array} Événements trouvés
   */
  search(predicate) {
    return this.events.filter(predicate);
  }

  /**
   * Vide le store
   */
  clear() {
    this.events = [];
    this.indices.clear();
    this.stats = {
      total: 0,
      byType: {},
      lastEvent: null
    };
  }

  /**
   * Vérifie si le store est vide
   * @returns {boolean} true si vide
   */
  isEmpty() {
    return this.events.length === 0;
  }

  /**
   * Taille du store
   * @returns {number} Nombre d'événements
   */
  size() {
    return this.events.length;
  }
}

export default EventStore;
