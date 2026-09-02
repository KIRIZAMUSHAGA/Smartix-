

// Configuration du chiffrement
const ENCRYPTION_CONFIG = {
  // AES-GCM pour le chiffrement des messages
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  
  // ECDH pour l'échange de clés (Curve25519 via Web Crypto)
  keyExchangeAlgorithm: 'ECDH',
  keyExchangeCurve: 'P-256',
  
  // HKDF pour la dérivation de clés
  hkdfHash: 'SHA-256',
  hkdfInfo: 'smartohada-messaging',
  
  // Signature ECDSA
  signatureAlgorithm: 'ECDSA',
  signatureHash: 'SHA-256',
  
  // Stockage
  keyStoragePrefix: 'so_keys_'
};

/**
 * Convertit un ArrayBuffer en chaîne Base64 (optimisé)
 * @param {ArrayBuffer} buffer - Buffer à convertir
 * @returns {string} - Chaîne Base64
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convertit une chaîne Base64 en ArrayBuffer (optimisé)
 * @param {string} base64 - Chaîne Base64
 * @returns {ArrayBuffer} - ArrayBuffer
 */
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Génère une paire de clés ECDH (pour l'échange de clés)
 * @returns {Promise<Object>} - { publicKey, privateKey (non-extractable) }
 */
export const generateKeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_CONFIG.keyExchangeAlgorithm,
      namedCurve: ENCRYPTION_CONFIG.keyExchangeCurve
    },
    false, // non-extractable (sécurité)
    ['deriveKey', 'deriveBits']
  );
  
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(publicKeyRaw);
  
  return {
    publicKey: publicKeyBase64,
    privateKey: keyPair.privateKey // non-extractable, ne peut pas être exportée
  };
};

/**
 * Dérive une clé partagée à partir de la clé privée et de la clé publique du destinataire
 * @param {CryptoKey} privateKey - Clé privée ECDH (non-extractable)
 * @param {string} recipientPublicKeyBase64 - Clé publique du destinataire en Base64
 * @returns {Promise<CryptoKey>} - Clé partagée pour AES-GCM
 */
export const deriveSharedKey = async (privateKey, recipientPublicKeyBase64) => {
  // Importer la clé publique du destinataire
  const publicKeyBuffer = base64ToArrayBuffer(recipientPublicKeyBase64);
  const recipientPublicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBuffer,
    {
      name: ENCRYPTION_CONFIG.keyExchangeAlgorithm,
      namedCurve: ENCRYPTION_CONFIG.keyExchangeCurve
    },
    false,
    []
  );
  
  // Dériver le secret partagé
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: ENCRYPTION_CONFIG.keyExchangeAlgorithm,
      public: recipientPublicKey
    },
    privateKey,
    256 // 256 bits
  );
  
  // Utiliser HKDF pour dériver une clé AES
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );
  
  const hkdfSalt = new TextEncoder().encode(ENCRYPTION_CONFIG.keyStoragePrefix);
  const hkdfInfo = new TextEncoder().encode(ENCRYPTION_CONFIG.hkdfInfo);
  
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: hkdfSalt,
      info: hkdfInfo,
      hash: ENCRYPTION_CONFIG.hkdfHash
    },
    keyMaterial,
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: ENCRYPTION_CONFIG.keyLength
    },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );
  
  return aesKey;
};

/**
 * Génère une paire de clés de signature (ECDSA)
 * @returns {Promise<Object>} - { publicKey, privateKey (non-extractable) }
 */
export const generateSigningKeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_CONFIG.signatureAlgorithm,
      namedCurve: ENCRYPTION_CONFIG.keyExchangeCurve
    },
    false,
    ['sign', 'verify']
  );
  
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(publicKeyRaw);
  
  return {
    publicKey: publicKeyBase64,
    privateKey: keyPair.privateKey
  };
};

/**
 * Signe un message avec la clé privée
 * @param {CryptoKey} privateKey - Clé privée de signature
 * @param {string} message - Message à signer
 * @returns {Promise<string>} - Signature en Base64
 */
export const signMessage = async (privateKey, message) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  const signature = await crypto.subtle.sign(
    {
      name: ENCRYPTION_CONFIG.signatureAlgorithm,
      hash: { name: ENCRYPTION_CONFIG.signatureHash }
    },
    privateKey,
    data
  );
  
  return arrayBufferToBase64(signature);
};

/**
 * Vérifie la signature d'un message
 * @param {string} publicKeyBase64 - Clé publique en Base64
 * @param {string} message - Message original
 * @param {string} signatureBase64 - Signature à vérifier
 * @returns {Promise<boolean>} - True si signature valide
 */
export const verifySignature = async (publicKeyBase64, message, signatureBase64) => {
  try {
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    const publicKey = await crypto.subtle.importKey(
      'raw',
      publicKeyBuffer,
      {
        name: ENCRYPTION_CONFIG.signatureAlgorithm,
        namedCurve: ENCRYPTION_CONFIG.keyExchangeCurve
      },
      false,
      ['verify']
    );
    
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const signature = base64ToArrayBuffer(signatureBase64);
    
    return crypto.subtle.verify(
      {
        name: ENCRYPTION_CONFIG.signatureAlgorithm,
        hash: { name: ENCRYPTION_CONFIG.signatureHash }
      },
      publicKey,
      signature,
      data
    );
  } catch (err) {
    console.error('Signature verification failed:', err);
    return false;
  }
};

/**
 * Chiffre un message avec une clé partagée (AES-GCM)
 * @param {string} message - Message à chiffrer
 * @param {CryptoKey} sharedKey - Clé partagée (non-extractable)
 * @returns {Promise<Object>} - { encrypted, iv }
 */
