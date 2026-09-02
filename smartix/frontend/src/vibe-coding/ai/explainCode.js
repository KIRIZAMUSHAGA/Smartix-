/**
 * explainCode - Service IA pour expliquer du code sélectionné
 * Appelle le backend proxy OpenAI via POST /api/ai/explain
 * Intégration Monaco : menu contextuel "Expliquer ce code"
 */

// =============================
// SERVICE D'EXPLICATION
// =============================

/**
 * Appelle l'API backend pour expliquer un extrait de code
 * @param {string} code - Le code à expliquer
 * @param {string} language - Le langage du code (ex: javascript)
 * @returns {Promise<string>} L'explication en français
 */
export const explainCode = async (code, language = 'javascript') => {
  try {
    const response = await fetch('/api/ai/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erreur serveur ${response.status}`);
    }

    const data = await response.json();
    return data.explanation || data.content || 'Aucune explication disponible.';
  } catch (error) {
    if (error.message.includes('fetch')) {
      return explainCodeFallback(code, language);
    }
    throw error;
  }
};

/**
 * Fallback : explication simplifiée sans serveur
 */
const explainCodeFallback = async (code, language) => {
  const lines = code.split('\n').length;
  const hasFunction = /function|=>|def |fn |func /.test(code);
  const hasLoop = /for |while |forEach|map\(|filter\(/.test(code);
  const hasCondition = /if |else |switch |ternary|\?/.test(code);
  const hasClass = /class |struct |interface /.test(code);
  const hasAsync = /async|await|Promise|then\(/.test(code);

  const parts = [
    `Ce fragment de code ${language} contient **${lines} ligne(s)**.`,
  ];

  if (hasClass) parts.push('- Il définit une **classe ou une structure de données**.');
  if (hasFunction) parts.push('- Il contient une ou plusieurs **fonctions** ou méthodes.');
  if (hasAsync) parts.push('- Il utilise de la **programmation asynchrone** (async/await ou Promises).');
  if (hasLoop) parts.push('- Il comporte des **boucles** pour itérer sur des données.');
  if (hasCondition) parts.push('- Il inclut des **conditions** pour contrôler le flux d\'exécution.');

  parts.push('\n*(Explication générée localement — connectez un backend OpenAI pour une analyse détaillée)*');

  return parts.join('\n');
};

// =============================
// MODAL D'EXPLICATION
// =============================

import React, { useState } from 'react';

export const ExplainCodeModal = ({ code, language, onClose }) => {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await explainCode(code, language);
        setExplanation(result);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [code, language]);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div style={styles.overlay} onClick={handleBackdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span>🤖</span>
            <span>Explication du code</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.codePreview}>
          <pre style={styles.code}>{code.length > 300 ? code.slice(0, 300) + '…' : code}</pre>
        </div>

        <div style={styles.body}>
          {loading && (
            <div style={styles.loading}>
              <div style={styles.spinner} />
              <span>Analyse en cours...</span>
            </div>
          )}
          {error && <div style={styles.error}>⚠️ {error}</div>}
          {explanation && !loading && (
            <div style={styles.explanation}>
              {explanation.split('\n').map((line, i) => {
                const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                return (
                  <p
                    key={i}
                    style={{ margin: '4px 0' }}
                    dangerouslySetInnerHTML={{ __html: bold }}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.closeButtonFull} onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

// =============================
// ENREGISTREMENT DANS MONACO
// =============================

/**
 * Enregistre l'action "Expliquer ce code" dans un éditeur Monaco.
 * @param {object} editor - Instance Monaco editor
 * @param {object} monaco - Namespace Monaco
 * @param {function} onExplain - Callback(code, language) appelé pour afficher le modal
 */
export const registerExplainAction = (editor, monaco, onExplain) => {
  editor.addAction({
    id: 'vibe-explain-code',
    label: '🤖 Expliquer ce code',
    contextMenuGroupId: 'vibe-ai',
    contextMenuOrder: 1,
    run: (ed) => {
      const selection = ed.getSelection();
      const model = ed.getModel();
      if (!selection || !model) return;

      const selectedText = model.getValueInRange(selection);
      if (!selectedText.trim()) return;

      const languageId = model.getLanguageId?.() || model.getModeId?.() || 'javascript';
      onExplain(selectedText, languageId);
    },
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
    zIndex: 2000,
  },
  modal: {
    background: '#1e1e1e',
    border: '1px solid #3e3e3e',
    borderRadius: 10,
    width: 560,
    maxWidth: '92vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3e3e3e',
    flexShrink: 0,
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
  codePreview: {
    background: '#252525',
    borderBottom: '1px solid #3e3e3e',
    padding: '8px 16px',
    flexShrink: 0,
    maxHeight: 120,
    overflow: 'auto',
  },
  code: {
    margin: 0,
    color: '#9cdcfe',
    fontFamily: 'monospace',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#aaa',
    fontSize: 14,
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid #3e3e3e',
    borderTopColor: '#007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    color: '#f44336',
    fontSize: 13,
    padding: 8,
  },
  explanation: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 1.7,
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #3e3e3e',
    display: 'flex',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  closeButtonFull: {
    background: '#3e3e3e',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    padding: '7px 20px',
  },
};

export default explainCode;
