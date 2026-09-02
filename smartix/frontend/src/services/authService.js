/**
 * Service d'authentification - Gestion des tokens
 * Version Hardened avec gestion des risques
 */

import axios from 'axios';
import { API } from '../config/api';

// Note: This service uses raw axios (not axiosInstance) intentionally
// to avoid circular dependencies. Token refresh is handled manually here.

// =============================
// 1️⃣ CONFIGURATION
// =============================

const CONFIG = {
  FETCH_TIMEOUT: 4000,
  REFRESH_TIMEOUT: 10000,
  REFRESH_LOCK_DELAY: 100,
  TOKEN_EXPIRY_BUFFER: 60000 // 1 minute avant expiration
};

// =============================
// 2️⃣ CLIENT AXIOS DÉDIÉ
// =============================

const authApi = axios.create({
  baseURL: API.replace(/\/api$/, ''),
  timeout: CONFIG.REFRESH_TIMEOUT,
  withCredentials: true
});

// =============================
// 3️⃣ STOCKAGE SÉCURISÉ
// =============================

// Stockage en mémoire
let memoryState = {
  accessToken: null,
  refreshToken: null,
  currentUser: null,
  tokenExpiry: null
};

// Écouter les modifications du localStorage (pour détecter changements externes)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'access_token' || event.key === 'refresh_token' || event.key === 'user') {
      console.log('🔄 Détection modification externe localStorage, synchronisation...');
      synchronizeFromStorage();
    }
  });
}

/**
 * Synchronise la mémoire avec le storage (après modification externe)
 */
const synchronizeFromStorage = () => {
  const storedAccessToken = getFromStorage('access_token');
  const storedRefreshToken = getFromStorage('refresh_token');
  const storedUser = getFromStorage('user');

  if (storedAccessToken !== memoryState.accessToken) {
    memoryState.accessToken = storedAccessToken;
    updateAuthHeader(storedAccessToken);
  }
  
  if (storedRefreshToken !== memoryState.refreshToken) {
    memoryState.refreshToken = storedRefreshToken;
  }
  
  if (storedUser !== JSON.stringify(memoryState.currentUser)) {
    try {
      memoryState.currentUser = storedUser ? JSON.parse(storedUser) : null;
    } catch {
      memoryState.currentUser = null;
    }
  }
};

// Listeners pour les changements d'état (reçoivent maintenant { user, token })
const authStateListeners = [];

// ⚡ VERROU GLOBAL pour éviter les appels multiples de refresh
let isRefreshing = false;
let refreshPromise = null;

// Flag pour éviter les initialisations multiples (React StrictMode)
let isInitialized = false;
let initPromise = null;

/**
 * Détermine le storage à utiliser selon rememberMe
 */
const getStorage = () => {
  const rememberMe = localStorage.getItem('rememberMe') === 'true';
  return rememberMe ? localStorage : sessionStorage;
};

/**
 * Récupère une valeur depuis le storage approprié avec validation
 */
const getFromStorage = (key) => {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch (e) {
    console.warn(`⚠️ Impossible d'accéder au storage pour ${key}:`, e);
    return null;
  }
};

/**
 * Sauvegarde une valeur dans le storage approprié avec validation
 */
const setInStorage = (key, value) => {
  try {
    const storage = getStorage();
    if (value === null || value === undefined) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, value);
    }
    return true;
  } catch (e) {
    console.warn(`⚠️ Impossible d'écrire dans le storage pour ${key}:`, e);
    return false;
  }
};

/**
 * Supprime une valeur des deux storages
 */
const removeFromAllStorage = (key) => {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch (e) {
    console.warn(`⚠️ Impossible de supprimer ${key} du storage:`, e);
  }
};

/**
 * Met à jour le header Authorization
 */
const updateAuthHeader = (token) => {
  if (token) {
    authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete authApi.defaults.headers.common['Authorization'];
  }
};

// =============================
// 4️⃣ NOTIFICATIONS
// =============================

/**
 * Notifie tous les listeners d'un changement d'état
 */
const notifyAuthStateChange = (user, token) => {
  const state = { user, token, timestamp: Date.now() };
  authStateListeners.forEach(listener => {
    try {
      listener(state);
    } catch (e) {
      console.error('❌ Erreur dans un listener auth:', e);
    }
  });
};

/**
 * Ajoute un listener pour les changements d'état d'authentification
 */
export const addAuthStateListener = (listener) => {
  authStateListeners.push(listener);
  // Envoyer l'état actuel immédiatement
  listener({ 
    user: memoryState.currentUser, 
    token: memoryState.accessToken,
    timestamp: Date.now()
  });
};

