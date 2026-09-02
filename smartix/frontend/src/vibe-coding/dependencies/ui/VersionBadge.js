/**
 * VersionBadge
 * Badge affichant une version avec indicateur de mise à jour
 */

import React from 'react';

export const VersionBadge = ({ version, outdated, latest, className = '' }) => {
  const getVersionColor = () => {
    if (outdated) return '#ffd93e';
    return '#b5cea8';
  };

  const getVersionTitle = () => {
    if (outdated && latest) {
      return `Mise à jour disponible: ${latest}`;
    }
    return `Version ${version}`;
  };

  return (
    <span 
      className={`version-badge ${className} ${outdated ? 'outdated' : ''}`}
      style={{
        backgroundColor: getVersionColor(),
        color: outdated ? '#000' : '#1e1e1e'
      }}
      title={getVersionTitle()}
    >
      {outdated && '⬆️ '}
      {version}
      {latest && outdated && (
        <span className="latest-version"> ({latest})</span>
      )}

      <style jsx>{`
        .version-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          line-height: 1.5;
          transition: all 0.2s;
        }

        .version-badge.outdated {
          cursor: help;
        }

        .latest-version {
          opacity: 0.7;
          margin-left: 2px;
        }
      `}</style>
    </span>
  );
};

export default VersionBadge;
