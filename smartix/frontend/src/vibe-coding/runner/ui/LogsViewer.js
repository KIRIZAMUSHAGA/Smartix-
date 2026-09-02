/**
 * LogsViewer
 * Visualiseur de logs avec filtres et recherche
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

export const LogsViewer = ({ logs = [], maxLogs = 1000 }) => {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  
  const logsContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Types de logs avec leurs couleurs
  const logTypes = {
    all: { label: 'Tous', color: '#888' },
    error: { label: 'Erreurs', color: '#f48771' },
    warning: { label: 'Avertissements', color: '#ffd93e' },
    info: { label: 'Infos', color: '#d4d4d4' },
    success: { label: 'Succès', color: '#b5cea8' },
    debug: { label: 'Debug', color: '#9cdcfe' }
  };

  // Logs filtrés
  const filteredLogs = useMemo(() => {
    return logs
      .filter(log => typeFilter === 'all' || log.type === typeFilter)
      .filter(log => 
        filter === '' || 
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        JSON.stringify(log.data).toLowerCase().includes(filter.toLowerCase())
      )
      .slice(-maxLogs);
  }, [logs, filter, typeFilter, maxLogs]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      const container = logsContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F pour focus recherche
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl+E pour effacer
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        setFilter('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getTypeColor = (type) => {
    return logTypes[type]?.color || '#d4d4d4';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      millisecond: '2-digit'
    });
  };

  const formatSize = (bytes) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyLog = (log) => {
    const text = `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}\n${JSON.stringify(log.data, null, 2)}`;
    navigator.clipboard?.writeText(text);
  };

  const exportLogs = () => {
    const data = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="logs-viewer">
      {/* Barre d'outils */}
      <div className="logs-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Rechercher dans les logs... (Ctrl+F)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button className="clear-search" onClick={() => setFilter('')}>
              ✕
            </button>
          )}
        </div>

        <select 
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
          className="type-filter"
        >
          {Object.entries(logTypes).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <div className="toolbar-actions">
          <button
            className={`action-button ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Défilement automatique"
          >
            ⬇️
          </button>
          <button
            className="action-button"
            onClick={exportLogs}
            title="Exporter les logs"
          >
            💾
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="logs-stats">
        <span>{filteredLogs.length} logs affichés</span>
        <span>{logs.length} total</span>
        {filter && <span>Filtré par: "{filter}"</span>}
      </div>

      {/* Liste des logs */}
      <div className="logs-list" ref={logsContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="logs-empty">
            <div className="empty-icon">📭</div>
            <div>Aucun log à afficher</div>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`log-entry ${expanded.has(index) ? 'expanded' : ''}`}
              style={{ borderLeftColor: getTypeColor(log.type) }}
            >
              <div className="log-header" onClick={() => toggleExpand(index)}>
                <span className="log-time">{formatTimestamp(log.timestamp)}</span>
                <span className="log-type" style={{ color: getTypeColor(log.type) }}>
                  [{log.type.toUpperCase()}]
                </span>
                <span className="log-message">{log.message}</span>
                <div className="log-actions">
                  <button onClick={(e) => { e.stopPropagation(); copyLog(log); }}>
                    📋
                  </button>
                </div>
              </div>
              
              {expanded.has(index) && log.data && (
                <div className="log-details">
                  <pre>{JSON.stringify(log.data, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .logs-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .logs-toolbar {
          display: flex;
          gap: 8px;
          padding: 8px;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .search-box {
          flex: 1;
          position: relative;
        }

        .search-box input {
          width: 100%;
          padding: 6px 30px 6px 30px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          font-size: 13px;
        }

        .search-box input:focus {
          outline: none;
          border-color: #007bff;
        }

        .search-icon {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          color: #888;
        }

        .clear-search {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 2px 4px;
        }

        .clear-search:hover {
          color: #fff;
        }

        .type-filter {
          padding: 6px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          font-size: 13px;
          cursor: pointer;
        }

        .toolbar-actions {
          display: flex;
          gap: 4px;
        }

        .action-button {
          padding: 6px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
        }

        .action-button:hover {
          background: #3e3e3e;
          color: #fff;
        }

        .action-button.active {
          background: #007bff;
          color: #fff;
        }

        .logs-stats {
          display: flex;
          gap: 16px;
          padding: 4px 8px;
          font-size: 11px;
          color: #888;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .logs-list {
          flex: 1;
          overflow: auto;
          font-family: monospace;
          font-size: 12px;
        }

        .logs-empty {
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

        .log-entry {
          margin-bottom: 2px;
          border-left: 3px solid transparent;
          background: #2d2d2d;
          border-radius: 2px;
        }

        .log-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          cursor: pointer;
          user-select: none;
        }

        .log-header:hover {
          background: #3e3e3e;
        }

        .log-time {
          color: #888;
          font-size: 11px;
          min-width: 90px;
        }

        .log-type {
          font-weight: bold;
          min-width: 70px;
        }

        .log-message {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .log-actions {
          opacity: 0;
          transition: opacity 0.2s;
        }

        .log-entry:hover .log-actions {
          opacity: 1;
        }

        .log-actions button {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 2px 4px;
        }

        .log-actions button:hover {
          color: #fff;
        }

        .log-details {
          padding: 8px;
          background: #1e1e1e;
          border-top: 1px solid #3e3e3e;
        }

        .log-details pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #b5cea8;
        }

        .log-entry.expanded .log-header {
          background: #3e3e3e;
        }
      `}</style>
    </div>
  );
};

LogsViewer.propTypes = {
  logs: PropTypes.array,
  maxLogs: PropTypes.any,
};

export default LogsViewer;
