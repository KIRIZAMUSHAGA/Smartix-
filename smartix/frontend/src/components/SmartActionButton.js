import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import PropTypes from 'prop-types';

const SmartActionButton = ({ onClick }) => {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    onClick?.();
    setTimeout(() => setIsClicked(false), 600);
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-24 right-6 z-40 group"
    >
      {/* Explosion wave effect */}
      {isClicked && (
        <>
          <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping" />
          <div className="absolute inset-0 rounded-full border-2 border-violet-500 animate-ping" style={{ animationDelay: '0.2s' }} />
        </>
      )}

      {/* Main button */}
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl" />

        {/* Button */}
        <div className="relative bg-gradient-to-br from-cyan-400 to-violet-500 hover:from-cyan-500 hover:to-violet-600 text-white font-bold w-16 h-16 rounded-full flex items-center justify-center shadow-2xl hover:shadow-2xl hover:shadow-cyan-400/50 transition-all transform group-hover:scale-110 active:scale-95">
          <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform" />
        </div>
      </div>
    </button>
  );
};

SmartActionButton.propTypes = {
  onClick: PropTypes.func.isRequired,
};

export default SmartActionButton;
