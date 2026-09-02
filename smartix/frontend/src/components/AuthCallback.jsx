import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { consumeOAuthHashAndAuthenticate } from '../services/authService';

/**
 * Page publique /auth/callback : reçoit la redirection du backend après OAuth
 * Google. Elle lit le fragment d'URL (#access_token=...&refresh_token=...),
 * persiste les JWT via authService, hydrate le user, puis redirige vers /home.
 *
 * En cas d'erreur (#error=...), revient à /auth avec un toast explicite.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const consumed = useRef(false);

  useEffect(() => {
    console.log('[GOOGLE_AUTH] AuthCallback MOUNTED — final route:', window.location.href);
    if (consumed.current) {
      console.log('[GOOGLE_AUTH] AuthCallback effect re-entry blocked (StrictMode double-invoke guard)');
      return;
    }
    consumed.current = true;

    (async () => {
      try {
        // ⚠️ consumeOAuthHashAndAuthenticate appelle DÉJÀ, dans cet ordre :
        //   setAccessToken (sync -> storage)
        //   setRefreshToken (sync -> storage)
        //   await fetchCurrentUser() -> setCurrentUser() qui notifyAuthStateChange
        // → après ce await, AuthContext (App.js listener) est mis à jour.
        await consumeOAuthHashAndAuthenticate();
        console.log('[POST_LOGIN] AuthCallback — auth state hydrated (token + user persisted). About to show toast then SPA-navigate to /home.');

        console.log('[TOAST] login success triggered (AuthCallback / google) — toast.success queued in CURRENT app instance');
        toast.success('Connexion réussie 👋', { description: 'Bienvenue sur Smartix' });

        // Petit délai (1 frame + ~100ms) pour laisser Sonner monter le toast
        // AVANT le démontage d'AuthCallback dû au navigate.
        setTimeout(() => {
          console.log('[POST_LOGIN] AuthCallback -> navigate("/home", { replace: true }) (SPA, no full reload, toast survives, AuthContext already hydrated)');
          navigate('/home', { replace: true });
        }, 100);
      } catch (err) {
        const code = err?.message || 'unknown_error';
        const labelByCode = {
          state_mismatch: 'Session expirée, recommence la connexion',
          token_exchange_failed: 'Erreur Google : échange de jeton impossible',
          id_token_invalid: 'Erreur Google : jeton invalide',
          missing_tokens: 'Réponse incomplète du serveur',
          missing_code_or_state: 'Paramètres OAuth manquants',
          no_id_token: 'Google n’a pas renvoyé de jeton',
          access_denied: 'Connexion annulée',
        };
        console.log('[TOAST] login error triggered (AuthCallback / google) | code:', code, '| label:', labelByCode[code] || `Code : ${code}`);
        toast.error('Connexion impossible', {
          description: labelByCode[code] || `Code : ${code}`,
        });
        console.log('[POST_LOGIN] AuthCallback ERROR -> navigate(/auth, replace) (SPA navigation, toast survives)');
        navigate('/auth', { replace: true });
      }
    })();
  }, [navigate]);

  // Splash léger : pas de fond plein-écran opaque pour éviter l'effet
  // "double-écran" pendant la navigation SPA vers /home.
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'white',
      zIndex: 9999,
    }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#ff6b35' }} />
      <p style={{ fontSize: 14, opacity: 0.85 }}>Finalisation de la connexion…</p>
    </div>
  );
};

export default AuthCallback;
