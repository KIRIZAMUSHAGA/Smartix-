/**
 * StatsViewer
 * Visualiseur de statistiques en temps réel
 */

import React, { useState, useEffect } from 'react';

export const StatsViewer = ({ stats }) => {
  const [refreshRate, setRefreshRate] = useState(1000);
  const [selectedMetric, setSelectedMetric] = useState('all');
  const [chartData, setChartData] = useState({});

  useEffect(() => {
    if (!stats?.performance) return;

    // Préparer les données pour les graphiques
    const data = {
      fps: stats.performance.fps?.samples || [],
      memory: stats.performance.memory?.samples || [],
      network: stats.performance.network?.requests || []
    };

    setChartData(data);
  }, [stats]);

  if (!stats) {
    return (
      <div className="stats-viewer empty">
        <div className="empty-icon">📊</div>
        <div>Aucune statistique disponible</div>

        <style jsx>{`
          .stats-viewer.empty {
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
        `}</style>
      </div>
    );
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const MetricCard = ({ title, value, unit, color, icon, trend }) => (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-icon">{icon}</span>
        <span className="metric-title">{title}</span>
      </div>
      <div className="metric-value" style={{ color }}>
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {trend && (
        <div className="metric-trend">
          <span className={`trend-${trend.direction}`}>
            {trend.direction === 'up' ? '▲' : '▼'}
          </span>
          <span>{trend.value}%</span>
        </div>
      )}
    </div>
  );

  const ProgressBar = ({ value, max, label, color }) => (
    <div className="progress-bar">
      <div className="progress-label">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="progress-track">
        <div 
          className="progress-fill"
          style={{ 
            width: `${(value / max) * 100}%`,
            background: color 
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="stats-viewer">
      {/* En-tête avec contrôles */}
      <div className="stats-header">
        <h3>Statistiques en temps réel</h3>
        <div className="stats-controls">
          <select 
            value={refreshRate} 
            onChange={(e) => setRefreshRate(Number(e.target.value))}
          >
            <option value={500}>0.5s</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
          </select>
          <select 
            value={selectedMetric} 
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            <option value="all">Toutes les métriques</option>
            <option value="fps">FPS</option>
            <option value="memory">Mémoire</option>
            <option value="network">Réseau</option>
          </select>
        </div>
      </div>

      {/* Cartes de métriques principales */}
      <div className="metrics-grid">
        {/* Application */}
        <MetricCard
          title="État"
          value={stats.isRunning ? 'En cours' : 'Arrêté'}
          color={stats.isRunning ? '#28a745' : '#dc3545'}
          icon="⚡"
        />
        
        <MetricCard
          title="Type"
          value={stats.projectType}
          color="#007bff"
          icon="📦"
        />
        
        <MetricCard
          title="Processus"
          value={stats.processes?.length || 0}
          color="#ffc107"
          icon="⚙️"
        />
        
        <MetricCard
          title="Logs"
          value={stats.logsCount || 0}
          color="#17a2b8"
          icon="📋"
        />
      </div>

      {/* Performance */}
      {stats.performance && (selectedMetric === 'all' || selectedMetric === 'fps') && (
        <div className="stats-section">
          <h4>Performance</h4>
          <div className="metrics-grid">
            <MetricCard
              title="FPS"
              value={stats.performance.fps?.current || 0}
              unit=" fps"
              color={stats.performance.fps?.current < 30 ? '#dc3545' : '#28a745'}
              icon="🎮"
            />
            
            <MetricCard
              title="Moyenne FPS"
              value={Math.round(stats.performance.fps?.average || 0)}
              unit=" fps"
              color="#007bff"
              icon="📊"
            />
            
            <MetricCard
              title="Min FPS"
              value={stats.performance.fps?.min || 0}
              unit=" fps"
              color="#ffc107"
              icon="⬇️"
            />
            
            <MetricCard
              title="Max FPS"
              value={stats.performance.fps?.max || 0}
              unit=" fps"
              color="#17a2b8"
              icon="⬆️"
            />
          </div>

          {/* Barre de stabilité */}
          {stats.performance.fps?.stability && (
            <ProgressBar
              value={stats.performance.fps.stability * 100}
              max={100}
              label="Stabilité"
              color="#007bff"
            />
          )}
        </div>
      )}

      {/* Mémoire */}
      {stats.performance?.memory && (selectedMetric === 'all' || selectedMetric === 'memory') && (
        <div className="stats-section">
          <h4>Mémoire</h4>
          <div className="metrics-grid">
            <MetricCard
              title="Utilisée"
              value={formatBytes(stats.performance.memory.current?.used)}
              color="#17a2b8"
              icon="💾"
            />
            
            <MetricCard
              title="Totale"
              value={formatBytes(stats.performance.memory.current?.total)}
              color="#007bff"
              icon="📀"
            />
            
            <MetricCard
              title="Utilisation"
              value={Math.round(stats.performance.memory.current?.percentage || 0)}
              unit="%"
              color={
                stats.performance.memory.current?.percentage > 80 
                  ? '#dc3545' 
                  : stats.performance.memory.current?.percentage > 60 
                    ? '#ffc107' 
                    : '#28a745'
              }
              icon="📊"
            />
          </div>

          <ProgressBar
            value={stats.performance.memory.current?.percentage || 0}
            max={100}
            label="Utilisation mémoire"
            color={
              stats.performance.memory.current?.percentage > 80 
                ? '#dc3545' 
                : '#007bff'
            }
          />
        </div>
      )}

      {/* Réseau */}
      {stats.performance?.network && (selectedMetric === 'all' || selectedMetric === 'network') && (
        <div className="stats-section">
          <h4>Réseau</h4>
          <div className="metrics-grid">
            <MetricCard
              title="Requêtes"
              value={stats.performance.network.totalRequests || 0}
              color="#28a745"
              icon="🌐"
            />
            
            <MetricCard
              title="Données"
              value={formatBytes(stats.performance.network.totalSize || 0)}
              color="#007bff"
              icon="📦"
            />
            
            <MetricCard
              title="Latence"
              value={Math.round(stats.performance.network.averageLatency || 0)}
              unit="ms"
              color="#ffc107"
              icon="⏱️"
            />
          </div>

          {/* Dernières requêtes */}
          {stats.performance.network.requests?.length > 0 && (
            <div className="network-requests">
              <h5>Dernières requêtes</h5>
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>URL</th>
                    <th>Durée</th>
                    <th>Taille</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.performance.network.requests.slice(-5).map((req, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`request-type ${req.type}`}>
                          {req.type}
                        </span>
                      </td>
                      <td className="request-url">{req.name}</td>
                      <td className={req.duration > 1000 ? 'slow' : ''}>
                        {Math.round(req.duration)}ms
                      </td>
                      <td>{formatBytes(req.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Erreurs */}
      {stats.errors && stats.errors.total > 0 && (
        <div className="stats-section errors">
          <h4>Erreurs</h4>
          <div className="metrics-grid">
            <MetricCard
              title="Total"
              value={stats.errors.total}
              color="#dc3545"
              icon="❌"
            />
            
            <MetricCard
              title="Types"
              value={Object.keys(stats.errors.byType || {}).length}
              color="#ffc107"
              icon="📋"
            />
          </div>

          {/* Dernières erreurs */}
          {stats.errors.recent?.length > 0 && (
            <div className="recent-errors">
              {stats.errors.recent.map((err, i) => (
                <div key={i} className="error-item">
                  <span className="error-time">{err.time}</span>
                  <span className="error-message">{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .stats-viewer {
          height: 100%;
          overflow: auto;
          padding: 8px;
        }

        .stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .stats-header h3 {
          margin: 0;
          color: #007bff;
        }

        .stats-controls {
          display: flex;
          gap: 8px;
        }

        .stats-controls select {
          padding: 4px 8px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
        }

        .stats-controls select:hover {
          background: #3e3e3e;
        }

        .stats-section {
          margin-bottom: 24px;
          padding: 16px;
          background: #2d2d2d;
          border-radius: 8px;
        }

        .stats-section h4 {
          margin: 0 0 12px 0;
          color: #007bff;
        }

        .stats-section h5 {
          margin: 16px 0 8px 0;
          color: #888;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .metric-card {
          background: #1e1e1e;
          padding: 12px;
          border-radius: 6px;
        }

        .metric-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
          color: #888;
          font-size: 12px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: bold;
        }

        .metric-unit {
          font-size: 12px;
          color: #888;
          margin-left: 4px;
        }

        .metric-trend {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 11px;
        }

        .trend-up {
          color: #28a745;
        }

        .trend-down {
          color: #dc3545;
        }

        .progress-bar {
          margin-top: 8px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
        }

        .progress-track {
          height: 4px;
          background: #1e1e1e;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .network-requests {
          margin-top: 16px;
        }

        .requests-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .requests-table th {
          text-align: left;
          padding: 6px;
          color: #888;
          font-weight: normal;
          border-bottom: 1px solid #3e3e3e;
        }

        .requests-table td {
          padding: 6px;
          border-bottom: 1px solid #2d2d2d;
        }

        .request-type {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          background: #2d2d2d;
        }

        .request-type.fetch {
          color: #b5cea8;
        }

        .request-type.xhr {
          color: #9cdcfe;
        }

        .request-type.other {
          color: #888;
        }

        .request-url {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .slow {
          color: #dc3545;
        }

        .recent-errors {
          margin-top: 12px;
        }

        .error-item {
          display: flex;
          gap: 12px;
          padding: 6px;
          background: #1e1e1e;
          border-radius: 4px;
          margin-bottom: 2px;
          font-size: 12px;
        }

        .error-time {
          color: #888;
          min-width: 70px;
        }

        .error-message {
          color: #f48771;
        }

        .stats-section.errors {
          border-left: 3px solid #dc3545;
        }
      `}</style>
    </div>
  );
};

export default StatsViewer;
