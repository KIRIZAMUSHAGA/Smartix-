/**
 * TimelineView
 * Vue temporelle des événements et métriques
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';

export const TimelineView = ({ data = {}, period = '1h' }) => {
  const [zoom, setZoom] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const periods = {
    '1h': { label: '1 heure', interval: 60000, points: 60 },
    '6h': { label: '6 heures', interval: 360000, points: 60 },
    '24h': { label: '24 heures', interval: 1440000, points: 60 },
    '7d': { label: '7 jours', interval: 10080000, points: 60 }
  };

  const currentPeriod = periods[period] || periods['1h'];
  const timeline = data[period] || [];

  const getEventColor = (type) => {
    const colors = {
      error: '#f48771',
      warning: '#ffd93e',
      alert: '#dc3545',
      metric: '#007bff'
    };
    return colors[type] || '#888';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    
    if (period === '1h') {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (period === '24h') {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const handlePointClick = (point) => {
    setSelectedPoint(point);
  };

  return (
    <div className="timeline-view">
      {/* Contrôles */}
      <div className="timeline-controls">
        <div className="zoom-controls">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(2, zoom + 0.1))}>+</button>
        </div>
        
        <div className="period-info">
          {currentPeriod.label} · {timeline.length} points
        </div>
      </div>

      {/* Timeline principale */}
      <div className="timeline-container">
        <div 
          className="timeline-grid"
          style={{ transform: `scaleX(${zoom})` }}
        >
          {/* Lignes de temps */}
          <div className="time-lines">
            {timeline.map((point, i) => (
              <div
                key={i}
                className="time-line"
                style={{ left: `${(i / timeline.length) * 100}%` }}
              >
                <span className="time-label">{formatTime(point.time)}</span>
              </div>
            ))}
          </div>

          {/* Barres d'événements */}
          <div className="events-bars">
            {timeline.map((point, i) => {
              const height = Math.min(100, (point.events || 0) * 10);
              
              return (
                <div
                  key={i}
                  className="event-bar"
                  style={{
                    left: `${(i / timeline.length) * 100}%`,
                    height: `${height}%`,
                    backgroundColor: getEventColor('event')
                  }}
                  onClick={() => handlePointClick(point)}
                  title={`${point.events || 0} événements`}
                />
              );
            })}
          </div>

          {/* Barres d'alertes */}
          <div className="alerts-bars">
            {timeline.map((point, i) => {
              const height = Math.min(100, (point.alerts || 0) * 20);
              
              return (
                <div
                  key={i}
                  className="alert-bar"
                  style={{
                    left: `${(i / timeline.length) * 100}%`,
                    height: `${height}%`,
                    backgroundColor: getEventColor('alert')
                  }}
                  onClick={() => handlePointClick(point)}
                  title={`${point.alerts || 0} alertes`}
                />
              );
            })}
          </div>

          {/* Ligne de métriques */}
          {data.metrics && (
            <svg className="metrics-line" style={{ width: '100%', height: '100%' }}>
              <polyline
                points={timeline.map((point, i) => 
                  `${(i / timeline.length) * 100}%,${100 - (point.value || 0)}%`
                ).join(' ')}
                fill="none"
                stroke="#007bff"
                strokeWidth="2"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Détails du point sélectionné */}
      {selectedPoint && (
        <div className="point-details">
          <h4>Détails</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Temps:</span>
              <span>{new Date(selectedPoint.time).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Événements:</span>
              <span>{selectedPoint.events || 0}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Alertes:</span>
              <span>{selectedPoint.alerts || 0}</span>
            </div>
            {selectedPoint.value !== undefined && (
              <div className="detail-item">
                <span className="detail-label">Valeur:</span>
                <span>{selectedPoint.value}</span>
              </div>
            )}
          </div>
          <button 
            className="close-details"
            onClick={() => setSelectedPoint(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Légende */}
      <div className="timeline-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#f48771' }} />
          <span>Événements</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#dc3545' }} />
          <span>Alertes</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#007bff' }} />
          <span>Métriques</span>
        </div>
      </div>

      <style jsx>{`
        .timeline-view {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .timeline-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zoom-controls button {
          width: 30px;
          height: 30px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 18px;
        }

        .zoom-controls button:hover {
          background: #3e3e3e;
        }

        .period-info {
          color: #888;
          font-size: 12px;
        }

        .timeline-container {
          flex: 1;
          min-height: 200px;
          position: relative;
          background: #2d2d2d;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .timeline-grid {
          position: relative;
          width: 100%;
          height: 200px;
          transform-origin: left center;
          transition: transform 0.3s;
        }

        .time-lines {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .time-line {
          position: absolute;
          bottom: 0;
          width: 1px;
          height: 100%;
          background: rgba(255,255,255,0.1);
        }

        .time-label {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          color: #888;
          font-size: 10px;
          white-space: nowrap;
        }

        .events-bars, .alerts-bars {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .event-bar, .alert-bar {
          position: absolute;
          bottom: 0;
          width: 4px;
          min-height: 2px;
          transform: translateX(-50%);
          cursor: pointer;
          pointer-events: auto;
          transition: opacity 0.2s;
        }

        .event-bar:hover, .alert-bar:hover {
          opacity: 0.8;
          transform: translateX(-50%) scaleY(1.1);
        }

        .metrics-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .point-details {
          position: relative;
          padding: 16px;
          background: #2d2d2d;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .point-details h4 {
          margin: 0 0 12px 0;
          color: #007bff;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-label {
          color: #888;
          font-size: 11px;
        }

        .close-details {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
        }

        .timeline-legend {
          display: flex;
          gap: 20px;
          padding: 12px;
          background: #2d2d2d;
          border-radius: 6px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

TimelineView.propTypes = {
  data: PropTypes.array,
};

export default TimelineView;
