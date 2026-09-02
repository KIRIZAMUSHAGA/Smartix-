/**
 * EnvironmentPanel
 * Panneau de gestion des environnements
 */

import React, { useState, useEffect } from 'react';

export const EnvironmentPanel = ({ manager }) => {
  const [environments, setEnvironments] = useState([]);
  const [currentEnv, setCurrentEnv] = useState(null);
  const [variables, setVariables] = useState([]);
  const [features, setFeatures] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newVariable, setNewVariable] = useState({ key: '', value: '' });
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!manager) return;

    const updateData = () => {
      setEnvironments(manager.listEnvironments());
      setCurrentEnv(manager.getCurrentEnvironment());
      
      if (manager.currentEnv) {
        setVariables(Array.from(manager.variableManager?.variables.entries() || []));
        setFeatures(Array.from(manager.featureFlags?.flags.entries() || []));
      }
    };

    updateData();
    
    manager.addListener(updateData);
    return () => manager.removeListener(updateData);
  }, [manager]);

  if (!manager) {
    return (
      <div className="environment-panel empty">
        <div className="empty-icon">🌍</div>
        <div>Gestionnaire d'environnement non disponible</div>

        <style jsx>{`
          .environment-panel.empty {
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

  const handleSwitchEnvironment = async (envId) => {
    await manager.switchToEnvironment(envId);
  };

  const handleAddVariable = () => {
    if (newVariable.key && newVariable.value) {
      manager.setVariable(newVariable.key, newVariable.value);
      setNewVariable({ key: '', value: '' });
    }
  };

  const handleToggleFeature = (feature) => {
    if (manager.isFeatureEnabled(feature)) {
      manager.disableFeature(feature);
    } else {
      manager.enableFeature(feature);
    }
  };

  const handleDeleteVariable = (key) => {
    manager.variableManager?.delete(key);
  };

  const handleEditVariable = (key, value) => {
    setEditing({ key, value });
  };

  const handleSaveEdit = () => {
    if (editing) {
      manager.setVariable(editing.key, editing.value);
      setEditing(null);
    }
  };

  const filteredVariables = variables.filter(([key]) =>
    key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="environment-panel">
      {/* Sélecteur d'environnement */}
      <div className="env-selector">
        <h4>Environnement actuel</h4>
        <div className="env-buttons">
          {environments.map(env => (
            <button
              key={env.id}
              className={`env-button ${env.current ? 'active' : ''}`}
              onClick={() => handleSwitchEnvironment(env.id)}
              style={{ borderColor: env.color }}
            >
              <span className="env-icon">{env.icon}</span>
              <span className="env-name">{env.name}</span>
              {env.current && <span className="env-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Variables d'environnement */}
      <div className="env-variables">
        <div className="section-header">
          <h4>Variables d'environnement</h4>
          <div className="header-actions">
            <input
              type="text"
              placeholder="Filtrer..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-input"
            />
          </div>
        </div>

        <div className="variables-list">
          {filteredVariables.map(([key, value]) => (
            <div key={key} className="variable-item">
              {editing?.key === key ? (
                <div className="variable-edit">
                  <input
                    type="text"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                    autoFocus
                  />
                  <button onClick={handleSaveEdit} className="save-btn">✓</button>
                  <button onClick={() => setEditing(null)} className="cancel-btn">✕</button>
                </div>
              ) : (
                <>
                  <span className="variable-key">{key}</span>
                  <span className="variable-value">{String(value)}</span>
                  <div className="variable-actions">
                    <button onClick={() => handleEditVariable(key, value)}>✏️</button>
                    <button onClick={() => handleDeleteVariable(key)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Ajout nouvelle variable */}
          <div className="variable-add">
            <input
              type="text"
              placeholder="Clé"
              value={newVariable.key}
              onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
            />
            <input
              type="text"
              placeholder="Valeur"
              value={newVariable.value}
              onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleAddVariable()}
            />
            <button onClick={handleAddVariable}>Ajouter</button>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="env-features">
        <h4>Feature Flags</h4>
        <div className="features-grid">
          {features.map(([name, flag]) => (
            <div key={name} className="feature-item">
              <label className="feature-label">
                <input
                  type="checkbox"
                  checked={flag.enabled}
                  onChange={() => handleToggleFeature(name)}
                />
                <span className="feature-name">{name}</span>
                {flag.group && (
                  <span className="feature-group">{flag.group}</span>
                )}
              </label>
              {flag.description && (
                <span className="feature-description">{flag.description}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Informations */}
      <div className="env-info">
        <h4>Informations</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Environnements:</span>
            <span>{environments.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Variables:</span>
            <span>{variables.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Features:</span>
            <span>{features.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Dernier usage:</span>
            <span>
              {currentEnv?.lastUsed 
                ? new Date(currentEnv.lastUsed).toLocaleString() 
                : 'Jamais'}
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .environment-panel {
          height: 100%;
          overflow: auto;
          padding: 8px;
        }

        .env-selector {
          margin-bottom: 24px;
        }

        .env-selector h4 {
          margin: 0 0 12px 0;
          color: #007bff;
        }

        .env-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .env-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #2d2d2d;
          border: 2px solid transparent;
          border-radius: 20px;
          color: #d4d4d4;
          cursor: pointer;
          transition: all 0.2s;
        }

        .env-button:hover {
          background: #3e3e3e;
          transform: translateY(-2px);
        }

        .env-button.active {
          background: #1e3a5f;
        }

        .env-check {
          margin-left: 4px;
          color: #28a745;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .section-header h4 {
          margin: 0;
          color: #007bff;
        }

        .filter-input {
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
        }

        .env-variables {
          margin-bottom: 24px;
        }

        .variables-list {
          background: #2d2d2d;
          border-radius: 6px;
          overflow: hidden;
        }

        .variable-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #3e3e3e;
        }

        .variable-item:last-child {
          border-bottom: none;
        }

        .variable-key {
          font-weight: bold;
          color: #9cdcfe;
          min-width: 150px;
        }

        .variable-value {
          flex: 1;
          color: #b5cea8;
          font-family: monospace;
        }

        .variable-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .variable-item:hover .variable-actions {
          opacity: 1;
        }

        .variable-actions button {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 2px 4px;
        }

        .variable-actions button:hover {
          color: #fff;
        }

        .variable-edit {
          display: flex;
          gap: 4px;
          width: 100%;
        }

        .variable-edit input {
          flex: 1;
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #007bff;
          border-radius: 4px;
          color: #fff;
        }

        .variable-add {
          display: flex;
          gap: 4px;
          padding: 8px 12px;
          background: #1e1e1e;
        }

        .variable-add input {
          flex: 1;
          padding: 4px 8px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
        }

        .variable-add button {
          padding: 4px 12px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
        }

        .variable-add button:hover {
          background: #0056b3;
        }

        .save-btn, .cancel-btn {
          padding: 2px 6px;
          border-radius: 3px;
        }

        .save-btn {
          background: #28a745;
        }

        .cancel-btn {
          background: #dc3545;
        }

        .env-features {
          margin-bottom: 24px;
        }

        .env-features h4 {
          margin: 0 0 12px 0;
          color: #007bff;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }

        .feature-item {
          padding: 8px;
          background: #2d2d2d;
          border-radius: 4px;
        }

        .feature-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .feature-label input[type="checkbox"] {
          cursor: pointer;
        }

        .feature-name {
          font-weight: bold;
        }

        .feature-group {
          font-size: 10px;
          padding: 2px 4px;
          background: #1e1e1e;
          border-radius: 3px;
          color: #888;
        }

        .feature-description {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: #888;
        }

        .env-info {
          padding: 12px;
          background: #2d2d2d;
          border-radius: 6px;
        }

        .env-info h4 {
          margin: 0 0 12px 0;
          color: #007bff;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 4px;
          background: #1e1e1e;
          border-radius: 4px;
        }

        .info-label {
          color: #888;
        }
      `}</style>
    </div>
  );
};

export default EnvironmentPanel;
