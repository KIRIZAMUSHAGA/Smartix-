import React, { useState, useContext, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Mail, Lock, Eye, EyeOff, ChevronRight, Loader2, AlertCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import ForgotPasswordFlow from '../ForgotPasswordFlow/ForgotPasswordFlow';
import PhoneAuthFlow from './PhoneAuthFlow';
import { startGoogleOAuth } from '../../services/authService';
import './LoginFlow.css';
import PropTypes from 'prop-types';

// Validation email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

const LoginFlow = ({ open, onOpenChange }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const emailRef = useRef(null);
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [phoneAuthOpen, setPhoneAuthOpen] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = useCallback(() => {
    console.log('[GOOGLE_AUTH] start — click Continuer avec Google | rememberMe=', rememberMe, '| loading=', loading);
    console.log('[GOOGLE_AUTH] origin route:', window.location.href);
    if (loading) return;
    startGoogleOAuth(rememberMe);
  }, [loading, rememberMe]);

  const handlePhoneLogin = useCallback(() => {
    if (loading) return;
    onOpenChange(false);
    setPhoneAuthOpen(true);
  }, [loading, onOpenChange]);

  // ✅ Focus automatique à l'ouverture
  useEffect(() => {
    if (open) {
      emailRef.current?.focus();
    }
  }, [open]);

  // Validation en temps réel
  const isEmailValid = loginData.email ? isValidEmail(loginData.email) : true;
  const isFormValid = isEmailValid && loginData.password.length >= 6;

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    
    // ✅ Prevent double submit
    if (loading) return;
    
    // Validation finale
    if (!loginData.email || !loginData.password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    if (!isValidEmail(loginData.email)) {
      toast.error('Format d\'email invalide');
      return;
    }
    
    if (loginData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // ✅ Trim email seulement, pas le password
      await login(loginData.email.trim(), loginData.password, rememberMe);

      console.log('[TOAST] login success triggered (LoginFlow / email+pwd)');
      toast.success('Connexion réussie ! 👋', {
        description: 'Bienvenue sur Smartix'
      });

      console.log('[POST_LOGIN] LoginFlow -> onOpenChange(false) + navigate(/home) (no full reload)');
      onOpenChange(false);
      navigate('/home');
      
    } catch (error) {
      let errorMessage = 'Email ou mot de passe invalide';

      if (!error.response) {
        errorMessage = 'Vérifiez votre connexion internet';
      } else {
        // Si la réponse n'est pas du JSON (ex: HTML d'un dev server / proxy
        // mal configuré), c'est une erreur d'infrastructure et NON une erreur
        // métier. On évite tout message qui laisserait croire à un problème
        // de compte.
        const contentType = error.response.headers?.['content-type'] || '';
        if (contentType.includes('text/html')) {
          errorMessage = 'Erreur réseau ou configuration serveur';
        } else {
          switch (error.response.status) {
            case 401:
              errorMessage = 'Email ou mot de passe incorrect';
              break;
            case 404:
              // Le backend /auth/login ne renvoie jamais 404 pour un compte
              // inexistant (toujours 401). Un 404 ici = route absente côté
              // infra, pas une erreur métier.
              errorMessage = 'Erreur de connexion au serveur';
              break;
            case 429:
              errorMessage = 'Trop de tentatives, réessayez plus tard';
              break;
            case 500:
            case 502:
            case 503:
              errorMessage = 'Service indisponible, réessayez plus tard';
              break;
            default:
              errorMessage = error.response?.data?.detail || errorMessage;
          }
        }
      }

      setError(errorMessage);
      console.log('[TOAST] login error triggered (LoginFlow / email+pwd) | message:', errorMessage);
      toast.error('Erreur de connexion', {
        description: errorMessage
      });
    } finally {
      setLoading(false);
    }
  }, [loginData, login, rememberMe, onOpenChange, navigate, loading]);

  // ✅ Réinitialisation complète à la fermeture
  const handleOpenChange = useCallback((open) => {
    if (!open) {
      setLoginData({ email: '', password: '' });
      setRememberMe(false);
      setShowPassword(false);
      setError('');
      setLoading(false);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  return (
    <>
      <ForgotPasswordFlow open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
      <PhoneAuthFlow open={phoneAuthOpen} onOpenChange={setPhoneAuthOpen} />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="registration-dialog w-full max-w-md rounded-2xl overflow-hidden border-0 p-0">
          <div className="registration-content px-6 pt-8 pb-6">
            <div className="w-full">
              <div className="login-header">
                <div className="login-icon-container">
                  <img src="/smartix-s-logo.png" alt="Smartix" className="login-logo-s" />
                </div>
                <h2 className="login-title">Content de te revoir</h2>
                <p className="login-description">Reconnecte-toi pour poursuivre tes activités</p>
              </div>

              {/* Message d'erreur */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* ✅ Formulaire avec onSubmit */}
              <form onSubmit={handleLogin} className="login-form-fields">
                <div className="form-group">
                  <label className="login-label">Email</label>
                  <div className="login-input-wrapper">
                    <input
                      ref={emailRef}
                      type="email"
                      placeholder="jean@example.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      disabled={loading}
                      className={`login-input ${loginData.email && !isEmailValid ? 'border-red-500 focus:ring-red-500' : ''}`}
                    />
                  </div>
                  {loginData.email && !isEmailValid && (
                    <p className="text-xs text-red-500 mt-1">Format d'email invalide</p>
                  )}
                </div>

                <div className="form-group">
                  <div className="login-label-row">
                    <label className="login-label">Mot de passe</label>
                    <button 
                      type="button"
                      onClick={() => setForgotPasswordOpen(true)}
                      className="login-forgot-btn"
                      disabled={loading}
                    >
                      Oublié ?
                    </button>
                  </div>
                  <div className="login-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      disabled={loading}
                      className="login-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="login-eye-btn"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginData.password && loginData.password.length < 6 && (
                    <p className="text-xs text-red-500 mt-1">Au moins 6 caractères</p>
                  )}
                </div>

                <div className="login-checkbox">
                  <input 
                    type="checkbox"
                    id="remember" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="login-checkbox-input"
                  />
                  <label htmlFor="remember" className="login-checkbox-label">Garder ma session active</label>
                </div>

                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className={`w-full h-12 mt-6 bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-xl flex items-center justify-center gap-2 text-base font-bold transition-all duration-300 ${
                    loading ? 'cursor-not-allowed opacity-70' : ''
                  } ${
                    !isFormValid ? 'opacity-50 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    <>
                      Se connecter
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Séparateur "ou" */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs uppercase tracking-wider text-white/40">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Continuer avec Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-12 mb-3 bg-white hover:bg-gray-100 text-gray-800 rounded-xl flex items-center justify-center gap-3 text-base font-semibold transition-all duration-200 disabled:opacity-60"
              >
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4.1-3.9 5.5l6.5 5.5C42 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                Continuer avec Google
              </button>

              {/* Continuer avec un numéro de téléphone */}
              <button
                type="button"
                onClick={handlePhoneLogin}
                disabled={loading}
                className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl flex items-center justify-center gap-3 text-base font-semibold transition-all duration-200 disabled:opacity-60"
              >
                <Phone className="w-5 h-5" />
                Continuer avec un numéro de téléphone
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

LoginFlow.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
};

export default LoginFlow;
