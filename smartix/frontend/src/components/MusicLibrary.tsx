// =============================
// FICHIER: components/MusicLibrary/types.ts
// =============================
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  category: string;
  mood: string;
  tags: string[];
  plays: string;
  waveform: number[];
  url?: string;
  thumbnail?: string;
}

export interface MusicTrackWithVolume extends MusicTrack {
  volume: number;
  startTime: number;
}

export interface MusicLibraryProps {
  onAddMusic: (track: MusicTrackWithVolume) => void;
  initialVolume?: number;
  enableCollaboration?: boolean;
  onError?: (error: Error) => void;
}

// =============================
// FICHIER: components/MusicLibrary/constants.ts
// =============================
import { Music, TrendingUp, Flame, Headphones, Disc, Waveform, Heart, Clock } from 'lucide-react';
import type { MusicTrack } from './types';

export const CATEGORIES = [
  { id: 'all', name: 'Tous', icon: Music, color: 'from-gray-500 to-gray-600' },
  { id: 'trending', name: 'Tendances', icon: TrendingUp, color: 'from-red-500 to-orange-500' },
  { id: 'viral', name: 'Viral', icon: Flame, color: 'from-orange-500 to-yellow-500' },
  { id: 'hiphop', name: 'Hip-Hop', icon: Headphones, color: 'from-purple-500 to-pink-500' },
  { id: 'edm', name: 'EDM', icon: Disc, color: 'from-cyan-500 to-blue-500' },
  { id: 'lofi', name: 'Lo-Fi', icon: Waveform, color: 'from-green-500 to-teal-500' }
];

export const DEFAULT_TRACKS: MusicTrack[] = [
  { id: 'viral_1', title: 'Viral Beat 2024', artist: 'Smartix Beats', duration: 30, bpm: 140, category: 'viral', mood: 'energetic', tags: ['viral', 'tiktok', 'dance'], plays: '2.3M', waveform: [0.2, 0.4, 0.6, 0.8, 0.7, 0.5, 0.3, 0.2, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.3], url: '/music/viral_1.mp3' },
  { id: 'lofi_1', title: 'Rainy Day', artist: 'Lo-Fi Beats', duration: 52, bpm: 80, category: 'lofi', mood: 'calm', tags: ['lofi', 'chill', 'study'], plays: '4.2M', waveform: [0.2, 0.3, 0.4, 0.3, 0.2, 0.3, 0.4, 0.5, 0.4, 0.3, 0.2, 0.3, 0.4, 0.3, 0.2], url: '/music/lofi_1.mp3' }
];

export const STORAGE_KEYS = {
  FAVORITES: 'smartclips_music_favorites_v3',
  RECENT: 'smartclips_music_recent_v3'
};

export const CACHE_VERSION = 3;
export const MAX_RECENT = 10;
export const DEBOUNCE_DELAY = 300;

// =============================
// FICHIER: components/MusicLibrary/hooks/useLocalStorage.ts
// =============================
import { useState, useCallback, useEffect } from 'react';

export const useLocalStorage = <T,>(
  key: string, 
  defaultValue: T, 
  version: number = CACHE_VERSION
): [T, (value: T) => void, () => void, boolean] => {
  const [value, setValue] = useState<T>(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.version === version && data.value) {
          setValue(data.value);
        }
      }
    } catch (error) {
      console.error(`Failed to load from localStorage: ${key}`, error);
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore cleanup errors
      }
    }
    setIsInitialized(true);
    setIsLoading(false);
  }, [key, version]);

  const save = useCallback((newValue: T) => {
    setValue(newValue);
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify({
        version,
        value: newValue,
        updatedAt: Date.now()
      }));
    } catch (error) {
      console.error(`Failed to save to localStorage: ${key}`, error);
    }
  }, [key, version]);

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    setValue(defaultValue);
  }, [key, defaultValue]);

  return [value, save, clear, isLoading];
};

// =============================
// FICHIER: components/MusicLibrary/hooks/useOnlineStatus.ts
// =============================
import { useState, useEffect } from 'react';

