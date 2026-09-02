/**
 * DependencyList
 * Liste des dépendances installées
 */

import React, { useState } from 'react';
import { VersionBadge } from './VersionBadge';

export const DependencyList = ({ 
  dependencies = [], 
  onUninstall, 
  onUpdate,
  loading = false 
}) => {
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  const types = [
    { id: 'all', label: 'Tous' },
    { id: 'production', label: 'Production' },
    { id: 'development', label: 'Développement' }
  ];

  const filteredDeps = dependencies.filter(dep => {
    const matchesFilter = dep.name.toLowerCase().includes(filter.toLowerCase());
    const matchesType = selectedType === 'all' || dep.type === selectedType;
    return matchesFilter && matchesType;
  });

  const groupedDeps = filteredDeps.reduce((acc, dep) => {
    const group = dep.type || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(dep);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="dependency-list loading">
        <div className="loader">Chargement...</div>
        
        <style jsx>{`
          .dependency-list.loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            color: #888;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dependency-list">
      {/* Filtres */}
      <div className="list-filters">
        <input
          type="text"
          placeholder="Filtrer les dépendances..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-input"
        />
        
        <div className="type-filters">
          {types.map(type => (
            <button
              key={type.id}
              className={`type-button ${selectedType === type.id ? 'active' : ''}`}
              onClick={() => setSelectedType(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistiques */}
      <div className="list-stats">
        <span>Total: {dependencies.length}</span>
        <span>Production: {dependencies.filter(d => d.type === 'production').length}</span>
        <span>Développement: {dependencies.filter(d => d.type === 'development').length}</span>
      </div>

      {/* Liste */}
      <div className="dependencies-container">
        {Object.entries(groupedDeps).map(([type, deps]) => (
          <div key={type} className="dependency-group">
            <h4 className="group-title">
              {type === 'production' && '📦 Production'}
              {type === 'development' && '🛠️ Développement'}
              {type === 'peer' && '🤝 Peer'}
              {type === 'optional' && '⚡ Optionnelle'}
              {type === 'other' && '📁 Autres'}
              <span className="group-count">({deps.length})</span>
            </h4>

            {deps.map(dep => (
              <div key={dep.name} className="dependency-item">
                <div className="dep-info">
                  <span className="dep-name">{dep.name}</span>
                  <VersionBadge 
                    version={dep.version}
                    outdated={dep.outdated}
                    latest={dep.latest}
                  />
                </div>

                <div className="dep-description">
                  {dep.description || 'Aucune description'}
                </div>

                <div className="dep-actions">
                  {dep.outdated && (
                    <button 
                      className="update-btn"
                      onClick={() => onUpdate(dep.name, dep.latest)}
                      title="Mettre à jour"
                    >
                      ⬆️
                    </button>
                  )}
                  <button 
                    className="uninstall-btn"
                    onClick={() => onUninstall(dep.name)}
                    title="Désinstaller"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {filteredDeps.length === 0 && (
          <div className="no-results">
            <div className="empty-icon">📭</div>
            <div>Aucune dépendance trouvée</div>
          </div>
        )}
      </div>

      <style jsx>{`
        .dependency-list {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .list-filters {
          margin-bottom: 16px;
        }

        .filter-input {
          width: 100%;
          padding: 8px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .filter-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .type-filters {
          display: flex;
          gap: 4px;
        }

        .type-button {
          padding: 4px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
          font-size: 12px;
        }

        .type-button:hover {
          background: #3e3e3e;
          color: #d4d4d4;
        }

        .type-button.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .list-stats {
          display: flex;
          gap: 16px;
          padding: 8px;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 16px;
          font-size: 12px;
          color: #888;
        }

        .dependencies-container {
          flex: 1;
          overflow: auto;
        }

        .dependency-group {
          margin-bottom: 20px;
        }

        .group-title {
          margin: 0 0 8px 0;
          color: #007bff;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .group-count {
          color: #888;
          font-size: 12px;
        }

        .dependency-item {
          background: #2d2d2d;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 4px;
          position: relative;
        }

        .dependency-item:hover {
          background: #3e3e3e;
        }

        .dep-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;
        }

        .dep-name {
          font-weight: bold;
          color: #9cdcfe;
        }

        .dep-description {
          font-size: 12px;
          color: #888;
          margin-right: 80px;
        }

        .dep-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .dependency-item:hover .dep-actions {
          opacity: 1;
        }

        .update-btn, .uninstall-btn {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
        }

        .update-btn:hover {
          color: #ffd93e;
        }

        .uninstall-btn:hover {
          color: #f48771;
        }

        .no-results {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #888;
          gap: 16px;
        }

        .empty-icon {
          font-size: 48px;
        }
      `}</style>
    </div>
  );
};

export default DependencyList;
