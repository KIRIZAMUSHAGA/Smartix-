/**
 * TerminalTabs — Gestion de plusieurs terminaux PTY en onglets
 *
 * Fonctionnalités :
 * - Barre d'onglets au-dessus du terminal
 * - Bouton "+" pour créer un nouveau terminal
 * - Chaque terminal a son propre PTY (session_id unique)
 * - Renommer les onglets (double-click)
 * - Fermer un onglet (bouton ×)
 * - Raccourci Ctrl+` pour cycler entre les terminaux
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import RealTerminalComponent from './RealTerminal';

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  wrapper: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#11111b', borderTop: '1px solid #313244',
  },
  tabBar: {
    display: 'flex', alignItems: 'center', gap: 1,
    background: '#181825', borderBottom: '1px solid #313244',
    padding: '0 6px', height: 34, flexShrink: 0, overflowX: 'auto',
  },
  tab: (active) => ({
    display:    'flex', alignItems: 'center', gap: 6,
    padding:    '0 10px', height: 28, borderRadius: '6px 6px 0 0',
    cursor:     'pointer', fontSize: 12, fontFamily: 'monospace',
    userSelect: 'none', flexShrink: 0, transition: 'background 0.15s',
    background: active ? '#1e1e2e' : 'transparent',
    color:      active ? '#cdd6f4' : '#6c7086',
    borderBottom: active ? '2px solid #89b4fa' : '2px solid transparent',
  }),
  tabIcon: (status) => ({
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    background: status === 'connected' ? '#a6e3a1'
      : status === 'error' ? '#f38ba8' : '#f9e2af',
  }),
  tabName: {
    maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  closeBtn: {
    width: 16, height: 16, borderRadius: 3, border: 'none', background: 'transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#585b70', fontSize: 12, padding: 0,
    transition: 'all 0.15s',
  },
  addBtn: {
    width: 26, height: 26, borderRadius: 6, border: '1px solid #45475a',
    background: 'transparent', cursor: 'pointer', color: '#6c7086', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginLeft: 4, transition: 'all 0.15s', flexShrink: 0,
  },
  termArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  nameInput: {
    background: '#313244', border: '1px solid #89b4fa', borderRadius: 3,
    color: '#cdd6f4', fontSize: 12, fontFamily: 'monospace',
    padding: '1px 4px', width: 80, outline: 'none',
  },
};

// ─── Générateur d'ID ─────────────────────────────────────────────────────────

let _termCount = 0;
const genId = (projectId) => `${projectId}-term-${++_termCount}-${Date.now()}`;

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * @param {string}  projectId   - ID du projet (préfixe des sessions PTY)
 * @param {string}  projectDir  - Répertoire de travail initial
 * @param {string}  authToken   - JWT (non utilisé ici, transmis pour cohérence)
 */
const TerminalTabs = ({ projectId = 'default', projectDir = '/tmp', authToken }) => {
  const [tabs, setTabs] = useState(() => [{
    id:        genId(projectId),
    name:      'bash',
    status:    'connecting',
    editing:   false,
    editName:  '',
  }]);
  const [activeId, setActiveId]   = useState(null);
  const [hoveredClose, setHoveredClose] = useState(null);
  const inputRef = useRef(null);

  // Initialiser l'onglet actif
  useEffect(() => {
    if (!activeId && tabs.length > 0) {
      setActiveId(tabs[0].id);
    }
  }, [tabs, activeId]);

  // Raccourci Ctrl+` pour cycler
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setActiveId((cur) => {
          const idx  = tabs.findIndex((t) => t.id === cur);
          const next = (idx + 1) % tabs.length;
          return tabs[next]?.id || cur;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs]);

  // Focus sur l'input de renommage
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  });

  // ── Gestion des onglets ───────────────────────────────────────────────

  const addTab = useCallback(() => {
    const newId = genId(projectId);
    const newTab = {
      id:       newId,
      name:     `bash ${_termCount}`,
      status:   'connecting',
      editing:  false,
      editName: '',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveId(newId);
  }, [projectId]);

  const closeTab = useCallback((id, e) => {
    e?.stopPropagation();
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id && next.length > 0) {
        setActiveId(next[next.length - 1].id);
      }
      return next;
    });
  }, [activeId]);

  const startRename = useCallback((id, e) => {
    e.stopPropagation();
    setTabs((prev) => prev.map((t) =>
      t.id === id ? { ...t, editing: true, editName: t.name } : t
    ));
  }, []);

  const commitRename = useCallback((id) => {
    setTabs((prev) => prev.map((t) =>
      t.id === id
        ? { ...t, editing: false, name: t.editName.trim() || t.name }
        : t
    ));
  }, []);

  const updateStatus = useCallback((id, status) => {
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
  }, []);

  const updateEditName = useCallback((id, editName) => {
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, editName } : t));
  }, []);

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div style={st.wrapper}>
      {/* Barre d'onglets */}
      <div style={st.tabBar}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={st.tab(tab.id === activeId)}
            onClick={() => setActiveId(tab.id)}
            onDoubleClick={(e) => startRename(tab.id, e)}
            title="Double-clic pour renommer"
          >
            <div style={st.tabIcon(tab.status)} />

            {/* Nom ou input de renommage */}
            {tab.editing ? (
              <input
                ref={inputRef}
                style={st.nameInput}
                value={tab.editName}
                onChange={(e) => updateEditName(tab.id, e.target.value)}
                onBlur={() => commitRename(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(tab.id);
                  if (e.key === 'Escape') setTabs((prev) =>
                    prev.map((t) => t.id === tab.id ? { ...t, editing: false } : t)
                  );
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span style={st.tabName}>{tab.name}</span>
            )}

            {/* Bouton fermer */}
            {tabs.length > 1 && (
              <button
                style={{
                  ...st.closeBtn,
                  color: hoveredClose === tab.id ? '#f38ba8' : '#585b70',
                }}
                onMouseEnter={() => setHoveredClose(tab.id)}
                onMouseLeave={() => setHoveredClose(null)}
                onClick={(e) => closeTab(tab.id, e)}
                title="Fermer ce terminal"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Bouton + */}
        <button
          style={st.addBtn}
          onClick={addTab}
          title="Nouveau terminal (Ctrl+`)"
        >
          +
        </button>

        {/* Légende à droite */}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#45475a', paddingRight: 4 }}>
          {tabs.length} terminal{tabs.length > 1 ? 'ux' : ''}
        </div>
      </div>

      {/* Zone terminal */}
      <div style={st.termArea}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              position: 'absolute', inset: 0,
              display: tab.id === activeId ? 'block' : 'none',
            }}
          >
            <RealTerminalComponent
              sessionId={tab.id}
              projectDir={projectDir}
              autoFocus={tab.id === activeId}
              onStatusChange={(s) => updateStatus(tab.id, s)}
            />
          </div>
        ))}

        {/* État vide */}
        {tabs.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <button
              style={{
                background: '#313244', border: '1px solid #45475a', borderRadius: 8,
                color: '#cdd6f4', padding: '12px 24px', cursor: 'pointer', fontSize: 14,
              }}
              onClick={addTab}
            >
              + Nouveau terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalTabs;
