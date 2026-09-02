/**
 * ServerEnvPanel — Variables d'environnement synchronisées côté serveur
 *
 * Différences par rapport à EnvPanel (localStorage) :
 * - Stockage chiffré AES-128 sur le serveur (Fernet)
 * - Persistant entre sessions et appareils
 * - Injecté automatiquement dans les containers sandbox
 * - Import / Export .env
 * - Les valeurs ne sont JAMAIS retournées par l'API (lecture seule des clés)
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API = (projectId, path = '') =>
    `/api/projects/${projectId}/env${path}`;

const ServerEnvPanel = ({ projectId, onClose }) => {
    const [vars, setVars]           = useState([]);
    const [newKey, setNewKey]       = useState('');
    const [newValue, setNewValue]   = useState('');
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [toast, setToast]         = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [editKey, setEditKey]     = useState(null);
    const [editValue, setEditValue] = useState('');
    const fileInputRef              = useRef(null);

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const loadVars = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const res = await fetch(API(projectId));
            if (res.ok) {
                const data = await res.json();
                setVars(data.vars || []);
            } else {
                showToast('Erreur de chargement', 'error');
            }
        } catch {
            showToast('Impossible de contacter le serveur', 'error');
        }
        setLoading(false);
    }, [projectId, showToast]);

    useEffect(() => {
        loadVars();
    }, [loadVars]);

    const handleAdd = async () => {
        const key = newKey.trim().toUpperCase().replace(/\s+/g, '_');
        if (!key) return;

        setSaving(true);
        try {
            const res = await fetch(API(projectId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: newValue })
            });
            if (res.ok) {
                setNewKey('');
                setNewValue('');
                showToast(`Variable "${key}" enregistrée`);
                await loadVars();
            } else {
                const err = await res.json();
                showToast(err.detail || 'Erreur', 'error');
            }
        } catch {
            showToast('Erreur réseau', 'error');
        }
        setSaving(false);
    };

    const handleUpdate = async (key) => {
        if (editValue === '') {
            setEditKey(null);
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(API(projectId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: editValue })
            });
            if (res.ok) {
                showToast(`Variable "${key}" mise à jour`);
                setEditKey(null);
                setEditValue('');
                await loadVars();
            } else {
                const err = await res.json();
                showToast(err.detail || 'Erreur', 'error');
            }
        } catch {
            showToast('Erreur réseau', 'error');
        }
        setSaving(false);
    };

    const handleDelete = async (key) => {
        if (!window.confirm(`Supprimer la variable "${key}" ?`)) return;
        try {
            const res = await fetch(API(projectId, `/${key}`), { method: 'DELETE' });
            if (res.ok) {
                showToast(`Variable "${key}" supprimée`);
                await loadVars();
            } else {
                showToast('Erreur suppression', 'error');
            }
        } catch {
            showToast('Erreur réseau', 'error');
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Supprimer TOUTES les variables de ce projet ?')) return;
        try {
            const res = await fetch(API(projectId), { method: 'DELETE' });
            if (res.ok) {
                showToast('Toutes les variables supprimées');
                await loadVars();
            }
        } catch {
            showToast('Erreur réseau', 'error');
        }
    };

    const handleExport = async () => {
        try {
            const res = await fetch(API(projectId, '/export'));
            if (res.ok) {
                const text = await res.text();
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `.env`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Fichier .env exporté');
            }
        } catch {
            showToast('Erreur export', 'error');
        }
    };

    const handleImportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setImportText(ev.target?.result || '');
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleImportSubmit = async () => {
        if (!importText.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(API(projectId, '/import'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: importText })
            });
            if (res.ok) {
                const data = await res.json();
                showToast(data.message);
                setShowImport(false);
                setImportText('');
                await loadVars();
            } else {
                const err = await res.json();
                showToast(err.detail || 'Erreur import', 'error');
            }
        } catch {
            showToast('Erreur réseau', 'error');
        }
        setSaving(false);
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
            <div style={s.panel}>

                {/* ── Header ────────────────────────────────────── */}
                <div style={s.header}>
                    <div style={s.headerTitle}>
                        <span style={s.headerIcon}>🔐</span>
                        <div>
                            <div>Variables d'environnement</div>
                            <div style={s.headerSub}>Chiffrées AES-128 · Injectées dans les containers</div>
                        </div>
                    </div>
                    <div style={s.headerActions}>
                        <button style={s.iconBtn} onClick={handleExport} title="Exporter .env">⬇ .env</button>
                        <button style={s.iconBtn} onClick={() => setShowImport(v => !v)} title="Importer .env">⬆ Import</button>
                        {vars.length > 0 && (
                            <button style={{ ...s.iconBtn, color: '#e74c3c' }} onClick={handleDeleteAll} title="Tout supprimer">🗑 Tout</button>
                        )}
                        <button style={s.iconBtn} onClick={onClose} title="Fermer">✕</button>
                    </div>
                </div>

                {/* ── Bannière sécurité ──────────────────────────── */}
                <div style={s.securityBanner}>
                    🔒 Les valeurs sont chiffrées sur le serveur. Elles ne transitent jamais en clair dans les réponses API.
                </div>

                {/* ── Import .env ────────────────────────────────── */}
                {showImport && (
                    <div style={s.importBox}>
                        <div style={s.importHeader}>
                            <span>Importer un fichier .env</span>
                            <button style={s.iconBtn} onClick={() => fileInputRef.current?.click()}>📁 Choisir fichier</button>
                            <input ref={fileInputRef} type="file" accept=".env,text/plain" style={{ display: 'none' }} onChange={handleImportFile} />
                        </div>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder={"DATABASE_URL=postgres://...\nAPI_KEY=sk-...\n# Les commentaires sont ignorés"}
                            style={s.importTextarea}
                            rows={6}
                            spellCheck={false}
                        />
                        <div style={s.importActions}>
                            <button style={s.cancelBtn} onClick={() => { setShowImport(false); setImportText(''); }}>Annuler</button>
                            <button style={s.importBtn} onClick={handleImportSubmit} disabled={!importText.trim() || saving}>
                                {saving ? '⏳ Import...' : '✅ Importer'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Table des variables ────────────────────────── */}
                <div style={s.tableWrapper}>
                    {loading ? (
                        <div style={s.centered}>⏳ Chargement...</div>
                    ) : vars.length === 0 ? (
                        <div style={s.emptyState}>
                            <div style={s.emptyIcon}>🔑</div>
                            <div>Aucune variable configurée</div>
                            <div style={s.emptyHint}>Ajoutez des secrets, clés API, URLs de connexion...</div>
                        </div>
                    ) : (
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={s.th}>Clé</th>
                                    <th style={s.th}>Valeur</th>
                                    <th style={s.th}>Modifié le</th>
                                    <th style={{ ...s.th, width: 80 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vars.map((v) => (
                                    <tr key={v.key} style={s.row}>
                                        <td style={s.td}>
                                            <code style={s.keyCell}>{v.key}</code>
                                        </td>
                                        <td style={s.td}>
                                            {editKey === v.key ? (
                                                <input
                                                    autoFocus
                                                    style={s.editInput}
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdate(v.key);
                                                        if (e.key === 'Escape') { setEditKey(null); setEditValue(''); }
                                                    }}
                                                    placeholder="Nouvelle valeur..."
                                                    type="password"
                                                />
                                            ) : (
                                                <span
                                                    style={s.hiddenValue}
                                                    onClick={() => { setEditKey(v.key); setEditValue(''); }}
                                                    title="Cliquer pour modifier"
                                                >
                                                    ••••••••
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ ...s.td, fontSize: 11, color: '#666' }}>
                                            {formatDate(v.updated_at)}
                                        </td>
                                        <td style={s.td}>
                                            <div style={s.rowActions}>
                                                {editKey === v.key ? (
                                                    <>
                                                        <button style={s.saveBtn} onClick={() => handleUpdate(v.key)} disabled={saving}>✓</button>
                                                        <button style={s.cancelSmall} onClick={() => { setEditKey(null); setEditValue(''); }}>✕</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button style={s.editBtn} onClick={() => { setEditKey(v.key); setEditValue(''); }} title="Modifier">✏️</button>
                                                        <button style={s.deleteBtn} onClick={() => handleDelete(v.key)} title="Supprimer">🗑️</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Formulaire d'ajout ─────────────────────────── */}
                <div style={s.addRow}>
                    <input
                        style={s.addInputKey}
                        placeholder="NOM_VARIABLE"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        spellCheck={false}
                    />
                    <input
                        style={s.addInputValue}
                        placeholder="valeur secrète..."
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        type="password"
                    />
                    <button style={s.addBtn} onClick={handleAdd} disabled={!newKey.trim() || saving}>
                        {saving ? '⏳' : '+ Ajouter'}
                    </button>
                </div>

                {/* ── Toast ─────────────────────────────────────────── */}
                {toast && (
                    <div style={{ ...s.toast, background: toast.type === 'error' ? '#c0392b' : '#27ae60' }}>
                        {toast.msg}
                    </div>
                )}
            </div>
        </div>
    );
};

const s = {
    overlay: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    },
    panel: {
        background: '#1e1e1e', border: '1px solid #3e3e3e', borderRadius: 10,
        width: 640, maxWidth: '92vw', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 72px rgba(0,0,0,.7)', position: 'relative'
    },
    header: {
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '12px 16px', background: '#252525', borderBottom: '1px solid #3e3e3e'
    },
    headerTitle: { display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontWeight: 700, fontSize: 15 },
    headerIcon: { fontSize: 22, flexShrink: 0 },
    headerSub: { fontSize: 11, color: '#888', fontWeight: 400, marginTop: 2 },
    headerActions: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
    iconBtn: {
        background: '#333', border: '1px solid #444', color: '#ccc', cursor: 'pointer',
        fontSize: 12, padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap'
    },
    securityBanner: {
        padding: '7px 16px', background: '#1a2e1a', color: '#5cb85c',
        fontSize: 11, borderBottom: '1px solid #2d4a2d'
    },
    importBox: {
        padding: '12px 16px', background: '#252525', borderBottom: '1px solid #3e3e3e',
        display: 'flex', flexDirection: 'column', gap: 8
    },
    importHeader: { display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', fontSize: 13, fontWeight: 600 },
    importTextarea: {
        background: '#1e1e1e', border: '1px solid #3e3e3e', color: '#d4d4d4',
        borderRadius: 5, padding: '8px 10px', fontSize: 12, fontFamily: 'monospace',
        resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box'
    },
    importActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
    cancelBtn: {
        background: '#333', border: '1px solid #444', color: '#aaa', cursor: 'pointer',
        padding: '6px 14px', borderRadius: 5, fontSize: 13
    },
    importBtn: {
        background: '#2980b9', border: 'none', color: '#fff', cursor: 'pointer',
        padding: '6px 16px', borderRadius: 5, fontSize: 13, fontWeight: 700
    },
    tableWrapper: { flex: 1, overflowY: 'auto' },
    centered: { padding: 32, textAlign: 'center', color: '#666' },
    emptyState: { padding: '32px 16px', textAlign: 'center', color: '#555' },
    emptyIcon: { fontSize: 36, marginBottom: 8 },
    emptyHint: { fontSize: 12, color: '#444', marginTop: 4 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
        padding: '8px 12px', textAlign: 'left', color: '#777', fontSize: 11,
        textTransform: 'uppercase', letterSpacing: 0.8, background: '#252525',
        borderBottom: '1px solid #3e3e3e', position: 'sticky', top: 0, zIndex: 1
    },
    td: { padding: '6px 12px', borderBottom: '1px solid #2a2a2a', verticalAlign: 'middle' },
    row: { transition: 'background .1s' },
    keyCell: { color: '#9cdcfe', fontFamily: 'monospace', fontSize: 13 },
    hiddenValue: {
        color: '#555', letterSpacing: 3, cursor: 'pointer',
        padding: '2px 6px', borderRadius: 3, display: 'inline-block',
        border: '1px solid transparent', transition: 'all .15s'
    },
    editInput: {
        background: '#2d2d2d', border: '1px solid #4a9eda', color: '#d4d4d4',
        borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace',
        outline: 'none', width: '100%', boxSizing: 'border-box'
    },
    rowActions: { display: 'flex', gap: 4 },
    editBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 },
    deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 },
    saveBtn: {
        background: '#27ae60', border: 'none', color: '#fff', cursor: 'pointer',
        borderRadius: 3, padding: '2px 7px', fontSize: 13, fontWeight: 700
    },
    cancelSmall: {
        background: '#333', border: 'none', color: '#aaa', cursor: 'pointer',
        borderRadius: 3, padding: '2px 6px', fontSize: 13
    },
    addRow: {
        display: 'flex', gap: 8, padding: '12px 16px',
        borderTop: '1px solid #3e3e3e', background: '#252525'
    },
    addInputKey: {
        width: 160, background: '#2d2d2d', border: '1px solid #3e3e3e', color: '#9cdcfe',
        borderRadius: 4, padding: '7px 10px', fontSize: 12, fontFamily: 'monospace',
        outline: 'none', flexShrink: 0
    },
    addInputValue: {
        flex: 1, background: '#2d2d2d', border: '1px solid #3e3e3e', color: '#d4d4d4',
        borderRadius: 4, padding: '7px 10px', fontSize: 13, outline: 'none'
    },
    addBtn: {
        background: '#007bff', border: 'none', borderRadius: 4, color: '#fff',
        cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '7px 16px', whiteSpace: 'nowrap'
    },
    toast: {
        position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)',
        padding: '8px 20px', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700,
        boxShadow: '0 4px 12px rgba(0,0,0,.4)', zIndex: 10, whiteSpace: 'nowrap'
    }
};

export default ServerEnvPanel;
