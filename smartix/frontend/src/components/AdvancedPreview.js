import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Play, Pause, RotateCw, Maximize2, Minimize2, Volume2, VolumeX,
  SkipBack, SkipForward, Settings, Grid3x3,
  ZoomIn, ZoomOut, RefreshCw, Monitor, Download, Settings2,
  ChevronDown, X
} from 'lucide-react';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// TYPES
// =============================

// =============================
// HOOK: useDebouncedWidth
// =============================
const useDebouncedWidth = (ref, delay = 100) => {
  const [width, setWidth] = useState(0);
  const timeoutRef = useRef();

  useEffect(() => {
    const updateWidth = () => {
      if (ref.current) {
        const newWidth = ref.current.clientWidth;
        if (newWidth !== width) {
          timeoutRef.current = setTimeout(() => setWidth(newWidth), delay);
        }
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (ref.current) observer.observe(ref.current);
    
    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [ref, delay, width]);

  return width;
};

// =============================
// HOOK: useClickOutside
// =============================
const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler]);
};

// =============================
// HOOK: useKeyboardShortcuts (scoped avec focus)
// =============================
const useKeyboardShortcuts = (
  containerRef,
  handlers
) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Vérifier si le container a le focus
      if (!containerRef.current?.contains(document.activeElement)) return;
      
      // Ignorer si on est dans un champ de saisie
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlers.onPlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onSeekLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlers.onSeekRight();
          break;
        case 'KeyF':
          e.preventDefault();
          handlers.onFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          handlers.onMute();
          break;
        case 'Escape':
          e.preventDefault();
          handlers.onEscape();
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, containerRef]);
};

// =============================
// HOOK: useWaveformData (pré-agrégation)
// =============================
const useWaveformData = (audioData, width) => {
  return useMemo(() => {
    if (!audioData || audioData.length === 0 || width === 0) return [];
    
    const samplesPerPixel = Math.max(1, Math.floor(audioData.length / width));
    const peaks = [];
    
    for (let i = 0; i < width; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(audioData.length, start + samplesPerPixel);
      let max = 0;
      for (let j = start; j < end; j++) {
        max = Math.max(max, audioData[j] || 0);
      }
      peaks.push(max);
    }
    
    return peaks;
  }, [audioData, width]);
};

// =============================
// COMPOSANT WAVEFORM (RAF optimisé)
// =============================

const Waveform = memo(({ audioData, currentTime, duration, onSeek, isPlaying, height = 96 }) => {
  const containerRef = useRef(null);
  const staticCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const width = useDebouncedWidth(containerRef, 100);
  const peaks = useWaveformData(audioData, width);
  const animationRef = useRef();
  
  // Dessiner la waveform statique
  useEffect(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas || peaks.length === 0 || width === 0) return;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    // Grille
    if (duration > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const pixelsPerSecond = width / duration;
      for (let i = 1; i <= Math.floor(duration); i++) {
        const x = i * pixelsPerSecond;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
    
    // Waveform
    const barWidth = Math.max(1, width / peaks.length);
    for (let i = 0; i < peaks.length; i++) {
      const barHeight = peaks[i] * height;
      const x = i * barWidth;
      const y = height - barHeight;
      
      const gradient = ctx.createLinearGradient(x, y, x, height);
      gradient.addColorStop(0, '#ff6b35');
      gradient.addColorStop(1, '#44B0FF');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }
  }, [peaks, width, height, duration]);
  
  // Dessiner l'overlay (curseur) avec RAF seulement si lecture active
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || width === 0) return;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (duration > 0) {
      const cursorX = (currentTime / duration) * width;
      ctx.fillStyle = '#ff6b35';
      ctx.fillRect(cursorX - 1, 0, 2, height);
    }
  }, [currentTime, duration, width, height]);
  
  // RAF uniquement quand la vidéo joue
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        drawOverlay();
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // En pause, on redessine une fois pour mettre à jour le curseur
      drawOverlay();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, drawOverlay]);
  
  const handleClick = (e) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || duration === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(Math.min(duration, Math.max(0, time)));
  };
  
  if (!audioData || audioData.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-4 text-center">
        <Waveform className="w-5 h-5 text-white/40 mx-auto mb-1" />
        <p className="text-white/40 text-xs">Aucune donnée audio disponible</p>
      </div>
    );
  }
  
  return (
    <div ref={containerRef} className="relative w-full cursor-pointer" onClick={handleClick}>
      <canvas ref={staticCanvasRef} className="w-full h-24 rounded-lg" style={{ display: 'block' }} />
      <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-24 rounded-lg pointer-events-none" style={{ display: 'block' }} />
    </div>
  );
});

