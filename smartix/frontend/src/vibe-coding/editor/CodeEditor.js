/**
 * Éditeur de code pour le module Vibe-Coding
 * 
 * Rôle: Interface d'édition de code
 * - Intégration avec Monaco Editor
 * - Coloration syntaxique
 * - Auto-complétion
 * - Gestion des onglets
 * - Sauvegarde automatique
 * - Débogage IA intégré
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { projectManager } from '../core/projectManager';
import { fileManager } from './fileManager';
import { autoSaveManager } from './autoSaveManager';
import { GitService } from '../services/gitService';

// =============================
// IMPORT DU DEBUG PANEL
// =============================
import { DebugPanel } from '../ui/DebugPanel';
import { runtimeDebugger } from '../runtime/RuntimeDebugger';
import { runtimeMonitor } from '../runtime/RuntimeMonitor';

// =============================
// IMPORT DES NOUVELLES FONCTIONNALITÉS
// =============================
import EditorToolbar from '../ui/EditorToolbar';
import EnvPanel from '../ui/EnvPanel';
import SearchPanel from '../ui/SearchPanel';
import LessonGuide from '../lessons/LessonGuide';
import { ExplainCodeModal, registerExplainAction } from '../ai/explainCode';
import { registerInlineCompletionProvider } from '../ai/inlineCompletion';
import { registerGenerateTestsAction, GenerateTestsModal } from '../ai/generateTests';
import { registerGenerateDocsAction } from '../ai/generateDocs';
import { initTypeScriptLSP } from './typescriptLSP';
import { useBreakpoints } from '../debugger/BreakpointManager';

// =============================
// CONFIGURATION
// =============================

// Extensions de fichiers et leurs langages
const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.md': 'markdown',
  '.py': 'python',
  '.rb': 'ruby',
  '.php': 'php',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.go': 'go',
  '.rs': 'rust'
};

// Thèmes de l'éditeur
const EDITOR_THEMES = {
  light: 'vs',
  dark: 'vs-dark',
  highContrast: 'hc-black'
};

// =============================
// COMPOSANT EDITOR
// =============================

/**
 * Éditeur de code principal
 */
