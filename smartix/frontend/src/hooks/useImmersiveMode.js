
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

const useImmersiveMode = (options = {}) => {
  const {
    toastDuration = 1000,
    persistPreference = true,
    storageKey = 'immersive_mode_preference',
    autoDisableOnVisibility = true,
    enableHaptic = true,
    onModeChange = null
  } = options;

  // Charger la préférence depuis localStorage
  const getInitialMode = () => {
    if (!persistPreference) return false;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'true';
    } catch {
      return false;
    }
  };

  const [immersiveMode, setImmersiveMode] = useState(getInitialMode);
  const toastTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Nettoyage au démontage
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Sauvegarder la préférence
  useEffect(() => {
    if (persistPreference) {
      try {
        localStorage.setItem(storageKey, String(immersiveMode));
      } catch (e) {
        console.warn('Failed to save immersive mode preference:', e);
      }
    }
    onModeChange?.(immersiveMode);
  }, [immersiveMode, persistPreference, storageKey, onModeChange]);

  // Feedback haptique
  const vibrate = useCallback((duration = 20) => {
    if (enableHaptic && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }, [enableHaptic]);

  // Afficher un toast avec debounce
  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    toast.info(message, { duration: toastDuration });
    
    // Pas besoin de timeout pour le toast, sonner gère déjà la fermeture
  }, [toastDuration]);

  // Activer le mode immersion
  const enableImmersiveMode = useCallback(() => {
    if (immersiveMode) return;
    setImmersiveMode(true);
    showToast('🌊 Mode immersion activé');
    vibrate(30);
  }, [immersiveMode, showToast, vibrate]);

  // Désactiver le mode immersion
  const disableImmersiveMode = useCallback(() => {
    if (!immersiveMode) return;
    setImmersiveMode(false);
    showToast('📱 Mode normal');
    vibrate(20);
  }, [immersiveMode, showToast, vibrate]);

  // Basculer le mode immersion
  const toggleImmersiveMode = useCallback(() => {
    setImmersiveMode(prev => {
      const newMode = !prev;
      showToast(newMode ? '🌊 Mode immersion activé' : '📱 Mode normal');
      vibrate(newMode ? 30 : 20);
      return newMode;
    });
  }, [showToast, vibrate]);

  // Réinitialiser (désactiver)
  const resetImmersiveMode = useCallback(() => {
    if (immersiveMode) {
      setImmersiveMode(false);
      vibrate(20);
    }
  }, [immersiveMode, vibrate]);

  // =============================
  // AUTO-DÉSACTIVATION SUR VISIBILITÉ
  // =============================
  useEffect(() => {
    if (!autoDisableOnVisibility) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden && immersiveMode) {
        disableImmersiveMode();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [immersiveMode, autoDisableOnVisibility, disableImmersiveMode]);

  // =============================
  // DÉTECTION DU PLEIN ÉCRAN NATIF (optionnel)
  // =============================
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      if (isFullscreen !== immersiveMode) {
        // Synchroniser si nécessaire (optionnel)
        // setImmersiveMode(isFullscreen);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [immersiveMode]);

  // =============================
  // RESPECTER LES PRÉFÉRENCES DE MOUVEMENT
  // =============================
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Appliquer les classes CSS pour le mode immersion
  useEffect(() => {
    if (immersiveMode && !prefersReducedMotion) {
      document.body.classList.add('immersive-mode');
    } else {
      document.body.classList.remove('immersive-mode');
    }
    
    return () => {
      document.body.classList.remove('immersive-mode');
    };
  }, [immersiveMode, prefersReducedMotion]);

  return {
    immersiveMode,
    setImmersiveMode,
    enableImmersiveMode,
    disableImmersiveMode,
    toggleImmersiveMode,
    resetImmersiveMode,
    prefersReducedMotion
  };
};

export default useImmersiveMode;
