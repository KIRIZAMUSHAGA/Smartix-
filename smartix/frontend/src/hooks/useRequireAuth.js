import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export const useRequireAuth = (redirectTo = '/auth') => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const requireAuth = useCallback(() => {
    if (isLoading) return false;
    if (!isAuthenticated) {
      navigate(redirectTo, { replace: true });
      return false;
    }
    return true;
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  return requireAuth;
};

export default useRequireAuth;
