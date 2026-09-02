// src/hooks/useVideoPlayer.js
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// =============================
// CONSTANTES
// =============================
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const STALL_RECOVERY_DELAY = 2000;
const FREEZE_DETECTION_INTERVAL = 2000;
const PROGRESS_THROTTLE_MS = 100;
const TIME_CHANGE_THRESHOLD = 0.25;

// =============================
// HOOK: useVideoPlayer
// =============================
const useVideoPlayer = ({ src, isActive, muted, onProgress, isOnline }) => {
  const videoRef = useRef(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Refs pour éviter les closures stale
  const retryCountRef = useRef(0);
  const stallTimeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const lastProgressTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const isMountedRef = useRef(true);
  const videoSrcRef = useRef(src);

  // Mettre à jour la ref de la source
  useEffect(() => {
    videoSrcRef.current = src;
  }, [src]);

  // =============================
  // Exponential backoff avec jitter
  // =============================
  const getRetryDelay = useCallback((attempt) => {
    const baseDelay = RETRY_DELAY_BASE * Math.pow(2, attempt);
    const jitter = Math.random() * 300;
    return baseDelay + jitter;
  }, []);

  // =============================
  // Schedule retry (sans dépendance error)
  // =============================
  const scheduleRetry = useCallback(() => {
    const nextAttempt = retryCountRef.current + 1;
    const delay = getRetryDelay(nextAttempt);
    
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    
    retryTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      const video = videoRef.current;
      if (video) {
        // Cache busting pour forcer le rechargement
        const cacheBustedSrc = `${videoSrcRef.current}?t=${Date.now()}`;
        video.src = cacheBustedSrc;
        video.load();
        
        video.play().catch((playErr) => {
          console.warn(`Retry ${nextAttempt} failed:`, playErr);
          if (nextAttempt >= MAX_RETRIES) {
            setError(true);
          } else {
            retryCountRef.current = nextAttempt;
            scheduleRetry();
          }
        });
      }
    }, delay);
  }, [getRetryDelay]);

  // =============================
  // Réinitialisation au changement de source
  // =============================
  useEffect(() => {
    retryCountRef.current = 0;
    setError(false);
    setBuffering(false);
    setLoaded(false);
    setNeedsInteraction(false);
    setCurrentTime(0);
    setDuration(0);
    lastTimeRef.current = 0;
    
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  }, [src]);

  // =============================
  // Gestion du timeupdate (throttlé + seuil)
  // =============================
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    
    const now = Date.now();
    if (now - lastProgressTimeRef.current < PROGRESS_THROTTLE_MS) return;
    lastProgressTimeRef.current = now;
    
    const current = video.currentTime;
    const dur = video.duration;
    
    // Mettre à jour currentTime seulement si changement significatif
    if (Math.abs(current - currentTime) > TIME_CHANGE_THRESHOLD) {
      setCurrentTime(current);
    }
    
    if (dur > 0 && onProgress) {
      onProgress((current / dur) * 100);
    }
  }, [isActive, onProgress, currentTime]);

  // =============================
  // Gestion du loadedmetadata
  // =============================
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      setLoaded(true);
    }
  }, []);

  // =============================
  // Gestion du waiting (buffering)
  // =============================
  const handleWaiting = useCallback(() => {
    if (isActive) setBuffering(true);
  }, [isActive]);

  const handlePlaying = useCallback(() => {
    setBuffering(false);
    setError(false);
    setNeedsInteraction(false);
    retryCountRef.current = 0;
  }, []);

  // =============================
  // Gestion du stall (récupération)
  // =============================
  const handleStalled = useCallback(() => {
    if (!isActive) return;
    
    setBuffering(true);
    
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    
    stallTimeoutRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && video.paused && !video.ended && isMountedRef.current) {
        video.play().catch(() => {});
      }
    }, STALL_RECOVERY_DELAY);
  }, [isActive]);

  // =============================
  // Détection de freeze (Netflix-like)
  // =============================
  useEffect(() => {
    if (!isActive) return;
    
    const freezeInterval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      
      const current = video.currentTime;
      if (Math.abs(current - lastTimeRef.current) < 0.05 && !buffering && !error) {
        console.warn('Freeze detected → attempting recovery');
        video.play().catch(() => {});
      }
      
      lastTimeRef.current = current;
    }, FREEZE_DETECTION_INTERVAL);
    
    return () => clearInterval(freezeInterval);
  }, [isActive, buffering, error]);

  // =============================
  // Gestion des erreurs (tous les codes)
  // =============================
  const handleError = useCallback(() => {
    const video = videoRef.current;
    const errorCode = video?.error?.code;
    
    switch (errorCode) {
      case 2: // MEDIA_ERR_NETWORK
        if (isOnline && retryCountRef.current < MAX_RETRIES) {
          scheduleRetry();
        } else {
          setError(true);
        }
        break;
      
      case 3: // MEDIA_ERR_DECODE
      case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
        setError(true);
        break;
      
      case 1: // MEDIA_ERR_ABORTED
        // Aborté par l'utilisateur, pas d'erreur
        break;
      
      default:
        setError(true);
    }
  }, [isOnline, scheduleRetry]);

  // =============================
  // Gestion du mute
  // =============================
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  // =============================
  // Gestion du preload intelligent
  // =============================
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.preload = isActive ? 'auto' : 'metadata';
    }
  }, [isActive]);

  // =============================
  // Nettoyage final
  // =============================
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // =============================
  // Gestion des écouteurs d'événements
  // =============================
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('error', handleError);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [handleTimeUpdate, handleWaiting, handlePlaying, handleStalled, handleError, handleLoadedMetadata]);

  // =============================
  // Tentative de lecture quand active
  // =============================
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive || error) return;
    
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        if (err.name === 'NotAllowedError') {
          setNeedsInteraction(true);
        } else if (err.name !== 'AbortError') {
          setError(true);
        }
      });
    }
  }, [isActive, error]);

  // =============================
  // Pause quand inactif
  // =============================
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (!isActive && !video.paused) {
      video.pause();
    }
  }, [isActive]);

  // =============================
  // Réinitialisation manuelle
  // =============================
  const resetAndRetry = useCallback(() => {
    setError(false);
    setNeedsInteraction(false);
    retryCountRef.current = 0;
    const video = videoRef.current;
    if (video) {
      const cacheBustedSrc = `${videoSrcRef.current}?t=${Date.now()}`;
      video.src = cacheBustedSrc;
      video.load();
      video.play().catch(() => {});
    }
  }, []);

  // =============================
  // Interaction utilisateur (tap to play)
  // =============================
  const handleUserInteraction = useCallback(() => {
    if (!needsInteraction) return;
    
    const video = videoRef.current;
    if (video) {
      video.play()
        .then(() => setNeedsInteraction(false))
        .catch(() => {});
    }
  }, [needsInteraction]);

  return {
    videoRef,
    error,
    loaded,
    buffering,
    needsInteraction,
    currentTime,
    duration,
    resetAndRetry,
    handleUserInteraction,
    setLoaded: () => setLoaded(true)
  };
};

export default useVideoPlayer;
