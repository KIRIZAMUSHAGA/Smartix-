/**
 * generateTests - Génération de tests unitaires via IA
 * Sprint 2 : action Monaco clic droit → génère les tests, affiche dans un modal
 *
 * Supporte : Jest (JS/TS), pytest (Python), et autres
 */

import React, { useState } from 'react';

// =============================
// API CALL
// =============================

export const generateTests = async (code, language, context = '') => {
  const response = await fetch('/api/ai/generate-tests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language, context }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Erreur ${response.status}`);
  }

  return response.json();
};

// =============================
// MODAL DE RÉSULTAT
// =============================

export const GenerateTestsModal = ({ result, language, onClose, onCreateFile }) => {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.tests);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span style={{ fontSize: 18 }}>🧪</span>
            <span>Tests générés — {result.framework}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={styles.badge}>{result.filename}</span>
            <button style={styles.iconBtn} onClick={onClose} title="Fermer">✕</button>
          </div>
        </div>

        {/* Code des tests */}
        <div style={styles.codeContainer}>
          <pre style={styles.code}>{result.tests}</pre>
        </div>

        {/* Actions */}
        <div style={styles.footer}>
          <button style={styles.btnSecondary} onClick={handleCopy}>
            {copied ? '✅ Copié !' : '📋 Copier'}
          </button>
          <button
            style={styles.btnPrimary}
            onClick={() => onCreateFile?.(result.filename, result.tests)}
          >
            📄 Créer le fichier de test
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================
// ENREGISTREMENT ACTION MONACO
// =============================

/**
 * Enregistre l'action "Générer les tests unitaires" dans le menu contextuel Monaco.
 * @param {object} editor - Instance Monaco editor
 * @param {object} monaco - Namespace Monaco
 * @param {function} onResult - (result) => void appelé avec le résultat
 */
export const registerGenerateTestsAction = (editor, monaco, onResult) => {
  editor.addAction({
    id: 'vibe-generate-tests',
    label: '🧪 Générer les tests unitaires',
    contextMenuGroupId: 'vibe-ai',
    contextMenuOrder: 1,
    run: async (ed) => {
      const selection = ed.getSelection();
      const model = ed.getModel();
      if (!model) return;

      // Récupérer la sélection ou la fonction sous le curseur
      let code;
      if (!selection.isEmpty()) {
        code = model.getValueInRange(selection);
      } else {
        // Prendre les 50 lignes autour du curseur
        const line = selection.startLineNumber;
        const start = Math.max(1, line - 10);
        const end = Math.min(model.getLineCount(), line + 40);
        code = model.getValueInRange({
          startLineNumber: start, startColumn: 1,
          endLineNumber: end, endColumn: model.getLineMaxColumn(end)
        });
      }

      const language = model.getLanguageId?.() || 'javascript';
      const context = model.getValue().substring(0, 1500);

      onResult({ status: 'loading' });

      try {
        const result = await generateTests(code, language, context);
        onResult({ status: 'success', result });
      } catch (err) {
        onResult({ status: 'error', error: err.message });
      }
    }
  });
};

// =============================
// STYLES
// =============================

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#1e1e1e',
    border: '1px solid #3e3e3e',
    borderRadius: 8,
    width: 680,
    maxWidth: '92vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3e3e3e',
    flexShrink: 0,
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  badge: {
    background: '#007bff22',
    border: '1px solid #007bff44',
    borderRadius: 4,
    padding: '2px 8px',
    color: '#7bb3ff',
    fontSize: 12,
  },
  iconBtn: {
    background: 'none', border: 'none', color: '#aaa',
    cursor: 'pointer', fontSize: 16, padding: '2px 6px',
  },
  codeContainer: {
    flex: 1,
    overflowY: 'auto',
    background: '#0d0d0d',
  },
  code: {
    margin: 0,
    padding: 16,
    fontSize: 12,
    fontFamily: 'Consolas, "Courier New", monospace',
    color: '#d4d4d4',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    gap: 10,
    padding: '12px 16px',
    background: '#252525',
    borderTop: '1px solid #3e3e3e',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  btnPrimary: {
    background: '#007bff',
    border: 'none',
    borderRadius: 5,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    padding: '7px 16px',
    fontWeight: 'bold',
  },
  btnSecondary: {
    background: '#3e3e3e',
    border: 'none',
    borderRadius: 5,
    color: '#d4d4d4',
    cursor: 'pointer',
    fontSize: 13,
    padding: '7px 14px',
  },
};

export default generateTests;
