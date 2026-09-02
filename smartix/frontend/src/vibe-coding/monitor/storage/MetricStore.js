/**
 * MetricStore
 * Stockage et agrégation des métriques
 */

export class MetricStore {
  /**
   * Crée une instance de MetricStore
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    this.options = {
      maxSamples: options.maxSamples || 1000,
      retention: options.retention || 86400000, // 24 heures
      aggregationInterval: options.aggregationInterval || 60000, // 1 minute
      ...options
    };

    this.metrics = new Map(); // nom -> array de samples
    this.aggregates = new Map(); // nom -> agrégats par intervalle
    this.stats = new Map(); // statistiques par métrique
  }

  /**
   * Ajoute une métrique
   * @param {string} name - Nom de la métrique
   * @param {Object} sample - Échantillon
   */
  add(name, sample) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
      this.aggregates.set(name, new Map());
      this.stats.set(name, {
        min: Infinity,
        max: -Infinity,
        sum: 0,
        count: 0
      });
    }

    const samples = this.metrics.get(name);
    samples.push(sample);

    // Mettre à jour les statistiques
    const stats = this.stats.get(name);
    stats.min = Math.min(stats.min, sample.value);
    stats.max = Math.max(stats.max, sample.value);
    stats.sum += sample.value;
    stats.count++;

    // Agréger par intervalle
    this._aggregate(name, sample);

    // Nettoyer
    this._cleanup(name);
  }

  /**
   * Agrège une métrique par intervalle
   * @private
   * @param {string} name - Nom de la métrique
   * @param {Object} sample - Échantillon
   */
  _aggregate(name, sample) {
    const interval = Math.floor(sample.timestamp / this.options.aggregationInterval);
    const aggregates = this.aggregates.get(name);

    if (!aggregates.has(interval)) {
      aggregates.set(interval, {
        interval,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        first: sample.timestamp,
        last: sample.timestamp
      });
    }

    const agg = aggregates.get(interval);
    agg.count++;
    agg.sum += sample.value;
    agg.min = Math.min(agg.min, sample.value);
    agg.max = Math.max(agg.max, sample.value);
    agg.last = sample.timestamp;
  }

  /**
   * Nettoie les anciennes métriques
   * @private
   * @param {string} name - Nom de la métrique
   */
  _cleanup(name) {
    const samples = this.metrics.get(name);
    const cutoff = Date.now() - this.options.retention;

    // Nettoyer par âge
    while (samples.length > 0 && samples[0].timestamp < cutoff) {
      samples.shift();
    }

    // Nettoyer par nombre
    if (samples.length > this.options.maxSamples) {
      const toRemove = samples.length - this.options.maxSamples;
      samples.splice(0, toRemove);
    }

    // Nettoyer les agrégats
    const aggregates = this.aggregates.get(name);
    const oldestInterval = Math.floor(cutoff / this.options.aggregationInterval);
    
    aggregates.forEach((_, interval) => {
      if (interval < oldestInterval) {
        aggregates.delete(interval);
      }
    });
  }

  /**
   * Récupère les métriques d'un nom
   * @param {string} name - Nom de la métrique
   * @returns {Array} Échantillons
   */
  get(name) {
    return this.metrics.get(name) || [];
  }

  /**
   * Récupère toutes les métriques
   * @returns {Object} Toutes les métriques
   */
  getAll() {
    const result = {};
    this.metrics.forEach((samples, name) => {
      result[name] = [...samples];
    });
    return result;
  }

  /**
   * Récupère l'historique complet
   * @returns {Object} Historique
   */
  getHistory() {
    return this.getAll();
  }

  /**
   * Récupère la dernière valeur d'une métrique
   * @param {string} name - Nom de la métrique
   * @returns {Object|null} Dernier échantillon
   */
  getLast(name) {
    const samples = this.metrics.get(name);
    return samples?.length ? samples[samples.length - 1] : null;
  }

  /**
   * Récupère les métriques sur une période
   * @param {string} name - Nom de la métrique
   * @param {number} start - Timestamp de début
   * @param {number} end - Timestamp de fin
   * @returns {Array} Échantillons
   */
  getInPeriod(name, start, end = Date.now()) {
    const samples = this.metrics.get(name) || [];
    return samples.filter(s => s.timestamp >= start && s.timestamp <= end);
  }

  /**
   * Récupère les agrégats d'une métrique
   * @param {string} name - Nom de la métrique
   * @returns {Array} Agrégats
   */
  getAggregates(name) {
    const aggregates = this.aggregates.get(name);
    if (!aggregates) return [];

    return Array.from(aggregates.values())
      .sort((a, b) => a.interval - b.interval);
  }

  /**
   * Récupère les statistiques d'une métrique
   * @param {string} name - Nom de la métrique
   * @returns {Object} Statistiques
   */
  getStats(name) {
    const stats = this.stats.get(name);
    const last = this.getLast(name);

    if (!stats) return null;

    return {
      ...stats,
      avg: stats.count > 0 ? stats.sum / stats.count : 0,
      current: last?.value || 0,
      lastUpdate: last?.timestamp || null
    };
  }

  /**
   * Récupère toutes les statistiques
   * @returns {Object} Statistiques par métrique
   */
  getAllStats() {
    const result = {};
    this.stats.forEach((stats, name) => {
      result[name] = this.getStats(name);
    });
    return result;
  }

  /**
   * Calcule la moyenne sur une période
   * @param {string} name - Nom de la métrique
   * @param {number} duration - Durée en ms
   * @returns {number} Moyenne
   */
  getAverage(name, duration = 60000) {
    const cutoff = Date.now() - duration;
    const samples = this.getInPeriod(name, cutoff);
    
    if (samples.length === 0) return 0;
    
    const sum = samples.reduce((acc, s) => acc + s.value, 0);
    return sum / samples.length;
  }

  /**
   * Calcule le minimum sur une période
   * @param {string} name - Nom de la métrique
   * @param {number} duration - Durée en ms
   * @returns {number} Minimum
   */
  getMin(name, duration = 60000) {
    const cutoff = Date.now() - duration;
    const samples = this.getInPeriod(name, cutoff);
    
    if (samples.length === 0) return 0;
    
    return Math.min(...samples.map(s => s.value));
  }

  /**
   * Calcule le maximum sur une période
   * @param {string} name - Nom de la métrique
   * @param {number} duration - Durée en ms
   * @returns {number} Maximum
   */
  getMax(name, duration = 60000) {
    const cutoff = Date.now() - duration;
    const samples = this.getInPeriod(name, cutoff);
    
    if (samples.length === 0) return 0;
    
    return Math.max(...samples.map(s => s.value));
  }

  /**
   * Calcule la tendance
   * @param {string} name - Nom de la métrique
   * @param {number} duration - Durée en ms
   * @returns {Object} Tendance
   */
  getTrend(name, duration = 300000) {
    const samples = this.getInPeriod(name, Date.now() - duration);
    
    if (samples.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const first = samples[0].value;
    const last = samples[samples.length - 1].value;
    const change = last - first;
    const percentChange = (change / first) * 100;

    let direction = 'stable';
    if (Math.abs(percentChange) > 5) {
      direction = percentChange > 0 ? 'up' : 'down';
    }

    return {
      direction,
      change,
      percentChange,
      first,
      last
    };
  }

  /**
   * Vide le store
   */
  clear() {
    this.metrics.clear();
    this.aggregates.clear();
    this.stats.clear();
  }

  /**
   * Vérifie si une métrique existe
   * @param {string} name - Nom de la métrique
   * @returns {boolean} true si existe
   */
  has(name) {
    return this.metrics.has(name);
  }

  /**
   * Liste les noms des métriques
   * @returns {Array} Noms des métriques
   */
  getMetricNames() {
    return Array.from(this.metrics.keys());
  }

  /**
   * Taille totale du store
   * @returns {number} Nombre total d'échantillons
   */
  size() {
    let total = 0;
    this.metrics.forEach(samples => {
      total += samples.length;
    });
    return total;
  }
}

export default MetricStore;
