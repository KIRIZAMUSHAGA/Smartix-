import React from 'react';
import PropTypes from 'prop-types';

/**
 * TestPost - Composant de test isolé type Facebook
 * @param {string} text - Contenu du post
 * @param {string} backgroundColor - Style CSS pour le fond (couleur, gradient)
 * @param {string} backgroundImage - URL de l'image de fond
 */
const TestPost = ({ text, backgroundColor, backgroundImage }) => {
  // Détermination de la couleur du texte (blanc si fond personnalisé, noir sinon)
  const isCustomBg = !!(backgroundColor || backgroundImage);
  const textColor = isCustomBg ? '#ffffff' : '#1f2937';

  const containerStyle = {
    position: 'relative',
    width: '100%',
    minHeight: '350px',
    borderRadius: '32px',
    margin: '20px 0',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s ease',
    background: !isCustomBg ? '#ffffff' : (backgroundColor || 'transparent'),
  };

  const bgImageStyle = backgroundImage ? {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    zIndex: 0,
  } : null;

  const contentStyle = {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    color: textColor,
    fontSize: '24px',
    fontWeight: '900',
    lineHeight: '1.3',
    textShadow: isCustomBg ? '0 2px 10px rgba(0, 0, 0, 0.3)' : 'none',
  };

  return (
    <div style={containerStyle}>
      {bgImageStyle && <div style={bgImageStyle} />}
      <p style={contentStyle}>{text}</p>
    </div>
  );
};

TestPost.propTypes = {
  text: PropTypes.string.isRequired,
  backgroundColor: PropTypes.any.isRequired,
  backgroundImage: PropTypes.any.isRequired,
};

export default TestPost;
