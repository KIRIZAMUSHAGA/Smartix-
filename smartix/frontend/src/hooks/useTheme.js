import { useState, useEffect, useCallback } from 'react';

// =============================
// CONSTANTES
// =============================
const THEME_STORAGE_KEY = 'app_theme';
const DARK_CLASS = 'dark';

// =============================
// HOOK PRINCIPAL
// =============================
export const useTheme = () => {
  // État initial depuis localStorage ou préférence système
  const [theme, setTheme] = useState(() => {
    // Vérifier localStorage d'abord
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    
    // Sinon, utiliser la préférence système
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light';
  });

  // =============================
  // APPLIQUER LE THÈME AU DOCUMENT
  // =============================
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add(DARK_CLASS);
    } else {
      root.classList.remove(DARK_CLASS);
    }
    
    // Sauvegarder dans localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    // Mettre à jour la meta theme-color pour mobile
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        theme === 'dark' ? '#1f2937' : '#ffffff'
      );
    }
  }, [theme]);

  // =============================
  // BASCOLER LE THÈME
  // =============================
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // =============================
  // DÉFINIR UN THÈME SPÉCIFIQUE
  // =============================
  const setThemeMode = useCallback((mode) => {
    setTheme(mode);
  }, []);

  // =============================
  // ÉCOUTER LES CHANGEMENTS DE PRÉFÉRENCE SYSTÈME
  // =============================
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Ne changer que si l'utilisateur n'a pas de préférence manuelle
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    toggleTheme,
    setTheme: setThemeMode
  };
};

export default useTheme;
