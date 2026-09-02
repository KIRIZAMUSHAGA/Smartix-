import React from 'react';
const COMP_NAME = ({ onClose, onSelect, ...props }) => (
  <div style={{ padding: 20, textAlign: 'center' }}>
    <p>Chargement...</p>
    {onClose && <button onClick={onClose} style={{ marginTop: 8 }}>Fermer</button>}
  </div>
);
export default COMP_NAME;