Waveform.displayName = 'Waveform';

// =============================
// COMPOSANT MARQUEURS
// =============================

const TimelineMarkers = memo(({ markers, currentTime, duration, onMarkerClick }) => {
  const validMarkers = useMemo(() => {
    return markers.filter(m => m.time >= 0 && m.time <= duration);
  }, [markers, duration]);
  
  const getMarkerColor = (type) => {
    switch (type) {
      case 'video': return 'bg-[#ff6b35]';
      case 'text': return 'bg-[#0984E3]';
      case 'audio': return 'bg-[#00B894]';
      case 'effect': return 'bg-[#E84342]';
      default: return 'bg-[#6C5CE7]';
    }
  };
  
  if (validMarkers.length === 0) return null;
  
  return (
    <div className="relative w-full h-6">
      {validMarkers.map((marker, index) => (
        <button
          key={`${marker.time}-${index}`}
          className="absolute group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff6b35] rounded-full"
          style={{ left: `${(marker.time / duration) * 100}%`, transform: 'translateX(-50%)' }}
          onClick={() => onMarkerClick(marker.time)}
          aria-label={`Marqueur ${marker.label || marker.type} à ${marker.time.toFixed(1)} secondes`}
        >
          <div className={`w-2 h-2 rounded-full ${getMarkerColor(marker.type)}`} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap pointer-events-none">
            {marker.label || marker.type} ({marker.time.toFixed(1)}s)
          </div>
        </button>
      ))}
    </div>
  );
});

TimelineMarkers.displayName = 'TimelineMarkers';

// =============================
// COMPOSANT CONTRÔLES DE LECTURE
// =============================

