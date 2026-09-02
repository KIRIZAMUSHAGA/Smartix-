// frontend/src/components/Comments/components/VoiceRecorder.js
import React from 'react';
import PropTypes from 'prop-types';
import { X, Mic, StopCircle, Loader2 } from 'lucide-react';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Animation CSS pour la waveform fluide
const waveformStyles = `
  @keyframes wave {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }
`;

const VoiceRecorder = ({ 
  isOpen,
  onClose,
  recorder,
  isProcessing = false
}) => {
  if (!isOpen) return null;

  const {
    isRecording,
    time,
    start,
    stop,
    cancel,
    canRecord,
    error
  } = recorder;

  return (
    <>
      <style>{waveformStyles}</style>
      <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#1C1E21] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Enregistrement vocal
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Fermer l'enregistrement vocal"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Waveform et timer */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 mx-4 flex items-center justify-center gap-1 h-12">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="bg-gradient-to-t from-cyan-400 to-purple-500 w-1 rounded-full"
                style={{
                  animation: isRecording ? `wave ${0.3 + i * 0.02}s ease-in-out infinite` : 'none',
                  animationDelay: `${i * 0.05}s`,
                  transformOrigin: 'center',
                  height: '24px'
                }}
              />
            ))}
          </div>
          <div className="text-gray-900 dark:text-white font-mono text-lg font-semibold min-w-[60px] text-right">
            {formatTime(time)}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-3">
          {!isRecording ? (
            <button
              onClick={start}
              disabled={!canRecord || isProcessing}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white rounded-xl py-3 px-4 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Démarrer l'enregistrement vocal"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 inline mr-2 animate-spin" />
              ) : (
                <Mic className="w-5 h-5 inline mr-2" />
              )}
              Démarrer
            </button>
          ) : (
            <>
              <button
                onClick={cancel}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl py-3 px-4 font-medium transition-all"
                aria-label="Annuler l'enregistrement"
              >
                Annuler
              </button>
              <button
                onClick={stop}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 px-4 font-bold transition-all"
                aria-label="Arrêter et sauvegarder l'enregistrement"
              >
                <StopCircle className="w-5 h-5 inline mr-2" />
                Arrêter
              </button>
            </>
          )}
        </div>

        {/* Indicateur d'enregistrement */}
        {isRecording && (
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-red-500">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>Enregistrement en cours...</span>
          </div>
        )}

        {/* Indicateur de traitement */}
        {isProcessing && !isRecording && (
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Traitement en cours...</span>
          </div>
        )}
      </div>
    </>
  );
};

VoiceRecorder.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  recorder: PropTypes.shape({
    isRecording: PropTypes.bool,
    time: PropTypes.number,
    start: PropTypes.func,
    stop: PropTypes.func,
    cancel: PropTypes.func,
    canRecord: PropTypes.bool,
    error: PropTypes.string
  }).isRequired,
  isProcessing: PropTypes.bool
};

export default VoiceRecorder;
