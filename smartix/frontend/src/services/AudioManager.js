
import React from 'react';

/**
 * Gestionnaire global de lecture audio
 * Permet d'avoir un seul audio à la fois dans l'application
 * Évite que plusieurs messages vocaux jouent simultanément
 */
class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.currentId = null;
    this.listeners = new Set();
    this.playToken = null;
    this.state = 'idle'; // 'idle', 'loading', 'playing', 'paused', 'error'
    
    // WeakMap pour stocker les handlers sans muter l'objet DOM
    this.handlersMap = new WeakMap();
    
    // Gestion de la visibilité de l'onglet
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Gestion multi-onglets (BroadcastChannel)
    this.broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('audio_manager');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'stop_audio' && event.data.id !== this.currentId) {
          // Un autre onglet demande l'arrêt (optionnel)
          console.log('AudioManager: arrêt demandé par un autre onglet');
        }
      };
    }
  }

  /**
   * Gère la visibilité de l'onglet (pause quand onglet caché)
   */
  handleVisibilityChange() {
    if (document.hidden && this.state === 'playing') {
      this.pause();
    }
  }

  /**
   * Joue un audio (arrête automatiquement le précédent)
   * @param {string} id - Identifiant unique de l'audio
   * @param {HTMLAudioElement} audio - Élément audio à jouer
   * @returns {Promise<void>}
   */
  async play(id, audio) {
    // Arrêter l'audio en cours (sans reset pour conserver la position)
    this._stopCurrent(false);
    
    this.currentId = id;
    this.currentAudio = audio;
    this.state = 'loading';
    this._notifyListeners('loading', id);
    
    // Token pour éviter les races conditions
    const token = Symbol();
    this.playToken = token;
    
    // Nettoyer les anciens handlers si existants
    const oldHandlers = this.handlersMap.get(audio);
    if (oldHandlers) {
      audio.removeEventListener('ended', oldHandlers.onEnded);
      audio.removeEventListener('error', oldHandlers.onError);
      audio.removeEventListener('play', oldHandlers.onPlay);
      audio.removeEventListener('pause', oldHandlers.onPause);
    }
    
    // Nouveaux handlers
    const onEnded = () => {
      if (this.currentId === id && this.playToken === token) {
        this._stopCurrent(true);
        this._notifyListeners('ended', id);
      }
    };
    
    const onError = () => {
      if (this.currentId === id && this.playToken === token) {
        this.state = 'error';
        this._stopCurrent(true);
        this._notifyListeners('error', id);
      }
    };
    
    const onPlay = () => {
      if (this.currentId === id && this.playToken === token) {
        this.state = 'playing';
        this._notifyListeners('play', id);
      }
    };
    
    const onPause = () => {
      if (this.currentId === id && this.playToken === token && this.state !== 'idle') {
        this.state = 'paused';
        this._notifyListeners('pause', id);
      }
    };
    
    // Stocker dans WeakMap (sans muter l'objet DOM)
    this.handlersMap.set(audio, { onEnded, onError, onPlay, onPause });
    
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    
    try {
      await audio.play();
      
      // Vérifier la race condition
      if (this.playToken !== token) {
        // Une autre lecture a démarré entre temps
        this._cleanupAudio(audio);
        return;
      }
      
      this.state = 'playing';
      this._notifyListeners('play', id);
      
      // Notifier les autres onglets
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'play', id });
      }
    } catch (err) {
      console.error('AudioManager: échec de lecture', err);
      this.state = 'error';
      this._stopCurrent(true);
      this._notifyListeners('error', id);
      throw err;
    }
  }

  /**
   * Arrête l'audio en cours
   * @param {boolean} resetTime - Reset le temps de lecture (défaut: true)
   */
  stop(resetTime = true) {
    this._stopCurrent(resetTime);
  }

  /**
   * Stop interne
   * @param {boolean} resetTime - Reset le temps de lecture
   */
  _stopCurrent(resetTime = true) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      if (resetTime) {
        this.currentAudio.currentTime = 0;
      }
      
      // Nettoyer les event listeners
      this._cleanupAudio(this.currentAudio);
      
      this.currentAudio = null;
    }
    
    if (this.state !== 'idle') {
      const oldId = this.currentId;
      this.state = 'idle';
      this.currentId = null;
      this.playToken = null;
      this._notifyListeners('stop', oldId);
    }
  }

  /**
   * Nettoie les event listeners d'un audio
   * @param {HTMLAudioElement} audio
   */
  _cleanupAudio(audio) {
    const handlers = this.handlersMap.get(audio);
    if (handlers) {
      audio.removeEventListener('ended', handlers.onEnded);
      audio.removeEventListener('error', handlers.onError);
      audio.removeEventListener('play', handlers.onPlay);
      audio.removeEventListener('pause', handlers.onPause);
      this.handlersMap.delete(audio);
    }
  }

  /**
   * Met en pause l'audio en cours (conserve la position)
   */
  pause() {
    if (this.currentAudio && this.state === 'playing') {
      this.currentAudio.pause();
      // Le state sera mis à jour par l'événement 'pause'
    }
  }

  /**
   * Reprend la lecture de l'audio en cours
   */
  async resume() {
    if (this.currentAudio && this.state === 'paused') {
      const token = Symbol();
      this.playToken = token;
      
      try {
        await this.currentAudio.play();
        if (this.playToken !== token) return;
        this.state = 'playing';
        this._notifyListeners('resume', this.currentId);
      } catch (err) {
        console.error('AudioManager: échec de reprise', err);
        this.state = 'error';
        this._notifyListeners('error', this.currentId);
      }
    }
  }

  /**
   * Vérifie si un audio spécifique est en cours de lecture
   * @param {string} id - Identifiant de l'audio
   * @returns {boolean}
   */
  isCurrentPlaying(id) {
    return this.currentId === id && this.state === 'playing';
  }

  /**
   * Obtient l'ID de l'audio en cours
   * @returns {string|null}
   */
  getCurrentId() {
    return this.currentId;
  }

  /**
   * Obtient l'état actuel
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Vérifie si un audio est en cours de lecture
   * @returns {boolean}
   */
  hasActiveAudio() {
    return this.currentAudio !== null && this.state === 'playing';
  }

  /**
   * Ajoute un listener pour les événements
   * @param {Function} listener - (event, id) => void
   * @returns {Function} - Fonction de nettoyage
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifie tous les listeners
   * @param {string} event - Type d'événement
   * @param {string} id - Identifiant de l'audio
   */
  _notifyListeners(event, id) {
    this.listeners.forEach(listener => {
      try {
        listener(event, id);
      } catch (err) {
        console.error('AudioManager: erreur dans listener', err);
      }
    });
  }

  /**
   * Réinitialise complètement le gestionnaire
   */
  reset() {
    this._stopCurrent(true);
    this.listeners.clear();
    this.currentId = null;
    this.currentAudio = null;
    this.playToken = null;
    this.state = 'idle';
  }
  
  /**
   * Libère les ressources (à appeler au démontage de l'app)
   */
  destroy() {
    this.reset();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
  }
}

