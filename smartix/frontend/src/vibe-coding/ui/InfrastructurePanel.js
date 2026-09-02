/**
 * InfrastructurePanel — Onglet "Infra" du vibe-coding IDE
 *
 * Regroupe les 5 fonctionnalités Sprint 7 :
 *  • Base de données PostgreSQL  (DBPanel)
 *  • Tâches Cron                 (CronJobsPanel)
 *  • Stockage d'assets S3        (AssetManager)
 *  • Variables d'env serveur     (ServerEnvPanel)
 *  • Logs d'accès HTTP           (AccessLogsPanel)
 */

import React, { useState, Suspense, lazy } from 'react';

const DBPanel        = lazy(() => import('../database/DBPanel'));
const CronJobsPanel  = lazy(() => import('../cron/CronJobsPanel'));
const AssetManager   = lazy(() => import('../storage/AssetManager'));
const ServerEnvPanel = lazy(() => import('./ServerEnvPanel'));
const AccessLogsPanel= lazy(() => import('./AccessLogsPanel'));

const TABS = [
  { id: 'db',      label: '🗄 Base de données', component: DBPanel },
  { id: 'cron',    label: '⏰ Cron Jobs',        component: CronJobsPanel },
  { id: 'storage', label: '📦 Stockage',         component: AssetManager },
  { id: 'env',     label: '🔐 Variables Env',    component: ServerEnvPanel },
  { id: 'logs',    label: '📋 Logs d\'accès',    component: AccessLogsPanel },
];

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    borderBottom: '1px solid #3e3e3e',
    background: '#252526',
    flexShrink: 0,
    overflowX: 'auto',
  },
  tab: (active) => ({
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    border: 'none',
    borderBottom: active ? '2px solid #4fc3f7' : '2px solid transparent',
    background: active ? '#1e1e1e' : 'transparent',
    color: active ? '#4fc3f7' : '#aaa',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    flexShrink: 0,
  }),
  body: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
  },
  loader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    fontSize: 13,
  },
};

const Loader = () => (
  <div style={styles.loader}>
    <span style={{ animation: 'spin 1s linear infinite', marginRight: 8, display: 'inline-block' }}>⟳</span>
    Chargement…
  </div>
);

const InfrastructurePanel = ({ projectId, activeTab: activeTabProp, onTabChange }) => {
  const [internalTab, setInternalTab] = useState('db');
  const activeTab = activeTabProp !== undefined ? activeTabProp : internalTab;

  const handleTabChange = (id) => {
    if (activeTabProp === undefined) setInternalTab(id);
    if (onTabChange) onTabChange(id);
  };

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || DBPanel;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={styles.tab(activeTab === tab.id)}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.body}>
        <Suspense fallback={<Loader />}>
          <ActiveComponent projectId={projectId} />
        </Suspense>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default InfrastructurePanel;
