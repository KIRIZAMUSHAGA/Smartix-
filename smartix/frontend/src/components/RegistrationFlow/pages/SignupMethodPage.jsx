import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Mail, Phone } from 'lucide-react';
import { startGoogleOAuth } from '../../../services/authService';

/**
 * SignupMethodPage — étape "method" (1ʳᵉ étape du flow d'inscription).
 * Affiche 3 choix : Google, Email (multi-step), Téléphone.
 *
 * - Email   : avance dans le flow (goToNextStep -> 'welcome').
 * - Google  : déclenche l'OAuth top-level (NÉCESSAIRE — protocole OAuth).
 * - Phone   : remonte l'intention au parent via onPhoneClick (le parent
 *             ferme ce modal et ouvre PhoneAuthFlow).
 */
const SignupMethodPage = ({ flow, onPhoneClick }) => {
  useEffect(() => {
    console.log('[SIGNUP_FLOW] SignupMethodPage MOUNTED — écran de choix de méthode visible (Google / Email / Téléphone).');
    return () => console.log('[SIGNUP_FLOW] SignupMethodPage UNMOUNTED');
  }, []);

  const handleEmail = useCallback(() => {
    console.log('[SIGNUP_FLOW] method=email -> flow.goToNextStep() (no router navigation)');
    flow.goToNextStep();
  }, [flow]);

  const handleGoogle = useCallback(() => {
    console.log('[SIGNUP_FLOW] method=google -> startGoogleOAuth() (top-level redirect — required by OAuth)');
    startGoogleOAuth(false);
  }, []);

  const handlePhone = useCallback(() => {
    console.log('[SIGNUP_FLOW] method=phone -> onPhoneClick() (parent will switch modals, no router navigation)');
    if (typeof onPhoneClick === 'function') onPhoneClick();
  }, [onPhoneClick]);

  return (
    <div className="welcome-page">
      <div className="welcome-header">
        <div className="welcome-icon-container">
          <img src="/smartix-s-logo.png" alt="Smartix" className="welcome-logo-s" />
        </div>
      </div>

      <div className="welcome-content">
        <h1 className="welcome-title">Créer un compte</h1>
        <p className="welcome-description">
          Choisis comment tu veux t&apos;inscrire sur Smartix.
        </p>
      </div>

      <div className="welcome-form" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full h-12 bg-white hover:bg-gray-100 text-gray-800 rounded-xl flex items-center justify-center gap-3 text-base font-semibold transition-all duration-200"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4.1-3.9 5.5l6.5 5.5C42 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          Continuer avec Google
        </button>

        <button
          type="button"
          onClick={handleEmail}
          className="w-full h-12 bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-xl flex items-center justify-center gap-3 text-base font-bold transition-all duration-200"
        >
          <Mail className="w-5 h-5" />
          Continuer avec un email
        </button>

        <button
          type="button"
          onClick={handlePhone}
          className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl flex items-center justify-center gap-3 text-base font-semibold transition-all duration-200"
        >
          <Phone className="w-5 h-5" />
          Continuer avec un numéro de téléphone
        </button>
      </div>

      <div className="welcome-footer">
        <p className="welcome-footer-text">
          🎓 Rejoins une communauté de learners passionnés
        </p>
      </div>
    </div>
  );
};

SignupMethodPage.propTypes = {
  flow: PropTypes.object.isRequired,
  onPhoneClick: PropTypes.func,
};

export default SignupMethodPage;
