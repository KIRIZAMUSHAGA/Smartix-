/**
 * Point d'entrée UI pour le module de débogage
 * 
 * Exporte tous les composants UI du système de débogage
 * - Notifications d'erreur
 * - Console de logs
 * - Boutons flottants
 * - Panneau principal
 * - Contrôle des sons
 */

import { useState, useEffect } from 'react';

// =============================
// COMPOSANTS PRINCIPAUX
// =============================

export { DebugNotification } from './DebugNotification';
export { DebugConsole } from './DebugConsole';
export { DebugButton, MiniDebugButton, StatusBarDebugButton } from './DebugButton';
export { DebugPanel, EditorDebugPanel, useDebugPanel } from './DebugPanel';

// =============================
// COMPOSANTS SONORES
// =============================

export { SoundControl, useSound } from '../utils/sound';

// =============================
// UTILITAIRES UI
// =============================

/**
 * Couleurs prédéfinies pour les différents types d'événements
 */
export const UI_COLORS = {
  error: '#f48771',
  warning: '#ffd93e',
  success: '#4caf50',
  info: '#2196f3',
  fix: '#b5cea8',
  debug: '#9cdcfe',
  critical: '#f44336'
};

/**
 * Icônes pour les différents types d'événements
 */
export const UI_ICONS = {
  error: '❌',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
  fix: '🔧',
  debug: '🐛',
  critical: '🔥'
};

// =============================
// ANIMATIONS PARTAGÉES
// =============================

/**
 * Keyframes d'animation partagées (à injecter dans les composants)
 */
export const SHARED_ANIMATIONS = `
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

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
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

  @keyframes slideDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100%);
      opacity: 0;
    }
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes bounce {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
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
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`;

// =============================
// STYLES PARTAGÉS
// =============================

/**
 * Classes CSS partagées (version objet pour styled-components)
 */
export const SHARED_STYLES = {
  // Boutons
  button: {
    primary: {
      background: '#2196f3',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
      transition: 'all 0.2s'
    },
    secondary: {
      background: '#3e3e3e',
      color: '#d4d4d4',
      border: 'none',
      borderRadius: '4px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: '13px',
      transition: 'all 0.2s'
    },
    danger: {
      background: '#f44336',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: '13px',
      transition: 'all 0.2s'
    }
  },

  // Badges
  badge: {
    error: {
      background: '#f44336',
      color: 'white',
      borderRadius: '10px',
      padding: '2px 6px',
      fontSize: '11px',
      fontWeight: 'bold'
    },
    success: {
      background: '#4caf50',
      color: 'white',
      borderRadius: '10px',
      padding: '2px 6px',
      fontSize: '11px',
      fontWeight: 'bold'
    },
    warning: {
      background: '#ffd93e',
      color: '#1e1e1e',
      borderRadius: '10px',
      padding: '2px 6px',
      fontSize: '11px',
      fontWeight: 'bold'
    }
  },

  // Conteneurs
  container: {
    card: {
      background: '#2d2d2d',
      border: '1px solid #3e3e3e',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
    },
    popup: {
      position: 'fixed',
      zIndex: 10000,
      background: '#2d2d2d',
      border: '1px solid #3e3e3e',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
    }
  },

  // Texte
  text: {
    error: { color: '#f48771' },
    success: { color: '#b5cea8' },
    warning: { color: '#ffd93e' },
    info: { color: '#9cdcfe' },
    muted: { color: '#888' }
  },

  // Scrollbar
  scrollbar: {
    thin: {
      scrollbarWidth: 'thin',
      scrollbarColor: '#4e4e4e #2d2d2d'
    }
  }
};

// =============================
// UTILITAIRES DE POSITION
// =============================

/**
 * Calcule la position d'un élément par rapport à un autre
 */
export const calculatePosition = (triggerRect, contentRect, position = 'bottom') => {
  const positions = {
    'bottom': {
      top: triggerRect.bottom + 8,
      left: triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2)
    },
    'bottom-left': {
      top: triggerRect.bottom + 8,
      left: triggerRect.left
    },
    'bottom-right': {
      top: triggerRect.bottom + 8,
      left: triggerRect.right - contentRect.width
    },
    'top': {
      top: triggerRect.top - contentRect.height - 8,
      left: triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2)
    },
    'top-left': {
      top: triggerRect.top - contentRect.height - 8,
      left: triggerRect.left
    },
    'top-right': {
      top: triggerRect.top - contentRect.height - 8,
      left: triggerRect.right - contentRect.width
    }
  };

  return positions[position] || positions.bottom;
};

// =============================
// HOOKS UI PARTAGÉS
// =============================

/**
 * Hook pour gérer le clic en dehors d'un élément
 */
export const useOutsideClick = (ref, handler) => {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

/**
 * Hook pour gérer les raccourcis clavier
 */
export const useHotkey = (key, callback, ctrlKey = false) => {
  useEffect(() => {
    const handler = (e) => {
      if ((!ctrlKey || e.ctrlKey) && e.key === key) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, ctrlKey]);
};

/**
 * Hook pour animer l'entrée/sortie
 */
export const useTransition = (isOpen, duration = 200) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animation, setAnimation] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setAnimation('slideIn');
    } else {
      setAnimation('slideOut');
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]);

  return { shouldRender, animation };
};

// =============================
// DOCUMENTATION DES EXPORTS
// =============================

/**
 * @module @vibe-coding/ui
 * 
 * Composants UI pour le système de débogage :
 * 
 * ## Composants principaux
 * - `DebugPanel` - Panneau principal avec bouton flottant et console
 * - `DebugConsole` - Console de logs avec filtres
 * - `DebugNotification` - Notifications d'erreur
 * - `DebugButton` - Bouton flottant principal
 * - `MiniDebugButton` - Version miniature pour l'éditeur
 * - `StatusBarDebugButton` - Version pour barre d'état
 * 
 * ## Composants sonores
 * - `SoundControl` - Contrôle des notifications sonores
 * - `useSound` - Hook pour utiliser les sons
 * 
 * ## Hooks utilitaires
 * - `useOutsideClick` - Détecte les clics en dehors d'un élément
 * - `useHotkey` - Gère les raccourcis clavier
 * - `useTransition` - Gère les animations d'entrée/sortie
 * 
 * ## Constantes
 * - `UI_COLORS` - Couleurs par type d'événement
 * - `UI_ICONS` - Icônes par type d'événement
 * - `SHARED_ANIMATIONS` - Animations CSS partagées
 * - `SHARED_STYLES` - Styles partagés (objet)
 */

// Version du module UI
export const UI_VERSION = '1.0.0';

export default {
  // Composants
  DebugPanel,
  EditorDebugPanel,
  DebugConsole,
  DebugNotification,
  DebugButton,
  MiniDebugButton,
  StatusBarDebugButton,
  SoundControl,
  
  // Hooks
  useDebugPanel,
  useSound,
  useOutsideClick,
  useHotkey,
  useTransition,
  
  // Constantes
  UI_COLORS,
  UI_ICONS,
  SHARED_ANIMATIONS,
  SHARED_STYLES,
  UI_VERSION
};
