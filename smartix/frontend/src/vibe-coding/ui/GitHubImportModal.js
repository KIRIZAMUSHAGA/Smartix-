/**
 * GitHubImportModal — Importer un dépôt GitHub dans Vibe-Coding
 *
 * Fonctionnalités :
 * - Saisie d'une URL GitHub ou sélection parmi les dépôts de l'utilisateur
 * - Authentification via token GitHub personnel
 * - Affichage de la progression du clonage
 * - Ouverture automatique du projet importé
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/github';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, fontFamily: 'monospace',
  },
  modal: {
    background: '#1e1e2e', border: '1px solid #3d3d5c', borderRadius: 12,
    padding: '28px 32px', width: 520, maxWidth: '95vw',
    color: '#cdd6f4', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  title: { margin: '0 0 20px', fontSize: 18, color: '#89b4fa', display: 'flex', alignItems: 'center', gap: 10 },
  label: { display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 },
  input: {
    width: '100%', background: '#313244', border: '1px solid #45475a',
    borderRadius: 6, padding: '10px 12px', color: '#cdd6f4', fontSize: 14,
    outline: 'none', boxSizing: 'border-box', marginBottom: 16,
  },
  row: { display: 'flex', gap: 10, marginBottom: 16 },
  btn: {
    padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
  },
  btnPrimary: { background: '#89b4fa', color: '#1e1e2e', flex: 1 },
  btnSecondary: { background: '#313244', color: '#cdd6f4', border: '1px solid #45475a' },
  repoList: {
    maxHeight: 200, overflowY: 'auto', border: '1px solid #45475a',
    borderRadius: 8, marginBottom: 16,
  },
  repoItem: {
    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #313244',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    transition: 'background 0.15s',
  },
  alert: { background: '#f38ba820', border: '1px solid #f38ba8', borderRadius: 6, padding: 12, marginBottom: 16, color: '#f38ba8', fontSize: 13 },
  success: { background: '#a6e3a120', border: '1px solid #a6e3a1', borderRadius: 6, padding: 12, marginBottom: 16, color: '#a6e3a1', fontSize: 13 },
  progress: { background: '#313244', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 16 },
  progressBar: { height: '100%', background: '#89b4fa', transition: 'width 0.4s ease', borderRadius: 4 },
};

// ─── Composant ───────────────────────────────────────────────────────────────

export default function GitHubImportModal({ onClose, onImportSuccess, authToken }) {
  const [step, setStep]             = useState('form');  // form | repos | loading | done | error
  const [repoUrl, setRepoUrl]       = useState('');
  const [branch, setBranch]         = useState('main');
  const [ghToken, setGhToken]       = useState('');
  const [projectName, setProjectName] = useState('');
  const [repos, setRepos]           = useState([]);
  const [error, setError]           = useState('');
  const [progress, setProgress]     = useState(0);
  const [result, setResult]         = useState(null);
  const [hoveredRepo, setHoveredRepo] = useState(null);

  // ── Charger la liste des dépôts ────────────────────────────────────────

  const loadRepos = useCallback(async () => {
    if (!ghToken) { setError('Veuillez saisir votre token GitHub'); return; }
    setError('');
    setStep('repos');
    try {
      const resp = await fetch(`${API_BASE}/repos?token=${encodeURIComponent(ghToken)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Erreur liste repos');
      setRepos(data.repos);
    } catch (e) {
      setError(e.message);
      setStep('form');
    }
  }, [ghToken, authToken]);

  // ── Sélectionner un dépôt depuis la liste ─────────────────────────────

  const selectRepo = (repo) => {
    setRepoUrl(repo.clone_url);
    setProjectName(repo.name);
    setStep('form');
  };

  // ── Lancer l'import ───────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!repoUrl) { setError("L'URL du dépôt est requise"); return; }
    setError('');
    setStep('loading');
    setProgress(10);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 85));
    }, 500);

    try {
      const resp = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          repo_url: repoUrl,
          branch,
          project_name: projectName || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Erreur lors de l'import");

      clearInterval(interval);
      setProgress(100);
      setResult(data);
      setStep('done');
    } catch (e) {
      clearInterval(interval);
      setError(e.message);
      setStep('error');
    }
  }, [repoUrl, branch, projectName, authToken]);

  // ── Fermeture avec callback ────────────────────────────────────────────

  const handleSuccess = () => {
    onImportSuccess?.(result);
    onClose();
  };

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <h2 style={styles.title}>
          <span>⬇️</span> Importer depuis GitHub
        </h2>

        {/* Erreur */}
        {error && <div style={styles.alert}>⚠️ {error}</div>}

        {/* Succès */}
        {step === 'done' && result && (
          <div style={styles.success}>
            ✅ {result.message}<br />
            <small>Projet ID : {result.project_id}</small>
          </div>
        )}

        {/* Progression */}
        {step === 'loading' && (
          <div style={styles.progress}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }} />
          </div>
        )}

        {/* Formulaire */}
        {(step === 'form' || step === 'error') && (
          <>
            <label style={styles.label}>Token GitHub (pour dépôts privés)</label>
            <input
              style={styles.input}
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
            />

            <label style={styles.label}>URL du dépôt GitHub *</label>
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
                  placeholder="main"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Nom du projet</label>
                <input
                  style={{ ...styles.input, marginBottom: 0 }}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="(optionnel)"
                />
              </div>
            </div>

            <div style={styles.row}>
              <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={loadRepos}>
                📋 Mes dépôts
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={handleImport}
                disabled={!repoUrl}
              >
                ⬇️ Importer
              </button>
            </div>
          </>
        )}

        {/* Liste des dépôts */}
        {step === 'repos' && (
          <>
            <div style={styles.repoList}>
              {repos.length === 0 && (
                <div style={{ padding: 16, color: '#6c7086', textAlign: 'center' }}>
                  Chargement…
                </div>
              )}
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  style={{
                    ...styles.repoItem,
                    background: hoveredRepo === repo.id ? '#313244' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredRepo(repo.id)}
                  onMouseLeave={() => setHoveredRepo(null)}
                  onClick={() => selectRepo(repo)}
                >
                  <span>{repo.private ? '🔒' : '📂'} {repo.name}</span>
                  <span style={{ color: '#6c7086', fontSize: 11 }}>
                    {new Date(repo.updated_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setStep('form')}>
              ← Retour
            </button>
          </>
        )}

        {/* Boutons finaux */}
        {step === 'loading' && (
          <p style={{ color: '#a6adc8', fontSize: 13 }}>
            Clonage en cours… ({progress}%)
          </p>
        )}

        {step === 'done' && (
          <div style={styles.row}>
            <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onClose}>
              Fermer
            </button>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleSuccess}>
              Ouvrir le projet
            </button>
          </div>
        )}

        {(step === 'form' || step === 'error') && (
          <button style={{ ...styles.btn, ...styles.btnSecondary, width: '100%' }} onClick={onClose}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
