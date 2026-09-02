/**
 * GitHubExportModal — Exporter un projet Vibe-Coding vers GitHub
 *
 * Fonctionnalités :
 * - Saisie du dépôt de destination (URL ou nouveau nom)
 * - Saisie d'un message de commit
 * - Token GitHub personnel
 * - Affichage du lien vers le commit créé
 */

import React, { useState, useCallback } from 'react';

const API_BASE = '/api/github';

// ─── Styles (identiques à ImportModal) ───────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, fontFamily: 'monospace',
  },
  modal: {
    background: '#1e1e2e', border: '1px solid #3d3d5c', borderRadius: 12,
    padding: '28px 32px', width: 480, maxWidth: '95vw',
    color: '#cdd6f4', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  title: { margin: '0 0 20px', fontSize: 18, color: '#a6e3a1', display: 'flex', alignItems: 'center', gap: 10 },
  label: { display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 },
  input: {
    width: '100%', background: '#313244', border: '1px solid #45475a',
    borderRadius: 6, padding: '10px 12px', color: '#cdd6f4', fontSize: 14,
    outline: 'none', boxSizing: 'border-box', marginBottom: 16,
  },
  row: { display: 'flex', gap: 10 },
  btn: {
    padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
  },
  btnPrimary: { background: '#a6e3a1', color: '#1e1e2e', flex: 1 },
  btnSecondary: { background: '#313244', color: '#cdd6f4', border: '1px solid #45475a' },
  alert: { background: '#f38ba820', border: '1px solid #f38ba8', borderRadius: 6, padding: 12, marginBottom: 16, color: '#f38ba8', fontSize: 13 },
  success: { background: '#a6e3a120', border: '1px solid #a6e3a1', borderRadius: 6, padding: 12, marginBottom: 16, color: '#a6e3a1', fontSize: 13 },
  progress: { background: '#313244', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 16 },
  progressBar: { height: '100%', background: '#a6e3a1', transition: 'width 0.4s ease', borderRadius: 4 },
  link: { color: '#89b4fa', textDecoration: 'underline', wordBreak: 'break-all' },
};

// ─── Composant ───────────────────────────────────────────────────────────────

export default function GitHubExportModal({ projectId, projectName, onClose, authToken }) {
  const [repoUrl, setRepoUrl]           = useState('');
  const [branch, setBranch]             = useState('main');
  const [ghToken, setGhToken]           = useState('');
  const [commitMessage, setCommitMessage] = useState(`Mise à jour ${projectName || 'projet'} via Vibe-Coding`);
  const [step, setStep]                 = useState('form');
  const [progress, setProgress]         = useState(0);
  const [error, setError]               = useState('');
  const [result, setResult]             = useState(null);

  // ── Lancer l'export ───────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!repoUrl) { setError("L'URL du dépôt est requise"); return; }
    if (!ghToken) { setError('Le token GitHub est requis'); return; }
    setError('');
    setStep('loading');
    setProgress(10);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 6, 88));
    }, 600);

    try {
      const resp = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          repo_url: repoUrl,
          commit_message: commitMessage,
          branch,
          token: ghToken,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Erreur lors de l'export");

      clearInterval(interval);
      setProgress(100);
      setResult(data);
      setStep('done');
    } catch (e) {
      clearInterval(interval);
      setError(e.message);
      setStep('error');
    }
  }, [repoUrl, branch, ghToken, commitMessage, projectId, authToken]);

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <h2 style={styles.title}>
          <span>⬆️</span> Exporter vers GitHub
        </h2>

        {error && <div style={styles.alert}>⚠️ {error}</div>}

        {step === 'done' && result && (
          <div style={styles.success}>
            ✅ {result.message}<br />
            <a href={result.repo_url} target="_blank" rel="noreferrer" style={styles.link}>
              {result.repo_url}
            </a>
            <br />
            <small>Commit : {result.commit_sha?.slice(0, 7)}</small>
          </div>
        )}

        {step === 'loading' && (
          <>
            <div style={styles.progress}>
              <div style={{ ...styles.progressBar, width: `${progress}%` }} />
            </div>
            <p style={{ color: '#a6adc8', fontSize: 13 }}>
              Publication en cours… ({progress}%)
            </p>
          </>
        )}

        {(step === 'form' || step === 'error') && (
          <>
            <label style={styles.label}>Token GitHub Personnel *</label>
            <input
              style={styles.input}
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
            />

            <label style={styles.label}>URL du dépôt de destination *</label>
            <input
              style={styles.input}
              type="text"
              placeholder="https://github.com/utilisateur/mon-projet"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />

            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Branche</label>
                <input
                  style={{ ...styles.input, marginBottom: 0 }}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
            </div>
            <br />

            <label style={styles.label}>Message de commit</label>
            <input
              style={styles.input}
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />

            <div style={styles.row}>
              <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onClose}>
                Annuler
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={handleExport}
                disabled={!repoUrl || !ghToken}
              >
                ⬆️ Exporter
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <button style={{ ...styles.btn, ...styles.btnSecondary, width: '100%', marginTop: 8 }} onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
