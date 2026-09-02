/**
 * AwarenessManager — Curseurs collaboratifs colorés
 *
 * Rôle :
 * - S'abonner aux événements awareness du YjsProvider
 * - Afficher les curseurs distants dans Monaco Editor
 * - Afficher une étiquette avec le nom et la couleur de chaque utilisateur
 * - Nettoyer les curseurs lorsque les utilisateurs se déconnectent
 */

// ─── Palette de couleurs utilisateur ─────────────────────────────────────────

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#82E0AA', '#F1948A', '#85C1E9',
];

let _colorIndex = 0;

function assignColor() {
  return CURSOR_COLORS[_colorIndex++ % CURSOR_COLORS.length];
}

// ─── Curseur distant (décorations Monaco) ────────────────────────────────────

class RemoteCursor {
  constructor(clientId, user, editor, monaco) {
    this.clientId      = clientId;
    this.user          = user;
    this.editor        = editor;
    this.monaco        = monaco;
    this.decorations   = [];
    this.color         = user.color || assignColor();
    this._styleEl      = null;

    this._injectStyle();
  }

  // Injecter le CSS dynamique pour cette couleur
  _injectStyle() {
    const id = `cursor-style-${this.clientId}`;
    if (document.getElementById(id)) return;

    const style = document.createElement('style');
    style.id    = id;
    style.textContent = `
      .remote-cursor-${this.clientId} {
        border-left: 2px solid ${this.color};
        margin-left: -1px;
      }
      .remote-cursor-label-${this.clientId} {
        background: ${this.color};
        color: #fff;
        font-size: 11px;
        font-family: monospace;
        padding: 1px 4px;
        border-radius: 2px;
        white-space: nowrap;
        position: absolute;
        pointer-events: none;
        z-index: 100;
      }
    `;
    document.head.appendChild(style);
    this._styleEl = style;
  }

  /**
   * Mettre à jour la position du curseur dans Monaco.
   * @param {{ index: number, length: number }} cursor
   */
  update(cursor) {
    if (!cursor || typeof cursor.index !== 'number') return;

    const model = this.editor.getModel();
    if (!model) return;

    const position = model.getPositionAt(cursor.index);
    if (!position) return;

    const range = new this.monaco.Range(
      position.lineNumber,
      position.column,
      position.lineNumber,
      position.column,
    );

    const selectionRange = cursor.length > 0
      ? new this.monaco.Range(
          model.getPositionAt(cursor.index).lineNumber,
          model.getPositionAt(cursor.index).column,
          model.getPositionAt(cursor.index + cursor.length).lineNumber,
          model.getPositionAt(cursor.index + cursor.length).column,
        )
      : null;

    const newDecorations = [
      // Ligne curseur
      {
        range,
        options: {
          className: `remote-cursor-${this.clientId}`,
          afterContentClassName: `remote-cursor-label-${this.clientId}`,
          after: {
            content: ` ${this.user.name || 'Utilisateur'} `,
          },
          stickiness: this.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ];

    // Sélection distante
    if (selectionRange) {
      newDecorations.push({
        range: selectionRange,
        options: {
          className: `remote-selection-${this.clientId}`,
          inlineClassName: `remote-selection-${this.clientId}`,
        },
      });
    }

    this.decorations = this.editor.deltaDecorations(this.decorations, newDecorations);
  }

  // Supprimer le curseur
  destroy() {
    this.editor.deltaDecorations(this.decorations, []);
    if (this._styleEl && this._styleEl.parentNode) {
      this._styleEl.parentNode.removeChild(this._styleEl);
    }
  }
}

// ─── AwarenessManager ────────────────────────────────────────────────────────

export class AwarenessManager {
  /**
   * @param {object} yjsProvider  - Instance de YjsProvider
   * @param {object} editor       - Instance Monaco Editor
   * @param {object} monaco       - Namespace monaco global
   * @param {object} localUser    - { name, color } de l'utilisateur local
   */
  constructor(yjsProvider, editor, monaco, localUser = {}) {
    this.provider   = yjsProvider;
    this.editor     = editor;
    this.monaco     = monaco;
    this.localUser  = localUser;
    this.cursors    = new Map(); // clientId -> RemoteCursor

    // Écouter les changements de curseur locaux
    this._onCursorChange = editor.onDidChangeCursorPosition((e) => {
      this._publishLocalCursor(e.position);
    });
    this._onSelectionChange = editor.onDidChangeCursorSelection((e) => {
      this._publishLocalSelection(e.selection);
    });

    // Écouter les mises à jour awareness distantes
    this._onAwareness = (data) => this._handleAwareness(data);
    this.provider.on('awareness', this._onAwareness);
  }

  // ── Publier la position locale ─────────────────────────────────────────

  _publishLocalCursor(position) {
    const model  = this.editor.getModel();
    if (!model) return;
    const index  = model.getOffsetAt(position);
    this.provider.setLocalAwareness({
      cursor: { index, length: 0 },
      user: {
        name:  this.localUser.name  || 'Moi',
        color: this.localUser.color || CURSOR_COLORS[0],
      },
    });
  }

  _publishLocalSelection(selection) {
    const model = this.editor.getModel();
    if (!model) return;
    const start  = model.getOffsetAt({ lineNumber: selection.startLineNumber, column: selection.startColumn });
    const end    = model.getOffsetAt({ lineNumber: selection.endLineNumber,   column: selection.endColumn });
    this.provider.setLocalAwareness({
      cursor: { index: start, length: end - start },
      user: {
        name:  this.localUser.name  || 'Moi',
        color: this.localUser.color || CURSOR_COLORS[0],
      },
    });
  }

  // ── Traiter les mises à jour awareness distantes ───────────────────────

  _handleAwareness(data) {
    // data peut être un seul état ou { type: 'awareness_states', states: [...] }
    const states = data.states ? data.states : [data];

    for (const state of states) {
      const clientId = state.clientId;
      if (!clientId) continue;

      if (!state.cursor) {
        // L'utilisateur a quitté ou le curseur est absent
        this._removeCursor(clientId);
        continue;
      }

      if (!this.cursors.has(clientId)) {
        const cursor = new RemoteCursor(clientId, state.user || {}, this.editor, this.monaco);
        this.cursors.set(clientId, cursor);
      }

      this.cursors.get(clientId).update(state.cursor);
    }
  }

  _removeCursor(clientId) {
    const cursor = this.cursors.get(clientId);
    if (cursor) {
      cursor.destroy();
      this.cursors.delete(clientId);
    }
  }

  // ── Cycle de vie ─────────────────────────────────────────────────────────

  destroy() {
    this._onCursorChange?.dispose();
    this._onSelectionChange?.dispose();
    this.provider.off('awareness', this._onAwareness);
    this.cursors.forEach((c) => c.destroy());
    this.cursors.clear();
  }
}
