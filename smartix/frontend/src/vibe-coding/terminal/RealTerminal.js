/**
 * RealTerminal — Terminal PTY réel via WebSocket + xterm.js
 *
 * Fonctionnalités :
 * - Connexion WebSocket au serveur PTY backend
 * - xterm.js pour le rendu ANSI complet
 * - FitAddon pour le resize automatique
 * - Gestion du resize (SIGWINCH via WebSocket)
 * - Reconnexion automatique
 * - Theme sombre catppuccin
 */

import { Terminal }     from 'xterm';
import { FitAddon }     from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

// ─── Configuration ────────────────────────────────────────────────────────────

const THEME = {
  background:    '#11111b',
  foreground:    '#cdd6f4',
  cursor:        '#f5c2e7',
  cursorAccent:  '#1e1e2e',
  black:         '#45475a',
  red:           '#f38ba8',
  green:         '#a6e3a1',
  yellow:        '#f9e2af',
  blue:          '#89b4fa',
  magenta:       '#f5c2e7',
  cyan:          '#94e2d5',
  white:         '#bac2de',
  brightBlack:   '#585b70',
  brightRed:     '#f38ba8',
  brightGreen:   '#a6e3a1',
  brightYellow:  '#f9e2af',
  brightBlue:    '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan:    '#94e2d5',
  brightWhite:   '#a6adc8',
};

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT      = 5;

// ─── RealTerminal ─────────────────────────────────────────────────────────────

export class RealTerminal {
  /**
   * @param {HTMLElement} container   - Élément DOM cible
   * @param {string}      sessionId   - Identifiant unique de la session PTY
   * @param {object}      [options]
   * @param {string}      [options.projectDir]  - Répertoire de travail
   * @param {string}      [options.wsBaseUrl]   - Base URL WebSocket (auto si omis)
   */
  constructor(container, sessionId, options = {}) {
    this.sessionId   = sessionId;
    this.projectDir  = options.projectDir || '/tmp';
    this.wsBaseUrl   = options.wsBaseUrl  || _defaultWsBase();
    this.container   = container;

    this._ws              = null;
    this._connected       = false;
    this._destroyed       = false;
    this._reconnectCount  = 0;
    this._reconnectTimer  = null;

    this._onStatusChange  = options.onStatusChange || (() => {});

    this._initXterm();
    this._connect();
  }

  // ── Initialisation xterm.js ────────────────────────────────────────────

  _initXterm() {
    this.term = new Terminal({
      theme:             THEME,
      fontSize:          14,
      fontFamily:        "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      cursorBlink:       true,
      cursorStyle:       'block',
      scrollback:        5000,
      allowTransparency: false,
      convertEol:        true,
    });

    this.fitAddon   = new FitAddon();
    this.linksAddon = new WebLinksAddon();

    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(this.linksAddon);
    this.term.open(this.container);

    // Fit initial + resize observer
    requestAnimationFrame(() => {
      this.fitAddon.fit();
      this._setupResizeObserver();
    });

    // Clavier → PTY
    this.term.onData((data) => {
      this._sendToServer({ type: 'input', data });
    });

    // Titre de la fenêtre (séquence OSC)
    this.term.onTitleChange((title) => {
      document.title = title;
    });
  }

  _setupResizeObserver() {
    if (!window.ResizeObserver) return;
    this._resizeObserver = new ResizeObserver(() => {
      this.fitAddon.fit();
      const { rows, cols } = this.term;
      this._sendToServer({ type: 'resize', rows, cols });
    });
    this._resizeObserver.observe(this.container);
  }

  // ── Connexion WebSocket ────────────────────────────────────────────────

  _buildUrl() {
    const dir = encodeURIComponent(this.projectDir);
    return `${this.wsBaseUrl}/ws/terminal/${this.sessionId}?dir=${dir}`;
  }