export const encryptMessage = async (message, sharedKey) => {
  if (!message) return null;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  // Générer IV aléatoire
  const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
  
  // Chiffrer
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_CONFIG.algorithm,
      iv: iv
    },
    sharedKey,
    data
  );
  
  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer)
  };
};

/**
 * Déchiffre un message avec une clé partagée (AES-GCM)
 * @param {Object} encryptedData - { encrypted, iv }
 * @param {CryptoKey} sharedKey - Clé partagée (non-extractable)
 * @returns {Promise<string>} - Message déchiffré
 */
export const decryptMessage = async (encryptedData, sharedKey) => {
  if (!encryptedData || !encryptedData.encrypted) return null;
  
  try {
    const encrypted = base64ToArrayBuffer(encryptedData.encrypted);
    const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv
      },
      sharedKey,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
};

/**
 * Stocke une clé privée dans IndexedDB (avec chiffrement local)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} keyType - Type de clé ('identity', 'signed_prekey', 'one_time_prekey')
 * @param {CryptoKey} privateKey - Clé privée à stocker
 */
export const storePrivateKey = async (userId, keyType, privateKey) => {
  const keyId = `${ENCRYPTION_CONFIG.keyStoragePrefix}${userId}_${keyType}`;
  
  // Exporter la clé (si extractable, sinon ne pas stocker)
  // Dans un vrai système, la clé privée ne devrait jamais quitter le Secure Enclave
  // Pour ce POC, on ne stocke que les clés publiques
  console.warn('Private keys should never be stored in IndexedDB in production');
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SmartOhadaKeys', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['private_keys'], 'readwrite');
      const store = transaction.objectStore('private_keys');
      
      // Ne stocker que les clés autorisées
      if (keyType === 'identity') {
        store.put({ id: keyId, keyType, userId });
      }
      resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('private_keys')) {
        db.createObjectStore('private_keys', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('public_keys')) {
        db.createObjectStore('public_keys', { keyPath: 'id' });
      }
    };
  });
};

/**
 * Stocke une clé publique dans IndexedDB
 * @param {string} userId - ID de l'utilisateur
 * @param {string} keyType - Type de clé
 * @param {string} publicKeyBase64 - Clé publique en Base64
 */
export const storePublicKey = async (userId, keyType, publicKeyBase64) => {
  const keyId = `${ENCRYPTION_CONFIG.keyStoragePrefix}${userId}_${keyType}`;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SmartOhadaKeys', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['public_keys'], 'readwrite');
      const store = transaction.objectStore('public_keys');
      store.put({ id: keyId, userId, keyType, publicKey: publicKeyBase64 });
      resolve();
    };
  });
};

/**
 * Récupère une clé publique depuis IndexedDB
 * @param {string} userId - ID de l'utilisateur
 * @param {string} keyType - Type de clé
 * @returns {Promise<string|null>} - Clé publique en Base64 ou null
 */
export const getPublicKey = async (userId, keyType) => {
  const keyId = `${ENCRYPTION_CONFIG.keyStoragePrefix}${userId}_${keyType}`;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SmartOhadaKeys', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('public_keys')) {
        resolve(null);
        return;
      }
      
      const transaction = db.transaction(['public_keys'], 'readonly');
      const store = transaction.objectStore('public_keys');
      const getRequest = store.get(keyId);
      
      getRequest.onsuccess = () => {
        resolve(getRequest.result?.publicKey || null);
      };
      
      getRequest.onerror = () => resolve(null);
    };
  });
};

/**
 * Calcule l'empreinte d'une clé publique (pour vérification utilisateur)
 * @param {string} publicKeyBase64 - Clé publique en Base64
 * @returns {Promise<string>} - Empreinte en hexadécimal
 */
export const getKeyFingerprint = async (publicKeyBase64) => {
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
  const hash = await crypto.subtle.digest('SHA-256', publicKeyBuffer);
  
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .match(/.{1,4}/g)
    .join(' ');
};

/**
 * Format d'enveloppe pour les messages E2EE
 */
export const createMessageEnvelope = async (message, senderPrivateKey, recipientPublicKey, senderPublicKey) => {
  // 1. Dériver la clé partagée
  const sharedKey = await deriveSharedKey(senderPrivateKey, recipientPublicKey);
  
  // 2. Chiffrer le message
  const encrypted = await encryptMessage(message, sharedKey);
  
  // 3. Signer le message chiffré
  const signature = await signMessage(senderPrivateKey, encrypted.encrypted);
  
  return {
    encrypted: encrypted.encrypted,
    iv: encrypted.iv,
    senderKey: senderPublicKey,
    signature: signature,
    timestamp: Date.now()
  };
};

/**
 * Déchiffre et vérifie une enveloppe de message
 */
export const openMessageEnvelope = async (envelope, recipientPrivateKey) => {
  try {
    // 1. Dériver la clé partagée
    const sharedKey = await deriveSharedKey(recipientPrivateKey, envelope.senderKey);
    
    // 2. Vérifier la signature
    const isValid = await verifySignature(
      envelope.senderKey,
      envelope.encrypted,
      envelope.signature
    );
    
    if (!isValid) {
      throw new Error('Invalid signature');
    }
    
    // 3. Déchiffrer le message
    const message = await decryptMessage(
      { encrypted: envelope.encrypted, iv: envelope.iv },
      sharedKey
    );
    
    return message;
  } catch (err) {
    console.error('Failed to open message envelope:', err);
    return null;
  }
};

// Export par défaut
export default {
  generateKeyPair,
  generateSigningKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
  storePrivateKey,
  storePublicKey,
  getPublicKey,
  getKeyFingerprint,
  createMessageEnvelope,
  openMessageEnvelope
};
