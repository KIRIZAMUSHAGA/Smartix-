/**
 * hooks/useAuth.js
 * Hook READ-ONLY pour l'authentification
 * La source de vérité est AuthContext, pas de duplication d'état
 */

import { useContext, useMemo, useCallback, useEffect, useState } from 'react'; // ✅ useState ajouté
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const DEBUG = process.env.NODE_ENV === 'development';

const log = (...args) => {
  if (DEBUG) console.log('[useAuth]', ...args);
};

/**
 * Hook principal - LECTURE SEULEMENT
 * Pas de useState local pour éviter la double source de vérité
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('❌ useAuth must be used within AuthProvider');
  }

  // ✅ Lecture directe du contexte - PAS de duplication d'état
  const {
    user,
    token,
    isLoading,
    login: rawLogin,
    register: rawRegister,
    logout: rawLogout,
    updateUser: rawUpdateUser,
    refreshToken: rawRefreshToken,
    // ✅ isAuthenticated vient du contexte (pas recalculé)
    isAuthenticated: contextIsAuthenticated,
    // ✅ rôles et permissions pré-calculés
    roles,
    permissions
  } = context;

  // ✅ État dérivé minimal (seulement ce qui n'est pas déjà dans le contexte)
  const derivedState = useMemo(() => {
    if (!user) {
      return {
        userId: null,
        userName: null,
        userEmail: null,
        userAvatar: null
      };
    }

    return {
      userId: user.id,
      userName: user.full_name || user.username,
      userEmail: user.email,
      userAvatar: user.avatar
    };
  }, [user]);

  // ✅ Optimisation des permissions avec Set (O(1))
  const rolesSet = useMemo(() => new Set(roles || []), [roles]);
  const permissionsSet = useMemo(() => new Set(permissions || []), [permissions]);

  // ✅ Vérifications optimisées
  const hasRole = useCallback((role) => {
    if (!role) return false;
    return rolesSet.has(role);
  }, [rolesSet]);

  const hasPermission = useCallback((permission) => {
    if (!permission) return false;
    return permissionsSet.has(permission);
  }, [permissionsSet]);

  // ✅ Wrapper login (retourne directement le résultat brut)
  const handleLogin = useCallback(async (email, password, rememberMe = false) => {
    log('Login attempt');
    try {
      const result = await rawLogin(email, password, rememberMe);
      log('Login success');
      return result;
    } catch (error) {
      log('Login error:', error);
      throw error;
    }
  }, [rawLogin]);

  // ✅ Wrapper register
  const handleRegister = useCallback(async (email, password, fullName, username = null, additionalData = null) => {
    log('Register attempt');
    try {
      const result = await rawRegister(email, password, fullName, username, additionalData);
      log('Register success');
      return result;
    } catch (error) {
      log('Register error:', error);
      throw error;
    }
  }, [rawRegister]);

  // ✅ Wrapper logout
  const handleLogout = useCallback(async () => {
    log('Logout attempt');
    try {
      await rawLogout();
      log('Logout success');
    } catch (error) {
      log('Logout error:', error);
      throw error;
    }
  }, [rawLogout]);

  // ✅ Rafraîchir les données utilisateur
  const refreshUser = useCallback(async () => {
    if (!rawUpdateUser) return null;
    try {
      log('Refreshing user data');
      return await rawUpdateUser();
    } catch (error) {
      log('Refresh error:', error);
      return null;
    }
  }, [rawUpdateUser]);

  return {
    // État brut (lecture seule)
    user,
    token,
    isLoading,
    isAuthenticated: contextIsAuthenticated, // ✅ du contexte
    roles: roles || [],
    permissions: permissions || [],
    
    // État dérivé
    ...derivedState,
    
    // Méthodes (brutes, sans wrapper)
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    refreshUser,
    refreshToken: rawRefreshToken,
    
    // Utilitaires optimisés
    hasRole,
    hasPermission
  };
};

// =============================
// HOOKS AUXILIAIRES
// =============================

export const useIsAuthenticated = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
};

export const useUserId = () => {
  const { userId } = useAuth();
  return userId;
};

export const useIsAdmin = () => {
  const { isAdmin } = useAuth();
  return isAdmin;
};

/**
 * Hook de protection de route - Version simplifiée et robuste
 * Pas de isRedirecting state (évite les double rendus)
 */
export const useAuthGuard = (options = {}) => {
  const {
    requireAuth = true,
    requireAdmin = false,
    redirectTo = '/auth',
    loader: LoaderComponent = null
  } = options;

  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    const shouldRedirect = (requireAuth && !isAuthenticated) || (requireAdmin && !isAdmin);
    
    if (shouldRedirect) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isAdmin, isLoading, requireAuth, requireAdmin, redirectTo, navigate]);

  if (isLoading && LoaderComponent) {
    return { isAuthorized: false, isLoading: true, Loader: LoaderComponent };
  }

  return {
    isAuthorized: (!requireAuth || isAuthenticated) && (!requireAdmin || isAdmin),
    isLoading
  };
};

export default useAuth;
