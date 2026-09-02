/**
 * UIReporter
 * Affiche les métriques de performance dans l'interface utilisateur
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export const UIReporter = ({ monitor, position = 'bottom-right' }) => {
  const [metrics, setMetrics] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    if (!monitor) return;

    const handleMetrics = (newMetrics) => {
      setMetrics(newMetrics);
    };

    const handleWarning = (warning) => {
      setWarnings(prev => [warning, ...prev].slice(0, 5));
      
      // Auto-expand sur les warnings
      if (!expanded) {
        setExpanded(true);
      }
      
      // Disparaître après 5 secondes
      setTimeout(() => {
        setWarnings(prev => prev.filter(w => w !== warning));
      }, 5000);
    };

    monitor.on('metrics-update', handleMetrics);
    monitor.on('warning', handleWarning);

    return () => {
      monitor.off('metrics-update', handleMetrics);
      monitor.off('warning', handleWarning);
    };
  }, [monitor, expanded]);

  if (!metrics) return null;

  const getFPSColor = (fps) => {
    if (fps < 30) return '#f48771';
    if (fps < 50) return '#ffd93e';
    return '#b5cea8';
  };

  const getMemoryColor = (percentage) => {
    if (percentage > 80) return '#f48771';
    if (percentage > 60) return '#ffd93e';
    return '#b5cea8';
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const positions = {
    'top-left': { top: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' }
  };

  return (
    <div className="ui-reporter" style={positions[position]}>
      {/* Bouton principal */}
      <button 
        className="reporter-toggle"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: '#2d2d2d',
          border: '1px solid #3e3e3e',
          borderRadius: '20px',
          padding: '8px 16px',
          color: '#d4d4d4',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}
      >
        <span>📊</span>
        <span style={{ color: getFPSColor(metrics.fps?.value) }}>
          {metrics.fps?.value || 0} FPS
        </span>
        {warnings.length > 0 && (
          <span style={{ color: '#f48771' }}>⚠️ {warnings.length}</span>
        )}
      </button>

      {/* Panneau détaillé */}
      {expanded && (
        <div className="reporter-details" style={{
          position: 'absolute',
          bottom: '60px',
          right: 0,
          width: '300px',
          background: '#1e1e1e',
          border: '1px solid #3e3e3e',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          marginTop: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#007bff' }}>Performance</h3>
            <button 
              onClick={() => setExpanded(false)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* FPS */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#888' }}>FPS</span>
              <span style={{ color: getFPSColor(metrics.fps?.value) }}>
                {metrics.fps?.value || 0}
              </span>
            </div>
            <div style={{ height: '4px', background: '#2d2d2d', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${(metrics.fps?.value / 60) * 100}%`,
                height: '100%',
                background: getFPSColor(metrics.fps?.value),
                transition: 'width 0.3s'
              }} />
            </div>
          </div>

          {/* Mémoire */}
          {metrics.memory && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>Mémoire</span>
                <span style={{ color: getMemoryColor(metrics.memory.percentage) }}>
                  {Math.round(metrics.memory.percentage)}%
                </span>
              </div>
              <div style={{ height: '4px', background: '#2d2d2d', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${metrics.memory.percentage}%`,
                  height: '100%',
                  background: getMemoryColor(metrics.memory.percentage),
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
              </div>
            </div>
          )}

          {/* Réseau */}
          {metrics.network && metrics.network.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#888', marginBottom: '4px' }}>Requêtes récentes</div>
              {metrics.network.slice(0, 3).map((req, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  padding: '2px 0'
                }}>
                  <span style={{ color: '#d4d4d4' }}>{req.type}</span>
                  <span style={{ color: req.duration > 1000 ? '#f48771' : '#888' }}>
                    {Math.round(req.duration)}ms
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Avertissements */}
          {warnings.length > 0 && (
            <div>
              <div style={{ color: '#f48771', marginBottom: '4px' }}>Avertissements</div>
              {warnings.map((warning, i) => (
                <div key={i} style={{
                  fontSize: '11px',
                  padding: '4px',
                  background: '#5a2e2e',
                  borderRadius: '4px',
                  marginBottom: '2px'
                }}>
                  {warning.type === 'fps' && `FPS bas: ${warning.value}`}
                  {warning.type === 'memory' && `Mémoire élevée: ${Math.round(warning.value)}%`}
                  {warning.type === 'slow-request' && `Requête lente: ${warning.url}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .ui-reporter {
          position: fixed;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .reporter-toggle {
          transition: all 0.2s;
        }
        .reporter-toggle:hover {
          background: #3e3e3e !important;
        }
      `}</style>
    </div>
  );
};

UIReporter.propTypes = {
  monitor: PropTypes.any.isRequired,
  position: PropTypes.number,
};

export default UIReporter;
