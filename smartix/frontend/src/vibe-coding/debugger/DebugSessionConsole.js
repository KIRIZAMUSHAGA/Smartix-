import React, { useEffect, useState } from 'react';
import './debugger.css';

const HISTORY_LIMIT = 8;

const getStorageKey = (projectId) => `vibe-debug-session-history:${projectId || 'default'}`;

const DebugSessionConsole = ({ projectId, activeFilePath, onSessionChange }) => {
  const [runtime, setRuntime] = useState('node');
  const [filePath, setFilePath] = useState(activeFilePath || '');
  const [isRunning, setIsRunning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('Aucune session active');
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(projectId));
      setHistory(stored ? JSON.parse(stored) : []);
    } catch {
      setHistory([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (activeFilePath && !isRunning) {
      setFilePath(activeFilePath);
      setRuntime(activeFilePath.endsWith('.py') ? 'python' : 'node');
    }
  }, [activeFilePath, isRunning]);

  const persistHistory = (nextHistory) => {
    setHistory(nextHistory);
    try {
      localStorage.setItem(getStorageKey(projectId), JSON.stringify(nextHistory));
    } catch {
      setMessage('Historique non sauvegardé localement');
    }
  };

  const rememberSession = (session) => {
    const normalized = {
      runtime: session.runtime,
      filePath: session.filePath,
      lastRunAt: new Date().toISOString(),
    };
    const nextHistory = [
      normalized,
      ...history.filter(item => !(item.runtime === normalized.runtime && item.filePath === normalized.filePath)),
    ].slice(0, HISTORY_LIMIT);
    persistHistory(nextHistory);
  };

  const removeHistoryItem = (item) => {
    persistHistory(history.filter(entry => !(entry.runtime === item.runtime && entry.filePath === item.filePath)));
  };

  const clearHistory = () => {
    persistHistory([]);
  };

  const startSession = async (override = null) => {
    const selectedRuntime = override?.runtime || runtime;
    const selectedFilePath = (override?.filePath || filePath).trim();

    if (!projectId || !selectedFilePath) {
      setError('Sélectionne ou saisis un fichier à debugger.');
      return;
    }

    setRuntime(selectedRuntime);
    setFilePath(selectedFilePath);
    setIsBusy(true);
    setError(null);
    setMessage('Démarrage de la session...');

    try {
      const response = await fetch(`/api/debugger/${projectId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: selectedFilePath,
          runtime: selectedRuntime,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || 'Impossible de démarrer le debugger.');
      }

      setIsRunning(true);
      const label = selectedRuntime === 'python' ? 'Python' : 'Node.js';
      setMessage(`${label} actif${data.pid ? ` · PID ${data.pid}` : ''}`);
      rememberSession({ runtime: selectedRuntime, filePath: selectedFilePath });
      onSessionChange?.({ running: true, runtime: selectedRuntime, filePath: selectedFilePath, details: data });
    } catch (err) {
      setIsRunning(false);
      setError(err.message);
      setMessage('Échec du démarrage');
    } finally {
      setIsBusy(false);
    }
  };

  const stopSession = async () => {
    if (!projectId) return;

    setIsBusy(true);
    setError(null);
    setMessage('Arrêt de la session...');

    try {
      const response = await fetch(`/api/debugger/${projectId}/stop`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || 'Impossible d’arrêter le debugger.');
      }

      setIsRunning(false);
      setMessage('Session arrêtée');
      onSessionChange?.({ running: false, runtime, filePath: filePath.trim(), details: data });
    } catch (err) {
      setError(err.message);
      setMessage('Échec de l’arrêt');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="debug-session-console">
      <div className="debug-session-header">
        <strong>Session Debug</strong>
        <span className={isRunning ? 'session-badge running' : 'session-badge'}>
          {isRunning ? 'Active' : 'Inactive'}
        </span>
      </div>

      <label className="debug-session-field">
        Runtime
        <select value={runtime} onChange={(event) => setRuntime(event.target.value)} disabled={isRunning || isBusy}>
          <option value="node">Node.js</option>
          <option value="python">Python</option>
        </select>
      </label>

      <label className="debug-session-field">
        Fichier
        <input
          value={filePath}
          onChange={(event) => setFilePath(event.target.value)}
          placeholder="/chemin/vers/app.js ou app.py"
          disabled={isRunning || isBusy}
        />
      </label>

      <div className="debug-session-actions">
        <button onClick={startSession} disabled={isRunning || isBusy}>
          ▶ Démarrer
        </button>
        <button onClick={stopSession} disabled={!isRunning || isBusy}>
          ⏹ Arrêter
        </button>
      </div>

      <div className="debug-session-message">{message}</div>
      {error && <div className="debug-session-error">{error}</div>}

      <div className="debug-session-history">
        <div className="debug-session-history-header">
          <strong>Sessions récentes</strong>
          {history.length > 0 && (
            <button type="button" onClick={clearHistory} disabled={isBusy || isRunning}>
              Effacer
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="debug-session-empty">Aucune session récente</div>
        ) : (
          <div className="debug-session-history-list">
            {history.map(item => (
              <div className="debug-session-history-item" key={`${item.runtime}:${item.filePath}`}>
                <button
                  type="button"
                  className="debug-session-relaunch"
                  onClick={() => startSession(item)}
                  disabled={isBusy || isRunning}
                  title={`Relancer ${item.filePath}`}
                >
                  <span className="debug-session-history-runtime">{item.runtime === 'python' ? 'Python' : 'Node.js'}</span>
                  <span className="debug-session-history-path">{item.filePath}</span>
                </button>
                <button
                  type="button"
                  className="debug-session-remove"
                  onClick={() => removeHistoryItem(item)}
                  disabled={isBusy || isRunning}
                  title="Retirer de l'historique"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugSessionConsole;