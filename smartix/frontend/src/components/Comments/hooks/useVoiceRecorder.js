import { useState, useCallback, useRef, useEffect } from 'react';

// =============================
// CONSTANTES
// =============================
const MAX_RECORDING_TIME = 300; // 5 minutes max
const MIN_RECORDING_TIME = 1; // 1 seconde min
const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
    channelCount: 1
  }
};

// =============================
// TYPES MIME SUPPORTÉS
// =============================
const getSupportedMimeType = () => {
  const types = [
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/wav"
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
};

// =============================
// FORMATAGE DU TEMPS
// =============================
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// =============================
// HOOK PRINCIPAL
// =============================
export const useVoiceRecorder = (options = {}) => {
  const {
    maxDuration = MAX_RECORDING_TIME,
    minDuration = MIN_RECORDING_TIME,
    onError = null,
    onStart = null,
    onStop = null
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [mimeType, setMimeType] = useState('');

  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startTimeRef = useRef(null);

  // =============================
  // VÉRIFICATION DU SUPPORT
  // =============================
  useEffect(() => {
    const supported = !!window.MediaRecorder;
    setIsSupported(supported);
    
    if (supported) {
      const mime = getSupportedMimeType();
      setMimeType(mime);
      if (!mime) {
        setError('Format audio non supporté par le navigateur');
      }
    } else {
      setError('Enregistrement audio non supporté par ce navigateur');
    }
  }, []);

  // =============================
  // NETTOYAGE DES RESSOURCES
  // =============================
  const cleanupResources = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      streamRef.current = null;
    }
    
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // =============================
  // DÉMARRER L'ENREGISTREMENT
  // =============================
  const startRecording = useCallback(async () => {
    if (isRecording || !isSupported || !mimeType) {
      const errMsg = !isSupported ? 'Audio non supporté' : 'Enregistrement déjà en cours';
      setError(errMsg);
      onError?.(new Error(errMsg));
      return;
    }

    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setError('Erreur lors de l\'enregistrement');
        onError?.(new Error('MediaRecorder error'));
        cancelRecording();
      };

      mediaRecorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const duration = recordingTime;
          
          if (duration >= minDuration) {
            setRecordingBlob(blob);
            onStop?.(blob, duration);
          } else {
            setError(`Enregistrement trop court (minimum ${minDuration}s)`);
            onError?.(new Error(`Recording too short: ${duration}s`));
          }
        }
        
        cleanupResources();
      };

      mediaRecorder.start(100); // Collecter des données toutes les 100ms
      setIsRecording(true);
      setRecordingTime(0);
      startTimeRef.current = Date.now();
      
      onStart?.();

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Microphone error:', err);
      
      let errorMessage = 'Impossible d\'accéder au microphone';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Permission microphone refusée';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Aucun microphone trouvé';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone déjà utilisé par une autre application';
      }
      
      setError(errorMessage);
      onError?.(new Error(errorMessage));
      cleanupResources();
    }
  }, [isRecording, isSupported, mimeType, maxDuration, minDuration, onError, onStart, onStop, cleanupResources]);

  // =============================
  // ARRÊTER L'ENREGISTREMENT
  // =============================
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;
    
    const duration = recordingTime;
    
    if (duration < minDuration) {
      cancelRecording();
      setError(`Enregistrement trop court (minimum ${minDuration}s)`);
      onError?.(new Error(`Recording too short: ${duration}s`));
      return;
    }
    
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, [isRecording, recordingTime, minDuration, onError, cancelRecording]);

  // =============================
  // ANNULER L'ENREGISTREMENT
  // =============================
  const cancelRecording = useCallback(() => {
    if (!isRecording) return;
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    
    cleanupResources();
    setRecordingBlob(null);
    setIsRecording(false);
    setRecordingTime(0);
    setError(null);
  }, [isRecording, cleanupResources]);

  // =============================
  // RÉINITIALISER
  // =============================
  const reset = useCallback(() => {
    if (isRecording) {
      cancelRecording();
    }
    setRecordingBlob(null);
    setRecordingTime(0);
    setError(null);
  }, [isRecording, cancelRecording]);

  // =============================
  // NETTOYAGE AU DÉMONTAGE
  // =============================
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    isRecording,
    recordingTime: formatTime(recordingTime),
    recordingTimeRaw: recordingTime,
    recordingBlob,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    canRecord: isSupported && !isRecording && !!mimeType,
    isMaxDuration: recordingTime >= maxDuration
  };
};
