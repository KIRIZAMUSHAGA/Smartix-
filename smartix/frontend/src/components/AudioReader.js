
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Volume2, VolumeX, Pause, Play, SkipForward } from 'lucide-react';
import { Button } from './ui/button';

/**
 * AudioReader - Composant de lecture vocale du texte
 * Utilise Web Speech API (SpeechSynthesis)
 * Props:
 * - text: string - Texte à lire
 * - onComplete: function - Callback à la fin de la lecture
 */
const AudioReader = ({ text, onComplete }) => {
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);

  // Nettoyer la synthèse vocale au démontage
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Annuler la lecture si le texte change
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      setIsPaused(false);
    }
  }, [text]);

  const speak = useCallback(() => {
    if (!window.speechSynthesis) {
      alert('Votre navigateur ne supporte pas la lecture vocale');
      return;
    }

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsReading(true);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsReading(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsReading(false);
      setIsPaused(false);
      if (onComplete) onComplete();
    };

    utterance.onerror = (event) => {
      console.error('Speech error:', event);
      setIsReading(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [text, rate, isPaused, onComplete]);

  const pause = useCallback(() => {
    if (window.speechSynthesis && isReading) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsReading(false);
    }
  }, [isReading]);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      setIsPaused(false);
    }
  }, []);

  return (
    <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="flex items-center gap-2">
        {!isReading && !isPaused && (
          <Button
            onClick={speak}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <Volume2 className="w-4 h-4" />
            Lire
          </Button>
        )}

        {isReading && (
          <Button
            onClick={pause}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <Pause className="w-4 h-4" />
            Pause
          </Button>
        )}

        {isPaused && (
          <Button
            onClick={speak}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Reprendre
          </Button>
        )}

        {(isReading || isPaused) && (
          <Button
            onClick={stop}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <VolumeX className="w-4 h-4" />
            Stop
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-gray-600 dark:text-gray-400">Vitesse:</span>
        <select
          value={rate}
          onChange={(e) => setRate(parseFloat(e.target.value))}
          className="text-xs border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="0.75">0.75x</option>
          <option value="1.0">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
        </select>
      </div>
    </div>
  );
};

AudioReader.propTypes = {
  text: PropTypes.string.isRequired,
  onComplete: PropTypes.func
};

export default AudioReader;
