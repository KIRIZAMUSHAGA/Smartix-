/**
 * FileTabs - Onglets de fichiers ouverts style IDE
 *
 * Fonctionnalités :
 * - Affichage d'un onglet par fichier ouvert
 * - Clic → switch vers ce fichier
 * - Bouton × pour fermer un onglet
 * - Point jaune pour fichiers non sauvegardés
 * - Réordonnable par glisser-déposer
 */

import React, { useState, useRef, useCallback } from 'react';

// Icônes par extension
const EXT_ICONS = {
  '.js': '📄', '.jsx': '⚛️', '.ts': '📘', '.tsx': '⚛️',
  '.json': '📋', '.html': '🌐', '.css': '🎨', '.scss': '🎨',
  '.md': '📝', '.py': '🐍', '.env': '⚙️', '.txt': '📄',
};

const getIcon = (path) => {
  if (!path) return '📄';
  const dot = path.lastIndexOf('.');
  const ext = dot !== -1 ? path.slice(dot) : '';
  const name = path.split('/').pop();
  return EXT_ICONS[name] || EXT_ICONS[ext] || '📄';
};

const getBaseName = (path) => {
  if (!path) return '';
  return path.split('/').pop();
};

const FileTabs = ({
  openTabs = [],
  activeTab = null,
  dirtyTabs = new Set(),
  onTabClick,
  onTabClose,
  onTabReorder,
}) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const tabsRef = useRef([]);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== draggedIndex) setDragOverIndex(index);
  }, [draggedIndex]);

  const handleDrop = useCallback((e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const newTabs = [...openTabs];
    const [moved] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, moved);
    onTabReorder?.(newTabs);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, openTabs, onTabReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  if (openTabs.length === 0) return null;

  return (
    <div style={styles.tabBar} role="tablist" aria-label="Fichiers ouverts">
      {openTabs.map((filePath, index) => {
        const isActive = filePath === activeTab;
        const isDirty = dirtyTabs.has(filePath);
        const isDraggedOver = dragOverIndex === index;
        const isBeingDragged = draggedIndex === index;

        return (
          <div
            key={filePath}
            ref={el => tabsRef.current[index] = el}
            role="tab"
            aria-selected={isActive}
            draggable
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={e => handleDragOver(e, index)}
            onDrop={e => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabClick?.(filePath)}
            title={filePath}
            style={{
              ...styles.tab,
              ...(isActive ? styles.tabActive : {}),
              ...(isDraggedOver ? styles.tabDragOver : {}),
              ...(isBeingDragged ? styles.tabDragging : {}),
            }}
          >
            <span style={styles.tabIcon}>{getIcon(filePath)}</span>
            <span style={styles.tabName}>{getBaseName(filePath)}</span>
            {isDirty && (
              <span
                style={styles.dirtyDot}
                title="Modifications non sauvegardées"
                aria-label="Non sauvegardé"
              />
            )}
            <button
              style={styles.closeBtn}
              onClick={e => { e.stopPropagation(); onTabClose?.(filePath); }}
              title="Fermer l'onglet"
              aria-label={`Fermer ${getBaseName(filePath)}`}
            >
              ×
            </button>
          </div>
        );
      })}

      <style>{`
        .file-tab:hover .tab-close-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

const styles = {
  tabBar: {
    display: 'flex',
    flexDirection: 'row',
    overflowX: 'auto',
    overflowY: 'hidden',
    background: '#252526',
    borderBottom: '1px solid #1e1e1e',
    minHeight: 35,
    flexShrink: 0,
    scrollbarWidth: 'none',
    userSelect: 'none',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 8px 0 10px',
    minWidth: 100,
    maxWidth: 200,
    height: 35,
    cursor: 'pointer',
    background: '#2d2d2d',
    borderRight: '1px solid #1e1e1e',
    color: '#969696',
    fontSize: 12,
    position: 'relative',
    flexShrink: 0,
    transition: 'background 0.1s, color 0.1s',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  tabActive: {
    background: '#1e1e1e',
    color: '#ffffff',
    borderTop: '1px solid #007acc',
  },
  tabDragOver: {
    borderLeft: '2px solid #007acc',
    background: '#3c3c3c',
  },
  tabDragging: {
    opacity: 0.5,
  },
  tabIcon: {
    fontSize: 12,
    flexShrink: 0,
  },
  tabName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#e8c247',
    flexShrink: 0,
    display: 'inline-block',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#969696',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    padding: '0 2px',
    borderRadius: 3,
    opacity: 0.6,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s, background 0.15s',
  },
};

export default FileTabs;
