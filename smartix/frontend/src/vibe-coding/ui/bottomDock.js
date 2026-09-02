/**
 * Bottom Dock - Navigation entre les outils
 * Reproduit la barre de navigation inférieure de Replit
 */

import React, { useState } from 'react';

export const BottomDock = ({ 
  activeTool = 'editor',
  onToolChange,
  notificationCount = 0
}) => {
  const [tools] = useState([
    { id: 'editor', icon: '📝', label: 'Éditeur', shortcut: 'Ctrl+1' },
    { id: 'preview', icon: '🌍', label: 'Preview', shortcut: 'Ctrl+2' },
    { id: 'console', icon: '>_', label: 'Console', shortcut: 'Ctrl+3' },
    { id: 'ai', icon: '🤖', label: 'AI Chat', shortcut: 'Ctrl+4' },
    { id: 'terminal', icon: '⌨️', label: 'Terminal', shortcut: 'Ctrl+5' }
  ]);

  const [expanded, setExpanded] = useState(false);

  const handleToolClick = (toolId) => {
    onToolChange?.(toolId);
  };

  return (
    <div className="bottom-dock">
      {/* Barre principale */}
      <div className="dock-bar">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`dock-item ${activeTool === tool.id ? 'active' : ''}`}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span className="dock-icon">{tool.icon}</span>
            {expanded && <span className="dock-label">{tool.label}</span>}
            
            {/* Notifications */}
            {tool.id === 'ai' && notificationCount > 0 && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </button>
        ))}

        {/* Bouton expand/collapse */}
        <button
          className="dock-expand"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Réduire' : 'Développer'}
        >
          {expanded ? '◀' : '▶'}
        </button>
      </div>

      {/* Indicateur de build */}
      <div className="build-status">
        <div className="build-indicator" />
        <span>Build: ready</span>
      </div>

      <style jsx>{`
        .bottom-dock {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #2d2d2d;
          border-top: 1px solid #3e3e3e;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 16px;
          z-index: 1000;
          height: 48px;
        }
        .dock-bar {
          display: flex;
          gap: 2px;
          align-items: center;
        }
        .dock-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          position: relative;
        }
        .dock-item:hover {
          background: #3e3e3e;
          color: #fff;
        }
        .dock-item.active {
          color: #007bff;
          background: rgba(0, 123, 255, 0.1);
        }
        .dock-item.active:hover {
          background: rgba(0, 123, 255, 0.15);
        }
        .dock-icon {
          font-size: 18px;
        }
        .dock-label {
          font-size: 13px;
          font-weight: 500;
        }
        .notification-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #f44336;
          color: white;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 10px;
          min-width: 16px;
          text-align: center;
        }
        .dock-expand {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 8px;
          margin-left: 8px;
          border-radius: 4px;
        }
        .dock-expand:hover {
          background: #3e3e3e;
          color: #fff;
        }
        .build-status {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #888;
          font-size: 12px;
        }
        .build-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4caf50;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default BottomDock;
