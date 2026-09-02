import React from 'react';
import PropTypes from 'prop-types';
import '../styles/Loader.css';

// Ce composant est maintenant optionnel - le Loader HTML statique gère l'affichage
export default function Loader({ onLoadingComplete }) {
  return null;
}

Loader.propTypes = {
  onLoadingComplete: PropTypes.func
};
