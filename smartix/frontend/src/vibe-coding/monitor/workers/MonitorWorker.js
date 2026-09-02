/**
 * MonitorWorker
 * Web Worker pour la surveillance en arrière-plan
 */

/* eslint-disable no-restricted-globals */

// État du worker
let monitoring = false;
let interval = null;
let projectId = null;
let metrics = {
  cpu: [],
  memory: [],
  fps: [],
  events: []
};

// Configuration
const CONFIG = {
  interval: 1000, // 1 seconde
  maxSamples: 100,
  thresholds: {
    cpu: 80,
    memory: 200,
    fps: 30
  }
};

// Initialisation
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'start':
      startMonitoring(data.projectId, data.config);
      break;
    case 'stop':
      stopMonitoring();
      break;
    case 'getMetrics':
      sendMetrics();
      break;
    case 'clearMetrics':
      clearMetrics();
      break;
    case 'recordEvent':
      recordEvent(data.event);
      break;
  }
});

/**
 * Démarre la surveillance
 */
function startMonitoring(id, config = {}) {
  if (monitoring) return;

  projectId = id;
  Object.assign(CONFIG, config);

  monitoring = true;
  interval = setInterval(collectMetrics, CONFIG.interval);

  self.postMessage({ type: 'started', data: { projectId } });
}

/**
 * Arrête la surveillance
 */
function stopMonitoring() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  monitoring = false;
  self.postMessage({ type: 'stopped' });
}

/**
 * Collecte les métriques
 */
function collectMetrics() {
  const timestamp = Date.now();

  // Simuler CPU (utilisation aléatoire entre 10 et 60%)
  const cpu = 10 + Math.random() * 50;
  metrics.cpu.push({ value: Math.round(cpu), timestamp });

  // Simuler mémoire (entre 50 et 300 MB)
  const memory = 50 + Math.random() * 250;
  metrics.memory.push({ value: Math.round(memory), timestamp });

  // Simuler FPS (entre 30 et 60)
  const fps = 30 + Math.random() * 30;
  metrics.fps.push({ value: Math.round(fps), timestamp });

  // Limiter le nombre d'échantillons
  Object.keys(metrics).forEach(key => {
    if (metrics[key].length > CONFIG.maxSamples) {
      metrics[key] = metrics[key].slice(-CONFIG.maxSamples);
    }
  });

  // Vérifier les seuils
  checkThresholds(cpu, memory, fps);

  // Envoyer les métriques
  self.postMessage({
    type: 'metrics',
    data: {
      cpu: Math.round(cpu),
      memory: Math.round(memory),
      fps: Math.round(fps),
      timestamp
    }
  });
}

/**
 * Vérifie les seuils d'alerte
 */
function checkThresholds(cpu, memory, fps) {
  const alerts = [];

  if (cpu > CONFIG.thresholds.cpu) {
    alerts.push({
      type: 'cpu',
      severity: 'high',
      message: `CPU élevé: ${Math.round(cpu)}%`
    });
  }

  if (memory > CONFIG.thresholds.memory) {
    alerts.push({
      type: 'memory',
      severity: 'high',
      message: `Mémoire élevée: ${Math.round(memory)}MB`
    });
  }

  if (fps < CONFIG.thresholds.fps) {
    alerts.push({
      type: 'fps',
      severity: 'warning',
      message: `FPS bas: ${Math.round(fps)}`
    });
  }

  if (alerts.length > 0) {
    self.postMessage({ type: 'alerts', data: alerts });
  }
}

/**
 * Enregistre un événement
 */
function recordEvent(event) {
  const timestamp = Date.now();
  metrics.events.push({ ...event, timestamp });

  if (metrics.events.length > CONFIG.maxSamples) {
    metrics.events = metrics.events.slice(-CONFIG.maxSamples);
  }

  self.postMessage({ type: 'event', data: event });
}

/**
 * Envoie toutes les métriques
 */
function sendMetrics() {
  self.postMessage({
    type: 'metricsData',
    data: { ...metrics }
  });
}

/**
 * Nettoie les métriques
 */
function clearMetrics() {
  metrics = {
    cpu: [],
    memory: [],
    fps: [],
    events: []
  };
  self.postMessage({ type: 'cleared' });
}

// Gestion des erreurs
self.addEventListener('error', (error) => {
  self.postMessage({
    type: 'error',
    data: { message: error.message }
  });
});

export default {}; // Pour l'import, le worker sera utilisé via new Worker()
