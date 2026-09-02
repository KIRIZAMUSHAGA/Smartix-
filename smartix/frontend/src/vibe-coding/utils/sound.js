/**
 * sound.js - Utilitaire de gestion des sons pour les notifications
 * 
 * Rôle: Jouer des sons pour les notifications du débogueur
 * - Sons optionnels (peuvent être désactivés)
 * - Gestion du cooldown anti-spam
 * - Pool audio pour éviter les interruptions
 * - Préchargement automatique
 * - Respect des politiques navigateur (WebAudio)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

// =============================
// CONFIGURATION
// =============================

const SOUND_CONFIG = {
  enabled: true,
  volume: 0.5,
  useWebAudio: typeof AudioContext !== 'undefined',
  cooldown: 500, // ms entre deux sons
  poolSize: 3, // 3 instances audio pour éviter les interruptions
  autoMuteThreshold: 10, // désactiver après 10 erreurs
};

// Cache des sons
const soundCache = new Map();

// Statistiques pour auto-mute
let errorCountInLastMinute = 0;
let errorCountTimer = null;

// =============================
// AUDIO POOL
// =============================
class AudioPool {
  constructor() {
    this.pool = [];
    this.currentIndex = 0;
  }

  initialize(poolSize, soundUrl) {
    for (let i = 0; i < poolSize; i++) {
      const audio = new Audio();
      audio.src = soundUrl;
      audio.preload = 'auto';
      audio.load();
      this.pool.push(audio);
    }
  }

  getNext() {
    if (this.pool.length === 0) return null;
    const audio = this.pool[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.pool.length;
    return audio;
  }

  reset() {
    this.pool.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.currentIndex = 0;
  }
}

// Pools par type de son
const audioPools = new Map();

// =============================
// WEB AUDIO CONTEXT (avec gestion auto-start)
// =============================
let audioContext = null;
let audioContextInitialized = false;
let audioContextAllowed = false;

const initAudioContext = () => {
  if (!SOUND_CONFIG.useWebAudio || audioContextInitialized) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContextInitialized = true;
    
    // Suspendre immédiatement (attente interaction utilisateur)
    if (audioContext.state === 'running') {
      audioContext.suspend();
    }
    
    console.log('🔊 WebAudio initialisé (en attente interaction)');
  } catch (error) {
    console.warn('⚠️ Web Audio API non supportée', error);
    SOUND_CONFIG.useWebAudio = false;
  }
};

const resumeAudioContext = async () => {
  if (!audioContext || audioContextAllowed) return;
  
  try {
    await audioContext.resume();
    audioContextAllowed = true;
    console.log('🔊 WebAudio activé');
  } catch (error) {
    console.warn('⚠️ Impossible de démarrer WebAudio:', error);
  }
};

const closeAudioContext = () => {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    audioContextInitialized = false;
    audioContextAllowed = false;
  }
};

// =============================
// GÉNÉRATEUR DE SONS WEB AUDIO
// =============================
const generateBeepSound = (frequency = 440, duration = 200, type = 'sine', volume = SOUND_CONFIG.volume) => {
  if (!SOUND_CONFIG.useWebAudio || !audioContext || !audioContextAllowed) return false;

  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration / 1000);

    return true;
  } catch (error) {
    console.warn('⚠️ Erreur génération son:', error);
    return false;
  }
};

// =============================
// FRÉQUENCES PAR TYPE
// =============================
const SOUND_FREQUENCIES = {
  critical: { freq: 220, type: 'sawtooth', duration: 400 }, // grave, agressif
  error: { freq: 330, type: 'triangle', duration: 300 },    // medium
  warning: { freq: 440, type: 'sine', duration: 250 },      // medium-aigu
  success: { freq: 880, type: 'sine', duration: 200 },      // aigu
  info: { freq: 660, type: 'sine', duration: 150 },         // aigu court
  fix: { freq: 1046, type: 'square', duration: 300 },       // Do6
  debug: { freq: 523, type: 'sine', duration: 150 }         // Do5
};

// Sons pour HTML5 Audio (base64 différents)
const SOUND_URLS = {
  critical: 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAACAgICAf39/f3+/v7+/+/v7+/////////v7+/v//////////////////////////////////////////////////w==',
  error: 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAACAgICAf39/f3+/v7+/+/v7+/////////v7+/v//////////////////////////////////////////////////w==',
  warning: 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAACAgICAf39/f3+/v7+/+/v7+/////////v7+/v//////////////////////////////////////////////////w==',
  success: 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAACAgICAf39/f3+/v7+/+/v7+/////////v7+/v//////////////////////////////////////////////////w==',
  info: 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAACAgICAf39/f3+/v7+/+/v7+/////////v7+/v//////////////////////////////////////////////////w==',
  fix: 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAACAgICAf39/f3+/v7+/+/v7+/////////v7+/v//////////////////////////////////////////////////w==',
  debug: 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAACAgICAf39/f3+/v7+/+/v7+/////////v7+/v//////////////////////////////////////////////////w=='
};

// =============================
// COOLDOWN MANAGER
// =============================
class CooldownManager {
  constructor() {
    this.lastPlayed = 0;
  }

  canPlay() {
    const now = Date.now();
    if (now - this.lastPlayed < SOUND_CONFIG.cooldown) {
      return false;
    }
    this.lastPlayed = now;
    return true;
  }

  reset() {
    this.lastPlayed = 0;
  }
}

const cooldownManager = new CooldownManager();

// =============================
// AUTO-MUTE MANAGER
// =============================
const resetErrorCount = () => {
  errorCountInLastMinute = 0;
};

const startErrorTimer = () => {
  if (errorCountTimer) clearInterval(errorCountTimer);
  errorCountTimer = setInterval(resetErrorCount, 60000);
};

const checkAutoMute = () => {
  errorCountInLastMinute++;
  
  if (errorCountInLastMinute >= SOUND_CONFIG.autoMuteThreshold) {
    console.log('🔇 Trop d\'erreurs, désactivation automatique des sons');
    SOUND_CONFIG.enabled = false;
    return true;
  }
  return false;
};

// =============================
// PRÉCHARGEMENT
// =============================
const preloadSounds = async () => {
  const promises = Object.entries(SOUND_URLS).map(async ([type, url]) => {
    // Précharger avec HTML5 Audio
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    
    // Créer le pool
    const pool = new AudioPool();
    pool.initialize(SOUND_CONFIG.poolSize, url);
    audioPools.set(type, pool);
    
    return new Promise((resolve) => {
      audio.addEventListener('canplaythrough', () => {
        soundCache.set(type, audio);
        resolve();
      }, { once: true });
      audio.load();
    });
  });

  await Promise.allSettled(promises);
  console.log('✅ Sons préchargés');
};

// =============================
// API PUBLIQUE
// =============================

/**
 * Joue un son
 */
