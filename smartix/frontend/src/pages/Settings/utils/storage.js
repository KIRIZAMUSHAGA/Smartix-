// utils/storage.js

// =============================
// 1️⃣ CONSTANTES
// =============================
const STORAGE_VERSION = 'v1';
const PREFIX = `smartix-${STORAGE_VERSION}`;

// Une seule source de vérité pour la version
export const CURRENT_VERSION = STORAGE_VERSION;

export const STORAGE_KEYS = {
  // Paramètres utilisateur
  FONT_SIZE: `${PREFIX}-font-size`,
  ANIMATIONS: `${PREFIX}-animations-enabled`,
  LANGUAGE: `${PREFIX}-language`,
  REGION: `${PREFIX}-region`,
  NOTIFICATIONS: `${PREFIX}-notification-settings`,
  CONTENT: `${PREFIX}-content-settings`,
  PERFORMANCE: `${PREFIX}-performance-settings`,
  ACCESSIBILITY: `${PREFIX}-accessibility-settings`,
  FEED: `${PREFIX}-feed-settings`,
  INTERESTS: `${PREFIX}-interests`,
  FAV: `${PREFIX}-fav-settings`,
  FILTER: `${PREFIX}-filter-settings`,
  AI: `${PREFIX}-ai-settings`,
  STUDY: `${PREFIX}-study-settings`,
  HIDDEN: `${PREFIX}-hidden-content`,
  
  // Session (ne sont pas effacés par clearAllSettings)
  SESSION_TOKEN: `${PREFIX}-session-token`,
  REMEMBER_ME: `${PREFIX}-remember-me`,
  VERSION: `${PREFIX}-version`
};

// Liste des clés de paramètres (pour clearAllSettings)
const SETTINGS_KEYS = [
  'FONT_SIZE', 'ANIMATIONS', 'LANGUAGE', 'REGION',
  'NOTIFICATIONS', 'CONTENT', 'PERFORMANCE', 'ACCESSIBILITY',
  'FEED', 'INTERESTS', 'FAV', 'FILTER', 'AI', 'STUDY', 'HIDDEN'
];

// Clés critiques (ne jamais supprimer)
const CRITICAL_KEYS = ['VERSION', 'SESSION_TOKEN', 'REMEMBER_ME'];

// =============================
// 2️⃣ VALIDATION DES CLÉS (avec fallback)
// =============================
const isValidKey = (key) => {
  return Object.prototype.hasOwnProperty.call(STORAGE_KEYS, key);
};

const getStorageKey = (key) => {
  if (isValidKey(key)) {
    return STORAGE_KEYS[key];
  }
  // Fallback: utiliser key directe (pour compatibilité dynamique)
  console.warn(`[storage] Clé non enregistrée: ${key}, utilisation directe`);
  return key;
};

// =============================
// 3️⃣ GESTION DES DONNÉES AVEC TTL ET PURGE
// =============================
const serializeWithTTL = (value, ttl = null) => {
  const data = {
    value,
    timestamp: Date.now(),
    version: CURRENT_VERSION
  };
  if (ttl) {
    data.expiry = Date.now() + ttl;
  }
  return JSON.stringify(data);
};

const deserializeWithTTL = (saved, storageKey) => {
  try {
    const data = JSON.parse(saved);
    
    // Vérifier l'expiration et PURGER
    if (data.expiry && Date.now() > data.expiry) {
      try {
        localStorage.removeItem(storageKey);
        console.log(`[storage] Données expirées et purgées: ${storageKey}`);
      } catch (e) {
        console.warn(`[storage] Impossible de purger ${storageKey}`);
      }
      return null;
    }
    
    // Vérifier la version (migration automatique)
    if (data.version !== CURRENT_VERSION) {
      console.log(`[storage] Migration détectée pour ${storageKey}`);
      // Retourner la valeur brute pour migration ultérieure
      return data.value;
    }
    
    return data.value;
  } catch {
    // Ancienne donnée sans format (string brute)
    // On la convertit au nouveau format automatiquement.
    // Note: l'ancienne version utilisait `arguments[1]` ici, ce qui était
    // doublement faux : (1) une fonction fléchée n'a pas d'objet `arguments`,
    // (2) `storageKey` est déjà reçu en paramètre. On l'utilise directement.
    const rawValue = saved;
    try {
      if (storageKey) {
        const newValue = serializeWithTTL(rawValue);
        localStorage.setItem(storageKey, newValue);
      }
    } catch (e) {}
    return rawValue;
  }
};

