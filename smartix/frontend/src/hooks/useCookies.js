import { useState, useCallback } from 'react';

export function useCookies() {
  const getCookie = useCallback((name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }, []);

  const setCookie = useCallback((name, value, days = 365) => {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
  }, []);

  const removeCookie = useCallback((name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  }, []);

  const hasConsent = useCallback((type = 'all') => {
    const consent = getCookie('cookie_consent');
    if (!consent) return false;
    if (type === 'all') return consent === 'accepted';
    try {
      const parsed = JSON.parse(consent);
      return parsed[type] === true;
    } catch {
      return consent === 'accepted';
    }
  }, [getCookie]);

  return { getCookie, setCookie, removeCookie, hasConsent };
}

export default useCookies;
