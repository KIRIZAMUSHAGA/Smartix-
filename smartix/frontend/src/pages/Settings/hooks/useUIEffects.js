// hooks/useUIEffects.js
import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

export const useUIEffects = (settings) => {
  const { setTheme } = useTheme();
  const { i18n } = useTranslation();

  // Taille de police
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-petit', 'font-size-normal', 'font-size-grand');
    root.classList.add(`font-size-${settings.fontSize?.toLowerCase() || 'normal'}`);
  }, [settings.fontSize]);

  // Animations
  useEffect(() => {
    const root = document.documentElement;
    if (settings.animationsEnabled) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }
  }, [settings.animationsEnabled]);

  // Langue
  useEffect(() => {
    if (settings.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  // Thème (optionnel)
  useEffect(() => {
    if (settings.theme && settings.theme !== 'system') {
      setTheme(settings.theme);
    }
  }, [settings.theme, setTheme]);
};

export default useUIEffects;
