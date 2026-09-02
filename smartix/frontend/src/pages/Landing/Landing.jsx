// frontend/src/pages/Landing/Landing.jsx
import React, { useState, useEffect, useContext, Suspense, lazy, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { AuthContext } from '../../contexts/AuthContext';
import { AlertCircle, Check, ChevronRight, Settings } from 'lucide-react';
import { useCookies } from '../../hooks/useCookies';

// Lazy loading des composants lourds
const LandingHeader = lazy(() => import('../../components/LandingHeader'));
const MobileMenu = lazy(() => import('../../components/MobileMenu'));
const HeroSection = lazy(() => import('./components/HeroSection'));
const FeaturesCarousel = lazy(() => import('./components/FeaturesCarousel'));
const TestimonialsCarousel = lazy(() => import('./components/TestimonialsCarousel'));
const HowItWorks = lazy(() => import('./components/HowItWorks'));
const PartnersSection = lazy(() => import('./components/PartnersSection'));
const CTASection = lazy(() => import('./components/CTASection'));
const Footer = lazy(() => import('./components/Footer'));
const LoginFlow = lazy(() => import('../../components/LoginFlow/LoginFlow'));
const RegistrationFlow = lazy(() => import('../../components/RegistrationFlow/RegistrationFlow'));
const PhoneAuthFlow = lazy(() => import('../../components/LoginFlow/PhoneAuthFlow'));

// Styles
import './Landing.css';
import PropTypes from 'prop-types';

const Landing = () => {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { consent, acceptAll, rejectNonEssential } = useCookies();

  // État groupé par fonctionnalité
  const [modals, setModals] = useState({
    login: false,
    register: false,
    phoneAuth: false,
    mobileMenu: false,
    cookieBanner: false
  });

  const [ui, setUi] = useState({
    scrollTopVisible: false
  });

  // Brouillon d'inscription supprimé : plus de bannière "Reprendre".
  // On nettoie une éventuelle entrée résiduelle dans localStorage.
  useEffect(() => {
    try { localStorage.removeItem('smartix_registration_draft'); } catch {}
  }, []);

  // Gestionnaires de modales
  const openModal = useCallback((modalName) => {
    console.log('[SIGNUP_FLOW] openModal called:', modalName, '| route:', window.location.pathname + window.location.search);
    setModals(prev => {
      const next = { ...prev, [modalName]: true };
      console.log('[SIGNUP_FLOW] modal state before:', prev, '| after:', next);
      return next;
    });
  }, []);

  const closeModal = useCallback((modalName) => {
    console.log('[SIGNUP_FLOW] closeModal called:', modalName);
    setModals(prev => ({ ...prev, [modalName]: false }));
  }, []);

  // Dispatch app-ready au premier render (après paint)
  useEffect(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('app-ready'));
    });
  }, []);

  // Redirection si déjà connecté
  useEffect(() => {
    console.log('[POST_LOGIN] Landing user-effect — user:', user ? { id: user.id, email: user.email } : null, '| current route:', window.location.pathname);
    if (user) {
      console.log('[POST_LOGIN] Landing -> navigate(/home) because user is authenticated');
      navigate('/home');
    }
  }, [user, navigate]);

  // Gestion des paramètres d'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get('mode');
    
    if (mode === 'signup') {
      setModals(prev => ({ ...prev, register: true, login: false }));
      window.history.replaceState({}, '', location.pathname);
    } else if (mode === 'login') {
      setModals(prev => ({ ...prev, login: true, register: false }));
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  // Ouverture du menu via location.state (retour depuis une page secondaire)
  useEffect(() => {
    if (location.state?.openMenu) {
      setModals(prev => ({ ...prev, mobileMenu: true }));
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // ✅ Bannière cookies - basée sur le consentement réel
  useEffect(() => {
    // Ne pas afficher la bannière si le consentement a déjà été donné ou refusé
    if (consent === null) {
      // Afficher la bannière après 2 secondes seulement si pas encore de consentement
      const timer = setTimeout(() => {
        setModals(prev => ({ ...prev, cookieBanner: true }));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [consent]);

  // Bouton retour en haut
  useEffect(() => {
    const handleScroll = () => {
      setUi(prev => ({ ...prev, scrollTopVisible: window.scrollY > 400 }));
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Écouter l'événement de fin d'inscription
  useEffect(() => {
    const handleRegistrationComplete = (event) => {
      if (event.detail?.success) {
        closeModal('register');
        setTimeout(() => navigate('/home'), 300);
      }
    };
    
    window.addEventListener('registrationComplete', handleRegistrationComplete);
    return () => window.removeEventListener('registrationComplete', handleRegistrationComplete);
  }, [navigate, closeModal]);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Bouton retour en haut */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 p-3 rounded-full bg-[#1e293b]/80 backdrop-blur-sm 
          text-white/70 transition-all duration-300 hover:text-[#ff6b35] hover:bg-[#1e293b] 
          hover:scale-110 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-[#ff6b35]
          ${ui.scrollTopVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        aria-label="Retour en haut"
      >
        <ChevronRight className="w-8 h-8 -rotate-90 transition-transform group-hover:-translate-y-1" />
      </button>

      {/* Header */}
      <Suspense fallback={<div className="h-20 bg-[#0f172a]" />}>
        <LandingHeader 
          onLoginClick={() => openModal('login')} 
          onMenuClick={() => openModal('mobileMenu')}
        />
      </Suspense>
      
      {/* Menu mobile */}
      <Suspense fallback={null}>
        <MobileMenu 
          isOpen={modals.mobileMenu} 
          onClose={() => closeModal('mobileMenu')}
          onLoginClick={() => {
            closeModal('mobileMenu');
            openModal('login');
          }}
          onRegisterClick={() => {
            closeModal('mobileMenu');
            openModal('register');
          }}
        />
      </Suspense>
      
      {/* Sections principales */}
      <Suspense fallback={<div className="h-screen bg-[#0f172a]" />}>
        <HeroSection onRegisterClick={() => openModal('register')} />
        <FeaturesCarousel />
        <TestimonialsCarousel />
        <HowItWorks onRegisterClick={() => openModal('register')} />
        <PartnersSection />
        <CTASection onRegisterClick={() => openModal('register')} />
        <Footer />
      </Suspense>

      {/* Modales d'authentification */}
      <Suspense fallback={null}>
        <LoginFlow 
          open={modals.login} 
          onOpenChange={(open) => setModals(prev => ({ ...prev, login: open }))} 
        />
        <RegistrationFlow 
          open={modals.register} 
          onOpenChange={(open) => setModals(prev => ({ ...prev, register: open }))} 
          onPhoneClick={() => {
            console.log('[SIGNUP_FLOW] Landing onPhoneClick -> close register modal, open phoneAuth modal');
            setModals(prev => ({ ...prev, register: false, phoneAuth: true }));
          }}
        />
        <PhoneAuthFlow
          open={modals.phoneAuth}
          onOpenChange={(open) => setModals(prev => ({ ...prev, phoneAuth: open }))}
        />
      </Suspense>

      {/* ✅ Bannière cookies améliorée avec gestion réelle */}
      {modals.cookieBanner && !consent && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 animate-slideUp"
          role="dialog"
          aria-label="Bannière de consentement des cookies"
          aria-modal="true"
        >
          <div className="bg-gray-900/95 backdrop-blur-sm border-t-4 border-[#00B894] shadow-2xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00B894] to-[#0984E3] flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                      🍪 Nous respectons votre vie privée
                    </h3>
                    <p className="text-gray-300 text-sm mb-3">
                      Nous utilisons des cookies pour améliorer votre expérience, analyser notre trafic 
                      et personnaliser votre apprentissage. Vous pouvez choisir quels cookies accepter.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#00B894]" aria-hidden="true" />
                        <span>Cookies essentiels (toujours actifs)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#00B894]" aria-hidden="true" />
                        <span>Cookies analytics</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#00B894]" aria-hidden="true" />
                        <span>Cookies marketing</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => {
                      rejectNonEssential();
                      closeModal('cookieBanner');
                      toast.info('🍪 Cookies non essentiels refusés', {
                        description: 'Seuls les cookies essentiels sont actifs.',
                        duration: 4000
                      });
                    }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white w-full sm:w-auto"
                    aria-label="Refuser les cookies non essentiels"
                  >
                    Refuser non essentiels
                  </Button>
                  <Button
                    onClick={() => {
                      acceptAll();
                      closeModal('cookieBanner');
                      toast.success('✅ Cookies acceptés', {
                        description: 'Merci ! Vous pouvez modifier vos préférences dans les paramètres.',
                        duration: 4000
                      });
                    }}
                    className="bg-gradient-to-r from-[#00B894] to-[#0984E3] hover:from-[#00a182] hover:to-[#0773c9] text-white w-full sm:w-auto"
                    aria-label="Accepter tous les cookies"
                  >
                    <Check className="w-4 h-4 mr-2" aria-hidden="true" />
                    Accepter tous
                  </Button>
                </div>
              </div>

              {/* ✅ Lien vers les préférences détaillées - REDIRECTION VERS LA ROUTE DÉDIÉE */}
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    navigate('/cookie-preferences'); // ✅ Redirection vers la page dédiée
                  }}
                  className="text-xs text-gray-500 hover:text-[#00B894] transition-colors flex items-center gap-1 mx-auto"
                >
                  <Settings className="w-3 h-3" />
                  Personnaliser mes préférences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

Landing.propTypes = {};

export default Landing;
