/**
 * DebugNotification - Notification d'erreur avec option de correction IA
 * 
 * Affiche une notification quand une erreur est détectée
 * Propose à l'utilisateur de laisser l'IA corriger
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { runtimeDebugger } from '../runtime/RuntimeDebugger';
import { projectModifier } from '../services/projectModifier';
import PropTypes from 'prop-types';

// Utilitaire pour échapper les messages (protection XSS)
const escapeMessage = (message) => {
  if (!message) return '';
  const div = document.createElement('div');
  div.textContent = message;
  return div.innerHTML;
};

// Queue d'erreurs pour éviter les écrasements
class ErrorQueue {
  constructor(maxSize = 10) {
    this.queue = [];
    this.maxSize = maxSize;
  }

  push(error) {
    this.queue.push(error);
    if (this.queue.length > this.maxSize) {
      this.queue.shift();
    }
  }

  pop() {
    return this.queue.shift();
  }

  peek() {
    return this.queue[0];
  }

  clear() {
    this.queue = [];
  }

  size() {
    return this.queue.length;
  }
}

export const DebugNotification = ({ onFixStart, onFixComplete, onFixReject }) => {
  const [visible, setVisible] = useState(false);
  const [currentError, setCurrentError] = useState(null);
  const [errorQueue] = useState(() => new ErrorQueue());
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState(null);
  const [silentMode, setSilentMode] = useState(false);
  
  // Refs pour les timeouts et throttling
  const timeoutRef = useRef(null);
  const progressThrottleRef = useRef(null);
  const mountedRef = useRef(true);

  // Nettoyage des timeouts
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressThrottleRef.current) clearTimeout(progressThrottleRef.current);
    };
  }, []);

  // Fonction pour traiter la prochaine erreur dans la queue
  const processNextError = useCallback(() => {
    if (!mountedRef.current) return;
    
    const nextError = errorQueue.peek();
    if (nextError && !visible && !fixing && !fixResult) {
      setCurrentError(nextError);
      setVisible(true);
      errorQueue.pop();
      
      // Auto-disparition après 10 secondes si l'utilisateur ne fait rien
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setVisible(false);
          setCurrentError(null);
          // Traiter l'erreur suivante
          processNextError();
        }
      }, 10000);
    }
  }, [visible, fixing, fixResult, errorQueue]);

  // Gestionnaires d'événements stables (sans dépendances changeantes)
  useEffect(() => {
    // Écouter les erreurs détectées
    const handleErrorDetected = ({ error }) => {
      if (!mountedRef.current) return;
      
      // Ajouter à la queue
      errorQueue.push(error);
      
      // Traiter si aucune notification n'est visible
      if (!visible && !fixing && !fixResult) {
        processNextError();
      }
    };

    // Écouter le début de correction
    const handleFixStart = () => {
      if (!mountedRef.current) return;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setFixing(true);
      setProgress(0);
      onFixStart?.();
    };

    // Écouter la progression avec throttling
    const handleFixProgress = ({ progress: p }) => {
      if (!mountedRef.current) return;
      
      // Throttle les mises à jour de progression
      if (progressThrottleRef.current) return;
      
      progressThrottleRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setProgress(p);
        }
        progressThrottleRef.current = null;
      }, 100);
    };

    // Écouter la correction appliquée
    const handleFixApplied = async ({ file, description, diff }) => {
      if (!mountedRef.current) return;
      
      setFixing(false);
      setFixResult({ success: true, file, description });
      setDiffContent(diff);
      onFixComplete?.({ file, description });
      
      // Disparaître après 5 secondes
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setVisible(false);
          setFixResult(null);
          setDiffContent(null);
          setCurrentError(null);
          // Traiter l'erreur suivante
          processNextError();
        }
      }, 5000);
    };

    // Écouter l'échec
    const handleFixFailed = ({ error }) => {
      if (!mountedRef.current) return;
      
      setFixing(false);
      setFixResult({ success: false, error: error.message });
      onFixReject?.(error);
    };

    // Écouter le rejet par l'utilisateur
    const handleFixRejected = () => {
      if (!mountedRef.current) return;
      
      setVisible(false);
      setFixing(false);
      setFixResult(null);
      setCurrentError(null);
      
      // Traiter l'erreur suivante
      processNextError();
    };

    runtimeDebugger.on('error-detected', handleErrorDetected);
    runtimeDebugger.on('fix-start', handleFixStart);
    runtimeDebugger.on('fix-progress', handleFixProgress);
    runtimeDebugger.on('fix-applied', handleFixApplied);
    runtimeDebugger.on('fix-failed', handleFixFailed);
    runtimeDebugger.on('fix-rejected', handleFixRejected);

    return () => {
      runtimeDebugger.off('error-detected', handleErrorDetected);
      runtimeDebugger.off('fix-start', handleFixStart);
      runtimeDebugger.off('fix-progress', handleFixProgress);
      runtimeDebugger.off('fix-applied', handleFixApplied);
      runtimeDebugger.off('fix-failed', handleFixFailed);
      runtimeDebugger.off('fix-rejected', handleFixRejected);
    };
  }, [onFixStart, onFixComplete, onFixReject, processNextError, errorQueue, visible, fixing, fixResult]);

  const handleAccept = () => {
    runtimeDebugger.acceptFix();
  };

  const handleReject = () => {
    runtimeDebugger.rejectFix();
    onFixReject?.('Correction rejetée par l\'utilisateur');
  };

  const handleUndo = async () => {
    if (!currentError?.context?.file || !currentError?.context?.projectId) return;
    
    try {
      const history = await projectModifier.getModificationHistory(currentError.context.projectId);
      if (history.length > 0) {
        await projectModifier.undoLastModification(
          currentError.context.projectId,
          currentError.context.userId
        );
        setFixResult({ success: true, description: 'Correction annulée' });
      }
    } catch (error) {
      console.error('Erreur undo:', error);
    }
  };

  const toggleSilentMode = () => {
    setSilentMode(!silentMode);
  };

  if (!visible || silentMode) return null;

  return (
    <div className="debug-notification">
      {!fixing && !fixResult && (
        <div className="notification error">
          <div className="notification-header">
            <span className="notification-icon">🐛</span>
            <span className="notification-title">Erreur détectée</span>
            <div className="header-actions">
              <button 
                className="silent-toggle" 
                onClick={toggleSilentMode}
                title="Activer le mode silencieux"
              >
                🔇
              </button>
              <button className="notification-close" onClick={handleReject}>✕</button>
            </div>
          </div>
          
          <div className="notification-body">
            <div className="error-message">
              {escapeMessage(currentError?.message || 'Une erreur est survenue')}
            </div>
            
            <div className="error-context">
              {currentError?.context?.file && (
                <div className="error-file">
                  📁 {currentError.context.file}
                  {currentError.context.line && `:${currentError.context.line}`}
                </div>
              )}
              {currentError?.context?.type && (
                <div className="error-type">
                  Type: {currentError.context.type}
                </div>
              )}
            </div>

            <div className="error-queue-info">
              {errorQueue.size() > 0 && (
                <span className="queue-badge">
                  +{errorQueue.size()} erreur(s) en attente
                </span>
              )}
            </div>

            <div className="notification-actions">
              <button className="btn-primary" onClick={handleAccept}>
                🔧 Corriger avec l'IA
              </button>
              <button className="btn-secondary" onClick={handleReject}>
                Ignorer
              </button>
            </div>
          </div>
        </div>
      )}

      {fixing && (
        <div className="notification fixing">
          <div className="notification-header">
            <span className="notification-icon">🤖</span>
            <span className="notification-title">L'IA corrige...</span>
          </div>
          
          <div className="notification-body">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-text">{Math.min(progress, 100)}%</div>
            
            <div className="fix-steps">
              <div className={`step ${progress >= 25 ? 'completed' : ''}`}>
                <span className="step-icon">{progress >= 25 ? '✅' : '⏳'}</span>
                <span className="step-label">Analyse du code</span>
              </div>
              <div className={`step ${progress >= 50 ? 'completed' : ''}`}>
                <span className="step-icon">{progress >= 50 ? '✅' : '⏳'}</span>
                <span className="step-label">Génération du patch</span>
              </div>
              <div className={`step ${progress >= 75 ? 'completed' : ''}`}>
                <span className="step-icon">{progress >= 75 ? '✅' : '⏳'}</span>
                <span className="step-label">Validation</span>
              </div>
              <div className={`step ${progress >= 100 ? 'completed' : ''}`}>
                <span className="step-icon">{progress >= 100 ? '✅' : '⏳'}</span>
                <span className="step-label">Application</span>
              </div>
            </div>

            {progress >= 100 && (
              <div className="fix-complete">
                Redémarrage de l'application...
              </div>
            )}
          </div>
        </div>
      )}

      {fixResult && fixResult.success && (
        <div className="notification success">
          <div className="notification-header">
            <span className="notification-icon">✅</span>
            <span className="notification-title">Correction appliquée</span>
          </div>
          
          <div className="notification-body">
            <div className="fix-description">{fixResult.description}</div>
            <div className="fix-file">📁 {fixResult.file}</div>
            
            {diffContent && (
              <div className="diff-section">
                <button 
                  className="diff-toggle"
                  onClick={() => setShowDiff(!showDiff)}
                >
                  {showDiff ? '▼' : '▶'} Voir les modifications
                </button>
                {showDiff && (
                  <pre className="diff-content">
                    {diffContent}
                  </pre>
                )}
              </div>
            )}
            
            <div className="notification-actions">
              <button className="btn-secondary undo" onClick={handleUndo}>
                ↩️ Annuler
              </button>
              <button className="btn-secondary" onClick={() => setVisible(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {fixResult && !fixResult.success && (
        <div className="notification error">
          <div className="notification-header">
            <span className="notification-icon">❌</span>
            <span className="notification-title">Échec de la correction</span>
          </div>
          
          <div className="notification-body">
            <div className="error-message">{escapeMessage(fixResult.error)}</div>
            
            <div className="notification-actions">
              <button className="btn-primary" onClick={handleAccept}>
                Réessayer
              </button>
              <button className="btn-secondary" onClick={() => setVisible(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .debug-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          min-width: 350px;
          max-width: 450px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .notification {
          background: #2d2d2d;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          overflow: hidden;
          border-left: 4px solid;
        }

        .notification.error {
          border-left-color: #f44336;
        }

        .notification.success {
          border-left-color: #4caf50;
        }

        .notification.fixing {
          border-left-color: #2196f3;
        }

        .notification-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
        }

        .header-actions {
          display: flex;
          gap: 4px;
        }

        .silent-toggle {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 14px;
        }

        .silent-toggle:hover {
          color: #fff;
          background: #3e3e3e;
        }

        .notification-icon {
          font-size: 20px;
          margin-right: 8px;
        }

        .notification-title {
          flex: 1;
          font-weight: bold;
          color: #d4d4d4;
        }

        .notification-close {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 16px;
        }

        .notification-close:hover {
          color: #fff;
          background: #3e3e3e;
        }

        .notification-body {
          padding: 16px;
        }

        .error-message {
          font-family: monospace;
          background: #1e1e1e;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
          color: #f48771;
          word-break: break-word;
        }

        .error-context {
          margin-bottom: 8px;
          font-size: 12px;
        }

        .error-file {
          color: #9cdcfe;
          margin-bottom: 2px;
        }

        .error-type {
          color: #888;
        }

        .error-queue-info {
          margin-bottom: 12px;
        }

        .queue-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #f44336;
          color: white;
          border-radius: 12px;
          font-size: 11px;
        }

        .notification-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .btn-primary {
          flex: 1;
          padding: 8px 12px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .btn-primary:hover {
          background: #1976d2;
        }

        .btn-secondary {
          padding: 8px 12px;
          background: #3e3e3e;
          color: #d4d4d4;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .btn-secondary:hover {
          background: #505050;
        }

        .btn-secondary.undo {
          background: #ff9800;
          color: #000;
        }

        .btn-secondary.undo:hover {
          background: #f57c00;
        }

        .progress-bar {
          height: 6px;
          background: #1e1e1e;
          border-radius: 3px;
          overflow: hidden;
          margin: 8px 0;
        }

        .progress-fill {
          height: 100%;
          background: #2196f3;
          transition: width 0.3s ease;
        }

        .progress-text {
          text-align: right;
          font-size: 11px;
          color: #888;
          margin-bottom: 12px;
        }

        .fix-steps {
          margin-top: 12px;
        }

        .step {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 12px;
          color: #888;
        }

        .step.completed {
          color: #4caf50;
        }

        .step-icon {
          width: 20px;
          text-align: center;
        }

        .fix-complete {
          margin-top: 12px;
          padding: 8px;
          background: #1e3a5f;
          border-radius: 4px;
          color: #2196f3;
          font-size: 12px;
          text-align: center;
          animation: pulse 1.5s infinite;
        }

        .fix-description {
          margin-bottom: 4px;
          color: #b5cea8;
        }

        .fix-file {
          font-size: 12px;
          color: #9cdcfe;
          margin-bottom: 12px;
        }

        .diff-section {
          margin: 8px 0;
        }

        .diff-toggle {
          background: transparent;
          border: none;
          color: #2196f3;
          cursor: pointer;
          font-size: 12px;
          padding: 4px 0;
        }

        .diff-content {
          margin-top: 8px;
          padding: 8px;
          background: #1e1e1e;
          border-radius: 4px;
          font-size: 11px;
          color: #b5cea8;
          white-space: pre-wrap;
          max-height: 200px;
          overflow: auto;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};
DebugNotification.propTypes = {
  onFixStart: PropTypes.func.isRequired,
  onFixComplete: PropTypes.func.isRequired,
  onFixReject: PropTypes.func.isRequired,
};

export default DebugNotification;
