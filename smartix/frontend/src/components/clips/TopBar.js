
import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Plus, WifiOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import useOnlineStatus from '../../hooks/useOnlineStatus';

const TopBar = ({ 
  immersiveMode = false, 
  onBack, 
  showBackButton = false,
  createPath = '/create-veo',
  title = 'SmartClips',
  className = ''
}) => {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  const handleCreateClick = () => {
    if (isOnline) {
      navigate(createPath);
    } else {
      toast.error('Création impossible hors-ligne');
    }
  };

  const handleBackClick = () => {
    if (onBack) {
      try {
        onBack();
      } catch (error) {
        console.error('Error in onBack callback:', error);
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  // Classes de base
  const barClasses = `
    absolute top-0 left-0 right-0 
    p-4 
    flex items-center justify-between 
    z-10 
    transition-all duration-300 ease-out
    ${immersiveMode ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
    ${className}
  `;

  return (
    <div className={barClasses}>
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button
            onClick={handleBackClick}
            className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/50 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        )}
        
        <button 
          onClick={() => navigate('/feed')} 
          className="text-white text-xl font-bold drop-shadow-lg flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg px-2 py-1 -ml-2"
          aria-label="Accueil"
        >
          {title}
          {!isOnline && <WifiOff className="w-4 h-4 text-yellow-400" aria-label="Hors ligne" />}
        </button>
      </div>
      
      <button
        onClick={handleCreateClick}
        disabled={!isOnline}
        className={`
          px-5 py-2.5 
          bg-gradient-to-r from-[#005CFF] to-[#44B0FF] 
          hover:shadow-lg hover:shadow-[#005CFF]/50 
          text-white rounded-full 
          font-semibold 
          transition-all 
          flex items-center gap-2 
          focus:outline-none focus:ring-2 focus:ring-white/50 
          active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
        `}
        aria-label="Créer un SmartClip"
        aria-disabled={!isOnline}
      >
        <Plus className="w-5 h-5" />
        Créer
      </button>
    </div>
  );
};

TopBar.propTypes = {
  immersiveMode: PropTypes.bool,
  onBack: PropTypes.func,
  showBackButton: PropTypes.bool,
  createPath: PropTypes.string,
  title: PropTypes.string,
  className: PropTypes.string
};

export default TopBar;
