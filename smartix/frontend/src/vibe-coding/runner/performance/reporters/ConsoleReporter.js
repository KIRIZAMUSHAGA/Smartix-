/**
 * ConsoleReporter
 * Affiche les métriques de performance dans la console
 */

export class ConsoleReporter {
  /**
   * Crée une instance de ConsoleReporter
   * @param {PerformanceMonitor} monitor - Instance du moniteur
   * @param {Object} options - Options de configuration
   */
  constructor(monitor, options = {}) {
    this.monitor = monitor;
    this.options = {
      interval: options.interval || 5000,
      detailed: options.detailed || false,
      colors: options.colors !== false,
      ...options
    };

    this.intervalId = null;
    this._setupListeners();
  }

  /**
   * Configure les écouteurs
   * @private
   */
  _setupListeners() {
    this.monitor.on('warning', (warning) => {
      this._reportWarning(warning);
    });

    this.monitor.on('metrics-update', (metrics) => {
      if (this.options.detailed) {
        this._reportMetrics(metrics);
      }
    });
  }

  /**
   * Démarre le reporting périodique
   */
  start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this._reportSummary();
    }, this.options.interval);

    console.log(
      this._color('[📊] Performance reporting started', 'green')
    );
  }

  /**
   * Arrête le reporting
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Affiche un résumé des performances
   * @private
   */
  _reportSummary() {
    const metrics = this.monitor.getCurrentMetrics();
    const report = this.monitor.getReport();

    console.log('\n' + this._color('📊 PERFORMANCE REPORT', 'cyan'));
    console.log(this._color('─'.repeat(50), 'gray'));

    // FPS
    if (metrics.fps) {
      const fpsColor = metrics.fps.value < 30 ? 'red' : 'green';
      console.log(
        this._color('FPS:', 'yellow'),
        this._color(metrics.fps.value, fpsColor),
        this._color(`(avg: ${Math.round(report.stats.fps?.avg || 0)})`, 'gray')
      );
    }

    // Mémoire
    if (metrics.memory) {
      const memColor = metrics.memory.percentage > 80 ? 'red' : 
                       metrics.memory.percentage > 60 ? 'yellow' : 'green';
      console.log(
        this._color('Memory:', 'yellow'),
        this._color(`${Math.round(metrics.memory.percentage)}%`, memColor),
        this._color(`(${this._formatBytes(metrics.memory.used)})`, 'gray')
      );
    }

    // Réseau
    if (report.stats.network) {
      const stats = report.stats.network;
      console.log(
        this._color('Network:', 'yellow'),
        this._color(`${stats.totalRequests} req`, 'blue'),
        this._color(`| ${this._formatBytes(stats.totalSize)}`, 'blue'),
        this._color(`| ${Math.round(stats.avgLatency)}ms avg`, 'blue')
      );
    }

    // Avertissements
    if (report.warnings.length > 0) {
      console.log(
        this._color(`Warnings: ${report.warnings.length}`, 'yellow')
      );
    }
  }

  /**
   * Affiche des métriques détaillées
   * @private
   * @param {Object} metrics - Métriques à afficher
   */
  _reportMetrics(metrics) {
    if (metrics.fps) {
      console.log(
        this._color(`[FPS]`, 'cyan'),
        metrics.fps.value,
        this._color(`(${metrics.fps.frameCount} frames)`, 'gray')
      );
    }

    if (metrics.memory) {
      console.log(
        this._color(`[MEM]`, 'cyan'),
        `${Math.round(metrics.memory.percentage)}%`,
        this._color(`(${this._formatBytes(metrics.memory.used)})`, 'gray')
      );
    }

    metrics.network.forEach(req => {
      const color = req.duration > 1000 ? 'red' : 
                    req.duration > 500 ? 'yellow' : 'green';
      console.log(
        this._color(`[NET]`, 'cyan'),
        this._color(`${req.type} ${req.name.split('/').pop()}`, color),
        this._color(`${Math.round(req.duration)}ms`, 'gray'),
        this._color(`[${req.cache}]`, 'magenta')
      );
    });
  }

  /**
   * Affiche un avertissement
   * @private
   * @param {Object} warning - Avertissement à afficher
   */
  _reportWarning(warning) {
    const messages = {
      fps: `⚠️ Faible FPS: ${warning.value} (seuil: ${warning.threshold})`,
      memory: `⚠️ Mémoire élevée: ${Math.round(warning.value)}%`,
      'slow-request': `⚠️ Requête lente: ${warning.url} (${Math.round(warning.duration)}ms)`
    };

    const message = messages[warning.type] || `⚠️ ${warning.message || 'Avertissement'}`;
    console.log(this._color(message, 'yellow'));
  }

  /**
   * Formate les bytes en taille lisible
   * @private
   * @param {number} bytes - Taille en bytes
   * @returns {string} Taille formatée
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Colorie un texte pour la console
   * @private
   * @param {string} text - Texte à colorier
   * @param {string} color - Nom de la couleur
   * @returns {string} Texte coloré
   */
  _color(text, color) {
    if (!this.options.colors) return text;

    const colors = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      reset: '\x1b[0m'
    };

    return colors[color] + text + colors.reset;
  }
}

export default ConsoleReporter;
