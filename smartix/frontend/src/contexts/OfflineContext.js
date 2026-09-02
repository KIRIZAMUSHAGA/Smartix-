// src/contexts/OfflineContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import OfflineIndicator from '../components/ui/OfflineIndicator';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../config/api';

const OfflineContext = createContext();

// =============================
// CONSTANTES
// =============================
const DEFAULT_AUTO_HIDE_DELAY = 3000;
const DEBOUNCE_DELAY = 200;
const PING_TIMEOUT = 5000;
const PING_URL = `${API_BASE_URL}/ping`;

// =============================
// UTILITAIRES
// =============================

/**
 * Vérifie la vraie connectivité internet via un ping
 */
const checkRealConnectivity = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
    
    const response = await fetch(PING_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Hook pour la détection de connectivité réelle
 */
const useRealConnectivity = (isOnline, enabled) => {
  const [hasRealConnection, setHasRealConnection] = useState(isOnline);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnectivity = useCallback(async () => {
    if (!enabled || isChecking) return isOnline;
    
    setIsChecking(true);
    const isConnected = await checkRealConnectivity();
    setHasRealConnection(isConnected);
    setIsChecking(false);
    
    return isConnected;
  }, [isChecking, enabled, isOnline]);

  // Vérifier périodiquement uniquement si activé
  useEffect(() => {
    if (!enabled) {
      setHasRealConnection(isOnline);
      return;
    }
    
    if (!isOnline) {
      setHasRealConnection(false);
      return;
    }
    
    const interval = setInterval(() => {
      checkConnectivity();
    }, 30000);
    
    checkConnectivity();
    
    return () => clearInterval(interval);
  }, [isOnline, enabled, checkConnectivity]);

  return { hasRealConnection, isChecking, checkConnectivity };
};

// =============================
// PROVIDER
// =============================
export const OfflineProvider = ({ 
  children, 
  autoHideDelay = DEFAULT_AUTO_HIDE_DELAY,
  showRetryButton = true,
  showDismissButton = false,
  enableVibration = true,
  onRetry = null,
  onDismiss = null,
  customMessage = null,
  enableRealConnectivityCheck = true
}) => {
  // États
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [shouldShowIndicator, setShouldShowIndicator] = useState(!isOnline);
  const [isExiting, setIsExiting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isManuallyDismissed, setIsManuallyDismissed] = useState(false);
  
  // Refs pour éviter les stale closures
  const timeoutRef = useRef(null);
  const exitTimeoutRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const shouldShowRef = useRef(shouldShowIndicator);
  const isInitializedRef = useRef(false);
  const retryCallbackRef = useRef(onRetry);
  const dismissCallbackRef = useRef(onDismiss);
  
  // Référence vers les listeners (global mais géré par le provider)
  const listenersRef = useRef(new Set());
  
  // Vraie connectivité
  const { hasRealConnection, isChecking, checkConnectivity } = useRealConnectivity(isOnline, enableRealConnectivityCheck);
  
  // Mettre à jour les références
  useEffect(() => {
    shouldShowRef.current = shouldShowIndicator;
  }, [shouldShowIndicator]);
  
  useEffect(() => {
    retryCallbackRef.current = onRetry;
  }, [onRetry]);
  
  useEffect(() => {
    dismissCallbackRef.current = onDismiss;
  }, [onDismiss]);

  // Nettoyer les timeouts
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  // Mettre à jour l'état et notifier les listeners
  const updateOnlineStatus = useCallback(async (online) => {
    // Vérifier la vraie connectivité si activé
    let isActuallyOnline = online;
    
    if (enableRealConnectivityCheck && online) {
      setIsReconnecting(true);
      const hasReal = await checkConnectivity();
      isActuallyOnline = hasReal;
      setIsReconnecting(false);
    }
    
    // Mise à jour de l'état
    setIsOnline(isActuallyOnline);
    
    // Notifier tous les listeners
    listenersRef.current.forEach(listener => {
      try {
        listener(isActuallyOnline);
      } catch (err) {
        console.error('Error in offline listener:', err);
      }
    });
    
    return isActuallyOnline;
  }, [enableRealConnectivityCheck, checkConnectivity]);

  // Gérer l'affichage/masquage de l'indicateur
  const handleStatusChange = useCallback(async (online) => {
    clearTimeouts();
    
    const isActuallyOnline = await updateOnlineStatus(online);
    
    // Réinitialiser le dismiss manuel quand on revient en ligne
    if (isActuallyOnline && isManuallyDismissed) {
      setIsManuallyDismissed(false);
    }
    
    if (!isActuallyOnline && !isManuallyDismissed) {
      // Hors ligne : afficher immédiatement
      setShouldShowIndicator(true);
      setIsExiting(false);
    } else if (isActuallyOnline && shouldShowRef.current && !isManuallyDismissed) {
      // En ligne et indicateur visible : démarrer l'animation de sortie
      setIsExiting(true);
      
      // Attendre la fin de l'animation avant de masquer
      exitTimeoutRef.current = setTimeout(() => {
        setShouldShowIndicator(false);
        setIsExiting(false);
      }, 300);
      
      // Cacher après autoHideDelay si spécifié
      if (autoHideDelay > 0) {
        timeoutRef.current = setTimeout(() => {
          if (shouldShowRef.current && !isExiting && !isManuallyDismissed) {
            setIsExiting(true);
          }
        }, autoHideDelay);
      }
    }
  }, [clearTimeouts, updateOnlineStatus, autoHideDelay, isExiting, isManuallyDismissed]);

  // Écouter les événements de connexion avec debounce
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => {
      // Debounce pour éviter les changements rapides
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        handleStatusChange(true);
      }, DEBOUNCE_DELAY);
    };
    
    const handleOffline = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        handleStatusChange(false);
      }, DEBOUNCE_DELAY);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initialisation (une seule fois)
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      handleStatusChange(navigator.onLine);
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [handleStatusChange]);

  // Ajouter un listener global
  const addListener = useCallback((callback) => {
    listenersRef.current.add(callback);
    // Retourner la fonction de nettoyage
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  // Récupérer le statut actuel (synchrone)
  const getIsOnline = useCallback(() => isOnline, [isOnline]);
  
  // Récupérer le statut de reconnexion
  const getIsReconnecting = useCallback(() => isReconnecting, [isReconnecting]);
  
  // Vérifier manuellement la connexion
  const checkConnection = useCallback(async () => {
    const result = await checkConnectivity();
    handleStatusChange(result);
    return result;
  }, [checkConnectivity, handleStatusChange]);

  // Tenter une reconnexion
  const retryConnection = useCallback(async () => {
    setIsReconnecting(true);
    
    try {
      const isConnected = await checkConnectivity();
      
      if (isConnected) {
        await handleStatusChange(true);
        return true;
      } else {
        // Échec de la reconnexion
        return false;
      }
    } finally {
      setIsReconnecting(false);
    }
  }, [checkConnectivity, handleStatusChange]);

  // Masquer manuellement l'indicateur
  const dismissIndicator = useCallback(() => {
    setIsManuallyDismissed(true);
    setShouldShowIndicator(false);
    setIsExiting(false);
    dismissCallbackRef.current?.();
    
    // Réinitialiser après un délai (pour permettre la réapparition)
    setTimeout(() => {
      setIsManuallyDismissed(false);
    }, 60000); // 1 minute
  }, []);

  // Valeur du contexte
  const contextValue = {
    isOnline,
    isOffline: !isOnline,
    isReconnecting,
    hasRealConnection,
    addListener,
    getIsOnline,
    getIsReconnecting,
    retryConnection,
    checkConnection,
    dismissIndicator
  };

  // Message personnalisé
  const getMessage = () => {
    if (customMessage) return customMessage;
    if (isReconnecting) return '🔄 Reconnexion en cours...';
    if (isExiting) return '✅ Connexion rétablie !';
    if (!hasRealConnection && isOnline) return '📡 Connexion limitée - Vérifiez votre réseau';
    return '📱 Mode hors-ligne - Certaines actions sont désactivées';
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
      <OfflineIndicator
        isOnline={isOnline}
        visible={shouldShowIndicator && !isManuallyDismissed}
        isExiting={isExiting}
        isReconnecting={isReconnecting}
        hasRealConnection={hasRealConnection}
        message={getMessage()}
        showRetryButton={showRetryButton}
        showDismissButton={showDismissButton}
        enableVibration={enableVibration}
        onRetry={retryConnection}
        onDismiss={dismissIndicator}
      />
    </OfflineContext.Provider>
  );
};

// =============================
// HOOKS
// =============================

/**
 * Hook principal pour utiliser le statut hors-ligne (réactif)
 */
export const useOfflineStatus = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineStatus must be used within OfflineProvider');
  }
  return context;
};

/**
 * Hook pour obtenir le statut hors-ligne sans re-render (valeur instantanée)
 * ⚠️ Non réactif - utile pour les callbacks
 */
export const useOfflineStatusSnapshot = () => {
  const { getIsOnline, getIsReconnecting } = useOfflineStatus();
  return {
    isOnline: getIsOnline(),
    isReconnecting: getIsReconnecting()
  };
};

OfflineProvider.propTypes = {
  children: PropTypes.node.isRequired,
  autoHideDelay: PropTypes.number,
  showRetryButton: PropTypes.bool,
  showDismissButton: PropTypes.bool,
  enableVibration: PropTypes.bool,
  onRetry: PropTypes.func,
  onDismiss: PropTypes.func,
  customMessage: PropTypes.any,
  enableRealConnectivityCheck: PropTypes.bool,
};

export default OfflineProvider;