/**
 * Retire un listener
 */
export const removeAuthStateListener = (listener) => {
  const index = authStateListeners.indexOf(listener);
  if (index > -1) {
    authStateListeners.splice(index, 1);
  }
};

// =============================
// 5️⃣ GESTION DES TOKENS
// =============================

/**
 * Définit le token d'accès
 */
export const setAccessToken = (token, expiry = null) => {
  memoryState.accessToken = token;
  memoryState.tokenExpiry = expiry;
  
  if (token) {
    setInStorage('access_token', token);
    if (expiry) setInStorage('token_expiry', expiry);
    updateAuthHeader(token);
  } else {
    removeFromAllStorage('access_token');
    removeFromAllStorage('token_expiry');
    updateAuthHeader(null);
  }
};

/**
 * Récupère le token d'accès avec vérification d'expiration
 */
export const getAccessToken = () => {
  // Si pas en mémoire, essayer le storage
  if (!memoryState.accessToken) {
    memoryState.accessToken = getFromStorage('access_token');
    memoryState.tokenExpiry = getFromStorage('token_expiry');
    
    if (memoryState.accessToken) {
      updateAuthHeader(memoryState.accessToken);
    }
  }

  // Vérifier si le token est expiré ou va expirer
  if (memoryState.tokenExpiry) {
    const now = Date.now();
    const expiry = parseInt(memoryState.tokenExpiry);
    if (expiry - now < CONFIG.TOKEN_EXPIRY_BUFFER) {
      console.log('⚠️ Token proche de l\'expiration, refresh recommandé');
      // Ne pas supprimer automatiquement, laisser le refresh handler décider
    }
  }

  return memoryState.accessToken;
};

/**
 * Définit le refresh token
 */
export const setRefreshToken = (token) => {
  memoryState.refreshToken = token;
  if (token) {
    setInStorage('refresh_token', token);
  } else {
    removeFromAllStorage('refresh_token');
  }
};

/**
 * Récupère le refresh token
 */
export const getRefreshToken = () => {
  if (!memoryState.refreshToken) {
    memoryState.refreshToken = getFromStorage('refresh_token');
  }
  return memoryState.refreshToken;
};

/**
 * Définit l'utilisateur actuel
 */
export const setCurrentUser = (user) => {
  memoryState.currentUser = user;
  if (user) {
    try {
      setInStorage('user', JSON.stringify(user));
    } catch (e) {
      console.error('❌ Erreur sérialisation user:', e);
    }
  } else {
    removeFromAllStorage('user');
  }
  notifyAuthStateChange(user, memoryState.accessToken);
};

/**
 * Récupère l'utilisateur actuel
 */
export const getCurrentUser = () => {
  if (!memoryState.currentUser) {
    const storedUser = getFromStorage('user');
    if (storedUser) {
      try {
        memoryState.currentUser = JSON.parse(storedUser);
        // Validation basique
        if (!memoryState.currentUser?.id) {
          throw new Error('User data corrupted');
        }
      } catch (error) {
        console.error('❌ Erreur parsing user:', error);
        removeFromAllStorage('user');
        memoryState.currentUser = null;
      }
    }
  }
  return memoryState.currentUser;
};

// =============================
// 6️⃣ REFRESH TOKEN
// =============================

/**
 * Rafraîchit l'access token avec verrouillage robuste
 */