const PlaybackControls = memo(({ 
  isPlaying, 
  onPlayPause, 
  currentTime, 
  duration, 
  onSeek,
  playbackRate,
  onPlaybackRateChange,
  loop,
  onLoopChange,
  onOpenMenu,
  isSpeedMenuOpen
}) => {
  const speedMenuRef = useRef(null);
  
  useClickOutside(speedMenuRef, () => onOpenMenu(null));
  
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  
  const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  const handleSeek = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && isFinite(value)) onSeek(value);
  };
  
  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={currentTime}
          onChange={handleSeek}
          disabled={!duration}
          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ff6b35]"
          aria-label="Progression vidéo"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 5))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
            aria-label="Reculer de 5 secondes"
          >
            <SkipBack className="w-4 h-4 text-white" />
          </button>
          
          <button
            onClick={onPlayPause}
            className="p-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] rounded-full hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>
          
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 5))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
            aria-label="Avancer de 5 secondes"
          >
            <SkipForward className="w-4 h-4 text-white" />
          </button>
          
          <div className="text-white/60 text-sm font-mono ml-2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative" ref={speedMenuRef}>
            <button
              onClick={() => onOpenMenu(isSpeedMenuOpen ? null : 'speed')}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
              aria-label={`Vitesse: ${playbackRate}x`}
            >
              <Settings className="w-4 h-4 text-white" />
              <span className="text-white/60 text-xs">{playbackRate}x</span>
            </button>
            
            {isSpeedMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] rounded-lg shadow-xl border border-white/10 p-2 z-20 min-w-[80px]">
                {speeds.map(rate => (
                  <button
                    key={rate}
                    onClick={() => {
                      onPlaybackRateChange(rate);
                      onOpenMenu(null);
                    }}
                    className={`block w-full px-3 py-1 text-sm rounded hover:bg-white/10 transition-all focus:outline-none focus:bg-white/20 ${
                      playbackRate === rate ? 'text-[#ff6b35]' : 'text-white/80'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={() => onLoopChange(!loop)}
            className={`p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35] ${
              loop ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF]' : 'hover:bg-white/10'
            }`}
            aria-label={loop ? 'Désactiver la répétition' : 'Activer la répétition'}
          >
            <RotateCw className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      
      {loop && (
        <div className="text-center text-white/40 text-xs">
          🔁 Mode loop activé
        </div>
      )}
    </div>
  );
});

PlaybackControls.displayName = 'PlaybackControls';

// =============================
// COMPOSANT CONTRÔLES DE QUALITÉ
// =============================

const QualityControls = ({ onExport, onFormatChange, onQualityChange, isExporting = false, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState(FORMATS[0]);
  const [selectedQuality, setSelectedQuality] = useState(QUALITY_PRESETS[1]);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const formatMenuRef = useRef(null);
  const qualityMenuRef = useRef(null);
  
  useClickOutside(formatMenuRef, () => setShowFormatMenu(false));
  useClickOutside(qualityMenuRef, () => setShowQualityMenu(false));
  
  const handleFormatSelect = (format) => {
    setSelectedFormat(format);
    onFormatChange?.(format);
    setShowFormatMenu(false);
  };
  
  const handleQualitySelect = (quality) => {
    setSelectedQuality(quality);
    onQualityChange?.(quality);
    setShowQualityMenu(false);
  };
  
  return (
    <div className="flex flex-col gap-2">
      <div className="relative" ref={formatMenuRef}>
        <button
          onClick={() => setShowFormatMenu(!showFormatMenu)}
          className="flex items-center justify-between w-full px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
          aria-label="Changer le format"
        >
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-white" />
            <span className="text-white text-sm">{selectedFormat.name}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-white/60" />
        </button>
        
        {showFormatMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] rounded-lg shadow-xl border border-white/10 p-2 z-20 w-full">
            {FORMATS.map(format => (
              <button
                key={format.id}
                onClick={() => handleFormatSelect(format)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded hover:bg-white/10 transition-all focus:outline-none focus:bg-white/20 ${
                  selectedFormat.id === format.id ? 'bg-white/10 text-[#ff6b35]' : 'text-white/80'
                }`}
              >
                <span>{format.icon}</span>
                <span>{format.name}</span>
                <span className="text-white/40 text-xs ml-auto">{format.width}×{format.height}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="relative" ref={qualityMenuRef}>
        <button
          onClick={() => setShowQualityMenu(!showQualityMenu)}
          className="flex items-center justify-between w-full px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
          aria-label="Changer la qualité"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-white" />
            <span className="text-white text-sm">{selectedQuality.label}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-white/60" />
        </button>
        
        {showQualityMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] rounded-lg shadow-xl border border-white/10 p-2 z-20 w-full">
            {QUALITY_PRESETS.map(quality => (
              <button
                key={quality.id}
                onClick={() => handleQualitySelect(quality)}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded hover:bg-white/10 transition-all focus:outline-none focus:bg-white/20 ${
                  selectedQuality.id === quality.id ? 'bg-white/10 text-[#ff6b35]' : 'text-white/80'
                }`}
              >
                <span>{quality.name}</span>
                <span className="text-white/40 text-xs">{quality.bitrate} Mbps</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <button
        onClick={onExport}
        disabled={isExporting}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-lg hover:shadow-[#005CFF]/50 rounded-lg transition-all disabled:opacity-50 mt-2 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
        aria-label="Exporter la vidéo"
      >
        {isExporting ? (
          <RefreshCw className="w-4 h-4 text-white animate-spin" />
        ) : (
          <Download className="w-4 h-4 text-white" />
        )}
        <span className="text-white text-sm font-semibold">Exporter</span>
      </button>
    </div>
  );
};

// =============================
// CONSTANTES
// =============================
const FORMATS = [
  { id: '9:16', name: 'TikTok/Reels', width: 1080, height: 1920, icon: '📱' },
  { id: '1:1', name: 'Instagram', width: 1080, height: 1080, icon: '⬛' },
  { id: '16:9', name: 'YouTube', width: 1920, height: 1080, icon: '🖥️' },
  { id: '4:5', name: 'Facebook', width: 1080, height: 1350, icon: '📘' }
];

const QUALITY_PRESETS = [
  { id: '4k', name: '4K', width: 3840, height: 2160, bitrate: 50, label: 'Ultra HD' },
  { id: '1080p', name: '1080p', width: 1920, height: 1080, bitrate: 20, label: 'Full HD' },
  { id: '720p', name: '720p', width: 1280, height: 720, bitrate: 10, label: 'HD' },
  { id: '540p', name: '540p', width: 960, height: 540, bitrate: 5, label: 'SD' }
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const AdvancedPreview = ({ 
  videoController,
  onExport,
  onFormatChange,
  onQualityChange,
  isExporting = false,
  audioData = null,
  markers = [],
  showWaveform: initialShowWaveform = true,
  showMarkers: initialShowMarkers = true
}) => {
  const [showWaveformPanel, setShowWaveformPanel] = useState(initialShowWaveform);
  const [showMarkersPanel, setShowMarkersPanel] = useState(initialShowMarkers);
  const [openMenu, setOpenMenu] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef(null);
  const previewContainerRef = useRef(null);
  const settingsMenuRef = useRef(null);
  
  useClickOutside(settingsMenuRef, () => setOpenMenu(null));
  
  // Fullscreen avec fallback
  const toggleFullscreen = useCallback(() => {
    const element = previewContainerRef.current;
    if (!element) return;
    
    if (!isFullscreen) {
      const requestMethod = element.requestFullscreen ||
        (element).webkitRequestFullscreen ||
        (element).mozRequestFullScreen ||
        (element).msRequestFullscreen;
      
      if (requestMethod) {
        requestMethod.call(element);
      }
    } else {
      const exitMethod = document.exitFullscreen ||
        (document).webkitExitFullscreen ||
        (document).mozCancelFullScreen ||
        (document).msExitFullscreen;
      
      if (exitMethod) {
        exitMethod.call(document);
      }
    }
  }, [isFullscreen]);
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Gestion play/pause correcte (toggle)
  const handlePlayPause = useCallback(() => {
    if (videoController.isPlaying) {
      videoController.pause();
    } else {
      videoController.play();
    }
  }, [videoController]);
  
  // Raccourcis clavier scoped avec focus
  useKeyboardShortcuts(containerRef, {
    onPlayPause: handlePlayPause,
    onSeekLeft: () => videoController.seek(Math.max(0, videoController.currentTime - 5)),
    onSeekRight: () => videoController.seek(Math.min(videoController.duration, videoController.currentTime + 5)),
    onFullscreen: toggleFullscreen,
    onMute: videoController.toggleMute,
    onEscape: () => setOpenMenu(null)
  });
  
  const formatTimeDisplay = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div 
      ref={containerRef} 
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4"
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div ref={previewContainerRef} className="relative">
        {/* Waveform Panel */}
        {showWaveformPanel && (
          <div className="mb-4">
            <Waveform
              audioData={audioData}
              currentTime={videoController.currentTime}
              duration={videoController.duration}
              onSeek={videoController.seek}
              isPlaying={videoController.isPlaying}
            />
          </div>
        )}
        
        {/* Markers Panel */}
        {showMarkersPanel && markers.length > 0 && (
          <div className="mb-3">
            <TimelineMarkers
              markers={markers}
              currentTime={videoController.currentTime}
              duration={videoController.duration}
              onMarkerClick={videoController.seek}
            />
          </div>
        )}
        
        {/* Playback Controls */}
        <PlaybackControls
          isPlaying={videoController.isPlaying}
          onPlayPause={handlePlayPause}
          currentTime={videoController.currentTime}
          duration={videoController.duration}
          onSeek={videoController.seek}
          playbackRate={videoController.playbackRate}
          onPlaybackRateChange={videoController.setPlaybackRate}
          loop={videoController.loop}
          onLoopChange={videoController.setLoop}
          onOpenMenu={setOpenMenu}
          isSpeedMenuOpen={openMenu === 'speed'}
        />
        
        {/* Bottom Bar */}
        <div className="flex items-center justify-between mt-3">
          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={videoController.toggleMute}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
              aria-label={videoController.isMuted ? 'Réactiver le son' : 'Couper le son'}
            >
              {videoController.isMuted ? (
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
              value={videoController.isMuted ? 0 : videoController.volume}
              onChange={(e) => videoController.setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#ff6b35]"
              aria-label="Volume"
            />
          </div>
          
          {/* Time Display */}
          <div className="text-white/60 text-sm font-mono">
            {formatTimeDisplay(videoController.currentTime)} / {formatTimeDisplay(videoController.duration)}
          </div>
          
          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Waveform Toggle */}
            {audioData && audioData.length > 0 && (
              <button
                onClick={() => setShowWaveformPanel(!showWaveformPanel)}
                className={`p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35] ${
                  showWaveformPanel ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
                aria-label={showWaveformPanel ? 'Masquer la waveform' : 'Afficher la waveform'}
              >
                <Waveform className="w-4 h-4 text-white" />
              </button>
            )}
            
            {/* Markers Toggle */}
            <button
              onClick={() => setShowMarkersPanel(!showMarkersPanel)}
              className={`p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35] ${
                showMarkersPanel ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              aria-label={showMarkersPanel ? 'Masquer les marqueurs' : 'Afficher les marqueurs'}
            >
              <Grid3x3 className="w-4 h-4 text-white" />
            </button>
            
            {/* Settings Button */}
            <div className="relative" ref={settingsMenuRef}>
              <button
                onClick={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
                aria-label="Paramètres d'export"
              >
                <Settings className="w-4 h-4 text-white" />
              </button>
              
              {openMenu === 'settings' && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] rounded-lg shadow-xl border border-white/10 p-3 z-20 w-64">
                  <QualityControls
                    onExport={onExport}
                    onFormatChange={onFormatChange}
                    onQualityChange={onQualityChange}
                    isExporting={isExporting}
                    onClose={() => setOpenMenu(null)}
                  />
                </div>
              )}
            </div>
            
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
              aria-label={isFullscreen ? "Quitter plein écran" : "Plein écran"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-white" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
{/* Keyboard Shortcuts Hint */}
        <div className="mt-3 text-center text-white/30 text-[10px] flex items-center justify-center gap-4 flex-wrap">
          <span>␣ Play/Pause</span>
          <span>← → ±5s</span>
          <span>F Plein écran</span>
          <span>M Muet</span>
          <span>ESC Fermer menus</span>
        </div>
        
        {/* Focus hint */}
        <div className="text-center text-white/20 text-[8px] mt-1">
          Cliquez sur la zone pour utiliser les raccourcis clavier
        </div>
      </div>
    </div>
  );
};

AdvancedPreview.propTypes = {
  videoController: PropTypes.any.isRequired,
  onExport: PropTypes.func.isRequired,
  onFormatChange: PropTypes.func.isRequired,
  onQualityChange: PropTypes.func.isRequired,
  isExporting: PropTypes.bool,
  audioData: PropTypes.any,
  markers: PropTypes.any,
  showWaveform: PropTypes.bool.isRequired,
  initialShowWaveform: PropTypes.any,
  showMarkers: PropTypes.bool.isRequired,
  initialShowMarkers: PropTypes.any,
};

export default AdvancedPreview;
QualityControls.propTypes = {
  onExport: PropTypes.func.isRequired,
  onFormatChange: PropTypes.func.isRequired,
  onQualityChange: PropTypes.func.isRequired,
  isExporting: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};
