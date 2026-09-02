/**
 * DependencyPanel
 * Panneau principal de gestion des dépendances
 */

import React, { useState, useEffect } from 'react';
import { DependencyList } from './DependencyList';
import { DependencySearch } from './DependencySearch';
import { VersionBadge } from './VersionBadge';
import { ConflictWarning } from './ConflictWarning';
import PropTypes from 'prop-types';

export const DependencyPanel = ({ resolver, onClose }) => {
  const [activeTab, setActiveTab] = useState('installed');
  const [dependencies, setDependencies] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [installProgress, setInstallProgress] = useState(null);

  useEffect(() => {
    if (resolver) {
      loadDependencies();
    }
  }, [resolver]);

  const loadDependencies = async () => {
    setLoading(true);
    try {
      const installed = resolver.getInstalledDependencies?.() || [];
      setDependencies(installed);
      
      const conflicts = resolver.conflictDetector?.getConflicts?.() || [];
      setConflicts(conflicts);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (packages) => {
    setInstallProgress({ current: 0, total: packages.length });
    
    try {
      const result = await resolver.installDependencies(packages, {
        onProgress: (progress) => {
          setInstallProgress(progress);
        }
      });
      
      if (result.success) {
        await loadDependencies();
      }
    } finally {
      setInstallProgress(null);
    }
  };

  const handleUninstall = async (name) => {
    await resolver.uninstall([name]);
    await loadDependencies();
  };

  const handleUpdate = async (name, version) => {
    await resolver.updateDependency(name, version);
    await loadDependencies();
  };

  const handleSearch = async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    const results = await resolver.searchDependencies(query);
    setSearchResults(results);
  };

  const tabs = [
    { id: 'installed', label: '📦 Installées', icon: '📦' },
    { id: 'search', label: '🔍 Rechercher', icon: '🔍' },
    { id: 'updates', label: '⬆️ Mises à jour', icon: '⬆️' },
    { id: 'conflicts', label: `⚠️ Conflits (${conflicts.length})`, icon: '⚠️' }
  ];

  return (
    <div className="dependency-panel">
      {/* En-tête */}
      <div className="panel-header">
        <h2>Gestionnaire de dépendances</h2>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>

      {/* Onglets */}
      <div className="panel-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="panel-content">
        {activeTab === 'installed' && (
          <DependencyList
            dependencies={dependencies}
            onUninstall={handleUninstall}
            onUpdate={handleUpdate}
            loading={loading}
          />
        )}

        {activeTab === 'search' && (
          <DependencySearch
            onSearch={handleSearch}
            results={searchResults}
            onInstall={handleInstall}
            installed={dependencies.map(d => d.name)}
          />
        )}

        {activeTab === 'updates' && (
          <div className="updates-tab">
            <h3>Mises à jour disponibles</h3>
            {dependencies
              .filter(d => d.outdated)
              .map(dep => (
                <div key={dep.name} className="update-item">
                  <span className="dep-name">{dep.name}</span>
                  <VersionBadge version={dep.version} />
                  <span className="update-arrow">→</span>
                  <VersionBadge version={dep.latest} latest />
                  <button onClick={() => handleUpdate(dep.name, dep.latest)}>
                    Mettre à jour
                  </button>
                </div>
              ))}
          </div>
        )}

        {activeTab === 'conflicts' && (
          <ConflictWarning conflicts={conflicts} />
        )}
      </div>

      {/* Progression installation */}
      {installProgress && (
        <div className="install-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(installProgress.current / installProgress.total) * 100}%` }}
            />
          </div>
          <div className="progress-text">
            Installation {installProgress.current}/{installProgress.total}
          </div>
        </div>
      )}

      <style jsx>{`
        .dependency-panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          max-width: 90vw;
          max-height: 80vh;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          z-index: 10000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
          border-radius: 8px 8px 0 0;
        }

        .panel-header h2 {
          margin: 0;
          color: #007bff;
          font-size: 18px;
        }

        .close-button {
          background: transparent;
          border: none;
          color: #888;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
        }

        .close-button:hover {
          color: #fff;
        }

        .panel-tabs {
          display: flex;
          gap: 2px;
          padding: 0 16px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
        }

        .tab {
          padding: 10px 16px;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          color: #d4d4d4;
        }

        .tab.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }

        .panel-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }

        .updates-tab {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .updates-tab h3 {
          margin: 0 0 8px 0;
          color: #007bff;
        }

        .update-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #2d2d2d;
          border-radius: 4px;
        }

        .dep-name {
          font-weight: bold;
          min-width: 120px;
        }

        .update-arrow {
          color: #888;
        }

        .update-item button {
          margin-left: auto;
          padding: 4px 12px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        }

        .update-item button:hover {
          background: #0056b3;
        }

        .install-progress {
          padding: 12px 16px;
          background: #2d2d2d;
          border-top: 1px solid #3e3e3e;
        }

        .progress-bar {
          height: 4px;
          background: #1e1e1e;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s;
        }

        .progress-text {
          text-align: center;
          font-size: 12px;
          color: #888;
        }
      `}</style>
    </div>
  );
};

DependencyPanel.propTypes = {
  resolver: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default DependencyPanel;
