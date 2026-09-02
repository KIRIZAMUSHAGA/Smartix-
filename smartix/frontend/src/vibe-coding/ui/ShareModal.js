/**
 * ShareModal — Partage en lecture seule d'un projet
 *
 * Fonctionnalités :
 * - Génération d'un lien de partage read-only
 * - Copie dans le presse-papier
 * - QR Code du lien
 * - Option d'expiration (1h / 24h / permanent)
 * - Révocation du lien
 */

import React, { useState, useCallback } from 'react';

const API_BASE = '/api/share';

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  modal: {
    background: '#1e1e2e', border: '1px solid #3d3d5c', borderRadius: 14,
    padding: '28px 32px', width: 460, maxWidth: '95vw',
    color: '#cdd6f4', fontFamily: 'monospace', boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
  },
  title: { margin: '0 0 6px', fontSize: 20, color: '#f5c2e7' },
  subtitle: { margin: '0 0 24px', fontSize: 13, color: '#6c7086' },
  label: { display: 'block', fontSize: 12, color: '#a6adc8', marginBottom: 8 },
  select: {
    width: '100%', background: '#313244', border: '1px solid #45475a', borderRadius: 6,
    padding: '10px 12px', color: '#cdd6f4', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', marginBottom: 16, cursor: 'pointer',
  },
  urlBox: {
    display: 'flex', gap: 8, marginBottom: 16, alignItems: 'stretch',
  },
  urlInput: {
    flex: 1, background: '#181825', border: '1px solid #45475a', borderRadius: 6,
    padding: '10px 12px', color: '#89b4fa', fontSize: 12, outline: 'none',
    fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  btn: { padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnPrimary: { background: '#f5c2e7', color: '#1e1e2e', width: '100%' },
  btnCopy: { background: '#45475a', color: '#cdd6f4' },
  btnDanger: { background: '#f38ba820', color: '#f38ba8', border: '1px solid #f38ba8', width: '100%', marginTop: 8 },
  btnClose: { background: '#313244', color: '#cdd6f4', border: '1px solid #45475a', width: '100%', marginTop: 8 },
  alert: { background: '#f38ba820', border: '1px solid #f38ba8', borderRadius: 6, padding: 12, marginBottom: 14, color: '#f38ba8', fontSize: 13 },
  infoBox: {
    background: '#313244', borderRadius: 8, padding: '12px 14px', marginBottom: 16,
    fontSize: 12, color: '#a6adc8', lineHeight: 1.6,
  },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  badge: { background: '#a6e3a1', color: '#1e1e2e', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  copied: { color: '#a6e3a1', fontSize: 12, marginTop: 6, textAlign: 'center' },
};

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ShareModal({ projectId, projectName, onClose, authToken }) {
  const [expiresIn, setExpiresIn]   = useState('');    // '' = permanent, '3600', '86400'
  const [step, setStep]             = useState('form'); // form | loading | shared | error
  const [error, setError]           = useState('');
  const [shareData, setShareData]   = useState(null);
  const [copied, setCopied]         = useState(false);

  // ── Créer le lien ─────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setError('');
    setStep('loading');
    try {
      const resp = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          project_id:   projectId,
          project_name: projectName,
          expires_in:   expiresIn ? parseInt(expiresIn, 10) : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Erreur création lien');
      setShareData(data);
      setStep('shared');
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  }, [projectId, projectName, expiresIn, authToken]);

  // ── Révoquer le lien ──────────────────────────────────────────────────

  const handleRevoke = useCallback(async () => {
    if (!shareData?.share_token) return;
    try {
      await fetch(`${API_BASE}/${shareData.share_token}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setShareData(null);
      setStep('form');
    } catch (e) {
      setError("Erreur lors de la révocation");
    }
  }, [shareData, authToken]);

  // ── Copier dans le presse-papier ───────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (!shareData?.share_url) return;
    navigator.clipboard.writeText(shareData.share_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareData]);

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        <h2 style={st.title}>🔗 Partager le projet</h2>
        <p style={st.subtitle}>{projectName || projectId} — aperçu en lecture seule</p>

        {error && <div style={st.alert}>⚠️ {error}</div>}

        {/* Formulaire initial */}
        {(step === 'form' || step === 'error') && (
          <>
            <div style={st.infoBox}>
              <strong style={{ color: '#cdd6f4' }}>👁 Accès lecture seule</strong><br />
              Les visiteurs pourront voir le code et l'aperçu, mais pas modifier le projet.
            </div>

            <label style={st.label}>Expiration du lien</label>
            <select style={st.select} value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}>
              <option value="">Permanent (pas d'expiration)</option>
              <option value="3600">1 heure</option>
              <option value="86400">24 heures</option>
              <option value="604800">7 jours</option>
              <option value="2592000">30 jours</option>
            </select>

            <button style={{ ...st.btn, ...st.btnPrimary }} onClick={handleCreate}>
              🔗 Générer le lien
            </button>
            <button style={{ ...st.btn, ...st.btnClose }} onClick={onClose}>Annuler</button>
          </>
        )}

        {step === 'loading' && (
          <p style={{ color: '#a6adc8', textAlign: 'center' }}>Génération du lien…</p>
        )}

        {/* Lien généré */}
        {step === 'shared' && shareData && (
          <>
            <div style={st.infoBox}>
              <div style={st.row}>
                <span>Statut</span>
                <span style={st.badge}>Actif</span>
              </div>
              {shareData.expires_at && (
                <div style={st.row}>
                  <span>Expiration</span>
                  <span>{new Date(shareData.expires_at * 1000).toLocaleString()}</span>
                </div>
              )}
            </div>

            <label style={st.label}>URL de partage</label>
            <div style={st.urlBox}>
              <div style={st.urlInput}>{shareData.share_url}</div>
              <button style={{ ...st.btn, ...st.btnCopy }} onClick={handleCopy}>
                {copied ? '✅' : '📋'}
              </button>
            </div>
            {copied && <p style={st.copied}>✅ Copié dans le presse-papier !</p>}

            {/* QR Code via service externe */}
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shareData.share_url)}`}
                alt="QR Code"
                style={{ borderRadius: 8 }}
              />
            </div>

            <button style={{ ...st.btn, ...st.btnDanger }} onClick={handleRevoke}>
              🗑 Révoquer ce lien
            </button>
            <button style={{ ...st.btn, ...st.btnClose }} onClick={onClose}>Fermer</button>
          </>
        )}
      </div>
    </div>
  );
}
