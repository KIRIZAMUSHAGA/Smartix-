// src/components/messages/AudioPreview.js
import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Play, Pause, X, Send, Loader2, FileAudio } from 'lucide-react';
import { Button } from '../ui/button';
import useAudioPlayer from '../../hooks/useAudioPlayer';

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0 || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Composant de barre de progression cliquable
const SeekBar = memo(({ progress, onSeek, duration, currentTime }) => {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (onSeek) onSeek(percent);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const newTime = Math.max(0, currentTime - 5);
      onSeek(newTime / duration);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const newTime = Math.min(duration, currentTime + 5);
      onSeek(newTime / duration);
    }
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progression audio"
      tabIndex={0}
      className="h-1.5 bg-white/20 rounded-full relative overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="absolute top-0 left-0 h-full bg-primary transition-all duration-75"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
});

SeekBar.displayName = 'SeekBar';

// Composant principal
const AudioPreview = ({
  blob,
  duration: propDuration,
  onClear,
  onSend,
  isUploading = false
}) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const prevBlobRef = useRef(null);
  
  // Générer un ID unique pour cet audio
  const audioId = useMemo(() => `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, []);
  
  // Utilisation du hook useAudioPlayer
  const {
    isPlaying,
    isLoading,
    error: audioError,
    duration,
    currentTime,
    progress,
    toggle,
    seekTo,
    formatTime,
    audioRef,
    reset
  } = useAudioPlayer(audioId, audioUrl, {
    autoPlay: false,
    onError: (err) => {
      console.error('Audio preview error:', err);
    }
  });

  // Gestion du seek
  const handleSeek = useCallback((percent) => {
    if (!duration) return;
    const newTime = percent * duration;
    seekTo(newTime);
  }, [duration, seekTo]);

  // Création et nettoyage de l'URL objet
  useEffect(() => {
    if (!blob) {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      return;
    }

    // Éviter de recréer l'URL si le blob est identique
    if (prevBlobRef.current === blob && audioUrl) {
      return;
    }

    // Nettoyer l'ancienne URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    // Arrêter la lecture avant changement
    if (isPlaying) {
      toggle();
    }
    
    reset();

    // Créer la nouvelle URL
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    prevBlobRef.current = blob;

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [blob, audioUrl, isPlaying, toggle, reset]);

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const displayDuration = duration > 0 ? duration : propDuration;

  return (
    <div className="p-3 bg-primary/10 border-t border-primary/20 flex items-center justify-between rounded-lg mb-2">
      {/* Élément audio caché - useAudioPlayer gère l'audio via audioRef */}
      <audio ref={audioRef} className="hidden" preload="metadata" />
      
      <div className="flex items-center gap-3 flex-1">
        {/* Bouton play/pause */}
        <button
          onClick={toggle}
          disabled={!!audioError || isLoading || !audioUrl}
          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-light transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
          aria-disabled={!!audioError || isLoading || !audioUrl}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
        
        {/* Barre de progression et informations */}
        <div className="flex-1 flex flex-col gap-1">
          <SeekBar 
            progress={progress}
            onSeek={handleSeek}
            duration={displayDuration}
            currentTime={currentTime}
          />
          
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-medium text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(displayDuration)}
            </span>
            <FileAudio className="w-3 h-3 text-muted-foreground/40" />
          </div>
          
          {/* Message d'erreur */}
          {audioError && (
            <span className="text-[10px] text-red-500">
              {audioError}
            </span>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onClear}
          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label="Annuler"
        >
          <X className="w-4 h-4" />
        </button>
        
        <button
          onClick={onSend}
          disabled={isUploading || !!audioError || !audioUrl}
          className="p-2 bg-primary text-white rounded-full hover:bg-primary-light transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Envoyer le message vocal"
          aria-disabled={isUploading || !!audioError || !audioUrl}
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

SeekBar.propTypes = {
  progress: PropTypes.number.isRequired,
  onSeek: PropTypes.func,
  duration: PropTypes.number,
  currentTime: PropTypes.number
};

AudioPreview.propTypes = {
  blob: PropTypes.instanceOf(Blob),
  duration: PropTypes.number,
  onClear: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
  isUploading: PropTypes.bool
};

export default memo(AudioPreview);
