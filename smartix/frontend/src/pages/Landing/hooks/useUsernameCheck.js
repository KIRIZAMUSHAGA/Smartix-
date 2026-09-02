// Hook neutralisé — la vérification d'unicité est faite à l'inscription finale.
import { useState, useCallback } from 'react';

const IDLE_STATE = {
  status: 'idle',
  available: null,
  message: ''
};

export const useUsernameCheck = () => {
  const [usernameCheck] = useState(IDLE_STATE);

  const checkUsername = useCallback(async () => {
    return { available: true };
  }, []);

  const debouncedCheck = useCallback(() => {
    // no-op
  }, []);

  const reset = useCallback(() => {
    // no-op
  }, []);

  return { usernameCheck, checkUsername, debouncedCheck, reset };
};

export default useUsernameCheck;
