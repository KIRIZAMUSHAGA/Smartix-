// Hook neutralisé — la vérification d'unicité est faite à l'inscription finale.
import { useState, useCallback } from 'react';

const IDLE_STATE = {
  status: 'idle',
  available: null,
  message: ''
};

export const useEmailCheck = () => {
  const [emailCheck] = useState(IDLE_STATE);

  const checkEmail = useCallback(async () => {
    return { available: true };
  }, []);

  const debouncedCheck = useCallback(() => {
    // no-op
  }, []);

  const reset = useCallback(() => {
    // no-op
  }, []);

  return { emailCheck, checkEmail, debouncedCheck, reset };
};

export default useEmailCheck;
