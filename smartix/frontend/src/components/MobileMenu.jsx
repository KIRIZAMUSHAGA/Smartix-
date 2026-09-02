import React, { useEffect } from 'react';
import {
  Info, Users, HelpCircle, LogIn, UserPlus,
  LogOut, Settings, User as UserIcon, Home, Eye, X
} from 'lucide-react';
import './MobileMenu.css';

import { useNavigate } from 'react-router-dom';

import PropTypes from 'prop-types';

const MobileMenu = ({ isOpen, onClose, isLoggedIn, onLoginClick, onRegisterClick, onLogoutClick, userName }) => {
  const navigate = useNavigate();
  
  // Empêcher le scroll du body quand le menu est ouvert (iOS + desktop)
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);
  
  const handleNavClick = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="mobile-menu-overlay" 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Menu */}
      <nav className={`mobile-menu ${isOpen ? 'open' : ''}`}>
        <div className="flex flex-col h-full">
        {/* Menu Header */}
        <div className="mobile-menu-header">
          <div className="flex justify-between items-start w-full">
            <div>
              <span className="mobile-menu-brand">Smartix</span>
              <p className="mobile-menu-tagline">Votre liberté financière commence ici</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 -mr-2 text-white/50 hover:text-white transition-colors"
              aria-label="Fermer le menu"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="mobile-menu-section flex-1 overflow-y-auto">
          <div className="mobile-menu-items">
            <button
              className="mobile-menu-item"
              onClick={() => {
                navigate('/about');
                onClose();
              }}
            >
              <Info size={20} />
              <span>À propos de Smartix</span>
            </button>

            <button
              className="mobile-menu-item"
              onClick={() => {
                navigate('/vision');
                onClose();
              }}
            >
              <Eye size={20} />
              <span>Vision & Équipe</span>
            </button>

            <button
              className="mobile-menu-item"
              onClick={() => {
                navigate('/explore');
                onClose();
              }}
            >
              <Users size={20} />
              <span>Communauté</span>
            </button>

            <button
              className="mobile-menu-item"
              onClick={() => {
                navigate('/faq');
                onClose();
              }}
            >
              <HelpCircle size={20} />
              <span>Aide / FAQ</span>
            </button>
          </div>
        </div>

        {/* Account Section */}
        <div className="mobile-menu-section mobile-menu-account">
          {!isLoggedIn ? (
            <div className="mobile-menu-auth-buttons">
              <button
                className="mobile-menu-auth-btn login-btn"
                onClick={() => {
                  onLoginClick();
                  onClose();
                }}
              >
                <LogIn size={18} />
                <span>Se connecter</span>
              </button>
              <button
                className="mobile-menu-auth-btn signup-btn"
                onClick={() => {
                  console.log('[SIGNUP_FLOW] click detected — source: MobileMenu signup-btn | onRegisterClick provided?', typeof onRegisterClick === 'function');
                  if (typeof onRegisterClick === 'function') onRegisterClick();
                  onClose();
                }}
              >
                <UserPlus size={18} />
                <span>Créer un compte</span>
              </button>
            </div>
          ) : (
            <div className="mobile-menu-auth-buttons">
              <button
                className="mobile-menu-auth-btn access-btn"
                onClick={() => {
                  navigate('/home');
                  onClose();
                }}
              >
                <Home size={18} />
                <span>Accéder à l'application</span>
              </button>
              <button
                className="mobile-menu-auth-btn profile-btn"
                onClick={() => {
                  navigate('/profile');
                  onClose();
                }}
              >
                <UserIcon size={18} />
                <span>Mon profil</span>
              </button>
              <button
                className="mobile-menu-auth-btn settings-btn"
                onClick={() => {
                  navigate('/settings');
                  onClose();
                }}
              >
                <Settings size={18} />
                <span>Paramètres</span>
              </button>
              <button
                className="mobile-menu-auth-btn logout-btn"
                onClick={() => {
                  onLogoutClick();
                  onClose();
                }}
              >
                <LogOut size={18} />
                <span>Se déconnecter</span>
              </button>
            </div>
          )}
        </div>
        </div>{/* fin wrapper flex flex-col h-full */}
      </nav>
    </>
  );
};

MobileMenu.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isLoggedIn: PropTypes.bool,
  onLoginClick: PropTypes.func,
  onRegisterClick: PropTypes.func,
  onLogoutClick: PropTypes.func,
  userName: PropTypes.string
};

export default MobileMenu;
