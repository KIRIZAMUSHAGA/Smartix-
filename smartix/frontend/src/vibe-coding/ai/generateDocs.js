/**
 * generateDocs - Génération automatique de documentation (JSDoc / docstrings)
 * Sprint 2 : clic droit dans Monaco → génère et insère la doc directement
 */

// =============================
// API CALL
// =============================

export const generateDocs = async (code, language, context = '') => {
  const response = await fetch('/api/ai/generate-docs', {
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
// DÉTECTION DE LA FONCTION COURANTE
// =============================

/**
 * Extrait la fonction/méthode sous le curseur dans Monaco.
 */
const extractFunctionAtCursor = (editor) => {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model) return null;

  if (!selection.isEmpty()) {
    return {
      code: model.getValueInRange(selection),
      startLine: selection.startLineNumber,
    };
  }

  // Chercher le début de la fonction (en remontant)
  const cursorLine = selection.startLineNumber;
  const JS_FUNC_START = /^(\s*)(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*(async\s+)?(\(|function)|export\s+(default\s+)?(async\s+)?function|\w+\s*\(.*\)\s*\{?|def\s+\w+\s*\(|class\s+\w+)/;

  let startLine = cursorLine;
  for (let i = cursorLine; i >= Math.max(1, cursorLine - 20); i--) {
    const line = model.getLineContent(i);
    if (JS_FUNC_START.test(line)) {
      startLine = i;
      break;
    }
  }

  // Aller jusqu'à la fin (accolades ou indentation)
  let endLine = Math.min(model.getLineCount(), startLine + 60);

  const code = model.getValueInRange({
    startLineNumber: startLine, startColumn: 1,
    endLineNumber: endLine, endColumn: model.getLineMaxColumn(endLine)
  });

  return { code, startLine };
};

// =============================
// ENREGISTREMENT ACTION MONACO
// =============================

/**
 * Enregistre l'action "Générer la documentation" dans le menu contextuel.
 * Insère la doc directement au-dessus de la fonction dans l'éditeur.
 */
export const registerGenerateDocsAction = (editor, monaco, onStatus) => {
  editor.addAction({
    id: 'vibe-generate-docs',
    label: '📚 Générer la documentation',
    contextMenuGroupId: 'vibe-ai',
    contextMenuOrder: 2,
    run: async (ed) => {
      const extracted = extractFunctionAtCursor(ed);
      if (!extracted) return;

      const { code, startLine } = extracted;
      const model = ed.getModel();
      const language = model?.getLanguageId?.() || 'javascript';
      const context = model?.getValue().substring(0, 1000) || '';

      onStatus?.({ status: 'loading', message: 'Génération de la documentation...' });

      try {
        const result = await generateDocs(code, language, context);
        const docComment = result.documentation;

        if (!docComment) {
          onStatus?.({ status: 'error', message: 'Pas de documentation générée' });
          return;
        }

        // Insérer le commentaire de doc au-dessus de la fonction
        const indentMatch = model.getLineContent(startLine).match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const docLines = docComment.split('\n').map(l => indent + l).join('\n');
        const insertText = docLines + '\n';

        ed.executeEdits('generate-docs', [{
          range: new monaco.Range(startLine, 1, startLine, 1),
          text: insertText,
          forceMoveMarkers: true,
        }]);

        onStatus?.({ status: 'success', message: 'Documentation insérée !' });
      } catch (err) {
        onStatus?.({ status: 'error', message: err.message });
      }
    }
  });
};

export default generateDocs;
