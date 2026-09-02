import { useState, useEffect, useCallback } from 'react';

const DataBrowser = ({ projectId, initialTable, tables = [] }) => {
    const [selectedTable, setSelectedTable] = useState(initialTable || '');
    const [schema, setSchema]               = useState([]);
    const [rows, setRows]                   = useState([]);
    const [columns, setColumns]             = useState([]);
    const [page, setPage]                   = useState(0);
    const [pageSize]                        = useState(50);
    const [total, setTotal]                 = useState(0);
    const [loading, setLoading]             = useState(false);
    const [error, setError]                 = useState(null);
    const [filterCol, setFilterCol]         = useState('');
    const [filterVal, setFilterVal]         = useState('');

    const fetchSchema = useCallback(async (tableName) => {
        if (!tableName) return;
        try {
            const response = await fetch(
                `/api/projects/${projectId}/database/tables/${tableName}/schema`
            );
            if (response.ok) setSchema(await response.json());
        } catch (e) {
            console.error('Erreur schema:', e);
        }
    }, [projectId]);

    const fetchData = useCallback(async (tableName, pageNum = 0) => {
        if (!tableName) return;
        setLoading(true);
        setError(null);

        let whereClause = '';
        if (filterCol && filterVal) {
            whereClause = `WHERE "${filterCol}"::text ILIKE '%${filterVal.replace(/'/g, "''")}%'`;
        }

        const query = `
            SELECT *, COUNT(*) OVER() AS _total_count
            FROM "${tableName}"
            ${whereClause}
            LIMIT ${pageSize} OFFSET ${pageNum * pageSize};
        `;

        try {
            const response = await fetch(`/api/projects/${projectId}/database/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) throw new Error('Erreur serveur');
            const result = await response.json();

            if (result.error) {
                setError(result.error);
                setRows([]);
                setColumns([]);
            } else {
                const displayCols = (result.columns || []).filter(c => c !== '_total_count');
                setColumns(displayCols);

                const displayRows = result.rows || [];
                if (displayRows.length > 0) {
                    setTotal(parseInt(displayRows[0]['_total_count'] || 0));
                } else {
                    setTotal(0);
                }
                setRows(displayRows.map(row => {
                    const r = { ...row };
                    delete r._total_count;
                    return r;
                }));
            }
        } catch (e) {
            setError(e.message);
        }
        setLoading(false);
    }, [projectId, pageSize, filterCol, filterVal]);

    useEffect(() => {
        if (initialTable) setSelectedTable(initialTable);
    }, [initialTable]);

    useEffect(() => {
        if (selectedTable) {
            setPage(0);
            fetchSchema(selectedTable);
            fetchData(selectedTable, 0);
        }
    }, [selectedTable, fetchSchema, fetchData]);

    const handleTableChange = (name) => {
        setSelectedTable(name);
        setFilterCol('');
        setFilterVal('');
        setPage(0);
    };

    const handleFilter = () => {
        setPage(0);
        fetchData(selectedTable, 0);
    };

    const clearFilter = () => {
        setFilterCol('');
        setFilterVal('');
        setPage(0);
        fetchData(selectedTable, 0);
    };

    const totalPages = Math.ceil(total / pageSize);

    const renderCellValue = (val) => {
        if (val === null || val === undefined) return <span style={styles.null}>NULL</span>;
        if (typeof val === 'boolean') return <span style={styles.bool}>{val ? 'true' : 'false'}</span>;
        if (typeof val === 'object') return (
            <span style={styles.json} title={JSON.stringify(val, null, 2)}>
                {JSON.stringify(val).substring(0, 60)}{JSON.stringify(val).length > 60 ? '…' : ''}
            </span>
        );
        const str = String(val);
        return str.length > 80 ? (
            <span title={str}>{str.substring(0, 80)}…</span>
        ) : str;
    };

    return (
        <div style={styles.container}>
            <div style={styles.toolbar}>
                <select
                    value={selectedTable}
                    onChange={(e) => handleTableChange(e.target.value)}
                    style={styles.select}
                >
                    <option value="">-- Choisir une table --</option>
                    {tables.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                </select>

                {columns.length > 0 && (
                    <div style={styles.filterRow}>
                        <select
                            value={filterCol}
                            onChange={(e) => setFilterCol(e.target.value)}
                            style={{ ...styles.select, minWidth: 120 }}
                        >
                            <option value="">Filtrer par...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                            value={filterVal}
                            onChange={(e) => setFilterVal(e.target.value)}
                            placeholder="Valeur..."
                            style={styles.filterInput}
                            onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                        />
                        <button onClick={handleFilter} style={styles.filterBtn}>🔍</button>
                        {(filterCol || filterVal) && (
                            <button onClick={clearFilter} style={styles.clearBtn}>✕</button>
                        )}
                    </div>
                )}

                {selectedTable && (
                    <button
                        onClick={() => fetchData(selectedTable, page)}
                        style={styles.refreshBtn}
                        title="Actualiser"
                    >
                        🔄
                    </button>
                )}
            </div>

            {!selectedTable && (
                <div style={styles.empty}>Sélectionnez une table pour explorer ses données.</div>
            )}

            {error && (
                <div style={styles.errorBox}>❌ {error}</div>
            )}

            {loading && <div style={styles.loading}>⏳ Chargement...</div>}

            {!loading && selectedTable && !error && columns.length > 0 && (
                <>
                    <div style={styles.meta}>
                        {total} ligne{total !== 1 ? 's' : ''} — Page {page + 1} / {Math.max(totalPages, 1)}
                    </div>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    {columns.map(col => (
                                        <th key={col} style={styles.th} title={col}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length} style={styles.emptyCell}>
                                            Aucune donnée
                                        </td>
                                    </tr>
                                ) : rows.map((row, i) => (
                                    <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                        {columns.map(col => (
                                            <td key={col} style={styles.td}>
                                                {renderCellValue(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div style={styles.pagination}>
                            <button
                                onClick={() => { setPage(0); fetchData(selectedTable, 0); }}
                                disabled={page === 0}
                                style={styles.pageBtn}
                            >«</button>
                            <button
                                onClick={() => { setPage(p => p - 1); fetchData(selectedTable, page - 1); }}
                                disabled={page === 0}
                                style={styles.pageBtn}
                            >‹</button>
                            <span style={styles.pageInfo}>{page + 1} / {totalPages}</span>
                            <button
                                onClick={() => { setPage(p => p + 1); fetchData(selectedTable, page + 1); }}
                                disabled={page >= totalPages - 1}
                                style={styles.pageBtn}
                            >›</button>
                            <button
                                onClick={() => { setPage(totalPages - 1); fetchData(selectedTable, totalPages - 1); }}
                                disabled={page >= totalPages - 1}
                                style={styles.pageBtn}
                            >»</button>
                        </div>
                    )}

                    {schema.length > 0 && (
                        <details style={styles.schemaDetails}>
                            <summary style={styles.schemaSummary}>📐 Schéma de la table</summary>
                            <table style={{ ...styles.table, marginTop: 8 }}>
                                <thead>
                                    <tr>
                                        {['Colonne', 'Type', 'Nullable', 'Défaut'].map(h => (
                                            <th key={h} style={styles.th}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {schema.map((col, i) => (
                                        <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                            <td style={styles.td}>{col.column_name}</td>
                                            <td style={styles.td}>{col.data_type}</td>
                                            <td style={styles.td}>{col.is_nullable}</td>
                                            <td style={styles.td}>{col.column_default || <span style={styles.null}>—</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </details>
                    )}
                </>
            )}
        </div>
    );
};

const styles = {
    container: { padding: 12, overflow: 'auto', color: '#cdd6f4', fontFamily: 'monospace', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', boxSizing: 'border-box' },
    toolbar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    select: { background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 5, padding: '6px 10px', fontSize: 13, fontFamily: 'monospace', outline: 'none' },
    filterRow: { display: 'flex', alignItems: 'center', gap: 6 },
    filterInput: { background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 5, padding: '6px 10px', fontSize: 13, fontFamily: 'monospace', outline: 'none', width: 140 },
    filterBtn: { background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5, padding: '6px 10px', cursor: 'pointer' },
    clearBtn: { background: 'none', border: '1px solid #45475a', color: '#6c7086', borderRadius: 5, padding: '5px 8px', cursor: 'pointer' },
    refreshBtn: { background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5, padding: '6px 10px', cursor: 'pointer' },
    empty: { color: '#6c7086', fontStyle: 'italic', padding: '20px 0' },
    loading: { color: '#a6adc8', padding: '12px 0' },
    errorBox: { padding: '8px 12px', background: '#3b0f15', color: '#f38ba8', borderRadius: 5 },
    meta: { color: '#6c7086', fontSize: 12 },
    tableWrapper: { overflow: 'auto', flex: 1, border: '1px solid #313244', borderRadius: 6 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { padding: '6px 10px', background: '#181825', color: '#89b4fa', textAlign: 'left', borderBottom: '1px solid #313244', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 },
    td: { padding: '5px 10px', borderBottom: '1px solid #1e1e2e', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    trEven: { background: '#1e1e2e' },
    trOdd: { background: '#181825' },
    emptyCell: { padding: '20px', textAlign: 'center', color: '#6c7086' },
    null: { color: '#6c7086', fontStyle: 'italic' },
    bool: { color: '#fab387' },
    json: { color: '#a6e3a1' },
    pagination: { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' },
    pageBtn: { background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 14 },
    pageInfo: { color: '#a6adc8', fontSize: 12, minWidth: 60, textAlign: 'center' },
    schemaDetails: { background: '#181825', border: '1px solid #313244', borderRadius: 6, padding: '8px 12px' },
    schemaSummary: { cursor: 'pointer', color: '#89b4fa', fontSize: 12 }
};

export default DataBrowser;
