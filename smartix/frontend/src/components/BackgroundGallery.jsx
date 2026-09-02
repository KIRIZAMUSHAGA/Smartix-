import React from 'react';
import PropTypes from 'prop-types';

function BackgroundGallery({ onSelect, selected }) {
  const backgrounds = [
    { id: 'white', label: 'Blanc', style: { background: '#ffffff' } },
    { id: 'dark', label: 'Sombre', style: { background: '#1a1a2e' } },
    { id: 'gradient1', label: 'Dégradé 1', style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
    { id: 'gradient2', label: 'Dégradé 2', style: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' } },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {backgrounds.map(bg => (
        <div
          key={bg.id}
          onClick={() => onSelect && onSelect(bg)}
          className={`w-16 h-16 rounded cursor-pointer border-2 ${selected?.id === bg.id ? 'border-blue-500' : 'border-transparent'}`}
          style={bg.style}
          title={bg.label}
        />
      ))}
    </div>
  );
}

BackgroundGallery.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selected: PropTypes.string
};

export default BackgroundGallery;
