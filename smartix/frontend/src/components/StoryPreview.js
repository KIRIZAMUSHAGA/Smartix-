/**
 * 📺 Story Preview Modal
 * Full-screen preview with music playback
 * Version 5.0 - Architecture ELITE avec toutes les optimisations
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { X, Play, Pause, Loader2, Volume2, VolumeX, ChevronLeft, ChevronRight, Download, Share2, Heart } from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { getImageUrl } from '../config/apiClient';

// =============================
// CONSTANTES
// =============================
const CANVAS_WIDTH = 540;
const CANVAS_HEIGHT = 960;
const ASPECT_RATIO = '9/16';
const STICKER_CACHE_MAX_SIZE = 50;
const AUTO_ADVANCE_DELAY = 5000; // 5 secondes
const HOLD_DELAY = 150; // ms pour détecter maintien
const DOUBLE_TAP_DELAY = 300; // ms pour double tap

// =============================
// IMAGE CACHE (AVEC RETRY ET TTL)
// =============================
class ImageCache {
  static cache = new Map();
  static loading = new Map();
  static errors = new Set();
  static maxSize = STICKER_CACHE_MAX_SIZE;
  static maxAgeMs = 10 * 60 * 1000; // 10 minutes

  static async get(url, retry = 1) {
    // Nettoyage périodique
    if (Math.random() < 0.01) this.cleanupByAge();
    
    // Si déjà en erreur, ne pas réessayer sauf si retry forcé
    if (this.errors.has(url) && retry === 0) return null;
    
    const cached = this.cache.get(url);
    if (cached) {
      cached.timestamp = Date.now();
      return cached.img;
    }
    
    if (this.loading.has(url)) return this.loading.get(url);

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.cache.set(url, { img, timestamp: Date.now() });
        this.loading.delete(url);
        this.errors.delete(url);
        this.cleanupBySize();
        resolve(img);
      };
      img.onerror = () => {
        this.loading.delete(url);
        if (retry > 0) {
          // Réessayer après un délai
          setTimeout(() => {
            this.get(url, retry - 1).then(resolve).catch(reject);
          }, 500);
        } else {
          this.errors.add(url);
          reject(new Error(`Failed to load image: ${url}`));
        }
      };
      img.src = url;
    });

    this.loading.set(url, promise);
    return promise;
  }

  static getSync(url) {
    return this.cache.get(url)?.img || null;
  }

  static cleanupBySize() {
    if (this.cache.size <= this.maxSize) return;
    const sorted = Array.from(this.cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = sorted.slice(0, this.cache.size - this.maxSize);
    toDelete.forEach(([key]) => this.cache.delete(key));
  }

  static cleanupByAge() {
    const now = Date.now();
    for (const [url, { timestamp }] of this.cache) {
      if (now - timestamp > this.maxAgeMs) {
        this.cache.delete(url);
      }
    }
  }

  static clear() {
    this.cache.clear();
    this.loading.clear();
    this.errors.clear();
  }
}

// =============================
// HOOK: USE AUDIO CONTROLLER (OPTIMISÉ)
// =============================
const useAudioController = (url) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);
  const animationRef = useRef();
  const renderIdRef = useRef(0);

  // INIT AUDIO (UNE SEULE FOIS PAR URL)
  useEffect(() => {
    if (!url) return;

    const currentId = ++renderIdRef.current;
    setIsLoading(true);
    setError(null);

    const audio = new Audio();
    audio.src = url;
    audio.preload = 'metadata';
    audio.volume = isMuted ? 0 : volume;

    const handleLoadedMetadata = () => {
      if (currentId !== renderIdRef.current) return;
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleError = () => {
      if (currentId !== renderIdRef.current) return;
      setError('Impossible de charger l\'audio');
      setIsLoading(false);
      toast.error('Erreur de chargement audio');
    };

    const handleTimeUpdate = () => {
      if (currentId !== renderIdRef.current) return;
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      if (currentId !== renderIdRef.current) return;
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    audioRef.current = audio;

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [url]);

  // VOLUME CONTROL (INDÉPENDANT)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // RAF POUR PROGRESSION FLUIDE
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return;

    const updateProgress = () => {
      if (audioRef.current && isPlaying) {
        setCurrentTime(audioRef.current.currentTime);
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationRef.current = requestAnimationFrame(updateProgress);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  const play = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Play error:', err);
      toast.error('Erreur de lecture');
    }
  }, []);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, time));
    setCurrentTime(audioRef.current.currentTime);
  }, [duration]);

  const setAudioVolume = useCallback((vol) => {
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setAudioVolume(0.8);
    } else {
      setAudioVolume(0);
    }
  }, [isMuted, setAudioVolume]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    error,
    play,
    pause,
    seek,
    setVolume: setAudioVolume,
    toggleMute
  };
};

// =============================
// HOOK: CANVAS RENDER (AVEC BATCH DRAW)
// =============================
const useCanvasRender = (
  canvasRef,
  story,
  isValidStory
) => {
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState(null);
  const renderIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const drawElement = useCallback(async (ctx, element) => {
    if (!element || typeof element !== 'object') return;

    ctx.save();
    
    try {
      if (element.opacity !== undefined) {
        ctx.globalAlpha = Math.min(1, Math.max(0, element.opacity / 100));
      }

      const x = element.x || 0;
      const y = element.y || 0;
      const width = element.width || 100;
      const height = element.height || 100;
      
      ctx.translate(x + width / 2, y + height / 2);
      if (element.rotation) {
        ctx.rotate((element.rotation % 360) * Math.PI / 180);
      }

      if (element.type === 'text') {
        if (!element.content) return;
        
        const fontSize = Math.max(8, Math.min(200, element.fontSize || 24));
        ctx.font = `${element.bold ? 'bold' : ''} ${element.italic ? 'italic' : ''} ${fontSize}px ${element.fontFamily || 'Arial'}`;
        ctx.fillStyle = element.color || '#FFFFFF';
        ctx.textAlign = element.align || 'center';
        ctx.textBaseline = 'middle';
        
        if (element.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
        }
        
        ctx.fillText(element.content, 0, 0);
        
      } else if (element.type === 'sticker' && element.content) {
        const stickerImg = await ImageCache.get(element.content);
        if (stickerImg) {
          ctx.drawImage(stickerImg, -width / 2, -height / 2, width, height);
        }
      }
      
      ctx.restore();
    } catch (err) {
      console.error('Error drawing element:', err);
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !isValidStory) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentId = ++renderIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const loadAndDraw = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const imageUrl = getImageUrl(story.backgroundImage, 'uploads');
        if (!imageUrl) throw new Error('Image URL invalide');

        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
          if (signal.aborted) reject(new Error('Aborted'));
          img.src = imageUrl;
        });

        if (currentId !== renderIdRef.current || signal.aborted) return;

        const { brightness = 100, contrast = 100, saturation = 100, hue = 0, blur = 0 } = story.filters || {};
        
        const hasFilters = brightness !== 100 || contrast !== 100 || saturation !== 100 || hue !== 0 || blur !== 0;
        if (hasFilters) {
          ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg) blur(${blur}px)`;
        }
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
        
        // BATCH DRAW: Précharger toutes les images en parallèle
        if (story.elements && Array.isArray(story.elements)) {
          // Étape 1: Précharger toutes les images des stickers
          const stickerImages = await Promise.all(
            story.elements
              .filter(el => el.type === 'sticker' && el.content)
              .map(el => ImageCache.get(el.content).catch(() => null))
          );
          
          // Étape 2: Dessiner tous les éléments (synchrone)
          for (const element of story.elements) {
            if (currentId !== renderIdRef.current || signal.aborted) return;
            await drawElement(ctx, element);
          }
        }
        
        setImageLoaded(true);
        setIsLoading(false);
      } catch (err) {
        if ((err).message !== 'Aborted' && currentId === renderIdRef.current) {
          console.error('Canvas rendering error:', err);
          setError('Impossible de charger l\'image');
          toast.error('Erreur de chargement');
        }
        setIsLoading(false);
      }
    };

    loadAndDraw();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [story, isValidStory, drawElement, canvasRef]);

  return { isLoading, imageLoaded, error };
};

// =============================
// COMPOSANT DE PROGRESSION
// =============================
const ProgressBar = ({ progress, duration, currentTime, onSeek }) => {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.min(1, Math.max(0, x / rect.width));
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 min-w-[150px] flex items-center gap-2">
      <span className="text-white/60 text-xs whitespace-nowrap">
        {formatTime(currentTime)}
      </span>
      <div
        className="flex-1 bg-white/10 rounded-full h-1 cursor-pointer relative group"
        onClick={handleClick}
        role="slider"
        aria-label="Progression"
      >
        <div
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <span className="text-white/60 text-xs whitespace-nowrap">
        {formatTime(duration)}
      </span>
    </div>
  );
};

// =============================
// HOOK: DOUBLE TAP
// =============================
const useDoubleTap = (onDoubleTap) => {
  const lastTapRef = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      onDoubleTap();
      navigator.vibrate?.(10);
    }
    lastTapRef.current = now;
  }, [onDoubleTap]);

  return handleTap;
};

// =============================
// COMPOSANT PRINCIPAL
// =============================

const StoryPreview = ({ 
  story, 
  onClose, 
  onNext, 
  onPrevious, 
  hasNext = false, 
  hasPrevious = false,
  onMarkAsViewed,
  onLike,
  autoAdvance = true
}) => {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  
  const canvasRef = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  
  // Audio controller
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading: audioLoading,
    error: audioError,
    play,
    pause,
    seek,
    setVolume: setAudioVolume,
    toggleMute
  } = useAudioController(story?.music?.url);
  
  // Canvas render
  const { isLoading: canvasLoading, imageLoaded, error: canvasError } = useCanvasRender(canvasRef, story, !!story?.backgroundImage);
  
  const isLoading = canvasLoading || audioLoading;
  const error = canvasError || audioError;
  
  // Double tap pour like
  const handleDoubleTap = useDoubleTap(() => {
    if (!isLiked) {
      setIsLiked(true);
      setShowLikeAnimation(true);
      onLike?.(story.id);
      setTimeout(() => setShowLikeAnimation(false), 500);
    }
  });
  
  // =============================
  // MARQUER COMME VUE
  // =============================
  useEffect(() => {
    if (story?.id && onMarkAsViewed && !error && imageLoaded) {
      onMarkAsViewed(story.id);
    }
  }, [story?.id, onMarkAsViewed, error, imageLoaded]);

  // =============================
  // AUTO ADVANCE (fin musique ou timer)
  // =============================
  useEffect(() => {
    if (!autoAdvance || !hasNext || !onNext) return;
    
    if (story.music && duration > 0) {
      // Écouter l'événement ended directement
      const audio = new Audio();
      const handleEnded = () => {
        onNext();
      };
      audio.addEventListener('ended', handleEnded);
      return () => audio.removeEventListener('ended', handleEnded);
    } else if (!story.music) {
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        onNext();
      }, AUTO_ADVANCE_DELAY);
    }
    
    return () => {
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
  }, [autoAdvance, hasNext, onNext, story.music, duration]);

  // =============================
  // PRELOAD NEXT STORY
  // =============================
  useEffect(() => {
    if (hasNext && story?.next?.backgroundImage) {
      const nextUrl = getImageUrl(story.next.backgroundImage, 'uploads');
      if (nextUrl) {
        ImageCache.get(nextUrl).catch(() => null);
      }
      if (story.next.music?.url) {
        ImageCache.get(story.next.music.url).catch(() => null);
      }
    }
  }, [story, hasNext]);

  // =============================
  // TAP + HOLD (SANS CONFLIT)
  // =============================
  const handleTouchStart = useCallback(() => {
    setIsHolding(false);
    holdTimeoutRef.current = setTimeout(() => {
      setIsHolding(true);
      pause();
      navigator.vibrate?.(5);
    }, HOLD_DELAY);
  }, [pause]);

  const handleTouchEnd = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (!isHolding) {
      // Tap normal - géré par le double tap handler
      handleDoubleTap();
    } else {
      play();
    }
    setIsHolding(false);
  }, [isHolding, handleDoubleTap, play]);

  // =============================
  // TAP GAUCHE/DROITE (NAVIGATION)
  // =============================
  const handleCanvasTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Si c'est un hold, ne pas naviguer
    if (isHolding) return;
    
    const rect = (e.currentTarget).getBoundingClientRect();
    let clientX;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    
    const screenWidth = rect.width;
    const tapX = clientX - rect.left;
    
    if (tapX < screenWidth / 3) {
      if (hasPrevious && onPrevious) onPrevious();
    } else if (tapX > (screenWidth * 2) / 3) {
      if (hasNext && onNext) onNext();
    }
  }, [isHolding, hasPrevious, hasNext, onPrevious, onNext]);

    // =============================
  // EXPORT DE L'IMAGE
  // =============================
  const handleExport = useCallback(async () => {
    if (!canvasRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      const blob = await new Promise((resolve, reject) => {
        canvasRef.current?.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `story-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Image exportée !');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  // =============================
  // PARTAGE
  // =============================
  const handleShare = useCallback(async () => {
    if (!canvasRef.current) return;
    
    try {
      const blob = await new Promise((resolve, reject) => {
        canvasRef.current?.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });
      
      const file = new File([blob], 'story.png', { type: 'image/png' });
      
      if (navigator.share) {
        await navigator.share({
          title: 'Ma Story',
          text: 'Découvrez ma story créée avec SmartClips!',
          files: [file]
        });
        toast.success('Partagé !');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Lien copié !');
      }
    } catch (err) {
      if ((err).name !== 'AbortError') {
        console.error('Share error:', err);
        toast.error('Erreur lors du partage');
      }
    }
  }, []);

  // =============================
  // GESTION CLAVIER
  // =============================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      } else if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        if (isPlaying) pause();
        else play();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasPrevious, hasNext, onPrevious, onNext, isPlaying, pause, play]);

  // =============================
  // SWIPE POUR FERMER
  // =============================
  const [touchStart, setTouchStart] = useState(null);
  
  const handleSwipeStart = useCallback((e) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, []);
  
  const handleSwipeMove = useCallback((e) => {
    if (!touchStart) return;
    const deltaY = e.touches[0].clientY - touchStart.y;
    if (deltaY > 50) {
      onClose();
      setTouchStart(null);
    }
  }, [touchStart, onClose]);
  
  const handleSwipeEnd = useCallback(() => {
    setTouchStart(null);
  }, []);

  // =============================
  // PROGRESSION
  // =============================
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // =============================
  // VALIDATION
  // =============================
  const isValidStory = useMemo(() => {
    return story && typeof story === 'object' && story.backgroundImage;
  }, [story]);

  if (!user) return null;

  if (!isValidStory) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">❌ Story invalide</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white transition"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
      onTouchStart={handleSwipeStart}
      onTouchMove={handleSwipeMove}
      onTouchEnd={handleSwipeEnd}
    >
      <div className="flex flex-col gap-4 w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {hasPrevious && onPrevious && (
              <button
                onClick={onPrevious}
                className="p-2 hover:bg-white/10 rounded-lg transition"
                aria-label="Story précédente"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <div className="text-white/60 text-sm">
              {story.userName ? `Story de ${story.userName}` : 'Story'}
            </div>
            {hasNext && onNext && (
              <button
                onClick={onNext}
                className="p-2 hover:bg-white/10 rounded-lg transition"
                aria-label="Story suivante"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!isLiked) {
                  setIsLiked(true);
                  setShowLikeAnimation(true);
                  onLike?.(story.id);
                  navigator.vibrate?.(10);
                  setTimeout(() => setShowLikeAnimation(false), 500);
                }
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              aria-label="J'aime"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || !imageLoaded}
              className="p-2 hover:bg-white/10 rounded-lg transition disabled:opacity-50"
              aria-label="Exporter l'image"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleShare}
              disabled={!imageLoaded}
              className="p-2 hover:bg-white/10 rounded-lg transition disabled:opacity-50"
              aria-label="Partager"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Canvas preview */}
        <div 
          className="relative flex justify-center bg-black rounded-lg overflow-hidden cursor-pointer"
          onClick={handleCanvasTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
        >
          {isLoading && !imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <p className="text-white/60 text-sm">Chargement...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center">
                <p className="text-red-500 mb-2">❌ {error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white text-sm transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto"
            style={{ maxHeight: '70vh', aspectRatio: ASPECT_RATIO }}
          />
   {/* Animation like */}
          {showLikeAnimation && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
              <Heart className="w-20 h-20 fill-red-500 text-red-500 opacity-80" />
            </div>
          )}
          
          {/* Tap zone indicators */}
          {(hasPrevious || hasNext) && (
            <div className="absolute inset-0 flex pointer-events-none">
              <div className="w-1/3 h-full bg-gradient-to-r from-black/20 to-transparent" />
              <div className="w-1/3 h-full" />
              <div className="w-1/3 h-full bg-gradient-to-l from-black/20 to-transparent" />
            </div>
          )}
          
          {/* Hold indicator */}
          {isHolding && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 rounded-full px-3 py-1">
              <p className="text-white/80 text-xs">Maintien pour pause</p>
            </div>
          )}
        </div>

        {/* Music player */}
        {story.music && (
          <div className="bg-gradient-to-r from-purple-900/50 to-black border border-white/20 rounded-lg p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={isPlaying ? pause : play}
                disabled={isLoading || !!error}
                className="p-2 bg-purple-500 hover:bg-purple-600 rounded-full transition disabled:opacity-50"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white fill-white" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {story.music.title || 'Musique'}
                </p>
                <p className="text-white/60 text-xs truncate">
                  {story.music.artist || 'Artiste inconnu'}
                </p>
              </div>

              <ProgressBar
                progress={progress}
                duration={duration}
                currentTime={currentTime}
                onSeek={seek}
              />

              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1">
                <button
                  onClick={toggleMute}
                  className="p-1 hover:bg-white/10 rounded"
                  aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 cursor-pointer"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="text-center text-white/60 text-sm">
          {!story.music && <p>Preview de votre story</p>}
          {story.music && !error && (
            <p className="text-purple-400 text-xs">
              🎵 {isPlaying ? 'Lecture en cours' : 'Prêt à jouer'}
            </p>
          )}
        </div>
        
        {/* Navigation hints */}
        {(hasPrevious || hasNext) && (
          <div className="text-center text-white/30 text-xs">
            {hasPrevious && <span className="mx-2">← Story précédente</span>}
            {hasNext && <span className="mx-2">Story suivante →</span>}
            <span className="mx-2">␣ Play/Pause</span>
            <span className="mx-2">❤️ Double tap like</span>
          </div>
        )}
        
        {/* Swipe hint */}
        <div className="text-center text-white/20 text-[10px]">
          Glissez vers le bas pour fermer • Maintenez pour mettre en pause
        </div>
      </div>
    </div>
  );
};

ProgressBar.propTypes = {
  progress: PropTypes.number,
  duration: PropTypes.number,
  currentTime: PropTypes.number,
  onSeek: PropTypes.func.isRequired,
};

StoryPreview.propTypes = {
  story: PropTypes.object,
  onClose: PropTypes.func,
  onNext: PropTypes.func,
  onPrevious: PropTypes.func,
  hasNext: PropTypes.bool,
  hasPrevious: PropTypes.bool,
  onMarkAsViewed: PropTypes.func,
  onLike: PropTypes.func,
  autoAdvance: PropTypes.bool,
};

export default StoryPreview;
