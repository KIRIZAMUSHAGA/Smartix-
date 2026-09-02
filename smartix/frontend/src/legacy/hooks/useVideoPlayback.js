
import { useRef, useEffect, useCallback, useState } from 'react';
import { playVideoSafely, pauseOtherVideos, cleanupDistantVideos, preloadNextVideos, PlaybackErrorType } from '../../utils/videoUtils';

const useVideoPlayback = (videoRefs, currentIndex, isOnline, preloadCount = 2, cleanupDistance = 3) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(null);
  
  const isMountedRef = useRef(true);
  const playAttemptsRef = useRef({});
  const timeoutsRef = useRef([]);
  const rafRef = useRef(null);

  // =============================
  // GESTION DES TIMEOUTS
  // =============================
  const addTimeout = useCallback((callback, delay) => {
    const id = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  // =============================
  // NETTOYAGE DES TENTATIVES DE LECTURE
  // =============================
  const clearPlayAttempt = useCallback((index) => {
    delete playAttemptsRef.current[index];
  }, []);

  const scheduleClearAttempt = useCallback((index, delay = 1000) => {
    addTimeout(() => clearPlayAttempt(index), delay);
  }, [addTimeout, clearPlayAttempt]);

  // =============================
  // JOUER LA VIDÉO COURANTE
  // =============================
  const playCurrentVideo = useCallback(async () => {
    const currentVideo = videoRefs.current[currentIndex];
    
    if (!currentVideo || !isOnline) {
      if (!isOnline) setError(PlaybackErrorType.NOT_ALLOWED);
      return;
    }
    
    // Éviter les tentatives multiples
    if (playAttemptsRef.current[currentIndex]) {
      return;
    }
    
    playAttemptsRef.current[currentIndex] = true;
    setError(null);
    
    try {
      const result = await playVideoSafely(currentVideo, { maxRetries: 2, muted: false });
      
      if (result.success) {
        setIsPlaying(true);
        setIsBuffering(false);
      } else {
        setError(result.error);
        if (result.error === PlaybackErrorType.NOT_ALLOWED) {
          // Autoplay bloqué, attendre une interaction utilisateur
          console.warn('Autoplay blocked, waiting for user interaction');
        }
      }
    } catch (err) {
      console.warn('Erreur lecture vidéo:', err);
      setError(PlaybackErrorType.UNKNOWN);
    } finally {
      scheduleClearAttempt(currentIndex, 1000);
    }
  }, [currentIndex, videoRefs, isOnline, scheduleClearAttempt]);

  // =============================
  // METTRE EN PAUSE LA VIDÉO COURANTE
  // =============================
  const pauseCurrent = useCallback(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo && !currentVideo.paused) {
      currentVideo.pause();
      setIsPlaying(false);
    }
  }, [currentIndex, videoRefs]);

  // =============================
  // BASCOULE PLAY/PAUSE
  // =============================
  const togglePlayPause = useCallback(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;
    
    if (currentVideo.paused) {
      // Lecture directe sans délai
      playCurrentVideo();
    } else {
      currentVideo.pause();
      setIsPlaying(false);
    }
  }, [currentIndex, videoRefs, playCurrentVideo]);

  // =============================
  // FORCER LA LECTURE (après erreur ou reconnexion)
  // =============================
  const forcePlayCurrent = useCallback(async () => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;
    
    clearPlayAttempt(currentIndex);
    setError(null);
    
    try {
      const result = await playVideoSafely(currentVideo, { maxRetries: 3, muted: false });
      if (result.success) {
        setIsPlaying(true);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(PlaybackErrorType.UNKNOWN);
    }
  }, [currentIndex, videoRefs, clearPlayAttempt]);

  // =============================
  // ÉCOUTE DES ÉVÉNEMENTS VIDÉO
  // =============================
  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleError = (e) => {
      console.warn('Video error:', e);
      setError(PlaybackErrorType.UNKNOWN);
    };

    currentVideo.addEventListener('play', handlePlay);
    currentVideo.addEventListener('pause', handlePause);
    currentVideo.addEventListener('waiting', handleWaiting);
    currentVideo.addEventListener('playing', handlePlaying);
    currentVideo.addEventListener('error', handleError);

    return () => {
      currentVideo.removeEventListener('play', handlePlay);
      currentVideo.removeEventListener('pause', handlePause);
      currentVideo.removeEventListener('waiting', handleWaiting);
      currentVideo.removeEventListener('playing', handlePlaying);
      currentVideo.removeEventListener('error', handleError);
    };
  }, [currentIndex, videoRefs]);

  // =============================
  // GESTION DE LA VISIBILITÉ (onglet caché)
  // =============================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying) {
        pauseCurrent();
      } else if (!document.hidden && isOnline) {
        playCurrentVideo();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, isOnline, pauseCurrent, playCurrentVideo]);

  // =============================
  // GESTION DE LA RECONNEXION
  // =============================
  useEffect(() => {
    if (isOnline && !isPlaying && videoRefs.current[currentIndex] && !videoRefs.current[currentIndex]?.paused === false) {
      forcePlayCurrent();
    }
  }, [isOnline, currentIndex, isPlaying, forcePlayCurrent, videoRefs]);

  // =============================
  // EFFET PRINCIPAL
  // =============================
  useEffect(() => {
    if (!videoRefs.current.length) return;
    
    pauseOtherVideos(videoRefs.current, currentIndex);
    
    // Utiliser requestAnimationFrame pour un meilleur timing
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      if (isMountedRef.current) {
        playCurrentVideo();
        preloadNextVideos(videoRefs.current, currentIndex, preloadCount);
        cleanupDistantVideos(videoRefs.current, currentIndex, cleanupDistance);
      }
    });
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentIndex, playCurrentVideo, preloadCount, cleanupDistance]);

  // =============================
  // NETTOYAGE AU DÉMONTAGE
  // =============================
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      clearAllTimeouts();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      videoRefs.current.forEach(video => {
        if (video) {
          video.pause();
          video.src = '';
          video.load();
        }
      });
      playAttemptsRef.current = {};
    };
  }, [videoRefs, clearAllTimeouts]);

  return {
    isPlaying,
    isBuffering,
    error,
    playCurrentVideo,
    pauseCurrent,
    togglePlayPause,
    forcePlayCurrent,
    clearError: () => setError(null)
  };
};

export default useVideoPlayback;
