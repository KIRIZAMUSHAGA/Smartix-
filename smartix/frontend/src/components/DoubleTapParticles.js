import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

const DoubleTapParticles = ({ x, y, onAnimationEnd }) => {
  // Générer 6-12 particules avec trajectoires aléatoires
  const particles = useMemo(() => {
    const count = Math.floor(Math.random() * 7) + 6; // 6-12 particules
    const duration = Math.random() * 150 + 450; // 450-600ms
    
    return Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i + (Math.random() * 30 - 15); // Dispersion aléatoire
      const velocity = Math.random() * 60 + 40; // 40-100px/s
      const endX = Math.cos((angle * Math.PI) / 180) * velocity;
      const endY = Math.sin((angle * Math.PI) / 180) * velocity;
      const rotation = Math.random() * 360;
      
      return {
        id: i,
        endX,
        endY,
        rotation,
        duration,
        delay: Math.random() * 30 // Délai aléatoire 0-30ms
      };
    });
  }, []);

  useEffect(() => {
    // L'animation la plus longue détermine la fin totale
    const maxDuration = Math.max(...particles.map(p => p.duration + p.delay));
    const timer = setTimeout(() => {
      onAnimationEnd?.();
    }, maxDuration);

    return () => clearTimeout(timer);
  }, [particles, onAnimationEnd]);

  return (
    <div className="fixed pointer-events-none" style={{ left: `${x}px`, top: `${y}px`, zIndex: 99 }}>
      {particles.map(particle => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: 'translate(-50%, -50%)',
            animation: `particleFloat ${particle.duration}ms ease-out forwards`,
            animationDelay: `${particle.delay}ms`,
            fontSize: '1.2rem',
            opacity: 0.8,
            filter: 'drop-shadow(0 2px 4px rgba(255, 100, 130, 0.3))'
          }}
        >
          ❤️
        </div>
      ))}

      <style jsx>{`
        @keyframes particleFloat {
          0% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.3) rotate(360deg);
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

DoubleTapParticles.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  onAnimationEnd: PropTypes.func
};

export default DoubleTapParticles;
