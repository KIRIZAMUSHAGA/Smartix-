
import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Timer, X, Eye, EyeOff, AlertTriangle } from 'lucide-react';

// Configuration des couleurs par durée (purement visuel)
const EPHEMERAL_COLORS = {
  short: { label: '30s', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  medium: { label: '1min', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  long: { label: '5min', color: 'text-red-500', bgColor: 'bg-red-500/10' }
};

/**
 * Calcule le temps restant à partir d'une date d'expiration (source unique de vérité)
 * @param {string} expiresAt - Date d'expiration ISO
 * @returns {number} - Temps restant en secondes (0 si expiré)
 */
const calculateTimeLeft = (expiresAt) => {
  if (!expiresAt) return 0;
  
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  return Math.max(0, Math.floor((expiry - now) / 1000));
};

/**
 * Formate le temps restant en texte lisible
 * @param {number} seconds - Temps restant en secondes
 * @returns {string}
 */
const formatRemainingTime = (seconds) => {
  if (!seconds || seconds <= 0) return 'Expiré';
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `${minutes}min`;
  }
  
  return `${minutes}min ${remainingSeconds}s`;
};

/**
 * Hook de compte à rebours basé sur le temps réel (pas de dérive)
 * @param {string} expiresAt - Date d'expiration ISO
 * @param {Function} onExpire - Callback à l'expiration
 * @returns {number} - Temps restant en secondes
 */
const useCountdown = (expiresAt, onExpire) => {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(expiresAt));
  const intervalRef = useRef(null);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  
  // Mettre à jour la référence du callback
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  
  // Gestion du timer
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(0);
      return;
    }
    
    // Calcul initial
    const initialTimeLeft = calculateTimeLeft(expiresAt);
    setTimeLeft(initialTimeLeft);
    
    if (initialTimeLeft <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      if (onExpireRef.current) onExpireRef.current();
      return;
    }
    
    // Timer basé sur le calcul réel (pas de dérive)
    intervalRef.current = setInterval(() => {
      const remaining = calculateTimeLeft(expiresAt);
      setTimeLeft(remaining);
      
      if (remaining <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (onExpireRef.current) onExpireRef.current();
      }
    }, 1000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);
  
  return timeLeft;
};

// Composant pour l'aperçu flou (pas de contenu réel)
const BlurredPreview = ({ onReveal, isRevealed }) => {
  if (isRevealed) return null;
  
  return (
    <div 
      className="relative cursor-pointer group"
      onClick={onReveal}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center justify-center gap-2 py-2 px-3 bg-muted/30 rounded-lg">
        <Eye className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-sm text-muted-foreground/70 italic">
          Message éphémère - clic pour révéler
        </span>
      </div>
    </div>
  );
};

