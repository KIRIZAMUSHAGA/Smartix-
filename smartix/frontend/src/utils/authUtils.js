

/**
 * Vérifie si le code s'exécute dans un navigateur
 * @returns {boolean}
 */
const isBrowser = () => typeof window !== 'undefined';

/**
 * Vérifie si un utilisateur est authentifié
 * @param {Object} user - L'utilisateur courant
 * @returns {boolean}
 */
export const isAuthenticated = (user) => {
  return !!user && !!user.id;
};

/**
 * Vérifie si l'utilisateur est administrateur
 * @param {Object} user - L'utilisateur courant
 * @returns {boolean}
 */
export const isAdmin = (user) => {
  return isAuthenticated(user) && user.isAdmin === true;
};

/**
 * Vérifie si l'utilisateur est l'auteur d'une ressource
 * @param {Object} user - L'utilisateur courant
 * @param {string|Object} authorId - ID de l'auteur ou objet auteur
 * @returns {boolean}
 */
export const isAuthor = (user, authorId) => {
  if (!isAuthenticated(user)) return false;
  
  const authorIdentifier = typeof authorId === 'object' ? authorId?.id : authorId;
  return user.id === authorIdentifier;
};

/**
 * Vérifie si l'utilisateur peut modifier une ressource (admin ou auteur)
 * @param {Object} user - L'utilisateur courant
 * @param {string|Object} authorId - ID de l'auteur ou objet auteur
 * @returns {boolean}
 */
export const canModify = (user, authorId) => {
  return isAdmin(user) || isAuthor(user, authorId);
};

/**
 * Stocke le token d'authentification (safe SSR)
 * @param {string} token - Token JWT
 * @param {Object} user - Données utilisateur (optionnel)
 */
export const storeAuthData = (token, user = null) => {
  if (!isBrowser()) return;
  
  try {
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch (error) {
    console.error('Failed to store auth data:', error);
  }
};

/**
 * Récupère le token d'authentification (safe SSR)
 * @returns {string|null}
 */
export const getAuthToken = () => {
  if (!isBrowser()) return null;
  return localStorage.getItem('auth_token');
};

/**
 * Récupère les données utilisateur stockées (safe SSR)
 * @returns {Object|null}
 */
export const getStoredUser = () => {
  if (!isBrowser()) return null;
  
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

/**
 * Efface les données d'authentification
 */
export const clearAuthData = () => {
  if (!isBrowser()) return;
  
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  // Ne pas supprimer les données anti-spam
};

/**
 * Vérifie si le token est expiré (basé sur la date d'expiration JWT)
 * @param {string} token - Token JWT
 * @returns {boolean}
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false; // Pas d'expiration
    
    const expirationTime = payload.exp * 1000;
    return Date.now() >= expirationTime;
  } catch {
    return true;
  }
};

/**
 * Rafraîchit le token (appel API)
 * @param {Function} refreshFn - Fonction de rafraîchissement
 * @returns {Promise<string|null>}
 */
export const refreshToken = async (refreshFn) => {
  if (typeof refreshFn !== 'function') {
    console.error('refreshToken: refreshFn must be a function');
    return null;
  }
  
  try {
    const newToken = await refreshFn();
    if (newToken && typeof newToken === 'string') {
      storeAuthData(newToken, null);
      return newToken;
    }
    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearAuthData();
    return null;
  }
};

/**
 * Décode le payload d'un token JWT
 * @param {string} token - Token JWT
 * @returns {Object|null}
 */
export const decodeToken = (token) => {
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
};

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 * Supporte à la fois string simple et tableau de rôles
 * @param {Object} user - L'utilisateur courant
 * @param {string|string[]} roles - Rôle(s) requis
 * @returns {boolean}
 */
export const hasRole = (user, roles) => {
  if (!isAuthenticated(user)) return false;
  
  // Support pour user.role (string) ou user.roles (array)
  const userRoles = user.roles || (user.role ? [user.role] : []);
  if (!userRoles.length && !user.role && !user.isAdmin) return false;
  
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  // Admin a tous les droits
  if (user.isAdmin && requiredRoles.includes('admin')) return true;
  
  // Vérifier les rôles
  return requiredRoles.some(role => userRoles.includes(role));
};

/**
 * Vérifie si l'utilisateur a une permission spécifique
 * @param {Object} user - L'utilisateur courant
 * @param {string} permission - Permission requise
 * @returns {boolean}
 */
export const hasPermission = (user, permission) => {
  if (!isAuthenticated(user)) return false;
  if (user.isAdmin) return true;
  
  const permissions = user.permissions || [];
  return permissions.includes(permission);
};

/**
 * Protège une route (vérifie l'authentification)
 * @param {Object} user - L'utilisateur courant
 * @param {Function} navigate - Fonction de navigation
 * @param {string} redirectPath - Chemin de redirection (défaut: '/login')
 * @returns {boolean} - True si autorisé, False sinon
 */
export const requireAuth = (user, navigate, redirectPath = '/login') => {
  const isAuth = isAuthenticated(user);
  if (!isAuth && navigate) {
    navigate(redirectPath);
  }
  return isAuth;
};

/**
 * Protège une route admin (vérifie l'authentification + rôle admin)
 * @param {Object} user - L'utilisateur courant
 * @param {Function} navigate - Fonction de navigation
 * @param {string} redirectPath - Chemin de redirection (défaut: '/')
 * @returns {boolean} - True si autorisé, False sinon
 */
export const requireAdmin = (user, navigate, redirectPath = '/') => {
  const isAuth = isAuthenticated(user);
  const isAdm = isAdmin(user);
  
  if (!isAuth && navigate) {
    navigate('/login');
    return false;
  }
  
  if (!isAdm && navigate) {
    navigate(redirectPath);
    return false;
  }
  
  return isAuth && isAdm;
};

/**
 * Génère un en-tête d'autorisation pour les requêtes API
 * @returns {Object} - En-têtes HTTP
 */
export const getAuthHeader = () => {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

/**
 * Récupère les informations de l'utilisateur depuis le token (sans API)
 * @param {string} token - Token JWT
 * @returns {Object|null}
 */
export const getUserFromToken = (token) => {
  const decoded = decodeToken(token);
  if (!decoded) return null;
  
  return {
    id: decoded.sub || decoded.userId || decoded.id,
    email: decoded.email,
    name: decoded.name || decoded.full_name,
    roles: decoded.roles || [],
    permissions: decoded.permissions || [],
    isAdmin: decoded.roles?.includes('admin') || decoded.isAdmin === true
  };
};

/**
 * Export par défaut
 */
export default {
  isAuthenticated,
  isAdmin,
  isAuthor,
  canModify,
  storeAuthData,
  getAuthToken,
  getStoredUser,
  clearAuthData,
  isTokenExpired,
  refreshToken,
  decodeToken,
  hasRole,
  hasPermission,
  requireAuth,
  requireAdmin,
  getAuthHeader,
  getUserFromToken
};
