import { useState, useEffect, useCallback } from 'react';

const SQL_TYPES = [
    'SERIAL', 'BIGSERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
    'NUMERIC', 'REAL', 'DOUBLE PRECISION',
    'VARCHAR(255)', 'TEXT', 'CHAR(1)',
    'BOOLEAN',
    'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME',
    'UUID', 'JSONB', 'JSON',
    'BYTEA'
];

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

const defaultColumns = () => [
    { name: 'id', type: 'SERIAL', primary: true, nullable: false }
];

const TableManager = ({ projectId, onTableSelect, onRefresh }) => {
    const [tables, setTables]           = useState([]);
    const [newTableName, setNewTableName] = useState('');
    const [columns, setColumns]         = useState(defaultColumns());
    const [creating, setCreating]       = useState(false);
    const [feedback, setFeedback]       = useState(null);
    const [dropping, setDropping]       = useState(null);

    const loadTables = useCallback(async () => {
        try {
            const response = await fetch(`/api/projects/${projectId}/database/tables`);
            if (response.ok) {
                const data = await response.json();
                setTables(data);
            }
        } catch (e) {
            console.error('Erreur chargement tables:', e);
        }
    }, [projectId]);

    useEffect(() => {
        loadTables();
    }, [loadTables]);

    const updateColumn = (idx, field, value) => {
        setColumns(prev => prev.map((col, i) => i === idx ? { ...col, [field]: value } : col));
    };

    const addColumn = () => {
        setColumns(prev => [...prev, { name: '', type: 'TEXT', primary: false, nullable: true }]);
    };

    const removeColumn = (idx) => {
        if (columns.length <= 1) return;
        setColumns(prev => prev.filter((_, i) => i !== idx));
    };

    const createTable = async () => {
        if (!newTableName.trim()) {
            setFeedback({ type: 'error', message: 'Le nom de la table est requis.' });
            return;
        }
        if (columns.some(c => !c.name.trim())) {
            setFeedback({ type: 'error', message: 'Chaque colonne doit avoir un nom.' });
            return;
        }

        const columnDefs = columns.map(col => {
            let def = `${col.name} ${col.type}`;
            if (col.primary) def += ' PRIMARY KEY';
            else if (!col.nullable) def += ' NOT NULL';
            return def;
        }).join(',\n  ');

        const query = `CREATE TABLE "${newTableName}" (\n  ${columnDefs}\n);`;

        setCreating(true);
        setFeedback(null);

        try {
            const result = await executeQuery(projectId, query);
            if (result.error) {
                setFeedback({ type: 'error', message: result.error });
            } else {
                setFeedback({ type: 'success', message: `Table "${newTableName}" créée avec succès.` });
                setNewTableName('');
                setColumns(defaultColumns());
                await loadTables();
                if (onRefresh) onRefresh();
            }
        } catch (e) {
            setFeedback({ type: 'error', message: e.message });
        }
        setCreating(false);
    };

    const dropTable = async (tableName) => {
        if (dropping) return;
        setDropping(tableName);
        setFeedback(null);
        try {
            const result = await executeQuery(projectId, `DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
            if (result.error) {
                setFeedback({ type: 'error', message: result.error });
            } else {
                setFeedback({ type: 'success', message: `Table "${tableName}" supprimée.` });
                await loadTables();
                if (onRefresh) onRefresh();
            }
        } catch (e) {
            setFeedback({ type: 'error', message: e.message });
        }
        setDropping(null);
    };

    return (
        <div style={styles.container}>
            <div style={styles.createSection}>
                <h4 style={styles.sectionTitle}>➕ Créer une table</h4>

                <input
                    placeholder="Nom de la table (ex: users)"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    style={styles.input}
                />

                <div style={styles.columnsHeader}>
                    <span style={styles.colLabel}>Colonnes</span>
                </div>

                <div style={styles.columnsList}>
                    {columns.map((col, idx) => (
                        <div key={idx} style={styles.columnRow}>
                            <input
                                placeholder="nom_colonne"
                                value={col.name}
                                onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                                style={{ ...styles.input, flex: 1, minWidth: 80 }}
                            />
                            <select
                                value={col.type}
                                onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                                style={styles.select}
                            >
                                {SQL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <label style={styles.checkLabel}>
                                <input
                                    type="checkbox"
                                    checked={col.primary}
                                    onChange={(e) => updateColumn(idx, 'primary', e.target.checked)}
                                />
                                PK
                            </label>
                            <label style={styles.checkLabel}>
                                <input
                                    type="checkbox"
                                    checked={col.nullable}
                                    disabled={col.primary}
                                    onChange={(e) => updateColumn(idx, 'nullable', e.target.checked)}
                                />
                                NULL
                            </label>
                            <button
                                style={styles.removeColBtn}
                                onClick={() => removeColumn(idx)}
                                disabled={columns.length <= 1}
                                title="Supprimer colonne"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>

                <div style={styles.createActions}>
                    <button onClick={addColumn} style={styles.addColBtn}>+ Colonne</button>
                    <button onClick={createTable} disabled={creating} style={styles.createBtn}>
                        {creating ? '⏳ Création...' : '✅ Créer la table'}
                    </button>
                </div>

                {feedback && (
                    <div style={feedback.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {feedback.type === 'error' ? '❌ ' : '✅ '}{feedback.message}
                    </div>
                )}
            </div>

            <div style={styles.tableListSection}>
                <h4 style={styles.sectionTitle}>📋 Tables existantes ({tables.length})</h4>
                {tables.length === 0 ? (
                    <p style={styles.emptyText}>Aucune table dans cette base de données.</p>
                ) : (
                    <div style={styles.tableGrid}>
                        {tables.map(table => (
                            <div key={table.name} style={styles.tableCard}>
                                <div style={styles.tableCardInfo}>
                                    <span style={styles.tableName}>📋 {table.name}</span>
                                    <span style={styles.tableMeta}>{table.rowCount} lignes · {table.columnCount} col.</span>
                                </div>
                                <div style={styles.tableCardActions}>
                                    <button
                                        style={styles.browseBtn}
                                        onClick={() => onTableSelect && onTableSelect(table.name)}
                                    >
                                        🔍 Explorer
                                    </button>
                                    <button
                                        style={styles.dropBtn}
                                        onClick={() => {
                                            if (window.confirm(`Supprimer la table "${table.name}" ? Cette action est irréversible.`)) {
                                                dropTable(table.name);
                                            }
                                        }}
                                        disabled={dropping === table.name}
                                    >
                                        {dropping === table.name ? '⏳' : '🗑'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: { padding: 16, overflow: 'auto', color: '#cdd6f4', fontFamily: 'monospace', fontSize: 13 },
    createSection: { background: '#181825', borderRadius: 8, padding: 16, marginBottom: 20, border: '1px solid #313244' },
    sectionTitle: { margin: '0 0 12px', fontSize: 14, color: '#89b4fa' },
    input: { background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 5, padding: '6px 10px', fontSize: 13, fontFamily: 'monospace', outline: 'none', width: '100%', boxSizing: 'border-box', marginBottom: 8 },
    columnsHeader: { marginBottom: 6 },
    colLabel: { color: '#6c7086', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
    columnsList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
    columnRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
    select: { background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 5, padding: '6px 8px', fontSize: 12, fontFamily: 'monospace', outline: 'none' },
    checkLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#a6adc8', cursor: 'pointer', whiteSpace: 'nowrap' },
    removeColBtn: { background: '#45475a', border: 'none', color: '#f38ba8', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 12 },
    createActions: { display: 'flex', gap: 8, marginTop: 4 },
    addColBtn: { background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5, padding: '6px 14px', cursor: 'pointer', fontSize: 12 },
    createBtn: { background: '#a6e3a1', border: 'none', color: '#1e1e2e', borderRadius: 5, padding: '6px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
    errorMsg: { marginTop: 10, padding: '8px 12px', background: '#3b0f15', color: '#f38ba8', borderRadius: 5 },
    successMsg: { marginTop: 10, padding: '8px 12px', background: '#0f2e15', color: '#a6e3a1', borderRadius: 5 },
    tableListSection: {},
    emptyText: { color: '#6c7086', fontStyle: 'italic' },
    tableGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
    tableCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181825', border: '1px solid #313244', borderRadius: 6, padding: '8px 12px' },
    tableCardInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
    tableName: { fontWeight: 700, color: '#cdd6f4' },
    tableMeta: { fontSize: 11, color: '#6c7086' },
    tableCardActions: { display: 'flex', gap: 6 },
    browseBtn: { background: '#313244', border: 'none', color: '#89b4fa', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: 12 },
    dropBtn: { background: '#313244', border: 'none', color: '#f38ba8', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }
};

export default TableManager;
