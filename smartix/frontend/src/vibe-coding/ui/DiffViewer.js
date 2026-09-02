/**
 * DiffViewer - Affichage avant/après d'une modification de code IA
 * Sprint 2 : utilisé dans le chat IA pour visualiser les changements proposés
 *
 * Affiche les lignes supprimées (rouge) et ajoutées (vert).
 * Boutons Appliquer / Annuler.
 */

import React, { useState, useMemo } from 'react';

// =============================
// PARSER DE DIFF UNIFIÉ
// =============================

/**
 * Parse un diff unifié (format standard) en segments affichables.
 * @param {string} diffText - Texte diff avec +, -, espaces
 * @returns {{ type: 'add'|'remove'|'context', content: string }[]}
 */
export const parseDiff = (diffText) => {
  const lines = diffText.split('\n');
  const segments = [];

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      segments.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      segments.push({ type: 'add', content: line.slice(1) });
    } else if (line.startsWith('-')) {
      segments.push({ type: 'remove', content: line.slice(1) });
    } else {
      segments.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
    }
  }
  return segments;
};

/**
 * Extrait les blocs diff d'un message de chat IA.
 * Cherche les blocs ```diff ... ``` et le nom de fichier optionnel.
 * @param {string} messageContent
 * @returns {{ filename?: string, diff: string }[]}
 */
export const extractDiffBlocks = (messageContent) => {
  const blocks = [];
  const diffRegex = /(?:(?:#\s*fichier\s*:\s*([^\n]+)\n)|(?:fichier\s*:\s*([^\n]+)\n))?\s*```diff\n([\s\S]*?)```/gi;

  let match;
  while ((match = diffRegex.exec(messageContent)) !== null) {
    blocks.push({
      filename: (match[1] || match[2] || '').trim() || null,
      diff: match[3],
    });
  }
  return blocks;
};

// =============================
// COMPOSANT DIFF VIEWER
// =============================

const DiffViewer = ({
  diffText,
  filename,
  onApply,
  onDismiss,
  compact = false,
}) => {
  const [applied, setApplied] = useState(false);

  const segments = useMemo(() => parseDiff(diffText || ''), [diffText]);

  const stats = useMemo(() => ({
    added: segments.filter(s => s.type === 'add').length,
    removed: segments.filter(s => s.type === 'remove').length,
  }), [segments]);

  const handleApply = () => {
    setApplied(true);
    onApply?.(diffText, filename);
  };

  if (!diffText) return null;

  return (
    <div style={{ ...styles.container, ...(compact ? styles.containerCompact : {}) }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ fontSize: 14 }}>📝</span>
          {filename && <span style={styles.filename}>{filename}</span>}
          <span style={styles.statAdd}>+{stats.added}</span>
          <span style={styles.statRemove}>-{stats.removed}</span>
        </div>
        {!applied && (
          <div style={styles.actions}>
            <button style={styles.btnApply} onClick={handleApply} title="Appliquer la modification">
              ✅ Appliquer
            </button>
            {onDismiss && (
              <button style={styles.btnDismiss} onClick={onDismiss} title="Ignorer">
                ✕
              </button>
            )}
          </div>
        )}
        {applied && (
          <span style={{ fontSize: 12, color: '#27ae60', fontWeight: 'bold' }}>✅ Appliqué</span>
        )}
      </div>

      {/* Diff lines */}
      <div style={styles.diffBody}>
        {segments.map((seg, i) => {
          if (seg.type === 'header') {
            return (
              <div key={i} style={styles.lineHeader}>
                {seg.content}
              </div>
            );
          }
          return (
            <div
              key={i}
              style={{
                ...styles.line,
                ...(seg.type === 'add' ? styles.lineAdd : {}),
                ...(seg.type === 'remove' ? styles.lineRemove : {}),
              }}
            >
              <span style={styles.linePrefix}>
                {seg.type === 'add' ? '+' : seg.type === 'remove' ? '-' : ' '}
              </span>
              <span style={styles.lineContent}>{seg.content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================
// COMPOSANT INLINE DANS LE CHAT
// =============================

/**
 * Rendu d'un message de chat avec extraction et affichage des blocs diff.
 */
export const ChatMessageWithDiff = ({ content, onApplyDiff }) => {
  const diffBlocks = useMemo(() => extractDiffBlocks(content), [content]);

  if (diffBlocks.length === 0) {
    return <span style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{content}</span>;
  }

  // Séparer le texte et les blocs diff
  const parts = [];
  let remaining = content;

  for (const block of diffBlocks) {
    const diffMarker = '```diff\n' + block.diff + '```';
    const idx = remaining.indexOf(diffMarker);
    if (idx === -1) continue;

    if (idx > 0) {
      parts.push({ type: 'text', content: remaining.slice(0, idx) });
    }
    parts.push({ type: 'diff', ...block });
    remaining = remaining.slice(idx + diffMarker.length);
  }
  if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  return (
    <div>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {part.content}
            </span>
          );
        }
        return (
          <DiffViewer
            key={i}
            diffText={part.diff}
            filename={part.filename}
            onApply={(diff, filename) => onApplyDiff?.(diff, filename)}
            compact
          />
        );
      })}
    </div>
  );
};

// =============================
// STYLES
// =============================

const styles = {
  container: {
    border: '1px solid #3e3e3e',
    borderRadius: 6,
    overflow: 'hidden',
    margin: '8px 0',
    background: '#0d1117',
  },
  containerCompact: {
    maxHeight: 300,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: '#161b22',
    borderBottom: '1px solid #3e3e3e',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  filename: {
    color: '#8b949e',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statAdd: {
    color: '#3fb950',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statRemove: {
    color: '#f85149',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actions: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  btnApply: {
    background: '#238636',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 10px',
    fontWeight: 'bold',
  },
  btnDismiss: {
    background: 'none',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#888',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 8px',
  },
  diffBody: {
    overflowY: 'auto',
    maxHeight: 250,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 12,
    lineHeight: 1.5,
  },
  line: {
    display: 'flex',
    padding: '0 8px',
  },
  lineAdd: {
    background: '#0f2a1b',
    color: '#3fb950',
  },
  lineRemove: {
    background: '#2a0f0f',
    color: '#f85149',
  },
  lineHeader: {
    padding: '2px 8px',
    color: '#8b949e',
    background: '#1c2028',
    fontSize: 11,
  },
  linePrefix: {
    width: 14,
    flexShrink: 0,
    userSelect: 'none',
    opacity: 0.7,
  },
  lineContent: {
    flex: 1,
    whiteSpace: 'pre',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default DiffViewer;
