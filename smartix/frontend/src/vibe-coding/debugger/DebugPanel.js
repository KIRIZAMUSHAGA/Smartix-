import React, { useEffect, useRef, useState } from 'react';
import DebugSessionConsole from './DebugSessionConsole';
import './debugger.css';

const createWsUrl = (path) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
};

const DebugPanel = ({ projectId, isDebugging = true, activeFilePath }) => {
  const [variables, setVariables] = useState([]);
  const [callStack, setCallStack] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState('Déconnecté');
  const wsRef = useRef(null);

  useEffect(() => {
    if (!isDebugging || !projectId) return undefined;

    const ws = new WebSocket(createWsUrl(`/ws/debugger/${projectId}`));
    wsRef.current = ws;

    ws.onopen = () => setStatus('Connecté');
    ws.onclose = () => setStatus('Déconnecté');
    ws.onerror = () => setStatus('Erreur WebSocket');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'paused':
          setIsPaused(true);
          setVariables(data.variables || []);
          setCallStack(data.callStack || []);
          break;
        case 'continued':
          setIsPaused(false);
          setVariables([]);
          setCallStack([]);
          break;
        case 'variables':
          setVariables(data.variables || []);
          break;
        case 'started':
          setStatus(data.connected ? 'Debugger actif' : 'Debugger démarré');
          break;
        case 'stopped':
          setStatus('Arrêté');
          setIsPaused(false);
          break;
        default:
          break;
      }
    };

    return () => ws.close();
  }, [projectId, isDebugging]);

  const sendAction = (action) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action }));
    }
  };

  return (
    <div className="debug-panel">
      <div className="debug-toolbar">
        {isPaused ? (
          <>
            <button className="continue-btn" onClick={() => sendAction('continue')}>▶ Continuer</button>
            <button className="step-over-btn" onClick={() => sendAction('stepOver')}>⬇ Pas à pas</button>
            <button className="step-into-btn" onClick={() => sendAction('stepInto')}>⬇ Entrer</button>
            <button className="step-out-btn" onClick={() => sendAction('stepOut')}>⬆ Sortir</button>
          </>
        ) : (
          <button className="stop-btn" onClick={() => sendAction('stop')}>⏹ Arrêter</button>
        )}
        <span>{status}</span>
      </div>

      <DebugSessionConsole
        projectId={projectId}
        activeFilePath={activeFilePath}
        onSessionChange={(session) => {
          setStatus(session.running ? 'Session démarrée' : 'Session arrêtée');
          if (!session.running) {
            setIsPaused(false);
            setVariables([]);
            setCallStack([]);
          }
        }}
      />

      <div className="debug-sections">
        <div className="variables-section">
          <h4>Variables</h4>
          <div className="variables-list">
            {variables.length === 0 && <div className="variable-item">Aucune variable capturée</div>}
            {variables.map(v => (
              <div key={`${v.name}-${v.value}`} className="variable-item">
                <span className="var-name">{v.name}</span>
                <span className="var-value">: {v.value}</span>
                <span className="var-type">({v.type})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="callstack-section">
          <h4>Pile d'appels</h4>
          <div className="callstack-list">
            {callStack.length === 0 && <div className="callstack-item">Aucune frame active</div>}
            {callStack.map((frame, idx) => (
              <div key={`${frame.file}-${frame.line}-${idx}`} className="callstack-item">
                <span className="frame-function">{frame.function}</span>
                <span className="frame-file">{frame.file}:{frame.line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;