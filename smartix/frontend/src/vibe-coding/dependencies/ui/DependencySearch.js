/**
 * DependencySearch
 * Recherche de packages à installer
 */

import React, { useState, useCallback } from 'react';
import { VersionBadge } from './VersionBadge';

export const DependencySearch = ({ onSearch, results = [], onInstall, installed = [] }) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [version, setVersion] = useState('latest');

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    setSearching(true);
    try {
      await onSearch(query);
    } finally {
      setSearching(false);
    }
  }, [query, onSearch]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleInstall = (pkg) => {
    onInstall([{
      name: pkg.name,
      version: version === 'latest' ? pkg.version : version
    }]);
    setSelectedPackage(null);
    setVersion('latest');
  };

  const isInstalled = (name) => installed.includes(name);

  return (
    <div className="dependency-search">
      {/* Barre de recherche */}
      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Rechercher des packages (ex: react, lodash...)"
          className="search-input"
          disabled={searching}
        />
        <button 
          onClick={handleSearch}
          disabled={!query.trim() || searching}
          className="search-button"
        >
          {searching ? '🔍...' : 'Rechercher'}
        </button>
      </div>

      {/* Résultats */}
      {results.length > 0 && (
        <div className="search-results">
          <h4>Résultats ({results.length})</h4>
          
          {results.map(result => (
            <div key={result.name} className="result-item">
              <div className="result-header">
                <span className="result-name">{result.name}</span>
                <VersionBadge version={result.version} latest />
                <span className="result-score">★ {Math.round(result.score?.final * 100) / 100 || 0}</span>
              </div>

              <div className="result-description">
                {result.description || 'Aucune description'}
              </div>

              <div className="result-meta">
                {result.keywords && result.keywords.length > 0 && (
                  <div className="result-keywords">
                    {result.keywords.slice(0, 5).map(k => (
                      <span key={k} className="keyword-tag">{k}</span>
                    ))}
                  </div>
                )}
              </div>

              {isInstalled(result.name) ? (
                <div className="installed-badge">✓ Installé</div>
              ) : (
                <button 
                  className="install-btn"
                  onClick={() => setSelectedPackage(result)}
                >
                  Installer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal d'installation */}
      {selectedPackage && (
        <div className="install-modal">
          <div className="modal-content">
            <h3>Installer {selectedPackage.name}</h3>
            
            <div className="modal-body">
              <p className="package-description">
                {selectedPackage.description}
              </p>

              <div className="version-selector">
                <label>Version:</label>
                <select 
                  value={version} 
                  onChange={(e) => setVersion(e.target.value)}
                >
                  <option value="latest">latest ({selectedPackage.version})</option>
                  <option value="next">next</option>
                </select>
              </div>

              <div className="package-details">
                {selectedPackage.keywords && (
                  <div className="detail-item">
                    <span className="detail-label">Mots-clés:</span>
                    <span>{selectedPackage.keywords.join(', ')}</span>
                  </div>
                )}
                {selectedPackage.date && (
                  <div className="detail-item">
                    <span className="detail-label">Dernière mise à jour:</span>
                    <span>{new Date(selectedPackage.date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setSelectedPackage(null)}
              >
                Annuler
              </button>
              <button 
                className="confirm-btn"
                onClick={() => handleInstall(selectedPackage)}
              >
                Installer
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dependency-search {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .search-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .search-input {
          flex: 1;
          padding: 10px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .search-input:disabled {
          opacity: 0.5;
        }

        .search-button {
          padding: 0 20px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 14px;
        }

        .search-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .search-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .search-results {
          flex: 1;
          overflow: auto;
        }

        .search-results h4 {
          margin: 0 0 12px 0;
          color: #007bff;
        }

        .result-item {
          background: #2d2d2d;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 8px;
          position: relative;
        }

        .result-item:hover {
          background: #3e3e3e;
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .result-name {
          font-weight: bold;
          color: #9cdcfe;
          font-size: 16px;
        }

        .result-score {
          color: #ffd93e;
          font-size: 12px;
        }

        .result-description {
          color: #d4d4d4;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .result-keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .keyword-tag {
          padding: 2px 6px;
          background: #1e1e1e;
          border-radius: 3px;
          font-size: 11px;
          color: #888;
        }

        .install-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          padding: 6px 12px;
          background: #28a745;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 12px;
        }

        .install-btn:hover {
          background: #218838;
        }

        .installed-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          padding: 6px 12px;
          background: #1e1e1e;
          border: 1px solid #28a745;
          border-radius: 4px;
          color: #28a745;
          font-size: 12px;
        }

        .install-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 11000;
        }

        .modal-content {
          background: #2d2d2d;
          border-radius: 8px;
          width: 400px;
          max-width: 90%;
          padding: 20px;
        }

        .modal-content h3 {
          margin: 0 0 16px 0;
          color: #007bff;
        }

        .package-description {
          color: #d4d4d4;
          margin-bottom: 16px;
        }

        .version-selector {
          margin-bottom: 16px;
        }

        .version-selector label {
          display: block;
          margin-bottom: 4px;
          color: #888;
        }

        .version-selector select {
          width: 100%;
          padding: 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
        }

        .package-details {
          background: #1e1e1e;
          padding: 12px;
          border-radius: 4px;
        }

        .detail-item {
          margin-bottom: 4px;
          font-size: 12px;
        }

        .detail-label {
          color: #888;
          margin-right: 8px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 20px;
        }

        .cancel-btn {
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #888;
          cursor: pointer;
        }

        .cancel-btn:hover {
          background: #3e3e3e;
        }

        .confirm-btn {
          padding: 8px 16px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        }

        .confirm-btn:hover {
          background: #0056b3;
        }
      `}</style>
    </div>
  );
};

export default DependencySearch;
