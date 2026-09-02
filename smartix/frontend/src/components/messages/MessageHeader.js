// src/components/messages/MessageHeader.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, Lock, Shield, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import TypingIndicator from './TypingIndicator';
import { formatLastSeen } from '../../lib/utils';
import { ROUTES } from '../../constants/routes';

// Tokens de couleurs
const STATUS_COLORS = {
  online: 'text-[var(--color-success)]',
  onlineDot: 'bg-[var(--color-success)]',
  offline: 'text-muted-foreground',
  encrypted: 'text-[var(--color-success)]',
  encryptedBg: 'bg-[var(--color-success)]/5',
  encryptedBorder: 'border-[var(--color-success)]/10',
  warning: 'text-[var(--color-warning)]',
  warningBg: 'bg-[var(--color-warning)]/5',
  warningBorder: 'border-[var(--color-warning)]/10',
  error: 'text-[var(--color-destructive)]',
  errorBg: 'bg-[var(--color-destructive)]/5',
  errorBorder: 'border-[var(--color-destructive)]/10'
};

// Configuration des niveaux de sécurité
const SECURITY_CONFIG = {
  none: {
    icon: AlertTriangle,
    text: 'Non sécurisé',
    color: 'error',
    tooltip: 'Les messages ne sont pas chiffrés'
  },
  encrypted: {
    icon: Lock,
    text: 'Chiffré',
    color: 'encrypted',
    tooltip: 'Messages chiffrés de bout en bout'
  },
  verified: {
    icon: Shield,
    text: 'Vérifié',
    color: 'encrypted',
    tooltip: 'Identité vérifiée - Sécurisé'
  }
};

const MessageHeader = ({
  partner,
  isPartnerTyping = false,
  onBackClick,
  onVerifyIdentity = null,
  isVerified = false,
  securityLevel = 'none',
  fingerprint = null,
  isVerifying = false
}) => {
  const navigate = useNavigate();
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);

  // Fail-fast : si pas de partenaire, ne pas rendre
  if (!partner) {
    return null;
  }

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(ROUTES.MESSAGES);
    }
  };

  const handleInfoClick = () => {
    setShowSecurityDetails(!showSecurityDetails);
  };

  const handleAvatarClick = () => {
    navigate(ROUTES.PROFILE(partner.id));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAvatarClick();
    }
  };

  const handleVerifyClick = () => {
    if (onVerifyIdentity) {
      onVerifyIdentity();
    }
  };

  // Rendu du statut (en ligne / hors ligne / frappe)
  const renderStatus = () => {
    if (isPartnerTyping) {
      return (
        <TypingIndicator 
          variant="dots"
          size="sm"
          showText={true}
          text="En train d'écrire"
        />
      );
    }
    
    if (partner.is_online) {
      return (
        <span className={`${STATUS_COLORS.online} font-medium flex items-center gap-1`}>
          <span className={`w-1.5 h-1.5 ${STATUS_COLORS.onlineDot} rounded-full animate-pulse`} />
          En ligne
        </span>
      );
    }
    
    return formatLastSeen(partner.last_seen);
  };

  // Configuration de sécurité
  const securityConfig = SECURITY_CONFIG[securityLevel] || SECURITY_CONFIG.none;
  const SecurityIcon = securityConfig.icon;
  const securityColor = STATUS_COLORS[securityConfig.color];

  return (
    <>
      <div className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBack} 
              className="p-2 hover:bg-accent rounded-full transition-all active:scale-95"
              aria-label="Retour aux messages"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div 
              role="button"
              tabIndex={0}
              onClick={handleAvatarClick}
              onKeyDown={handleKeyDown}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
              aria-label={`Profil de ${partner.full_name || partner.username}`}
            >
              <div className="relative">
                <Avatar className="w-11 h-11 border-2 border-border">
                  <AvatarImage src={partner.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary-light text-white font-bold">
                    {partner.full_name?.charAt(0) || partner.username?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                {partner.is_online && (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${STATUS_COLORS.onlineDot}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base leading-tight truncate">
                    {partner.full_name || partner.username}
                  </h2>
                  {/* Badge de vérification */}
                  {isVerified && (
                    <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {renderStatus()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Bouton de sécurité */}
            <button 
              onClick={handleInfoClick}
              className={`p-2.5 hover:bg-accent rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary relative group`}
              aria-label="Informations de sécurité"
            >
              <SecurityIcon className={`w-5 h-5 ${securityColor}`} />
              {securityLevel === 'verified' && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--color-success)] rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </div>
        
        {/* Bannière de sécurité dynamique */}
        <div className={`flex items-center justify-between gap-1.5 py-1.5 px-4 ${securityColor} bg-opacity-5 border-t ${securityColor} border-opacity-10`}>
          <div className="flex items-center gap-1.5">
            <SecurityIcon className={`w-3 h-3 ${securityColor}`} />
            <span className={`text-[10px] font-medium ${securityColor}`}>
              {securityConfig.text}
            </span>
          </div>
          
          {/* Bouton de vérification (si non vérifié et chiffré) */}
          {securityLevel === 'encrypted' && !isVerified && onVerifyIdentity && (
            <button
              onClick={handleVerifyClick}
              disabled={isVerifying}
              className="text-[10px] font-medium text-[var(--color-warning)] hover:opacity-80 transition-colors disabled:opacity-50"
            >
              {isVerifying ? 'Vérification...' : 'Vérifier l\'identité'}
            </button>
          )}
        </div>
      </div>

      {/* Modal/Slide-out des détails de sécurité */}
      {showSecurityDetails && (
        <div className="absolute top-20 right-4 z-40 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-top-2">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Sécurité de la conversation</h3>
              <button
                onClick={() => setShowSecurityDetails(false)}
                className="p-1 hover:bg-accent rounded-full"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div className={`flex items-start gap-3 p-2 rounded-lg ${securityColor} bg-opacity-10`}>
                <SecurityIcon className={`w-5 h-5 ${securityColor} mt-0.5`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{securityConfig.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {securityConfig.tooltip}
                  </p>
                </div>
              </div>
              
              {fingerprint && (
                <div className="p-2 bg-muted rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Empreinte de sécurité
                  </p>
                  <p className="text-xs font-mono break-all">
                    {fingerprint}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Vérifiez cette empreinte avec {partner.full_name} en personne.
                  </p>
                </div>
              )}
              
              {securityLevel === 'encrypted' && !isVerified && onVerifyIdentity && (
                <button
                  onClick={handleVerifyClick}
                  disabled={isVerifying}
                  className="w-full py-2 bg-[var(--color-warning)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isVerifying ? 'Vérification en cours...' : 'Vérifier l\'identité'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

MessageHeader.propTypes = {
  partner: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    avatar: PropTypes.string,
    full_name: PropTypes.string,
    username: PropTypes.string,
    is_online: PropTypes.bool,
    last_seen: PropTypes.string
  }).isRequired,
  isPartnerTyping: PropTypes.bool,
  onBackClick: PropTypes.func,
  onVerifyIdentity: PropTypes.func,
  isVerified: PropTypes.bool,
  securityLevel: PropTypes.oneOf(['none', 'encrypted', 'verified']),
  fingerprint: PropTypes.string,
  isVerifying: PropTypes.bool
};

export default MessageHeader;
