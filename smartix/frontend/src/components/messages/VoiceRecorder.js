// src/components/messages/VoiceRecorder.js
import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Mic, Square, X, Loader2, Pause, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import useVoiceRecorder from '../../hooks/useVoiceRecorder';

// Composant d'indicateur de niveau sonore
const AudioLevelIndicator = memo(({ level }) => {
  const bars = [0.3, 0.5, 0.7, 1, 0.8, 0.6, 0.4];
  
  return (
    <div className="flex items-center gap-0.5 h-8">
      {bars.map((threshold, i) => (
        <div
          key={i}
          className="w-1 bg-primary rounded-full transition-all duration-75"
          style={{
            height: `${Math.min(100, Math.max(20, (level / threshold) * 100))}%`,
            opacity: level >= threshold ? 1 : 0.3
          }}
        />
      ))}
    </div>
  );
});

AudioLevelIndicator.displayName = 'AudioLevelIndicator';

const VoiceRecorder = ({
  onStart,
  onStop,
  onCancel,
  maxDuration = 60,
  minDuration = 1,
  autoSendOnStop = false,
  enableSilenceDetection = true,
  enableSlideToCancel = true,
  enableCompression = false
}) => {
  // Utilisation du hook pour toute la logique d'enregistrement
  const {
    isRecording,
    isPaused,
    isLocked,
    duration,
    formattedDuration,
    audioLevel,
    isRequestingPermission,
    hasPermission,
    error,
    progress,
    isNearLimit,
    isAtLimit,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    handleSlide,
    reset
  } = useVoiceRecorder({
    maxDuration,
    minDuration,
    autoSendOnStop,
    enableSilenceDetection,
    enableSlideToCancel,
    enableCompression,
    onStart,
    onStop,
    onCancel,
    onError: (err) => {
      console.error('VoiceRecorder error:', err);
      toast.error(err);
    }
  });

  // Gestion des événements tactiles pour le slide
  const touchStartRef = React.useRef(null);
  
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };
  
  const handleTouchMove = (e) => {
    if (!isRecording || !touchStartRef.current) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = touchStartRef.current.y - currentY;
    
    handleSlide(deltaX, deltaY);
    
    // Feedback visuel pour le slide
    if (deltaX < -50) {
      // Slide vers la gauche pour annuler
      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    } else if (deltaY > 50) {
      // Slide vers le haut pour lock
      e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
    }
  };
  
  const handleTouchEnd = (e) => {
    touchStartRef.current = null;
    e.currentTarget.style.backgroundColor = '';
  };

  return (
    <div 
      className="p-3 bg-primary/10 border-t border-primary/20 rounded-lg transition-colors duration-200"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Message d'erreur */}
      {error && (
        <div className="mb-3 p-2 bg-red-500/20 text-red-500 text-xs rounded-lg text-center">
          {error}
        </div>
      )}
      
      {/* Statut et durée */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            isRecording && !isPaused ? 'bg-red-500 animate-pulse' : 
            isPaused ? 'bg-yellow-500' : 
            isLocked ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium">
            {isLocked ? 'Verrouillé' :
             isPaused ? 'En pause' : 
             isRecording ? 'Enregistrement...' : 
             'Prêt'}
          </span>
        </div>
        
        <div className={`font-mono text-lg font-bold ${isNearLimit ? 'text-red-500' : 'text-primary'}`}>
          {formattedDuration}
        </div>
      </div>
      
      {/* Barre de progression */}
      <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${
            isAtLimit ? 'bg-red-500' : 'bg-primary'
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      
      {/* Indicateur de niveau sonore */}
      {isRecording && !isPaused && (
        <div className="mt-3 flex justify-center">
          <AudioLevelIndicator level={audioLevel} />
        </div>
      )}
      
      {/* Indicateur de verrouillage */}
      {isLocked && (
        <p className="text-[10px] text-green-500 text-center mt-2">
          🔒 Enregistrement verrouillé (glissez vers le bas pour déverrouiller)
        </p>
      )}
      
      {/* Alerte fin d'enregistrement */}
      {isNearLimit && !isAtLimit && (
        <p className="text-[10px] text-red-500 text-center mt-2 animate-pulse">
          ⏰ Fin de l'enregistrement dans {maxDuration - duration} secondes
        </p>
      )}
      
      {/* Indicateur de silence détecté */}
      {enableSilenceDetection && isRecording && !isPaused && audioLevel < 0.05 && duration > 2 && (
        <p className="text-[10px] text-yellow-500 text-center mt-2">
          🎤 Aucun son détecté - l'enregistrement s'arrêtera automatiquement
        </p>
      )}
      
      {/* Boutons de contrôle */}
      <div className="flex justify-center gap-4 mt-3">
        {!isRecording ? (
          <>
            <button
              onClick={cancelRecording}
              className="p-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Annuler"
            >
              <X className="w-5 h-5" />
            </button>
            
            <button
              onClick={startRecording}
              disabled={isRequestingPermission}
              className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Commencer l'enregistrement"
            >
              {isRequestingPermission ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={cancelRecording}
              className="p-3 text-gray-500 hover:text-gray-600 hover:bg-gray-500/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              aria-label="Annuler l'enregistrement"
            >
              <X className="w-5 h-5" />
            </button>
            
            {isPaused ? (
              <button
                onClick={resumeRecording}
                className="p-4 bg-primary text-white rounded-full hover:bg-primary-light transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label="Reprendre l'enregistrement"
              >
                <Play className="w-6 h-6 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                disabled={isLocked}
                className={`p-4 bg-yellow-500 text-white rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
                  isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-600'
                }`}
                aria-label="Mettre en pause"
              >
                <Pause className="w-6 h-6" />
              </button>
            )}
            
            <button
              onClick={stopRecording}
              className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Arrêter l'enregistrement"
            >
              <Square className="w-6 h-6 fill-current" />
            </button>
          </>
        )}
      </div>
      
      {/* Instructions */}
      <p className="text-center text-[10px] text-muted-foreground/50 mt-3">
        {minDuration > 0 && `Minimum ${minDuration} seconde${minDuration > 1 ? 's' : ''} · `}
        Maximum {maxDuration} secondes
        {!isRecording && enableSlideToCancel && ` · Glissez vers le haut 🔒 / gauche ❌`}
        {isRecording && !isLocked && ` · Glissez vers le haut pour verrouiller`}
        {isRecording && isLocked && ` · Glissez vers le bas pour déverrouiller`}
      </p>
      
      {/* Message de permission refusée */}
      {hasPermission === false && (
        <p className="text-center text-[10px] text-red-500 mt-2">
          🎤 Permission microphone refusée. Vérifiez les paramètres de votre navigateur.
        </p>
      )}
      
      {/* Indicateur d'envoi automatique */}
      {autoSendOnStop && isRecording && (
        <p className="text-center text-[10px] text-blue-500 mt-2">
          📤 Envoi automatique à l'arrêt
        </p>
      )}
    </div>
  );
};

AudioLevelIndicator.propTypes = {
  level: PropTypes.number.isRequired
};

VoiceRecorder.propTypes = {
  onStart: PropTypes.func,
  onStop: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  maxDuration: PropTypes.number,
  minDuration: PropTypes.number,
  autoSendOnStop: PropTypes.bool,
  enableSilenceDetection: PropTypes.bool,
  enableSlideToCancel: PropTypes.bool,
  enableCompression: PropTypes.bool
};

export default memo(VoiceRecorder);
