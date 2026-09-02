// src/components/ui/EncryptionBadge.js
import React, { memo, useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Lock, Shield, AlertTriangle, Info, CheckCircle, Eye } from 'lucide-react';

/**
 * Détermine le niveau de sécurité à afficher basé sur les données backend
 * @param {Object} security - Propriétés de sécurité (backend uniquement)
 * @returns {Object} - Configuration d'affichage
 */
const getSecurityConfig = (security) => {
  // Vérification de sécurité réelle
  const isE2EEVerified = security?.e2ee === true && security?.verified === true;
  const isE2EEUnverified = security?.e2ee === true && security?.verified !== true;
  const isEncryptedInTransit = security?.transport === 'tls' || security?.transport === 'https';
  const isEncryptedAtRest = security?.storage === 'encrypted';
  const isInsecure = security?.e2ee === false && security?.transport !== 'tls';
  
  if (isE2EEVerified) {
    return {
      level: 'e2ee_verified',
      label: 'Chiffrement vérifié',
      shortLabel: 'E2EE vérifié',
      description: 'Messages chiffrés de bout en bout. Votre conversation est sécurisée et vérifiée.',
      securityDetails: [
        '✓ Chiffrement de bout en bout actif',
        '✓ Identités vérifiées',
        '✓ Messages sécurisés sur tous les appareils'
      ],
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      icon: Shield,
      verified: true
    };
  }
  
  if (isE2EEUnverified) {
    return {
      level: 'e2ee_unverified',
      label: 'Chiffrement non vérifié',
      shortLabel: 'E2EE non vérifié',
      description: 'Messages chiffrés de bout en bout, mais l\'identité du destinataire n\'est pas vérifiée.',
      securityDetails: [
        '✓ Chiffrement de bout en bout actif',
        '⚠️ Identité du destinataire non vérifiée',
        '✓ Messages sécurisés sur tous les appareils'
      ],
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      icon: Lock,
      verified: false
    };
  }
  
  if (isEncryptedInTransit && isEncryptedAtRest) {
    return {
      level: 'encrypted',
      label: 'Chiffrement complet',
      shortLabel: 'Chiffré',
      description: 'Messages chiffrés en transit et au repos. Non disponible en lecture par serveur.',
      securityDetails: [
        '✓ Chiffrement en transit (TLS)',
        '✓ Chiffrement au repos',
        '⚠️ Serveur peut théoriquement déchiffrer'
      ],
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      icon: Lock,
      verified: false
    };
  }
  
  if (isEncryptedInTransit) {
    return {
      level: 'tls_only',
      label: 'Chiffrement en transit',
      shortLabel: 'TLS',
      description: 'Messages chiffrés pendant le transport. Non disponibles en stockage.',
      securityDetails: [
        '✓ Chiffrement en transit (TLS)',
        '⚠️ Messages stockés non chiffrés',
        '⚠️ Serveur peut accéder aux messages'
      ],
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      icon: Lock,
      verified: false
    };
  }
  
  if (isInsecure) {
    return {
      level: 'insecure',
      label: 'Non sécurisé',
      shortLabel: 'Non sécurisé',
      description: 'Les messages ne sont pas chiffrés. Évitez de partager des informations sensibles.',
      securityDetails: [
        '❌ Aucun chiffrement actif',
        '❌ Messages visibles par le serveur',
        '⚠️ Risque d\'interception'
      ],
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      icon: AlertTriangle,
      verified: false
    };
  }
  
  // Configuration par défaut (inconnue)
  return {
    level: 'unknown',
    label: 'Niveau inconnu',
    shortLabel: '?',
    description: 'Les paramètres de sécurité de cette conversation ne sont pas disponibles.',
    securityDetails: [
      '⚠️ Informations de sécurité non disponibles',
      '⚠️ Contactez le support pour plus d\'informations'
    ],
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    icon: Info,
    verified: false
  };
};

/**
 * Composant d'indicateur de chiffrement (basé sur données backend)
 * @param {Object} security - Propriétés de sécurité (DOIT venir du backend)
 * @param {string} security.transport - 'tls' | 'https' | 'none'
 * @param {string} security.storage - 'encrypted' | 'plain'
 * @param {boolean} security.e2ee - Chiffrement de bout en bout
 * @param {boolean} security.verified - Identité vérifiée
 * @param {string} security.keyFingerprint - Empreinte de clé (optionnel)
 */
