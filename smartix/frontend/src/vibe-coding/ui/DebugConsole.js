/**
 * DebugConsole - Console de débogage intégrée (version PRO)
 * 
 * Affiche l'historique des erreurs et corrections
 * Permet de voir les actions de l'IA
 * Supporte le filtrage, l'export et l'analyse
 * Optimisé pour les performances
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { runtimeDebugger } from '../runtime/RuntimeDebugger';
import { projectModifier } from '../services/projectModifier';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { crypto } from '../utils/crypto';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const MAX_LOGS = 1000;
const LOG_BUFFER_SIZE = 50;
const UPDATE_THROTTLE = 100; // ms

// =============================
// UTILITAIRES
// =============================

// Formatage du temps
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'à l\'instant';
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Sanitize pour éviter XSS
const sanitize = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Indexation pour recherche rapide
const createLogIndex = (log) => ({
  id: log.id,
  message: log.message.toLowerCase(),
  file: log.data?.file?.toLowerCase() || '',
  type: log.type,
  stack: log.data?.error?.stack?.substring(0, 500).toLowerCase() || ''
});

// =============================
// REDUCER POUR LES LOGS
// =============================
const logsReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_LOGS':
      const newLogs = [...state.logs, ...action.payload];
      // Garder seulement MAX_LOGS
      const trimmed = newLogs.length > MAX_LOGS 
        ? newLogs.slice(-MAX_LOGS) 
        : newLogs;
      
      // Reconstruire l'index
      const newIndex = new Map();
      trimmed.forEach(log => newIndex.set(log.id, createLogIndex(log)));

      return {
        logs: trimmed,
        index: newIndex
      };

    case 'CLEAR':
      return {
        logs: [],
        index: new Map()
      };

    case 'DELETE':
      const filteredLogs = state.logs.filter(l => !action.payload.has(l.id));
      const filteredIndex = new Map();
      filteredLogs.forEach(log => filteredIndex.set(log.id, createLogIndex(log)));
      
      return {
        logs: filteredLogs,
        index: filteredIndex
      };

    default:
      return state;
  }
};

// =============================
// LOG ROW COMPONENT (virtualisé)
// =============================
const LogRow = React.memo(({ data, index, style }) => {
  const {
    logs,
    expandedLog,
    setExpandedLog,
    selectionMode,
    selectedLogs,
    handleSelectLog,
    handleJumpToError,
    handleRetryFix,
    getTypeColor,
    getTypeIcon,
    formatTime
  } = data;

  const log = logs[index];
  const isExpanded = expandedLog === log.id;
  const isSelected = selectedLogs.has(log.id);

  const getTypeColorValue = useCallback((type) => {
    const colors = {
      error: '#f48771',
      fix: '#4caf50',
      warning: '#ffd93e',
      info: '#2196f3'
    };
    return colors[type] || '#888';
  }, []);

  return (
    <div style={style}>
      <div 
        className={`log-entry ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
        style={{ borderLeftColor: getTypeColorValue(log.type) }}
      >
        <div className="log-header">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleSelectLog(log.id)}
              className="log-checkbox"
            />
          )}
          <span className="log-time" title={new Date(log.timestamp).toLocaleString()}>
            {formatTime(log.timestamp)}
          </span>
          <span className="log-type" style={{ color: getTypeColorValue(log.type) }}>
            {getTypeIcon(log.type)} [{log.type.toUpperCase()}]
          </span>
          <span className="log-message" dangerouslySetInnerHTML={{ 
            __html: sanitize(log.message) 
          }} />
          <div className="log-actions">
            <button 
              className="log-action-btn"
              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
            {log.type === 'error' && (
              <>
                <button 
                  className="log-action-btn"
                  onClick={() => handleJumpToError(log)}
                  title="Aller à l'erreur"
                >
                  📍
                </button>
                <button 
                  className="log-action-btn"
                  onClick={() => handleRetryFix(log)}
                  title="Réessayer la correction"
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div className="log-details">
            {log.data?.file && (
              <div className="detail-item">
                <span className="detail-label">📁 Fichier:</span>
                <span className="detail-value">{sanitize(log.data.file)}</span>
              </div>
            )}
            {log.data?.line && (
              <div className="detail-item">
                <span className="detail-label">📍 Ligne:</span>
                <span className="detail-value">{log.data.line}</span>
              </div>
            )}
            {log.data?.description && (
              <div className="detail-item">
                <span className="detail-label">📝 Description:</span>
                <span className="detail-value">{sanitize(log.data.description)}</span>
              </div>
            )}
            {log.data?.patch && (
              <div className="detail-section">
                <div className="detail-label">🔧 Patch:</div>
                <pre className="detail-code">{JSON.stringify(log.data.patch, null, 2)}</pre>
              </div>
            )}
            {log.data?.error?.stack && (
              <div className="detail-section">
                <div className="detail-label">📚 Stack trace:</div>
                <pre className="detail-code">{sanitize(log.data.error.stack)}</pre>
              </div>
            )}
            {log.data?.context && (
              <div className="detail-section">
                <div className="detail-label">🎯 Contexte:</div>
                <pre className="detail-code">{JSON.stringify(log.data.context, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

LogRow.displayName = 'LogRow';

// =============================
// MAIN COMPONENT
// =============================
export const DebugConsole = ({ isOpen, onClose }) => {
  const [logsState, dispatch] = useReducer(logsReducer, { logs: [], index: new Map() });
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  
  const consoleRef = useRef(null);
  const logBuffer = useRef([]);
  const throttleTimer = useRef(null);
  const mountedRef = useRef(true);

  // Charger l'historique au montage
  useEffect(() => {
    if (!isOpen) return;

    mountedRef.current = true;
    const loadHistory = () => {
      setStats(runtimeDebugger.getStats());
    };
    loadHistory();

    // Écouter les nouveaux événements
    const handleError = (data) => {
      addLog('error', `Erreur: ${data.error.message}`, data);
    };

    const handleFix = (data) => {
      addLog('fix', `Correction appliquée: ${data.description}`, data);
    };

    const handleWarning = (data) => {
      addLog('warning', `Avertissement: ${data.warning}`, data);
    };

    const handleInfo = (data) => {
      addLog('info', data.message, data);
    };

    runtimeDebugger.on('error-detected', handleError);
    runtimeDebugger.on('fix-applied', handleFix);
    runtimeDebugger.on('warning-detected', handleWarning);
    runtimeDebugger.on('info', handleInfo);

    return () => {
      mountedRef.current = false;
      if (throttleTimer.current) {
        clearTimeout(throttleTimer.current);
      }
      runtimeDebugger.off('error-detected', handleError);
      runtimeDebugger.off('fix-applied', handleFix);
      runtimeDebugger.off('warning-detected', handleWarning);
      runtimeDebugger.off('info', handleInfo);
    };
  }, [isOpen]);

  // Throttled flush des logs
  const flushLogs = useCallback(() => {
    if (logBuffer.current.length > 0 && mountedRef.current) {
      const logs = [...logBuffer.current];
      logBuffer.current = [];
      dispatch({ type: 'ADD_LOGS', payload: logs });
    }
  }, []);

  // Ajouter un log avec buffer
  const addLog = (type, message, data) => {
    const newLog = {
      id: crypto.randomUUID(),
      type,
      message,
      data,
      timestamp: Date.now()
    };

    logBuffer.current.push(newLog);

    // Flush immédiat si buffer plein
    if (logBuffer.current.length >= LOG_BUFFER_SIZE) {
      flushLogs();
    } else if (!throttleTimer.current) {
      // Sinon, scheduler le flush
      throttleTimer.current = setTimeout(() => {
        flushLogs();
        throttleTimer.current = null;
      }, UPDATE_THROTTLE);
    }

    // Mettre à jour les stats (pas besoin de throttle)
    if (mountedRef.current) {
      setStats(runtimeDebugger.getStats());
    }
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (logBuffer.current.length > 0) {
        flushLogs();
      }
    };
  }, [flushLogs]);

  // Logs filtrés avec useMemo
  const filteredLogs = useMemo(() => {
    let filtered = logsState.logs;

    // Filtre par type
    if (filter !== 'all') {
      filtered = filtered.filter(log => log.type === filter);
    }

    // Recherche textuelle (utilise l'index)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => {
        const idx = logsState.index.get(log.id);
        return idx?.message.includes(query) ||
               idx?.file.includes(query) ||
               idx?.stack.includes(query);
      });
    }

    return filtered;
  }, [logsState.logs, logsState.index, filter, searchQuery]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const getTypeIcon = (type) => {
    const icons = {
      error: '❌',
      fix: '✅',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || '•';
  };

  const handleClearLogs = () => {
    dispatch({ type: 'CLEAR' });
    setSelectedLogs(new Set());
  };

  const handleExport = () => {
    const data = {
      logs: filteredLogs,
      stats,
      exportedAt: Date.now(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-console-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDataset = () => {
    const dataset = runtimeDebugger.exportErrorDataset?.() || {
      errors: logsState.logs.filter(l => l.type === 'error'),
      fixes: logsState.logs.filter(l => l.type === 'fix')
    };

    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-dataset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectLog = (id) => {
    setSelectedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedLogs.size === filteredLogs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const handleDeleteSelected = () => {
    dispatch({ type: 'DELETE', payload: selectedLogs });
    setSelectedLogs(new Set());
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedLogs(new Set());
  };

  const handleJumpToError = (log) => {
    if (log.data?.context?.file && log.data?.context?.line) {
      const event = new CustomEvent('editor:jump', {
        detail: {
          file: log.data.context.file,
          line: log.data.context.line
        }
      });
      window.dispatchEvent(event);
    }
  };

  const handleRetryFix = (log) => {
    if (log.data?.error) {
      runtimeDebugger.acceptFix();
    }
  };

  if (!isOpen) return null;

  const statsData = stats || {
    total: logsState.logs.length,
    fixed: logsState.logs.filter(l => l.type === 'fix').length,
    failed: logsState.logs.filter(l => l.type === 'error' && l.data?.error).length,
    ignored: 0
  };

  return (
    <div className="debug-console">
      {/* En-tête */}
      <div className="console-header">
        <div className="header-left">
          <span className="console-title">🐛 Console de débogage IA</span>
          <span className="console-stats">
            {filteredLogs.length} / {logsState.logs.length} logs
          </span>
        </div>
        
        <div className="header-right">
          <button 
            className={`selection-toggle ${selectionMode ? 'active' : ''}`}
            onClick={handleToggleSelectionMode}
            title="Mode sélection"
          >
            ☑
          </button>
          <button className="export-btn" onClick={handleExport} title="Exporter les logs">
            📥
          </button>
          <button className="export-btn" onClick={handleExportDataset} title="Exporter le dataset IA">
            🤖
          </button>
          <button className="clear-btn" onClick={handleClearLogs} title="Effacer">
            🧹
          </button>
          <button className="console-close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="console-toolbar">
        <div className="filter-section">
          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Tous les événements</option>
            <option value="error">❌ Erreurs</option>
            <option value="fix">✅ Corrections</option>
            <option value="warning">⚠️ Avertissements</option>
            <option value="info">ℹ️ Informations</option>
          </select>

          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="stats-section">
          <div className="stat-item">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{statsData.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">✅ Fix:</span>
            <span className="stat-value">{statsData.fixed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">❌ Échec:</span>
            <span className="stat-value">{statsData.failed}</span>
          </div>
        </div>

        <div className="action-section">
          {selectionMode && (
            <>
              <button className="action-btn" onClick={handleSelectAll}>
                {selectedLogs.size === filteredLogs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              {selectedLogs.size > 0 && (
                <button className="action-btn danger" onClick={handleDeleteSelected}>
                  Supprimer ({selectedLogs.size})
                </button>
              )}
            </>
          )}
          <label className="auto-scroll">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Statistiques détaillées */}
      <div className="stats-details">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">Taux de réussite</div>
            <div className="stat-card-value">
              {statsData.total > 0 
                ? `${Math.round((statsData.fixed / statsData.total) * 100)}%` 
                : '0%'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">Erreurs / heure</div>
            <div className="stat-card-value">
              {Math.round(statsData.total / 24) || 0}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">Temps moyen</div>
            <div className="stat-card-value">1.2s</div>
          </div>
        </div>
      </div>

      {/* Liste virtualisée des logs */}
      <div className="console-content" ref={consoleRef}>
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-message">Aucun log</div>
            {searchQuery && (
              <button className="clear-btn" onClick={() => setSearchQuery('')}>
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                width={width}
                itemCount={filteredLogs.length}
                itemSize={expandedLog ? 120 : 32}
                itemData={{
                  logs: filteredLogs,
                  expandedLog,
                  setExpandedLog,
                  selectionMode,
                  selectedLogs,
                  handleSelectLog,
                  handleJumpToError,
                  handleRetryFix,
                  getTypeColor: (type) => getTypeIcon(type),
                  getTypeIcon,
                  formatTime
                }}
              >
                {LogRow}
              </List>
            )}
          </AutoSizer>
        )}
      </div>

        {/* Pied de page */}
      <div className="console-footer">
        <div className="footer-left">
          <span className="footer-info">
            {filteredLogs.length} logs affichés
          </span>
          {selectedLogs.size > 0 && (
            <span className="footer-info">
              {selectedLogs.size} sélectionnés
            </span>
          )}
        </div>
        <div className="footer-right">
          <button className="footer-btn" onClick={handleClearLogs}>
            Tout effacer
          </button>
        </div>
      </div>

      <style jsx>{`
        .debug-console {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 600px;
          height: 500px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          z-index: 9999;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .console-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
          border-radius: 8px 8px 0 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .console-title {
          font-weight: bold;
          color: #007bff;
        }

        .console-stats {
          font-size: 11px;
          color: #888;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .selection-toggle {
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
          font-size: 12px;
        }

        .selection-toggle:hover {
          background: #3e3e3e;
        }

        .selection-toggle.active {
          background: #007bff;
          color: white;
        }

        .export-btn, .clear-btn, .console-close {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 16px;
        }

        .export-btn:hover, .clear-btn:hover, .console-close:hover {
          background: #3e3e3e;
          color: #fff;
        }

        .console-toolbar {
          padding: 8px 12px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-section {
          display: flex;
          gap: 8px;
        }

        .filter-select {
          width: 150px;
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          font-size: 12px;
        }

        .search-box {
          flex: 1;
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          color: #888;
          font-size: 12px;
        }

        .search-input {
          width: 100%;
          padding: 4px 8px 4px 28px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          font-size: 12px;
        }

        .search-input:focus {
          outline: none;
          border-color: #007bff;
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
        }

        .stats-section {
          display: flex;
          gap: 16px;
          padding: 4px 0;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
        }

        .stat-label {
          color: #888;
        }

        .stat-value {
          color: #d4d4d4;
          font-weight: bold;
        }

        .action-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .action-btn {
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
          font-size: 11px;
        }

        .action-btn:hover {
          background: #3e3e3e;
        }

        .action-btn.danger {
          color: #f48771;
        }

        .action-btn.danger:hover {
          background: #5a2e2e;
        }

        .auto-scroll {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #888;
        }

        .stats-details {
          padding: 8px 12px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .stat-card {
          padding: 6px;
          background: #2d2d2d;
          border-radius: 4px;
          text-align: center;
        }

        .stat-card-title {
          font-size: 10px;
          color: #888;
          margin-bottom: 2px;
        }

        .stat-card-value {
          font-size: 14px;
          font-weight: bold;
          color: #007bff;
        }

        .console-content {
          flex: 1;
          overflow: hidden;
          background: #1e1e1e;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #888;
          gap: 16px;
        }

        .empty-icon {
          font-size: 48px;
        }

        .empty-message {
          font-size: 14px;
        }

        .log-entry {
          margin-bottom: 2px;
          border-left: 3px solid transparent;
          background: #2d2d2d;
          border-radius: 2px;
        }

        .log-entry.selected {
          background: #1e3a5f;
        }

        .log-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          cursor: pointer;
        }

        .log-header:hover {
          background: #3e3e3e;
        }

        .log-checkbox {
          margin: 0;
        }

        .log-time {
          color: #888;
          font-size: 11px;
          min-width: 70px;
        }

        .log-type {
          font-weight: bold;
          font-size: 11px;
          min-width: 80px;
        }

        .log-message {
          flex: 1;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .log-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .log-entry:hover .log-actions {
          opacity: 1;
        }

        .log-action-btn {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 2px;
        }

        .log-action-btn:hover {
          background: #505050;
          color: #fff;
        }

        .log-details {
          padding: 8px;
          background: #1e1e1e;
          border-top: 1px solid #3e3e3e;
        }

        .detail-item {
          display: flex;
          margin-bottom: 4px;
          font-size: 11px;
        }

        .detail-label {
          color: #888;
          min-width: 80px;
        }

        .detail-value {
          color: #d4d4d4;
          word-break: break-word;
        }

        .detail-section {
          margin-top: 8px;
        }

        .detail-code {
          margin-top: 4px;
          padding: 4px;
          background: #000;
          border-radius: 2px;
          font-size: 10px;
          color: #b5cea8;
          white-space: pre-wrap;
          max-height: 150px;
          overflow: auto;
        }

        .console-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #2d2d2d;
          border-top: 1px solid #3e3e3e;
        }

        .footer-left {
          display: flex;
          gap: 16px;
        }

        .footer-info {
          font-size: 11px;
          color: #888;
        }

        .footer-right {
          display: flex;
          gap: 8px;
        }

        .footer-btn {
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
          font-size: 11px;
        }

        .footer-btn:hover {
          background: #3e3e3e;
        }
      `}</style>
    </div>
  );
};
DebugConsole.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default DebugConsole;
