import React, { useEffect } from 'react';
import SuperLikeParticles from './SuperLikeParticles';
import PropTypes from 'prop-types';

const SuperLikeHeart = ({ x, y, onAnimationEnd, storyContainerRef }) => {
  const [showParticles, setShowParticles] = React.useState(true);

  useEffect(() => {
    // Pulsation plus forte de la story (1.02x → 1.00x)
    if (storyContainerRef?.current) {
      const pulseRef = storyContainerRef.current;
      pulseRef.style.transform = 'scale(1.02)';
      pulseRef.style.transition = 'transform 150ms ease-out';
      
      setTimeout(() => {
        if (pulseRef) {
          pulseRef.style.transform = 'scale(1)';
        }
      }, 150);
    }

    // Animation dure 600ms
    const timer = setTimeout(() => {
      onAnimationEnd?.();
    }, 600);

    return () => {
      clearTimeout(timer);
      if (storyContainerRef?.current) {
        storyContainerRef.current.style.transform = 'scale(1)';
        storyContainerRef.current.style.transition = '';
      }
    };
  }, [onAnimationEnd, storyContainerRef]);

  return (
    <>
      {/* Cœur Super Like avec dégradé + halo */}
      <div
        className="fixed pointer-events-none"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 101
        }}
      >
        {/* Halo lumineux */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.6) 0%, transparent 70%)',
            animation: 'haloGlow 0.5s ease-out forwards',
            filter: 'blur(20px)'
          }}
        />

        {/* Cœur principal avec dégradé violet-cyan */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            animation: 'superLikePop 0.6s ease-out forwards',
            background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 8px 16px rgba(168, 85, 247, 0.5)) drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))',
            fontSize: '72px'
          }}
        >
          ❤️
        </div>

        <style jsx>{`
          @keyframes superLikePop {
            0% {
              transform: scale(0) rotate(0deg);
              opacity: 1;
            }
            50% {
              transform: scale(2) rotate(-5deg);
              opacity: 1;
            }
            100% {
              transform: scale(1) translateY(-100px) rotate(-5deg);
              opacity: 0;
            }
          }

          @keyframes haloGlow {
            0% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.5);
            }
          }
        `}</style>
      </div>

      {/* Particules premium */}
      {showParticles && (
        <SuperLikeParticles
          x={x}
          y={y}
          onAnimationEnd={() => setShowParticles(false)}
        />
      )}
    </>
  );
};

SuperLikeHeart.propTypes = {
  onAnimationEnd: PropTypes.func.isRequired,
  storyContainerRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
};

export default SuperLikeHeart;