const EncryptionBadge = ({
  security,           // UNIQUE source de vérité (backend uniquement)
  variant = 'badge',
  size = 'md',
  showLabel = true,
  showDescription = false,
  showTooltip = true,
  onVerify = null,    // Callback pour vérification d'identité
  className = ''
}) => {
  const [showTooltipState, setShowTooltipState] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);
  
  // Configuration basée sur les données backend
  const config = getSecurityConfig(security);
  const Icon = config.icon;
  
  // Gestion du clic pour mobile (toggle tooltip)
  const handleTooltipToggle = () => {
    setShowTooltipState(prev => !prev);
  };
  
  const handleTooltipClose = () => {
    setShowTooltipState(false);
    setShowDetails(false);
  };
  
  // Fermeture au clic en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowTooltipState(false);
        setShowDetails(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Tailles
  const sizeClasses = {
    sm: {
      badge: 'text-[10px] px-1.5 py-0.5 gap-1',
      icon: 'w-3 h-3',
      label: 'text-[10px]'
    },
    md: {
      badge: 'text-xs px-2 py-1 gap-1.5',
      icon: 'w-3.5 h-3.5',
      label: 'text-xs'
    },
    lg: {
      badge: 'text-sm px-3 py-1.5 gap-2',
      icon: 'w-4 h-4',
      label: 'text-sm'
    }
  };
  
  // Variant: icône seule
  if (variant === 'icon') {
    return (
      <div 
        className="relative inline-flex items-center"
        ref={buttonRef}
      >
        <button
          className={`${config.color} focus:outline-none focus:ring-2 focus:ring-primary rounded-full`}
          onMouseEnter={() => setShowTooltipState(true)}
          onMouseLeave={() => setShowTooltipState(false)}
          onClick={handleTooltipToggle}
          aria-label="Informations de sécurité"
          aria-describedby="security-tooltip"
        >
          <Icon className={sizeClasses[size].icon} />
        </button>
        
        {showTooltip && showTooltipState && (
          <div 
            id="security-tooltip"
            role="tooltip"
            ref={tooltipRef}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-xs rounded-lg shadow-xl z-50 w-64 pointer-events-auto"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{config.label}</span>
                {config.verified && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
              </div>
              <p className="text-[10px] text-white/70">{config.description}</p>
              {security?.keyFingerprint && showDetails && (
                <div className="mt-1 pt-1 border-t border-white/20">
                  <p className="text-[9px] font-mono text-white/50 break-all">
                    Empreinte: {security.keyFingerprint}
                  </p>
                </div>
              )}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-[9px] text-white/50 hover:text-white/80 text-left mt-1"
              >
                {showDetails ? 'Masquer détails' : 'Afficher les détails techniques'}
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90" />
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Variant: bannière (pour header de conversation)
  if (variant === 'banner') {
    return (
      <div className={`flex items-center justify-center gap-1.5 py-1.5 ${config.bgColor} border-t ${config.borderColor}`}>
        <Icon className={`w-3 h-3 ${config.color}`} />
        <span className={`text-[10px] font-medium ${config.color}`}>
          {config.label}
        </span>
        {config.level === 'e2ee_unverified' && onVerify && (
          <button
            onClick={onVerify}
            className="ml-2 text-[10px] text-yellow-500 hover:text-yellow-600 underline"
          >
            Vérifier
          </button>
        )}
      </div>
    );
  }
  
  // Variant: badge avec tooltip détaillé
  if (variant === 'tooltip') {
    return (
      <div className="relative inline-block">
        <button
          ref={buttonRef}
          className={`inline-flex items-center gap-1.5 ${sizeClasses[size].badge} ${config.bgColor} ${config.color} rounded-full cursor-help focus:outline-none focus:ring-2 focus:ring-primary`}
          onMouseEnter={() => setShowTooltipState(true)}
          onMouseLeave={() => setShowTooltipState(false)}
          onClick={handleTooltipToggle}
          aria-label="Informations de sécurité"
          aria-describedby="security-badge-tooltip"
        >
          <Icon className={sizeClasses[size].icon} />
          {showLabel && (
            <span className={sizeClasses[size].label}>
              {config.shortLabel}
            </span>
          )}
        </button>
        
        {showTooltip && showTooltipState && (
          <div 
            id="security-badge-tooltip"
            role="tooltip"
            ref={tooltipRef}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-xs rounded-lg shadow-xl z-50 w-64 pointer-events-auto"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{config.label}</span>
                {config.verified && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
              </div>
              <p className="text-[10px] text-white/70">{config.description}</p>
              
              {/* Détails de sécurité */}
              <div className="mt-1 pt-1 border-t border-white/20">
                {config.securityDetails.map((detail, idx) => (
                  <p key={idx} className="text-[9px] text-white/50">
                    {detail}
                  </p>
                ))}
              </div>
              
              {security?.keyFingerprint && (
                <p className="text-[8px] font-mono text-white/40 break-all mt-1">
                  Empreinte: {security.keyFingerprint.slice(0, 20)}...
                </p>
              )}
              
              {config.level === 'e2ee_unverified' && onVerify && (
                <button
                  onClick={() => {
                    onVerify();
                    setShowTooltipState(false);
                  }}
                  className="mt-1 text-[10px] text-yellow-500 hover:text-yellow-400 text-left"
                >
                  Vérifier l'identité
                </button>
              )}
              
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90" />
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Variant: badge simple (sans tooltip)
  return (
    <div className={`inline-flex items-center gap-1.5 ${sizeClasses[size].badge} ${config.bgColor} ${config.color} rounded-full ${className}`}>
      <Icon className={sizeClasses[size].icon} />
      {showLabel && (
        <span className={sizeClasses[size].label}>
          {config.shortLabel}
        </span>
      )}
    </div>
  );
};

EncryptionBadge.propTypes = {
  security: PropTypes.shape({
    e2ee: PropTypes.bool,
    verified: PropTypes.bool,
    transport: PropTypes.string,
    storage: PropTypes.string
  }),
  variant: PropTypes.oneOf(['badge', 'icon', 'full']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showLabel: PropTypes.bool,
  showDescription: PropTypes.bool,
  showTooltip: PropTypes.bool,
  onVerify: PropTypes.func,
  className: PropTypes.string
};

EncryptionBadge.displayName = 'EncryptionBadge';

export default memo(EncryptionBadge);
