// src/hooks/useVoiceRecorder.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

// =============================
// CONSTANTES
// =============================
const MAX_DURATION = 60; // secondes
const MIN_DURATION = 1; // secondes
const AUDIO_LEVEL_THROTTLE_MS = 100; // 10 fps max
const SILENCE_THRESHOLD = 0.02; // Niveau audio considéré comme silence
const SILENCE_DURATION_LIMIT = 3000; // 3 secondes de silence -> arrêt auto

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
    channelCount: 1
  }
};

// MIME types supportés (ordre de priorité)
const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg'
];

// Paramètres de compression cible (Opus voix)
const COMPRESSION_BITRATE = 24000;      // 24 kbps
const COMPRESSION_SAMPLE_RATE = 16000;  // 16 kHz
const COMPRESSION_CHANNELS = 1;         // mono

// =============================
// UTILITAIRES
// =============================

/**
 * Formate la durée en mm:ss
 */
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Détecte le MIME type supporté par le navigateur
 */
const getSupportedMimeType = () => {
  for (const type of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
};

/**
 * Normalise un blob audio (seulement si nécessaire)
 */
const normalizeAudioBlob = async (blob, originalMimeType) => {
  // Ne normaliser que si absolument nécessaire (non-WebM)
  if (originalMimeType.includes('webm')) {
    return blob;
  }
  
  // Tentative de conversion légère
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Conversion vers WebM
    const mediaStreamDestination = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(mediaStreamDestination);
    source.start();
    
    const recorder = new MediaRecorder(mediaStreamDestination.stream, {
      mimeType: 'audio/webm'
    });
    
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const normalizedBlob = new Blob(chunks, { type: 'audio/webm' });
        audioContext.close();
        resolve(normalizedBlob);
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 100);
    });
  } catch (err) {
    console.warn('Audio normalization failed:', err);
    return blob;
  }
};

/**
 * Compresse un blob audio :
 *   - downsample à 16 kHz mono via OfflineAudioContext
 *   - ré-encode en audio/webm;codecs=opus à 24 kbps via MediaRecorder
 * Retourne le blob original (sans changement) si la compression échoue
 * ou n'est pas supportée par le navigateur.
 */
const compressAudioBlob = async (blob) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || typeof OfflineAudioContext === 'undefined') {
      return blob;
    }
    const targetMime = 'audio/webm;codecs=opus';
    if (typeof MediaRecorder === 'undefined' ||
        !MediaRecorder.isTypeSupported ||
        !MediaRecorder.isTypeSupported(targetMime)) {
      return blob;
    }

    const decodeCtx = new AudioCtx();
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
    decodeCtx.close();

    const length = Math.max(1, Math.ceil(decoded.duration * COMPRESSION_SAMPLE_RATE));
    const offlineCtx = new OfflineAudioContext(
      COMPRESSION_CHANNELS,
      length,
      COMPRESSION_SAMPLE_RATE
    );
    const offlineSrc = offlineCtx.createBufferSource();
    offlineSrc.buffer = decoded;
    offlineSrc.connect(offlineCtx.destination);
    offlineSrc.start(0);
    const rendered = await offlineCtx.startRendering();

    const playbackCtx = new AudioCtx({ sampleRate: COMPRESSION_SAMPLE_RATE });
    const dest = playbackCtx.createMediaStreamDestination();
    const playbackSrc = playbackCtx.createBufferSource();
    playbackSrc.buffer = rendered;
    playbackSrc.connect(dest);

    const recorder = new MediaRecorder(dest.stream, {
      mimeType: targetMime,
      audioBitsPerSecond: COMPRESSION_BITRATE
    });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    return await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try { playbackCtx.close(); } catch (_) {}
        const out = new Blob(chunks, { type: 'audio/webm' });
        resolve(out.size > 0 ? out : blob);
      };
      recorder.onstop = finish;
      recorder.onerror = () => { settled = true; try { playbackCtx.close(); } catch (_) {} resolve(blob); };
      playbackSrc.onended = () => {
        try { recorder.stop(); } catch (_) { finish(); }
      };
      recorder.start();
      playbackSrc.start(0);
    });
  } catch (err) {
    console.warn('compressAudioBlob failed, returning original blob:', err);
    return blob;
  }
};