// =============================
// 4️⃣ MIGRATION AUTOMATIQUE
// =============================
const migrate = async () => {
  const savedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
  
  // Première installation
  if (!savedVersion) {
    storage.set('VERSION', CURRENT_VERSION);
    console.log('[storage] Initialisation du storage version', CURRENT_VERSION);
    return true;
  }
  
  // Version identique
  if (savedVersion === CURRENT_VERSION) return true;
  
  console.log(`[storage] Migration de ${savedVersion} vers ${CURRENT_VERSION}`);
  
  // Migration depuis une version plus ancienne
  if (savedVersion === 'v0') {
    // Migration des anciennes clés (exemple)
    const oldKeys = [
      'smartix-font-size', 'smartix-language', 'smartix-animations-enabled'
    ];
    
    oldKeys.forEach(oldKey => {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue !== null) {
        // Déterminer la nouvelle clé
        if (oldKey === 'smartix-font-size') {
          storage.set('FONT_SIZE', oldValue);
        } else if (oldKey === 'smartix-language') {
          storage.set('LANGUAGE', oldValue);
        } else if (oldKey === 'smartix-animations-enabled') {
          storage.set('ANIMATIONS', oldValue === 'true');
        }
        localStorage.removeItem(oldKey);
      }
    });
  }
  
  // Mettre à jour la version
  storage.set('VERSION', CURRENT_VERSION);
  console.log('[storage] Migration terminée');
  return true;
};

// =============================
// 5️⃣ STORAGE PRINCIPAL
// =============================
export const storage = {
  /**
   * Récupère une valeur du localStorage
   */
  get: (key, defaultValue) => {
    try {
      const storageKey = getStorageKey(key);
      const saved = localStorage.getItem(storageKey);
      if (saved === null) return defaultValue;
      
      const value = deserializeWithTTL(saved, storageKey);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.error(`[storage] Erreur de lecture pour ${key}:`, error);
      return defaultValue;
    }
  },

  /**
   * Sauvegarde une valeur avec TTL optionnel
   */
  set: (key, value, ttl = null) => {
    try {
      const storageKey = getStorageKey(key);
      const stringValue = serializeWithTTL(value, ttl);
      localStorage.setItem(storageKey, stringValue);
      return true;
    } catch (error) {
      console.error(`[storage] Erreur d'écriture pour ${key}:`, error);
      return false;
    }
  },

  /**
   * Sauvegarde multiple (best effort)
   */
  batch: (updates) => {
    let allSuccess = true;
    const results = {};
    
    try {
      Object.entries(updates).forEach(([key, value]) => {
        const success = storage.set(key, value);
        results[key] = success;
        if (!success) allSuccess = false;
      });
      return { success: allSuccess, results };
    } catch (error) {
      console.error('[storage] Erreur batch:', error);
      return { success: false, results, error };
    }
  },

  /**
   * Supprime une valeur
   */
  remove: (key) => {
    try {
      const storageKey = getStorageKey(key);
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.error(`[storage] Erreur de suppression pour ${key}:`, error);
      return false;
    }
  },

  /**
   * Supprime UNIQUEMENT les paramètres utilisateur
   */
  clearAllSettings: () => {
    let success = true;
    SETTINGS_KEYS.forEach(key => {
      try {
        const storageKey = STORAGE_KEYS[key];
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error(`[storage] Erreur de suppression pour ${key}:`, error);
        success = false;
      }
    });
    return success;
  },

  /**
   * Supprime TOUT (usage limité - PROTECTION)
   */
  clearAll: () => {
    console.warn('[storage] clearAll appelé - ceci supprimera TOUTES les données');
    if (typeof window !== 'undefined' && window.confirm) {
      const confirm = window.confirm('⚠️ Supprimer TOUTES les données ? Cette action est irréversible.');
      if (!confirm) return false;
    }
    
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('[storage] Erreur clearAll:', error);
      return false;
    }
  },

  /**
   * Vérifie l'existence d'une clé
   */
  has: (key) => {
    try {
      const storageKey = getStorageKey(key);
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  },

  /**
   * Récupère la version du storage
   */
  getVersion: () => {
    return storage.get('VERSION', CURRENT_VERSION);
  },

  /**
   * Migration explicite
   */
  migrate
};

// =============================
// 6️⃣ SESSION STORAGE AVEC NAMESPACE
// =============================
export const sessionStorageWrapper = {
  get: (key, defaultValue) => {
    try {
      const sessionKey = `${PREFIX}-${key}`;
      const saved = sessionStorage.getItem(sessionKey);
      if (saved === null) return defaultValue;
      
      const data = JSON.parse(saved);
      if (data.expiry && Date.now() > data.expiry) {
        sessionStorage.removeItem(sessionKey);
        return defaultValue;
      }
      return data.value;
    } catch {
      return defaultValue;
    }
  },

  set: (key, value, ttl = null) => {
    try {
      const sessionKey = `${PREFIX}-${key}`;
      const data = {
        value,
        timestamp: Date.now()
      };
      if (ttl) data.expiry = Date.now() + ttl;
      sessionStorage.setItem(sessionKey, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  remove: (key) => {
    try {
      const sessionKey = `${PREFIX}-${key}`;
      sessionStorage.removeItem(sessionKey);
      return true;
    } catch {
      return false;
    }
  },

  clear: () => {
    try {
      // Ne supprimer que les clés Smartix
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(PREFIX)) {
          sessionStorage.removeItem(key);
        }
      }
      return true;
    } catch {
      return false;
    }
  }
};

// =============================
// 7️⃣ UTILITAIRES
// =============================
export const getStorageByRememberMe = (rememberMe) => {
  return rememberMe ? storage : sessionStorageWrapper;
};

// Migration automatique au chargement
if (typeof window !== 'undefined') {
  migrate();
}

export default storage;
