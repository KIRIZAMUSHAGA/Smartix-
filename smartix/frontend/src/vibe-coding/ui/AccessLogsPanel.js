/**
 * AccessLogsPanel — Logs d'accès HTTP par projet (sandbox)
 *
 * Affiche les requêtes journalisées côté serveur :
 * méthode · chemin · statut · durée · IP · horodatage
 *
 * Différent de ProductionLogs (WebSocket applicatifs) :
 * ces logs sont les requêtes HTTP structurées persistées en base.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const METHOD_COLORS = {
    GET:    '#89b4fa',
    POST:   '#a6e3a1',
    PUT:    '#f9e2af',
    PATCH:  '#fab387',
    DELETE: '#f38ba8',
    HEAD:   '#b4befe',
    OPTIONS:'#89dceb',
};

const LEVEL_COLORS = {
    success: '#a6e3a1',
    info:    '#89b4fa',
    warn:    '#f9e2af',
    error:   '#f38ba8',
};

const LEVEL_LABELS = {
    success: '2xx',
    info:    '3xx',
    warn:    '4xx',
    error:   '5xx',
};

const API = (projectId, path = '') =>
    `/api/projects/${projectId}/logs${path}`;

const AccessLogsPanel = ({ projectId }) => {
    const [logs, setLogs]           = useState([]);
    const [stats, setStats]         = useState(null);
    const [loading, setLoading]     = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [filterMethod, setFilterMethod] = useState('');
    const [filterLevel, setFilterLevel]   = useState('');
    const [filterPath, setFilterPath]     = useState('');
    const [limit, setLimit]         = useState(200);
    const [toast, setToast]         = useState(null);
    const [selectedLog, setSelectedLog] = useState(null);
    const intervalRef               = useRef(null);

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const loadLogs = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit });
            if (filterMethod) params.set('method', filterMethod);
            if (filterLevel)  params.set('level', filterLevel);
            if (filterPath)   params.set('path_contains', filterPath);

            const [logsRes, statsRes] = await Promise.all([
                fetch(`${API(projectId)}?${params}`),
                fetch(API(projectId, '/stats'))
            ]);

            if (logsRes.ok) {
                const data = await logsRes.json();
                setLogs(data.logs || []);
            }
            if (statsRes.ok) {
                setStats(await statsRes.json());
            }
        } catch (e) {
            console.error('Erreur chargement logs:', e);
        }
        setLoading(false);
    }, [projectId, limit, filterMethod, filterLevel, filterPath]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(loadLogs, 10000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoRefresh, loadLogs]);

    const handleClear = async () => {
        if (!window.confirm('Supprimer tous les logs d\'accès de ce projet ?')) return;
        try {
            const res = await fetch(API(projectId), { method: 'DELETE' });
            if (res.ok) {
                const data = await res.json();
                showToast(data.message);
                setLogs([]);
                setStats(null);
            }
        } catch {
            showToast('Erreur suppression', 'error');
        }
    };

    const handleExport = async () => {
        try {
            const res = await fetch(API(projectId, `/export?limit=${limit}`));
            if (res.ok) {
                const text = await res.text();
                const blob = new Blob([text], { type: 'text/plain' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url;
                a.download = `access-${projectId.slice(0, 8)}.log`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Logs exportés');
            }
        } catch {
            showToast('Erreur export', 'error');
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '--';
        const d = new Date(iso);
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatFullDate = (iso) => {
        if (!iso) return '--';
        return new Date(iso).toLocaleString('fr-FR');
    };

    const trimPath = (path, max = 50) =>
        path.length > max ? '...' + path.slice(-(max - 3)) : path;

    return (
        <div style={s.container}>

            {/* ── Stats bar ─────────────────────────────────────── */}
            {stats && (
                <div style={s.statsBar}>
                    <StatChip label="Total" value={stats.total} color="#89b4fa" />
                    <StatChip label="Erreurs" value={stats.errors} color="#f38ba8" />
                    <StatChip label="Taux erreur" value={`${stats.error_rate}%`} color={stats.error_rate > 10 ? '#f38ba8' : '#a6e3a1'} />
                    <StatChip label="Moy. durée" value={`${stats.avg_duration_ms}ms`} color="#f9e2af" />
                    <StatChip label="Max durée" value={`${stats.max_duration_ms}ms`} color="#fab387" />
                    {stats.method_counts && Object.entries(stats.method_counts).map(([m, c]) => (
                        <StatChip key={m} label={m} value={c} color={METHOD_COLORS[m] || '#cdd6f4'} />
                    ))}
                </div>
            )}

            {/* ── Toolbar ───────────────────────────────────────── */}
            <div style={s.toolbar}>
                <select
                    style={s.select}
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                >
                    <option value="">Toutes méthodes</option>
                    {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>

                <select
                    style={s.select}
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                >
                    <option value="">Tous niveaux</option>
                    {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v} {k}</option>
                    ))}
                </select>

                <input
                    style={s.searchInput}
                    placeholder="Filtrer par chemin..."
                    value={filterPath}
                    onChange={(e) => setFilterPath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                />

                <select
                    style={{ ...s.select, width: 80 }}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                >
                    {[50, 100, 200, 500].map(n => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>

                <button style={s.btn} onClick={loadLogs} title="Actualiser">
                    {loading ? '⏳' : '🔄'}
                </button>

                <button
                    style={{ ...s.btn, color: autoRefresh ? '#a6e3a1' : '#6c7086' }}
                    onClick={() => setAutoRefresh(v => !v)}
                    title={autoRefresh ? 'Désactiver l\'actualisation auto' : 'Activer l\'actualisation auto (10s)'}
                >
                    {autoRefresh ? '⏸ Auto' : '▶ Auto'}
                </button>

                <button style={s.btn} onClick={handleExport} title="Exporter .log">⬇ .log</button>
                {logs.length > 0 && (
                    <button style={{ ...s.btn, color: '#f38ba8' }} onClick={handleClear} title="Vider les logs">🗑</button>
                )}
            </div>

            {/* ── Table ─────────────────────────────────────────── */}
            <div style={s.tableWrapper}>
                {logs.length === 0 && !loading && (
                    <div style={s.empty}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                        <div>Aucun log disponible.</div>
                        <div style={{ fontSize: 12, color: '#45475a', marginTop: 4 }}>
                            Les requêtes vers ce projet apparaîtront ici automatiquement.
                        </div>
                    </div>
                )}

                {logs.length > 0 && (
                    <table style={s.table}>
                        <thead>
                            <tr>
                                <th style={s.th}>Heure</th>
                                <th style={s.th}>Méthode</th>
                                <th style={s.th}>Chemin</th>
                                <th style={s.th}>Statut</th>
                                <th style={s.th}>Durée</th>
                                <th style={s.th}>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr
                                    key={i}
                                    style={{
                                        ...s.row,
                                        ...(i % 2 === 0 ? s.rowEven : s.rowOdd),
                                        ...(selectedLog === i ? s.rowSelected : {})
                                    }}
                                    onClick={() => setSelectedLog(selectedLog === i ? null : i)}
                                >
                                    <td style={{ ...s.td, color: '#6c7086', fontSize: 11 }}>
                                        {formatDate(log.timestamp)}
                                    </td>
                                    <td style={s.td}>
                                        <span style={{
                                            ...s.methodBadge,
                                            color: METHOD_COLORS[log.method] || '#cdd6f4',
                                            borderColor: (METHOD_COLORS[log.method] || '#cdd6f4') + '44'
                                        }}>
                                            {log.method}
                                        </span>
                                    </td>
                                    <td style={{ ...s.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span title={log.path + (log.query_string ? '?' + log.query_string : '')}>
                                            {trimPath(log.path)}
                                        </span>
                                        {log.query_string && <span style={s.qs}>?{log.query_string.slice(0, 30)}</span>}
                                    </td>
                                    <td style={s.td}>
                                        <span style={{
                                            ...s.statusBadge,
                                            color: LEVEL_COLORS[log.level] || '#cdd6f4',
                                            background: (LEVEL_COLORS[log.level] || '#cdd6f4') + '18'
                                        }}>
                                            {log.status_code}
                                        </span>
                                    </td>
                                    <td style={{ ...s.td, color: log.duration_ms > 1000 ? '#f38ba8' : log.duration_ms > 300 ? '#f9e2af' : '#a6e3a1', fontSize: 12 }}>
                                        {log.duration_ms}ms
                                    </td>
                                    <td style={{ ...s.td, fontSize: 11, color: '#6c7086' }}>
                                        {log.client_ip}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Détail log sélectionné ────────────────────────── */}
            {selectedLog !== null && logs[selectedLog] && (
                <div style={s.detailPanel}>
                    <div style={s.detailHeader}>
                        <span style={s.detailTitle}>📋 Détail de la requête</span>
                        <button style={s.closeDetail} onClick={() => setSelectedLog(null)}>✕</button>
                    </div>
                    <div style={s.detailGrid}>
                        {[
                            ['Timestamp', formatFullDate(logs[selectedLog].timestamp)],
                            ['Méthode', logs[selectedLog].method],
                            ['Chemin complet', logs[selectedLog].path + (logs[selectedLog].query_string ? '?' + logs[selectedLog].query_string : '')],
                            ['Statut HTTP', logs[selectedLog].status_code],
                            ['Durée', `${logs[selectedLog].duration_ms}ms`],
                            ['Niveau', logs[selectedLog].level],
                            ['Adresse IP', logs[selectedLog].client_ip],
                            ['User ID', logs[selectedLog].user_id || '—'],
                        ].map(([k, v]) => (
                            <div key={k} style={s.detailRow}>
                                <span style={s.detailKey}>{k}</span>
                                <span style={s.detailVal}>{v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Toast ─────────────────────────────────────────── */}
            {toast && (
                <div style={{ ...s.toast, background: toast.type === 'error' ? '#c0392b' : '#27ae60' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

const StatChip = ({ label, value, color }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 10, color: '#6c7086', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
);

const s = {
    container: {
        display: 'flex', flexDirection: 'column', height: '100%',
        background: '#11111b', color: '#cdd6f4',
        fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 13, position: 'relative'
    },
    statsBar: {
        display: 'flex', gap: 20, padding: '10px 16px',
        background: '#181825', borderBottom: '1px solid #313244',
        overflowX: 'auto', flexShrink: 0
    },
    toolbar: {
        display: 'flex', gap: 6, padding: '8px 12px', alignItems: 'center',
        background: '#181825', borderBottom: '1px solid #313244', flexShrink: 0, flexWrap: 'wrap'
    },
    select: {
        background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4',
        borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none'
    },
    searchInput: {
        flex: 1, minWidth: 120, background: '#1e1e2e', border: '1px solid #313244',
        color: '#cdd6f4', borderRadius: 5, padding: '5px 8px', fontSize: 12, outline: 'none'
    },
    btn: {
        background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5,
        padding: '5px 10px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap'
    },
    tableWrapper: { flex: 1, overflowY: 'auto' },
    empty: { padding: 40, textAlign: 'center', color: '#6c7086' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: {
        padding: '7px 10px', textAlign: 'left', color: '#6c7086',
        fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
        background: '#181825', borderBottom: '1px solid #313244',
        position: 'sticky', top: 0, zIndex: 1
    },
    td: { padding: '5px 10px', borderBottom: '1px solid #1e1e2e', verticalAlign: 'middle' },
    row: { cursor: 'pointer', transition: 'background .1s' },
    rowEven: { background: '#11111b' },
    rowOdd:  { background: '#181825' },
    rowSelected: { background: '#1e1e2e', outline: '1px solid #89b4fa' },
    methodBadge: {
        fontSize: 11, fontWeight: 700, border: '1px solid',
        borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace'
    },
    statusBadge: { fontSize: 12, fontWeight: 700, borderRadius: 4, padding: '2px 6px' },
    qs: { color: '#45475a', fontSize: 10, marginLeft: 2 },
    detailPanel: {
        borderTop: '1px solid #313244', background: '#181825',
        padding: '12px 16px', flexShrink: 0, maxHeight: 220, overflowY: 'auto'
    },
    detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    detailTitle: { color: '#89b4fa', fontWeight: 700, fontSize: 13 },
    closeDetail: { background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 16 },
    detailGrid: { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '5px 12px' },
    detailRow: { display: 'contents' },
    detailKey: { color: '#6c7086', fontSize: 12, alignSelf: 'start', paddingTop: 1 },
    detailVal: { color: '#cdd6f4', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' },
    toast: {
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        padding: '8px 20px', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700,
        boxShadow: '0 4px 12px rgba(0,0,0,.4)', zIndex: 10, whiteSpace: 'nowrap'
    }
};

export default AccessLogsPanel;