export const playSound = async (type, options = {}) => {
  // Vérifier si les sons sont activés
  if (!SOUND_CONFIG.enabled && !options.force) {
    return false;
  }

  // Vérifier le cooldown
  if (!cooldownManager.canPlay() && !options.force) {
    return false;
  }

  // Vérifier l'auto-mute
  if (checkAutoMute() && !options.force) {
    return false;
  }

  // Mettre à jour le volume si spécifié
  if (options.volume !== undefined) {
    SOUND_CONFIG.volume = Math.max(0, Math.min(1, options.volume));
  }

  // Essayer Web Audio d'abord
  if (SOUND_CONFIG.useWebAudio && audioContextAllowed) {
    const freqConfig = SOUND_FREQUENCIES[type] || SOUND_FREQUENCIES.info;
    const result = generateBeepSound(
      freqConfig.freq,
      freqConfig.duration,
      freqConfig.type,
      SOUND_CONFIG.volume
    );
    if (result) return true;
  }

  // Fallback HTML5 Audio avec pool
  const pool = audioPools.get(type);
  if (pool) {
    const audio = pool.getNext();
    if (audio) {
      try {
        audio.volume = SOUND_CONFIG.volume;
        audio.currentTime = 0;
        await audio.play();
        return true;
      } catch (error) {
        console.warn(`⚠️ Erreur lecture son ${type}:`, error);
      }
    }
  }

  return false;
};

/**
 * Active/désactive les sons
 */
export const setSoundEnabled = (enabled) => {
  SOUND_CONFIG.enabled = enabled;
  if (enabled) {
    resetErrorCount();
    startErrorTimer();
  }
};

/**
 * Règle le volume
 */
export const setSoundVolume = (volume) => {
  SOUND_CONFIG.volume = Math.max(0, Math.min(1, volume));
};

