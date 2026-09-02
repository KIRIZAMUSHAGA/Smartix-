import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight, Heart, Download, Pause, Play, SendHorizontal, Share2, MessageCircle, Eye, Share, Copy, Film } from 'lucide-react';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { useWebSocket } from '../hooks/useWebSocket';
import { useApiClient } from '../contexts/ApiClientContext';
import { vibrateStrong, vibrateLight } from '../utils/vibration';
import { formatTimeAgo } from '../utils/timeFormatter';
import StoryReactionOverlay from './StoryReactionOverlay';
import { AuthContext } from '../contexts/AuthContext';
import { toast } from 'sonner';
import './ImmersiveStoryViewer.css';
import './StoryStats.css';

// =============================
// CONSTANTES
// =============================

const DEFAULT_STORY_DURATION = 5000; // 5 secondes
const PROGRESS_INTERVAL = 100;
const MAX_RETRIES = 3;
const FETCH_TIMEOUT = 30000;

// =============================
// HOOK: useStoryReactions (OPTIMISÉ)
// =============================
const useStoryReactions = (storyId, enabled = true, user = null) => {
  const [reactions, setReactions] = useState([]);
  const [hasLiked, setHasLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Memoized derived data
  const likeCount = useMemo(() => 
    reactions.filter(r => r.type === 'like').length, [reactions]);
  const commentCountDerived = useMemo(() => 
    reactions.filter(r => r.type === 'comment' || r.type === 'reply').length, [reactions]);
  const repliesCount = useMemo(() => 
    reactions.filter(r => r.type === 'reply').length, [reactions]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!storyId || !enabled) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    const loadReactions = async () => {
      try {
        const response = await fetch(`/api/stories/${storyId}/reactions`, {
          signal: abortControllerRef.current?.signal
        });
        if (!response.ok) throw new Error('Failed to load');
        const data = await response.json();
        if (isMountedRef.current) {
          setReactions(data.reactions || []);
          setHasLiked(data.hasLiked || false);
          setCommentCount(data.commentCount || 0);
        }
      } catch (err) {
        if ((err).name !== 'AbortError') {
          console.warn('Failed to load reactions:', err);
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    loadReactions();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [storyId, enabled]);

  const addReaction = useCallback(async (type, content = null) => {
    if (!storyId || !user) return false;
    
    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reaction = {
      id: tempId,
      type,
      content: content || type,
      user_id: user.id,
      username: user.username || user.full_name,
      avatar: user.avatar,
      created_at: new Date().toISOString()
    };

    setReactions(prev => [reaction, ...prev]);
    if (type === 'like') setHasLiked(true);

    try {
      const response = await fetch(`/api/stories/${storyId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content })
      });
      if (!response.ok) throw new Error('Failed');
      return true;
    } catch (error) {
      setReactions(prev => prev.filter(r => r.id !== tempId));
      if (type === 'like') setHasLiked(false);
      return false;
    }
  }, [storyId, user]);

  const addComment = useCallback(async (text, userName, userAvatar) => {
    if (!storyId || !user || !text.trim()) return false;

    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const comment = {
      id: tempId,
      type: 'comment',
      content: text,
      user_id: user.id,
      username: userName,
      avatar: userAvatar,
      created_at: new Date().toISOString()
    };

    setReactions(prev => [comment, ...prev]);
    setCommentCount(prev => prev + 1);

    try {
      const response = await fetch(`/api/stories/${storyId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) throw new Error('Failed');
      return true;
    } catch (error) {
      setReactions(prev => prev.filter(r => r.id !== tempId));
      setCommentCount(prev => prev - 1);
      return false;
    }
  }, [storyId, user]);

  const addReply = useCallback(async (parentId, text, userName, userAvatar) => {
    if (!storyId || !user || !text.trim()) return false;

    const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reply = {
      id: tempId,
      type: 'reply',
      parent_id: parentId,
      content: text,
      user_id: user.id,
      username: userName,
      avatar: userAvatar,
      created_at: new Date().toISOString()
    };

    setReactions(prev => [reply, ...prev]);

    try {
      const response = await fetch(`/api/stories/${storyId}/comments/${parentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) throw new Error('Failed');
      return true;
    } catch (error) {
      setReactions(prev => prev.filter(r => r.id !== tempId));
      return false;
    }
  }, [storyId, user]);

  const updateReactionFromWS = useCallback((reaction) => {
    setReactions(prev => {
      const exists = prev.some(r => r.id === reaction.id);
      if (exists) {
        return prev.map(r => r.id === reaction.id ? reaction : r);
      }
      return [reaction, ...prev];
    });
    
    if (reaction.type === 'like' && reaction.user_id === user?.id) {
      setHasLiked(true);
    }
  }, [user]);

  return {
    reactions,
    hasLiked,
    commentCount,
    likeCount,
    commentCountDerived,
    repliesCount,
    isLoading,
    addReaction,
    addComment,
    addReply,
    updateReactionFromWS
  };
};

// =============================
// HELPER: URL VALIDATION
// =============================
const isValidUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('data:')) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// =============================
// HELPER: FETCH WITH TIMEOUT (conservé pour les appels directs)
// =============================
const fetchWithTimeout = async (url, options = {}, timeout = FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const fetchWithRetry = async (url, options, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (response.ok) return response;
      if (i === retries - 1) throw new Error(`Failed after ${retries} attempts: ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
};

// =============================
// HELPER: DOWNLOAD BLOB
// =============================
const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// =============================
// HELPER: AUDIO EXTENSION
// =============================
const getAudioExtension = (url) => {
  if (!url) return '.mp3';
  if (url.includes('.mp3')) return '.mp3';
  if (url.includes('.ogg')) return '.ogg';
  if (url.includes('.wav')) return '.wav';
  if (url.includes('.m4a')) return '.m4a';
  return '.mp3';
};

// =============================
// LOGGER (Sécurisé)
// =============================
const logger = {
  info: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, data);
    }
  },
  error: (message, error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ERROR] ${message}`, error);
    }
  },
  warn: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[WARN] ${message}`, data);
    }
  }
};

// =============================
// COMPOSANTS MEMOISÉS
// =============================
const StoryImage = React.memo(({ url, alt }) => {
  if (!isValidUrl(url)) {
    return <div className="story-image-placeholder" />;
  }
  return <img src={url} alt={alt} className="story-image" draggable={false} />;
});

const StoryTextDisplay = React.memo(({ story }) => {
  const style = story?.style || {};
  const hasGradient = style.useGradient && style.gradientColor2;
  
  return (
    <div 
      className="story-text-display"
      style={{
        background: hasGradient 
          ? `linear-gradient(${style.gradientAngle || 135}deg, ${style.backgroundColor || '#000000'} 0%, ${style.gradientColor2} 100%)`
          : style.backgroundColor || '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '40px',
      }}
    >
      <p
        style={{
          fontSize: `${style.fontSize || 24}px`,
          fontFamily: style.fontFamily || 'Arial',
          color: style.textColor || '#ffffff',
          textAlign: style.textAlign || 'center',
          lineHeight: '1.6',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '90%',
          margin: 0,
          whiteSpace: 'pre-wrap',
          textShadow: style.textShadow && style.textShadow !== 'none' ? style.textShadow : 'none',
          WebkitTextStroke: style.textOutline ? `1px ${style.textColor || '#ffffff'}` : 'none',
          filter: style.textGlow ? `drop-shadow(0 0 10px ${style.textColor || '#ffffff'})` : 'none'
        }}
      >
        {story.text}
      </p>
    </div>
  );
});

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ImmersiveStoryViewer = ({ stories = [], initialIndex = 0, onClose }) => {
  const authContext = React.useContext(AuthContext);
  const user = authContext?.user || null;
  const { client } = useApiClient();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [nextLoaded, setNextLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [storyReactions, setStoryReactions] = useState({});
  const [hearts, setHearts] = useState([]);
  const [exitProgress, setExitProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [slideDirection, setSlideDirection] = useState(null);
  const [showReactionOverlay, setShowReactionOverlay] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);
  const [showGestureHint, setShowGestureHint] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  
  // 🆕 Utilisation du hook useVideoExport
  const startExport = useCallback(() => {}, []);
  const cancelVideoExport = useCallback(() => {}, []);
  const videoExportStatus = null;
  const videoExportProgress = 0;
  const exportedVideoUrl = null;
  const videoExportError = null;
  const isVideoExportPolling = false;
  const videoExportTaskId = null;
  
  // Refs
  const musicRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const storyContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const isSwipingRef = useRef(false);
  const activeDownloadsRef = useRef(new Map());
  const particlesRef = useRef(null);
  const isMountedRef = useRef(true);
  const commentInputRef = useRef(null);
  
  // Initialisation audio (corrigée)
  useEffect(() => {
    musicRef.current = new Audio();
    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.src = '';
        musicRef.current = null;
      }
    };
  }, []);
  
  // Cleanup centralisé du playback
  const clearPlayback = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (musicRef.current) {
      musicRef.current.pause();
    }
  }, []);
  
  // Hook pour réactions temps réel
  const currentStoryId = currentIndex < stories.length ? stories[currentIndex]?.id : null;
  const { 
    reactions, 
    addComment, 
    addReply, 
    updateReactionFromWS, 
    addReaction, 
    hasLiked,
    likeCount,
    commentCountDerived,
    isLoading: reactionsLoading
  } = useStoryReactions(currentStoryId, showReactionOverlay, user);
  
  // Memoized derived data
  const totalComments = useMemo(() => commentCountDerived, [commentCountDerived]);
  const totalLikes = useMemo(() => likeCount, [likeCount]);
  
  // Performance monitoring (avec fallback)
  let performanceData = { fps: 60, shouldDisableReactions: false };
  try {
    performanceData = usePerformanceMonitor(showReactionOverlay);
  } catch (err) {
    performanceData = { fps: 60, shouldDisableReactions: false };
  }
  const { fps, shouldDisableReactions } = performanceData;
  
  // WebSocket temps réel (avec fallback)
  let wsData = { isConnected: false };
  try {
    wsData = useWebSocket(
      currentStoryId,
      (message) => {
        if (message.type === 'reaction_update' && message.reaction) {
          updateReactionFromWS(message.reaction);
        }
      },
      showReactionOverlay
    );
  } catch (err) {
    wsData = { isConnected: false };
  }
  const { isConnected: wsConnected } = wsData;

  const currentStory = stories[currentIndex];
  const nextStory = stories[currentIndex + 1];
  const prevStory = stories[currentIndex - 1];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < stories.length - 1;

  // =============================
  // NAVIGATION
  // =============================
  const goToNext = useCallback(() => {
    clearPlayback();
    if (hasNext) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      handleClose();
    }
  }, [hasNext, clearPlayback]);

  const goToPrevious = useCallback(() => {
    clearPlayback();
    if (hasPrevious) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  }, [hasPrevious, clearPlayback]);

  // =============================
  // URL DE L'IMAGE
  // =============================
  const getStoryImageUrl = useCallback((story) => {
    if (!story) return '';
    let url = story.media_url || story.backgroundImage || '';
    if (!url) return '';
    return url;
  }, []);

  // =============================
  // PLAYBACK
  // =============================
  const startPlayback = useCallback(() => {
    if (!currentStory) return;
    
    clearPlayback();
    
    setProgress(0);
    setSlideDirection(null);
    const music = currentStory.music;

    if (music && music.url) {
      if (musicRef.current) {
        musicRef.current.src = music.url;
        musicRef.current.currentTime = 0;
        musicRef.current.muted = isMuted;
        musicRef.current.play().catch((err) => {
          logger.warn('Audio play failed', err);
        });
      }

      progressIntervalRef.current = setInterval(() => {
        if (!musicRef.current) return;
        const current = musicRef.current.currentTime;
        const duration = music.duration || 60;
        const percent = (current / duration) * 100;
        setProgress(Math.min(percent, 100));
        if (percent >= 100) goToNext();
      }, PROGRESS_INTERVAL);
    } else {
      const duration = currentStory.duration || DEFAULT_STORY_DURATION;
      let elapsed = 0;
      progressIntervalRef.current = setInterval(() => {
        elapsed += PROGRESS_INTERVAL;
        setProgress((elapsed / duration) * 100);
        if (elapsed >= duration) goToNext();
      }, PROGRESS_INTERVAL);
    }
    setIsPlaying(true);
  }, [currentStory, isMuted, goToNext, clearPlayback]);

  // =============================
  // EXPORT VIDÉO (BACKEND FFmpeg) - Utilisation du nouveau hook
  // =============================
  const exportStoryAsVideoBackend = useCallback(async () => {
    if (!currentStory) {
      toast.error('Story non disponible');
      return;
    }

    if (isDownloading || videoExportStatus === 'processing') {
      toast.warning('Téléchargement en cours...');
      return;
    }

    try {
      setIsDownloading(true);
      
      toast.loading('Préparation de la vidéo... ⏳', { id: 'video-export' });

      // Récupérer l'URL de l'image
      const imageUrl = getStoryImageUrl(currentStory);
      if (!imageUrl || !isValidUrl(imageUrl)) {
        toast.error('Image non disponible', { id: 'video-export' });
        return;
      }

      // Préparer les données pour le backend
      const exportData = {
        imageUrl: imageUrl,
        musicUrl: currentStory.music?.url || null,
        duration: currentStory.duration || DEFAULT_STORY_DURATION / 1000,
        filters: currentStory.filters || null,
        elements: currentStory.elements || null,
        textStyle: currentStory.style || null,
        outputFormat: 'mp4',
        quality: 'high'
      };

      // Lancer l'export via le hook
      await startExport(exportData);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('Video export cancelled');
        toast.info('Export annulé', { id: 'video-export' });
      } else {
        logger.error('Video export error', error);
        toast.error(error.message || 'Erreur lors de l\'export vidéo', { id: 'video-export' });
      }
    } finally {
      setIsDownloading(false);
    }
  }, [currentStory, startExport, videoExportStatus, isDownloading, getStoryImageUrl]);

  // 🆕 Effet pour télécharger la vidéo quand elle est prête
  useEffect(() => {
    if (videoExportStatus === 'completed' && exportedVideoUrl) {
      // Télécharger la vidéo générée
      const downloadVideo = async () => {
        try {
          const videoResponse = await fetch(exportedVideoUrl);
          const videoBlob = await videoResponse.blob();
          downloadBlob(videoBlob, `story-${currentStory?.id}-video.mp4`);
          toast.success('Vidéo téléchargée! 🎬', { id: 'video-export' });
        } catch (err) {
          console.error('Download error:', err);
          toast.error('Erreur lors du téléchargement de la vidéo', { id: 'video-export' });
        }
      };
     downloadVideo();
    } else if (videoExportStatus === 'failed') {
      toast.error(videoExportError || 'Échec de l\'export vidéo', { id: 'video-export' });
    }
  }, [videoExportStatus, exportedVideoUrl, videoExportError, currentStory?.id]);

  // =============================
  // TÉLÉCHARGEMENT (LÉGACY - IMAGE SEULE)
  // =============================
  const downloadStoryImageOnly = useCallback(async () => {
    if (!currentStory) return;

    const abortController = new AbortController();
    const downloadId = Date.now().toString();
    activeDownloadsRef.current.set(downloadId, abortController);

    try {
      setIsDownloading(true);

      if (currentStory?.media_type === 'text') {
        const textElement = document.querySelector('.story-text-display');
        if (textElement) {
          const canvas = await html2canvas(textElement, {
            backgroundColor: null,
            scale: 2,
            allowTaint: true,
            useCORS: true,
          });
          canvas.toBlob((blob) => {
            if (blob) {
              downloadBlob(blob, `text-story-${currentStory.id}-${Date.now()}.png`);
              toast.success('Story texte téléchargée! 🖼️');
            }
          }, 'image/png');
        }
        return;
      }

      const imageUrl = getStoryImageUrl(currentStory);
      if (!imageUrl || !isValidUrl(imageUrl)) {
        toast.error('Image non disponible');
        return;
      }

      const response = await fetchWithRetry(imageUrl, { signal: abortController.signal });
      const blob = await response.blob();
      downloadBlob(blob, `story-${currentStory.id}-${Date.now()}.jpg`);
      toast.success('Image téléchargée! ⬇️');
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('Download cancelled');
        return;
      }
      logger.error('Download error', error);
      toast.error(`Téléchargement échoué: ${error.message}`);
    } finally {
      setIsDownloading(false);
      activeDownloadsRef.current.delete(downloadId);
    }
  }, [currentStory, getStoryImageUrl]);

  // =============================
  // TÉLÉCHARGEMENT PRINCIPAL (VIDÉO SI MUSIQUE, SINON IMAGE)
  // =============================
  const downloadStory = useCallback(async () => {
    if (!currentStory) return;

    // Si la story a de la musique → export vidéo
    if (currentStory.music?.url) {
      await exportStoryAsVideoBackend();
    } else {
      await downloadStoryImageOnly();
    }
  }, [currentStory, exportStoryAsVideoBackend, downloadStoryImageOnly]);

  // =============================
  // LIKE
  // =============================
  const onLikeAction = useCallback(async (pos = null) => {
    if (!currentStory || !user) return;
    
    const alreadyLikedLocally = reactions?.some(r => r.type === 'like' && r.user_id === user.id);
    
    if (hasLiked || alreadyLikedLocally) {
      vibrateLight();
      return;
    }

    vibrateLight();
    const heartId = Date.now();
    setHearts(prev => [...prev, { 
      id: heartId, 
      x: pos?.x || window.innerWidth / 2, 
      y: pos?.y || window.innerHeight / 2 
    }]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== heartId)), 1000);

    try {
      await addReaction('like');
      // Le like est déjà géré par addReaction, plus besoin d'appel séparé
    } catch (error) {
      logger.error('Failed to add like', error);
      toast.error('Impossible d\'ajouter le like');
    }
  }, [currentStory, hasLiked, addReaction, reactions, user]);

  // =============================
  // GESTES TACTILES
  // =============================
  const gestureHandlers = useTouchGestures({
    onDoubleTap: (pos) => {
      if (!currentStory) return;
      onLikeAction(pos);
    },
    onLongPress: (pos) => {
      if (!currentStory || storyReactions[currentStory.id]) return;
      vibrateStrong();
      const heartId = Date.now();
      setHearts(prev => [...prev, { id: heartId, x: pos.x, y: pos.y, isSuper: true }]);
      setTimeout(() => setHearts(prev => prev.filter(h => h.id !== heartId)), 1500);
      
      // Réaction spéciale via addReaction
      addReaction('love', '❤️')
        .then(() => setStoryReactions(prev => ({ ...prev, [currentStory.id]: true })))
        .catch((error) => {
          logger.error('Error during reaction', error);
          toast.error('Erreur lors de la réaction');
        });
    },
    onSwipe: (direction) => {
      if (isSwipingRef.current) return;
      
      isSwipingRef.current = true;
      
      if (direction === 'left' && hasNext) {
        setSlideDirection('left');
        setTimeout(() => {
          goToNext();
          setTimeout(() => {
            isSwipingRef.current = false;
          }, 300);
        }, 50);
      } else if (direction === 'right' && hasPrevious) {
        setSlideDirection('right');
        setTimeout(() => {
          goToPrevious();
          setTimeout(() => {
            isSwipingRef.current = false;
          }, 300);
        }, 50);
      } else if (direction === 'down') {
        handleClose();
        setTimeout(() => {
          isSwipingRef.current = false;
        }, 300);
      } else {
        isSwipingRef.current = false;
      }
    },
    onSingleTap: (pos) => {
      const screenWidth = window.innerWidth;
      if (pos.x < screenWidth * 0.3 && hasPrevious) {
        if (isSwipingRef.current) return;
        setSlideDirection('right');
        goToPrevious();
      } else if (pos.x > screenWidth * 0.7 && hasNext) {
        if (isSwipingRef.current) return;
        setSlideDirection('left');
        goToNext();
      } else {
        setShowControls(prev => !prev);
      }
    },
    swipeThreshold: 50,
    doubleTapThreshold: 300,
    longPressMinTime: 400,
    longPressMaxTime: 600
  });

  // =============================
  // PRÉCHARGEMENT
  // =============================
  useEffect(() => {
    if (nextStory) {
      const preloadNext = async () => {
        const imageUrl = getStoryImageUrl(nextStory);
        if (imageUrl && isValidUrl(imageUrl)) {
          try {
            await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = resolve;
              img.onerror = reject;
              img.src = imageUrl;
            });
            setNextLoaded(true);
          } catch (err) {
            logger.warn('Failed to preload image', err);
          }
        }
        
        if (nextStory.music?.url) {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.src = nextStory.music.url;
        }
      };
      
      preloadNext();
    }
  }, [currentIndex, nextStory, getStoryImageUrl]);

  // =============================
  // PLAYBACK EFFECT
  // =============================
  useEffect(() => {
    if (isPlaying && currentStory && !isHovering && !showComments) {
      startPlayback();
    }
    return () => {
      clearPlayback();
    };
  }, [currentIndex, isPlaying, currentStory, startPlayback, isHovering, showComments, clearPlayback]);

  // =============================
  // MUTE
  // =============================
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // =============================
  // VISIBILITY API
  // =============================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearPlayback();
      } else {
        if (isPlaying && currentStory && !showComments) {
          startPlayback();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, currentStory, startPlayback, showComments, clearPlayback]);

  // =============================
  // HOVER PAUSE
  // =============================
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    clearPlayback();
  }, [clearPlayback]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (isPlaying && !showComments) {
      startPlayback();
    }
  }, [isPlaying, showComments, startPlayback]);

  // =============================
  // MOUNTED REF
  // =============================
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // =============================
  // FERMETURE
  // =============================
  const handleClose = () => {
    setIsExiting(true);
    clearPlayback();
    // Annuler l'export vidéo si en cours
    if (videoExportStatus === 'processing') {
      cancelVideoExport();
    }
    activeDownloadsRef.current.forEach((controller, key) => {
      controller.abort();
    });
    activeDownloadsRef.current.clear();
    setTimeout(() => onClose?.(), 300);
  };

  // =============================
  // PLAY/PAUSE
  // =============================
  const togglePlayPause = () => {
    if (isPlaying) {
      clearPlayback();
    } else {
      startPlayback();
    }
    setIsPlaying(!isPlaying);
  };

  // =============================
  // COMMENTAIRES
  // =============================
  const onSubmitComment = useCallback(async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;

    try {
      setIsSubmittingComment(true);
      await addComment(commentText.trim(), user.full_name || user.username, user.avatar);
      setCommentText('');
      setIsPlaying(true);
      toast.success('Commentaire envoyé! 💬');
    } catch (error) {
      logger.error('Error submitting comment', error);
      toast.error('Erreur lors de l\'envoi du commentaire');
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentText, addComment, user, currentStory?.id]);

  const insertEmoji = useCallback((emoji) => {
    setCommentText(prev => prev + emoji);
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, []);

  const onSubmitReply = useCallback(async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user || !replyingTo) return;

    try {
      setIsSubmittingComment(true);
      await addReply(replyingTo.id, commentText.trim(), user.full_name || user.username, user.avatar);
      setCommentText('');
      setReplyingTo(null);
      toast.success('Réponse envoyée! 💬');
    } catch (error) {
      logger.error('Error submitting reply', error);
      toast.error('Erreur lors de l\'envoi de la réponse');
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentText, addReply, user, replyingTo]);

  const openComments = useCallback(() => {
    setShowComments(true);
    clearPlayback();
  }, [clearPlayback]);

  const closeComments = useCallback(() => {
    setShowComments(false);
    if (isPlaying) {
      startPlayback();
    }
  }, [isPlaying, startPlayback]);

  // =============================
  // PARTAGE
  // =============================
  const shareStory = useCallback((platform) => {
    const storyUrl = `${window.location.origin}/story/${currentStory.id}`;
    const text = `Regarde cette story: "${currentStory.text?.substring(0, 50)}..."`;
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + storyUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(storyUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storyUrl)}`,
      copy: null
    };

    if (platform === 'copy') {
      navigator.clipboard.writeText(storyUrl);
      toast.success('Lien copié! 📋');
    } else if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
      toast.success(`Partagé sur ${platform}!`);
    }
  }, [currentStory]);

  // =============================
  // PARTICLES
  // =============================
  useEffect(() => {
    if (!particlesRef.current) {
      particlesRef.current = [...Array(20)].map((_, i) => ({
        id: i,
        style: {
          '--delay': `${Math.random() * 5}s`,
          '--x': `${Math.random() * 100}%`,
          '--duration': `${3 + Math.random() * 4}s`
        }
      }));
    }
  }, []);

  // =============================
  // RENDU
  // =============================
  if (!stories?.length || !currentStory) {
    return (
      <div className="immersive-story-viewer">
        <div className="story-error">
          <p>Aucune story disponible</p>
          <button onClick={handleClose} className="close-error-btn">Fermer</button>
        </div>
      </div>
    );
  }

  const storyImageUrl = getStoryImageUrl(currentStory);
  const isValidImageUrl = isValidUrl(storyImageUrl);
  const isVideoExporting = videoExportStatus === 'processing' || videoExportStatus === 'starting';

  return (
    <div 
      className={`immersive-story-viewer ${isExiting ? 'exiting' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="story-particles">
        {particlesRef.current?.map((particle) => (
          <div key={particle.id} className="particle" style={particle.style} />
        ))}
      </div>

      <div 
        ref={storyContainerRef}
        className={`story-content ${slideDirection ? `slide-${slideDirection}` : ''}`}
        {...gestureHandlers}
      >
        <StoryReactionOverlay
          storyId={currentStory?.id}
          reactions={reactions}
          onCommentTap={(reaction) => {
            vibrateLight();
          }}
          onLongPress={(reaction) => {
            vibrateStrong();
          }}
          onReply={(reaction) => {
            // Réponse à un commentaire
          }}
          onPin={(reaction) => {
            // Épingler un commentaire
          }}
          shouldDisable={shouldDisableReactions}
          fps={fps}
          enabled={showReactionOverlay && !isExiting}
        />
        <div className="story-image-container">
          {currentStory?.media_type === 'text' ? (
            <StoryTextDisplay story={currentStory} />
          ) : (
            <>
              {isValidImageUrl && <StoryImage url={storyImageUrl} alt="Story" />}
              <div className="story-overlay" />
            </>
          )}
        </div>

        {currentStory.elements?.map(element => (
          <div
            key={element.id}
            className="story-element"
            style={{
              left: `${(element.x / 1080) * 100}%`,
              top: `${(element.y / 1920) * 100}%`,
              opacity: element.opacity / 100,
              transform: `rotate(${element.rotation || 0}deg)`
            }}
          >
            {element.type === 'text' && (
              <p className="story-text-element" style={{
                fontSize: `${element.fontSize || 24}px`,
                color: element.color
              }}>
                {element.content}
              </p>
            )}
            {element.type === 'sticker' && (
              <img src={element.content} alt="sticker" className="story-sticker" style={{
                width: `${element.size || 100}px`
              }} />
            )}
          </div>
        ))}

        {hearts.map(heart => (
          <div
            key={heart.id}
            className={`floating-heart ${heart.isSuper ? 'super' : ''}`}
            style={{ left: heart.x, top: heart.y }}
          >
            <Heart className="heart-icon" fill="currentColor" />
          </div>
        ))}
      </div>

      <div className={`story-ui ${showControls ? 'visible' : 'hidden'}`}>
        <div className="progress-container">
          {stories.map((_, idx) => (
            <div key={idx} className="progress-bar-wrapper">
              <div 
                className="progress-bar"
                style={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        <div className="top-bar minimal">
          <div className="user-info-minimal" onClick={() => currentStory.author?.id && navigate(`/profile/${currentStory.author.id}`)} style={{ cursor: currentStory.author?.id ? 'pointer' : 'default' }}>
            <div className="avatar-ring-small">
              {currentStory.author?.avatar ? (
                <img 
                  src={currentStory.author.avatar} 
                  alt={currentStory.author.full_name} 
                  className="user-avatar-small"
                />
              ) : (
                <div className="user-avatar-small" style={{
                  background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  {currentStory.author?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="user-details-minimal">
              <span className="username-minimal">{currentStory.author?.full_name || 'Utilisateur'}</span>
              <span className="story-timestamp-minimal">{formatTimeAgo(currentStory.created_at)}</span>
            </div>
          </div>

          <div className="top-actions-minimal">
            <span className="story-counter-minimal">{currentIndex + 1}/{stories.length}</span>
            <button onClick={handleClose} className="action-btn close-btn" aria-label="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>

        {showComments && (
          <div className="comments-panel">
            <div className="comments-header">
              <h3>Commentaires ({totalComments})</h3>
              <button onClick={closeComments} className="comments-close" aria-label="Fermer les commentaires">✕</button>
            </div>
            <div className="comments-list">
              {reactions && reactions.length > 0 ? (
                reactions.map((reaction, idx) => (
                  <div key={idx} className="comment-item">
                    <img 
                      src={reaction.user?.avatar || reaction.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reaction.user?.id || reaction.user_id || reaction.username}`}
                      alt={reaction.user?.full_name || reaction.username}
                      className="comment-avatar"
                    />
                    <div className="comment-content">
                      <div className="comment-main">
                        <span className="comment-author">{reaction.user?.full_name || reaction.username || 'Utilisateur'}</span>
                        <p className="comment-text">
                          {reaction.content || reaction.text || reaction.emoji || '❤️'}
                        </p>
                      </div>
                      <div className="comment-footer">
                        <span className="comment-time">{formatTimeAgo(reaction.created_at)}</span>
                        {(reaction.type === 'comment' || reaction.type === 'reply') && (
                          <button 
                            className="reply-btn"
                            onClick={() => {
                              setReplyingTo(reaction);
                              setCommentText('');
                              setTimeout(() => {
                                if (commentInputRef.current) commentInputRef.current.focus();
                              }, 150);
                            }}
                          >
                            Répondre
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-comments">Aucun commentaire pour le moment. Soyez le premier à réagir !</div>
              )}
            </div>

            <div className="comment-panel-footer">
              <form onSubmit={replyingTo ? onSubmitReply : onSubmitComment} className="comment-form">
                {replyingTo && (
                  <div className="reply-indicator">
                    <div className="reply-info">
                      <span className="reply-label">En réponse à</span>
                      <span className="reply-name">{replyingTo.username || replyingTo.user?.full_name || 'Utilisateur'}</span>
                    </div>
                    <button type="button" className="cancel-reply-btn" onClick={() => {
                      setReplyingTo(null);
                      setCommentText('');
                    }}>✕</button>
                  </div>
                )}
                {user ? (
                  <div className="comment-wrapper">
                    <div className="comment-input-row">
                      <img 
                        src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                        alt={user.full_name}
                        className="comment-user-avatar"
                      />
                      <input
                        ref={commentInputRef}
                        type="text"
                        placeholder={replyingTo ? "Écrire une réponse..." : "Ajouter un commentaire..."}
                        value={commentText}
                        onChange={(e) => {
                          setCommentText(e.target.value);
                          if (e.target.value.length > 0 && isPlaying) {
                            clearPlayback();
                          }
                        }}
                        className="comment-panel-input"
                        maxLength={replyingTo ? 25 : 40}
                        disabled={isSubmittingComment}
                        aria-label="Écrire un commentaire"
                      />
                      <button 
                        type="submit" 
                        className="comment-submit-btn-panel"
                        disabled={!commentText.trim() || isSubmittingComment}
                        aria-label="Envoyer le commentaire"
                      >
                        {isSubmittingComment ? <span className="spinner-dot"></span> : <SendHorizontal size={18} />}
                      </button>
                    </div>
                    
                    <div className="emoji-quick-select-mini">
                      {['😂', '❤️', '🔥', '👏', '🙌', '💯'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="emoji-btn-mini"
                          onClick={() => {
                            insertEmoji(emoji);
                            if (isPlaying) clearPlayback();
                          }}
                          disabled={isSubmittingComment}
                          aria-label={`Ajouter l'emoji ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="comment-login-prompt">Connectez-vous pour commenter</div>
                )}
              </form>
            </div>
          </div>
        )}

        {showControls && (
          <div className="side-actions visible">
            <button 
              className="side-action-btn like-btn"
              onClick={onLikeAction}
              style={{
                color: hasLiked ? '#ff4458' : 'white'
              }}
              title={hasLiked ? "Je n'aime plus" : "J'aime"}
              aria-label={hasLiked ? "Je n'aime plus" : "J'aime"}
            >
              <Heart 
                size={28} 
                fill={hasLiked ? '#ff4458' : 'none'}
              />
              {totalLikes > 0 && (
                <span className="action-count">{totalLikes}</span>
              )}
            </button>
            <button 
              className="side-action-btn comments-btn"
              onClick={openComments}
              title="Commentaires"
              aria-label="Ouvrir les commentaires"
            >
              <MessageCircle size={28} />
              {totalComments > 0 && (
                <span className="action-count">{totalComments}</span>
              )}
            </button>
            <button 
              className="side-action-btn download-btn"
              onClick={downloadStory}
              title={currentStory.music?.url ? "Télécharger la vidéo" : "Télécharger l'image"}
              aria-label={currentStory.music?.url ? "Télécharger la vidéo" : "Télécharger l'image"}
              disabled={isDownloading || isVideoExporting}
            >
              {isVideoExporting ? (
                <div className="relative">
                  <Film size={28} className="animate-pulse" />
                  <span className="absolute -top-1 -right-1 text-[10px] bg-cyan-500 rounded-full w-4 h-4 flex items-center justify-center">
                    {videoExportProgress}%
                  </span>
                </div>
              ) : (
                <Download size={28} />
              )}
            </button>
          </div>
        )}

        {currentStory.music && showControls && (
          <div className="music-indicator">
            <div className="music-waves">
              <span /><span /><span /><span />
            </div>
            <span className="music-title">{currentStory.music.title}</span>
          </div>
        )}

      </div>

      {nextStory && (
        <div className="preload-container">
          <img src={getStoryImageUrl(nextStory)} alt="" />
        </div>
      )}
    </div>
  );
};

ImmersiveStoryViewer.propTypes = {
  stories: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    media_url: PropTypes.string,
    type: PropTypes.string,
    user: PropTypes.object
  })),
  initialIndex: PropTypes.number,
  onClose: PropTypes.func.isRequired
};

export default ImmersiveStoryViewer;
