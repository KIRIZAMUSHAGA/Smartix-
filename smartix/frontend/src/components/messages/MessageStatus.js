
import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';

// Constantes pour les types de statuts (meilleure maintenabilité)
export const MessageStatusType = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  ERROR: 'error'
};

// Configuration des icônes par statut
const STATUS_CONFIG = {
  [MessageStatusType.SENDING]: {
    icon: Clock,
    className: 'text-muted-foreground/50 animate-pulse',
    ariaLabel: 'Envoi en cours',
    tooltip: 'Envoi en cours...'
  },
  [MessageStatusType.SENT]: {
    icon: Check,
    className: 'text-muted-foreground/70',
    ariaLabel: 'Message envoyé',
    tooltip: 'Message envoyé'
  },
  [MessageStatusType.DELIVERED]: {
    icon: Check,
    className: 'text-muted-foreground/70',
    ariaLabel: 'Message délivré',
    tooltip: 'Message délivré'
  },
  [MessageStatusType.READ]: {
    icon: CheckCheck,
    className: 'text-[#34b7f1]',
    ariaLabel: 'Message lu',
    tooltip: 'Message lu'
  },
  [MessageStatusType.ERROR]: {
    icon: AlertCircle,
    className: 'text-red-500 cursor-pointer hover:text-red-600 transition-colors',
    ariaLabel: 'Erreur d\'envoi - Cliquez pour réessayer',
    tooltip: 'Échec d\'envoi - Cliquez pour réessayer'
  }
};

/**
 * Composant d'affichage du statut d'un message
 * @param {Object} props
 * @param {string} props.status - Statut du message (sending, sent, delivered, read, error)
 * @param {Function} props.onRetry - Fonction de réessai (appelée au clic en cas d'erreur)
 */
const MessageStatus = memo(({ status, onRetry }) => {
  // Validation du statut (fallback vers 'sending' si invalide)
  const validStatus = STATUS_CONFIG[status] ? status : MessageStatusType.SENDING;
  const config = STATUS_CONFIG[validStatus];
  const IconComponent = config.icon;
  
  const isError = validStatus === MessageStatusType.ERROR;
  
  const handleClick = () => {
    if (isError && onRetry) {
      onRetry();
    }
  };

  return (
    <div
      role="img"
      aria-label={config.ariaLabel}
      title={config.tooltip}
      className={`inline-flex items-center ${isError ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <IconComponent className={`w-3 h-3 ${config.className}`} />
    </div>
  );
});

MessageStatus.displayName = 'MessageStatus';

MessageStatus.propTypes = {
  status: PropTypes.oneOf(['sending', 'sent', 'delivered', 'read', 'error']).isRequired,
  onRetry: PropTypes.func
};

export default MessageStatus;
