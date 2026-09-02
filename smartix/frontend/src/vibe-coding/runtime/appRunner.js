/**
 * Classe principale AppRunner
 * Orchestre tous les sous-systèmes pour l'exécution des applications
 */

import EventEmitter from 'events';
import { PROJECT_TYPES, DEFAULT_PORTS, I18N, DEFAULTS } from '../runner/core/constants';
import { RUNNER_EVENTS, PROCESS_STATES, BUILD_STATES } from '../runner/core/events';
import { SandboxedRunner } from '../runner/sandbox/SandboxedRunner';
import { DependencyInstaller } from '../runner/dependencies/DependencyInstaller';
import { HotReloader } from '../runner/hotreload/HotReloader';
import { PerformanceMonitor } from '../runner/performance/PerformanceMonitor';
import { ErrorCapture } from '../runner/errors/ErrorCapture';
import { EnvironmentManager } from '../runner/environment/EnvironmentManager';
import { projectManager } from '../core/projectManager';
import { fileManager } from '../editor/fileManager';

export class AppRunner extends EventEmitter {
  /**
   * Crée une instance d'AppRunner
   * @param {Object} options - Options de configuration
   * @param {string} options.language - Langue pour les messages (fr/en)
   * @param {number} options.maxLogs - Nombre maximum de logs à conserver
   */
  constructor(options = {}) {
    super();
    
    // Configuration
    this.language = options.language || 'fr';
    this.maxLogs = options.maxLogs || DEFAULTS.MAX_LOGS;
    
    // État interne
    this.initialized = false;
    this.currentProject = null;
    this.currentUserId = null;
    this.processes = new Map();
    this.builds = new Map();
    this.logs = [];
    this.serverUrls = new Map();
    
    // Initialiser les sous-systèmes
    this._initializeSubsystems();
    
    // Configurer les écouteurs internes
    this._setupInternalListeners();
  }

  /**
   * Valide qu'un objet respecte un contrat de méthodes requises.
   * Lève une erreur explicite au démarrage si le contrat est rompu.
   * @private
   * @param {Object} instance - L'objet à valider
   * @param {string[]} requiredMethods - Liste des noms de méthodes attendues
   * @param {string} label - Nom du sous-système (pour le message d'erreur)
   */
  _validateContract(instance, requiredMethods, label) {
    const missing = requiredMethods.filter(
      method => typeof instance[method] !== 'function'
    );
    if (missing.length > 0) {
      throw new TypeError(
        `[AppRunner] Contrat non respecté pour ${label}. ` +
        `Méthodes manquantes : ${missing.join(', ')}`
      );
    }
  }

  /**
   * Initialise les sous-systèmes et valide leurs contrats
   * @private
   */
  _initializeSubsystems() {
    this.sandbox = new SandboxedRunner({
      timeout: DEFAULTS.SANDBOX_TIMEOUT
    });
    this._validateContract(this.sandbox,
      ['on', 'initialize', 'execute', 'destroy'],
      'SandboxedRunner'
    );

    this.dependencyInstaller = new DependencyInstaller({
      cacheTTL: DEFAULTS.DEPENDENCY_CACHE_TTL
    });
    this._validateContract(this.dependencyInstaller,
      ['initialize', 'install'],
      'DependencyInstaller'
    );

    this.hotReloader = new HotReloader({
      port: DEFAULTS.HOT_RELOAD_PORT
    });
    this._validateContract(this.hotReloader,
      ['on', 'connect', 'disconnect', 'watchFile', 'isActive'],
      'HotReloader'
    );

    this.performanceMonitor = new PerformanceMonitor({
      interval: DEFAULTS.METRICS_INTERVAL
    });
    this._validateContract(this.performanceMonitor,
      ['on', 'start', 'stop', 'getReport'],
      'PerformanceMonitor'
    );

    this.errorCapture = new ErrorCapture();
    this._validateContract(this.errorCapture,
      ['on', 'capture', 'getReport', 'restore'],
      'ErrorCapture'
    );

    this.environmentManager = new EnvironmentManager();
    this._validateContract(this.environmentManager,
      ['on', 'switchToEnvironment', 'getCurrentEnvironment'],
      'EnvironmentManager'
    );
  }