export const CodeEditor = ({
  projectId,
  userId,
  filePath,
  onFileChange,
  onSave,
  onSelectionChange,
  onEditorReady,
  readOnly = false,
  theme = 'dark',
  fontSize = 14,
  tabSize = 2,
  wordWrap = 'on',
  showDebug = true // Nouvelle prop pour activer le débogage
}) => {
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState(null);
  const [editor, setEditor] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  
  // =============================
  // ÉTATS DE DÉBOGAGE
  // =============================
  const [debugEnabled, setDebugEnabled] = useState(showDebug);
  const [debugStats, setDebugStats] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [isFixing, setIsFixing] = useState(false);

  // =============================
  // ÉTATS DES NOUVEAUX PANNEAUX
  // =============================
  const [showEnvPanel, setShowEnvPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showLessons, setShowLessons] = useState(false);
  const [explainModal, setExplainModal] = useState(null); // { code, language }
  const [testsModal, setTestsModal] = useState(null);     // { status, result?, error? }
  const [docStatus, setDocStatus] = useState(null);       // { status, message }
  const [projectFiles, setProjectFiles] = useState({});
  
  // =============================
  // ÉTATS DIFF GIT
  // =============================
  const [gitDiff, setGitDiff] = useState([]); // [{type:'add'|'remove'|'replace', line:number}]
  const [diffPopup, setDiffPopup] = useState(null); // {line, oldContent, newContent, x, y}
  const gitServiceRef = useRef(null);
  const gitDecorationsRef = useRef([]);
  const monacoInstanceRef = useRef(null);

  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const monacoRef = useRef(null);
  const { breakpoints, debuggerConnected } = useBreakpoints(projectId, editor, {
    filePath,
    monaco: monacoInstanceRef.current,
    enabled: debugEnabled,
  });

  // =============================
  // INITIALISATION DU DÉBOGAGE
  // =============================
  useEffect(() => {
    if (!debugEnabled) return;

    // Initialiser le debugger
    runtimeDebugger.connect(runtimeMonitor);

    // Écouter les événements de débogage
    runtimeDebugger.on('error-detected', ({ error }) => {
      setLastError(error);
      // Optionnel: faire clignoter la ligne d'erreur
      if (editor && error.context?.line) {
        editor.revealLineInCenter(error.context.line);
        editor.setPosition({ lineNumber: error.context.line, column: 1 });
      }
    });

    runtimeDebugger.on('fix-start', () => {
      setIsFixing(true);
    });

    runtimeDebugger.on('fix-applied', ({ file, description }) => {
      setIsFixing(false);
      // Recharger le fichier si c'est le fichier courant
      if (file === filePath) {
        refreshFile();
      }
    });

    runtimeDebugger.on('fix-failed', () => {
      setIsFixing(false);
    });

    // Mettre à jour les stats périodiquement
    const statsInterval = setInterval(() => {
      setDebugStats(runtimeDebugger.getStats());
    }, 1000);

    return () => {
      clearInterval(statsInterval);
      runtimeDebugger.removeAllListeners();
    };
  }, [debugEnabled, editor, filePath]);

  // =============================
  // CHARGEMENT DE MONACO
  // =============================
  useEffect(() => {
    const loadMonaco = async () => {
      try {
        // Charger Monaco Editor dynamiquement
        const monaco = await import('@monaco-editor/react');
        monacoRef.current = monaco;
        
        // Configurer Monaco
        monacoRef.current.loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.34.0/min/vs' } });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erreur chargement Monaco:', error);
        setError('Impossible de charger l\'éditeur');
        setIsLoading(false);
      }
    };

    loadMonaco();
  }, []);

  // =============================
  // CHARGEMENT DU FICHIER
  // =============================
  useEffect(() => {
    const loadFile = async () => {
      if (!filePath || !projectId || !userId) return;

      try {
        setIsLoading(true);
        setError(null);

        const project = await projectManager.getProjectById(projectId, userId);
        if (!project) {
          throw new Error('Projet non trouvé');
        }

        const fileContent = project.files?.[filePath] || '';
        setContent(fileContent);
        setIsDirty(false);

        // Déterminer le langage
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        setLanguage(LANGUAGE_MAP[ext] || 'text');

      } catch (error) {
        console.error('Erreur chargement fichier:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [filePath, projectId, userId]);

  // =============================
  // RAFRAÎCHIR LE FICHIER
  // =============================
  const refreshFile = useCallback(async () => {
    if (!filePath || !projectId || !userId) return;

    try {
      const project = await projectManager.getProjectById(projectId, userId);
      if (project && editor) {
        const newContent = project.files?.[filePath] || '';
        if (editor.getValue() !== newContent) {
          editor.setValue(newContent);
          setIsDirty(false);
        }
      }
    } catch (error) {
      console.error('Erreur rafraîchissement fichier:', error);
    }
  }, [filePath, projectId, userId, editor]);

  // =============================
  // CHARGER LES FICHIERS DU PROJET POUR LA RECHERCHE
  // =============================
  useEffect(() => {
    const loadFiles = async () => {
      if (!projectId || !userId) return;
      try {
        const project = await projectManager.getProjectById(projectId, userId);
        if (project?.files) setProjectFiles(project.files);
      } catch { /* ignorer */ }
    };
    loadFiles();
  }, [projectId, userId]);

  // =============================
  // GIT DIFF — CHARGER ET APPLIQUER LES DÉCORATIONS
  // =============================

  useEffect(() => {
    const loadGitDiff = async () => {
      if (!projectId || !filePath) return;
      try {
        if (!gitServiceRef.current) {
          gitServiceRef.current = new GitService();
          await gitServiceRef.current.initialize();
        }
        const gs = gitServiceRef.current;
        if (!gs.isAvailable()) return;

        const log = await gs.log(projectId, { limit: 2 });
        if (log.length < 2) return;

        const result = await gs.diff(projectId, log[log.length - 1].hash, log[0].hash);
        const fileDiff = result.files.find(f => f.file === filePath);
        if (fileDiff) {
          setGitDiff(fileDiff.diff || []);
        } else {
          setGitDiff([]);
        }
      } catch {
        setGitDiff([]);
      }
    };
    loadGitDiff();
  }, [projectId, filePath, content]);

  const applyGitDecorations = useCallback((editorInstance, monacoInstance) => {
    if (!editorInstance || !monacoInstance || !monacoInstance.Range) return;

    const decorations = [];

    gitDiff.forEach(change => {
      if (change.type === 'add') {
        decorations.push({
          range: new monacoInstance.Range(change.line, 1, change.line, 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: 'git-gutter-added',
            overviewRuler: { color: '#28a745', position: monacoInstance.editor.OverviewRulerLane.Left },
          },
        });
      } else if (change.type === 'remove') {
        decorations.push({
          range: new monacoInstance.Range(Math.max(1, change.line), 1, Math.max(1, change.line), 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: 'git-gutter-removed',
            overviewRuler: { color: '#dc3545', position: monacoInstance.editor.OverviewRulerLane.Left },
          },
        });
      } else if (change.type === 'replace') {
        decorations.push({
          range: new monacoInstance.Range(change.newLine, 1, change.newLine, 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: 'git-gutter-modified',
            overviewRuler: { color: '#ffc107', position: monacoInstance.editor.OverviewRulerLane.Left },
          },
        });
      }
    });

    gitDecorationsRef.current = editorInstance.deltaDecorations(
      gitDecorationsRef.current,
      decorations
    );
  }, [gitDiff]);

  useEffect(() => {
    if (editor && monacoInstanceRef.current) {
      applyGitDecorations(editor, monacoInstanceRef.current);
    }
  }, [editor, gitDiff, applyGitDecorations]);

  // =============================
  // RACCOURCI CTRL+SHIFT+F — RECHERCHE MULTI-FICHIERS
  // =============================
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowSearchPanel(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // =============================
  // NAVIGATION DEPUIS LA RECHERCHE
  // =============================
  const handleSearchNavigate = useCallback((filePath, lineNumber) => {
    if (editor && filePath === (filePath)) {
      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();
    }
    setShowSearchPanel(false);
  }, [editor]);

  // =============================
  // INITIALISATION DE L'ÉDITEUR
  // =============================
  const handleEditorDidMount = useCallback((editor, monaco) => {
    // Stocker l'instance monaco pour les décorations git
    monacoInstanceRef.current = monaco;
    setEditor(editor);

    // Exposer l'instance de l'éditeur au parent (scroll vers une plage, etc.)
    if (typeof onEditorReady === 'function') {
      onEditorReady(editor, monaco);
    }

    // Enregistrer la complétion inline IA (Ghostwriter streaming)
    registerInlineCompletionProvider(monaco);

    // Initialiser le LSP TypeScript
    initTypeScriptLSP(monaco);

    // Enregistrer l'action "Expliquer ce code"
    registerExplainAction(editor, monaco, (code, language) => {
      setExplainModal({ code, language });
    });

    // Enregistrer l'action "Générer les tests unitaires"
    registerGenerateTestsAction(editor, monaco, (state) => {
      setTestsModal(state);
    });

    // Enregistrer l'action "Générer la documentation"
    registerGenerateDocsAction(editor, monaco, (state) => {
      setDocStatus(state);
      // Effacer le statut après 3 secondes
      if (state.status !== 'loading') {
        setTimeout(() => setDocStatus(null), 3000);
      }
    });

    // Remonter la sélection courante (pour le contexte de l'agent IA)
    const emitSelection = () => {
      if (typeof onSelectionChange !== 'function') return;
      try {
        const sel = editor.getSelection();
        const model = editor.getModel();
        if (!sel || !model) {
          onSelectionChange(null);
          return;
        }
        const selectedText = model.getValueInRange(sel) || '';
        if (!selectedText) {
          onSelectionChange(null);
          return;
        }
        onSelectionChange({
          file: filePath,
          language,
          range: {
            startLine: sel.startLineNumber,
            startColumn: sel.startColumn,
            endLine: sel.endLineNumber,
            endColumn: sel.endColumn,
          },
          text: selectedText,
          length: selectedText.length,
        });
      } catch (_) {
        // best-effort
      }
    };
    editor.onDidChangeCursorSelection(() => emitSelection());

    // Raccourci Ctrl+Shift+F dans Monaco
    editor.addAction({
      id: 'vibe-search-files',
      label: '🔍 Recherche multi-fichiers',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => setShowSearchPanel(prev => !prev),
    });

    // Configurer l'auto-complétion
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions = [
          {
            label: 'console.log',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'console.log(${1:});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Affiche un message dans la console',
            range
          },
          {
            label: 'function',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'function ${1:name}(${2:params}) {\n\t${3:}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Définition de fonction',
            range
          },
          {
            label: 'import',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'import ${1:name} from \'${2:module}\';',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Import ES6',
            range
          }
        ];

        return { suggestions };
      }
    });

    // Ajouter des actions personnalisées
    editor.addAction({
      id: 'save-file',
      label: 'Sauvegarder',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave()
    });

    editor.addAction({
      id: 'format-code',
      label: 'Formater le code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => handleFormat()
    });

    // Ajouter une action de débogage
    if (debugEnabled) {
      editor.addAction({
        id: 'debug-error',
        label: 'Analyser l\'erreur avec l\'IA',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD],
        run: () => {
          if (lastError) {
            runtimeDebugger.acceptFix();
          }
        }
      });
    }

    // Surveiller les changements
    editor.onDidChangeModelContent(() => {
      setIsDirty(true);
      onFileChange?.(editor.getValue());
    });
  }, [onFileChange, debugEnabled, lastError]);

  // =============================
  // SAUVEGARDE
  // =============================
  const handleSave = useCallback(async () => {
    if (!editor || !filePath || !projectId || !userId) return;

    try {
      const currentContent = editor.getValue();
      
      // Mettre à jour le projet
      const project = await projectManager.getProjectById(projectId, userId);
      if (!project) throw new Error('Projet non trouvé');

      await projectManager.updateProject(projectId, {
        files: {
          ...project.files,
          [filePath]: currentContent
        }
      }, userId);

      setIsDirty(false);
      onSave?.();
      
      console.log('✅ Fichier sauvegardé');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  }, [editor, filePath, projectId, userId, onSave]);

  // =============================
  // FORMATAGE
  // =============================
  const handleFormat = useCallback(async () => {
    if (!editor) return;

    try {
      await editor.getAction('editor.action.formatDocument').run();
    } catch (error) {
      console.error('Erreur formatage:', error);
    }
  }, [editor]);

  // =============================
  // RECHERCHE
  // =============================
  const handleSearch = useCallback(() => {
    if (!editor) return;
    editor.getAction('actions.find').run();
  }, [editor]);

  // =============================
  // AUTO-COMPLÉTION
  // =============================
  const handleTriggerSuggest = useCallback(() => {
    if (!editor) return;
    editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
  }, [editor]);

  // =============================
  // BASculer le débogage
  // =============================
  const toggleDebug = useCallback(() => {
    setDebugEnabled(prev => !prev);
  }, []);

  // =============================
  // NETTOYAGE
  // =============================
  useEffect(() => {
    return () => {
      if (editor) {
        editor.dispose();
      }
    };
  }, [editor]);

  // =============================
  // RENDU
  // =============================
  if (error) {
    return (
      <div className="code-editor-error">
        <div className="error-icon">⚠️</div>
        <div className="error-message">{error}</div>
        <button onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="code-editor-loading">
        <div className="spinner" />
        <div>Chargement de l'éditeur...</div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="code-editor-empty">
        <div className="empty-icon">📄</div>
        <div className="empty-message">Sélectionnez un fichier</div>
      </div>
    );
  }

  const MonacoEditor = monacoRef.current?.Editor;

  return (
    <div className="code-editor-container">
      {/* Barre d'outils enrichie */}
      <EditorToolbar
        filePath={filePath}
        isDirty={isDirty}
        isFixing={isFixing}
        language={language}
        contentLength={content.length}
        debugStats={debugStats}
        lastError={lastError}
        debugEnabled={debugEnabled}
        onSave={handleSave}
        onFormat={handleFormat}
        onSearch={handleSearch}
        onTriggerSuggest={handleTriggerSuggest}
        onToggleDebug={toggleDebug}
        onOpenEnvPanel={() => setShowEnvPanel(true)}
        onOpenSearchPanel={() => setShowSearchPanel(prev => !prev)}
        onOpenLessons={() => setShowLessons(prev => !prev)}
      />

      {/* Panneaux latéraux superposés */}
      {showEnvPanel && (
        <EnvPanel onClose={() => setShowEnvPanel(false)} />
      )}

      {/* Modal Expliquer le code */}
      {explainModal && (
        <ExplainCodeModal
          code={explainModal.code}
          language={explainModal.language}
          onClose={() => setExplainModal(null)}
        />
      )}

      {/* Modal Tests unitaires */}
      {testsModal && testsModal.status === 'success' && (
        <GenerateTestsModal
          result={testsModal.result}
          language={language}
          onClose={() => setTestsModal(null)}
          onCreateFile={(filename, code) => {
            // Ajouter le fichier au projet
            setProjectFiles(prev => ({ ...prev, [filename]: code }));
            setTestsModal(null);
          }}
        />
      )}

      {/* Toast statut génération tests / docs */}
      {(testsModal?.status === 'loading' || docStatus) && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1e1e1e', border: '1px solid #555',
          borderRadius: 8, padding: '10px 16px',
          color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          {testsModal?.status === 'loading' && (
            <span>⏳ Génération des tests en cours...</span>
          )}
          {testsModal?.status === 'error' && (
            <span style={{ color: '#f85149' }}>❌ {testsModal.error}</span>
          )}
          {docStatus?.status === 'loading' && (
            <span>⏳ {docStatus.message}</span>
          )}
          {docStatus?.status === 'success' && (
            <span style={{ color: '#3fb950' }}>✅ {docStatus.message}</span>
          )}
          {docStatus?.status === 'error' && (
            <span style={{ color: '#f85149' }}>❌ {docStatus.message}</span>
          )}
        </div>
      )}

      {/* Zone centrale : éditeur + panneaux latéraux */}
      <div className="editor-main-area">
        {/* Panneau de recherche multi-fichiers */}
        {showSearchPanel && (
          <div className="side-panel search-panel-container">
            <SearchPanel
              projectFiles={projectFiles}
              onNavigate={handleSearchNavigate}
              onClose={() => setShowSearchPanel(false)}
            />
          </div>
        )}

        {/* Éditeur Monaco */}
        <div className="editor-wrapper" ref={containerRef}>
          <MonacoEditor
            height="100%"
            language={language}
            value={content}
            theme={EDITOR_THEMES[theme] || EDITOR_THEMES.dark}
            options={{
              readOnly,
              fontSize,
              tabSize,
              wordWrap,
              minimap: { enabled: true },
              lineNumbers: 'on',
              roundedSelection: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              inlineSuggest: { enabled: true },
              parameterHints: true,
              formatOnPaste: true,
              formatOnType: true,
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              bracketPairColorization: { enabled: true },
              renderWhitespace: 'selection',
              renderControlCharacters: true,
              renderLineHighlight: 'all',
              folding: true,
              foldingStrategy: 'indentation',
              showFoldingControls: 'always'
            }}
            onMount={handleEditorDidMount}
          />
        </div>

        {/* Panneau de leçons guidées */}
        {showLessons && (
          <div className="side-panel lessons-panel-container">
            <LessonGuide
              currentCode={content}
              onClose={() => setShowLessons(false)}
            />
          </div>
        )}
      </div>

      {/* Barre d'état */}
      <div className="editor-statusbar">
        <div className="status-left">
          <span className="status-item">Langage: {language}</span>
          <span className="status-item">Taille: {content.length} caractères</span>
          {showSearchPanel && <span className="status-item" style={{ color: '#007bff' }}>🔍 Recherche active — Ctrl+Shift+F pour fermer</span>}
          {showLessons && <span className="status-item" style={{ color: '#27ae60' }}>📖 Leçons actives</span>}
          {debugStats && (
            <span className="status-item debug-info">
              🐛 {debugStats.total} erreurs · {debugStats.fixed} corrigées
            </span>
          )}
          {debugEnabled && (
            <span className="status-item debug-info">
              ● {breakpoints.length} breakpoint{breakpoints.length > 1 ? 's' : ''} · {debuggerConnected ? 'DAP connecté' : 'DAP prêt'}
            </span>
          )}
        </div>
        <div className="status-right">
          {isDirty && <span className="status-item warning">● Modifications non sauvegardées</span>}
          {lastError && (
            <span className="status-item error">
              ⚠️ Erreur détectée
            </span>
          )}
        </div>
      </div>

      {/* Panneau de débogage */}
      {debugEnabled && <DebugPanel />}
    </div>
  );
};

// =============================
// HOOK PERSONNALISÉ
// =============================
export const useCodeEditor = () => {
  const [activeFile, setActiveFile] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);
  const [debugEnabled, setDebugEnabled] = useState(false);

  const openFile = useCallback((filePath) => {
    setActiveFile(filePath);
    setIsDirty(false);
  }, []);

  const closeFile = useCallback(() => {
    setActiveFile(null);
    setIsDirty(false);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const saveCurrentFile = useCallback(async () => {
    if (!editorInstance || !activeFile) return;
    
    try {
      // Sauvegarder via l'éditeur
      await editorInstance.save();
      setIsDirty(false);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  }, [editorInstance, activeFile]);

  const toggleDebug = useCallback(() => {
    setDebugEnabled(prev => !prev);
  }, []);

  return {
    activeFile,
    isDirty,
    editorInstance,
    debugEnabled,
    setEditorInstance,
    openFile,
    closeFile,
    markDirty,
    saveCurrentFile,
    toggleDebug
  };
};

// =============================
// STYLES CSS (optionnel)
// =============================
const styles = `
.code-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 14px;
}

.file-icon {
  font-size: 16px;
}

.dirty-indicator {
  color: #ffa500;
  font-size: 12px;
  margin-left: 4px;
}

.fixing-indicator {
  color: #2196f3;
  font-size: 12px;
  margin-left: 8px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.toolbar-button {
  padding: 4px 8px;
  background: #3e3e3e;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.toolbar-button:hover {
  background: #505050;
  transform: translateY(-1px);
}

.toolbar-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-button.debug {
  background: #6a1b9a;
}

.toolbar-button.debug.has-error {
  background: #f44336;
  animation: pulse 2s infinite;
}

.editor-main-area {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.side-panel {
  width: 280px;
  min-width: 220px;
  max-width: 320px;
  border-right: 1px solid #3e3e3e;
  overflow: hidden;
  flex-shrink: 0;
}

.lessons-panel-container {
  border-right: none;
  border-left: 1px solid #3e3e3e;
}

.editor-wrapper {
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.editor-statusbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px;
  background: #2d2d2d;
  border-top: 1px solid #3e3e3e;
  color: #aaa;
  font-size: 12px;
}

.status-left {
  display: flex;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
}

.status-item.warning {
  color: #ffa500;
}

.status-item.error {
  color: #f44336;
}

.status-item.debug-info {
  color: #2196f3;
}

.code-editor-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #f44336;
}

.code-editor-error button {
  padding: 8px 16px;
  background: #f44336;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.code-editor-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #fff;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.code-editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #888;
  font-size: 16px;
}

.empty-icon {
  font-size: 48px;
}

/* Git gutter decorations */
.git-gutter-added {
  background: #28a74540;
  width: 4px !important;
  margin-left: 3px;
  border-radius: 2px;
}

.git-gutter-removed {
  background: #dc354540;
  width: 4px !important;
  margin-left: 3px;
  border-radius: 2px;
}

.git-gutter-modified {
  background: #ffc10750;
  width: 4px !important;
  margin-left: 3px;
  border-radius: 2px;
}
`;

// Ajouter les styles si pas déjà présents
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default CodeEditor;
