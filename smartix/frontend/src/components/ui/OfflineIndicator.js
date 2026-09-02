// src/components/ui/OfflineIndicator.js
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { WifiOff, Wifi, RefreshCw, Loader2, X } from 'lucide-react';

const OfflineIndicator = ({ 
  isOnline,
  visible,
  isExiting,
  isReconnecting,
  hasRealConnection,
  message,
  showRetryButton = true,
  showDismissButton = false,
  enableVibration = true,
  onRetry = null,
  onDismiss = null
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Vibration au passage offline
  useEffect(() => {
    if (enableVibration && typeof navigator !== 'undefined' && navigator.vibrate) {
      if (!isOnline && visible && !isReconnecting) {
        navigator.vibrate(100);
      } else if (isOnline && isExiting) {
        navigator.vibrate(50);
      }
    }
  }, [isOnline, visible, isExiting, isReconnecting, enableVibration]);

  const handleRetry = useCallback(async (e) => {
    e.stopPropagation();
    if (!onRetry || isRetrying) return;

    try {
      setIsRetrying(true);
      // Vibration feedback
      if (enableVibration && navigator.vibrate) {
        navigator.vibrate(30);
      }
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, isRetrying, enableVibration]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    onDismiss?.();
    // Vibration feedback
    if (enableVibration && navigator.vibrate) {
      navigator.vibrate(20);
    }
    setTimeout(() => setIsDismissed(false), 300);
  }, [onDismiss, enableVibration]);

  // Si l'indicateur a été masqué manuellement, ne pas l'afficher
  if (!visible || isDismissed) return null;

  const getIcon = () => {
    if (isReconnecting) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (isOnline && !hasRealConnection) return <Wifi className="w-4 h-4" />;
    if (isOnline) return <Wifi className="w-4 h-4 animate-pulse" />;
    return <WifiOff className="w-4 h-4" />;
  };

  const getBgColor = () => {
    if (isReconnecting) return 'bg-blue-600 dark:bg-blue-700';
    if (isOnline && !hasRealConnection) return 'bg-orange-500 dark:bg-orange-600';
    if (isOnline) return 'bg-green-500 dark:bg-green-600';
    return 'bg-red-500 dark:bg-red-600';
  };

  const getTextColor = () => {
    // Texte blanc pour fonds foncés, texte noir pour orange/jaune
    if (isOnline && !hasRealConnection) return 'text-black';
    return 'text-white';
  };

  const getButtonStyle = () => {
    if (isOnline && !hasRealConnection) return 'bg-black/20 hover:bg-black/30 text-black';
    return 'bg-white/20 hover:bg-white/30';
  };

  const handleAnimationEnd = (e) => {
    // Nettoyer les propriétés d'animation après la fin
    if (e.target === e.currentTarget) {
      e.target.style.willChange = 'auto';
    }
  };

  return (
    <div
      role="status"
      aria-live={isOnline ? "assertive" : "polite"}
      aria-label={isOnline ? 'Connexion rétablie' : 'Mode hors-ligne'}
      className={`
        fixed top-0 left-0 right-0 
        ${getBgColor()} ${getTextColor()}
        text-center py-2.5 px-4 
        text-sm z-[9999]
        flex items-center justify-between gap-4 
        backdrop-blur-sm shadow-lg
        transition-all duration-300 ease-out
        will-change-transform
        ${isExiting ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}
      `}
      style={{ 
        paddingTop: 'env(safe-area-inset-top)',
        willChange: 'transform, opacity'
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="flex items-center justify-center gap-2 flex-1 min-w-0">
        {getIcon()}
        <span className="truncate" title={message}>
          {message}
        </span>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isOnline && showRetryButton && !isReconnecting && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={`
              flex items-center gap-1 px-3 py-1 
              rounded-full transition-all 
              text-xs font-medium 
              focus:outline-none focus:ring-2 focus:ring-white/50 
              active:scale-95
              ${getButtonStyle()}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label="Réessayer la connexion"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Connexion...' : 'Réessayer'}
          </button>
        )}
        
        {isReconnecting && (
          <div className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            Reconnexion...
          </div>
        )}
        
        {showDismissButton && !isReconnecting && (
          <button
            onClick={handleDismiss}
            className={`
              p-1 rounded-full transition-all
              focus:outline-none focus:ring-2 focus:ring-white/50
              active:scale-95
              ${getButtonStyle()}
            `}
            aria-label="Fermer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

OfflineIndicator.propTypes = {
  isOnline: PropTypes.bool,
  visible: PropTypes.bool,
  isExiting: PropTypes.bool,
  isReconnecting: PropTypes.bool,
  hasRealConnection: PropTypes.bool,
  message: PropTypes.string,
  showRetryButton: PropTypes.bool,
  showDismissButton: PropTypes.bool,
  enableVibration: PropTypes.bool,
  onRetry: PropTypes.func,
  onDismiss: PropTypes.func
};

export default OfflineIndicator;
