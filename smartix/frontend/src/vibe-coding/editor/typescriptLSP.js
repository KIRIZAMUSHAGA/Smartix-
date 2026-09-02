/**
 * typescriptLSP - Support TypeScript avancé dans Monaco Editor
 * Sprint 2 : diagnostics de types en temps réel, autocomplétion enrichie
 *
 * Utilise les workers TypeScript intégrés dans Monaco (sans serveur externe).
 * Fonctionne pour .ts, .tsx, .js (avec JSDoc types).
 */

// =============================
// CONFIGURATION COMPILATEUR TS
// =============================

/**
 * Configure le compilateur TypeScript intégré à Monaco.
 * Activer les diagnostics de types, les suggestions, JSDoc.
 */
export const configureTypeScriptDefaults = (monaco) => {
  if (!monaco?.languages?.typescript) return;

  const tsDefaults = monaco.languages.typescript.typescriptDefaults;
  const jsDefaults = monaco.languages.typescript.javascriptDefaults;

  const commonOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    allowJs: true,
    checkJs: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: false,
    resolveJsonModule: true,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  };

  tsDefaults.setCompilerOptions(commonOptions);
  jsDefaults.setCompilerOptions({ ...commonOptions, noImplicitAny: false });

  // Activer les diagnostics en temps réel
  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
    diagnosticCodesToIgnore: [
      // Ignorer les erreurs "cannot find module" pour les imports non résolus
      2307, 2304, 7016,
    ],
  });

  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
    diagnosticCodesToIgnore: [2307, 2304, 7016],
  });

  // Activer l'autocomplétion enrichie (mode eager)
  tsDefaults.setEagerModelSync(true);
  jsDefaults.setEagerModelSync(true);
};

// =============================
// DÉFINITIONS DE TYPES COMMUNS
// =============================

/**
 * Ajoute des définitions de types pour les librairies communes.
 * Injecté comme fichier virtuel dans Monaco.
 */
const COMMON_TYPE_DEFS = `
// React
declare module 'react' {
  export function useState<T>(initial: T): [T, (val: T | ((prev: T) => T)) => void];
  export function useEffect(fn: () => void | (() => void), deps?: unknown[]): void;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: unknown[]): T;
  export function useMemo<T>(fn: () => T, deps: unknown[]): T;
  export function useRef<T>(initial?: T): { current: T };
  export function useContext<T>(ctx: React.Context<T>): T;
  export function createContext<T>(defaultValue: T): React.Context<T>;
  export interface Context<T> { Provider: any; Consumer: any; }
  export type FC<P = {}> = (props: P) => JSX.Element | null;
  export namespace JSX { interface Element {} }
  export default React;
  const React: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useCallback: typeof useCallback;
    useMemo: typeof useMemo;
    useRef: typeof useRef;
  };
}

// Types utilitaires courants
type Nullable<T> = T | null;
type Optional<T> = T | undefined;
type ID = string | number;
type Dict<T = unknown> = Record<string, T>;
type AsyncFn<T = void> = () => Promise<T>;
type Callback<T = void> = (value: T) => void;
type EventHandler<E = Event> = (event: E) => void;
`;

/**
 * Injecte les définitions de types communs dans Monaco.
 */
export const injectCommonTypeDefs = (monaco) => {
  if (!monaco?.languages?.typescript) return;

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    COMMON_TYPE_DEFS,
    'ts:///smartix-common-types.d.ts'
  );
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    COMMON_TYPE_DEFS,
    'ts:///smartix-common-types.d.ts'
  );
};

// =============================
// HOVER ENRICHI (types)
// =============================

/**
 * Fournisseur de hover enrichi pour afficher le type d'une expression.
 * Monaco fournit déjà cela pour TS nativement — ce fournisseur l'enrichit
 * avec des exemples et des docs.
 */