export const refreshAccessToken = async () => {
  // Si un refresh est déjà en cours, attendre son résultat
  if (isRefreshing && refreshPromise) {
    console.log('🔄 Refresh déjà en cours, attente...');
    return refreshPromise;
  }

  const refresh = getRefreshToken();

  if (!refresh) {
    console.warn('🔒 Pas de refresh token - Déconnexion nécessaire');
    await logout();
    throw new Error('No refresh token available');
  }

  // Activer le verrou
  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      console.log('🔄 Rafraîchissement du token...');

      const response = await authApi.post(`/api/auth/refresh`, {});

      if (response.status === 401) {
        throw new Error('Refresh token invalide');
      }

      const { access_token, refresh_token: new_refresh, expires_in } = response.data;

      // Calculer la date d'expiration
      const expiry = expires_in ? Date.now() + (expires_in * 1000) : null;

      // Mettre à jour les tokens
      setAccessToken(access_token, expiry);
      if (new_refresh) setRefreshToken(new_refresh);

      console.log('✅ Token rafraîchi avec succès');
      
      return access_token;
    } catch (error) {
      console.error('❌ Erreur refresh token:', error.response?.data?.detail || error.message);

      // Si le refresh token est invalide, déconnecter complètement
      if (error.response?.status === 401 || error.message === 'Refresh token invalide') {
        await logout();
      }

      throw error;
    } finally {
      // Libérer le verrou APRÈS la fin réelle de la promesse
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Récupère les informations de l'utilisateur connecté
 */
export const fetchCurrentUser = async () => {
  try {
    const token = getAccessToken();

    if (!token) {
      return { user: null, token: null };
    }

    const response = await authApi.get(`/api/auth/me`, {
      timeout: CONFIG.FETCH_TIMEOUT
    });

    const userData = response.data.user || response.data;
    
    // Valider les données reçues
    if (!userData?.id) {
      throw new Error('Invalid user data received');
    }

    setCurrentUser(userData);

    return { user: userData, token };
  } catch (error) {
    console.error('❌ Erreur récupération utilisateur:', error);
    throw error;
  }
};

/**
 * Initialise la session au démarrage
 */
export const initializeAuth = async () => {
  if (isInitialized) {
    return { user: memoryState.currentUser, token: memoryState.accessToken };
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('🔐 [AuthService] Début init...');
      
      // Synchroniser avec le storage au cas où
      synchronizeFromStorage();
      
      const storedAccessToken = getFromStorage('access_token');
      const storedUser = getFromStorage('user');

      if (!storedAccessToken || !storedUser) {
        console.log('🔐 [AuthService] Aucun token trouvé');
        isInitialized = true;
        return { user: null, token: null };
      }

      console.log('🔐 [AuthService] Tentative de récupération user...');
      
      try {
        const { user, token } = await fetchCurrentUser();
        isInitialized = true;
        return { user, token };
      } catch (error) {
        console.warn('🔐 [AuthService] Échec fetchUser, tentative refresh...', error.message);
        
        try {
          await refreshAccessToken();
          const { user, token } = await fetchCurrentUser();
          isInitialized = true;
          return { user, token };
        } catch (refreshErr) {
          console.error('🔐 [AuthService] Échec complet init');
          await clearSession();
          isInitialized = true;
          return { user: null, token: null };
        }
      }
    } catch (critical) {
      console.error('🔐 [AuthService] Erreur critique init:', critical);
      isInitialized = true;
      return { user: null, token: null };
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

/**
 * Nettoie la session
 */
const clearSession = async () => {
  setAccessToken(null);
  setRefreshToken(null);
  setCurrentUser(null);
  localStorage.removeItem('rememberMe');
  console.log('✅ Session nettoyée');
};

/**
 * Connexion
 */
export const login = async (email, password, rememberMe = false) => {
  try {
    // Sauvegarder la préférence rememberMe
    localStorage.setItem('rememberMe', rememberMe);

    const response = await authApi.post(`/api/auth/login`, {
      email,
      password
    }, {
      // La connexion implique vérification du mot de passe (bcrypt) et
      // émission de tokens : on alloue un timeout dédié plus large que le
      // REFRESH_TIMEOUT par défaut (10 s) pour éviter les coupures sur
      // réseaux lents ou backend chargé.
      timeout: 60000
    });

    const { access_token, refresh_token, user, expires_in } = response.data;

    const expiry = expires_in ? Date.now() + (expires_in * 1000) : null;
    
    setAccessToken(access_token, expiry);
    setRefreshToken(refresh_token);

    const { user: fullUser, token } = await fetchCurrentUser();

    isInitialized = true;

    return { user: fullUser, token };
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    throw error;
  }
};

/**
 * Inscription
 */
export const register = async (email, password, full_name, username = null, additionalData = null) => {
  try {
    // Le handler backend `register(user_data: UserRegister)` est typé pour
    // recevoir un body JSON (Pydantic BaseModel). On envoie donc un payload
    // JSON pur — surtout pas de `FormData`, qui forcerait un content-type
    // `multipart/form-data` que Pydantic ne sait pas parser et qui faisait
    // bloquer la requête ~30 s côté serveur avant un 422.
    const payload = {
      email,
      password,
      full_name,
    };
    if (username) payload.username = username;
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          payload[key] = value;
        }
      });
    }

    const response = await authApi.post(`/api/auth/register`, payload, {
      headers: { 'Content-Type': 'application/json' },
      // L'inscription est plus lourde qu'un refresh (hash mot de passe,
      // création en base, génération des tokens) : on alloue un timeout
      // dédié bien plus large que le REFRESH_TIMEOUT par défaut (10 s).
      timeout: 60000
    });

    const { access_token, refresh_token, expires_in } = response.data;

    const expiry = expires_in ? Date.now() + (expires_in * 1000) : null;

    setAccessToken(access_token, expiry);
    setRefreshToken(refresh_token);

    const { user: fullUser, token } = await fetchCurrentUser();

    isInitialized = true;

    return { user: fullUser, token };
  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    throw error;
  }
};

