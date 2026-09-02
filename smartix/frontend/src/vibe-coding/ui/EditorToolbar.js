/**
 * EditorToolbar - Barre d'outils de l'éditeur avec bouton "Publier"
 * Intègre le formulaire de publication via un modal
 */

import React, { useState } from 'react';

// =============================
// MODAL DE PUBLICATION
// =============================

const PublishModal = ({ onClose, onPublish }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    tags: '',
    visibility: 'public',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await onPublish?.({
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        publishedAt: new Date().toISOString(),
      });

      setSuccess(true);
      setTimeout(() => {
        onClose?.();
        if (result?.redirectUrl) {
          window.location.href = result.redirectUrl;
        }
      }, 2000);
    } catch (e) {
      setError(e?.message || 'Erreur lors de la publication');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  if (success) {
    return (
      <div style={styles.overlay} onClick={handleBackdrop}>
        <div style={styles.modal}>
          <div style={styles.successView}>
            <div style={styles.successIcon}>🚀</div>
            <div style={styles.successTitle}>Publié avec succès !</div>
            <div style={styles.successSub}>Redirection vers la marketplace…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} onClick={handleBackdrop}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span>🚀</span>
            <span>Publier sur la Marketplace</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Titre *</label>
            <input
              style={styles.input}
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Nom de votre application"
              required
              autoFocus
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Décrivez ce que fait votre application…"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Tags (séparés par des virgules)</label>
            <input
              style={styles.input}
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="react, dashboard, analytics"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Visibilité</label>
            <select
              style={styles.select}
              name="visibility"
              value={form.visibility}
              onChange={handleChange}
            >
              <option value="public">🌍 Public</option>
              <option value="private">🔒 Privé</option>
              <option value="unlisted">🔗 Non listé</option>
            </select>
          </div>

          {error && <div style={styles.error}>⚠️ {error}</div>}

          <div style={styles.formFooter}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              style={{ ...styles.submitBtn, opacity: submitting || !form.title.trim() ? 0.6 : 1 }}
              disabled={submitting || !form.title.trim()}
            >
              {submitting ? '⏳ Publication…' : '🚀 Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================
// BARRE D'OUTILS ÉDITEUR
// =============================

const EditorToolbar = ({
  filePath,
  isDirty,
  isFixing,
  language,
  contentLength,
  debugStats,
  lastError,
  onSave,
  onFormat,
  onSearch,
  onTriggerSuggest,
  onToggleDebug,
  onPublish,
  onOpenEnvPanel,
  onOpenSearchPanel,
  onOpenLessons,
  debugEnabled,
}) => {
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePublish = async (data) => {
    if (onPublish) {
      return onPublish(data);
    }
    await new Promise(r => setTimeout(r, 1200));
    showToast('Application publiée sur la marketplace !');
    return { redirectUrl: '/marketplace' };
  };

  return (
    <>
      <div style={styles.toolbar}>
        {/* Info fichier */}
        <div style={styles.fileInfo}>
          <span style={styles.fileIcon}>📄</span>
          <span style={styles.filePath}>{filePath || 'Aucun fichier'}</span>
          {isDirty && <span style={styles.dirtyDot}>●</span>}
          {isFixing && <span style={styles.fixingIndicator}>🔧 IA…</span>}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            onClick={onSave}
            disabled={!isDirty}
            style={{ ...styles.btn, opacity: !isDirty ? 0.4 : 1 }}
            title="Sauvegarder (Ctrl+S)"
          >
            💾
          </button>
          <button onClick={onFormat} style={styles.btn} title="Formater (Ctrl+Shift+F)">✨</button>
          <button onClick={onOpenSearchPanel || onSearch} style={styles.btn} title="Recherche multi-fichiers (Ctrl+Shift+F)">🔍</button>
          <button onClick={onTriggerSuggest} style={styles.btn} title="Auto-complétion (Ctrl+Space)">💡</button>

          <div style={styles.separator} />

          <button
            onClick={onOpenEnvPanel}
            style={styles.btn}
            title="Variables d'environnement"
          >
            🔑
          </button>
          <button
            onClick={onOpenLessons}
            style={styles.btn}
            title="Leçons guidées"
          >
            📖
          </button>

          <div style={styles.separator} />

          {/* Bouton Publier */}
          <button
            style={styles.publishBtn}
            onClick={() => setShowPublishModal(true)}
            title="Publier sur la Marketplace"
          >
            🚀 Publier
          </button>

          {debugEnabled && (
            <button
              onClick={onToggleDebug}
              style={{
                ...styles.btn,
                background: lastError ? '#c0392b' : '#6a1b9a',
                animation: lastError ? 'pulse 2s infinite' : 'none',
              }}
              title="Débogage IA"
            >
              🐛
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'error' ? '#c0392b' : '#27ae60' }}>
          {toast.msg}
        </div>
      )}

      {/* Modal de publication */}
      {showPublishModal && (
        <PublishModal
          onClose={() => setShowPublishModal(false)}
          onPublish={handlePublish}
        />
      )}
    </>
  );
};

// =============================
// STYLES
// =============================
const styles = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 14px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3e3e3e',
    position: 'relative',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#fff',
    fontSize: 13,
  },
  fileIcon: { fontSize: 15 },
  filePath: {
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  dirtyDot: { color: '#ffa500', fontSize: 10 },
  fixingIndicator: { color: '#2196f3', fontSize: 12 },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  btn: {
    padding: '4px 8px',
    background: '#3e3e3e',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    transition: 'background 0.2s',
  },
  separator: {
    width: 1,
    height: 18,
    background: '#4e4e4e',
    margin: '0 2px',
  },
  publishBtn: {
    padding: '5px 12px',
    background: '#007bff',
    border: 'none',
    borderRadius: 5,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    transition: 'background 0.2s',
  },
  toast: {
    position: 'fixed',
    bottom: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 24px',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    zIndex: 3000,
    whiteSpace: 'nowrap',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: '#1e1e1e',
    border: '1px solid #3e3e3e',
    borderRadius: 10,
    width: 500,
    maxWidth: '92vw',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
    overflow: 'hidden',
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
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 16,
  },
  form: {
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    background: '#2d2d2d',
    border: '1px solid #3e3e3e',
    borderRadius: 5,
    color: '#d4d4d4',
    fontSize: 13,
    padding: '8px 10px',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  select: {
    background: '#2d2d2d',
    border: '1px solid #3e3e3e',
    borderRadius: 5,
    color: '#d4d4d4',
    fontSize: 13,
    padding: '8px 10px',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
  },
  error: {
    color: '#f44336',
    fontSize: 13,
    padding: '6px 8px',
    background: '#2d0000',
    borderRadius: 4,
  },
  formFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 4,
  },
  cancelBtn: {
    background: '#3e3e3e',
    border: 'none',
    borderRadius: 6,
    color: '#d4d4d4',
    cursor: 'pointer',
    fontSize: 13,
    padding: '8px 16px',
  },
  submitBtn: {
    background: '#007bff',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 'bold',
    padding: '8px 20px',
    transition: 'opacity 0.2s',
  },
  successView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 12,
  },
  successIcon: { fontSize: 52 },
  successTitle: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  successSub: { color: '#888', fontSize: 13 },
};

export default EditorToolbar;
