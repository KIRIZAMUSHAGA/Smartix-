import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

const OfflinePullMessage = ({ show, onHide, duration = 3000 }) => {
  useEffect(() => {
    if (!show) return undefined;
    const timer = setTimeout(() => {
      onHide?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, onHide, duration]);

  if (!show) return null;

  return (
    <div className="offline-pull-message" role="alert" aria-live="assertive">
      <div className="message-content">
        <span className="icon" aria-hidden="true">⚠️</span>
        <span className="text">
          Impossible d'actualiser cette page, veuillez vérifier votre connexion internet !
        </span>
      </div>
    </div>
  );
};

OfflinePullMessage.propTypes = {
  show: PropTypes.bool,
  onHide: PropTypes.func,
  duration: PropTypes.number,
};

export default OfflinePullMessage;
