
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16'
};

const LoadingSpinner = ({ 
  size = 'md', 
  text = 'Chargement...', 
  fullScreen = false,
  timeout = null,
  onTimeout = null
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Détecter les préférences de mouvement réduit
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handleChange = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Gestion du timeout
  useEffect(() => {
    if (timeout && fullScreen && !timedOut) {
      const timer = setTimeout(() => {
        setTimedOut(true);
        if (onTimeout) onTimeout();
      }, timeout);
      
      return () => clearTimeout(timer);
    }
  }, [timeout, fullScreen, timedOut, onTimeout]);

  // Animation classes conditionnelles selon les préférences de mouvement
  const bounceClass = !reducedMotion ? 'animate-bounce' : '';
  const pulseClass = !reducedMotion ? 'animate-pulse' : '';
  const loadingClass = !reducedMotion ? 'animate-loading' : '';

  // Affichage en cas de timeout
  if (timedOut) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0A0A0A] to-[#1A1A2E] flex flex-col items-center justify-center z-50">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
            <svg className="w-12 h-12 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Chargement trop long</h2>
          <p className="text-white/60 text-sm mb-6">Vérifiez votre connexion et réessayez</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] rounded-full text-white font-semibold hover:scale-105 transition-transform"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const spinner = (
    <div 
      className="relative"
      role="status"
      aria-label={text || "Chargement en cours"}
    >
      <div className={`${sizeClasses[size]} border-2 border-white/20 border-t-[#005CFF] rounded-full ${!reducedMotion ? 'animate-spin' : ''}`} />
      <span className="sr-only">{text || "Chargement en cours"}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div 
        className="fixed inset-0 bg-gradient-to-br from-[#0A0A0A] to-[#1A1A2E] flex flex-col items-center justify-center z-50"
        role="status"
        aria-label="Chargement de l'application"
      >
        <div className="relative mb-8">
          <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-[#005CFF] to-[#44B0FF] blur-3xl opacity-50 ${pulseClass}`}></div>
          <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br from-[#005CFF] to-[#44B0FF] flex items-center justify-center shadow-2xl ${bounceClass}`}>
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h2 className={`text-2xl font-bold text-white mb-2 ${pulseClass}`}>SmartClips</h2>
        <p className="text-white/60 text-sm mb-8">{text}</p>
        <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full bg-gradient-to-r from-[#005CFF] to-[#44B0FF] rounded-full ${loadingClass}`} style={{ width: loadingClass ? 'auto' : '0%' }}></div>
        </div>
        
        {/* Animation keyframes injectées une seule fois */}
        {!document.getElementById('loading-spinner-styles') && (
          <style id="loading-spinner-styles">
            {`
              @keyframes loading {
                0% { width: 0%; margin-left: 0%; }
                50% { width: 75%; margin-left: 12.5%; }
                100% { width: 0%; margin-left: 100%; }
              }
              .animate-loading {
                animation: loading 1.5s ease-in-out infinite;
              }
            `}
          </style>
        )}
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center justify-center p-4"
      role="status"
      aria-label={text || "Chargement en cours"}
    >
      {spinner}
      {typeof text === 'string' && text.length > 0 && (
        <p className="mt-2 text-white/60 text-sm">{text}</p>
      )}
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  text: PropTypes.string,
  fullScreen: PropTypes.bool,
  timeout: PropTypes.number,
  onTimeout: PropTypes.func
};

export default LoadingSpinner;
