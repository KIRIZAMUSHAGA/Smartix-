/**
 * EnvPanel - Panneau de gestion des variables d'environnement
 * Stockage dans localStorage avec chiffrement AES-256 côté client
 */

import React, { useState, useEffect, useCallback } from 'react';
import { encryptEnvVars, decryptEnvVars, isEncryptionAvailable } from '../utils/encryption';

const STORAGE_KEY = 'vibe_coding_env_vars';
const ENCRYPTION_ENABLED = isEncryptionAvailable();

// =============================
// FONCTIONS UTILITAIRES
// =============================

export const loadEnvVars = async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (ENCRYPTION_ENABLED) {
      return await decryptEnvVars(parsed);
    }
    return parsed;
  } catch {
    return [];
  }
};

export const saveEnvVars = async (vars) => {
  try {
    let toStore = vars;
    if (ENCRYPTION_ENABLED) {
      toStore = await encryptEnvVars(vars);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error('Erreur sauvegarde env vars:', e);
  }
};

export const getEnvVarsAsObject = async () => {
  const vars = await loadEnvVars();
  return vars.reduce((acc, { key, value }) => {
    if (key.trim()) acc[key.trim()] = value;
    return acc;
  }, {});
};

export const expandEnvVarsInCommand = async (command) => {
  const envObj = await getEnvVarsAsObject();
  return command.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (match, name) => {
    return name in envObj ? envObj[name] : match;
  });
};

// =============================
// COMPOSANT PRINCIPAL
// =============================

const EnvPanel = ({ onClose }) => {
  const [vars, setVars] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showValues, setShowValues] = useState(false);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    loadEnvVars().then(v => {
      setVars(v);
      setIsLoading(false);
    });
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const persistAndSet = useCallback(async (updated) => {
    setVars(updated);
    await saveEnvVars(updated);
  }, []);

  const handleAdd = async () => {
    const key = newKey.trim();
    if (!key) return;
    if (vars.some(v => v.key === key)) {
      showToast(`Variable "${key}" existe déjà`, 'error');
      return;
    }
    const updated = [...vars, { key, value: newValue }];
    await persistAndSet(updated);
    setNewKey('');
    setNewValue('');
    showToast(`Variable ${key} ajoutée`);
  };

  const handleDelete = async (index) => {
    const updated = vars.filter((_, i) => i !== index);
    await persistAndSet(updated);
    showToast('Variable supprimée');
  };

  const handleUpdate = useCallback(async (index, field, val) => {
    const updated = vars.map((v, i) => i === index ? { ...v, [field]: val } : v);
    await persistAndSet(updated);
  }, [vars, persistAndSet]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span style={styles.headerIcon}>🔑</span>
            <span>Variables d'environnement</span>
          </div>
          <div style={styles.headerActions}>
            <button
              style={styles.iconBtn}
              onClick={() => setShowValues(!showValues)}
              title={showValues ? 'Masquer les valeurs' : 'Afficher les valeurs'}
            >
              {showValues ? '🙈' : '👁️'}
            </button>
            {onClose && (
              <button style={styles.iconBtn} onClick={onClose} title="Fermer">✕</button>
            )}
          </div>
        </div>

        {/* Avertissement chiffrement */}
        <div style={{
          ...styles.description,
          color: ENCRYPTION_ENABLED ? '#27ae60' : '#e67e22',
          borderLeft: `3px solid ${ENCRYPTION_ENABLED ? '#27ae60' : '#e67e22'}`,
          paddingLeft: 12,
        }}>
          {ENCRYPTION_ENABLED
            ? '🔒 Valeurs chiffrées avec AES-256 dans le stockage local.'
            : '⚠️ Chiffrement non disponible — stockage local non chiffré.'}
        </div>

        {/* Description */}
        <div style={styles.description}>
          Les variables sont injectées dans le terminal lors de l'exécution.
        </div>

        {/* Table */}
        <div style={styles.tableContainer}>
          {isLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#555' }}>Chargement...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Clé</th>
                  <th style={styles.th}>Valeur</th>
                  <th style={{ ...styles.th, width: 60 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {vars.length === 0 && (
                  <tr>
                    <td colSpan={3} style={styles.emptyRow}>
                      Aucune variable définie. Ajoutez-en ci-dessous.
                    </td>
                  </tr>
                )}
                {vars.map((v, i) => (
                  <tr key={i} style={styles.row}>
                    <td style={styles.td}>
                      <input
                        style={styles.cellInput}
                        value={v.key}
                        onChange={e => handleUpdate(i, 'key', e.target.value)}
                        spellCheck={false}
                      />
                    </td>
                    <td style={styles.td}>
                      <input
                        style={styles.cellInput}
                        type={showValues ? 'text' : 'password'}
                        value={v.value}
                        onChange={e => handleUpdate(i, 'value', e.target.value)}
                        spellCheck={false}
                      />
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.deleteBtn}
                        onClick={() => handleDelete(i)}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Ajouter */}
        <div style={styles.addRow}>
          <input
            style={styles.addInput}
            placeholder="CLE"
            value={newKey}
            onChange={e => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
            onKeyDown={handleKeyDown}
            spellCheck={false}
          />
          <input
            style={styles.addInput}
            placeholder="valeur"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
            type={showValues ? 'text' : 'password'}
            spellCheck={false}
          />
          <button
            style={styles.addBtn}
            onClick={handleAdd}
            disabled={!newKey.trim()}
          >
            + Ajouter
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ ...styles.toast, background: toast.type === 'error' ? '#c0392b' : '#27ae60' }}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================
// STYLES
// =============================
const styles = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    background: '#1e1e1e',
    border: '1px solid #3e3e3e',
    borderRadius: 8,
    width: 560,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3e3e3e',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  headerIcon: { fontSize: 18 },
  headerActions: { display: 'flex', gap: 8 },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 6px',
    borderRadius: 4,
  },
  description: {
    padding: '8px 16px',
    color: '#888',
    fontSize: 12,
    background: '#252525',
    borderBottom: '1px solid #3e3e3e',
  },
  tableContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    background: '#252525',
    borderBottom: '1px solid #3e3e3e',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid #2d2d2d',
  },
  row: {
    transition: 'background 0.1s',
  },
  cellInput: {
    background: 'transparent',
    border: '1px solid transparent',
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 13,
    padding: '4px 6px',
    borderRadius: 4,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  emptyRow: {
    padding: 24,
    textAlign: 'center',
    color: '#555',
    fontStyle: 'italic',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    opacity: 0.6,
    transition: 'opacity 0.2s',
  },
  addRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid #3e3e3e',
    background: '#252525',
  },
  addInput: {
    flex: 1,
    background: '#2d2d2d',
    border: '1px solid #3e3e3e',
    borderRadius: 4,
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 13,
    padding: '6px 10px',
    outline: 'none',
  },
  addBtn: {
    background: '#007bff',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    padding: '6px 14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  toast: {
    position: 'absolute',
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 20px',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    zIndex: 1001,
    whiteSpace: 'nowrap',
  },
};

export default EnvPanel;
