import { useState, useEffect, useCallback } from 'react';
import TableManager from './TableManager';
import DataBrowser from './DataBrowser';

const executeQuery = async (projectId, query) => {
    const response = await fetch(`/api/projects/${projectId}/database/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Erreur lors de l\'exécution');
    }
    return response.json();
};

const DBPanel = ({ projectId }) => {
    const [dbInfo, setDbInfo]     = useState(null);
    const [query, setQuery]       = useState('');
    const [results, setResults]   = useState(null);
    const [tables, setTables]     = useState([]);
    const [loading, setLoading]   = useState(false);
    const [activeTab, setActiveTab] = useState('query');
    const [selectedTable, setSelectedTable] = useState(null);

    const loadDatabaseInfo = useCallback(async () => {
        try {
            const response = await fetch(`/api/projects/${projectId}/database`);
            if (response.ok) setDbInfo(await response.json());
        } catch (e) {
            console.error('Erreur chargement DB info:', e);
        }
    }, [projectId]);

    const loadTables = useCallback(async () => {
        try {
            const response = await fetch(`/api/projects/${projectId}/database/tables`);
            if (response.ok) setTables(await response.json());
        } catch (e) {
            console.error('Erreur chargement tables:', e);
        }
    }, [projectId]);

    useEffect(() => {
        loadDatabaseInfo();
        loadTables();
    }, [loadDatabaseInfo, loadTables]);

    const runQuery = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResults(null);
        try {
            const result = await executeQuery(projectId, query);
            setResults(result);
        } catch (error) {
            setResults({ error: error.message });
        }
        setLoading(false);
    };

    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runQuery();
    };

    const handleTableClick = (tableName) => {
        setQuery(`SELECT * FROM "${tableName}" LIMIT 100;`);
    };

    return (
        <div className="db-panel" style={styles.panel}>
            <div className="db-sidebar" style={styles.sidebar}>
                <h3 style={styles.sidebarTitle}>📊 Base de données</h3>

                {dbInfo ? (
                    <div className="db-info" style={styles.dbInfo}>
                        <p style={styles.dbInfoLine}>📁 <strong>{dbInfo.name}</strong></p>
                        <p style={styles.dbInfoLine}>👤 {dbInfo.user}</p>
                        <p style={styles.dbInfoLine}>🔗 Port: {dbInfo.port}</p>
                    </div>
                ) : (
                    <div style={styles.dbInfoPlaceholder}>Aucune base configurée</div>
                )}

                <h4 style={styles.tablesTitle}>Tables</h4>
                {tables.length === 0 ? (
                    <p style={styles.emptyTables}>Aucune table</p>
                ) : (
                    <ul style={styles.tablesList}>
                        {tables.map(table => (
                            <li
                                key={table.name}
                                style={styles.tableItem}
                                onClick={() => handleTableClick(table.name)}
                                title={`${table.rowCount} lignes`}
                            >
                                <span>📋 {table.name}</span>
                                <span style={styles.rowCount}>{table.rowCount}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <button
                    style={styles.refreshBtn}
                    onClick={() => { loadDatabaseInfo(); loadTables(); }}
                >
                    🔄 Actualiser
                </button>
            </div>

            <div className="db-main" style={styles.main}>
                <div style={styles.tabs}>
                    {['query', 'tables', 'browser'].map(tab => (
                        <button
                            key={tab}
                            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
                            onClick={() => setActiveTab(tab)}
                        >
                            {{ query: '🖊 Requête SQL', tables: '🗂 Gestion tables', browser: '🔍 Explorateur' }[tab]}
                        </button>
                    ))}
                </div>

                {activeTab === 'query' && (
                    <div className="query-editor" style={styles.queryEditor}>
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Écrire une requête SQL... (Ctrl+Enter pour exécuter)"
                            rows={10}
                            style={styles.textarea}
                        />
                        <div style={styles.queryActions}>
                            <button onClick={runQuery} disabled={loading} style={styles.runBtn}>
                                {loading ? '⏳ Exécution...' : '▶ Exécuter'}
                            </button>
                            <span style={styles.hint}>Ctrl+Enter</span>
                        </div>

                        {results && (
                            <div className="query-results" style={styles.results}>
                                {results.error ? (
                                    <div style={styles.errorBox}>❌ {results.error}</div>
                                ) : results.columns && results.columns.length > 0 ? (
                                    <>
                                        <div style={styles.resultsMeta}>
                                            {results.rowCount} ligne{results.rowCount !== 1 ? 's' : ''}
                                        </div>
                                        <div style={styles.tableWrapper}>
                                            <table style={styles.table}>
                                                <thead>
                                                    <tr>
                                                        {results.columns.map(col => (
                                                            <th key={col} style={styles.th}>{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {results.rows.map((row, i) => (
                                                        <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                                            {results.columns.map(col => (
                                                                <td key={col} style={styles.td}>
                                                                    {row[col] === null
                                                                        ? <span style={styles.null}>NULL</span>
                                                                        : typeof row[col] === 'object'
                                                                            ? JSON.stringify(row[col])
                                                                            : String(row[col])
                                                                    }
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (
                                    <div style={styles.successBox}>✅ Requête exécutée avec succès</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'tables' && (
                    <TableManager
                        projectId={projectId}
                        onTableSelect={(name) => {
                            setSelectedTable(name);
                            setActiveTab('browser');
                        }}
                        onRefresh={loadTables}
                    />
                )}

                {activeTab === 'browser' && (
                    <DataBrowser
                        projectId={projectId}
                        initialTable={selectedTable}
                        tables={tables}
                    />
                )}
            </div>
        </div>
    );
};

const styles = {
    panel: { display: 'flex', height: '100%', fontFamily: 'monospace', fontSize: 13, background: '#1e1e2e', color: '#cdd6f4' },
    sidebar: { width: 220, borderRight: '1px solid #313244', padding: '12px 8px', overflowY: 'auto', flexShrink: 0 },
    sidebarTitle: { margin: '0 0 12px', fontSize: 14, color: '#89b4fa' },
    dbInfo: { background: '#181825', borderRadius: 6, padding: '8px 10px', marginBottom: 12 },
    dbInfoLine: { margin: '3px 0', fontSize: 12, color: '#a6adc8' },
    dbInfoPlaceholder: { fontSize: 12, color: '#6c7086', marginBottom: 12, fontStyle: 'italic' },
    tablesTitle: { margin: '8px 0 6px', fontSize: 12, color: '#6c7086', textTransform: 'uppercase', letterSpacing: 1 },
    emptyTables: { fontSize: 12, color: '#6c7086', fontStyle: 'italic' },
    tablesList: { listStyle: 'none', padding: 0, margin: 0 },
    tableItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', cursor: 'pointer', borderRadius: 4, marginBottom: 2, transition: 'background .15s' },
    rowCount: { fontSize: 11, color: '#6c7086', background: '#313244', borderRadius: 10, padding: '1px 6px' },
    refreshBtn: { marginTop: 12, width: '100%', background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5, padding: '6px 0', cursor: 'pointer', fontSize: 12 },
    main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    tabs: { display: 'flex', borderBottom: '1px solid #313244', background: '#181825' },
    tab: { padding: '8px 16px', background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 13 },
    tabActive: { color: '#89b4fa', borderBottom: '2px solid #89b4fa' },
    queryEditor: { flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 8, overflow: 'hidden' },
    textarea: { flex: '0 0 auto', background: '#181825', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: 'monospace', resize: 'vertical', outline: 'none', minHeight: 120 },
    queryActions: { display: 'flex', alignItems: 'center', gap: 10 },
    runBtn: { background: '#89b4fa', color: '#1e1e2e', border: 'none', borderRadius: 5, padding: '7px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
    hint: { fontSize: 11, color: '#6c7086' },
    results: { flex: 1, overflow: 'auto', borderRadius: 6, border: '1px solid #313244' },
    resultsMeta: { padding: '6px 10px', background: '#181825', color: '#6c7086', fontSize: 12, borderBottom: '1px solid #313244' },
    tableWrapper: { overflow: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { padding: '6px 10px', background: '#181825', color: '#89b4fa', textAlign: 'left', borderBottom: '1px solid #313244', whiteSpace: 'nowrap' },
    td: { padding: '5px 10px', borderBottom: '1px solid #1e1e2e', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    trEven: { background: '#1e1e2e' },
    trOdd: { background: '#181825' },
    errorBox: { padding: 12, color: '#f38ba8', background: '#3b0f15', margin: 8, borderRadius: 5 },
    successBox: { padding: 12, color: '#a6e3a1', background: '#0f2e15', margin: 8, borderRadius: 5 },
    null: { color: '#6c7086', fontStyle: 'italic' }
};

export default DBPanel;
