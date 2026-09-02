/**
 * PreviewServer - Contrôleur principal avec toutes les améliorations
 * - Restart robuste
 * - Verrouillage démarrage
 * - Flux build → reload
 * - Nettoyage sur erreur
 * - HealthCheck
 * - ProcessManager
 * - Debounce builds
 * - Metrics
 */

import EventEmitter from 'events';
import DevServer from './DevServer';
import FileWatcher from './FileWatcher';
import BuildManager from './BuildManager';
import WebSocketManager from './WebSocketManager';
import Logger from './Logger';
import PortManager from './PortManager';
import ProjectLoader from './ProjectLoader';
import ProcessManager from './ProcessManager';
import HealthCheck from './HealthCheck';
import MetricsCollector from './MetricsCollector';

export default class PreviewServer extends EventEmitter {
  constructor(projectId, options = {}) {
    super();
    
    this.projectId = projectId;
    this.options = options;
    this.state = 'stopped';
    this.startLock = false;
    this.stopRequested = false;
    
    // Modules
    this.logger = new Logger(`preview:${projectId}`);
    this.metrics = new MetricsCollector(projectId);
    this.portManager = new PortManager();
    this.projectLoader = new ProjectLoader(projectId);
    this.devServer = new DevServer();
    this.fileWatcher = new FileWatcher();
    this.buildManager = new BuildManager(projectId);
    this.wsManager = new WebSocketManager();
    this.processManager = new ProcessManager();
    this.healthCheck = new HealthCheck();
    
    this._setupListeners();
  }

  _setupListeners() {
    // FileWatcher → Build (avec debounce)
    this.fileWatcher.on('change', async (file) => {
      this.logger.info(`📝 Fichier modifié: ${file}`);
      this.emit('fileChange', file);
      this.metrics.recordFileChange();
      
      // Build avec debounce (attend que les changements se stabilisent)
      await this.buildManager.queueBuild(file, { debounce: 200 });
    });

    // Build complet → Reload client
    this.buildManager.on('build-complete', async (result) => {
      this.logger.success(`✅ Build terminé en ${result.duration}ms`);
      this.emit('buildComplete', result);
      this.metrics.recordBuild(result.duration);
      
      // Envoyer reload via WebSocket
      this.wsManager.broadcast({
        type: 'reload',
        file: result.job?.file,
        duration: result.duration,
        timestamp: Date.now()
      });
    });

    this.buildManager.on('build-start', () => {
      this.emit('buildStart');
    });

    this.buildManager.on('build-error', (error) => {
      this.logger.error(`❌ Build échoué: ${error.message}`);
      this.emit('buildError', error);
      this.metrics.recordError();
      
      this.wsManager.broadcast({
        type: 'build-error',
        error: error.message,
        timestamp: Date.now()
      });
    });

    // WebSocket events
    this.wsManager.on('connection', (ws) => {
      this.logger.info(`🔌 Client WebSocket connecté (${this.wsManager.getClientCount()} total)`);
      this.emit('wsConnection', ws);
      
      // Envoyer l'état initial
      ws.send(JSON.stringify({
        type: 'connected',
        projectId: this.projectId,
        state: this.state,
        metrics: this.metrics.getSummary()
      }));
    });

    this.wsManager.on('disconnection', () => {
      this.logger.info(`🔌 Client WebSocket déconnecté (${this.wsManager.getClientCount()} restants)`);
    });

    this.wsManager.on('message', (data, ws) => {
      this.logger.info(`📨 Message WebSocket: ${data.type}`);
      this.emit('wsMessage', data, ws);
    });

    // HealthCheck events
    this.healthCheck.on('unhealthy', (reason) => {
      this.logger.warn(`⚠️ Serveur malsain: ${reason}`);
      this.emit('unhealthy', reason);
    });

    this.healthCheck.on('healthy', () => {
      this.logger.info('✅ Serveur sain');
      this.emit('healthy');
    });
  }

