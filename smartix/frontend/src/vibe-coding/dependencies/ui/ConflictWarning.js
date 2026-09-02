/**
 * ConflictWarning
 * Affiche les avertissements de conflits entre dépendances
 */

import React, { useState } from 'react';

export const ConflictWarning = ({ conflicts = [] }) => {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => {
    setExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error': return '#f48771';
      case 'warning': return '#ffd93e';
      case 'info': return '#007bff';
      default: return '#888';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  };

  if (conflicts.length === 0) {
    return (
      <div className="conflict-warning empty">
        <div className="empty-icon">✅</div>
        <div>Aucun conflit détecté</div>

        <style jsx>{`
          .conflict-warning.empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: #28a745;
            gap: 16px;
          }
          .empty-icon {
            font-size: 48px;
          }
        `}</style>
      </div>
    );
  }

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');
  const infos = conflicts.filter(c => c.severity === 'info');

  return (
    <div className="conflict-warning">
      {/* Résumé */}
      <div className="conflict-summary">
        {errors.length > 0 && (
          <div className="summary-item error">
            <span className="summary-icon">❌</span>
            <span className="summary-label">{errors.length} erreur(s)</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="summary-item warning">
            <span className="summary-icon">⚠️</span>
            <span className="summary-label">{warnings.length} avertissement(s)</span>
          </div>
        )}
        {infos.length > 0 && (
          <div className="summary-item info">
            <span className="summary-icon">ℹ️</span>
            <span className="summary-label">{infos.length} information(s)</span>
          </div>
        )}
      </div>

      {/* Liste des conflits */}
      <div className="conflicts-list">
        {conflicts.map((conflict, index) => (
          <div 
            key={conflict.id || index} 
            className="conflict-item"
            style={{ borderLeftColor: getSeverityColor(conflict.severity) }}
          >
            <div 
              className="conflict-header"
              onClick={() => toggleExpand(conflict.id || index)}
            >
              <span className="conflict-icon">
                {getSeverityIcon(conflict.severity)}
              </span>
              <span className="conflict-message">{conflict.message}</span>
              <span className="conflict-expand">
                {expanded[conflict.id || index] ? '▼' : '▶'}
              </span>
            </div>

            {expanded[conflict.id || index] && (
              <div className="conflict-details">
                {/* Détails du conflit */}
                {conflict.packages && (
                  <div className="detail-section">
                    <strong>Packages concernés:</strong>
                    <div className="package-tags">
                      {conflict.packages.map(pkg => (
                        <span key={pkg} className="package-tag">{pkg}</span>
                      ))}
                    </div>
                  </div>
                )}

                {conflict.versions && (
                  <div className="detail-section">
                    <strong>Versions:</strong>
                    <pre>{JSON.stringify(conflict.versions, null, 2)}</pre>
                  </div>
                )}

                {/* Suggestion de résolution */}
                {conflict.suggestion && (
                  <div className="detail-section suggestion">
                    <strong>💡 Suggestion:</strong>
                    <p>{conflict.suggestion}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="conflict-actions">
                  <button 
                    className="fix-btn"
                    onClick={() => {
                      // TODO: Implémenter la correction automatique
                    }}
                  >
                    Corriger automatiquement
                  </button>
                  <button 
                    className="ignore-btn"
                    onClick={() => {
                      // TODO: Implémenter l'ignorance
                    }}
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .conflict-warning {
          height: 100%;
          overflow: auto;
        }

        .conflict-summary {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px;
          background: #2d2d2d;
          border-radius: 6px;
        }

        .summary-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 13px;
        }

        .summary-item.error {
          background: #5a2e2e;
          color: #f48771;
        }

        .summary-item.warning {
          background: #5a4e2e;
          color: #ffd93e;
        }

        .summary-item.info {
          background: #1e3a5f;
          color: #007bff;
        }

        .conflicts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .conflict-item {
          background: #2d2d2d;
          border-left: 4px solid transparent;
          border-radius: 4px;
          overflow: hidden;
        }

        .conflict-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          cursor: pointer;
          user-select: none;
        }

        .conflict-header:hover {
          background: #3e3e3e;
        }

        .conflict-icon {
          font-size: 16px;
          min-width: 24px;
        }

        .conflict-message {
          flex: 1;
          font-size: 13px;
        }

        .conflict-expand {
          color: #888;
          font-size: 12px;
        }

        .conflict-details {
          padding: 12px;
          background: #1e1e1e;
          border-top: 1px solid #3e3e3e;
        }

        .detail-section {
          margin-bottom: 12px;
        }

        .detail-section strong {
          display: block;
          margin-bottom: 4px;
          color: #888;
          font-size: 12px;
        }

        .package-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .package-tag {
          padding: 2px 8px;
          background: #2d2d2d;
          border-radius: 4px;
          font-size: 11px;
        }

        .detail-section pre {
          margin: 0;
          padding: 8px;
          background: #2d2d2d;
          border-radius: 4px;
          font-size: 11px;
          overflow-x: auto;
        }

        .detail-section.suggestion {
          padding: 8px;
          background: #1e3a5f;
          border-radius: 4px;
        }

        .detail-section.suggestion p {
          margin: 4px 0 0 0;
          font-size: 12px;
        }

        .conflict-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .fix-btn, .ignore-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .fix-btn {
          background: #007bff;
          color: white;
        }

        .fix-btn:hover {
          background: #0056b3;
        }

        .ignore-btn {
          background: #3e3e3e;
          color: #888;
        }

        .ignore-btn:hover {
          background: #4e4e4e;
          color: #d4d4d4;
        }
      `}</style>
    </div>
  );
};

export default ConflictWarning;
