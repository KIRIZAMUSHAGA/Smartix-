/**
 * DebugButton
 * Bouton flottant pour ouvrir le panneau de débogage
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';

export const DebugButton = ({ onClick, position = 'bottom-right' }) => {
  const [isHovered, setIsHovered] = useState(false);

  const positions = {
    'top-left': { top: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' }
  };

  return (
    <button
      className="debug-button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...positions[position],
        position: 'fixed',
        width: isHovered ? '120px' : '50px',
        height: '50px',
        borderRadius: isHovered ? '25px' : '25px',
        background: 'linear-gradient(135deg, #007bff, #0056b3)',
        border: 'none',
        color: 'white',
        fontSize: isHovered ? '14px' : '24px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0,123,255,0.3)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <span style={{
        transform: `scale(${isHovered ? 1 : 1.2})`,
        transition: 'transform 0.3s'
      }}>
        {isHovered ? '🛠️ Debug' : '🛠️'}
      </span>

      {/* Effet de ripple */}
      <span style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, transparent 50%)',
        opacity: isHovered ? 0.2 : 0,
        transition: 'opacity 0.3s'
      }} />

      <style jsx>{`
        .debug-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,123,255,0.4);
        }
        .debug-button:active {
          transform: translateY(1px);
          box-shadow: 0 2px 10px rgba(0,123,255,0.3);
        }
      `}</style>
    </button>
  );
};

DebugButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  position: PropTypes.number,
};

export default DebugButton;
