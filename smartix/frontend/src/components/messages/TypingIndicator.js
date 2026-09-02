// src/components/messages/TypingIndicator.js
import React, { memo, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

// Injection des styles CSS (une seule fois)
let stylesInjected = false;

const injectStyles = () => {
  if (typeof document === 'undefined' || stylesInjected) return;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes typing_animate {
      0%, 80%, 100% {
        transform: scale(0.6);
        opacity: 0.4;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }
    
    .typing-dot-animate {
      animation: typing_animate 1.4s ease-in-out infinite;
    }
    
    .typing-dot-delay-0 { animation-delay: 0ms; }
    .typing-dot-delay-150 { animation-delay: 150ms; }
    .typing-dot-delay-300 { animation-delay: 300ms; }
    
    @keyframes typing_fade_in {
      from { 
        opacity: 0; 
        transform: translateY(5px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }
    
    .typing-fade-in {
      animation: typing_fade_in 0.2s ease-out;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
};

/**
 * Formate le texte d'affichage pour plusieurs utilisateurs
 * @param {string[]} users - Tableau des noms des utilisateurs
 * @param {Object} options - Options de formatage
 * @returns {string|null}
 */
const formatTypingText = (users, options = {}) => {
  const { defaultText = "écrit...", maxDisplayNames = 2 } = options;
  
  if (!users || users.length === 0) return null;
  
  const total = users.length;
  
  if (total === 1) {
    return `${users[0]} ${defaultText}`;
  }
  
  if (total === 2) {
    return `${users[0]} et ${users[1]} ${defaultText}`;
  }
  
  // Plus de 2 utilisateurs
  const displayNames = users.slice(0, maxDisplayNames);
  const remainingCount = total - maxDisplayNames;
  
  if (remainingCount === 1) {
    return `${displayNames.join(', ')} et 1 autre personne ${defaultText}`;
  }
  
  return `${displayNames.join(', ')} et ${remainingCount} autres personnes ${defaultText}`;
};

const DELAY_CLASSES = {
  0: 'typing-dot-delay-0',
  150: 'typing-dot-delay-150',
  300: 'typing-dot-delay-300'
};

const TypingIndicator = ({
  size = 'md',
  color = 'primary',
  animated = true,
  showText = true,
  text = null,
  usersTyping = [],
  variant = 'dots',
  showAvatar = false,
  avatarUrl = null,
  fadeIn = true,
  fadeOutDelay = 300,
  onFadeOutComplete = null,
  maxDisplayNames = 2,
  defaultText = "écrit..."
}) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Injection des styles au montage
  useEffect(() => {
    injectStyles();
  }, []);

  // Gestion du fade out automatique
  useEffect(() => {
    if (!usersTyping || usersTyping.length === 0) {
      if (fadeOutDelay > 0 && !isFadingOut) {
        setIsFadingOut(true);
        const timer = setTimeout(() => {
          setShouldRender(false);
          if (onFadeOutComplete) onFadeOutComplete();
        }, fadeOutDelay);
        return () => clearTimeout(timer);
      } else if (fadeOutDelay === 0) {
        setShouldRender(false);
      }
    } else {
      setShouldRender(true);
      setIsFadingOut(false);
    }
  }, [usersTyping, fadeOutDelay, isFadingOut, onFadeOutComplete]);

  // Ne pas rendre si aucun utilisateur ne tape
  if (!shouldRender || !usersTyping || usersTyping.length === 0) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2'
  };

  const gapClasses = {
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1.5'
  };

  const colorClasses = {
    primary: 'bg-primary',
    white: 'bg-white',
    muted: 'bg-muted-foreground',
    gray: 'bg-gray-400',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  const dotClass = sizeClasses[size];
  const gapClass = gapClasses[size];
  const dotColor = colorClasses[color] || colorClasses.primary;
  const animationClass = animated ? 'typing-dot-animate' : '';
  const fadeClass = fadeIn && !isFadingOut ? 'typing-fade-in' : (isFadingOut ? 'opacity-0 transition-opacity duration-200' : '');

  // Générer le texte d'affichage
  const displayText = text !== null 
    ? text 
    : formatTypingText(usersTyping, { defaultText, maxDisplayNames });

  // Variant bubble (type WhatsApp)
  if (variant === 'bubble') {
    return (
      <div 
        role="status"
        aria-live="polite"
        aria-label={displayText || defaultText}
        className={`inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#202c33] rounded-2xl rounded-bl-md shadow-sm border border-black/5 dark:border-white/5 ${fadeClass}`}
      >
        {showAvatar && avatarUrl && (
          <img 
            src={avatarUrl} 
            alt="" 
            className="w-6 h-6 rounded-full object-cover"
          />
        )}
        <div className={`flex ${gapClass}`}>
          <span 
            className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[0]}`}
          />
          <span 
            className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[150]}`}
          />
          <span 
            className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[300]}`}
          />
        </div>
        {showText && displayText && (
          <span className="text-xs text-muted-foreground font-medium">
            {displayText}
          </span>
        )}
      </div>
    );
  }

  // Variant simple (dots only, style Messenger)
  if (variant === 'dots') {
    return (
      <div 
        role="status"
        aria-live="polite"
        aria-label={displayText || defaultText}
        className={`inline-flex items-center ${fadeClass}`}
      >
        <div className={`flex ${gapClass}`}>
          <span 
            className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[0]}`}
          />
          <span 
            className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[150]}`}
          />
          <span 
            className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[300]}`}
          />
        </div>
        {showText && displayText && (
          <span className="ml-2 text-xs text-muted-foreground font-medium">
            {displayText}
          </span>
        )}
      </div>
    );
  }

  // Variant minimal (only dots, no text)
  return (
    <div 
      role="status"
      aria-live="polite"
      aria-label="Quelqu'un est en train d'écrire"
      className={`inline-flex ${fadeClass}`}
    >
      <div className={`flex ${gapClass}`}>
        <span 
          className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[0]}`}
        />
        <span 
          className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[150]}`}
        />
        <span 
          className={`${dotClass} ${dotColor} rounded-full ${animationClass} ${DELAY_CLASSES[300]}`}
        />
      </div>
    </div>
  );
};

TypingIndicator.displayName = 'TypingIndicator';

TypingIndicator.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  color: PropTypes.oneOf(['primary', 'white', 'muted', 'gray', 'success', 'warning', 'error']),
  animated: PropTypes.bool,
  showText: PropTypes.bool,
  text: PropTypes.string,
  usersTyping: PropTypes.arrayOf(PropTypes.string),
  variant: PropTypes.oneOf(['dots', 'bubble']),
  showAvatar: PropTypes.bool,
  avatarUrl: PropTypes.string,
  fadeIn: PropTypes.bool,
  fadeOutDelay: PropTypes.number,
  onFadeOutComplete: PropTypes.func,
  maxDisplayNames: PropTypes.number,
  defaultText: PropTypes.string
};

export default memo(TypingIndicator);
