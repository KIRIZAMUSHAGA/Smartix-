/**
 * Utilitaire crypto pour environnement navigateur
 * Remplaçant pour le module Node.js 'crypto'
 * 
 * @module @vibe-coding/utils/crypto
 * @description Fournit des fonctions cryptographiques sécurisées pour le navigateur
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';

// =============================
// CONSTANTES
// =============================

const DEFAULT_TOKEN_LENGTH = 32;
const DEFAULT_RANDOM_BYTES = 16;
const HASH_ALGORITHM = 'SHA-256';
const HMAC_ALGORITHM = 'HMAC';

// =============================
// CLASSE CRYPTO UTILS
// =============================

class CryptoUtils {
  constructor() {
    this.initialized = false;
    this.supported = this._checkSupport();
  }

  /**
   * Vérifie le support des API Web Crypto
   * @private
   * @returns {boolean} true si supporté
   */
  _checkSupport() {
    const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;

    const hasCrypto =
      cryptoObj &&
      typeof cryptoObj.getRandomValues === "function";

    const hasSubtle =
      hasCrypto &&
      cryptoObj.subtle &&
      typeof cryptoObj.subtle.digest === "function";

    if (!hasCrypto) {
      console.warn('⚠️ Web Crypto API non supportée, fallback vers Math.random (moins sécurisé)');
    }

    return hasCrypto && hasSubtle;
  }

  /**
   * Initialise l'utilitaire
   */
  async initialize() {
    if (this.initialized) return;

    if (!this.supported) {
      console.warn('⚠️ CryptoUtils: fonctionnement en mode dégradé');
    }

    this.initialized = true;
    console.log('✅ CryptoUtils initialisé');
  }

  /**
   * Génère des bytes aléatoires
   * @param {number} size
   * @returns {string}
   */
  randomBytes(size = DEFAULT_RANDOM_BYTES) {
    if (this.supported) {
      const array = new Uint8Array(size);
      globalThis.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    return this._fallbackRandomBytes(size);
  }

  /**
   * Fallback pour randomBytes
   * @private
   */
  _fallbackRandomBytes(size) {
    let result = '';
    for (let i = 0; i < size * 2; i++) {
      result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
  }

  /**
   * Génère un token aléatoire URL-safe
   */
  randomToken(length = DEFAULT_TOKEN_LENGTH) {
    if (this.supported) {
      const array = new Uint8Array(length);
      globalThis.crypto.getRandomValues(array);

      const binary = Array.from(array)
        .map(b => String.fromCharCode(b))
        .join('');

      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Crée un hash SHA-256
   */
  async createHash(data) {
    if (!this.supported) {
      return this._fallbackHash(data);
    }

    try {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(data);
      const hashBuffer = await globalThis.crypto.subtle.digest(HASH_ALGORITHM, buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('❌ Erreur création hash:', error);
      return this._fallbackHash(data);
    }
  }

  /**
   * Fallback pour hash
   * @private
   */
  _fallbackHash(data) {
    let hash = 0;
    const str = String(data);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Crée un HMAC
   */
  async createHmac(data, key) {
    if (!this.supported) {
      return this._fallbackHmac(data, key);
    }

    try {
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(key);
      const dataBuffer = encoder.encode(data);

      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: HMAC_ALGORITHM, hash: HASH_ALGORITHM },
        false,
        ['sign']
      );

      const signature = await globalThis.crypto.subtle.sign(
        HMAC_ALGORITHM,
        cryptoKey,
        dataBuffer
      );

      const signatureArray = Array.from(new Uint8Array(signature));
      return signatureArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('❌ Erreur création HMAC:', error);
      return this._fallbackHmac(data, key);
    }
  }

  _fallbackHmac(data, key) {
    return this._fallbackHash(data + key);
  }

  /**
   * UUID
   */
  randomUUID() {
    if (this.supported && globalThis.crypto.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    const bytes = this.randomBytes(16);

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = parseInt(bytes[Math.floor(Math.random() * bytes.length)], 16);
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  base64UrlEncode(data) {
    const encoded = btoa(unescape(encodeURIComponent(data)));

    return encoded
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  base64UrlDecode(data) {
    data = data.replace(/-/g, '+').replace(/_/g, '/');

    while (data.length % 4) {
      data += '=';
    }

    return decodeURIComponent(escape(atob(data)));
  }

  generateKeyPair() {
    const secret = this.randomToken(32);
    const id = this.randomToken(8);

    return {
      id,
      secret,
      createdAt: Date.now()
    };
  }

  async createToken(payload, secret, expiresIn = 24 * 60 * 60 * 1000) {

    if (JSON.stringify(payload).length > 10000) {
      throw new Error("Payload too large");
    }

    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Date.now();

    const body = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedBody = this.base64UrlEncode(JSON.stringify(body));

    const signature = await this.createHmac(
      `${encodedHeader}.${encodedBody}`,
      secret
    );

    return `${encodedHeader}.${encodedBody}.${signature}`;
  }

  async verifyToken(token, secret) {
    try {
      const [encodedHeader, encodedBody, signature] = token.split('.');

      if (!encodedHeader || !encodedBody || !signature) {
        return null;
      }

      const expectedSignature = await this.createHmac(
        `${encodedHeader}.${encodedBody}`,
        secret
      );

      if (!this.secureCompare(signature, expectedSignature)) {
        return null;
      }

      const body = JSON.parse(this.base64UrlDecode(encodedBody));

      if (body.exp && Date.now() > body.exp) {
        return null;
      }

      return body;

    } catch {
      return null;
    }
  }

  async encrypt(data, password) {
    if (!this.supported) {
      throw new Error('Chiffrement non supporté dans cet environnement');
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await globalThis.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );

    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);

    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    const binary = Array.from(result)
      .map(b => String.fromCharCode(b))
      .join('');

    return btoa(binary);
  }

  async decrypt(encryptedData, password) {

    if (!encryptedData || typeof encryptedData !== "string") {
      throw new Error("Invalid encrypted data");
    }

    if (!this.supported) {
      throw new Error('Déchiffrement non supporté dans cet environnement');
    }

    const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await globalThis.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  secureCompare(a, b) {

    if (
      !(typeof a === "string" || a instanceof Uint8Array) ||
      !(typeof b === "string" || b instanceof Uint8Array)
    ) {
      return false;
    }

    if (a.length !== b.length) {
      return false;
    }

    let result = 0;

    for (let i = 0; i < a.length; i++) {
      const ac = typeof a === "string" ? a.charCodeAt(i) : a[i];
      const bc = typeof b === "string" ? b.charCodeAt(i) : b[i];
      result |= ac ^ bc;
    }

    return result === 0;
  }

  getStats() {
    return {
      supported: this.supported,
      initialized: this.initialized,
      algorithms: {
        hash: HASH_ALGORITHM,
        hmac: HMAC_ALGORITHM
      }
    };
  }
}

// =============================
// HOOK REACT
// =============================

export const useCrypto = () => {
  const [crypto] = useState(() => new CryptoUtils());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    crypto.initialize().then(() => setReady(true));
  }, [crypto]);

  return {
    ready,
    crypto,
    randomBytes: crypto.randomBytes.bind(crypto),
    randomToken: crypto.randomToken.bind(crypto),
    createHash: crypto.createHash.bind(crypto),
    createHmac: crypto.createHmac.bind(crypto),
    randomUUID: crypto.randomUUID.bind(crypto),
    encrypt: crypto.encrypt.bind(crypto),
    decrypt: crypto.decrypt.bind(crypto)
  };
};

// =============================
// EXPORT
// =============================

export const crypto = new CryptoUtils();
export default crypto;
