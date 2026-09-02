import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { LogIn, Menu, X } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import MobileMenu from './MobileMenu';
import { useTranslation } from 'react-i18next';
import './LandingHeader.css';

import { useNavigate } from 'react-router-dom';

const LandingHeader = ({ onLoginClick, onMenuClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout, user } = useContext(AuthContext);
  const isLoggedIn = !!user;

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  const handleMenuToggle = () => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      setIsMenuOpen(!isMenuOpen);
    }
  };

  return (
    <>
      <header className="landing-header">
        <div className="landing-header-container">
          {/* Logo */}
          <div className="landing-header-logo">
            <span className="logo-text">Smartix</span>
          </div>

          {/* Navigation spacer */}
          <div className="landing-header-spacer" />

          {/* Menu burger */}
          <button 
            onClick={handleMenuToggle}
            className="landing-header-menu-btn"
            aria-label="Toggle menu"
          >
            {(onMenuClick ? false : isMenuOpen) ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Login button */}
          <button 
            onClick={onLoginClick}
            className="landing-header-login-btn"
          >
            <LogIn size={18} />
            <span>{t('landing.header.login')}</span>
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        isLoggedIn={isLoggedIn}
        onLoginClick={onLoginClick}
        onLogoutClick={handleLogout}
        userName={user?.full_name}
      />
    </>
  );
};

LandingHeader.propTypes = {
  onLoginClick: PropTypes.func,
  onMenuClick: PropTypes.func
};

export default LandingHeader;
