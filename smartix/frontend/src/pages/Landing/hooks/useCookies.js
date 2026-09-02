// frontend/src/hooks/useCookies.js
import { useState, useEffect, useCallback } from 'react';

const COOKIE_CONSENT_KEY = 'cookiesAccepted';
const COOKIE_PREFERENCES_KEY = 'cookiePreferences';

// Configuration des services tiers
const ANALYTICS_ID = 'G-XXXXXXXXXX'; // À remplacer par ton ID Google Analytics
const FACEBOOK_PIXEL_ID = 'XXXXXXXXXXXXXXX'; // À remplacer par ton ID Facebook Pixel

export const useCookies = () => {
  const [consent, setConsent] = useState(null);
  const [preferences, setPreferences] = useState({
    functional: true,   // Toujours actif
    analytics: false,
    marketing: false
  });
  const [isLoading, setIsLoading] = useState(true);

  // Charger les préférences au montage
  useEffect(() => {
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    const savedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    
    if (savedConsent === 'true' && savedPreferences) {
      try {
        const prefs = JSON.parse(savedPreferences);
        setPreferences(prefs);
        setConsent(true);
      } catch (e) {
        console.error('Erreur parsing préférences cookies:', e);
      }
    } else if (savedConsent === 'false') {
      setConsent(false);
    }
    
    setIsLoading(false);
  }, []);

  // Initialiser les cookies selon les préférences
  const initializeServices = useCallback((prefs) => {
    // Cookies fonctionnels (toujours actifs si consentement donné)
    if (prefs.functional && consent) {
      // Sauvegarder la langue
      const lang = document.documentElement.lang || 'fr';
      localStorage.setItem('preferred_language', lang);
    }

    // Cookies analytics (Google Analytics)
    if (prefs.analytics && consent) {
      // Vérifier si GA n'est pas déjà chargé
      if (typeof window !== 'undefined' && !window.gtag && ANALYTICS_ID !== 'G-XXXXXXXXXX') {
        // Charger Google Analytics
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`;
        script.async = true;
        document.head.appendChild(script);
        
        window.dataLayer = window.dataLayer || [];
        window.gtag = function() { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', ANALYTICS_ID);
        
        console.log('📊 Google Analytics initialisé');
      }
    }

    // Cookies marketing (Facebook Pixel)
    if (prefs.marketing && consent && FACEBOOK_PIXEL_ID !== 'XXXXXXXXXXXXXXX') {
      if (typeof window !== 'undefined' && !window.fbq) {
        // Charger Facebook Pixel
        const script = document.createElement('script');
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${FACEBOOK_PIXEL_ID}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(script);
        
        console.log('📱 Facebook Pixel initialisé');
      }
    }
  }, [consent]);

  // Accepter tous les cookies
  const acceptAll = useCallback(() => {
    const fullPreferences = {
      functional: true,
      analytics: true,
      marketing: true
    };
    setPreferences(fullPreferences);
    setConsent(true);
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(fullPreferences));
    
    // Initialiser tous les services
    initializeServices(fullPreferences);
    
    console.log('🍪 Tous les cookies acceptés');
  }, [initializeServices]);

  // Refuser les cookies non essentiels
  const rejectNonEssential = useCallback(() => {
    const essentialPreferences = {
      functional: true,
      analytics: false,
      marketing: false
    };
    setPreferences(essentialPreferences);
    setConsent(true);
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(essentialPreferences));
    
    // Initialiser uniquement les cookies fonctionnels
    initializeServices(essentialPreferences);
    
    console.log('🍪 Cookies non essentiels refusés');
  }, [initializeServices]);

  // Personnaliser les préférences
  const savePreferences = useCallback((newPreferences) => {
    setPreferences(newPreferences);
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(newPreferences));
    
    // Réinitialiser les services avec les nouvelles préférences
    initializeServices(newPreferences);
    
    console.log('🍪 Préférences cookies sauvegardées');
  }, [initializeServices]);

  // Réinitialiser le consentement (déconnexion, etc.)
  const resetConsent = useCallback(() => {
    setConsent(null);
    setPreferences({ functional: true, analytics: false, marketing: false });
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    localStorage.removeItem(COOKIE_PREFERENCES_KEY);
    console.log('🍪 Consentement cookies réinitialisé');
  }, []);

  return {
    consent,
    preferences,
    isLoading,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    resetConsent,
    hasConsent: consent === true
  };
};

export default useCookies;
