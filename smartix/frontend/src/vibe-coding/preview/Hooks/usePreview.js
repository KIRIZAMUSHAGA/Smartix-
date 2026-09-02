/**
 * usePreview - Hook React pour la prévisualisation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PreviewServer from '../PreviewServer';

export const usePreview = (projectId, options = {}) => {
  const [server, setServer] = useState(null);
  const [state, setState] = useState('stopped');
  const [url, setUrl] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildQueue, setBuildQueue] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  const serverRef = useRef(null);
  const mounted = useRef(true);
  const wsRef = useRef(null);

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      try {
        const previewServer = new PreviewServer(projectId, options);
        
        // Écouter les événements
        previewServer.on('starting', () => {
          if (mounted.current) setState('starting');
        });

        previewServer.on('started', ({ url }) => {
          if (mounted.current) {
            setState('running');
            setUrl(url);
          }
        });

        previewServer.on('stopped', () => {
          if (mounted.current) setState('stopped');
        });

        previewServer.on('buildStart', () => {
          if (mounted.current) setBuildProgress(0);
        });

        previewServer.on('buildComplete', (result) => {
          if (mounted.current) {
            setBuildProgress(100);
            setBuildQueue(0);
          }
        });

        previewServer.on('buildError', (error) => {
          if (mounted.current) {
            setError(error.message);
          }
        });

        previewServer.logger.on('log', (log) => {
          if (mounted.current) {
            setLogs(prev => [...prev, log].slice(-100));
          }
        });

        serverRef.current = previewServer;
        setServer(previewServer);
        
      } catch (err) {
        if (mounted.current) setError(err.message);
      }
    };

    init();

    return () => {
      mounted.current = false;
      if (serverRef.current) {
        serverRef.current.stop().catch(console.error);
      }
    };
  }, [projectId]);

  // Connexion WebSocket pour les mises à jour temps réel
  useEffect(() => {
    if (!url || state !== 'running') return;

    const wsPort = parseInt(url.split(':').pop()) + 1;
    const ws = new WebSocket(`ws://localhost:${wsPort}`);

    ws.onopen = () => {
      if (mounted.current) setWsConnected(true);
    };

    ws.onclose = () => {
      if (mounted.current) setWsConnected(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'file-changed':
          console.log('Fichier modifié:', data.file);
          break;
        case 'build-start':
          if (mounted.current) setBuildProgress(0);
          break;
        case 'build-complete':
          if (mounted.current) setBuildProgress(100);
          break;
        case 'build-error':
          if (mounted.current) setError(data.error);
          break;
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [url, state]);

  const start = useCallback(async () => {
    if (!serverRef.current) return;
    try {
      setError(null);
      return await serverRef.current.start();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const stop = useCallback(async () => {
    if (!serverRef.current) return;
    try {
      setError(null);
      return await serverRef.current.stop();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const restart = useCallback(async () => {
    if (!serverRef.current) return;
    try {
      setError(null);
      return await serverRef.current.restart();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const build = useCallback(async () => {
    if (!serverRef.current) return;
    try {
      setError(null);
      return await serverRef.current.build();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const clearLogs = useCallback(() => {
    if (mounted.current) setLogs([]);
  }, []);

  return {
    server,
    state,
    url,
    logs,
    error,
    buildProgress,
    buildQueue,
    wsConnected,
    isRunning: state === 'running',
    isStarting: state === 'starting',
    isStopped: state === 'stopped',
    hasError: state === 'error',
    start,
    stop,
    restart,
    build,
    clearLogs
  };
};
