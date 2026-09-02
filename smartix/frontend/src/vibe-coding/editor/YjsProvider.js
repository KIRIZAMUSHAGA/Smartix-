/**
 * YjsProvider — Connexion WebSocket au serveur de collaboration Yjs
 *
 * Rôle :
 * - Établir la connexion WebSocket avec le serveur de collaboration
 * - Synchroniser le document Yjs avec tous les participants
 * - Gérer la reconnexion automatique
 * - Exposer le document Y.Doc pour Monaco
 */

import * as Y from 'yjs';
import { EventEmitter } from 'events';

// ─── Constants ────────────────────────────────────────────────────────────────

const MSG_SYNC       = 0;
const MSG_AWARENESS  = 1;
const MSG_AUTH       = 2;

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT      = 10;

// ─── YjsProvider ─────────────────────────────────────────────────────────────

export class YjsProvider extends EventEmitter {
  /**
   * @param {string} roomId        - Identifiant du projet / de la salle
   * @param {Y.Doc}  ydoc          - Document Yjs partagé
   * @param {object} [options]
   * @param {string} [options.serverUrl]  - URL du serveur WebSocket
   * @param {string} [options.token]      - Token JWT pour l'authentification
   */
  constructor(roomId, ydoc, options = {}) {
    super();

    this.roomId    = roomId;
    this.ydoc      = ydoc || new Y.Doc();
    this.token     = options.token || '';
    this.serverUrl = options.serverUrl || _defaultServerUrl();

    this.ws              = null;
    this.connected       = false;
    this.reconnectCount  = 0;
    this._reconnectTimer = null;
    this._destroyed      = false;

    // Écouter les mises à jour locales du document
    this.ydoc.on('update', (update, origin) => {
      if (origin !== this && this.connected) {
        this._sendSync(update);
      }
    });

    this._connect();
  }

  // ── Connexion ───────────────────────────────────────────────────────────

  _buildUrl() {
    const base = this.serverUrl.replace(/\/$/, '');
    const sep  = base.includes('?') ? '&' : '?';
    return `${base}/collab/${this.roomId}${sep}token=${encodeURIComponent(this.token)}`;
  }

  _connect() {
    if (this._destroyed) return;

    try {
      this.ws = new WebSocket(this._buildUrl());
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.connected     = true;
        this.reconnectCount = 0;
        this.emit('status', { status: 'connected' });

        // Demander l'état awareness des autres
        this._send(new Uint8Array([MSG_AWARENESS]));
      };

      this.ws.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('status', { status: 'disconnected' });
        this._scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this.emit('error', err);
      };
    } catch (e) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this._destroyed || this.reconnectCount >= MAX_RECONNECT) return;
    this.reconnectCount++;
    const delay = RECONNECT_DELAY_MS * Math.min(this.reconnectCount, 5);
    this._reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  // ── Traitement des messages entrants ────────────────────────────────────

  _handleMessage(data) {
    const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    if (buf.length === 0) return;

    const msgType = buf[0];
    const payload = buf.slice(1);

    if (msgType === MSG_SYNC) {
      // Appliquer la mise à jour Yjs distante
      try {
        Y.applyUpdate(this.ydoc, payload, this); // origin = this pour éviter l'écho
      } catch (e) {
        console.warn('[YjsProvider] Erreur application update:', e);
      }
    } else if (msgType === MSG_AWARENESS) {
      // Déléguer à l'AwarenessManager
      try {
        const text = new TextDecoder().decode(payload);
        const awareness = JSON.parse(text);
        this.emit('awareness', awareness);
      } catch (_) {}
    }
  }

  // ── Envoi des mises à jour locales ──────────────────────────────────────

  _sendSync(update) {
    if (!this.connected || !this.ws) return;
    const msg = new Uint8Array(1 + update.length);
    msg[0] = MSG_SYNC;
    msg.set(update, 1);
    this._send(msg);
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  // ── Awareness ───────────────────────────────────────────────────────────

  /**
   * Envoie la position / sélection du curseur local.
   * @param {object} state - { cursor: { index, length }, user: { name, color } }
   */
  setLocalAwareness(state) {
    if (!this.connected) return;
    const payload = JSON.stringify(state);
    const encoded = new TextEncoder().encode(payload);
    const msg = new Uint8Array(1 + encoded.length);
    msg[0] = MSG_AWARENESS;
    msg.set(encoded, 1);
    this._send(msg);
  }

  // ── Cycle de vie ─────────────────────────────────────────────────────────

  destroy() {
    this._destroyed = true;
    clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ydoc.off('update', this._onUpdate);
    this.emit('status', { status: 'destroyed' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _defaultServerUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host  = window.location.host;
  return `${proto}//${host}`;
}

// ─── Singleton factory ────────────────────────────────────────────────────────

const _providers = new Map();

/**
 * Récupère ou crée un YjsProvider pour un projet donné.
 */
export function getYjsProvider(roomId, ydoc, options = {}) {
  if (_providers.has(roomId)) {
    return _providers.get(roomId);
  }
  const provider = new YjsProvider(roomId, ydoc, options);
  _providers.set(roomId, provider);
  return provider;
}

/**
 * Détruit et supprime le provider d'un projet.
 */
export function destroyYjsProvider(roomId) {
  const provider = _providers.get(roomId);
  if (provider) {
    provider.destroy();
    _providers.delete(roomId);
  }
}