export const registerHoverEnhancement = (monaco) => {
  // Monaco gère déjà le hover TypeScript nativement.
  // On enregistre uniquement pour les langages non-TS.
  return monaco.languages.registerHoverProvider('json', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const jsonKeys = {
        dependencies: { info: 'Dépendances NPM requises pour la production.' },
        devDependencies: { info: 'Dépendances de développement uniquement.' },
        scripts: { info: 'Scripts NPM définis dans package.json.' },
        version: { info: 'Version sémantique (semver) du paquet.' },
        main: { info: 'Point d\'entrée principal du module.' },
      };

      const hint = jsonKeys[word.word];
      if (!hint) return null;

      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: `**${word.word}** — ${hint.info}` }],
      };
    }
  });
};

// =============================
// DIAGNOSTICS OVERLAY CUSTOM
// =============================

/**
 * Gestion des markers Monaco pour montrer les erreurs TS avec style amélioré.
 * Monaco gère déjà les diagnostics TS nativement — cette fonction
 * ajoute des markers supplémentaires depuis une source externe.
 *
 * @param {object} monaco
 * @param {object} model - Monaco model
 * @param {object[]} errors - [{ line, column, message, severity }]
 */
export const applyCustomDiagnostics = (monaco, model, errors = []) => {
  if (!model) return;

  const markers = errors.map(err => ({
    severity: err.severity === 'error'
      ? monaco.MarkerSeverity.Error
      : err.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Info,
    message: err.message,
    startLineNumber: err.line || 1,
    startColumn: err.column || 1,
    endLineNumber: err.line || 1,
    endColumn: (err.column || 1) + (err.length || 10),
    source: 'Smartix LSP',
  }));

  monaco.editor.setModelMarkers(model, 'vibe-lsp', markers);
};

// =============================
// AUTO-COMPLÉTION ENRICHIE
// =============================

/**
 * Enregistre des snippets et suggestions pour les frameworks courants.
 */
export const registerFrameworkSnippets = (monaco) => {
  const reactSnippets = [
    {
      label: 'rfc',
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: 'Composant React fonctionnel',
      insertText: [
        'import React from \'react\';',
        '',
        'const ${1:MonComposant} = () => {',
        '  return (',
        '    <div>',
        '      ${2:contenu}',
        '    </div>',
        '  );',
        '};',
        '',
        'export default ${1:MonComposant};',
      ].join('\n'),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    },
    {
      label: 'useState',
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: 'Hook useState React',
      insertText: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:null});',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    },
    {
      label: 'useEffect',
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: 'Hook useEffect React',
      insertText: 'useEffect(() => {\n  ${1:// effet}\n  return () => {\n    ${2:// nettoyage}\n  };\n}, [${3:deps}]);',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    },
    {
      label: 'useCallback',
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: 'Hook useCallback React',
      insertText: 'const ${1:handler} = useCallback(${2:async} (${3:params}) => {\n  ${4:// logique}\n}, [${5:deps}]);',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    },
  ];

  const provider = {
    provideCompletionItems: (model, position) => {
      const language = model.getLanguageId();
      if (!['javascript', 'typescript'].includes(language)) return { suggestions: [] };

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      return {
        suggestions: reactSnippets.map(s => ({ ...s, range })),
      };
    }
  };

  return monaco.languages.registerCompletionItemProvider('javascript', provider);
};

// =============================
// INITIALISATION COMPLÈTE
// =============================

/**
 * Point d'entrée principal : configure tout le LSP TypeScript pour Monaco.
 * Appeler une seule fois après le chargement de Monaco.
 *
 * @param {object} monaco - Namespace Monaco
 * @returns {function} dispose - Nettoyage
 */
export const initTypeScriptLSP = (monaco) => {
  if (!monaco) return () => {};

  const disposables = [];

  try {
    configureTypeScriptDefaults(monaco);
    injectCommonTypeDefs(monaco);

    const hoverDisposable = registerHoverEnhancement(monaco);
    if (hoverDisposable) disposables.push(hoverDisposable);

    const snippetDisposable = registerFrameworkSnippets(monaco);
    if (snippetDisposable) disposables.push(snippetDisposable);

    console.log('✅ [TypeScript LSP] Initialisé — diagnostics, hover, snippets actifs');
  } catch (err) {
    console.warn('[TypeScript LSP] Initialisation partielle :', err.message);
  }

  return () => {
    disposables.forEach(d => {
      try { d.dispose(); } catch { /* ignore */ }
    });
  };
};

export default initTypeScriptLSP;
