/**
 * IDE Layout - Layout principal avec split views
 * Reproduit l'interface Replit avec éditeur, preview et console
 *
 * Sprint 1 : FileTabs, CommandPalette, raccourcis clavier, ThemeToggle,
 *            toggle sidebar/terminal, ThemeProvider
 */

import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import CodeEditor from '../editor/codeEditor';
import ConsoleTerminal from '../runtime/terminal';
import PreviewFrame from '../runtime/previewFrame';
import BottomDock from './bottomDock';
import Sidebar from './sidebar';
import QRCodeModal from './QRCodeModal';

import FileTabs from './FileTabs';
import CommandPalette from './CommandPalette';
import ThemeToggle from './ThemeToggle';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import DAPDebugPanel from '../debugger/DebugPanel';
import ErudaDevTools from '../debugger/ErudaDevTools';
import WatchMode from '../debugger/WatchMode';
import ResponsivePreview from './ResponsivePreview';

const InfrastructurePanel = lazy(() => import('./InfrastructurePanel'));

// =============================
// COMPOSANT INTERNE (consomme le thème)
// =============================

const IDELayoutInner = ({
  projectId,
  userId,
  initialTool = 'editor',
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  // Onglets ouverts
  const [openTabs, setOpenTabs] = useState(['/src/App.js']);
  const [activeTab, setActiveTab] = useState('/src/App.js');
  const [dirtyTabs, setDirtyTabs] = useState(new Set());

  // Visibilité panneaux
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [devToolsEnabled, setDevToolsEnabled] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [responsivePreview, setResponsivePreview] = useState(false);
  const [showInfraPanel, setShowInfraPanel] = useState(false);
  const [infraActiveTab, setInfraActiveTab] = useState('db');

  // Badge "nouvelles requêtes HTTP" sur le bouton Infra
  const lastSeenStorageKey = `vibe-infra-logs-last-seen-${projectId || 'default'}`;
  const [lastSeenTotal, setLastSeenTotal] = useState(() => {
    try {
      const v = window.localStorage.getItem(lastSeenStorageKey);
      return v ? parseInt(v, 10) : 0;
    } catch { return 0; }
  });
  const [currentTotal, setCurrentTotal] = useState(0);
  const pollingRef = useRef(null);

  // Polling /stats toutes les 5s
  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/logs/stats`, {
          credentials: 'include',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (typeof data.total === 'number') {
          setCurrentTotal(data.total);
        }
      } catch {
        /* silencieux : badge non critique */
      }
    };

    fetchStats();
    pollingRef.current = setInterval(fetchStats, 5000);
    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [projectId]);

  // Réinitialiser le compteur quand l'onglet Logs est ouvert dans le panneau Infra
  useEffect(() => {
    if (showInfraPanel && infraActiveTab === 'logs') {
      setLastSeenTotal(currentTotal);
      try {
        window.localStorage.setItem(lastSeenStorageKey, String(currentTotal));
      } catch { /* ignore */ }
    }
  }, [showInfraPanel, infraActiveTab, currentTotal, lastSeenStorageKey]);

  const newRequestsCount = Math.max(0, currentTotal - lastSeenTotal);

  const [activeTool, setActiveTool] = useState(initialTool);
  const [previewPort] = useState(3000);
  const [previewKey, setPreviewKey] = useState(0);
  const previewUrl = `http://localhost:${previewPort}`;

  const [splitSizes, setSplitSizes] = useState({
    sidebar: 220,
    editor: 50,
    preview: 30,
    console: 20,
  });
  const [isDragging, setIsDragging] = useState(false);

  // =============================
  // GESTION DES ONGLETS
  // =============================

  const openTab = useCallback((filePath) => {
    if (!openTabs.includes(filePath)) {
      setOpenTabs(prev => [...prev, filePath]);
    }
    setActiveTab(filePath);
  }, [openTabs]);

  const closeTab = useCallback((filePath) => {
    setOpenTabs(prev => {
      const next = prev.filter(f => f !== filePath);
      if (activeTab === filePath) {
        const idx = prev.indexOf(filePath);
        setActiveTab(next[Math.max(0, idx - 1)] || null);
      }
      return next;
    });
    setDirtyTabs(prev => { const n = new Set(prev); n.delete(filePath); return n; });
  }, [activeTab]);

  const handleFileChange = useCallback((filePath) => {
    setDirtyTabs(prev => new Set([...prev, filePath]));
  }, []);

  const handleFileSave = useCallback((filePath) => {
    setDirtyTabs(prev => { const n = new Set(prev); n.delete(filePath); return n; });
  }, []);

  // =============================
  // RACCOURCIS CLAVIER
  // =============================

  useKeyboardShortcuts({
    onReloadPreview: () => setPreviewKey(k => k + 1),
    onRunProject: () => console.log('[IDE] Run project triggered'),
    onToggleTerminal: () => setShowTerminal(prev => !prev),
    onToggleSidebar: () => setShowSidebar(prev => !prev),
    onOpenCommandPalette: () => setShowCommandPalette(true),
    enabled: !showCommandPalette,
  });

  // =============================
  // DRAG & DROP (splitters)
  // =============================

  const handleMouseDown = (splitter) => setIsDragging(splitter);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const container = document.querySelector('.ide-main');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    if (isDragging === 'editor-preview') {
      setSplitSizes(prev => ({
        ...prev,
        editor: Math.min(80, Math.max(20, percentage)),
        preview: Math.min(60, Math.max(10, 100 - percentage - prev.console)),
      }));
    } else if (isDragging === 'preview-console') {
      const y = e.clientY - rect.top;
      const vp = (y / rect.height) * 100;
      setSplitSizes(prev => ({
        ...prev,
        preview: Math.min(70, Math.max(20, vp)),
        console: Math.min(50, Math.max(10, 100 - vp)),
      }));
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // =============================
  // COULEURS SELON THÈME
  // =============================

  const colors = isDark
    ? { bg: '#1e1e1e', topbar: '#2d2d2d', border: '#3e3e3e', text: '#fff', sub: '#aaa', btn: '#3e3e3e', btnHover: '#505050' }
    : { bg: '#f3f3f3', topbar: '#e8e8e8', border: '#d0d0d0', text: '#1e1e1e', sub: '#555', btn: '#d8d8d8', btnHover: '#c4c4c4' };

  // =============================
  // RENDU
  // =============================

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: colors.bg, color: colors.text, overflow: 'hidden' }}>

      {/* ── TOPBAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', background: colors.topbar, borderBottom: `1px solid ${colors.border}`, flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 'bold', color: colors.text }}>Vibe-Coding</span>
          <span style={{ color: '#4caf50', fontSize: 11 }}>● En cours</span>
        </div>

        {/* Bouton Ctrl+K */}
        <button
          style={{ ...btnStyle(colors), fontSize: 12, opacity: 0.8 }}
          onClick={() => setShowCommandPalette(true)}
          title="Palette de commandes (Ctrl+K)"
        >
          ⌨️ Commandes <kbd style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>Ctrl+K</kbd>
        </button>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={btnStyle(colors)} onClick={() => setShowSidebar(p => !p)} title="Toggle Sidebar (Ctrl+B)">
            {showSidebar ? '◀ Sidebar' : '▶ Sidebar'}
          </button>
          <button style={btnStyle(colors)} onClick={() => setShowTerminal(p => !p)} title="Toggle Terminal (Ctrl+`)">
            {showTerminal ? '⊟ Terminal' : '⊞ Terminal'}
          </button>
          <button style={btnStyle(colors)} onClick={() => setPreviewKey(k => k + 1)} title="Recharger preview (F5)">
            🔄 Preview
          </button>
          <button style={btnStyle(colors)} onClick={() => setResponsivePreview(p => !p)} title="Responsive preview">
            📐 Responsive
          </button>
          <button style={btnStyle(colors)} onClick={() => setShowDebugPanel(p => !p)} title="Panneau de débogage">
            🐛 Debug
          </button>
          <button style={btnStyle(colors)} onClick={() => setDevToolsEnabled(!devToolsEnabled)} title="DevTools mobile">
            🐛 DevTools
          </button>
          <button
            style={{ ...btnStyle(colors), position: 'relative', background: showInfraPanel ? '#4fc3f7' : colors.btn, color: showInfraPanel ? '#1e1e1e' : colors.text, fontWeight: showInfraPanel ? 700 : 400 }}
            onClick={() => { setShowInfraPanel(p => !p); if (!showTerminal) setShowTerminal(true); }}
            title={`Infrastructure (BDD · Cron · Stockage · Env · Logs)${newRequestsCount > 0 ? ` — ${newRequestsCount} nouvelle(s) requête(s)` : ''}`}
          >
            🔧 Infra
            {newRequestsCount > 0 && (
              <span
                aria-label={`${newRequestsCount} nouvelles requêtes`}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  background: '#f38ba8',
                  color: '#1e1e1e',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: '18px',
                  textAlign: 'center',
                  boxShadow: '0 0 0 2px #1e1e1e',
                  pointerEvents: 'none',
                }}
              >
                {newRequestsCount > 9 ? '9+' : newRequestsCount}
              </span>
            )}
          </button>
          <WatchMode projectId={projectId} onRestart={() => setPreviewKey(k => k + 1)} />
          <button style={{ ...btnStyle(colors), background: '#007bff', color: '#fff' }} title="Publier">
            🚀 Publish
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* ── FILE TABS ── */}
      <FileTabs
        openTabs={openTabs}
        activeTab={activeTab}
        dirtyTabs={dirtyTabs}
        onTabClick={setActiveTab}
        onTabClose={closeTab}
        onTabReorder={setOpenTabs}
      />

      {/* ── MAIN AREA ── */}
      <div className="ide-main" style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>

        {/* Sidebar */}
        {showSidebar && (
          <div style={{ width: splitSizes.sidebar, minWidth: 150, maxWidth: 400, borderRight: `1px solid ${colors.border}`, flexShrink: 0, overflow: 'hidden' }}>
            <Sidebar
              projectId={projectId}
              userId={userId}
              onFileSelect={openTab}
            />
          </div>
        )}

        {/* Éditeur + Preview */}
        <div style={{ display: 'flex', flex: 1, height: '100%', minWidth: 0 }}>
          <div style={{ display: 'flex', width: `${splitSizes.editor + splitSizes.preview}%`, height: '100%' }}>

            {/* Éditeur */}
            <div style={{ flex: splitSizes.editor, height: '100%', minWidth: 200, display: 'flex', flexDirection: 'column' }}>
              {activeTab ? (
                <CodeEditor
                  projectId={projectId}
                  userId={userId}
                  filePath={activeTab}
                  theme={theme}
                  onFileChange={() => handleFileChange(activeTab)}
                  onSave={() => handleFileSave(activeTab)}
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.sub, fontSize: 14 }}>
                  Sélectionnez un fichier pour commencer
                </div>
              )}
            </div>

            {/* Splitter H */}
            <div
              style={{ width: 4, height: '100%', background: colors.border, cursor: 'col-resize', flexShrink: 0, zIndex: 10, transition: 'background 0.2s' }}
              onMouseDown={() => handleMouseDown('editor-preview')}
              onMouseEnter={e => { e.currentTarget.style.background = '#007bff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = colors.border; }}
            />

            {/* Preview */}
            <div style={{ flex: splitSizes.preview, height: '100%', minWidth: 200, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', background: colors.topbar, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
                <span style={{ color: colors.sub, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Preview</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...btnStyle(colors), fontSize: 11, padding: '2px 6px' }} onClick={() => setPreviewKey(k => k + 1)} title="F5">🔄</button>
                  <button style={{ ...btnStyle(colors), fontSize: 14, padding: '2px 4px' }} onClick={() => setShowQRCode(true)} title="QR Code">📱</button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {responsivePreview ? (
                  <ResponsivePreview key={previewKey} previewUrl={previewUrl} />
                ) : (
                  <PreviewFrame key={previewKey} projectId={projectId} url={previewUrl} />
                )}
              </div>
            </div>
          </div>

          {/* Splitter V + Console/Terminal */}
          {showTerminal && (
            <>
              <div
                style={{ width: `${splitSizes.console}%`, borderLeft: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 150 }}
              >
                {showInfraPanel ? (
                  <Suspense fallback={<div style={{ padding: 20, color: '#aaa', fontSize: 13 }}>⟳ Chargement Infrastructure…</div>}>
                    <InfrastructurePanel
                      projectId={projectId}
                      activeTab={infraActiveTab}
                      onTabChange={setInfraActiveTab}
                    />
                  </Suspense>
                ) : showDebugPanel ? (
                  <DAPDebugPanel projectId={projectId} isDebugging={showDebugPanel} activeFilePath={activeTab} />
                ) : (
                  <ConsoleTerminal projectId={projectId} userId={userId} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Dock */}
      <BottomDock activeTool={activeTool} onToolChange={setActiveTool} />

      {/* Modals */}
      {showQRCode && (
        <QRCodeModal url={previewUrl} onClose={() => setShowQRCode(false)} />
      )}

      <ErudaDevTools enabled={devToolsEnabled} />

      <CommandPalette
        isOpen={showCommandPalette}
        theme={theme}
        onClose={() => setShowCommandPalette(false)}
        onOpenFile={() => { setShowCommandPalette(false); }}
        onRunProject={() => { console.log('[IDE] Run'); setShowCommandPalette(false); }}
        onOpenSearch={() => { setShowCommandPalette(false); }}
        onToggleTheme={() => { toggleTheme(); setShowCommandPalette(false); }}
        onGitCommit={() => { setShowCommandPalette(false); }}
      />

      {/* Styles globaux thème */}
      <style>{`
        [data-theme="light"] { color-scheme: light; }
        [data-theme="dark"]  { color-scheme: dark; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
      `}</style>
    </div>
  );
};

// =============================
// HELPER STYLE BOUTON
// =============================

function btnStyle(colors) {
  return {
    padding: '4px 10px',
    background: colors.btn,
    border: 'none',
    borderRadius: 4,
    color: colors.text,
    cursor: 'pointer',
    fontSize: 12,
  };
}

// =============================
// EXPORT AVEC THEME PROVIDER
// =============================

export const IDELayout = (props) => (
  <ThemeProvider>
    <IDELayoutInner {...props} />
  </ThemeProvider>
);

export default IDELayout;
