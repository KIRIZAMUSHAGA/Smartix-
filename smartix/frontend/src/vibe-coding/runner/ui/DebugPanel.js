/**
 * DebugPanel
 * Panneau de débogage principal pour le runner
 */

import React, { useState, useEffect, useRef } from 'react';
import { LogsViewer } from './LogsViewer';
import { StatsViewer } from './StatsViewer';
import { EnvironmentPanel } from './EnvironmentPanel';
import PropTypes from 'prop-types';

export const DebugPanel = ({ runner, onClose, initialTab = 'logs' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const panelRef = useRef(null);
  const dragHandleRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, position.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, position.y + dy))
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, position, size]);

  const handleDragStart = (e) => {
    if (e.target === dragHandleRef.current || dragHandleRef.current.contains(e.target)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const tabs = [
    { id: 'logs', label: '📋 Logs', icon: '📋' },
    { id: 'stats', label: '📊 Stats', icon: '📊' },
    { id: 'env', label: '🌍 Environnement', icon: '🌍' },
    { id: 'performance', label: '⚡ Performance', icon: '⚡' },
    { id: 'errors', label: '❌ Erreurs', icon: '❌' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'logs':
        return <LogsViewer logs={runner?.logs || []} />;
      
      case 'stats':
        return <StatsViewer stats={runner?.getStats()} />;
      
      case 'env':
        return <EnvironmentPanel manager={runner?.environmentManager} />;
      
      case 'performance':
        return (
          <div className="performance-panel">
            <h3>Performance Monitor</h3>
            {runner?.performanceMonitor && (
              <pre>
                {JSON.stringify(runner.performanceMonitor.getReport(), null, 2)}
              </pre>
            )}
          </div>
        );
      
      case 'errors':
        return (
          <div className="errors-panel">
            <h3>Error Capture</h3>
            {runner?.errorCapture && (
              <pre>
                {JSON.stringify(runner.errorCapture.getReport(), null, 2)}
              </pre>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  if (isMinimized) {
    return (
      <div 
        className="debug-panel minimized"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999
        }}
      >
        <button
          className="debug-toggle"
          onClick={() => setIsMinimized(false)}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '30px',
            padding: '10px 20px',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,123,255,0.3)'
          }}
        >
          🛠️ Debug Panel
        </button>

        <style jsx>{`
          .debug-panel.minimized {
            animation: slideIn 0.3s ease;
          }
          @keyframes slideIn {
            from {
              transform: translateY(100px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div 
      ref={panelRef}
      className="debug-panel"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: '#1e1e1e',
        border: '1px solid #3e3e3e',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        resize: 'both',
        overflow: 'hidden'
      }}
    >
      {/* Barre de titre */}
      <div 
        ref={dragHandleRef}
        className="debug-header"
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#2d2d2d',
          borderBottom: '1px solid #3e3e3e',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🛠️</span>
          <span style={{ fontWeight: 'bold', color: '#007bff' }}>Debug Panel</span>
          {runner?.isRunning() && (
            <span style={{ color: '#28a745', fontSize: '12px' }}>● Live</span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsMinimized(true)}
            style={buttonStyle}
            title="Minimiser"
          >
            ─
          </button>
          <button
            onClick={onClose}
            style={buttonStyle}
            title="Fermer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '8px 8px 0 8px',
        background: '#2d2d2d',
        borderBottom: '1px solid #3e3e3e'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 12px',
              background: activeTab === tab.id ? '#1e1e1e' : 'transparent',
              border: 'none',
              color: activeTab === tab.id ? '#fff' : '#888',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }}>
        {renderContent()}
      </div>

      {/* Pied de page */}
      <div style={{
        padding: '4px 12px',
        background: '#2d2d2d',
        borderTop: '1px solid #3e3e3e',
        fontSize: '11px',
        color: '#888',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>Runner v1.0.0</span>
        <span>
          {runner?.isRunning() ? '🟢 En cours' : '⏸️ Arrêté'}
        </span>
      </div>

      <style jsx>{`
        .debug-panel {
          animation: fadeIn 0.2s ease;
        }
        .tab:hover {
          background: #3e3e3e;
          color: #fff;
        }
        .tab.active:hover {
          background: #1e1e1e;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

const buttonStyle = {
  background: 'transparent',
  border: 'none',
  color: '#888',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px'
};

DebugPanel.propTypes = {
  runner: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
  initialTab: PropTypes.any,
};

export default DebugPanel;
