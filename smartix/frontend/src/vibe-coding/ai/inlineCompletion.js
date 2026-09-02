/**
 * inlineCompletion - Ghostwriter IA pour Monaco Editor
 * Sprint 2 : streaming SSE token par token, multi-langages
 *
 * - Suggestions inline en grisé, acceptées avec Tab
 * - Streaming depuis /api/ai/complete-stream
 * - Annulation si l'utilisateur continue de taper
 * - Fallback heuristique local si le backend est indisponible
 */

// =============================
// CONFIGURATION
// =============================

const DEBOUNCE_MS = 500;
const MIN_TRIGGER_LENGTH = 3;

let debounceTimer = null;

// =============================
// LANGUE → PROMPT HINTS
// =============================

const LANGUAGE_HINTS = {
  javascript: 'ES2022+, async/await, arrow functions',
  typescript: 'strict types, interfaces, generics',
  python: 'Python 3.10+, type hints, PEP 8',
  css: 'CSS3, custom properties, flexbox/grid',
  html: 'HTML5 sémantique, accessibilité ARIA',
  rust: 'Rust idiomatique, Result/Option',
  go: 'Go idiomatique, gofmt',
  java: 'Java 17+, records, clean code',
  php: 'PHP 8.2+, PSR-12',
  ruby: 'Ruby 3+, idiomatic blocks',
};

// =============================
// STREAMING SSE
// =============================

/**
 * Demande une complétion en streaming SSE.
 * Retourne le texte complet reconstruit + une méthode abort.
 * @param {string} prefix
 * @param {string} language
 * @param {function} onToken - appelé à chaque token reçu
 * @param {function} onDone - appelé à la fin
 * @returns {{ abort: function }}
 */
const fetchCompletionStream = (prefix, language, context, onToken, onDone) => {
  const controller = new AbortController();

  const run = async () => {
    try {
      const response = await fetch('/api/ai/complete-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, language, maxTokens: 100, context }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        onDone('');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            onDone(accumulated);
            return;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) { onDone(''); return; }
            if (parsed.token) {
              accumulated += parsed.token;
              onToken(parsed.token, accumulated);
            }
          } catch { /* ignore malformed chunk */ }
        }
      }
      onDone(accumulated);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Ghostwriter] Stream error, falling back:', err.message);
      }
      onDone('');
    }
  };

  run();
  return { abort: () => controller.abort() };
};

// =============================
// APPEL API NON-STREAMING (fallback)
// =============================

const fetchCompletion = async (prefix, language, context) => {
  try {
    const response = await fetch('/api/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, language, maxTokens: 80, context }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.completion || data.text || '';
  } catch {
    return getFallbackCompletion(prefix, language);
  }
};

// =============================
// FALLBACK HEURISTIQUE LOCAL
// =============================

const FALLBACK_PATTERNS = {
  javascript: [
    { test: /function\s+\w+\s*\([^)]*\)\s*\{?\s*$/, suggest: '\n  ' },
    { test: /const\s+\w+\s*=\s*$/, suggest: 'null;' },
    { test: /if\s*\([^)]*\)\s*\{?\s*$/, suggest: '\n  return;\n}' },
    { test: /=>\s*\{?\s*$/, suggest: '\n  return;\n};' },
    { test: /console\.$/, suggest: 'log(' },
    { test: /import\s+\{?\s*$/, suggest: ' } from \'\';' },
    { test: /useState\($/, suggest: 'null)' },
    { test: /useEffect\($/, suggest: '() => {\n  \n}, [])' },
    { test: /\.map\($/, suggest: '(item) => item)' },
    { test: /\.filter\($/, suggest: '(item) => item)' },
  ],
  python: [
    { test: /def\s+\w+\s*\([^)]*\)\s*:\s*$/, suggest: '\n    pass' },
    { test: /class\s+\w+.*:\s*$/, suggest: '\n    def __init__(self):\n        pass' },
    { test: /if\s+.*:\s*$/, suggest: '\n    pass' },
    { test: /for\s+.*:\s*$/, suggest: '\n    pass' },
    { test: /print\($/, suggest: '"hello")' },
    { test: /import\s+$/, suggest: 'os' },
  ],
  css: [
    { test: /\{\s*$/, suggest: '\n  ' },
    { test: /display:\s*$/, suggest: 'flex;' },
    { test: /color:\s*$/, suggest: '#' },
    { test: /margin:\s*$/, suggest: '0;' },
    { test: /padding:\s*$/, suggest: '0;' },
  ],
};

const getFallbackCompletion = (prefix, language) => {
  const lastLine = prefix.trimEnd().split('\n').pop();
  const patterns = FALLBACK_PATTERNS[language] || FALLBACK_PATTERNS.javascript;
  for (const { test, suggest } of (patterns || [])) {
    if (test.test(lastLine)) return suggest;
  }
  return '';
};

// =============================
// PROVIDER MONACO (streaming)
// =============================

let providerDisposable = null;
let activeStreamAbort = null;

/**
 * Enregistre le provider de complétion inline dans Monaco avec streaming.
 * @param {object} monaco
 * @param {string[]} languages
 */
export const registerInlineCompletionProvider = (
  monaco,
  languages = [
    'javascript', 'typescript', 'python', 'css', 'html',
    'json', 'rust', 'go', 'java', 'php', 'ruby', 'cpp'
  ]
) => {
  if (providerDisposable) {
    providerDisposable.dispose();
    providerDisposable = null;
  }

  const provider = {
    provideInlineCompletions: async (model, position, context, token) => {
      // Annuler le stream en cours si l'utilisateur a retapé
      if (activeStreamAbort) {
        activeStreamAbort();
        activeStreamAbort = null;
      }

      const prefix = model.getValueInRange({
        startLineNumber: Math.max(1, position.lineNumber - 30),
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      if (prefix.trimEnd().length < MIN_TRIGGER_LENGTH) {
        return { items: [] };
      }

      const language = model.getLanguageId?.() || 'javascript';

      // Debounce
      await new Promise((resolve) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(resolve, DEBOUNCE_MS);
      });

      if (token.isCancellationRequested) return { items: [] };

      // Contexte limité du fichier (30 lignes)
      const fileContext = model.getValue().substring(0, 2000);

      return new Promise((resolve) => {
        let completionText = '';

        const { abort } = fetchCompletionStream(
          prefix,
          language,
          fileContext,
          (_newToken, accumulated) => {
            if (token.isCancellationRequested) {
              abort();
              resolve({ items: [] });
            }
            completionText = accumulated;
          },
          (finalText) => {
            activeStreamAbort = null;
            if (!finalText || token.isCancellationRequested) {
              resolve({ items: [] });
              return;
            }
            resolve({
              items: [{
                insertText: finalText,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              }],
            });
          }
        );

        activeStreamAbort = abort;

        // Timeout de sécurité 8s
        setTimeout(() => {
          if (completionText) {
            abort();
            resolve({
              items: [{
                insertText: completionText,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              }],
            });
          } else {
            resolve({ items: [] });
          }
        }, 8000);
      });
    },
    freeInlineCompletions: () => {},
  };

  const disposables = [];
  for (const lang of languages) {
    try {
      const d = monaco.languages.registerInlineCompletionsProvider(lang, provider);
      disposables.push(d);
    } catch { /* ignore unsupported languages */ }
  }

  providerDisposable = { dispose: () => disposables.forEach(d => d.dispose()) };

  return () => {
    if (providerDisposable) {
      providerDisposable.dispose();
      providerDisposable = null;
    }
  };
};

export default registerInlineCompletionProvider;
