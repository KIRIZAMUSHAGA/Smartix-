/**
 * DebugButton - Bouton flottant pour ouvrir la console de débogage
 * 
 * Affiche un badge avec le nombre d'erreurs
 * Animation pulsante quand des erreurs sont détectées
 * Supporte le drag & drop pour repositionner
 * Tooltip avancé avec les dernières erreurs
 * Support sonore avec différents types (error, warning, success)
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { runtimeDebugger } from '../runtime/RuntimeDebugger';
import { playSound, useSound, initializeAudio } from '../utils/sound';

// =============================
// CONSTANTES
// =============================
const BUTTON_SIZE = 50;
const BUTTON_EXPANDED_WIDTH = 120;
const ANIMATION_DURATION = 200; // ms

// =============================
// POSITIONS
// =============================
const POSITIONS = {
  'top-left': { top: 20, left: 20 },
  'top-right': { top: 20, right: 20 },
  'bottom-left': { bottom: 20, left: 20 },
  'bottom-right': { bottom: 20, right: 20 }
};

// =============================
// HOOK PERSO : Détection des nouvelles erreurs
// =============================
const useNewErrorDetection = (errorCount) => {
  const [prevCount, setPrevCount] = useState(errorCount);
  const [hasNewError, setHasNewError] = useState(false);

  useEffect(() => {
    if (errorCount > prevCount) {
      setHasNewError(true);
      const timer = setTimeout(() => setHasNewError(false), 1000);
      return () => clearTimeout(timer);
    }
    setPrevCount(errorCount);
  }, [errorCount, prevCount]);

  return hasNewError;
};

// =============================
// HOOK PERSO : Gestion des sons avec cooldown
// =============================
const useSoundEffect = (enableSound) => {
  const { play } = useSound();
  const lastPlayedRef = useRef(0);
  const COOLDOWN = 1000; // 1 seconde entre les sons

  const playErrorSound = useCallback(async (type = 'error') => {
    if (!enableSound) return false;
    
    const now = Date.now();
    if (now - lastPlayedRef.current < COOLDOWN) return false;
    
    lastPlayedRef.current = now;
    return await play(type, { force: true });
  }, [enableSound, play]);

  return { playErrorSound };
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
export const DebugButton = ({ 
  onClick, 
  position = 'bottom-right',
  enableSound = false,
  enableDrag = true
}) => {
  const [hasErrors, setHasErrors] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [isFixing, setIsFixing] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [recentErrors, setRecentErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(null);
  const [soundInitialized, setSoundInitialized] = useState(false);
  
  const buttonRef = useRef(null);
  const mountedRef = useRef(true);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const handlersRef = useRef({});
  const { playErrorSound } = useSoundEffect(enableSound);

  // Détection des nouvelles erreurs
  const hasNewError = useNewErrorDetection(errorCount);

  // Initialiser les sons après interaction utilisateur
  useEffect(() => {
    if (!enableSound || soundInitialized) return;

    const handleUserInteraction = async () => {
      await initializeAudio();
      setSoundInitialized(true);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };

    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, [enableSound, soundInitialized]);

  // Mise à jour des statistiques
  const updateStats = useCallback(() => {
    if (!mountedRef.current) return;
    
    const stats = runtimeDebugger.getStats?.() || {
      total: 0,
      fixed: 0,
      failed: 0
    };
    
    const totalErrors = stats.total || 0;
    setHasErrors(totalErrors > 0);
    setErrorCount(totalErrors);
    
    // Récupérer les erreurs récentes
    const recent = runtimeDebugger.getRecentErrors?.() || [];
    setRecentErrors(recent.slice(0, 3));
  }, []);

  // Configuration des handlers
  useEffect(() => {
    handlersRef.current = {
      errorDetected: updateStats,
      fixApplied: updateStats,
      fixStart: () => mountedRef.current && setIsFixing(true),
      fixComplete: () => mountedRef.current && setIsFixing(false),
      fixFailed: () => mountedRef.current && setIsFixing(false)
    };
  }, [updateStats]);

  // Écouter les changements d'état
  useEffect(() => {
    mountedRef.current = true;

    // Initialiser les stats
    updateStats();

    const { errorDetected, fixApplied, fixStart, fixComplete, fixFailed } = handlersRef.current;

    // Écouter les événements
    runtimeDebugger.on('error-detected', errorDetected);
    runtimeDebugger.on('fix-applied', fixApplied);
    runtimeDebugger.on('fix-start', fixStart);
    runtimeDebugger.on('fix-complete', fixComplete);
    runtimeDebugger.on('fix-failed', fixFailed);

    // Sound effect avec gestion du type
    const handleSound = async (data) => {
      if (!enableSound || !soundInitialized) return;
      
      // Déterminer le type de son selon la sévérité
      let soundType = 'error';
      if (data?.error?.type === 'critical') {
        soundType = 'critical';
      } else if (data?.error?.type === 'warning') {
        soundType = 'warning';
      }
      
      await playErrorSound(soundType);
    };
    
    if (enableSound) {
      runtimeDebugger.on('error-detected', handleSound);
    }

    return () => {
      mountedRef.current = false;
      runtimeDebugger.off('error-detected', errorDetected);
      runtimeDebugger.off('fix-applied', fixApplied);
      runtimeDebugger.off('fix-start', fixStart);
      runtimeDebugger.off('fix-complete', fixComplete);
      runtimeDebugger.off('fix-failed', fixFailed);
      if (enableSound) {
        runtimeDebugger.off('error-detected', handleSound);
      }
    };
  }, [updateStats, enableSound, playErrorSound, soundInitialized]);

  // Gestion du drag & drop
  const handleDragStart = useCallback((e) => {
    if (!enableDrag) return;
    
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY
    };
  }, [enableDrag]);

  const handleDragMove = useCallback((e) => {
    if (!dragging) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const currentPos = dragPosition || POSITIONS[position];
    const newPos = {
      top: (currentPos.top || 0) + dy,
      left: (currentPos.left || 0) + dx
    };

    // Limiter aux bords de l'écran
    const maxX = window.innerWidth - BUTTON_SIZE;
    const maxY = window.innerHeight - BUTTON_SIZE;

    newPos.left = Math.max(0, Math.min(maxX, newPos.left));
    newPos.top = Math.max(0, Math.min(maxY, newPos.top));

    setDragPosition(newPos);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, [dragging, dragPosition, position]);

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [dragging, handleDragMove, handleDragEnd]);

  // Gestion du clic
  const handleClick = () => {
    if (dragging) return;
    setIsActive(!isActive);
    onClick?.();
  };

  // Test sonore manuel
  const handleTestSound = useCallback(async () => {
    if (!enableSound) return;
    await playErrorSound('info');
  }, [enableSound, playErrorSound]);

  // Positions mémoïsées
  const basePosition = useMemo(() => 
    dragPosition || POSITIONS[position] || POSITIONS['bottom-right'],
    [dragPosition, position]
  );

  // Styles mémoïsés
  const buttonStyle = useMemo(() => ({
    ...basePosition,
    position: 'fixed',
    width: isHovered ? BUTTON_EXPANDED_WIDTH : BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    background: isFixing 
      ? 'linear-gradient(135deg, #2196f3, #1976d2)'
      : hasErrors 
        ? 'linear-gradient(135deg, #f44336, #d32f2f)'
        : 'linear-gradient(135deg, #4caf50, #388e3c)',
    border: 'none',
    color: 'white',
    fontSize: isHovered ? 14 : 24,
    fontWeight: 'bold',
    cursor: enableDrag ? (dragging ? 'grabbing' : 'grab') : 'pointer',
    boxShadow: hasErrors 
      ? '0 4px 20px rgba(244, 67, 54, 0.4)'
      : '0 4px 15px rgba(0,0,0,0.3)',
    transition: dragging 
      ? 'none' 
      : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: isHovered ? '0 20px' : 0,
    cursor: dragging ? 'grabbing' : (enableDrag ? 'grab' : 'pointer')
  }), [basePosition, isHovered, isFixing, hasErrors, dragging, enableDrag]);

  // Badge style mémoïsé
  const badgeStyle = useMemo(() => ({
    position: 'absolute',
    top: -5,
    right: -5,
    background: isFixing ? '#2196f3' : '#f44336',
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    animation: hasErrors && !isFixing && !hasNewError ? 'pulse 2s infinite' : 'none',
    transform: hasNewError ? 'scale(1.5)' : 'scale(1)',
    transition: 'transform 0.2s ease'
  }), [isFixing, hasErrors, hasNewError]);

  // Tooltip avec les dernières erreurs
  const renderTooltip = () => {
    if (!isHovered || recentErrors.length === 0) return null;

    return (
      <div className="debug-tooltip">
        <div className="tooltip-header">
          <span>🐛 Erreurs récentes</span>
          {enableSound && soundInitialized && (
            <button 
              className="tooltip-sound-test"
              onClick={handleTestSound}
              title="Tester le son"
            >
              🔊
            </button>
          )}
        </div>
        <div className="tooltip-content">
          {recentErrors.map((err, idx) => (
            <div key={idx} className="tooltip-error">
              <span className="error-icon">•</span>
              <span className="error-message" title={err.message}>
                {err.message?.substring(0, 50)}
                {err.message?.length > 50 && '...'}
              </span>
            </div>
          ))}
        </div>
        {errorCount > 3 && (
          <div className="tooltip-footer">
            +{errorCount - 3} autre(s)
          </div>
        )}
        {enableSound && !soundInitialized && (
          <div className="tooltip-footer sound-pending">
            🔇 Cliquez pour activer les sons
          </div>
        )}
      </div>
    );
  };

  return (
    <button
      ref={buttonRef}
      className={`debug-button ${hasErrors ? 'has-errors' : ''} ${isFixing ? 'is-fixing' : ''} ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleDragStart}
      style={buttonStyle}
      aria-label="Ouvrir la console de débogage"
    >
      {/* Icône principale */}
      <span className={`button-icon ${isHovered ? 'expanded' : ''}`}>
        {isFixing ? '🤖' : hasErrors ? '🐛' : '✅'}
      </span>

      {/* Texte (visible au hover) */}
      {isHovered && (
        <span className="button-text">
          {isFixing ? 'Correction...' : hasErrors ? 'Debug' : 'OK'}
        </span>
      )}

      {/* Badge de nombre d'erreurs */}
      {errorCount > 0 && !isHovered && (
        <span className="error-badge" style={badgeStyle}>
          {errorCount > 99 ? '99+' : errorCount}
        </span>
      )}

      {/* Indicateur de correction en cours */}
      {isFixing && (
        <span className="fixing-indicator">
          <span className="fixing-progress" />
        </span>
      )}

      {/* Tooltip personnalisé */}
      {renderTooltip()}

      {/* CSS inline via style tag */}
      <style jsx>{`
        .debug-button {
          position: fixed;
        }

        .debug-button:hover {
          transform: ${!dragging ? 'translateY(-2px)' : 'none'};
          box-shadow: 0 6px 25px rgba(0,0,0,0.4);
        }

        .debug-button:active {
          transform: ${!dragging ? 'translateY(1px)' : 'none'};
        }

        .debug-button.has-errors:hover {
          box-shadow: 0 6px 25px rgba(244, 67, 54, 0.5);
        }

        .debug-button.is-fixing:hover {
          box-shadow: 0 6px 25px rgba(33, 150, 243, 0.5);
        }

        .debug-button.active {
          transform: scale(1.1);
        }

        .button-icon {
          transform: scale(1.2);
          transition: transform 0.3s;
          margin-right: 0;
        }

        .button-icon.expanded {
          transform: scale(1);
          margin-right: 8px;
        }

        .button-text {
          animation: fadeIn 0.3s ease;
          white-space: nowrap;
        }

        .fixing-indicator {
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 30px;
          height: 3px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
          overflow: hidden;
        }

        .fixing-progress {
          display: block;
          width: 50%;
          height: 100%;
          background: white;
          animation: progress 1s infinite;
        }

        .debug-tooltip {
          position: absolute;
          bottom: 60px;
          right: 0;
          min-width: 200px;
          max-width: 300px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 6px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          color: #d4d4d4;
          font-size: 11px;
          overflow: hidden;
          pointer-events: none;
          z-index: 10000;
        }

        .tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
          font-weight: bold;
          color: #007bff;
        }

        .tooltip-sound-test {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 12px;
          padding: 2px 4px;
          border-radius: 3px;
        }

        .tooltip-sound-test:hover {
          color: #fff;
          background: #3e3e3e;
        }

        .tooltip-content {
          max-height: 150px;
          overflow-y: auto;
        }

        .tooltip-error {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-bottom: 1px solid #3e3e3e;
        }

        .tooltip-error:last-child {
          border-bottom: none;
        }

        .error-icon {
          color: #f48771;
        }

        .error-message {
          color: #d4d4d4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tooltip-footer {
          padding: 4px 8px;
          background: #1e1e1e;
          border-top: 1px solid #3e3e3e;
          color: #888;
          font-style: italic;
        }

        .tooltip-footer.sound-pending {
          color: #ffd93e;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
          }
        }

        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.5);
          }
        }
      `}</style>
    </button>
  );
};