  _connect() {
    if (this._destroyed) return;

    try {
      this._ws = new WebSocket(this._buildUrl());
      this._ws.binaryType = 'arraybuffer';

      this._ws.onopen = () => {
        this._connected      = true;
        this._reconnectCount = 0;
        this._onStatusChange('connected');
        this.term.write('\r\n\x1b[32m╔══════════════════════════════╗\x1b[0m\r\n');
        this.term.write('\x1b[32m║  Terminal Vibe-Coding prêt   ║\x1b[0m\r\n');
        this.term.write('\x1b[32m╚══════════════════════════════╝\x1b[0m\r\n\r\n');
        // Envoyer la taille initiale
        const { rows, cols } = this.term;
        this._sendToServer({ type: 'resize', rows, cols });
      };

      this._ws.onmessage = (event) => {
        // Données binaires brutes du PTY → écrire dans xterm
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          this.term.write(data);
        } else {
          // Texte (contrôle ou données)
          try {
            const json = JSON.parse(event.data);
            if (json.type === 'pong') return;
          } catch (_) {}
          this.term.write(event.data);
        }
      };

      this._ws.onclose = (e) => {
        this._connected = false;
        this._onStatusChange('disconnected');
        if (!this._destroyed && e.code !== 1000) {
          this.term.write('\r\n\x1b[33m[Déconnecté — reconnexion...]\x1b[0m\r\n');
          this._scheduleReconnect();
        }
      };

      this._ws.onerror = () => {
        this._connected = false;
        this._onStatusChange('error');
      };

    } catch (e) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this._destroyed || this._reconnectCount >= MAX_RECONNECT) {
      this.term.write('\r\n\x1b[31m[Impossible de se reconnecter au terminal]\x1b[0m\r\n');
      return;
    }
    this._reconnectCount++;
    const delay = RECONNECT_DELAY_MS * this._reconnectCount;
    this._reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  // ── Envoi au serveur ──────────────────────────────────────────────────

  _sendToServer(payload) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(payload));
    }
  }

  // ── API publique ──────────────────────────────────────────────────────

  /**
   * Redimensionner le terminal (ex: après un changement de layout).
   */
  fit() {
    this.fitAddon.fit();
    const { rows, cols } = this.term;
    this._sendToServer({ type: 'resize', rows, cols });
  }

  /**
   * Écrire du texte dans le terminal (côté client seulement).
   */
  write(text) {
    this.term.write(text);
  }

  /**
   * Envoyer une commande au shell PTY.
   */
  sendCommand(cmd) {
    this._sendToServer({ type: 'input', data: cmd + '\n' });
  }

  /**
   * Effacer l'écran.
   */
  clear() {
    this.term.clear();
  }

  /**
   * Mettre le focus sur le terminal.
   */
  focus() {
    this.term.focus();
  }

  /**
   * Statut de connexion.
   */
  isConnected() {
    return this._connected;
  }

  /**
   * Détruire proprement le terminal et la connexion WebSocket.
   */
  destroy() {
    this._destroyed = true;
    clearTimeout(this._reconnectTimer);
    this._resizeObserver?.disconnect();
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close(1000, 'destroyed');
    }
    this.term.dispose();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _defaultWsBase() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

// ─── Composant React (wrapper) ────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';

/**
 * Composant React encapsulant RealTerminal.
 *
 * @param {string}  sessionId   - ID de session unique (ex: projectId + "-term-1")
 * @param {string}  projectDir  - Répertoire de travail du shell
 * @param {object}  style       - Styles CSS supplémentaires
 * @param {boolean} autoFocus   - Donner le focus au montage
 */
const RealTerminalComponent = ({
  sessionId,
  projectDir = '/tmp',
  style = {},
  autoFocus = true,
  onStatusChange,
}) => {
  const containerRef = useRef(null);
  const terminalRef  = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    if (!containerRef.current) return;

    const handleStatus = (s) => {
      setStatus(s);
      onStatusChange?.(s);
    };

    const rt = new RealTerminal(containerRef.current, sessionId, {
      projectDir,
      onStatusChange: handleStatus,
    });
    terminalRef.current = rt;

    if (autoFocus) rt.focus();

    return () => rt.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Refitter si projectDir change
  useEffect(() => {
    terminalRef.current?.fit();
  }, [projectDir]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {/* Indicateur de statut */}
      <div style={{
        position: 'absolute', top: 6, right: 10, zIndex: 10,
        width: 8, height: 8, borderRadius: '50%',
        background: status === 'connected' ? '#a6e3a1'
          : status === 'error' ? '#f38ba8' : '#f9e2af',
        boxShadow: status === 'connected' ? '0 0 6px #a6e3a1' : 'none',
      }} />
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default RealTerminalComponent;
