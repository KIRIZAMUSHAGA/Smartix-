/**
 * encryption.js - Chiffrement AES-256 côté client pour les secrets
 *
 * Utilise l'API Web Crypto (AES-GCM + PBKDF2)
 * Compatible avec utils/crypto.js existant
 *
 * Usage :
 *   const enc = await encryptValue('ma_valeur_secrete', 'mot_de_passe');
 *   const dec = await decryptValue(enc, 'mot_de_passe');
 */

// =============================
// CLÉ DE DÉRIVATION
// =============================

const DEFAULT_MASTER_KEY = 'vibe-coding-default-key-v1';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

function getMasterKey() {
  try {
    let key = localStorage.getItem('vibe_enc_master');
    if (!key) {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      key = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('vibe_enc_master', key);
    }
    return key;
  } catch {
    return DEFAULT_MASTER_KEY;
  }
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// =============================
// CHIFFREMENT
// =============================

export async function encryptValue(plaintext, password = null) {
  if (!crypto.subtle) throw new Error('Web Crypto non disponible');

  const pw = password || getMasterKey();
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await deriveKey(pw, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_LENGTH);
  result.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);

  return btoa(String.fromCharCode(...result));
}

// =============================
// DÉCHIFFREMENT
// =============================

export async function decryptValue(ciphertext, password = null) {
  if (!crypto.subtle) throw new Error('Web Crypto non disponible');
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;

  const pw = password || getMasterKey();
  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  const salt = data.slice(0, SALT_LENGTH);
  const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = data.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(pw, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

// =============================
// HELPERS POUR ENVPANEL
// =============================

export async function encryptEnvVars(vars) {
  const result = [];
  for (const v of vars) {
    try {
      const encryptedValue = await encryptValue(v.value);
      result.push({ ...v, value: encryptedValue, _encrypted: true });
    } catch {
      result.push(v);
    }
  }
  return result;
}

export async function decryptEnvVars(vars) {
  const result = [];
  for (const v of vars) {
    if (v._encrypted) {
      try {
        const decryptedValue = await decryptValue(v.value);
        result.push({ ...v, value: decryptedValue, _encrypted: false });
      } catch {
        result.push({ ...v, value: '', _encrypted: false });
      }
    } else {
      result.push(v);
    }
  }
  return result;
}

export const isEncryptionAvailable = () => {
  return !!(typeof crypto !== 'undefined' && crypto.subtle);
};
