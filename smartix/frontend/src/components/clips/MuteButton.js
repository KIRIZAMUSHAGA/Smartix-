
import React from 'react';
import PropTypes from 'prop-types';
import { Volume2, VolumeX } from 'lucide-react';

const MuteButton = ({ 
  muted, 
  onToggle, 
  immersiveMode = false, 
  position = 'top-right',
  size = 'md',
  disabled = false,
  enableHaptic = true,
  className = ''
}) => {
  // Validation de la position
  const validPositions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
  const safePosition = validPositions.includes(position) ? position : 'top-right';
  
  const positionClasses = {
    'top-right': 'top-20 right-4',
    'top-left': 'top-20 left-4',
    'bottom-right': 'bottom-24 right-4',
    'bottom-left': 'bottom-24 left-4'
  };
  
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14'
  };
  
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  };
  
  const safeSize = sizeClasses[size] ? size : 'md';
  
  const handleClick = (e) => {
    e.stopPropagation();
    
    if (disabled) return;
    
    // Feedback haptique
    if (enableHaptic && navigator.vibrate) {
      navigator.vibrate(20);
    }
    
    if (onToggle) {
      onToggle();
    }
  };
  
  // Gestion du focus clavier
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`
        absolute ${positionClasses[safePosition]}
        ${sizeClasses[safeSize]}
        rounded-full 
        bg-black/40 backdrop-blur-md 
        flex items-center justify-center 
        z-10 
        transition-all duration-300 
        hover:bg-black/60 hover:scale-110 
        active:scale-95
        focus:outline-none focus:ring-2 focus:ring-white/50 
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${immersiveMode ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
        ${className}
      `}
      aria-label={muted ? 'Activer le son' : 'Couper le son'}
      aria-pressed={!muted}
      aria-disabled={disabled}
      title={muted ? 'Activer le son' : 'Couper le son'}
    >
      {muted ? (
        <VolumeX className={`${iconSizes[safeSize]} text-white`} aria-hidden="true" />
      ) : (
        <Volume2 className={`${iconSizes[safeSize]} text-white`} aria-hidden="true" />
      )}
    </button>
  );
};

MuteButton.propTypes = {
  muted: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  immersiveMode: PropTypes.bool,
  position: PropTypes.oneOf(['top-right', 'top-left', 'bottom-right', 'bottom-left']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  enableHaptic: PropTypes.bool,
  className: PropTypes.string
};

export default MuteButton;
