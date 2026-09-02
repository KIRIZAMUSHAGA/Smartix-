/**
 * AlertList
 * Liste des alertes avec actions
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';

export const AlertList = ({ alerts = [], onAcknowledge, showResolved = false }) => {
  const [filter, setFilter] = useState('all');

  const severityLevels = ['critical', 'high', 'medium', 'low', 'info'];

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#dc3545',
      high: '#f48771',
      medium: '#ffd93e',
      low: '#17a2b8',
      info: '#6c757d'
    };
    return colors[severity] || '#888';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪'
    };
    return icons[severity] || '•';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'à l\'instant';
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
    return date.toLocaleDateString();
  };

  const getActiveCount = () => alerts.filter(a => !a.acknowledged).length;
  const getBySeverity = (severity) => alerts.filter(a => a.severity === severity && !a.acknowledged).length;

  return (
    <div className="alert-list">
      {/* Résumé */}
      <div className="alert-summary">
        <div className="summary-total">
          <span className="total-number">{getActiveCount()}</span>
          <span className="total-label">actives</span>
        </div>
        
        <div className="severity-bars">
          {severityLevels.map(severity => {
            const count = getBySeverity(severity);
            if (count === 0) return null;
            
            return (
              <div key={severity} className="severity-bar">
                <span className="severity-icon">{getSeverityIcon(severity)}</span>
                <span className="severity-name">{severity}</span>
                <span className="severity-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtres */}
      <div className="alert-filters">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">Toutes les alertes</option>
          {severityLevels.map(level => (
            <option key={level} value={level}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Liste */}
      <div className="alerts-container">
        {filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            <div className="empty-icon">✅</div>
            <div>Aucune alerte</div>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div
              key={alert.id}
              className={`alert-item ${alert.acknowledged ? 'acknowledged' : ''}`}
              style={{ borderLeftColor: getSeverityColor(alert.severity) }}
            >
              <div className="alert-header">
                <span className="alert-icon">{getSeverityIcon(alert.severity)}</span>
                <span className="alert-title">{alert.title}</span>
                <span className="alert-time">{formatTime(alert.createdAt)}</span>
              </div>

              <div className="alert-message">{alert.message}</div>

              {alert.data && (
                <div className="alert-data">
                  <pre>{JSON.stringify(alert.data, null, 2)}</pre>
                </div>
              )}

              <div className="alert-footer">
                <span className="alert-severity">{alert.severity}</span>
                
                {!alert.acknowledged && onAcknowledge && (
                  <button
                    className="acknowledge-btn"
                    onClick={() => onAcknowledge(alert.id)}
                  >
                    ✓ Acquitter
                  </button>
                )}

                {alert.acknowledged && (
                  <span className="acknowledged-badge">
                    Acquittée le {new Date(alert.acknowledgedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .alert-list {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .alert-summary {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px;
          background: #2d2d2d;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .summary-total {
          text-align: center;
          min-width: 80px;
        }

        .total-number {
          display: block;
          font-size: 36px;
          font-weight: bold;
          color: #007bff;
          line-height: 1;
        }

        .total-label {
          font-size: 12px;
          color: #888;
        }

        .severity-bars {
          flex: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .severity-bar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: #1e1e1e;
          border-radius: 4px;
          font-size: 12px;
        }

        .severity-icon {
          font-size: 14px;
        }

        .severity-name {
          color: #888;
        }

        .severity-count {
          font-weight: bold;
          margin-left: 4px;
        }

        .alert-filters {
          margin-bottom: 16px;
        }

        .filter-select {
          width: 100%;
          padding: 8px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
        }

        .alerts-container {
          flex: 1;
          overflow: auto;
        }

        .no-alerts {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #888;
          gap: 16px;
        }

        .empty-icon {
          font-size: 48px;
        }

        .alert-item {
          background: #2d2d2d;
          border-left: 4px solid transparent;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 8px;
        }

        .alert-item.acknowledged {
          opacity: 0.6;
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .alert-icon {
          font-size: 18px;
        }

        .alert-title {
          flex: 1;
          font-weight: bold;
        }

        .alert-time {
          color: #888;
          font-size: 11px;
        }

        .alert-message {
          font-size: 13px;
          margin-bottom: 12px;
          color: #d4d4d4;
        }

        .alert-data {
          margin-bottom: 12px;
          padding: 8px;
          background: #1e1e1e;
          border-radius: 4px;
        }

        .alert-data pre {
          margin: 0;
          font-size: 11px;
          color: #b5cea8;
          overflow-x: auto;
        }

        .alert-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .alert-severity {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
        }

        .acknowledge-btn {
          padding: 4px 12px;
          background: #28a745;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 12px;
        }

        .acknowledge-btn:hover {
          background: #218838;
        }

        .acknowledged-badge {
          font-size: 11px;
          color: #888;
        }
      `}</style>
    </div>
  );
};

AlertList.propTypes = {
  alerts: PropTypes.any,
  onAcknowledge: PropTypes.func.isRequired,
  showResolved: PropTypes.bool,
};

export default AlertList;
