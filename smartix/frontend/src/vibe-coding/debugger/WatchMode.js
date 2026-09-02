import { useEffect, useState } from 'react';
import './debugger.css';

const createWsUrl = (path) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
};

const WatchMode = ({ projectId, projectPath = '.', onRestart }) => {
  const [isWatching, setIsWatching] = useState(false);
  const [lastRestart, setLastRestart] = useState(null);
  const [fileChanged, setFileChanged] = useState(null);

  useEffect(() => {
    if (!isWatching || !projectId) return undefined;

    fetch(`/api/watch/${projectId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_path: projectPath }),
    }).catch(() => {});

    const ws = new WebSocket(createWsUrl(`/ws/watch/${projectId}`));

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'restart_required') {
        onRestart?.(data);
        setLastRestart(new Date());
        setFileChanged(data.file_changed);
      }
    };

    return () => {
      ws.close();
      fetch(`/api/watch/${projectId}/stop`, { method: 'POST' }).catch(() => {});
    };
  }, [isWatching, onRestart, projectId, projectPath]);

  return (
    <div className="watch-mode">
      <button onClick={() => setIsWatching(!isWatching)}>
        {isWatching ? '⏸ Pause' : '▶ Watch mode'}
      </button>
      {lastRestart && (
        <span title={fileChanged || ''}>Dernier redémarrage: {lastRestart.toLocaleTimeString()}</span>
      )}
    </div>
  );
};

export default WatchMode;