// =============================
// VERSION MINI (pour l'éditeur)
// =============================
export const MiniDebugButton = React.memo(({ onClick, errorCount = 0, enableSound = false }) => {
  return (
    <button
      className="mini-debug-button"
      onClick={onClick}
      style={{
        background: errorCount > 0 ? '#f44336' : '#2d2d2d',
        border: '1px solid #3e3e3e',
        borderRadius: '4px',
        color: 'white',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s'
      }}
      title={enableSound ? "Console de débogage (sons activés)" : "Console de débogage"}
    >
      <span>🐛</span>
      {errorCount > 0 && <span>{errorCount}</span>}
      {enableSound && <span style={{ fontSize: '10px', opacity: 0.7 }}>🔊</span>}
    </button>
  );
});

MiniDebugButton.displayName = 'MiniDebugButton';

// =============================
// VERSION BARRE D'ÉTAT
// =============================
export const StatusBarDebugButton = React.memo(({ onClick, isActive, errorCount, enableSound = false }) => {
  return (
    <button
      className="status-bar-button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: isActive ? '#007bff' : '#888',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#2d2d2d'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span>🐛</span>
      {errorCount > 0 && (
        <span style={{
          background: '#f44336',
          color: 'white',
          borderRadius: '10px',
          padding: '1px 4px',
          fontSize: '10px',
          minWidth: '16px',
          textAlign: 'center'
        }}>
          {errorCount}
        </span>
      )}
      {enableSound && <span style={{ fontSize: '9px', marginLeft: '2px' }}>🔊</span>}
    </button>
  );
});

StatusBarDebugButton.displayName = 'StatusBarDebugButton';

export default DebugButton;
