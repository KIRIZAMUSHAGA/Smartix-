/**
 * useRuntimeMonitor
 * Hook React pour utiliser le moniteur d'exécution
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RuntimeMonitor } from '../core/RuntimeMonitor';
const createMonitorWorker = () => new Worker(new URL('../workers/MonitorWorker.js', import.meta.url));

export const useRuntimeMonitor = (projectId, options = {}) => {
  const [monitor] = useState(() => new RuntimeMonitor(options));
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [useWorker, setUseWorker] = useState(options.useWorker || false);
  
  const monitorRef = useRef(monitor);
  const workerRef = useRef(null);

  // Initialisation
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (useWorker) {
          await initWorker();
        } else {
          await monitorRef.current.initialize(projectId);
        }
        
        setInitialized(true);
        updateStats();
      } catch (error) {
        console.error('Erreur initialisation moniteur:', error);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      init();
    }

    return () => {
      if (useWorker && workerRef.current) {
        workerRef.current.terminate();
      } else {
        monitorRef.current.shutdown();
      }
    };
  }, [projectId, useWorker]);

  // Initialisation du worker
  const initWorker = async () => {
    workerRef.current = createMonitorWorker();
    
    workerRef.current.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'metrics':
          updateMetrics(data);
          break;
        case 'alerts':
          handleAlerts(data);
          break;
        case 'event':
          handleEvent(data);
          break;
        case 'started':
          setIsMonitoring(true);
          break;
        case 'stopped':
          setIsMonitoring(false);
          break;
      }
    });

    workerRef.current.postMessage({
      type: 'start',
      data: { projectId, config: options }
    });
  };

  // Mise à jour des statistiques
  const updateStats = useCallback(() => {
    if (!monitorRef.current) return;
    const newStats = monitorRef.current.getStats();
    setStats(newStats);
    setAlerts(newStats?.alerts?.active || []);
    setEvents(newStats?.events?.recent || []);
    setMetrics(newStats?.metrics || {});
  }, []);

  // Mise à jour des métriques (worker)
  const updateMetrics = (data) => {
    setMetrics(prev => ({
      ...prev,
      [data.type]: {
        current: data.value,
        timestamp: data.timestamp
      }
    }));
  };

  // Gestion des alertes (worker)
  const handleAlerts = (newAlerts) => {
    setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
  };

  // Gestion des événements (worker)
  const handleEvent = (event) => {
    setEvents(prev => [event, ...prev].slice(0, 100));
  };

  // Démarrer la surveillance
  const startMonitoring = useCallback(() => {
    if (useWorker && workerRef.current) {
      workerRef.current.postMessage({ type: 'start', data: { projectId } });
    } else {
      monitorRef.current.start();
      setIsMonitoring(true);
    }
  }, [useWorker, projectId]);

  // Arrêter la surveillance
  const stopMonitoring = useCallback(() => {
    if (useWorker && workerRef.current) {
      workerRef.current.postMessage({ type: 'stop' });
    } else {
      monitorRef.current.stop();
      setIsMonitoring(false);
    }
  }, [useWorker]);

  // Enregistrer un événement
  const logEvent = useCallback((type, data) => {
    if (useWorker && workerRef.current) {
      workerRef.current.postMessage({
        type: 'recordEvent',
        data: { event: { type, data } }
      });
    } else {
      monitorRef.current.logEvent(type, data);
      updateStats();
    }
  }, [useWorker, updateStats]);

  // Enregistrer une erreur
  const logError = useCallback((error, context) => {
    if (useWorker && workerRef.current) {
      workerRef.current.postMessage({
        type: 'recordEvent',
        data: { event: { type: 'error', data: { error, context } } }
      });
    } else {
      monitorRef.current.logError(error, context);
      updateStats();
    }
  }, [useWorker, updateStats]);

  // Enregistrer une métrique
  const recordMetric = useCallback((name, value) => {
    if (useWorker && workerRef.current) {
      workerRef.current.postMessage({
        type: 'recordEvent',
        data: { event: { type: 'metric', data: { name, value } } }
      });
    } else {
      monitorRef.current.recordMetric(name, value);
      updateStats();
    }
  }, [useWorker, updateStats]);

  // Acquitter une alerte
  const acknowledgeAlert = useCallback((alertId) => {
    if (!useWorker) {
      monitorRef.current.acknowledgeAlert(alertId);
      updateStats();
    }
  }, [useWorker, updateStats]);

  // Générer un rapport
  const generateReport = useCallback((period = '24h') => {
    if (useWorker) {
      // TODO: Implémenter rapport depuis worker
      return null;
    }
    return monitorRef.current.generateReport({ period });
  }, [useWorker]);

  // Exporter les données
  const exportData = useCallback((format = 'json') => {
    if (useWorker) {
      // TODO: Implémenter export depuis worker
      return null;
    }
    return monitorRef.current.exportData(format);
  }, [useWorker]);

  // Réinitialiser
  const reset = useCallback(() => {
    if (useWorker && workerRef.current) {
      workerRef.current.postMessage({ type: 'clearMetrics' });
    } else {
      monitorRef.current.reset();
      updateStats();
    }
  }, [useWorker, updateStats]);

  return {
    // État
    initialized,
    loading,
    isMonitoring,
    stats,
    alerts,
    events,
    metrics,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    logEvent,
    logError,
    recordMetric,
    acknowledgeAlert,
    generateReport,
    exportData,
    reset,
    
    // Accès direct
    monitor: monitorRef.current
  };
};

export default useRuntimeMonitor;