/**
 * Déconnexion avec gestion d'erreur améliorée
 */
export const logout = async () => {
  try {
    const token = getAccessToken();

    if (token) {
      // Timeout court pour ne pas bloquer
      await Promise.race([
        authApi.post(`/api/auth/logout`, {}),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    }
  } catch (error) {
    console.warn('⚠️ Erreur déconnexion API (ignorée):', error.message);
  } finally {
    await clearSession();
    isInitialized = false;
    initPromise = null;
    isRefreshing = false;
    refreshPromise = null;
    console.log('✅ Déconnexion complète');
  }
};

/**
 * Vérifie si l'utilisateur est authentifié
 */
export const isAuthenticated = () => {
  return !!getAccessToken() || !!getRefreshToken();
};

// =============================
// AUTH FÉDÉRÉE — Google OAuth + Phone OTP (Firebase)
// =============================

/**
 * Démarre le flux OAuth Google en redirigeant le navigateur vers
 * /api/auth/google (qui redirige lui-même vers l'écran Google).
 * Utilise rememberMe via localStorage pour la session post-callback.
 */
export const startGoogleOAuth = (rememberMe = false) => {
  try {
    localStorage.setItem('rememberMe', String(!!rememberMe));
  } catch (_) {}
  // L'instance authApi pointe sur le proxy `/api`. On part en redirection
  // top-level (pas en XHR) pour que les cookies state soient posés/lus.
  console.log('[GOOGLE_AUTH] redirecting to:', '/api/auth/google', '| top-level navigation (window.location.assign) | rememberMe stored=', String(!!rememberMe));
  console.log('[GOOGLE_AUTH] document.cookie just before redirect:', document.cookie || '(empty)');
  window.location.assign('/api/auth/google');
};

/**
 * Lit le fragment d'URL #access_token=...&refresh_token=... posé par le
 * callback OAuth, persiste les tokens, et hydrate l'utilisateur courant.
 * À appeler dans la page <AuthCallback />.
 */
export const consumeOAuthHashAndAuthenticate = async () => {
  const hash = window.location.hash || '';
  console.log('[GOOGLE_AUTH] consumeOAuthHashAndAuthenticate — callback URL:', window.location.href);
  console.log('[GOOGLE_AUTH] raw hash:', hash || '(empty)');
  const params = new URLSearchParams(hash.replace(/^#/, ''));

  const error = params.get('error');
  if (error) {
    console.log('[GOOGLE_AUTH] callback error param detected:', error);
    throw new Error(error);
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

  console.log('[GOOGLE_AUTH] token received:', { has_access: !!accessToken, has_refresh: !!refreshToken, expires_in: expiresIn });

  if (!accessToken || !refreshToken) {
    throw new Error('missing_tokens');
  }

  // Effacer l'URL pour ne pas laisser traîner les tokens dans l'historique
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch (_) {}

  const expiry = Date.now() + (expiresIn * 1000);
  setAccessToken(accessToken, expiry);
  setRefreshToken(refreshToken);

  isInitialized = false;
  initPromise = null;

  const { user, token } = await fetchCurrentUser();
  isInitialized = true;
  return { user, token };
};

/**
 * Déclenche l'envoi du code OTP par SMS (relayé par le backend vers Firebase).
 * @param {string} phone — format E.164 (ex: +33612345678)
 * @param {string} recaptchaToken — token reCAPTCHA obtenu côté navigateur
 * @returns {Promise<{ session_info: string }>}
 */
export const phoneSendCode = async (phone, recaptchaToken) => {
  const response = await authApi.post('/api/auth/phone/send-code', {
    phone,
    recaptcha_token: recaptchaToken,
  }, { timeout: 30000 });
  return response.data;
};

/**
 * Vérifie le code OTP saisi et finalise la connexion (mêmes JWT que /auth/login).
 * @returns {Promise<{ user, token }>}
 */
export const phoneVerifyCode = async ({ sessionInfo, code, fullName, rememberMe = false }) => {
  try {
    localStorage.setItem('rememberMe', String(!!rememberMe));
  } catch (_) {}

  const response = await authApi.post('/api/auth/phone/verify-code', {
    session_info: sessionInfo,
    code,
    full_name: fullName || null,
  }, { timeout: 30000 });

  const { access_token, refresh_token, expires_in } = response.data;
  const expiry = expires_in ? Date.now() + (expires_in * 1000) : null;

  setAccessToken(access_token, expiry);
  setRefreshToken(refresh_token);

  isInitialized = false;
  initPromise = null;

  const { user: fullUser, token } = await fetchCurrentUser();
  isInitialized = true;
  return { user: fullUser, token };
};

// =============================
// LIAISON DE COMPTES (utilisateur déjà connecté)
// =============================

/**
 * Démarre un flux OAuth Google en mode LIAISON. Le backend renvoie l'URL
 * d'autorisation à laquelle on redirige le navigateur (top-level).
 * Au retour, le callback redirige vers /profile?linked=google ou
 * ?linked_error=... — c'est /profile qui affiche le toast et rafraîchit.
 */
export const startGoogleLink = async () => {
  // Garantir que le header Authorization est posé (cas hard refresh)
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.get('/api/auth/google/link', { timeout: 10000 });
  const url = response.data?.authorize_url;
  if (!url) throw new Error('authorize_url manquante');
  window.location.assign(url);
};

/**
 * Envoie l'OTP au numéro à rattacher au compte courant.
 */
export const phoneLinkSendCode = async (phone, recaptchaToken) => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.post('/api/auth/phone/link/send-code', {
    phone,
    recaptcha_token: recaptchaToken,
  }, { timeout: 30000 });
  return response.data;
};

/**
 * Vérifie l'OTP et rattache le numéro à l'utilisateur courant.
 * Met à jour le user en mémoire/storage et notifie les listeners (AuthContext).
 * @returns {Promise<object>} le nouvel objet user
 */
export const phoneLinkVerifyCode = async ({ sessionInfo, code }) => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.post('/api/auth/phone/link/verify-code', {
    session_info: sessionInfo,
    code,
  }, { timeout: 30000 });

  const updated = response.data?.user;
  if (updated) setCurrentUser(updated);
  return updated;
};

/**
 * Détache l'identité Google du compte courant.
 * @returns {Promise<object>} le nouvel objet user
 */
export const unlinkGoogle = async () => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.delete('/api/auth/google/unlink', { timeout: 15000 });
  const updated = response.data?.user;
  if (updated) setCurrentUser(updated);
  return updated;
};

/**
 * Détache le numéro de téléphone du compte courant.
 * @returns {Promise<object>} le nouvel objet user
 */
export const unlinkPhone = async () => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.delete('/api/auth/phone/unlink', { timeout: 15000 });
  const updated = response.data?.user;
  if (updated) setCurrentUser(updated);
  return updated;
};

// =============================
// RGPD : EXPORT + SUPPRESSION DE COMPTE
// =============================

/**
 * Télécharge l'intégralité des données de l'utilisateur courant au format JSON.
 * Le backend renvoie un Content-Disposition: attachment ; on récupère un Blob
 * et on déclenche le téléchargement côté navigateur.
 * @returns {Promise<Blob>}
 */
export const exportMyData = async () => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.get('/api/auth/me/export', {
    timeout: 60000,
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Supprime définitivement le compte courant et toutes ses données associées.
 * @param {{ confirmation: string, password?: string }} payload
 * @returns {Promise<object>} récap des suppressions
 */
export const deleteMyAccount = async ({ confirmation, password } = {}) => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.delete('/api/auth/me', {
    timeout: 30000,
    data: { confirmation, password },
  });
  return response.data;
};

// =============================
// SESSIONS ACTIVES
// =============================

/**
 * Liste les sessions (appareils + navigateurs) actuellement connectées
 * sur le compte courant. La session courante est marquée par `is_current=true`.
 * @returns {Promise<Array<{id,device,location,ip,user_agent,last_activity,created_at,expires_at,is_current}>>}
 */
export const listMySessions = async () => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.get('/api/security/sessions', { timeout: 15000 });
  return response.data;
};

/**
 * Révoque une session précise (refusé pour la session courante côté serveur).
 * @param {string} sessionId
 */
export const revokeSession = async (sessionId) => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.post(
    `/api/security/sessions/revoke/${encodeURIComponent(sessionId)}`,
    null,
    { timeout: 15000 }
  );
  return response.data;
};

/**
 * Révoque toutes les sessions sauf la session courante.
 * @returns {Promise<{revoked_count?:number, message?:string}>}
 */
export const revokeAllSessions = async () => {
  const token = getAccessToken();
  if (token) updateAuthHeader(token);

  const response = await authApi.post(
    '/api/security/sessions/revoke-all',
    null,
    { timeout: 15000 }
  );
  return response.data;
};

// Exposer le client authApi pour usage externe si nécessaire
export { authApi };