/**
 * Teste tous les sons
 */
export const testSounds = async () => {
  const results = {};
  const types = Object.keys(SOUND_FREQUENCIES);

  for (const type of types) {
    results[type] = await playSound(type, { force: true });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
};

/**
 * Nettoie le cache audio
 */
export const clearSoundCache = () => {
  audioPools.forEach(pool => pool.reset());
  audioPools.clear();
  soundCache.clear();
};

/**
 * Initialise le système audio (à appeler après interaction utilisateur)
 */
export const initializeAudio = async () => {
  await resumeAudioContext();
  await preloadSounds();
  startErrorTimer();
};

// =============================
// HOOK REACT
// =============================
export const useSound = () => {
  const [enabled, setEnabledState] = useState(SOUND_CONFIG.enabled);
  const [volume, setVolumeState] = useState(SOUND_CONFIG.volume);
  const [isInitialized, setIsInitialized] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    // Initialisation après premier render
    if (!initRef.current) {
      initRef.current = true;
      
      // Attendre interaction utilisateur pour WebAudio
      const handleUserInteraction = async () => {
        await initializeAudio();
        setIsInitialized(true);
        window.removeEventListener('click', handleUserInteraction);
        window.removeEventListener('keydown', handleUserInteraction);
      };

      window.addEventListener('click', handleUserInteraction);
      window.addEventListener('keydown', handleUserInteraction);
    }

    return () => {
      closeAudioContext();
    };
  }, []);

  const play = useCallback(async (type, options = {}) => {
    if (!isInitialized) return false;
    return playSound(type, options);
  }, [isInitialized]);

  const enable = useCallback(() => {
    setSoundEnabled(true);
    setEnabledState(true);
  }, []);

  const disable = useCallback(() => {
    setSoundEnabled(false);
    setEnabledState(false);
  }, []);

  const setVolume = useCallback((newVolume) => {
    setSoundVolume(newVolume);
    setVolumeState(newVolume);
  }, []);

  return {
    enabled,
    volume,
    isInitialized,
    play,
    enable,
    disable,
    setVolume,
    test: testSounds
  };
};

// =============================
// COMPOSANT UI
// =============================
export const SoundControl = ({ className = '' }) => {
  const { enabled, volume, isInitialized, play, enable, disable, setVolume, test } = useSound();

  return (
    <div className={`sound-control ${className}`}>
      <div className="sound-header">
        <span className="sound-icon">🔊</span>
        <span className="sound-title">Notifications sonores</span>
        <label className="sound-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => e.target.checked ? enable() : disable()}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {enabled && (
        <div className="sound-volume">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="volume-slider"
            disabled={!isInitialized}
          />
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </div>
      )}

      <button 
        className="sound-test-btn" 
        onClick={test}
        disabled={!isInitialized}
      >
        {isInitialized ? 'Tester les sons' : 'Initialisation...'}
      </button>

      <style jsx>{`
        .sound-control {
          padding: 8px;
          background: #2d2d2d;
          border-radius: 6px;
          border: 1px solid #3e3e3e;
        }

        .sound-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sound-icon {
          font-size: 16px;
        }

        .sound-title {
          flex: 1;
          font-size: 12px;
          color: #d4d4d4;
        }

        .sound-toggle {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
        }

        .sound-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #3e3e3e;
          transition: 0.2s;
          border-radius: 20px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: 0.2s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #2196f3;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .sound-volume {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }

        .volume-slider {
          flex: 1;
          height: 4px;
          -webkit-appearance: none;
          background: #1e1e1e;
          border-radius: 2px;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: #007bff;
          border-radius: 50%;
          cursor: pointer;
        }

        .volume-slider:disabled::-webkit-slider-thumb {
          background: #888;
          cursor: not-allowed;
        }

        .volume-value {
          min-width: 40px;
          font-size: 11px;
          color: #888;
        }

        .sound-test-btn {
          width: 100%;
          margin-top: 8px;
          padding: 4px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 11px;
        }

        .sound-test-btn:hover:not(:disabled) {
          background: #3e3e3e;
        }

        .sound-test-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default {
  playSound,
  setSoundEnabled,
  setSoundVolume,
  testSounds,
  clearSoundCache,
  initializeAudio,
  useSound,
  SoundControl
};
SoundControl.propTypes = {
  className: PropTypes.any,
};