// Export d'une instance unique (singleton)
export const audioManager = new AudioManager();

// Hook React pour utiliser l'AudioManager
export const useAudioManager = () => {
  const [currentId, setCurrentId] = React.useState(null);
  const [state, setState] = React.useState('idle');

  React.useEffect(() => {
    const unsubscribe = audioManager.addListener((event, id) => {
      // Utilisation de la forme fonctionnelle pour éviter les closures stale
      if (event === 'play' || event === 'resume') {
        setCurrentId(id);
        setState('playing');
      } else if (event === 'stop' || event === 'ended') {
        setCurrentId(null);
        setState('idle');
      } else if (event === 'pause') {
        setState('paused');
      } else if (event === 'loading') {
        setState('loading');
      } else if (event === 'error') {
        setState('error');
      }
    });
    
    return unsubscribe;
  }, []); // Dépendances vides → une seule fois

  return {
    audioManager,
    currentPlayingId: currentId,
    state,
    isPlaying: state === 'playing',
    play: (id, audio) => audioManager.play(id, audio),
    stop: (resetTime = true) => audioManager.stop(resetTime),
    pause: () => audioManager.pause(),
    resume: () => audioManager.resume(),
    isCurrentPlaying: (id) => audioManager.isCurrentPlaying(id),
    getState: () => audioManager.getState()
  };
};

export default AudioManager;
