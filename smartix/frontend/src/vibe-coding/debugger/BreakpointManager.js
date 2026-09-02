import { useCallback, useEffect, useRef, useState } from 'react';
import './debugger.css';

export const useBreakpoints = (projectId, editor, options = {}) => {
  const { filePath, monaco, enabled = true } = options;
  const [breakpoints, setBreakpoints] = useState([]);
  const [debuggerConnected, setDebuggerConnected] = useState(false);
  const decorationsRef = useRef([]);
  const breakpointsRef = useRef([]);

  const updateBreakpointsDecoration = useCallback((nextBreakpoints = breakpointsRef.current) => {
    if (!editor || !monaco?.Range) return;

    const decorations = nextBreakpoints.map(bp => ({
      range: new monaco.Range(bp.line, 1, bp.line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: bp.active ? 'breakpoint-glyph-active' : 'breakpoint-glyph',
        glyphMarginHoverMessage: { value: '**Breakpoint**' },
      },
    }));

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, [editor, monaco]);

  const syncBackend = useCallback(async (nextBreakpoints) => {
    if (!projectId) return;
    const response = await fetch(`/api/debugger/${projectId}/breakpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ breakpoints: nextBreakpoints }),
    });
    setDebuggerConnected(response.ok);
  }, [projectId]);

  const toggleBreakpoint = useCallback(async (line) => {
    if (!editor || !enabled) return;
    const model = editor.getModel?.();
    const modelPath = filePath || model?.uri?.path || model?.uri?.toString?.() || '';
    const existing = breakpointsRef.current.find(bp => bp.line === line && bp.file === modelPath);
    const nextBreakpoints = existing
      ? breakpointsRef.current.filter(bp => !(bp.line === line && bp.file === modelPath))
      : [...breakpointsRef.current, { line, file: modelPath }];

    breakpointsRef.current = nextBreakpoints;
    setBreakpoints(nextBreakpoints);
    updateBreakpointsDecoration(nextBreakpoints);

    try {
      await syncBackend(nextBreakpoints);
    } catch {
      setDebuggerConnected(false);
    }
  }, [editor, enabled, filePath, syncBackend, updateBreakpointsDecoration]);

  useEffect(() => {
    breakpointsRef.current = breakpoints;
    updateBreakpointsDecoration(breakpoints);
  }, [breakpoints, updateBreakpointsDecoration]);

  useEffect(() => {
    if (!editor || !enabled) return undefined;

    const contentDisposable = editor.onDidChangeModelContent(() => {
      updateBreakpointsDecoration();
    });

    const mouseDisposable = editor.onMouseDown((e) => {
      const targetType = e?.target?.type;
      const isGlyphOrLineNumber = targetType === monaco?.editor?.MouseTargetType?.GUTTER_GLYPH_MARGIN
        || targetType === monaco?.editor?.MouseTargetType?.GUTTER_LINE_NUMBERS
        || targetType === 2
        || targetType === 6;

      if (isGlyphOrLineNumber && e?.target?.position?.lineNumber) {
        toggleBreakpoint(e.target.position.lineNumber);
      }
    });

    return () => {
      contentDisposable?.dispose?.();
      mouseDisposable?.dispose?.();
    };
  }, [editor, enabled, monaco, toggleBreakpoint, updateBreakpointsDecoration]);

  return { breakpoints, toggleBreakpoint, debuggerConnected };
};

export default useBreakpoints;