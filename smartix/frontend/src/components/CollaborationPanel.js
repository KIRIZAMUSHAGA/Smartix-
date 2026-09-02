import React from 'react';
import PropTypes from 'prop-types';
const COMP_NAME = ({ onClose, onSelect, ...props }) => (
  <div style={{ padding: 20, textAlign: 'center' }}>
    <p>Chargement...</p>
    {onClose && <button onClick={onClose} style={{ marginTop: 8 }}>Fermer</button>}
  </div>
);
COMP_NAME.propTypes = {
  onClose: PropTypes.func,
  onSelect: PropTypes.func,
};

export default COMP_NAME;