  /**
   * Configure les écouteurs d'événements internes
   * @private
   */
  _setupInternalListeners() {
    // Logs du sandbox
    this.sandbox.on('console', ({ method, args }) => {
      this._addLog(method, args.join(' '));
    });

    this.sandbox.on('error', ({ error, stack }) => {
      this._addLog('error', error);
      this.errorCapture.capture(error, { stack, source: 'sandbox' });
      this.emit(RUNNER_EVENTS.SANDBOX_ERROR, { error, stack });
    });

    this.sandbox.on('ready', () => {
      this.emit(RUNNER_EVENTS.SANDBOX_READY);
    });

    // Hot reload
    this.hotReloader.on('file-changed', (data) => {
      this._addLog('info', `🔄 Hot reload: ${data.path}`);
      this.emit(RUNNER_EVENTS.FILE_CHANGED, data);
    });

    this.hotReloader.on('reloaded', (data) => {
      this._addLog('success', `✅ Hot reload ${data.type}: ${data.path || ''}`);
      this.emit(RUNNER_EVENTS.HOT_RELOAD_COMPLETED, data);
    });

    this.hotReloader.on('error', (error) => {
      this._addLog('error', `❌ Hot reload failed: ${error.message}`);
      this.emit(RUNNER_EVENTS.HOT_RELOAD_FAILED, error);
    });

    // Performance
    this.performanceMonitor.on('metrics', (data) => {
      this.emit(RUNNER_EVENTS.METRICS_UPDATED, data);
      
      if (data.type === 'fps' && data.value < 30) {
        this._addLog('warning', `⚠️ Faible FPS: ${data.value}`);
        this.emit(RUNNER_EVENTS.PERFORMANCE_WARNING, { type: 'fps', value: data.value });
      }
      
      if (data.type === 'memory' && data.percentage > 80) {
        this._addLog('warning', `⚠️ Mémoire élevée: ${Math.round(data.percentage)}%`);
        this.emit(RUNNER_EVENTS.PERFORMANCE_WARNING, { 
          type: 'memory', 
          percentage: data.percentage 
        });
      }
    });

    this.performanceMonitor.on('long-task', (data) => {
      this._addLog('warning', `⚠️ Long task: ${Math.round(data.duration)}ms`);
      this.emit(RUNNER_EVENTS.LONG_TASK_DETECTED, data);
    });

    // Environnement — EnvironmentManager hérite d'EventEmitter, on utilise .on()
    const envEvents = ['environment-changed', 'variable-changed', 'feature-changed'];
    envEvents.forEach(event => {
      this.environmentManager.on(event, (data) => {
        this._addLog('info', `🌍 Environnement: ${event}`, data);
        this.emit(RUNNER_EVENTS.ENVIRONMENT_CHANGED, { event, ...data });
      });
    });

    // Erreurs
    this.errorCapture.on('captured', (error) => {
      this.emit(RUNNER_EVENTS.ERROR_CAPTURED, error);
    });
  }

