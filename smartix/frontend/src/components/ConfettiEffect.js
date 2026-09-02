
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import '../styles/animations.css';

/**
 * ConfettiEffect - Génère des confetti animés
 * Props:
 * - onComplete: function - Callback à la fin de l'animation
 */
const ConfettiEffect = ({ onComplete }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors = ['#00B894', '#0984E3', '#FDCB6E', '#E17055', '#6C5CE7'];
    const shapes = ['rect', 'circle', 'star'];
    
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      size: 8 + Math.random() * 12
    }));

    setParticles(newParticles);

    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="confetti-particle absolute"
          style={{
            left: `${particle.left}%`,
            top: '-20px',
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            borderRadius: particle.shape === 'circle' ? '50%' : particle.shape === 'star' ? '0' : '2px',
            animationDelay: `${particle.delay}s`
          }}
        />
      ))}
    </div>
  );
};

ConfettiEffect.propTypes = {
  onComplete: PropTypes.func
};

export default ConfettiEffect;
