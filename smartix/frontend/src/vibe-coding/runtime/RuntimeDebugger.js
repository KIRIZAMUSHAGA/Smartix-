/**
 * RuntimeDebugger - Débogueur automatique IA (version PRO)
 * 
 * Rôle: Réagir aux erreurs détectées par RuntimeMonitor
 * - File d'attente pour éviter la concurrence
 * - Validation avant application
 * - Rollback automatique
 * - Debounce pour les restart
 */

import { EventEmitter } from 'events';
import PQueue from 'p-queue'; // npm install p-queue
import { debugAgent } from '../ai/debugAgent';
import { projectModifier } from '../services/projectModifier';
import { appRunner } from './appRunner';
import { codeSandbox } from '../services/codeSandbox';
import { linter } from '../services/linter';

export class RuntimeDebugger extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      autoFix: options.autoFix !== false,
      maxFixAttempts: options.maxFixAttempts || 3,
      askConfirmation: options.askConfirmation || false,
      minConfidence: options.minConfidence || 0.7,
      logLevel: options.logLevel || 'info',
      ...options
    };

    this.monitor = null;
    this.fixHistory = [];
    this.currentFixes = new Map();
    this.errorStats = {
      total: 0,
      fixed: 0,
      failed: 0,
      ignored: 0,
      byType: {}
    };
    
    // Queue pour éviter la concurrence
    this.fixQueue = new PQueue({ concurrency: 1 });
    this.restartPending = false;
    this.restartDebounceTimer = null;
    
    // Dataset pour replay errors
    this.errorDataset = [];
  }

  /**
   * Connecte le debugger à un RuntimeMonitor
   */
  connect(monitor) {
    this.monitor = monitor;
    
    // Écouter les événements d'erreur
    monitor.on('error', this._queueError.bind(this));
    monitor.on('warning', this._handleWarning.bind(this));
    
    console.log('🔌 RuntimeDebugger connecté au moniteur');
    this.emit('connected');
  }

  /**
   * Met l'erreur dans la file d'attente (anti-concurrence)
   */
  _queueError(errorData) {
    this.fixQueue.add(() => this._handleError(errorData));
  }

  /**
   * Gère une erreur détectée
   */
  async _handleError(errorData) {
    const { error, context, timestamp } = errorData;
    
    this.errorStats.total++;
    this.emit('error-detected', { error, context });

    console.log(`🐛 Erreur détectée: ${error.message}`);

    // Déterminer le type d'erreur
    const errorType = this._classifyError(error);
    this.errorStats.byType[errorType] = (this.errorStats.byType[errorType] || 0) + 1;

    // Sauvegarder dans le dataset
    this.errorDataset.push({
      error: error.message,
      type: errorType,
      context,
      timestamp,
      stack: error.stack
    });

    // Générer signature robuste
    const errorSignature = this._generateRobustSignature(error, context);
    
    if (this._shouldIgnore(errorSignature)) {
      this.errorStats.ignored++;
      return;
    }

    // Compter les tentatives
    const attempts = this.currentFixes.get(errorSignature) || 0;
    
    if (attempts >= this.options.maxFixAttempts) {
      console.warn(`⚠️ Maximum de tentatives atteint pour cette erreur (${attempts})`);
      this.errorStats.failed++;
      this.emit('fix-failed', { error, attempts });
      return;
    }

    this.currentFixes.set(errorSignature, attempts + 1);

    try {
      // Récupérer l'ancien code pour rollback
      const oldCode = await projectModifier.readFile(context.file);

      // Demander confirmation si nécessaire
      if (this.options.askConfirmation) {
        const confirmed = await this._askConfirmation(error);
        if (!confirmed) {
          this.errorStats.ignored++;
          return;
        }
      }

      // Analyser l'erreur avec l'IA
      const analysis = await debugAgent.analyzeError(error, context);
      
      if (!analysis.fix || analysis.confidence < this.options.minConfidence) {
        console.warn(`⚠️ Solution avec confiance insuffisante (${analysis.confidence})`);
        this.emit('fix-low-confidence', analysis);
        return;
      }

      this.emit('fix-found', analysis);

      // Appliquer la correction
      if (this.options.autoFix) {
        await this._applySafeFix(analysis, oldCode);
      }

    } catch (fixError) {
      console.error('❌ Erreur pendant la correction:', fixError);
      this.emit('fix-error', { error, fixError });
    }
  }

  /**
   * Applique une correction avec validation
   */
  async _applySafeFix(analysis, oldCode) {
    const { file, newCode, description, confidence } = analysis;

    try {
      // 1. Backup déjà fait par projectModifier
      
      // 2. Tester dans le sandbox
      console.log('🧪 Test de la correction dans le sandbox...');
      const sandboxResult = await codeSandbox.test(file, newCode);
      
      if (!sandboxResult.success) {
        throw new Error(`Le test sandbox a échoué: ${sandboxResult.error}`);
      }

      // 3. Vérifier avec le linter
      console.log('🔍 Vérification avec le linter...');
      const lintResult = await linter.check(newCode, file);
      
      if (!lintResult.valid) {
        throw new Error(`Erreur de syntaxe: ${lintResult.errors.join(', ')}`);
      }

      // 4. Appliquer la modification
      await projectModifier.updateFile(file, newCode, {
        validate: false, // Déjà fait
        backup: true,
        allowCreate: true
      });
      
      // 5. Enregistrer dans l'historique
      this.fixHistory.push({
        timestamp: Date.now(),
        file,
        description,
        confidence,
        success: true,
        backupId: projectModifier.getLastBackupId(file)
      });

      this.errorStats.fixed++;
      this.emit('fix-applied', { file, description, confidence });

      console.log(`✅ Correction appliquée: ${description} (confiance: ${confidence})`);

      // 6. Relancer l'application (avec debounce)
      await this._smartRestart();

    } catch (error) {
      console.error('❌ Échec de l\'application de la correction:', error);
      
      // Rollback automatique
      await this._rollback(file, oldCode);
      
      this.fixHistory.push({
        timestamp: Date.now(),
        file,
        description,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Rollback en cas d'échec
   */
  async _rollback(file, oldCode) {
    try {
      console.log('↩️ Rollback en cours...');
      await projectModifier.updateFile(file, oldCode, {
        validate: false,
        backup: false
      });
      console.log('✅ Rollback réussi');
      this.emit('rollback', { file });
    } catch (rollbackError) {
      console.error('❌ Échec du rollback:', rollbackError);
    }
  }

  /**
   * Redémarrage intelligent avec debounce
   */
  async _smartRestart() {
    if (this.restartPending) {
      console.log('⏳ Redémarrage déjà planifié');
      return;
    }

    this.restartPending = true;

    // Debounce de 1 seconde
    clearTimeout(this.restartDebounceTimer);
    this.restartDebounceTimer = setTimeout(async () => {
      try {
        console.log('🔄 Redémarrage de l\'application...');
        
        // Hot reload si le hotReloader est actif, sinon restart complet via les vraies méthodes
        if (appRunner.hotReloader && appRunner.hotReloader.isActive(appRunner.currentProject?.id)) {
          appRunner.hotReloader.watchFile(
            appRunner.currentProject.id,
            '__reload__',
            Date.now().toString()
          );
          console.log('✅ Hot reload déclenché');
        } else {
          await appRunner.stopApp();
          await appRunner.runApp();
          console.log('✅ Application relancée');
        }
        
        this.emit('app-restarted');
      } catch (error) {
        console.error('❌ Erreur au redémarrage:', error);
      } finally {
        this.restartPending = false;
      }
    }, 1000);
  }

  /**
   * Classe l'erreur par type
   */
  _classifyError(error) {
    const message = error.message || '';
    
    if (message.includes('Unexpected token')) return 'syntax';
    if (message.includes('undefined is not a function')) return 'runtime';
    if (message.includes('Failed to fetch')) return 'network';
    if (message.includes('Cannot read property')) return 'logic';
    if (message.includes('performance')) return 'performance';
    
    return 'unknown';
  }

  /**
   * Génère une signature robuste
   */
  _generateRobustSignature(error, context) {
    const message = error.message || String(error);
    const file = context?.file || 'unknown';
    const line = context?.lineno || context?.line || 0;
    
    return `${message}|${file}|${line}`;
  }

  /**
   * Vérifie si une erreur doit être ignorée
   */
  _shouldIgnore(signature) {
    const ignorePatterns = [
      /network error/i,
      /timeout/i,
      /user aborted/i
    ];

    return ignorePatterns.some(pattern => pattern.test(signature));
  }

  /**
   * Demande confirmation à l'utilisateur
   */
  async _askConfirmation(error) {
    if (typeof window !== 'undefined' && window.confirm) {
      return window.confirm(
        `Une erreur a été détectée:\n${error.message}\n\nVoulez-vous que l'IA tente de la corriger automatiquement ?`
      );
    }
    return true;
  }

  /**
   * Gère un avertissement
   */
  _handleWarning(warning) {
    this.emit('warning-detected', warning);
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    return {
      ...this.errorStats,
      historyLength: this.fixHistory.length,
      recentFixes: this.fixHistory.slice(-5),
      queueSize: this.fixQueue.size,
      datasetSize: this.errorDataset.length
    };
  }

  /**
   * Exporte le dataset d'erreurs (pour réentraînement IA)
   */
  exportErrorDataset() {
    return {
      errors: this.errorDataset,
      fixes: this.fixHistory.filter(f => f.success),
      stats: this.getStats(),
      exportedAt: Date.now()
    };
  }

  /**
   * Réinitialise le debugger
   */
  reset() {
    this.currentFixes.clear();
    this.fixQueue.clear();
    this.errorStats = {
      total: 0,
      fixed: 0,
      failed: 0,
      ignored: 0,
      byType: {}
    };
  }
}

export const runtimeDebugger = new RuntimeDebugger();
export default runtimeDebugger;