  /**
   * Initialise le runner avec un projet
   * @param {string} projectId - ID du projet
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Résultat de l'initialisation
   */
  async initialize(projectId, userId) {
    if (this.initialized && this.currentProject?.id === projectId) {
      return { success: true, alreadyInitialized: true };
    }

    try {
      // Charger le projet
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) {
        throw new Error(this._t('projectNotFound'));
      }

      this.currentProject = project;
      this.currentUserId = userId;

      // Initialiser le sandbox
      await this.sandbox.initialize();

      // Initialiser le gestionnaire d'environnements
      // Les environnements par défaut sont déjà créés dans le constructeur d'EnvironmentManager
      await this.environmentManager.switchToEnvironment('development');

      // Initialiser le gestionnaire de dépendances
      await this.dependencyInstaller.initialize();

      this.initialized = true;

      this._addLog('success', `✅ AppRunner initialisé pour le projet ${project.name}`);
      this.emit(RUNNER_EVENTS.INITIALIZED, { projectId, userId, projectName: project.name });

      return { 
        success: true, 
        projectId, 
        projectName: project.name,
        projectType: this.detectProjectType()
      };

    } catch (error) {
      this._addLog('error', `❌ Initialisation échouée: ${error.message}`);
      this.emit(RUNNER_EVENTS.APP_ERROR, { error, phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Détecte le type de projet basé sur les fichiers présents
   * @returns {string} Type de projet (PROJECT_TYPES)
   */
  detectProjectType() {
    if (!this.currentProject || !this.currentProject.files) {
      return PROJECT_TYPES.STATIC;
    }

    const files = this.currentProject.files;

    // Vérifier package.json
    if (files['package.json']) {
      try {
        const packageJson = JSON.parse(files['package.json']);
        const deps = { 
          ...packageJson.dependencies, 
          ...packageJson.devDependencies 
        };

        // Framework detection
        if (deps['react'] && deps['react-native']) return PROJECT_TYPES.REACT_NATIVE;
        if (deps['react'] || deps['react-dom']) {
          if (deps['next']) return PROJECT_TYPES.NEXT;
          return PROJECT_TYPES.REACT;
        }
        if (deps['vue']) return PROJECT_TYPES.VUE;
        if (deps['@angular/core']) return PROJECT_TYPES.ANGULAR;
        if (deps['svelte']) return PROJECT_TYPES.SVELTE;
        if (deps['gatsby']) return PROJECT_TYPES.GATSBY;
        if (deps['@11ty/eleventy']) return PROJECT_TYPES.ELEVENTY;
        
        // Backend detection
        if (deps['express'] || deps['koa'] || deps['fastify']) {
          return PROJECT_TYPES.NODE;
        }

        // TypeScript detection
        if (packageJson.scripts?.build?.includes('tsc')) {
          return PROJECT_TYPES.TYPESCRIPT;
        }
      } catch (e) {
        console.warn('Erreur lecture package.json', e);
      }
    }

    // Vérifier les fichiers spécifiques
    if (files['index.html']) return PROJECT_TYPES.HTML;
    if (files['app.js'] && files['app.component.ts']) return PROJECT_TYPES.ANGULAR;
    if (files['App.vue']) return PROJECT_TYPES.VUE;
    if (files['App.svelte']) return PROJECT_TYPES.SVELTE;
    if (files['tsconfig.json']) return PROJECT_TYPES.TYPESCRIPT;
    if (files['gatsby-config.js']) return PROJECT_TYPES.GATSBY;
    if (files['.eleventy.js']) return PROJECT_TYPES.ELEVENTY;

    return PROJECT_TYPES.STATIC;
  }

  /**
   * Vérifie les prérequis pour l'exécution
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async checkPrerequisites() {
    if (!this.initialized) {
      throw new Error('AppRunner non initialisé');
    }

    const projectType = this.detectProjectType();
    const issues = [];
    const warnings = [];

    // Vérifier package.json pour les projets avec dépendances
    const needsPackageJson = [
      PROJECT_TYPES.REACT, PROJECT_TYPES.REACT_NATIVE, 
      PROJECT_TYPES.NODE, PROJECT_TYPES.VUE, 
      PROJECT_TYPES.ANGULAR, PROJECT_TYPES.SVELTE,
      PROJECT_TYPES.NEXT, PROJECT_TYPES.GATSBY,
      PROJECT_TYPES.TYPESCRIPT
    ];

    if (needsPackageJson.includes(projectType)) {
      if (!this.currentProject.files['package.json']) {
        issues.push('package.json manquant');
      } else {
        try {
          const packageJson = JSON.parse(this.currentProject.files['package.json']);
          
          // Vérifier les scripts
          if (!packageJson.scripts?.start && !packageJson.scripts?.dev) {
            warnings.push('Script "start" ou "dev" manquant dans package.json');
          }
          
          if (!packageJson.scripts?.build) {
            warnings.push('Script "build" manquant (recommandé pour la production)');
          }
        } catch {
          issues.push('package.json invalide');
        }
      }
    }

    // Vérifier le point d'entrée
    const entryPoints = {
      [PROJECT_TYPES.REACT]: ['src/index.js', 'src/index.tsx', 'src/App.js', 'index.js'],
      [PROJECT_TYPES.NEXT]: ['pages/index.js', 'pages/index.tsx', 'src/pages/index.js'],
      [PROJECT_TYPES.VUE]: ['src/main.js', 'src/App.vue'],
      [PROJECT_TYPES.ANGULAR]: ['src/main.ts', 'src/app/app.module.ts'],
      [PROJECT_TYPES.SVELTE]: ['src/main.js', 'src/App.svelte'],
      [PROJECT_TYPES.HTML]: ['index.html'],
      [PROJECT_TYPES.NODE]: ['index.js', 'server.js', 'app.js', 'src/index.js'],
      [PROJECT_TYPES.GATSBY]: ['src/pages/index.js', 'gatsby-config.js']
    };

    const possibleEntries = entryPoints[projectType] || [];
    const hasEntryPoint = possibleEntries.some(entry => 
      this.currentProject.files[entry]
    );

    if (!hasEntryPoint && possibleEntries.length > 0) {
      issues.push(`Point d'entrée manquant (${possibleEntries.join(', ')})`);
    }

    return {
      ready: issues.length === 0,
      issues,
      warnings,
      projectType
    };
  }

  /**
   * Lance l'application
   * @param {Object} options - Options d'exécution
   * @returns {Promise<Object>} Résultat du lancement
   */
  async runApp(options = {}) {
    if (!this.initialized) {
      throw new Error('AppRunner non initialisé');
    }

    const {
      mode = 'dev',
      port = null,
      autoOpen = false,
      installDeps = true
    } = options;

    try {
      // Vérifier les prérequis
      const prerequisites = await this.checkPrerequisites();
      if (!prerequisites.ready) {
        throw new Error(`${this._t('prerequisitesMissing')}: ${prerequisites.issues.join(', ')}`);
      }

      // Installer les dépendances si nécessaire
      if (installDeps && prerequisites.warnings.length > 0) {
        this._addLog('info', '📦 Installation des dépendances...');
        const depsResult = await this.dependencyInstaller.install(this.currentProject);
        
        if (depsResult.success) {
          this._addLog('success', `✅ ${depsResult.installed.length} dépendances installées`);
        } else {
          this._addLog('warning', `⚠️ Certaines dépendances n'ont pas pu être installées`);
        }
      }

      const projectType = prerequisites.projectType;
      const selectedPort = port || DEFAULT_PORTS[projectType];

      // Arrêter les processus existants
      await this.stopApp();

      // Démarrer le monitoring
      this.performanceMonitor.start();

      // Connecter le hot reload
      if (mode === 'dev') {
        this.hotReloader.connect(this.currentProject.id, selectedPort);
      }

      // Créer le processus
      const processId = `proc_${Date.now()}`;
      const serverUrl = `http://localhost:${selectedPort}`;

      const process = {
        id: processId,
        type: projectType,
        mode,
        port: selectedPort,
        url: serverUrl,
        status: PROCESS_STATES.STARTING,
        startedAt: new Date().toISOString(),
        pid: Math.floor(Math.random() * 10000) + 1000 // Simulation
      };

      this.processes.set(processId, process);
      this.serverUrls.set(projectType, serverUrl);

      // Logs de démarrage
      this._addLog('info', `🚀 Démarrage de l'application (mode: ${mode})...`);
      this._addLog('info', `📦 Type de projet: ${projectType}`);
      this._addLog('info', `🔌 Port: ${selectedPort}`);
      this._addLog('info', `🌍 Environnement: ${this.environmentManager.currentEnv}`);

      // Simuler le démarrage (dans un environnement réel, ici on lancerait un vrai processus)
      setTimeout(() => {
        const proc = this.processes.get(processId);
        if (proc) {
          proc.status = PROCESS_STATES.RUNNING;
          this._addLog('success', `✅ Application démarrée sur ${serverUrl}`);
          this.emit(RUNNER_EVENTS.APP_STARTED, { 
            processId, 
            url: serverUrl,
            projectType,
            mode
          });
        }
      }, 2000);

      // Simuler des logs périodiques (uniquement en dev)
      if (mode === 'dev') {
        this._simulateDevLogs(processId, projectType);
      }

      return {
        success: true,
        processId,
        url: serverUrl,
        port: selectedPort,
        type: projectType,
        mode,
        environment: this.environmentManager.getCurrentEnvironment()
      };

    } catch (error) {
      this._addLog('error', `❌ Erreur: ${error.message}`);
      this.emit(RUNNER_EVENTS.APP_ERROR, { error, phase: 'run' });
      throw error;
    }
  }

  /**
   * Simule des logs de développement
   * @private
   */
  _simulateDevLogs(processId, projectType) {
    const intervals = [];

    // Logs périodiques
    const logInterval = setInterval(() => {
      const proc = this.processes.get(processId);
      if (!proc || proc.status !== PROCESS_STATES.RUNNING) {
        clearInterval(logInterval);
        return;
      }

      const random = Math.random();
      if (random < 0.1) {
        this._addLog('info', '📊 GET /api/users 200 15ms');
      } else if (random < 0.2) {
        this._addLog('success', '✅ WebSocket connected');
      } else if (random < 0.25) {
        this._addLog('warning', '⚠️ Cache miss for /api/data');
      } else if (random < 0.3) {
        this._addLog('debug', '🔍 Hot module replacement enabled');
      }
    }, 3000);

    intervals.push(logInterval);

    // Simuler une erreur occasionnelle (1% de chance)
    const errorInterval = setInterval(() => {
      const proc = this.processes.get(processId);
      if (!proc || proc.status !== PROCESS_STATES.RUNNING) {
        clearInterval(errorInterval);
        return;
      }

      if (Math.random() < 0.01) {
        const error = new Error('API timeout after 5000ms');
        this.errorCapture.capture(error, { type: 'simulated', endpoint: '/api/users' });
        this._addLog('error', '❌ API timeout after 5000ms');
      }
    }, 10000);

    intervals.push(errorInterval);

    // Nettoyer à l'arrêt
    const cleanup = () => {
      intervals.forEach(clearInterval);
    };

    this.once(RUNNER_EVENTS.APP_STOPPED, cleanup);
  }

  /**
   * Arrête l'application
   * @returns {Promise<Object>} Résultat de l'arrêt
   */
  async stopApp() {
    const processes = Array.from(this.processes.values());
    
    for (const proc of processes) {
      proc.status = PROCESS_STATES.STOPPED;
      proc.stoppedAt = new Date().toISOString();
      
      this._addLog('info', `🛑 Application arrêtée (${proc.id})`);
      this.emit(RUNNER_EVENTS.APP_STOPPED, { 
        processId: proc.id,
        url: proc.url,
        duration: proc.stoppedAt - proc.startedAt
      });
    }

    this.processes.clear();
    this.performanceMonitor.stop();
    this.hotReloader.disconnect(this.currentProject?.id);

    return { 
      success: true, 
      stoppedCount: processes.length 
    };
  }

  /**
   * Construit l'application
   * @returns {Promise<Object>} Résultat du build
   */
  async buildApp() {
    if (!this.initialized) {
      throw new Error('AppRunner non initialisé');
    }

    try {
      const projectType = this.detectProjectType();
      const buildId = `build_${Date.now()}`;

      const build = {
        id: buildId,
        type: projectType,
        status: BUILD_STATES.BUILDING,
        startedAt: new Date().toISOString()
      };

      this.builds.set(buildId, build);

      this._addLog('info', this._t('building'));
      this.emit(RUNNER_EVENTS.BUILD_STARTED, { buildId, projectType });

      // Simuler le build
      const buildSteps = [
        '🧹 Nettoyage du dossier dist...',
        '📦 Installation des dépendances...',
        '🔨 Compilation des sources...',
        '🎨 Optimisation des assets...',
        '📊 Génération des sourcemaps...'
      ];

      for (let i = 0; i < buildSteps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 600));
        this._addLog('info', buildSteps[i]);
        this.emit(RUNNER_EVENTS.BUILD_PROGRESS, { 
          buildId, 
          step: i + 1, 
          total: buildSteps.length,
          message: buildSteps[i]
        });
      }

      // Build réussi
      build.status = BUILD_STATES.SUCCESS;
      build.completedAt = new Date().toISOString();
      build.duration = new Date(build.completedAt) - new Date(build.startedAt);
      build.output = {
        path: 'dist/',
        size: Math.floor(Math.random() * 5000000) + 1000000, // Simulation
        files: Object.keys(this.currentProject.files || {}).length
      };

      this._addLog('success', this._t('buildSuccess'));
      this.emit(RUNNER_EVENTS.BUILD_COMPLETED, build);

      return {
        success: true,
        buildId,
        ...build
      };

    } catch (error) {
      this._addLog('error', `${this._t('buildFailed')}: ${error.message}`);
      this.emit(RUNNER_EVENTS.BUILD_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Exécute du code dans le sandbox
   * @param {string} code - Code JavaScript à exécuter
   * @returns {Promise<Object>} Résultat de l'exécution
   */
  async executeInSandbox(code) {
    if (!this.initialized) {
      throw new Error('Sandbox non initialisé');
    }
    return this.sandbox.execute(code);
  }

  /**
   * Met à jour le contenu d'un fichier
   * @param {string} path - Chemin du fichier
   * @param {string} content - Nouveau contenu
   */
  updateFile(path, content) {
    if (!this.currentProject?.files) return;

    const oldContent = this.currentProject.files[path];
    this.currentProject.files[path] = content;

    // Notifier le hot reload
    if (oldContent !== content) {
      this.hotReloader.watchFile(this.currentProject.id, path, content);
    }

    // Sauvegarder via fileManager
    fileManager.writeFile(path, content).catch(error => {
      this._addLog('error', `❌ Erreur sauvegarde ${path}: ${error.message}`);
    });
  }

  /**
   * Surveille un fichier pour le hot reload
   * @param {string} path - Chemin du fichier
   */
  watchFile(path) {
    if (!this.currentProject?.files) return;

    const content = this.currentProject.files[path];
    if (content !== undefined) {
      this.hotReloader.watchFile(this.currentProject.id, path, content);
    }
  }

 /**
   * Récupère l'URL du serveur
   * @returns {string|null} URL du serveur
   */
  getServerUrl() {
    const projectType = this.detectProjectType();
    return this.serverUrls.get(projectType) || null;
  }

  /**
   * Vérifie si l'application tourne
   * @returns {boolean} true si une application tourne
   */
  isRunning() {
    return this.processes.size > 0;
  }

  /**
   * Récupère les logs
   * @param {number} limit - Nombre de logs à récupérer
   * @returns {Array} Liste des logs
   */
  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  /**
   * Nettoie les logs
   */
  clearLogs() {
    this.logs = [];
    this.emit(RUNNER_EVENTS.LOGS_CLEARED, {});
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques actuelles
   */
  getStats() {
    return {
      isRunning: this.isRunning(),
      processes: Array.from(this.processes.values()),
      builds: Array.from(this.builds.values()),
      logsCount: this.logs.length,
      projectType: this.detectProjectType(),
      environment: this.environmentManager.getCurrentEnvironment(),
      performance: this.performanceMonitor.getReport(),
      errors: this.errorCapture.getReport()
    };
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.stopApp().catch(console.error);
    this.sandbox.destroy();
    this.performanceMonitor.stop();
    this.hotReloader.disconnect();
    this.removeAllListeners();
    this.emit(RUNNER_EVENTS.DESTROYED);
  }

  /**
   * Ajoute un log
   * @private
   */
  _addLog(type, message, data = null) {
    const log = {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.logs.push(log);

    // Limiter la taille des logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.emit(RUNNER_EVENTS.NEW_LOG, log);
  }

  /**
   * Traduction
   * @private
   */
  _t(key) {
    return I18N[this.language]?.[key] || I18N.fr[key] || key;
  }
}

let appRunner;
try {
  appRunner = new AppRunner();
} catch (err) {
  console.error('[AppRunner] Échec critique à l\'initialisation du module:', err);
  appRunner = null;
}

export { appRunner };
export default appRunner;