// =============================
// HOOK PRINCIPAL
// =============================
const useVoiceRecorder = (options = {}) => {
  const {
    maxDuration = MAX_DURATION,
    minDuration = MIN_DURATION,
    autoSendOnStop = false,
    enableSilenceDetection = false,
    enableSlideToCancel = false,
    enableCompression = false,
    onStart,
    onStop,
    onCancel,
    onError
  } = options;
  
  // États
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [slideDelta, setSlideDelta] = useState(0);
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const durationRef = useRef(0);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const mimeTypeRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastAudioLevelUpdateRef = useRef(0);
  const silenceStartRef = useRef(null);
  const stopRecordingRef = useRef(null);
  const currentAudioUrlRef = useRef(null);
  
  // Mettre à jour les refs
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);
  
  /**
   * Nettoie les timers
   */
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);
  
  /**
   * Nettoie l'analyseur audio
   */
  const cleanupAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (analyserRef.current) {
      try {
        if (sourceRef.current) {
          sourceRef.current.disconnect(analyserRef.current);
        }
        analyserRef.current.disconnect();
      } catch (e) {
        console.warn('Error cleaning up analyser:', e);
      }
      analyserRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {
        console.warn('Error cleaning up source:', e);
      }
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.suspend();
    }
  }, []);
  
  /**
   * Nettoie le flux audio
   */
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);
  
  /**
   * Nettoie l'URL audio
   */
  const cleanupAudioUrl = useCallback(() => {
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
  }, []);
  
  /**
   * Nettoie toutes les ressources
   */
  const cleanup = useCallback(() => {
    clearTimers();
    cleanupAudioAnalysis();
    cleanupStream();
    cleanupAudioUrl();
    
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording' || 
          mediaRecorderRef.current.state === 'paused') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('Error stopping MediaRecorder:', e);
        }
      }
      mediaRecorderRef.current = null;
    }
    
    audioChunksRef.current = [];
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevel(0);
    setSlideDelta(0);
    setIsLocked(false);
    silenceStartRef.current = null;
  }, [clearTimers, cleanupAudioAnalysis, cleanupStream, cleanupAudioUrl]);
  
  /**
   * Configure l'analyseur de niveau audio avec throttling
   */
  const setupAudioLevelAnalysis = useCallback(() => {
    if (!streamRef.current) return;
    
    try {
      // Créer l'analyseur une seule fois
      if (!analyserRef.current) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      }
      
      // Créer la source une seule fois
      if (!sourceRef.current) {
        sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
        sourceRef.current.connect(analyserRef.current);
        audioContextRef.current.resume();
      }
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      let silenceCounter = 0;
      
      const updateLevel = () => {
        if (!isRecordingRef.current || !analyserRef.current) {
          return;
        }
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        const normalizedLevel = Math.min(1, Math.max(0, average / 255));
        
        // Throttling pour éviter trop de re-renders
        const now = Date.now();
        if (now - lastAudioLevelUpdateRef.current >= AUDIO_LEVEL_THROTTLE_MS) {
          setAudioLevel(normalizedLevel);
          lastAudioLevelUpdateRef.current = now;
        }
        
        // Détection de silence (optionnelle)
        if (enableSilenceDetection && isRecordingRef.current && !isPausedRef.current) {
          if (normalizedLevel < SILENCE_THRESHOLD) {
            if (!silenceStartRef.current) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_LIMIT) {
              // Arrêt automatique après période de silence
              if (stopRecordingRef.current) {
                stopRecordingRef.current();
                toast.info('Arrêt automatique (silence détecté)');
              }
              return;
            }
          } else {
            silenceStartRef.current = null;
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (err) {
      console.warn('Error setting up audio analysis:', err);
    }
  }, [enableSilenceDetection]);
  
  /**
   * Gère la visibilité de l'onglet (stop si caché)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording) {
        if (stopRecordingRef.current) {
          stopRecordingRef.current();
          toast.info('Enregistrement arrêté (onglet masqué)');
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording]);
  
  /**
   * Démarre l'enregistrement avec le flux audio
   */
  const startRecordingWithStream = useCallback(async (stream) => {
    streamRef.current = stream;
    
    // Détecter le MIME type supporté
    if (!mimeTypeRef.current) {
      mimeTypeRef.current = getSupportedMimeType();
      if (!mimeTypeRef.current) {
        const errorMsg = 'Votre navigateur ne supporte pas l\'enregistrement audio';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }
    
    // Configurer l'analyseur audio
    setupAudioLevelAnalysis();
    
    // Créer le MediaRecorder
    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: mimeTypeRef.current
    });
    audioChunksRef.current = [];
    
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };
    
    mediaRecorderRef.current.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      const errorMsg = 'Erreur lors de l\'enregistrement';
      setError(errorMsg);
      if (onError) onError(errorMsg);
      toast.error(errorMsg);
      cleanup();
      if (onCancel) onCancel();
    };
    
    mediaRecorderRef.current.onstop = async () => {
      if (!isRecordingRef.current && durationRef.current === 0) {
        return;
      }
      
      const blob = new Blob(audioChunksRef.current, { 
        type: mimeTypeRef.current
      });
      
      // Normaliser le blob (seulement si nécessaire)
      let normalizedBlob = await normalizeAudioBlob(blob, mimeTypeRef.current);

      // Compression optionnelle (downsample 16 kHz mono + Opus 24 kbps)
      let metadata = {
        bitrate: null,
        sampleRate: null,
        codec: (mimeTypeRef.current && mimeTypeRef.current.includes('opus')) ? 'opus' : null,
        mimeType: normalizedBlob.type || mimeTypeRef.current,
        size: normalizedBlob.size
      };
      if (enableCompression) {
        const compressed = await compressAudioBlob(normalizedBlob);
        if (compressed && compressed !== normalizedBlob && compressed.size > 0) {
          normalizedBlob = compressed;
          metadata = {
            bitrate: COMPRESSION_BITRATE,
            sampleRate: COMPRESSION_SAMPLE_RATE,
            codec: 'opus',
            mimeType: 'audio/webm',
            size: compressed.size
          };
        }
      }

      const url = URL.createObjectURL(normalizedBlob);
      
      if (autoSendOnStop && durationRef.current >= minDuration && onStop) {
        onStop(normalizedBlob, durationRef.current, metadata);
        cleanupAudioUrl();
      } else if (durationRef.current >= minDuration) {
        // Nettoyer l'ancienne URL
        cleanupAudioUrl();
        setAudioBlob(normalizedBlob);
        setAudioUrl(url);
        currentAudioUrlRef.current = url;
        if (onStop) onStop(normalizedBlob, durationRef.current, metadata);
      } else if (durationRef.current < minDuration && durationRef.current > 0) {
        const warningMsg = `Message trop court (minimum ${minDuration} seconde${minDuration > 1 ? 's' : ''})`;
        toast.warning(warningMsg);
        cleanupAudioUrl();
        if (onCancel) onCancel();
      }
    };
    
    mediaRecorderRef.current.start(100);
    isRecordingRef.current = true;
    setIsRecording(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    durationRef.current = 0;
    setDuration(0);
    setError(null);
    silenceStartRef.current = null;
    
    // Timer pour la durée
    timerRef.current = setInterval(() => {
      if (!isRecordingRef.current || isPausedRef.current) return;
      
      durationRef.current += 1;
      setDuration(durationRef.current);
      
      if (durationRef.current >= maxDuration) {
        if (stopRecordingRef.current) {
          stopRecordingRef.current();
        }
      }
    }, 1000);
    
    if (onStart) onStart();
  }, [maxDuration, minDuration, autoSendOnStop, setupAudioLevelAnalysis, cleanup, cleanupAudioUrl, onStart, onStop, onCancel, onError]);
  
  /**
   * Démarre l'enregistrement
   */
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    
    cleanup();
    
    setIsRequestingPermission(true);
    setHasPermission(null);
    setError(null);
    setSlideDelta(0);
    setIsLocked(false);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      setHasPermission(true);
      await startRecordingWithStream(stream);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      
      let errorMsg = 'Impossible d\'accéder au microphone';
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Permission refusée. Vérifiez les paramètres de votre navigateur.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'Aucun microphone trouvé.';
      }
      
      setError(errorMsg);
      setHasPermission(false);
      if (onError) onError(errorMsg);
      toast.error(errorMsg);
      if (onCancel) onCancel();
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isRecording, cleanup, startRecordingWithStream, onCancel, onError]);
  
  /**
   * Met en pause l'enregistrement
   */
  const pauseRecording = useCallback(() => {
    if (!isRecording || isPaused) return;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);
  
  /**
   * Reprend l'enregistrement
   */
  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused) return;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      silenceStartRef.current = null;
    }
  }, [isRecording, isPaused]);
  
  /**
   * Arrête l'enregistrement
   */
  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    
    isRecordingRef.current = false;
    
    if (mediaRecorderRef.current && 
        (mediaRecorderRef.current.state === 'recording' || 
         mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
    }
    
    clearTimers();
    cleanupAudioAnalysis();
    setAudioLevel(0);
    setIsRecording(false);
    setIsPaused(false);
    setIsLocked(false);
  }, [isRecording, clearTimers, cleanupAudioAnalysis]);
  
  /**
   * Annule l'enregistrement
   */
  const cancelRecording = useCallback(() => {
    isRecordingRef.current = false;
    cleanup();
    if (onCancel) onCancel();
  }, [cleanup, onCancel]);
  
  /**
   * Gère le slide pour annuler (geste WhatsApp)
   */
  const handleSlide = useCallback((deltaX, deltaY) => {
    if (!enableSlideToCancel || !isRecording) return;
    
    // Slide vers le haut pour lock
    if (deltaY < -50 && !isLocked) {
      setIsLocked(true);
      toast.info('Enregistrement verrouillé');
    }
    
    // Slide vers la gauche pour annuler
    if (deltaX < -100) {
      cancelRecording();
      toast.info('Enregistrement annulé');
    }
    
    setSlideDelta(Math.min(0, deltaX));
  }, [enableSlideToCancel, isRecording, isLocked, cancelRecording]);
  
  /**
   * Réinitialise l'état (après envoi)
   */
  const reset = useCallback(() => {
    cleanupAudioUrl();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setSlideDelta(0);
    setIsLocked(false);
  }, [cleanupAudioUrl]);
  
  /**
   * Obtient la durée formatée
   */
  const getFormattedDuration = useCallback(() => {
    return formatDuration(duration);
  }, [duration]);
  
  /**
   * Obtient le niveau d'audio normalisé (0-1)
   */
  const getNormalizedAudioLevel = useCallback(() => {
    return Math.min(1, Math.max(0, audioLevel));
  }, [audioLevel]);
  
  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      cleanup();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [cleanup]);
  
  return {
    // États
    isRecording,
    isPaused,
    isLocked,
    duration,
    formattedDuration: getFormattedDuration(),
    audioBlob,
    audioUrl,
    audioLevel: getNormalizedAudioLevel(),
    isRequestingPermission,
    hasPermission,
    error,
    slideDelta,
    progress: (duration / maxDuration) * 100,
    isNearLimit: duration >= maxDuration - 5,
    isAtLimit: duration >= maxDuration,
    
    // Actions
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    reset,
    handleSlide,
    
    // Utilitaires
    formatDuration,
    maxDuration,
    minDuration
  };
};

export default useVoiceRecorder;
