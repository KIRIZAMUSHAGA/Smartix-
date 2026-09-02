
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

// =============================
// UTILITAIRES
// =============================
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isValidNumber = (value) => typeof value === 'number' && !isNaN(value) && isFinite(value);

const ProgressBar = ({ 
  progress = 0,
  height = 'h-1',
  fromColor = '#005CFF',
  toColor = '#44B0FF',
  backgroundColor = 'bg-white/20',
  animated = true,
  showPercentage = false,
  percentagePosition = 'right',
  indeterminate = false,
  className = '',
  onComplete = null,
  completeThreshold = 99.5
}) => {
  // Validation et clamp de la progression
  const clampedProgress = useMemo(() => {
    if (indeterminate) return null;
    const validProgress = isValidNumber(progress) ? progress : 0;
    return clamp(validProgress, 0, 100);
  }, [progress, indeterminate]);

  // Détection de complétion
  const isComplete = !indeterminate && clampedProgress >= completeThreshold;

  // Style de progression
  const progressStyle = useMemo(() => {
    if (indeterminate) {
      return {
        width: '100%',
        animation: 'indeterminate-progress 1.5s ease-in-out infinite'
      };
    }
    return { width: `${clampedProgress}%` };
  }, [indeterminate, clampedProgress]);

  // Classes d'animation
  const transitionClass = animated ? 'transition-all duration-300 ease-out' : '';
  const gradientStyle = {
    background: `linear-gradient(to right, ${fromColor}, ${toColor})`
  };

  // Appeler onComplete quand la progression atteint 100%
  React.useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  const percentagePositionClasses = {
    right: 'right-0',
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2'
  };

  const percentageClass = percentagePositionClasses[percentagePosition] || percentagePositionClasses.right;

  // Animation keyframes (à ajouter dans le CSS global)
  const keyframesStyle = `
    @keyframes indeterminate-progress {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `;

  return (
    <div className={`relative ${className}`}>
      <div className={`${height} ${backgroundColor} rounded-full overflow-hidden`}>
        <div
          className={`h-full ${transitionClass}`}
          style={{
            ...progressStyle,
            ...gradientStyle
          }}
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : clampedProgress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label={indeterminate ? 'Chargement en cours...' : `Progression : ${Math.round(clampedProgress)}%`}
          aria-busy={indeterminate || clampedProgress < 100}
        />
      </div>
      
      {showPercentage && !indeterminate && (
        <span 
          className={`absolute -top-6 ${percentageClass} text-xs text-white/60 font-mono`}
          aria-hidden="true"
        >
          {Math.round(clampedProgress)}%
        </span>
      )}
      
      {indeterminate && showPercentage && (
        <span className="absolute -top-6 right-0 text-xs text-white/60 animate-pulse">
          Chargement...
        </span>
      )}
      
      {/* Injection des keyframes (une seule fois) */}
      {indeterminate && (
        <style>{keyframesStyle}</style>
      )}
    </div>
  );
};

ProgressBar.propTypes = {
  progress: PropTypes.number,
  height: PropTypes.string,
  fromColor: PropTypes.string,
  toColor: PropTypes.string,
  backgroundColor: PropTypes.string,
  animated: PropTypes.bool,
  showPercentage: PropTypes.bool,
  percentagePosition: PropTypes.oneOf(['left', 'right', 'center']),
  indeterminate: PropTypes.bool,
  className: PropTypes.string,
  onComplete: PropTypes.func,
  completeThreshold: PropTypes.number
};

export default ProgressBar;