export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// =============================
// FICHIER: components/MusicLibrary/hooks/useDebounce.ts
// =============================
import { useState, useEffect } from 'react';

export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// =============================
// FICHIER: components/MusicLibrary/hooks/useMusicLibrary.ts
// =============================
import { useState, useCallback, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_TRACKS, STORAGE_KEYS, MAX_RECENT, CACHE_VERSION } from '../constants';
import type { MusicTrack } from '../types';

export const useMusicLibrary = (onError?: (error: Error) => void) => {
  const [tracks, setTracks] = useState<MusicTrack[]>(DEFAULT_TRACKS);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [volume, setVolume] = useState(0.7);
  
  const [favorites, setFavorites, , favoritesLoading] = useLocalStorage<string[]>(
    STORAGE_KEYS.FAVORITES, 
    [],
    CACHE_VERSION
  );
  const [recentlyPlayed, setRecentlyPlayed, , recentLoading] = useLocalStorage<MusicTrack[]>(
    STORAGE_KEYS.RECENT, 
    [],
    CACHE_VERSION
  );

  // Chargement des tracks (API simulée)
  useEffect(() => {
    const loadTracks = async () => {
      try {
        // En prod: fetch('/api/music')
        await new Promise(resolve => setTimeout(resolve, 500));
        setTracks(DEFAULT_TRACKS);
      } catch (error) {
        onError?.(error as Error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTracks();
  }, [onError]);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const markAsRecent = useCallback((track: MusicTrack) => {
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      return [track, ...filtered].slice(0, MAX_RECENT);
    });
  }, [setRecentlyPlayed]);

  const toggleFavorite = useCallback((trackId: string) => {
    setFavorites(prev => 
      prev.includes(trackId) 
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  }, [setFavorites]);

  const fuse = useMemo(() => {
    if (tracks.length === 0) return null;
    return new Fuse(tracks, {
      keys: ['title', 'artist', 'tags'],
      threshold: 0.3,
      includeScore: true
    });
  }, [tracks]);

  const searchResults = useMemo(() => {
    if (!fuse || !search) return [];
    return fuse.search(search).map(r => r.item);
  }, [fuse, search]);

  const filteredTracks = useMemo(() => {
    if (search) return searchResults;
    
    switch (category) {
      case 'favorites':
        return tracks.filter(track => favoritesSet.has(track.id));
      case 'recent':
        return recentlyPlayed;
      case 'all':
        return tracks;
      default:
        return tracks.filter(track => track.category === category);
    }
  }, [category, tracks, favoritesSet, recentlyPlayed, search, searchResults]);

  return {
    // State
    tracks,
    isLoading: isLoading || favoritesLoading || recentLoading,
    search,
    category,
    volume,
    filteredTracks,
    favoritesSet,
    recentlyPlayed,
    
    // Actions
    setSearch,
    setCategory,
    setVolume,
    markAsRecent,
    toggleFavorite,
  };
};

// =============================
// FICHIER: components/MusicLibrary/components/WaveformVisual.tsx
// =============================
import React, { useRef, useEffect, memo } from 'react';

interface WaveformVisualProps {
  data: number[];
  isPlaying: boolean;
  currentTime?: number | null;
  duration?: number | null;
  height?: number;
  width?: number;
}

export const WaveformVisual = memo(({ 
  data, 
  isPlaying, 
  currentTime = null, 
  duration = null,
  height = 40,
  width = 200
}: WaveformVisualProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    const barWidth = width / data.length;
    data.forEach((value, i) => {
      const barHeight = Math.max(1, value * height);
      const x = i * barWidth;
      const y = height - barHeight;
      
      const gradient = ctx.createLinearGradient(x, y, x, height);
      gradient.addColorStop(0, '#ff6b35');
      gradient.addColorStop(1, '#44B0FF');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
    
    if (currentTime !== null && duration !== null && duration > 0) {
      const progress = Math.min(1, currentTime / duration);
      const cursorX = progress * width;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cursorX - 1, 0, 2, height);
    }
  }, [data, currentTime, duration, height, width]);
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`transition-all ${isPlaying ? 'opacity-100' : 'opacity-60'}`}
    />
  );
});

