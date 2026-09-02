import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import DoubleTapParticles from './DoubleTapParticles';
import { vibrateLight } from '../utils/vibration';

const DoubleTapHeart = ({ x, y, onAnimationEnd, storyContainerRef }) => {
  const [showParticles, setShowParticles] = React.useState(true);
  const pulseRef = useRef(null);

  useEffect(() => {
    // Vibration légère au double-tap (10-15ms)
    vibrateLight();

    // Animation pulsation de la story (1.01x → 1.00x)
    if (storyContainerRef?.current) {
      pulseRef.current = storyContainerRef.current;
      pulseRef.current.style.transform = 'scale(1.01)';
      pulseRef.current.style.transition = 'transform 100ms ease-out';
      
      setTimeout(() => {
        if (pulseRef.current) {
          pulseRef.current.style.transform = 'scale(1)';
        }
      }, 100);
    }

    // Animation dure 600ms total (pop + fade)
    const timer = setTimeout(() => {
      onAnimationEnd?.();
    }, 600);

    return () => {
      clearTimeout(timer);
      if (pulseRef.current) {
        pulseRef.current.style.transform = 'scale(1)';
        pulseRef.current.style.transition = '';
      }
    };
  }, [onAnimationEnd, storyContainerRef]);

  return (
    <>
      {/* Cœur principal */}
      <div
        className="fixed pointer-events-none"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 100
        }}
      >
        <div
          className="text-6xl animate-pulse"
          style={{
            animation: 'doubleTapHeart 0.6s ease-out forwards',
            filter: 'drop-shadow(0 4px 8px rgba(255, 100, 130, 0.4))'
          }}
        >
          ❤️
        </div>

        <style jsx>{`
          @keyframes doubleTapHeart {
            0% {
              transform: scale(0) rotate(0deg);
              opacity: 1;
            }
            50% {
              transform: scale(1.6) rotate(5deg);
              opacity: 1;
            }
            100% {
              transform: scale(1) translateY(-80px) rotate(5deg);
              opacity: 0;
            }
          }
        `}</style>
      </div>

      {/* Particules (6-12 petits cœurs) */}
      {showParticles && (
        <DoubleTapParticles
          x={x}
          y={y}
          onAnimationEnd={() => {
            setShowParticles(false);
          }}
        />
      )}
    </>
  );
};

DoubleTapHeart.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  onAnimationEnd: PropTypes.func,
  storyContainerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
};

export default DoubleTapHeart;
