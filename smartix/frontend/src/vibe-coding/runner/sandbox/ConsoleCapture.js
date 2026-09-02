/**
 * ConsoleCapture
 * Capture et formate les messages de console du sandbox
 */

export class ConsoleCapture {
  /**
   * Crée une instance de ConsoleCapture
   * @param {SandboxedRunner} runner - Instance du runner parent
   */
  constructor(runner) {
    this.runner = runner;
    this.history = [];
    this.maxHistory = 1000;
    this.filters = [];
  }

  /**
   * Gère un message de console
   * @param {Object} data - Données du message
   */
  handle({ method, args }) {
    // Formater les arguments
    const formattedArgs = args.map(arg => this._formatArgument(arg));
    const message = formattedArgs.join(' ');

    // Créer l'entrée de log
    const logEntry = {
      method,
      message,
      args: formattedArgs,
      timestamp: Date.now(),
      raw: args
    };

    // Ajouter à l'historique
    this.history.push(logEntry);
    
    // Limiter la taille de l'historique
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Appliquer les filtres
    if (this._shouldLog(logEntry)) {
      // Émettre l'événement
      this.runner.emit('console', {
        method,
        args: formattedArgs,
        timestamp: logEntry.timestamp
      });

      // Émettre également un événement spécifique par méthode
      this.runner.emit(`console:${method}`, {
        args: formattedArgs,
        timestamp: logEntry.timestamp
      });
    }
  }

  /**
   * Formate un argument pour l'affichage
   * @private
   * @param {any} arg - Argument à formater
   * @returns {string} Argument formaté
   */
  _formatArgument(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    
    if (typeof arg === 'object') {
      try {
        if (arg.message && arg.stack) {
          // C'est une erreur
          return `${arg.name || 'Error'}: ${arg.message}`;
        }
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'function') return `function ${arg.name || 'anonymous'}()`;
    
    return String(arg);
  }

  /**
   * Vérifie si un log doit être affiché selon les filtres
   * @private
   * @param {Object} logEntry - Entrée de log
   * @returns {boolean} true si doit être loggé
   */
  _shouldLog(logEntry) {
    if (this.filters.length === 0) return true;
    
    return this.filters.some(filter => {
      if (typeof filter === 'string') {
        return logEntry.method === filter;
      }
      if (filter instanceof RegExp) {
        return filter.test(logEntry.message);
      }
      if (typeof filter === 'function') {
        return filter(logEntry);
      }
      return true;
    });
  }

  /**
   * Ajoute un filtre
   * @param {string|RegExp|Function} filter - Filtre à ajouter
   */
  addFilter(filter) {
    this.filters.push(filter);
  }

  /**
   * Supprime tous les filtres
   */
  clearFilters() {
    this.filters = [];
  }

  /**
   * Récupère l'historique des logs
   * @param {number} limit - Nombre de logs à récupérer
   * @param {string} method - Filtrer par méthode (optionnel)
   * @returns {Array} Historique des logs
   */
  getHistory(limit = 100, method = null) {
    let filtered = this.history;
    
    if (method) {
      filtered = filtered.filter(log => log.method === method);
    }
    
    return filtered.slice(-limit);
  }

  /**
   * Nettoie l'historique
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Obtient des statistiques sur les logs
   * @returns {Object} Statistiques
   */
  getStats() {
    const stats = {
      total: this.history.length,
      byMethod: {},
      lastLog: this.history[this.history.length - 1]
    };

    this.history.forEach(log => {
      stats.byMethod[log.method] = (stats.byMethod[log.method] || 0) + 1;
    });

    return stats;
  }

  /**
   * Exporte l'historique au format JSON
   * @returns {string} JSON de l'historique
   */
  exportHistory() {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Importe un historique depuis JSON
   * @param {string} json - JSON à importer
   */
  importHistory(json) {
    try {
      const history = JSON.parse(json);
      if (Array.isArray(history)) {
        this.history = history;
      }
    } catch (error) {
      console.error('Erreur import historique:', error);
    }
  }
}

export default ConsoleCapture;
