/**
 * SearchPanel - Recherche et remplacement multi-fichiers (Ctrl+Shift+F)
 * Recherche dans tous les fichiers du projet courant
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// =============================
// COMPOSANT PRINCIPAL
// =============================

const SearchPanel = ({ projectFiles = {}, onNavigate, onClose }) => {
  const [query, setQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState([]);
  const [expandedFiles, setExpandedFiles] = useState({});
  const [searching, setSearching] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Lancer la recherche dès que la query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    performSearch(query);
  }, [query, caseSensitive, useRegex, projectFiles]);

  const performSearch = useCallback((q) => {
    setSearching(true);
    const found = [];

    try {
      let pattern;
      if (useRegex) {
        pattern = new RegExp(q, caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }

      for (const [filePath, content] of Object.entries(projectFiles)) {
        if (typeof content !== 'string') continue;

        const lines = content.split('\n');
        const matches = [];

        lines.forEach((line, lineIndex) => {
          const lineMatches = [...line.matchAll(pattern)];
          lineMatches.forEach(match => {
            matches.push({
              lineNumber: lineIndex + 1,
              lineContent: line,
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
              matchText: match[0],
            });
          });
        });

        if (matches.length > 0) {
          found.push({ filePath, matches });
        }
      }
    } catch (e) {
      /* regex invalide */
    }

    setResults(found);
    setSearching(false);

    // Expand tous les fichiers par défaut
    const expanded = {};
    found.forEach(r => { expanded[r.filePath] = true; });
    setExpandedFiles(expanded);
  }, [caseSensitive, useRegex, projectFiles]);

  const handleReplace = (filePath, lineNumber, matchText) => {
    if (typeof onNavigate === 'function') {
      onNavigate(filePath, lineNumber, { replace: matchText, replaceWith: replaceQuery });
    }
  };

  const handleReplaceAll = () => {
    if (typeof onNavigate !== 'function') return;
    results.forEach(({ filePath, matches }) => {
      matches.forEach(m => {
        onNavigate(filePath, m.lineNumber, { replace: m.matchText, replaceWith: replaceQuery, all: true });
      });
    });
  };

  const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

  const highlightLine = (line, matchStart, matchEnd) => {
    const before = line.slice(0, matchStart);
    const match = line.slice(matchStart, matchEnd);
    const after = line.slice(matchEnd);
    const truncBefore = before.length > 30 ? '…' + before.slice(-30) : before;
    const truncAfter = after.length > 40 ? after.slice(0, 40) + '…' : after;
    return (
      <span>
        <span style={{ color: '#888' }}>{truncBefore}</span>
        <mark style={{ background: '#ffd700', color: '#000', borderRadius: 2 }}>{match}</mark>
        <span style={{ color: '#888' }}>{truncAfter}</span>
      </span>
    );
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span>🔍</span>
          <span>Recherche dans les fichiers</span>
        </div>
        {onClose && (
          <button style={styles.iconBtn} onClick={onClose}>✕</button>
        )}
      </div>

      {/* Champ de recherche */}
      <div style={styles.searchArea}>
        <div style={styles.inputRow}>
          <button
            style={styles.toggleBtn}
            onClick={() => setShowReplace(!showReplace)}
            title="Afficher/Masquer le remplacement"
          >
            {showReplace ? '▼' : '▶'}
          </button>
          <div style={styles.inputWrapper}>
            <input
              ref={inputRef}
              style={styles.input}
              placeholder="Rechercher…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              spellCheck={false}
            />
            <div style={styles.inputOptions}>
              <button
                style={{ ...styles.optBtn, ...(caseSensitive ? styles.optBtnActive : {}) }}
                onClick={() => setCaseSensitive(!caseSensitive)}
                title="Sensible à la casse"
              >
                Aa
              </button>
              <button
                style={{ ...styles.optBtn, ...(useRegex ? styles.optBtnActive : {}) }}
                onClick={() => setUseRegex(!useRegex)}
                title="Regex"
              >
                .*
              </button>
            </div>
          </div>
        </div>

        {showReplace && (
          <div style={styles.inputRow}>
            <div style={{ width: 24 }} />
            <div style={styles.inputWrapper}>
              <input
                style={styles.input}
                placeholder="Remplacer par…"
                value={replaceQuery}
                onChange={e => setReplaceQuery(e.target.value)}
                spellCheck={false}
              />
              <button
                style={styles.replaceAllBtn}
                onClick={handleReplaceAll}
                disabled={!query || results.length === 0}
                title="Tout remplacer"
              >
                Tout remplacer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Résumé */}
      {query.trim() && (
        <div style={styles.summary}>
          {searching
            ? 'Recherche…'
            : totalMatches === 0
              ? 'Aucun résultat'
              : `${totalMatches} résultat${totalMatches > 1 ? 's' : ''} dans ${results.length} fichier${results.length > 1 ? 's' : ''}`
          }
        </div>
      )}

      {/* Résultats */}
      <div style={styles.results}>
        {results.map(({ filePath, matches }) => (
          <div key={filePath} style={styles.fileGroup}>
            {/* Fichier header */}
            <div
              style={styles.fileHeader}
              onClick={() => setExpandedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }))}
            >
              <span style={styles.expandIcon}>{expandedFiles[filePath] ? '▼' : '▶'}</span>
              <span style={styles.fileName}>{filePath}</span>
              <span style={styles.matchCount}>{matches.length}</span>
            </div>

            {/* Lignes de correspondance */}
            {expandedFiles[filePath] && matches.map((m, i) => (
              <div
                key={i}
                style={styles.matchRow}
                onClick={() => onNavigate?.(filePath, m.lineNumber)}
              >
                <span style={styles.lineNum}>{m.lineNumber}</span>
                <span style={styles.lineContent}>
                  {highlightLine(m.lineContent.trim(), m.matchStart - (m.lineContent.length - m.lineContent.trimStart().length), m.matchEnd - (m.lineContent.length - m.lineContent.trimStart().length))}
                </span>
                {showReplace && (
                  <button
                    style={styles.replaceOneBtn}
                    onClick={e => { e.stopPropagation(); handleReplace(filePath, m.lineNumber, m.matchText); }}
                  >
                    ↩
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================
// STYLES
// =============================
const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontSize: 13,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3e3e3e',
    flexShrink: 0,
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 16,
  },
  searchArea: {
    padding: '10px 12px',
    borderBottom: '1px solid #3e3e3e',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: 12,
    width: 18,
    flexShrink: 0,
  },
  inputWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: 4,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#d4d4d4',
    fontSize: 13,
    padding: '5px 8px',
    outline: 'none',
    fontFamily: 'monospace',
  },
  inputOptions: {
    display: 'flex',
    gap: 2,
    padding: '0 4px',
  },
  optBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: 11,
    padding: '3px 5px',
    borderRadius: 3,
    fontFamily: 'monospace',
  },
  optBtnActive: {
    background: '#007bff',
    color: '#fff',
  },
  replaceAllBtn: {
    background: '#3e3e3e',
    border: 'none',
    color: '#d4d4d4',
    cursor: 'pointer',
    fontSize: 11,
    padding: '4px 8px',
    whiteSpace: 'nowrap',
    borderLeft: '1px solid #555',
  },
  summary: {
    padding: '4px 14px',
    color: '#888',
    fontSize: 11,
    background: '#252525',
    borderBottom: '1px solid #3e3e3e',
    flexShrink: 0,
  },
  results: {
    flex: 1,
    overflowY: 'auto',
  },
  fileGroup: {
    borderBottom: '1px solid #2d2d2d',
  },
  fileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    background: '#252525',
    transition: 'background 0.15s',
  },
  expandIcon: {
    color: '#888',
    fontSize: 10,
    width: 12,
    flexShrink: 0,
  },
  fileName: {
    flex: 1,
    color: '#e2b96f',
    fontFamily: 'monospace',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  matchCount: {
    background: '#007bff',
    color: '#fff',
    borderRadius: 10,
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 'bold',
    flexShrink: 0,
  },
  matchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px 4px 28px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderBottom: '1px solid #282828',
  },
  lineNum: {
    color: '#555',
    fontFamily: 'monospace',
    fontSize: 11,
    minWidth: 32,
    textAlign: 'right',
    flexShrink: 0,
  },
  lineContent: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  replaceOneBtn: {
    background: 'none',
    border: '1px solid #3e3e3e',
    borderRadius: 3,
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 13,
    padding: '1px 6px',
    flexShrink: 0,
  },
};

export default SearchPanel;