  /**
   * Démarre le serveur avec verrouillage
   */
  async start() {
    // Verrouillage pour éviter les démarrages concurrents
    if (this.startLock) {
      this.logger.warn('Démarrage déjà en cours, ignoré');
      return { success: false, reason: 'already_starting' };
    }

    if (this.state === 'running') {
      this.logger.warn('Serveur déjà en cours d\'exécution');
      return { success: false, reason: 'already_running' };
    }

    this.startLock = true;
    this.stopRequested = false;

    try {
      this.state = 'starting';
      this.emit('starting');
      this.logger.info('🚀 Démarrage du preview server...');

      // Métriques
      this.metrics.startTimer('startup');

      // 1. Trouver un port disponible
      const port = await this.portManager.findPort(this.options.port || 3000);
      this.logger.info(`🔌 Port sélectionné: ${port}`);
      
      // 2. Charger le projet
      const project = await this.projectLoader.load();
      this.logger.info(`📂 Projet chargé: ${project.files ? Object.keys(project.files).length : 0} fichiers`);
      
      // 3. Démarrer le serveur de développement
      await this.devServer.start(project, { port });
      this.logger.success(`🌐 Serveur démarré sur ${this.devServer.url}`);
      
      // 4. Démarrer la surveillance des fichiers
      await this.fileWatcher.watch(project.path);
      this.logger.info(`👀 Surveillance fichiers activée`);
      
      // 5. Démarrer le WebSocket
      const wsPort = await this.portManager.findPort(port + 1);
      await this.wsManager.start(wsPort);
      this.logger.info(`🔌 WebSocket démarré sur le port ${wsPort}`);
      
      // 6. Démarrer le health check
      await this.healthCheck.start({
        url: this.devServer.url,
        interval: 5000,
        timeout: 2000
      });

      // 7. Démarrer le process manager si nécessaire
      if (this.options.runScript) {
        await this.processManager.start(this.options.runScript);
      }

      // Métriques
      const startupTime = this.metrics.stopTimer('startup');
      this.metrics.recordStartup();

      this.state = 'running';
      this.emit('started', { 
        port, 
        wsPort, 
        url: this.devServer.url,
        startupTime 
      });
      
      this.logger.success(`✅ Serveur prêt en ${startupTime}ms`);

      // Broadcast via WebSocket
      this.wsManager.broadcast({
        type: 'server-started',
        url: this.devServer.url,
        timestamp: Date.now()
      });

      return {
        success: true,
        url: this.devServer.url,
        port,
        wsPort,
        startupTime
      };
      
    } catch (error) {
      this.logger.error(`❌ Échec démarrage: ${error.message}`);
      this.emit('error', error);
      this.metrics.recordError();
      
      // Nettoyage partiel en cas d'erreur
      await this._partialCleanup();
      
      this.state = 'error';
      throw error;
      
    } finally {
      this.startLock = false;
    }
  }

  /**
   * Arrête le serveur
   */
  async stop() {
    if (this.state === 'stopped') {
      return { success: true };
    }

    this.stopRequested = true;

    try {
      this.logger.info('🛑 Arrêt du serveur...');
      this.emit('stopping');
      
      // Métriques
      this.metrics.startTimer('shutdown');

      // Arrêter tous les modules en parallèle
      await Promise.allSettled([
        this.healthCheck.stop(),
        this.wsManager.stop(),
        this.fileWatcher.unwatch(),
        this.devServer.stop(),
        this.processManager.stopAll(),
        this.portManager.releaseAll()
      ]);

      const shutdownTime = this.metrics.stopTimer('shutdown');
      
      this.state = 'stopped';
      this.emit('stopped');
      this.logger.success(`✅ Serveur arrêté en ${shutdownTime}ms`);

      return { success: true, shutdownTime };
      
    } catch (error) {
      this.logger.error(`❌ Erreur arrêt: ${error.message}`);
      throw error;
    }
  }

  /**
   * Redémarrage robuste
   */
  async restart() {
    this.logger.info('🔄 Redémarrage du serveur...');
    
    try {
      // Tentative d'arrêt avec gestion d'erreur
      await this.stop();
    } catch (error) {
      this.logger.warn(`⚠️ Erreur pendant l'arrêt: ${error.message}, redémarrage forcé`);
    }

    // Redémarrer
    return this.start();
  }

  /**
   * Build l'application
   */
  async build() {
    if (this.state !== 'running') {
      throw new Error('Le serveur doit être démarré pour build');
    }

    return this.buildManager.build();
  }

  /**
   * Nettoyage partiel en cas d'erreur de démarrage
   */
  async _partialCleanup() {
    const cleanupTasks = [];

    if (this.devServer.isRunning) {
      cleanupTasks.push(this.devServer.stop().catch(() => {}));
    }

    if (this.fileWatcher.isWatching) {
      cleanupTasks.push(this.fileWatcher.unwatch().catch(() => {}));
    }

    if (this.wsManager.isRunning) {
      cleanupTasks.push(this.wsManager.stop().catch(() => {}));
    }

    if (this.healthCheck.isRunning) {
      cleanupTasks.push(this.healthCheck.stop().catch(() => {}));
    }

    await Promise.allSettled(cleanupTasks);
  }

  /**
   * Récupère l'état complet du serveur
   */
  getState() {
    return {
      state: this.state,
      projectId: this.projectId,
      url: this.devServer?.url,
      port: this.devServer?.port,
      wsPort: this.wsManager?.port,
      wsClients: this.wsManager?.getClientCount() || 0,
      buildQueue: this.buildManager?.queueLength || 0,
      isWatching: this.fileWatcher?.isWatching || false,
      isHealthy: this.healthCheck?.isHealthy || false,
      uptime: this.metrics?.getUptime() || 0,
      metrics: this.metrics?.getSummary() || {}
    };
  }

  /**
   * Récupère les logs
   */
  getLogs(limit = 100) {
    return this.logger.getLogs(limit);
  }

  /**
   * Nettoie toutes les ressources
   */
  async destroy() {
    this.logger.info('🧹 Nettoyage des ressources...');
    
    await this.stop();
    
    this.removeAllListeners();
    this.metrics.reset();
    this.logger.clear();
    
    this.logger.success('🧹 Nettoyage terminé');
  }
      }
