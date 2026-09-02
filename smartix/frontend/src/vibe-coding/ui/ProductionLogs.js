/**
 * ProductionLogs — Logs de production en temps réel
 *
 * Fonctionnalités :
 * - Connexion WebSocket au serveur de logs
 * - Affichage des logs colorés par niveau (info / warn / error)
 * - Barre de recherche / filtre
 * - Auto-scroll vers le bas
 * - Bouton pour effacer les logs
 * - Indicateur de connexion
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#11111b', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    color: '#cdd6f4', border: '1px solid #313244', borderRadius: 8, overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
    background: '#181825', borderBottom: '1px solid #313244', flexShrink: 0,
  },
  title: { fontSize: 13, fontWeight: 700, color: '#cdd6f4', flex: 1 },
  dot: (connected) => ({
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: connected ? '#a6e3a1' : '#f38ba8',
    boxShadow: connected ? '0 0 6px #a6e3a1' : 'none',
  }),
  statusText: (connected) => ({ fontSize: 11, color: connected ? '#a6e3a1' : '#f38ba8' }),
  toolbar: {
    display: 'flex', gap: 8, padding: '8px 14px',
    background: '#181825', borderBottom: '1px solid #313244', flexShrink: 0,
  },
  filterInput: {
    flex: 1, background: '#313244', border: '1px solid #45475a', borderRadius: 6,
    padding: '6px 10px', color: '#cdd6f4', fontSize: 12, outline: 'none',
  },
  levelBtn: (active, color) => ({
    padding: '4px 10px', borderRadius: 6, border: `1px solid ${active ? color : '#45475a'}`,
    background: active ? `${color}22` : 'transparent', color: active ? color : '#6c7086',
    cursor: 'pointer', fontSize: 11, fontWeight: 600,
  }),
  clearBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #45475a',
    background: 'transparent', color: '#6c7086', cursor: 'pointer', fontSize: 11,
  },
  logArea: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  logLine: (level) => ({
    display: 'flex', gap: 10, padding: '3px 14px', alignItems: 'flex-start',
    borderLeft: `2px solid ${_levelColor(level)}22`,
    background: level === 'error' ? '#f38ba808' : 'transparent',
  }),
  logTime: { color: '#45475a', fontSize: 11, flexShrink: 0, paddingTop: 1 },
  logLevel: (level) => ({
    fontSize: 10, fontWeight: 700, color: _levelColor(level),
    background: `${_levelColor(level)}22`, padding: '1px 5px', borderRadius: 3,
    flexShrink: 0, marginTop: 1, textTransform: 'uppercase',
  }),
  logText: (level) => ({
    fontSize: 12, color: level === 'error' ? '#f38ba8' : level === 'warn' ? '#f9e2af' : '#cdd6f4',
    wordBreak: 'break-word', lineHeight: 1.5,
  }),
  empty: { padding: 24, textAlign: 'center', color: '#45475a', fontSize: 13 },
};

function _levelColor(level) {
  if (level === 'error') return '#f38ba8';
  if (level === 'warn')  return '#f9e2af';
  if (level === 'debug') return '#a6adc8';
  return '#89b4fa';
}

function _formatTime(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  return d.toLocaleTimeString();
}

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {string}  props.deploymentId  - ID du déploiement
 * @param {string}  props.provider      - 'vercel' | 'netlify'
 * @param {string}  props.token         - Token API du provider
 * @param {string}  [props.title]       - Titre affiché dans le header
 */
export default function ProductionLogs({
  deploymentId,
  provider = 'vercel',
  token = '',
  title,
}) {
  const [logs, setLogs]           = useState([]);
  const [filter, setFilter]       = useState('');
  const [levelFilter, setLevel]   = useState('all');
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const wsRef     = useRef(null);
  const bottomRef = useRef(null);
  const logsRef   = useRef([]);

  // ── Connexion WebSocket ────────────────────────────────────────────────

  useEffect(() => {
    if (!deploymentId) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host  = window.location.host;
    const url   = `${proto}//${host}/logs/${deploymentId}?token=${encodeURIComponent(token)}&provider=${provider}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (e) => {
      try {
        const entry = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (entry.cmd) return;  // Ignorer les commandes
        logsRef.current = [...logsRef.current, entry];
        setLogs([...logsRef.current]);
      } catch (_) {}
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
    };
  }, [deploymentId, provider, token]);

  // ── Auto-scroll ────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // ── Filtrage ──────────────────────────────────────────────────────────

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (filter && !log.text?.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  // ── Effacer ───────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
    wsRef.current?.send(JSON.stringify({ cmd: 'clear' }));
  }, []);

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div style={st.container}>
      {/* Header */}
      <div style={st.header}>
        <div style={st.dot(connected)} />
        <span style={st.title}>
          {title || `Logs — ${provider.toUpperCase()} — ${deploymentId?.slice(0, 10)}…`}
        </span>
        <span style={st.statusText(connected)}>
          {connected ? 'Connecté' : 'Déconnecté'}
        </span>
        <span style={{ fontSize: 11, color: '#45475a' }}>{filteredLogs.length} lignes</span>
      </div>

      {/* Toolbar */}
      <div style={st.toolbar}>
        <input
          style={st.filterInput}
          placeholder="Filtrer les logs…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {['all', 'info', 'warn', 'error'].map((lv) => (
          <button
            key={lv}
            style={st.levelBtn(levelFilter === lv, lv === 'all' ? '#89b4fa' : _levelColor(lv))}
            onClick={() => setLevel(lv)}
          >
            {lv === 'all' ? 'Tous' : lv.toUpperCase()}
          </button>
        ))}
        <button style={st.clearBtn} onClick={handleClear} title="Effacer les logs">
          🗑
        </button>
        <button
          style={st.levelBtn(autoScroll, '#a6e3a1')}
          onClick={() => setAutoScroll((v) => !v)}
          title="Auto-scroll"
        >
          ↓
        </button>
      </div>

      {/* Zone de logs */}
      <div style={st.logArea}>
        {filteredLogs.length === 0 && (
          <div style={st.empty}>
            {connected
              ? '⏳ En attente de logs…'
              : '🔌 Connectez-vous à un déploiement pour voir les logs'}
          </div>
        )}
        {filteredLogs.map((log, i) => (
          <div key={log.id || i} style={st.logLine(log.level)}>
            <span style={st.logTime}>{_formatTime(log.created)}</span>
            <span style={st.logLevel(log.level)}>{log.level || 'info'}</span>
            <span style={st.logText(log.level)}>{log.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
