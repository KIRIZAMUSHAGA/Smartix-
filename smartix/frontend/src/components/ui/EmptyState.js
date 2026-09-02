
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const EmptyState = ({ 
  icon,
  title,
  description,
  buttonText,
  buttonAction,
  buttonLink,
  iconBgColor = 'from-[#005CFF]/20 to-[#44B0FF]/20',
  iconColor = 'text-white/40',
  fullScreen = true,
  className = '',
  zIndex = 50,
  onError = null
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleButtonClick = async () => {
    if (isLoading) return;
    
    if (buttonAction) {
      setIsLoading(true);
      setError(null);
      try {
        await buttonAction();
      } catch (err) {
        setError(err.message);
        if (onError) onError(err);
      } finally {
        setIsLoading(false);
      }
    } else if (buttonLink) {
      navigate(buttonLink);
    }
  };

  // Cloner l'icône pour ajouter les classes
  const clonedIcon = icon && React.isValidElement(icon)
    ? React.cloneElement(icon, {
        className: `w-16 h-16 ${iconColor}`,
        'aria-hidden': true
      })
    : icon;

  const content = (
    <div className={`text-center ${fullScreen ? 'w-full' : ''}`}>
      <div className={`w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br ${iconBgColor} flex items-center justify-center`}>
        {clonedIcon}
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
      <p className="text-white/60 mb-8 max-w-md">{description}</p>
      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}
      {buttonText && (
        <button
          onClick={handleButtonClick}
          disabled={isLoading}
          className="px-8 py-4 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-2xl hover:shadow-[#005CFF]/50 text-white rounded-full font-semibold text-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mx-auto"
          aria-label={buttonText}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Chargement...
            </>
          ) : (
            buttonText
          )}
        </button>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div 
        className={`fixed inset-0 bg-gradient-to-br from-[#0A0A0A] via-[#1A1A2E] to-[#16213E] flex flex-col items-center justify-center p-4 ${className}`}
        style={{ zIndex }}
        role="status"
        aria-live="polite"
        aria-label={title}
      >
        {content}
      </div>
    );
  }

  return (
    <div 
      className={`flex flex-col items-center justify-center p-8 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {content}
    </div>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  description: PropTypes.string,
  buttonText: PropTypes.string,
  buttonAction: PropTypes.func,
  buttonLink: PropTypes.string,
  iconBgColor: PropTypes.string,
  iconColor: PropTypes.string,
  fullScreen: PropTypes.bool,
  className: PropTypes.string,
  zIndex: PropTypes.number,
  onError: PropTypes.func
};

export default EmptyState;