const EphemeralBadge = ({
  expiresAt,           // UNIQUE source de vérité (ISO string)
  onExpire,
  onReveal,           // Callback quand l'utilisateur révèle le message
  isRevealed = false,
  showTimer = true,
  variant = 'badge',
  size = 'md',
  hasBeenViewed = false  // Backend: message déjà vu
}) => {
  const [localRevealed, setLocalRevealed] = useState(false);
  const [hasRequestedReveal, setHasRequestedReveal] = useState(false);
  
  const timeLeft = useCountdown(expiresAt, () => {
    if (onExpire) onExpire();
  });
  
  const isExpired = timeLeft <= 0;
  const isActuallyRevealed = isRevealed || localRevealed;
  
  // Déterminer la configuration visuelle selon la durée
  const getDurationConfig = () => {
    if (!expiresAt) return { label: 'Éphémère', color: 'text-purple-500', bgColor: 'bg-purple-500/10' };
    
    // Calcul basé sur la durée réelle depuis expiresAt
    const expiry = new Date(expiresAt).getTime();
    const duration = Math.floor((expiry - Date.now() + timeLeft * 1000) / 1000);
    
    if (duration <= 30) return EPHEMERAL_COLORS.short;
    if (duration <= 60) return EPHEMERAL_COLORS.medium;
    return EPHEMERAL_COLORS.long;
  };
  
  const durationConfig = getDurationConfig();
  
  // Tailles
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };
  
  const handleReveal = () => {
    if (hasRequestedReveal) return;
    if (hasBeenViewed) return;
    
    setHasRequestedReveal(true);
    setLocalRevealed(true);
    
    if (onReveal) {
      onReveal(); // Notifier le backend que le message a été révélé
    }
  };
  
  // Message expiré
  if (isExpired) {
    if (variant === 'message') {
      return (
        <div className="flex flex-col gap-2 opacity-60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="w-3 h-3" />
            <span>Message expiré</span>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Ce message n'est plus disponible.
          </p>
        </div>
      );
    }
    return null;
  }
  
  // Variant pour badge dans la bulle de message
  if (variant === 'badge') {
    return (
      <div 
        className={`inline-flex items-center ${sizeClasses[size]} ${durationConfig.bgColor} ${durationConfig.color} rounded-full font-medium`}
        title={`Message éphémère - expire dans ${formatRemainingTime(timeLeft)}`}
      >
        <Timer className={iconSizes[size]} />
        <span>{durationConfig.label}</span>
        {showTimer && timeLeft > 0 && (
          <span className="opacity-75 ml-0.5 font-mono">
            ({formatRemainingTime(timeLeft)})
          </span>
        )}
      </div>
    );
  }
  
  // Variant pour message éphémère (avec backend)
  if (variant === 'message') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs opacity-70 italic">
          <Timer className="w-3 h-3" />
          <span>Message éphémère</span>
          {showTimer && timeLeft > 0 && (
            <span className="text-[10px] font-mono">
              ({formatRemainingTime(timeLeft)})
            </span>
          )}
        </div>
        
        {!isActuallyRevealed && !hasBeenViewed ? (
          <BlurredPreview onReveal={handleReveal} isRevealed={isActuallyRevealed} />
        ) : (
          <div className="relative">
            <p className="text-sm font-medium">
              Contenu du message (révélé)
            </p>
            {hasBeenViewed && (
              <div className="absolute top-0 right-0">
                <EyeOff className="w-3 h-3 text-muted-foreground/50" />
              </div>
            )}
          </div>
        )}
        
        {hasBeenViewed && (
          <p className="text-[10px] text-muted-foreground/60 italic">
            Message déjà vu
          </p>
        )}
      </div>
    );
  }
  
  // Variant compact
  if (variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-center ${sizeClasses.sm} ${durationConfig.bgColor} ${durationConfig.color} rounded-full font-medium`}
        title={`Message éphémère - ${durationConfig.label}`}
      >
        <Timer className={iconSizes.sm} />
      </div>
    );
  }
  
  // Variant par défaut
  return (
    <div className={`inline-flex items-center gap-1 ${sizeClasses.md} text-muted-foreground/60`}>
      <Timer className={iconSizes.md} />
      <span className="text-xs">Éphémère</span>
      {showTimer && timeLeft > 0 && (
        <span className="text-[10px] font-mono">
          ({formatRemainingTime(timeLeft)})
        </span>
      )}
    </div>
  );
};

EphemeralBadge.displayName = 'EphemeralBadge';

BlurredPreview.propTypes = {
  onReveal: PropTypes.func.isRequired,
  isRevealed: PropTypes.bool
};

EphemeralBadge.propTypes = {
  expiresAt: PropTypes.string,
  onExpire: PropTypes.func,
  onReveal: PropTypes.func,
  isRevealed: PropTypes.bool,
  showTimer: PropTypes.bool,
  variant: PropTypes.oneOf(['badge', 'message', 'compact']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  hasBeenViewed: PropTypes.bool
};

export default memo(EphemeralBadge);
