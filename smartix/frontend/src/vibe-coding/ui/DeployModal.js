/**
 * DeployModal — Interface de déploiement Vercel / Netlify
 *
 * Fonctionnalités :
 * - Sélection du provider (Vercel ou Netlify)
 * - Saisie du token API
 * - Affichage de la progression du déploiement
 * - Lien vers le site déployé
 * - Polling du statut jusqu'à READY
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = '/api/deploy';
const POLL_INTERVAL = 3000;

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  modal: {
    background: '#1e1e2e', border: '1px solid #3d3d5c', borderRadius: 14,
    padding: '28px 32px', width: 500, maxWidth: '95vw',
    color: '#cdd6f4', fontFamily: 'monospace', boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
  },
  title: { margin: '0 0 6px', fontSize: 20, color: '#cba6f7' },
  subtitle: { margin: '0 0 24px', fontSize: 13, color: '#6c7086' },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: '#181825', borderRadius: 8, padding: 4 },
  tab: {
    flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
  },
  tabActive: { background: '#cba6f7', color: '#1e1e2e' },
  tabInactive: { background: 'transparent', color: '#6c7086' },
  label: { display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 6 },
  input: {
    width: '100%', background: '#313244', border: '1px solid #45475a', borderRadius: 6,
    padding: '10px 12px', color: '#cdd6f4', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', marginBottom: 14,
  },
  row: { display: 'flex', gap: 10, marginTop: 8 },
  btn: { padding: '11px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnPrimary: { background: '#cba6f7', color: '#1e1e2e', flex: 1 },
  btnSecondary: { background: '#313244', color: '#cdd6f4', border: '1px solid #45475a' },
  progress: { background: '#313244', borderRadius: 4, height: 8, overflow: 'hidden', margin: '12px 0' },
  progressBar: { height: '100%', transition: 'width 0.5s ease', borderRadius: 4 },
  status: { fontSize: 12, color: '#a6adc8', marginBottom: 4 },
  alert: { background: '#f38ba820', border: '1px solid #f38ba8', borderRadius: 6, padding: 12, marginBottom: 14, color: '#f38ba8', fontSize: 13 },
  success: { background: '#a6e3a120', border: '1px solid #a6e3a1', borderRadius: 6, padding: 14, marginBottom: 14 },
  link: { color: '#89b4fa', wordBreak: 'break-all', display: 'block', marginTop: 6 },
  badge: (state) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: state === 'READY' ? '#a6e3a1' : state === 'ERROR' ? '#f38ba8' : '#fab387',
    color: '#1e1e2e',
  }),
};

// ─── Composant ───────────────────────────────────────────────────────────────

export default function DeployModal({ projectId, projectName, files = [], onClose, authToken }) {
  const [provider, setProvider] = useState('vercel');
  const [token, setToken]       = useState('');
  const [siteName, setSiteName] = useState((projectName || 'vibe-project').toLowerCase().replace(/\s+/g, '-'));
  const [teamId, setTeamId]     = useState('');
  const [framework, setFramework] = useState('');
  const [step, setStep]         = useState('form');
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);
  const [deployStatus, setDeployStatus] = useState(null);
  const pollRef = useRef(null);

  // ── Démarrer le déploiement ────────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (!token) { setError('Token API requis'); return; }
    setError('');
    setStep('deploying');
    setProgress(15);

    const interval = setInterval(() => setProgress((p) => Math.min(p + 5, 75)), 800);

    try {
      const endpoint = provider === 'vercel' ? `${API_BASE}/vercel` : `${API_BASE}/netlify`;
      const body = provider === 'vercel'
        ? { project_name: siteName, files, token, team_id: teamId || undefined, framework: framework || undefined }
        : { site_name: siteName, files, token };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Erreur déploiement');

      clearInterval(interval);
      setProgress(80);
      setResult(data);
      setStep('polling');
      _startPolling(data.deployment_id);
    } catch (e) {
      clearInterval(interval);
      setError(e.message);
      setStep('error');
    }
  }, [provider, token, siteName, teamId, framework, files, authToken]);

  // ── Polling du statut ─────────────────────────────────────────────────

  const _startPolling = (deploymentId) => {
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/status?deployment_id=${deploymentId}&provider=${provider}&token=${encodeURIComponent(token)}${teamId ? `&team_id=${teamId}` : ''}`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        if (!resp.ok) return;
        const status = await resp.json();
        setDeployStatus(status);

        if (status.status === 'READY' || status.status === 'ready') {
          clearInterval(pollRef.current);
          setProgress(100);
          setStep('done');
        } else if (status.status === 'ERROR' || status.status === 'error') {
          clearInterval(pollRef.current);
          setError(status.error || 'Erreur lors du déploiement');
          setStep('error');
        } else {
          setProgress((p) => Math.min(p + 3, 96));
        }
      } catch (_) {}
    }, POLL_INTERVAL);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        <h2 style={st.title}>🚀 Déployer le projet</h2>
        <p style={st.subtitle}>{projectName || projectId}</p>

        {/* Sélection provider */}
        {step === 'form' && (
          <div style={st.tabs}>
            {['vercel', 'netlify'].map((p) => (
              <button
                key={p}
                style={{ ...st.tab, ...(provider === p ? st.tabActive : st.tabInactive) }}
                onClick={() => setProvider(p)}
              >
                {p === 'vercel' ? '▲ Vercel' : '◆ Netlify'}
              </button>
            ))}
          </div>
        )}

        {error && <div style={st.alert}>⚠️ {error}</div>}

        {/* Formulaire */}
        {(step === 'form' || step === 'error') && (
          <>
            <label style={st.label}>Token API {provider === 'vercel' ? 'Vercel' : 'Netlify'} *</label>
            <input
              style={st.input} type="password"
              placeholder={provider === 'vercel' ? 'vc_XXXXXXXXX...' : 'NETLIFY_TOKEN...'}
              value={token} onChange={(e) => setToken(e.target.value)}
            />

            <label style={st.label}>Nom du projet / site</label>
            <input
              style={st.input} value={siteName}
              onChange={(e) => setSiteName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            />

            {provider === 'vercel' && (
              <>
                <label style={st.label}>Team ID (optionnel)</label>
                <input style={st.input} value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="team_xxxxxx" />
                <label style={st.label}>Framework (optionnel)</label>
                <select style={{ ...st.input, marginBottom: 14 }} value={framework} onChange={(e) => setFramework(e.target.value)}>
                  <option value="">Auto-détection</option>
                  <option value="nextjs">Next.js</option>
                  <option value="react">Create React App</option>
                  <option value="vite">Vite</option>
                  <option value="vue">Vue.js</option>
                  <option value="static">HTML/CSS/JS statique</option>
                </select>
              </>
            )}

            <div style={st.row}>
              <button style={{ ...st.btn, ...st.btnSecondary }} onClick={onClose}>Annuler</button>
              <button style={{ ...st.btn, ...st.btnPrimary }} onClick={handleDeploy} disabled={!token}>
                🚀 Déployer
              </button>
            </div>
          </>
        )}

        {/* Progression */}
        {(step === 'deploying' || step === 'polling') && (
          <>
            <div style={st.progress}>
              <div style={{
                ...st.progressBar,
                width: `${progress}%`,
                background: progress < 80 ? '#cba6f7' : '#a6e3a1',
              }} />
            </div>
            <p style={st.status}>
              {step === 'deploying' ? '📦 Envoi des fichiers…' : '⏳ Déploiement en cours…'}
              {deployStatus && <span style={st.badge(deployStatus.status)}> {deployStatus.status}</span>}
            </p>
          </>
        )}

        {/* Succès */}
        {step === 'done' && result && (
          <>
            <div style={st.success}>
              <strong style={{ color: '#a6e3a1' }}>✅ Déploiement réussi !</strong>
              <a href={deployStatus?.url || result.url} target="_blank" rel="noreferrer" style={st.link}>
                {deployStatus?.url || result.url}
              </a>
            </div>
            <button style={{ ...st.btn, ...st.btnSecondary, width: '100%' }} onClick={onClose}>
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
