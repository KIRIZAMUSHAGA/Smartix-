/**
 * MonitorDashboard
 * Dashboard principal de monitoring
 */

import React, { useState, useEffect } from 'react';
import { MetricChart } from './MetricChart';
import { EventLog } from './EventLog';
import { AlertList } from './AlertList';
import { PerformanceGauge } from './PerformanceGauge';
import { TimelineView } from './TimelineView';
import PropTypes from 'prop-types';

export const MonitorDashboard = ({ monitor, onClose }) => {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!monitor) return;

    const updateStats = () => {
      setStats(monitor.getStats());
    };

    updateStats();
    
    const interval = setInterval(() => {
      if (autoRefresh) {
        updateStats();
      }
    }, 5000);

    monitor.addEventListener('alert', updateStats);
    monitor.addEventListener('event', updateStats);

    return () => {
      clearInterval(interval);
      monitor.removeEventListener('alert', updateStats);
      monitor.removeEventListener('event', updateStats);
    };
  }, [monitor, autoRefresh]);

  const handleAcknowledgeAlert = (alertId) => {
    monitor.acknowledgeAlert(alertId);
  };

  const handleExport = async (format = 'json') => {
    const report = monitor.generateReport({ period: timeRange });
    const data = JSON.stringify(report, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const timeRanges = [
    { value: '1h', label: 'Dernière heure' },
    { value: '6h', label: '6 heures' },
    { value: '24h', label: '24 heures' },
    { value: '7d', label: '7 jours' }
  ];

  if (!stats) {
    return (
      <div className="monitor-dashboard loading">
        <div className="loader">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="monitor-dashboard">
      {/* En-tête */}
      <div className="dashboard-header">
        <div className="header-left">
          <h2>📊 Tableau de bord monitoring</h2>
          <div className="project-info">
            Projet: <span className="project-id">{monitor.projectId}</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="time-range">
            {timeRanges.map(range => (
              <button
                key={range.value}
                className={timeRange === range.value ? 'active' : ''}
                onClick={() => setTimeRange(range.value)}
              >
                {range.label}
              </button>
            ))}
          </div>
          
          <label className="auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          
          <button className="export-btn" onClick={() => handleExport()}>
            📥 Exporter
          </button>
          
          {onClose && (
            <button className="close-btn" onClick={onClose}>✕</button>
          )}
        </div>
      </div>

      {/* Cartes de résumé */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">⏱️</div>
          <div className="card-content">
            <div className="card-label">Uptime</div>
            <div className="card-value">{stats.uptime}</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon">⚠️</div>
          <div className="card-content">
            <div className="card-label">Alertes actives</div>
            <div className="card-value">{stats.alerts?.active || 0}</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon">📋</div>
          <div className="card-content">
            <div className="card-label">Événements</div>
            <div className="card-value">{stats.events?.total || 0}</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon">💾</div>
          <div className="card-content">
            <div className="card-label">Métriques</div>
            <div className="card-value">{Object.keys(stats.metrics || {}).length}</div>
          </div>
        </div>
      </div>

      {/* Score de santé */}
      <div className="health-score">
        <div className="health-header">
          <h3>Santé du système</h3>
          <span className={`health-badge health-${stats.health?.status}`}>
            {stats.health?.status}
          </span>
        </div>
        <div className="health-bar">
          <div 
            className="health-fill"
            style={{ width: `${stats.health?.score || 0}%` }}
          />
        </div>
      </div>

      {/* Onglets */}
      <div className="dashboard-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Vue d'ensemble
        </button>
        <button
          className={activeTab === 'metrics' ? 'active' : ''}
          onClick={() => setActiveTab('metrics')}
        >
          Métriques
        </button>
        <button
          className={activeTab === 'alerts' ? 'active' : ''}
          onClick={() => setActiveTab('alerts')}
        >
          Alertes ({stats.alerts?.active || 0})
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          Événements
        </button>
        <button
          className={activeTab === 'performance' ? 'active' : ''}
          onClick={() => setActiveTab('performance')}
        >
          Performance
        </button>
      </div>

      {/* Contenu */}
      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="gauges-grid">
              <PerformanceGauge
                label="CPU"
                value={stats.metrics?.cpu?.current || 0}
                max={100}
                unit="%"
                color="#f48771"
              />
              <PerformanceGauge
                label="Mémoire"
                value={stats.metrics?.memory?.current || 0}
                max={512}
                unit="MB"
                color="#b5cea8"
              />
              <PerformanceGauge
                label="FPS"
                value={stats.metrics?.fps?.current || 0}
                max={60}
                unit="fps"
                color="#9cdcfe"
              />
              <PerformanceGauge
                label="Latence"
                value={stats.metrics?.responseTime?.current || 0}
                max={1000}
                unit="ms"
                color="#ffd93e"
              />
            </div>

            <div className="recent-section">
              <h3>Alertes récentes</h3>
              <AlertList
                alerts={stats.alerts?.active?.slice(0, 5) || []}
                onAcknowledge={handleAcknowledgeAlert}
              />
            </div>

            <div className="recent-section">
              <h3>Événements récents</h3>
              <EventLog events={stats.events?.recent?.slice(0, 10) || []} />
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="metrics-tab">
            <div className="charts-grid">
              <MetricChart
                title="CPU"
                data={stats.metrics?.cpu?.history || []}
                color="#f48771"
                unit="%"
              />
              <MetricChart
                title="Mémoire"
                data={stats.metrics?.memory?.history || []}
                color="#b5cea8"
                unit="MB"
              />
              <MetricChart
                title="FPS"
                data={stats.metrics?.fps?.history || []}
                color="#9cdcfe"
                unit="fps"
              />
              <MetricChart
                title="Temps de réponse"
                data={stats.metrics?.responseTime?.history || []}
                color="#ffd93e"
                unit="ms"
              />
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="alerts-tab">
            <AlertList
              alerts={stats.alerts?.active || []}
              onAcknowledge={handleAcknowledgeAlert}
              showResolved
            />
          </div>
        )}

        {activeTab === 'events' && (
          <div className="events-tab">
            <EventLog events={stats.events?.recent || []} />
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="performance-tab">
            <TimelineView
              data={stats.timeline || {}}
              period={timeRange}
            />
            
            <div className="bottlenecks-section">
              <h3>Goulots d'étranglement</h3>
              {stats.bottlenecks?.map((b, i) => (
                <div key={i} className={`bottleneck-item severity-${b.severity}`}>
                  <strong>{b.type}</strong>: {b.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .monitor-dashboard {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90vw;
          max-width: 1200px;
          height: 80vh;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          z-index: 10000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
          border-radius: 8px 8px 0 0;
        }

        .header-left h2 {
          margin: 0 0 4px 0;
          color: #007bff;
        }

        .project-info {
          font-size: 12px;
          color: #888;
        }

        .project-id {
          color: #9cdcfe;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .time-range {
          display: flex;
          gap: 4px;
        }

        .time-range button {
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
          font-size: 12px;
        }

        .time-range button:hover {
          background: #3e3e3e;
        }

        .time-range button.active {
          background: #007bff;
          color: white;
        }

        .auto-refresh {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #888;
        }

        .export-btn, .close-btn {
          padding: 4px 8px;
          background: transparent;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
        }

        .export-btn:hover, .close-btn:hover {
          background: #3e3e3e;
          color: #d4d4d4;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          padding: 20px;
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #2d2d2d;
          border-radius: 8px;
        }

        .card-icon {
          font-size: 24px;
        }

        .card-content {
          flex: 1;
        }

        .card-label {
          font-size: 12px;
          color: #888;
          margin-bottom: 4px;
        }

        .card-value {
          font-size: 24px;
          font-weight: bold;
        }

        .health-score {
          padding: 0 20px 20px;
        }

        .health-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .health-header h3 {
          margin: 0;
          color: #888;
          font-size: 14px;
        }

        .health-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
        }

        .health-excellent { background: #28a745; color: white; }
        .health-good { background: #17a2b8; color: white; }
        .health-fair { background: #ffd93e; color: black; }
        .health-poor { background: #f48771; color: black; }
        .health-critical { background: #dc3545; color: white; }

        .health-bar {
          height: 8px;
          background: #2d2d2d;
          border-radius: 4px;
          overflow: hidden;
        }

        .health-fill {
          height: 100%;
          background: linear-gradient(90deg, #28a745, #ffd93e, #dc3545);
          transition: width 0.3s;
        }

        .dashboard-tabs {
          display: flex;
          gap: 2px;
          padding: 0 20px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
        }

        .dashboard-tabs button {
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }

        .dashboard-tabs button:hover {
          color: #d4d4d4;
        }

        .dashboard-tabs button.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }

        .dashboard-content {
          flex: 1;
          overflow: auto;
          padding: 20px;
        }

        .gauges-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }

        .recent-section {
          margin-bottom: 30px;
        }

        .recent-section h3 {
          margin: 0 0 15px 0;
          color: #007bff;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .bottlenecks-section {
          margin-top: 20px;
        }

        .bottlenecks-section h3 {
          margin: 0 0 15px 0;
          color: #007bff;
        }

        .bottleneck-item {
          padding: 10px;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .severity-critical { border-left: 4px solid #dc3545; }
        .severity-high { border-left: 4px solid #f48771; }
        .severity-medium { border-left: 4px solid #ffd93e; }
        .severity-low { border-left: 4px solid #17a2b8; }

        @media (max-width: 768px) {
          .summary-cards,
          .gauges-grid,
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

MonitorDashboard.propTypes = {
  monitor: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MonitorDashboard;
