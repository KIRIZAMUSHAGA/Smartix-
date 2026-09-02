/**
 * GitRollbackModal — Restaurer une version précédente du projet
 *
 * Fonctionnalités :
 * - Liste l'historique des commits avec auteur, date, message
 * - Prévisualisation du diff avant rollback (panneau dépliable)
 * - Confirmation avant rollback (action destructive)
 * - Indicateur de progression pendant le rollback
 * - Bouton "Annuler le rollback" (restaure depuis le stash)
 * - Tooltips pour les hashes courts
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: '#1e1e2e', border: '1px solid #313244', borderRadius: 12,
    width: '100%', maxWidth: 700, maxHeight: '85vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  header: {
    padding: '20px 24px 16px', borderBottom: '1px solid #313244',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  title: { fontSize: 18, fontWeight: 600, color: '#cdd6f4', margin: 0 },
  subtitle: { fontSize: 12, color: '#6c7086', margin: 0 },
  closeBtn: {
    marginLeft: 'auto', background: 'none', border: 'none',
    color: '#6c7086', cursor: 'pointer', fontSize: 20,
    padding: '2px 8px', borderRadius: 6, lineHeight: 1,
  },
  body: { flex: 1, overflowY: 'auto', padding: '12px 0' },
  commitRow: (selected, hovered) => ({
    padding: '12px 24px', cursor: 'pointer',
    background: selected ? '#313244' : hovered ? '#1e1e2e99' : 'transparent',
    borderLeft: selected ? '3px solid #89b4fa' : '3px solid transparent',
    transition: 'all 0.1s',
    display: 'flex', flexDirection: 'column', gap: 4,
  }),
  commitTop: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  hash: {
    fontFamily: 'monospace', fontSize: 12, color: '#89b4fa',
    background: '#313244', padding: '1px 6px', borderRadius: 4,
    flexShrink: 0,
  },
  message: { fontSize: 13, color: '#cdd6f4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 11, color: '#6c7086', display: 'flex', gap: 12 },
  diffPanel: {
    margin: '4px 24px 8px', background: '#11111b', borderRadius: 8,
    border: '1px solid #313244', overflow: 'hidden',
  },
  diffHeader: {
    padding: '8px 12px', background: '#181825', fontSize: 12,
    color: '#a6adc8', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  diffContent: {
    padding: '8px 12px', fontFamily: 'monospace', fontSize: 11,
    color: '#cdd6f4', overflowX: 'auto', maxHeight: 200, overflowY: 'auto',
    whiteSpace: 'pre',
  },
  footer: {
    padding: '16px 24px', borderTop: '1px solid #313244',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  btnPrimary: {
    background: '#89b4fa', color: '#1e1e2e', border: 'none',
    borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
  },
  btnDanger: {
    background: '#f38ba8', color: '#1e1e2e', border: 'none',
    borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
  },
  btnSecondary: {
    background: 'transparent', color: '#cdd6f4', border: '1px solid #45475a',
    borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14,
  },
  btnWarning: {
    background: '#f9e2af', color: '#1e1e2e', border: 'none',
    borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  },
  statusBadge: (type) => ({
    fontSize: 11, padding: '3px 8px', borderRadius: 100,
    fontFamily: 'monospace',
    background: type === 'success' ? '#a6e3a133' : type === 'error' ? '#f38ba833' : '#f9e2af33',
    color:      type === 'success' ? '#a6e3a1'   : type === 'error' ? '#f38ba8'   : '#f9e2af',
  }),
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 48, gap: 12, color: '#45475a',
  },
};

// ─── Composant ───────────────────────────────────────────────────────────────

const GitRollbackModal = ({
  projectId,
  authToken,
  onClose,
  onRollbackComplete,
}) => {
  const [commits, setCommits]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [hovered, setHovered]         = useState(null);
  const [diffData, setDiffData]       = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [confirming, setConfirming]   = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [status, setStatus]           = useState(null); // { type, message }
  const [canUndo, setCanUndo]         = useState(false);

  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  // ── Chargement des commits ────────────────────────────────────────────

  const loadCommits = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/commits?limit=50`, { headers });
      const data = await resp.json();
      setCommits(data.commits || []);
    } catch (e) {
      setStatus({ type: 'error', message: 'Impossible de charger les commits' });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadCommits(); }, [loadCommits]);

  // ── Sélection + prévisualisation ──────────────────────────────────────

  const selectCommit = useCallback(async (commit) => {
    if (selected?.hash === commit.hash) {
      setSelected(null);
      setDiffData(null);
      return;
    }
    setSelected(commit);
    setDiffData(null);
    setDiffLoading(true);
    setConfirming(false);

    try {
      const resp = await fetch(`/api/projects/${projectId}/rollback/preview`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit_hash: commit.hash }),
      });
      const data = await resp.json();
      setDiffData(data);
    } catch (e) {
      setDiffData(null);
    } finally {
      setDiffLoading(false);
    }
  }, [selected, projectId]);

  // ── Rollback ──────────────────────────────────────────────────────────

  const handleRollback = useCallback(async () => {
    if (!selected) return;
    setRollingBack(true);
    setStatus(null);

    try {
      const resp = await fetch(`/api/projects/${projectId}/rollback`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit_hash: selected.hash }),
      });
      const data = await resp.json();

      if (data.success) {
        setStatus({ type: 'success', message: `Projet restauré au commit ${data.short_hash}` });
        setCanUndo(data.stash_saved);
        setConfirming(false);
        onRollbackComplete?.({ commit: selected, result: data });
        await loadCommits();
      } else {
        setStatus({ type: 'error', message: data.error || 'Rollback échoué' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: `Erreur réseau : ${e.message}` });
    } finally {
      setRollingBack(false);
    }
  }, [selected, projectId]);

  // ── Annuler le rollback ───────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    setRollingBack(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/rollback/undo`, {
        method: 'POST',
        headers,
      });
      const data = await resp.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Rollback annulé — état précédent restauré' });
        setCanUndo(false);
        await loadCommits();
      } else {
        setStatus({ type: 'error', message: data.detail || 'Annulation échouée' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: `Erreur : ${e.message}` });
    } finally {
      setRollingBack(false);
    }
  }, [projectId]);

  // ── Rendu ─────────────────────────────────────────────────────────────

  const renderDiff = () => {
    if (!selected) return null;
    if (diffLoading) return <div style={{ padding: '12px 24px', fontSize: 12, color: '#6c7086' }}>Chargement du diff…</div>;
    if (!diffData) return null;

    const hasChanges = diffData.stat?.trim();
    return (
      <div style={st.diffPanel}>
        <div style={st.diffHeader}>
          <span>Différences avec le commit {diffData.commit?.short_hash || selected.short_hash}</span>
          {diffData.truncated && <span style={{ color: '#f9e2af' }}>⚠ Diff tronqué</span>}
        </div>
        {hasChanges
          ? <div style={st.diffContent}>{diffData.stat}</div>
          : <div style={{ ...st.diffContent, color: '#6c7086' }}>Aucun changement détecté</div>
        }
      </div>
    );
  };

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        {/* Header */}
        <div style={st.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🕐</span>
              <h2 style={st.title}>Historique des versions</h2>
            </div>
            <p style={st.subtitle}>
              Sélectionner un commit pour prévisualiser et restaurer
            </p>
          </div>
          <button style={st.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Corps */}
        <div style={st.body}>
          {loading ? (
            <div style={st.emptyState}>
              <div style={{ fontSize: 32 }}>⏳</div>
              <div>Chargement de l'historique…</div>
            </div>
          ) : commits.length === 0 ? (
            <div style={st.emptyState}>
              <div style={{ fontSize: 40 }}>📭</div>
              <div style={{ fontSize: 14, color: '#6c7086', textAlign: 'center' }}>
                Aucun commit dans ce projet.<br />
                Faites un premier commit pour activer le rollback.
              </div>
            </div>
          ) : (
            commits.map((commit) => (
              <React.Fragment key={commit.hash}>
                <div
                  style={st.commitRow(selected?.hash === commit.hash, hovered === commit.hash)}
                  onClick={() => selectCommit(commit)}
                  onMouseEnter={() => setHovered(commit.hash)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div style={st.commitTop}>
                    <span style={st.hash} title={commit.hash}>{commit.short_hash}</span>
                    <span style={st.message} title={commit.message}>{commit.message}</span>
                    {selected?.hash === commit.hash && (
                      <span style={st.statusBadge('info')}>sélectionné</span>
                    )}
                  </div>
                  <div style={st.meta}>
                    <span>👤 {commit.author}</span>
                    <span>🕐 {_formatDate(commit.date)}</span>
                  </div>
                </div>

                {/* Panneau diff sous le commit sélectionné */}
                {selected?.hash === commit.hash && renderDiff()}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={st.footer}>
          {/* Statut */}
          {status && (
            <span style={st.statusBadge(status.type)}>{status.message}</span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Bouton annuler rollback */}
            {canUndo && (
              <button
                style={st.btnWarning}
                onClick={handleUndo}
                disabled={rollingBack}
                title="Annuler le dernier rollback"
              >
                ↩ Annuler
              </button>
            )}

            <button style={st.btnSecondary} onClick={onClose}>
              Fermer
            </button>

            {selected && !confirming && (
              <button
                style={st.btnPrimary}
                onClick={() => setConfirming(true)}
                disabled={rollingBack || !selected}
              >
                Prévisualiser le rollback
              </button>
            )}

            {selected && confirming && (
              <button
                style={{ ...st.btnDanger, opacity: rollingBack ? 0.6 : 1 }}
                onClick={handleRollback}
                disabled={rollingBack}
                title={`Restaurer au commit ${selected.short_hash}`}
              >
                {rollingBack ? '⏳ Restauration…' : `⚠ Confirmer le rollback vers ${selected.short_hash}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitRollbackModal;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _formatDate(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)   return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return isoDate;
  }
}