WaveformVisual.displayName = 'WaveformVisual';

// =============================
// FICHIER: components/MusicLibrary/components/AudioPlayer.tsx
// =============================
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, X, Loader2, AlertCircle, Music } from 'lucide-react';
import { toast } from 'sonner';
import { WaveformVisual } from './WaveformVisual';
import type { MusicTrack, MusicTrackWithVolume } from '../types';

interface AudioPlayerProps {
  track: MusicTrack;
  onClose: () => void;
  onAdd: (track: MusicTrackWithVolume) => void;
  initialVolume?: number;
  onError?: (error: Error) => void;
}

export const AudioPlayer = memo(({ track, onClose, onAdd, initialVolume = 0.7, onError }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [duration, setDuration] = useState(track.duration);
  const [isLooping, setIsLooping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialisation audio
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!track.url) {
      setAudioError('URL audio non disponible');
      setIsLoading(false);
      return;
    }

    const audio = new Audio();
    audio.src = track.url;
    audio.volume = volume;
    audio.preload = 'metadata';
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      setAudioError(null);
    };
    
    const handleError = () => {
      setAudioError('Impossible de charger l\'audio');
      setIsLoading(false);
      onError?.(new Error(`Failed to load audio: ${track.url}`));
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleEnded = () => {
      if (!isLooping) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
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
      audio.load(); // Nettoyage supplémentaire
    };
  }, [track.url, onError, isLooping]);
  
  // Gestion du volume et loop
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);
  
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Play failed:', err);
          setAudioError('Lecture impossible - vérifiez les permissions');
          onError?.(err);
        });
    }
  }, [isPlaying, onError]);
  
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);
  
  const skipBack = useCallback(() => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - 5);
      audioRef.current.currentTime = newTime;
    }
  }, []);
  
  const skipForward = useCallback(() => {
    if (audioRef.current) {
      const newTime = Math.min(duration, audioRef.current.currentTime + 5);
      audioRef.current.currentTime = newTime;
    }
  }, [duration]);
  
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  const addToTimeline = useCallback(() => {
    onAdd({
      ...track,
      volume,
      startTime: 0
    });
    toast.success(`"${track.title}" ajouté à la timeline`);
    onClose();
  }, [track, volume, onAdd, onClose]);
  
  if (audioError) {
    return (
      <div className="bg-white/5 rounded-xl p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-white/80 mb-2">{audioError}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm"
        >
          Fermer
        </button>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-2" />
        <p className="text-white/60">Chargement...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white/5 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-[#005CFF] to-[#44B0FF] rounded-lg flex items-center justify-center flex-shrink-0">
          <Music className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold truncate">{track.title}</h4>
          <p className="text-white/60 text-sm truncate">{track.artist}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full" aria-label="Fermer">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
      
      <WaveformVisual 
        data={track.waveform} 
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
      />
      
      <div className="flex items-center gap-3">
        <span className="text-white/40 text-xs">{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-white/20 rounded-lg cursor-pointer"
          aria-label="Progression"
        />
        <span className="text-white/40 text-xs">{formatTime(duration)}</span>
      </div>
      
      <div className="flex items-center justify-center gap-4">
        <button onClick={skipBack} className="p-2 hover:bg-white/10 rounded-full" aria-label="Reculer de 5 secondes">
          <SkipBack className="w-5 h-5 text-white" />
        </button>
        
        <button
          onClick={togglePlay}
          className="p-3 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] rounded-full hover:scale-105 transition-transform active:scale-95"
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white ml-0.5" />
          )}
        </button>
        
        <button onClick={skipForward} className="p-2 hover:bg-white/10 rounded-full" aria-label="Avancer de 5 secondes">
          <SkipForward className="w-5 h-5 text-white" />
        </button>
        
        <button
          onClick={() => setIsLooping(prev => !prev)}
          className={`p-2 rounded-full transition-all ${
            isLooping ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF]' : 'hover:bg-white/10'
          }`}
          aria-label={isLooping ? 'Désactiver la répétition' : 'Activer la répétition'}
        >
          <Repeat className="w-5 h-5 text-white" />
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        <Volume2 className="w-4 h-4 text-white/60" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-white/20 rounded-lg cursor-pointer"
          aria-label="Volume"
        />
        <span className="text-white/40 text-xs w-12">{Math.round(volume * 100)}%</span>
      </div>
      
      <button
        onClick={addToTimeline}
        className="w-full py-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white rounded-lg font-semibold transition-all active:scale-98"
      >
        Ajouter à la timeline
      </button>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

// =============================
// FICHIER: components/MusicLibrary/components/MusicCard.tsx
// =============================
import React, { memo } from 'react';
import { Plus, Heart, Music } from 'lucide-react';
import { WaveformVisual } from './WaveformVisual';
import type { MusicTrack } from '../types';

interface MusicCardProps {
  track: MusicTrack;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onPlay: (track: MusicTrack) => void;
  onAdd: (track: MusicTrack) => void;
}

export const MusicCard = memo(({ track, isFavorite, onToggleFavorite, onPlay, onAdd }: MusicCardProps) => {
  return (
    <div
      onClick={() => onPlay(track)}
      className="bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-all cursor-pointer group active:scale-98"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(track);
        }
      }}
      aria-label={`Écouter ${track.title} par ${track.artist}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#005CFF] to-[#44B0FF] rounded-lg flex items-center justify-center flex-shrink-0">
          <Music className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold truncate">{track.title}</h4>
          <p className="text-white/60 text-sm truncate">{track.artist}</p>
          <div className="flex gap-2 mt-1">
            <span className="text-white/40 text-xs">{track.duration}s</span>
            <span className="text-white/40 text-xs">{track.bpm} BPM</span>
            <span className="text-white/40 text-xs">🔥 {track.plays}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <WaveformVisual data={track.waveform} isPlaying={false} height={32} width={80} />
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(track.id);
            }}
            className={`p-1.5 rounded-full transition-all ${
              isFavorite 
                ? 'text-red-500' 
                : 'text-white/40 hover:text-white'
            }`}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd(track);
            }}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all opacity-0 group-hover:opacity-100 active:scale-95"
            aria-label={`Ajouter ${track.title} à la timeline`}
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
});

MusicCard.displayName = 'MusicCard';

// =============================
// FICHIER: components/MusicLibrary/components/EmptyState.tsx
// =============================
import React from 'react';
import { RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  icon: React.ElementType;
  onRefresh?: () => void;
}

export const EmptyState = ({ message, icon: Icon, onRefresh }: EmptyStateProps) => (
  <div className="text-center py-12">
    <Icon className="w-12 h-12 text-white/20 mx-auto mb-3" />
    <p className="text-white/40">{message}</p>
    {onRefresh && (
      <button
        onClick={onRefresh}
        className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm flex items-center gap-2 mx-auto"
      >
        <RefreshCw className="w-4 h-4" />
        Réessayer
      </button>
    )}
  </div>
);

// =============================
// FICHIER: components/MusicLibrary/MusicLibrary.tsx
// =============================
import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Volume2, Heart, Clock, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useMusicLibrary } from './hooks/useMusicLibrary';
import { useOfflineStatus } from '../contexts/OfflineContext';
import { useDebounce } from './hooks/useDebounce';
import { AudioPlayer } from './components/AudioPlayer';
import { MusicCard } from './components/MusicCard';
import { EmptyState } from './components/EmptyState';
import { CATEGORIES, DEBOUNCE_DELAY } from './constants';
import type { MusicLibraryProps, MusicTrack } from './types';

export const MusicLibrary = ({ 
  onAddMusic, 
  initialVolume = 0.7, 
  enableCollaboration = false,
  onError 
}: MusicLibraryProps) => {
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [localVolume, setLocalVolume] = useState(initialVolume);
  const [searchInput, setSearchInput] = useState('');
  
  const debouncedSearch = useDebounce(searchInput, DEBOUNCE_DELAY);
  const { isOnline } = useOfflineStatus();
  
  const {
    isLoading,
    filteredTracks,
    favoritesSet,
    recentlyPlayed,
    volume: globalVolume,
    setSearch,
    setCategory,
    setVolume: setGlobalVolume,
    markAsRecent,
    toggleFavorite,
  } = useMusicLibrary(onError);
  
  // Synchroniser la recherche
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setSearch(e.target.value);
  }, [setSearch]);
  
  const handlePlay = useCallback((track: MusicTrack) => {
    setSelectedTrack(track);
    markAsRecent(track);
  }, [markAsRecent]);
  
  const handleAddMusic = useCallback((track: MusicTrack) => {
    markAsRecent(track);
    onAddMusic({
      ...track,
      volume: localVolume,
      startTime: 0
    });
    toast.success(`"${track.title}" ajouté à la timeline`);
  }, [onAddMusic, localVolume, markAsRecent]);
  
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    setGlobalVolume(newVolume);
  }, [setGlobalVolume]);
  
  const connectivityIndicator = (
    <div className={`flex items-center gap-1 text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {isOnline ? 'En ligne' : 'Hors ligne'}
    </div>
  );
  
  const modalContent = selectedTrack && typeof document !== 'undefined' && createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setSelectedTrack(null)}>
      <div className="bg-[#0A0A0A] rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20" onClick={(e) => e.stopPropagation()}>
        <AudioPlayer
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onAdd={(track) => {
            handleAddMusic(track);
            setSelectedTrack(null);
          }}
          initialVolume={localVolume}
          onError={onError}
        />
      </div>
    </div>,
    document.body
  );
  
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Rechercher une musique, artiste, genre..."
          className="w-full pl-10 pr-4 py-2 bg-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          aria-label="Rechercher une musique"
        />
      </div>

    {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {favoritesSet.size > 0 && (
          <button
            onClick={() => setCategory('favorites')}
            className="px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 active:scale-95"
            aria-label="Favoris"
          >
            <Heart className="w-4 h-4" />
            Favoris ({favoritesSet.size})
          </button>
        )}
        
        {recentlyPlayed.length > 0 && (
          <button
            onClick={() => setCategory('recent')}
            className="px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 active:scale-95"
            aria-label="Récents"
          >
            <Clock className="w-4 h-4" />
            Récents
          </button>
        )}
        
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 active:scale-95"
              aria-label={`Catégorie ${cat.name}`}
            >
              <Icon className="w-4 h-4" />
              {cat.name}
            </button>
          );
        })}
      </div>
      
      {/* Volume global */}
      <div className="flex items-center gap-3 px-1">
        <Volume2 className="w-4 h-4 text-white/60" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={localVolume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-white/20 rounded-lg cursor-pointer"
          aria-label="Volume global"
        />
        <span className="text-white/40 text-xs w-12">{Math.round(localVolume * 100)}%</span>
        {connectivityIndicator}
      </div>
      
      {/* Compteur */}
      <div className="text-white/40 text-xs">
        {filteredTracks.length} titres disponibles
      </div>
      
      {/* Liste des musiques */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
        </div>
      ) : filteredTracks.length === 0 ? (
        <EmptyState 
          message={searchInput ? "Aucun résultat" : "Aucune musique dans cette catégorie"}
          icon={Search}
          onRefresh={() => setSearchInput('')}
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredTracks.map(track => (
            <MusicCard
              key={track.id}
              track={track}
              isFavorite={favoritesSet.has(track.id)}
              onToggleFavorite={toggleFavorite}
              onPlay={handlePlay}
              onAdd={handleAddMusic}
            />
          ))}
        </div>
      )}
      
      {/* Modal Player */}
      {modalContent}
      
      {/* Footer */}
      <div className="pt-4 border-t border-white/10">
        <p className="text-white/40 text-xs text-center">
          🎵 Musiques libres de droits • {enableCollaboration ? 'Synchro en direct' : 'Bibliothèque locale'}
        </p>
      </div>
    </div>
  );
};

export default MusicLibrary;
