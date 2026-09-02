/**
 * DebugPanel - Panneau principal de débogage
 * 
 * Intègre toutes les UI de débogage :
 * - Notifications flottantes
 * - Console de logs
 * - Bouton flottant
 * - Indicateurs d'état
 * - Contrôle des sons
 * - Hotkeys (Ctrl+`)
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DebugNotification } from './DebugNotification';
import { DebugConsole } from './DebugConsole';
import { DebugButton, MiniDebugButton, StatusBarDebugButton } from './DebugButton';
import { SoundControl } from '../utils/sound';
import { runtimeDebugger } from '../runtime/RuntimeDebugger';
import PropTypes from 'prop-types';

// =============================
// CONFIGURATION
// =============================

const STORAGE_KEY = 'vibe-coding-debug-settings';
const UPDATE_THROTTLE = 1000; // ms

// Mode production safe
const IS_DEV = process.env.NODE_ENV === 'development';

// =============================
// HOOK PERSO : Throttle
// =============================
const useThrottle = (callback, delay) => {
  const timeoutRef = useRef(null);
  const lastCallRef = useRef(0);

  return useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    if (timeSinceLastCall >= delay) {
      callback(...args);
      lastCallRef.current = now;
    } else if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastCallRef.current = Date.now();
        timeoutRef.current = null;
      }, delay - timeSinceLastCall);
    }
  }, [callback, delay]);
};

// =============================
// COMPOSANT PRINCIPAL
// =============================

export const DebugPanel = ({ 
  position = 'bottom-right',
  defaultOpen = false,
  enableSound = true,
  enableDrag = true,
  mini = false,
  statusBar = false,
  onStateChange,
  hotkey = '`' // Touche pour ouvrir/fermer (Ctrl+`)
}) => {
  const [consoleOpen, setConsoleOpen] = useState(defaultOpen);
  const [settings, setSettings] = useState({
    enabled: IS_DEV, // Désactivé en prod par défaut
    sound: enableSound,
    autoScroll: true,
    notifications: true,
    filter: 'all'
  });
  const [stats, setStats] = useState(null);
  const [isFixing, setIsFixing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const mountedRef = useRef(true);
  const handlersRef = useRef({});

  // Charger les settings depuis localStorage
  useEffect(() => {
    if (!IS_DEV) return; // Pas de localStorage en prod
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Erreur chargement settings debug:', error);
    }
  }, []);

  // Sauvegarder les settings
  const updateSettings = useCallback((updates) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      if (IS_DEV) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
        } catch (error) {
          console.warn('Erreur sauvegarde settings debug:', error);
        }
      }
      onStateChange?.(newSettings);
      return newSettings;
    });
  }, [onStateChange]);

  // Toggle helper pour les settings
  const toggleSetting = useCallback((key) => {
    updateSettings({ [key]: !settings[key] });
  }, [settings, updateSettings]);

  // Mise à jour des stats avec throttle
  const throttledUpdateStats = useThrottle(() => {
    if (!mountedRef.current) return;
    
    const debugStats = runtimeDebugger.getStats?.() || {
      total: 0,
      fixed: 0,
      failed: 0,
      unread: 0
    };
    
    setStats(debugStats);
    setUnreadCount(debugStats.unread || 0);
  }, UPDATE_THROTTLE);

  const updateStats = useCallback(() => {
    throttledUpdateStats();
  }, [throttledUpdateStats]);

  // Handlers avec cleanup
  useEffect(() => {
    handlersRef.current = {
      errorDetected: updateStats,
      fixApplied: updateStats,
      fixStart: () => mountedRef.current && setIsFixing(true),
      fixComplete: () => mountedRef.current && setIsFixing(false),
      fixFailed: () => mountedRef.current && setIsFixing(false)
    };
  }, [updateStats]);

  // Écouter les événements
  useEffect(() => {
    if (!IS_DEV) return; // Pas de debug en prod

    mountedRef.current = true;
    
    updateStats();

    const { errorDetected, fixApplied, fixStart, fixComplete, fixFailed } = handlersRef.current;

    runtimeDebugger.on('error-detected', errorDetected);
    runtimeDebugger.on('fix-applied', fixApplied);
    runtimeDebugger.on('fix-start', fixStart);
    runtimeDebugger.on('fix-complete', fixComplete);
    runtimeDebugger.on('fix-failed', fixFailed);

    return () => {
      mountedRef.current = false;
      runtimeDebugger.off('error-detected', errorDetected);
      runtimeDebugger.off('fix-applied', fixApplied);
      runtimeDebugger.off('fix-start', fixStart);
      runtimeDebugger.off('fix-complete', fixComplete);
      runtimeDebugger.off('fix-failed', fixFailed);
    };
  }, [updateStats]);

  // Hotkey handler (Ctrl+`)
  useEffect(() => {
    if (!IS_DEV || !hotkey) return;

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === hotkey) {
        e.preventDefault();
        toggleConsole();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkey]);

  // Gestionnaire toggle console avec mise à jour correcte
  const toggleConsole = useCallback(() => {
    setConsoleOpen(prev => {
      const next = !prev;

      // Marquer comme lu quand on ouvre la console
      if (next && runtimeDebugger.markAllAsRead) {
        runtimeDebugger.markAllAsRead();
        setUnreadCount(0);
      }

      return next;
    });
  }, []);

  const handleOpenConsole = useCallback(() => {
    setConsoleOpen(true);
    if (runtimeDebugger.markAllAsRead) {
      runtimeDebugger.markAllAsRead();
      setUnreadCount(0);
    }
  }, []);

  const handleCloseConsole = useCallback(() => {
    setConsoleOpen(false);
  }, []);

  // Stats mémoïsées
  const memoizedStats = useMemo(() => {
    if (!stats) return null;
    
    return {
      total: stats.total || 0,
      fixed: stats.fixed || 0,
      failed: stats.failed || 0,
      successRate: stats.total > 0 
        ? Math.round((stats.fixed / stats.total) * 100) 
        : 0
    };
  }, [stats]);

  // Rendu selon le mode
  if (!IS_DEV) return null; // Rien en production

  if (statusBar) {
    return (
      <div className="debug-panel status-bar">
        <StatusBarDebugButton
          onClick={toggleConsole}
          isActive={consoleOpen}
          errorCount={unreadCount}
          enableSound={settings.sound}
        />
        
        {consoleOpen && (
          <DebugConsole
            isOpen={consoleOpen}
            onClose={handleCloseConsole}
            initialFilter={settings.filter}
            autoScroll={settings.autoScroll}
          />
        )}

        <style jsx>{`
          .debug-panel.status-bar {
            display: inline-block;
            margin-left: 8px;
          }
        `}</style>
      </div>
    );
  }

  if (mini) {
    return (
      <div className="debug-panel mini">
        <MiniDebugButton
          onClick={toggleConsole}
          errorCount={unreadCount}
          enableSound={settings.sound}
        />
        
        {consoleOpen && (
          <DebugConsole
            isOpen={consoleOpen}
            onClose={handleCloseConsole}
            initialFilter={settings.filter}
            autoScroll={settings.autoScroll}
          />
        )}
      </div>
    );
  }

  // Mode normal
  return (
    <div className="debug-panel">
      {/* Bouton flottant */}
      <DebugButton
        onClick={toggleConsole}
        position={position}
        enableSound={settings.sound}
        enableDrag={enableDrag}
      />

      {/* Console */}
      {consoleOpen && (
        <DebugConsole
          isOpen={consoleOpen}
          onClose={handleCloseConsole}
          initialFilter={settings.filter}
          autoScroll={settings.autoScroll}
        />
      )}

      {/* Notifications */}
      {settings.notifications && <DebugNotification />}

      {/* Indicateur de correction en cours */}
      {isFixing && (
        <div className="fixing-indicator">
          <div className="spinner" />
          <span>L'IA corrige le code...</span>
          <span className="fixing-progress">🤖</span>
        </div>
      )}

      {/* Panneau de contrôle (hover) */}
      {consoleOpen && (
        <div className="debug-controls">
          <div className="controls-header">
            <span>⚙️ Contrôles</span>
            <span className="hotkey-hint">Ctrl+{hotkey}</span>
          </div>
          
          <div className="controls-content">
            <label className="control-item">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={() => toggleSetting('notifications')}
              />
              <span>Notifications</span>
            </label>

            <label className="control-item">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={() => toggleSetting('sound')}
              />
              <span>Sons</span>
            </label>

            <label className="control-item">
              <input
                type="checkbox"
                checked={settings.autoScroll}
                onChange={() => toggleSetting('autoScroll')}
              />
              <span>Auto-scroll</span>
            </label>

            <div className="control-item">
              <span>Filtre:</span>
              <select
                value={settings.filter}
                onChange={(e) => updateSettings({ filter: e.target.value })}
              >
                <option value="all">Tous</option>
                <option value="error">Erreurs</option>
                <option value="warning">Avertissements</option>
                <option value="fix">Corrections</option>
              </select>
            </div>
          </div>

          {memoizedStats && (
            <div className="controls-stats">
              <div className="stat-item">
                <span className="stat-label">Total</span>
                <span className="stat-value">{memoizedStats.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">✅ Fix</span>
                <span className="stat-value">{memoizedStats.fixed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">❌ Échec</span>
                <span className="stat-value">{memoizedStats.failed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">📊 Taux</span>
                <span className="stat-value">{memoizedStats.successRate}%</span>
              </div>
            </div>
          )}

          <SoundControl className="controls-sound" />
        </div>
      )}

      <style jsx>{`
        .debug-panel {
          position: relative;
        }

        .fixing-indicator {
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: linear-gradient(135deg, #2196f3, #1976d2);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 9997;
          box-shadow: 0 4px 15px rgba(33, 150, 243, 0.4);
          animation: slideUp 0.3s ease;
        }

        .fixing-progress {
          animation: pulse 1.5s infinite;
        }

        .debug-controls {
          position: fixed;
          bottom: 20px;
          left: 20px;
          width: 280px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          z-index: 9999;
          animation: slideIn 0.3s ease;
        }

        .controls-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
          border-radius: 8px 8px 0 0;
          font-weight: bold;
          color: #007bff;
        }

        .hotkey-hint {
          font-size: 10px;
          color: #888;
          background: #2d2d2d;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .controls-content {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-bottom: 1px solid #3e3e3e;
        }

        .control-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #d4d4d4;
        }

        .control-item select {
          margin-left: auto;
          padding: 2px 4px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 3px;
          color: #d4d4d4;
        }

        .controls-stats {
          padding: 8px 12px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .stat-item {
          text-align: center;
          background: #2d2d2d;
          padding: 4px;
          border-radius: 4px;
        }

        .stat-label {
          display: block;
          font-size: 10px;
          color: #888;
        }

        .stat-value {
          display: block;
          font-size: 16px;
          font-weight: bold;
          color: #007bff;
        }

        .controls-sound {
          margin: 8px;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

// =============================
// COMPOSANT WRAPPER POUR L'ÉDITEUR
// =============================

export const EditorDebugPanel = ({ editorRef, ...props }) => {
  const [position, setPosition] = useState('bottom-right');

  // Adapter la position selon l'éditeur
  useEffect(() => {
    if (!editorRef?.current) return;

    const updatePosition = () => {
      const rect = editorRef.current.getBoundingClientRect();
      // Logique simple pour positionner dans l'éditeur
      setPosition('bottom-right');
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [editorRef]);

  return <DebugPanel position={position} {...props} />;
};

// =============================
// HOOK POUR UTILISER LE DEBUG PANEL
// =============================

export const useDebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    enabled: IS_DEV,
    sound: true,
    notifications: true
  });

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const updateSettings = useCallback((updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    isOpen,
    settings,
    open,
    close,
    toggle,
    updateSettings,
    DebugPanel: useCallback((props) => (
      <DebugPanel 
        defaultOpen={isOpen} 
        enableSound={settings.sound}
        {...props} 
      />
    ), [isOpen, settings.sound])
  };
};

// =============================
// EXPORT
// =============================

export default DebugPanel;
EditorDebugPanel.propTypes = {
  editorRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  props: PropTypes.any.isRequired,
};
