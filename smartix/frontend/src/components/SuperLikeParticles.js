import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

const SuperLikeParticles = ({ x, y, onAnimationEnd }) => {
  // Générer 20-40 étoiles/éclats
  const particles = useMemo(() => {
    const count = Math.floor(Math.random() * 21) + 20; // 20-40 particules
    
    return Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i + (Math.random() * 40 - 20); // Dispersion aléatoire
      const velocity = Math.random() * 80 + 60; // 60-140px/s
      const endX = Math.cos((angle * Math.PI) / 180) * velocity;
      const endY = Math.sin((angle * Math.PI) / 180) * velocity;
      const delay = Math.random() * 50; // Délai aléatoire 0-50ms
      
      return {
        id: i,
        endX,
        endY,
        delay,
        isStarBurst: Math.random() > 0.5 // 50% étoiles, 50% éclats
      };
    });
  }, []);

  useEffect(() => {
    const maxDuration = 700 + Math.max(...particles.map(p => p.delay));
    const timer = setTimeout(() => {
      onAnimationEnd?.();
    }, maxDuration);

    return () => clearTimeout(timer);
  }, [particles, onAnimationEnd]);

  return (
    <div className="fixed pointer-events-none" style={{ left: `${x}px`, top: `${y}px`, zIndex: 100 }}>
      {particles.map(particle => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: 'translate(-50%, -50%)',
            animation: `particleExplode 700ms ease-out forwards`,
            animationDelay: `${particle.delay}ms`,
            fontSize: '1.4rem',
            opacity: 0.9,
            filter: particle.isStarBurst 
              ? 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))' 
              : 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.9))'
          }}
        >
          {particle.isStarBurst ? '✨' : '💫'}
        </div>
      ))}

      <style jsx>{`
        @keyframes particleExplode {
          0% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.2) rotate(360deg);
            opacity: 0;
          }
        }

        ${particles.map((p, idx) => `
          div:nth-child(${idx + 1}) {
            --tx: ${p.endX}px;
            --ty: ${p.endY}px;
          }
        `).join('\n')}
      `}</style>
    </div>
  );
};

SuperLikeParticles.propTypes = {
  onAnimationEnd: PropTypes.func.isRequired,
};

export default SuperLikeParticles;
