/**
 * ThemeToggle - Bouton de bascule thème clair/sombre
 * Utilise ThemeContext pour lire et changer le thème
 */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ style = {} }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      style={{
        background: 'none',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        color: '#fff',
        cursor: 'pointer',
        fontSize: 16,
        padding: '3px 8px',
        lineHeight: 1,
        transition: 'background 0.2s, border-color 0.2s',
        ...style,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};

export default ThemeToggle;
