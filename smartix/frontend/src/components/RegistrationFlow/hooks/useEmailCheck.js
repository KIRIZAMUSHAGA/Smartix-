import { useState, useEffect, useRef, useCallback } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  TAKEN: 'taken',
  INVALID: 'invalid',
};

const MESSAGES = {
  [STATUS.IDLE]: '',
  [STATUS.CHECKING]: 'Vérification…',
  [STATUS.AVAILABLE]: '✓ Email disponible',
  [STATUS.TAKEN]: '✗ Cet email est déjà utilisé',
  [STATUS.INVALID]: "Format d'email invalide",
};

const DEBOUNCE_MS = 500;

const cache = new Map();

export function useEmailCheck(email) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const value = (email || '').trim().toLowerCase();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (value.length === 0) {
      setStatus(STATUS.IDLE);
      return;
    }

    if (!EMAIL_REGEX.test(value)) {
      setStatus(STATUS.INVALID);
      return;
    }

    const cached = cache.get(value);
    if (cached) {
      setStatus(cached);
      return;
    }

    setStatus(STATUS.CHECKING);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: value }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (res.status === 409) {
          cache.set(value, STATUS.TAKEN);
          setStatus(STATUS.TAKEN);
        } else {
          cache.set(value, STATUS.AVAILABLE);
          setStatus(STATUS.AVAILABLE);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        setStatus(STATUS.AVAILABLE);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [email]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setStatus(STATUS.IDLE);
  }, []);

  return {
    status,
    message: MESSAGES[status],
    isAvailable: status === STATUS.AVAILABLE,
    isChecking: status === STATUS.CHECKING,
    reset,
    STATUS,
  };
}

export default useEmailCheck;
