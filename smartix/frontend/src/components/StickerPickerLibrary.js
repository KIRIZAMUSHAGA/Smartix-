import React, { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import { useOfflineStatus } from '../contexts/OfflineContext';
import { createPortal } from 'react-dom';
import { 
  Search, X, Plus, Heart, Star, Fire, Crown, Sparkles, Smile, 
  ArrowUp, ArrowDown, ArrowRight, ArrowLeft, Download, Trash2,
  Copy, Check, Grid3x3, Grid3x3 as GridIcon, Palette, Move,
  RotateCw, Maximize2, Minimize2, Layers, TrendingUp, Clock,
  GripVertical, ZoomIn, ZoomOut, Loader2, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import Fuse from 'fuse.js';
import { useVirtual } from 'react-virtual'; // npm install react-virtual
import PropTypes from 'prop-types';

// =============================
// TYPES SYSTÈME
// =============================

// =============================
// CONSTANTES
// =============================
const CATEGORIES = [
  { id: 'all', name: 'Tous', icon: '🎨', color: 'from-gray-500 to-gray-600' },
  { id: 'popular', name: 'Tendances', icon: '🔥', color: 'from-red-500 to-orange-500' },
  { id: 'emojis', name: 'Emojis', icon: '😊', color: 'from-yellow-500 to-orange-500' },
  { id: 'reactions', name: 'Réactions', icon: '👏', color: 'from-red-500 to-pink-500' },
  { id: 'arrows', name: 'Flèches', icon: '➡️', color: 'from-blue-500 to-cyan-500' },
  { id: 'shapes', name: 'Formes', icon: '🔵', color: 'from-purple-500 to-indigo-500' },
  { id: 'animated', name: 'Animés', icon: '✨', color: 'from-cyan-500 to-teal-500' }
];

// Catalogue avec thumbnails pour optimisation
const STATIC_STICKERS = [
  { id: 'fire', emoji: '🔥', name: 'Feu', type: 'emoji', category: 'emojis', tags: ['fire', 'hot'], popularity: 100 },
  { id: 'love', emoji: '😍', name: 'Amour', type: 'emoji', category: 'emojis', tags: ['love', 'heart'], popularity: 95 },
  { id: 'laugh', emoji: '😂', name: 'Rire', type: 'emoji', category: 'emojis', tags: ['funny', 'laugh'], popularity: 98 },
  { id: '100', emoji: '💯', name: '100%', type: 'emoji', category: 'emojis', tags: ['perfect', 'score'], popularity: 85 },
  { id: 'clap', emoji: '👏', name: 'Applaudissements', type: 'emoji', category: 'reactions', tags: ['clap', 'applause'], popularity: 90 },
  { id: 'thumbs_up', emoji: '👍', name: 'Pouce en haut', type: 'emoji', category: 'reactions', tags: ['like', 'approve'], popularity: 92 },
  { id: 'muscle', emoji: '💪', name: 'Muscle', type: 'emoji', category: 'reactions', tags: ['muscle', 'strong'], popularity: 80 },
  { id: 'up', emoji: '⬆️', name: 'Flèche haut', type: 'emoji', category: 'arrows', tags: ['up', 'arrow'], popularity: 70 },
  { id: 'right', emoji: '➡️', name: 'Flèche droite', type: 'emoji', category: 'arrows', tags: ['right', 'arrow'], popularity: 72 },
  { id: 'red_circle', emoji: '🔴', name: 'Cercle rouge', type: 'emoji', category: 'shapes', tags: ['circle', 'red'], popularity: 65 },
  
  // Stickers animés avec thumbnails
  { id: 'fire_animated', url: '/stickers/fire.gif', thumbnail: '/stickers/fire-thumb.jpg', name: 'Feu animé', type: 'animated', category: 'animated', tags: ['fire', 'hot', 'animated'], duration: 2, popularity: 88, width: 200, height: 200 },
  { id: 'heart_animated', url: '/stickers/heart.gif', thumbnail: '/stickers/heart-thumb.jpg', name: 'Cœur animé', type: 'animated', category: 'animated', tags: ['heart', 'love', 'animated'], duration: 2, popularity: 92, width: 200, height: 200 },
  { id: 'star_animated', url: '/stickers/star.gif', thumbnail: '/stickers/star-thumb.jpg', name: 'Étoile animée', type: 'animated', category: 'animated', tags: ['star', 'shine', 'animated'], duration: 2, popularity: 85, width: 200, height: 200 }
];

// Index de recherche Fuse
const fuseIndex = new Fuse(STATIC_STICKERS, {
  keys: ['name', 'tags', 'emoji'],
  threshold: 0.3,
  includeScore: true
});

const RECENT_STICKERS_KEY = 'smartclips_recent_stickers';
const STICKER_CACHE_VERSION = 2;
const MAX_LAYERS = 50;
const VIRTUALIZATION_THRESHOLD = 50;

// =============================
// HOOK: DEBOUNCE
// =============================
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};

// =============================
// HOOK: THROTTLE (pour les événements tactiles)
// =============================
const useThrottle = (value, delay) => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now - lastRun.current >= delay) {
      setThrottledValue(value);
      lastRun.current = now;
    } else {
      const handler = setTimeout(() => {
        setThrottledValue(value);
        lastRun.current = Date.now();
      }, delay - (now - lastRun.current));
      return () => clearTimeout(handler);
    }
  }, [value, delay]);

  return throttledValue;
};

// =============================
// HOOK: STICKER RECENTS (Optimisé avec requestIdleCallback)
// =============================
const useRecentStickers = () => {
  const [recentStickers, setRecentStickers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecent = () => {
      const saved = localStorage.getItem(RECENT_STICKERS_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.version === STICKER_CACHE_VERSION) {
            setRecentStickers(data.stickers.slice(0, 12));
          }
        } catch (e) {
          console.error('Failed to load recent stickers', e);
        }
      }
      setIsLoading(false);
    };

    // Utiliser requestIdleCallback pour ne pas bloquer le thread principal
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loadRecent(), { timeout: 1000 });
    } else {
      setTimeout(loadRecent, 100);
    }
  }, []);

  const saveRecent = useCallback((sticker) => {
    setRecentStickers(prev => {
      const filtered = prev.filter(s => s.id !== sticker.id);
      const newRecent = [sticker, ...filtered].slice(0, 12);
      
      // Sauvegarde asynchrone pour ne pas bloquer
      setTimeout(() => {
        localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify({
          version: STICKER_CACHE_VERSION,
          stickers: newRecent,
          updatedAt: Date.now()
        }));
      }, 0);
      
      return newRecent;
    });
  }, []);

  return { recentStickers, saveRecent, isLoading };
};

// =============================
// COMPOSANT STICKER ITEM (Avec lazy loading et optimisation GPU)
// =============================
const StickerItem = memo(({ 
  sticker, 
  onClick,
  size = 'md',
  inView = true
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const handleClick = useCallback(() => onClick(sticker), [sticker, onClick]);
  
  const sizeClasses = {
    sm: 'w-10 h-10 text-2xl',
    md: 'w-12 h-12 text-4xl',
    lg: 'w-16 h-16 text-6xl'
  };
  
  const thumbnailUrl = sticker.thumbnail || sticker.url;
  
  return (
    <button
      onClick={handleClick}
      className="group aspect-square bg-white/10 hover:bg-white/20 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
      aria-label={`Ajouter sticker ${sticker.name}`}
    >
      <div className="relative">
        {sticker.url && sticker.type === 'animated' ? (
          <>
            {!isLoaded && !hasError && (
              <div className={`${sizeClasses[size]} flex items-center justify-center`}>
                <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
              </div>
            )}
            {inView && (
              <img 
                src={thumbnailUrl || sticker.url}
                alt={sticker.name}
                className={`${sizeClasses[size]} object-contain group-hover:scale-110 transition-transform ${isLoaded ? 'opacity-100' : 'opacity-0'} will-change-transform`}
                loading="lazy"
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
                width={sticker.width || 48}
                height={sticker.height || 48}
              />
            )}
          </>
        ) : (
          <span className={`${sizeClasses[size]} group-hover:scale-110 transition-transform inline-block will-change-transform`}>
            {sticker.emoji}
          </span>
        )}
        {sticker.type === 'animated' && (
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-3 h-3 text-yellow-400" />
          </div>
        )}
      </div>
      <span className="text-white/60 text-xs group-hover:text-white/80 truncate max-w-full px-1">
        {sticker.name}
      </span>
    </button>
  );
});

StickerItem.displayName = 'StickerItem';

// =============================
// COMPOSANT STICKER CUSTOMIZER (Optimisé pour mobile)
// =============================

const StickerCustomizer = memo(({ sticker, onConfirm, onCancel }) => {
  const [size, setSize] = useState(80);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [opacity, setOpacity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const previewRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 50, posY: 50 });
  const pinchStartRef = useRef({ distance: 0, size: 80 });
  
  // Throttle pour les événements tactiles
  const throttledPosition = useThrottle(position, 16);
  
  // Transform avec GPU acceleration
  const transformStyle = useMemo(() => {
    const translateX = throttledPosition.x - 50;
    const translateY = throttledPosition.y - 50;
    return `translate(${translateX}%, ${translateY}%) rotate(${rotation}deg) scale(${size / 80})`;
  }, [throttledPosition.x, throttledPosition.y, rotation, size]);
  
  // Gestion du drag (souris)
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: position.x,
      y: position.y,
      posX: position.x,
      posY: position.y
    };
  }, [position.x, position.y]);
  
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const newX = Math.max(0, Math.min(100, dragStartRef.current.posX + (deltaX / 2)));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.posY + (deltaY / 2)));
    setPosition({ x: newX, y: newY });
  }, [isDragging]);
  
  // Gestion du touch (mobile) avec pinch zoom
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      // Drag
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = {
        x: position.x,
        y: position.y,
        posX: position.x,
        posY: position.y
      };
    } else if (e.touches.length === 2) {
      // Pinch zoom
      setIsPinching(true);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      pinchStartRef.current = { distance, size };
    }
  }, [position.x, position.y, size]);
  
  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;
      const newX = Math.max(0, Math.min(100, dragStartRef.current.posX + (deltaX / 2)));
      const newY = Math.max(0, Math.min(100, dragStartRef.current.posY + (deltaY / 2)));
      setPosition({ x: newX, y: newY });
    } else if (isPinching && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scale = distance / pinchStartRef.current.distance;
      let newSize = pinchStartRef.current.size * scale;
      newSize = Math.max(40, Math.min(200, newSize));
      setSize(newSize);
    }
  }, [isDragging, isPinching]);
  
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsPinching(false);
  }, []);
  
  useEffect(() => {
    if (isDragging || isPinching) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleTouchEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleTouchEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, isPinching, handleMouseMove, handleTouchMove, handleTouchEnd]);
  
  const confirm = useCallback(() => {
    onConfirm({
      type: 'sticker',
      content: sticker.emoji || sticker.url || '',
      name: sticker.name,
      position,
      scale: size / 80,
      rotation,
      opacity,
      duration: sticker.duration || 3,
      isAnimated: sticker.isAnimated === 'animated',
      tags: sticker.tags || [],
      thumbnail: sticker.thumbnail
    });
  }, [sticker, size, rotation, position, opacity, onConfirm]);
  
  return (
    <div className="space-y-6">
      {/* Preview avec drag & drop et pinch zoom */}
      <div 
        ref={previewRef}
        className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl h-64 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div
          className="transition-transform will-change-transform"
          style={{
            transform: transformStyle,
            opacity: opacity
          }}
        >
          {sticker.url ? (
            <img 
              src={sticker.url} 
              alt={sticker.name} 
              className="w-32 h-32 object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <span className="text-8xl pointer-events-none select-none">{sticker.emoji}</span>
          )}
        </div>
        
        <div className="absolute bottom-2 left-2 text-white/40 text-xs bg-black/50 px-2 py-1 rounded-full">
          {isDragging ? 'Glissez pour déplacer' : 'Glissez pour déplacer • Pincer pour zoomer'}
        </div>
        
        <div className="absolute top-2 right-2 text-white/40 text-xs bg-black/50 px-2 py-1 rounded-full">
          X% Y%
        </div>
      </div>
      
      {/* Contrôles optimisés pour mobile */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-white/60 text-sm">Taille</label>
          <div className="flex items-center gap-2 mt-1">
            <ZoomOut className="w-4 h-4 text-white/40" />
            <input
              type="range"
              min="40"
              max="200"
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value))}
              className="flex-1"
              aria-label="Ajuster la taille"
            />
            <ZoomIn className="w-4 h-4 text-white/40" />
            <span className="text-white/60 text-sm w-12">{size}px</span>
          </div>
        </div>
        
        <div>
          <label className="text-white/60 text-sm">Rotation</label>
          <div className="flex items-center gap-2 mt-1">
            <RotateCw className="w-4 h-4 text-white/40" />
            <input
              type="range"
              min="-180"
              max="180"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value))}
              className="flex-1"
              aria-label="Ajuster la rotation"
            />
            <span className="text-white/60 text-sm w-12">{rotation}°</span>
          </div>
        </div>
        
        <div>
          <label className="text-white/60 text-sm">Opacité</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="flex-1"
              aria-label="Ajuster l'opacité"
            />
            <span className="text-white/60 text-sm w-12">{Math.round(opacity * 100)}%</span>
          </div>
        </div>
        
        <div>
          <label className="text-white/60 text-sm">Durée</label>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-4 h-4 text-white/40" />
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={sticker.duration || 3}
              onChange={(e) => sticker.duration = parseFloat(e.target.value)}
              className="flex-1"
              aria-label="Ajuster la durée"
            />
            <span className="text-white/60 text-sm w-12">{sticker.duration || 3}s</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all active:scale-95"
        >
          Annuler
        </button>
        <button
          onClick={confirm}
          className="flex-1 py-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white rounded-lg font-semibold transition-all active:scale-95"
        >
          Ajouter à la timeline
        </button>
      </div>
    </div>
  );
});

StickerCustomizer.displayName = 'StickerCustomizer';

// =============================
// COMPOSANT LAYER LIST (Avec virtualisation)
// =============================
const LayerList = ({ layers, selectedId, onSelect, onRemove, maxHeight = 300 }) => {
  const parentRef = useRef(null);
  
  const rowVirtualizer = useVirtual({
    size: layers.length,
    parentRef,
    estimateSize: useCallback(() => 70, []),
    overscan: 5
  });
  
  if (layers.length === 0) return null;
  
  return (
    <div 
      ref={parentRef} 
      className="overflow-y-auto"
      style={{ height: `${Math.min(maxHeight, layers.length * 70)}px` }}
    >
      <div style={{ height: `${rowVirtualizer.totalSize}px`, position: 'relative' }}>
        {rowVirtualizer.virtualItems.map((virtualRow) => {
          const layer = layers[virtualRow.index];
          if (!layer) return null;
          
          return (
            <div
              key={layer.id || virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <div
                onClick={() => layer.id && onSelect(layer.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                  selectedId === layer.id
                    ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF]'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-white/60" />
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-lg">{layer.content}</span>
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{layer.name}</div>
                    <div className="text-white/40 text-xs">Z-index</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    layer.id && onRemove(layer.id);
                  }}
                  className="p-1 hover:bg-white/20 rounded-lg transition-all active:scale-95"
                  aria-label="Supprimer le sticker"
                >
                  <Trash2 className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const StickerLibrary = ({ 
  onAddSticker, 
  initialLayers = [],
  selectedLayerId,
  onLayerSelect,
  onLayersChange,
  maxLayers = MAX_LAYERS,
  enableCollaboration = false
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [layers, setLayers] = useState(initialLayers);
  const { isOnline } = useOfflineStatus();
  
  const debouncedSearch = useDebounce(search, 300);
  const { recentStickers, saveRecent, isLoading: recentLoading } = useRecentStickers();
  
  // Synchronisation des layers avec le parent
  useEffect(() => {
    if (onLayersChange) {
      onLayersChange(layers);
    }
  }, [layers, onLayersChange]);
  
  // Stickers par catégorie
  const stickersByCategory = useMemo(() => {
    const map = new Map();
    STATIC_STICKERS.forEach(sticker => {
      if (!map.has(sticker.category)) map.set(sticker.category, []);
      map.get(sticker.category).push(sticker);
    });
    return map;
  }, []);
  
  // Stickers populaires
  const popularStickers = useMemo(() => {
    return [...STATIC_STICKERS]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 12);
  }, []);
  
  // Recherche optimisée
  const searchResults = useMemo(() => {
    if (!debouncedSearch) return [];
    const results = fuseIndex.search(debouncedSearch);
    return results.map(r => r.item);
  }, [debouncedSearch]);
  
  // Stickers filtrés
  const filteredStickers = useMemo(() => {
    if (debouncedSearch) return searchResults;
    
    switch (category) {
      case 'recent':
        return recentStickers;
      case 'popular':
        return popularStickers;
      case 'all':
        return STATIC_STICKERS;
      default:
        return stickersByCategory.get(category) || [];
    }
  }, [category, recentStickers, popularStickers, debouncedSearch, searchResults, stickersByCategory]);
  
  const handleStickerClick = useCallback((sticker) => {
    setSelectedSticker(sticker);
    setShowCustomizer(true);
  }, []);
  
  const handleConfirmSticker = useCallback((customizedSticker) => {
    if (layers.length >= maxLayers) {
      toast.error(`Maximum ${maxLayers} stickers atteint`);
      return;
    }
    
    const newLayer = {
      ...customizedSticker,
      id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: {
        ...customizedSticker.position,
        zIndex: layers.length
      }
    };
    
    onAddSticker(newLayer);
    setLayers(prev => [...prev, newLayer]);
    
    const originalSticker = STATIC_STICKERS.find(s => s.name === customizedSticker.name);
    if (originalSticker) saveRecent(originalSticker);
    
    toast.success(`Sticker "${customizedSticker.name}" ajouté`);
    setShowCustomizer(false);
    setSelectedSticker(null);
  }, [onAddSticker, saveRecent, layers.length, maxLayers]);
  
  const handleRemoveLayer = useCallback((layerId) => {
    setLayers(prev => prev.filter(l => l.id !== layerId));
    toast.info('Sticker retiré');
  }, []);
  
  // Indicateur de connectivité
  const connectivityIndicator = (
    <div className={`flex items-center gap-1 text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {isOnline ? 'En ligne' : 'Hors ligne'}
    </div>
  );
  
  const modalContent = showCustomizer && selectedSticker && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowCustomizer(false)}>
      <div className="bg-[#0A0A0A] rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold">
            Personnaliser {selectedSticker.name}
          </h3>
          <button
            onClick={() => setShowCustomizer(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-95"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        <StickerCustomizer
          sticker={selectedSticker}
          onConfirm={handleConfirmSticker}
          onCancel={() => {
            setShowCustomizer(false);
            setSelectedSticker(null);
          }}
        />
      </div>
    </div>
  );
  
  return (
    <div className="space-y-4">
      {/* Header avec recherche et connectivité */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un sticker..."
            className="w-full pl-10 pr-4 py-2 bg-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          />
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all active:scale-95"
          aria-label="Changer l'affichage"
        >
          {viewMode === 'grid' ? (
            <GridIcon className="w-5 h-5 text-white" />
          ) : (
            <Layers className="w-5 h-5 text-white" />
          )}
        </button>
        {connectivityIndicator}
      </div>
      
      {/* Catégories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {recentStickers.length > 0 && (
          <button
            onClick={() => setCategory('recent')}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 active:scale-95 ${
              category === 'recent' 
                ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <Clock className="w-4 h-4" />
            Récents
            {recentLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          </button>
        )}
        
        <button
          onClick={() => setCategory('popular')}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 active:scale-95 ${
            category === 'popular' 
              ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' 
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Tendances
        </button>
        
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 active:scale-95 ${
              category === cat.id 
                ? `bg-gradient-to-r ${cat.color} text-white` 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>
      
      {/* Layers existants avec virtualisation */}
      {layers.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-white/60" />
              <span className="text-white/60 text-sm">Calques ({layers.length}/{maxLayers})</span>
            </div>
            {enableCollaboration && (
              <div className="text-white/40 text-xs flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Synchro en direct
              </div>
            )}
          </div>
          <LayerList 
            layers={layers}
            selectedId={selectedLayerId}
            onSelect={(id) => onLayerSelect?.(id)}
            onRemove={handleRemoveLayer}
            maxHeight={Math.min(300, layers.length * 70)}
          />
        </div>
      )}
      {/* Compteur */}
      <div className="text-white/40 text-xs">
        {filteredStickers.length} stickers disponibles
      </div>
      
      {/* Grille de stickers avec virtualisation pour gros volumes */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
          {filteredStickers.slice(0, 100).map(sticker => (
            <StickerItem 
              key={`${sticker.category}_${sticker.id}`}
              sticker={sticker}
              onClick={handleStickerClick}
              size="md"
            />
          ))}
          {filteredStickers.length > 100 && (
            <div className="col-span-4 text-center text-white/40 text-sm py-4">
              + {filteredStickers.length - 100} stickers supplémentaires
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredStickers.slice(0, 100).map(sticker => (
            <button
              key={`${sticker.category}_${sticker.id}`}
              onClick={() => handleStickerClick(sticker)}
              className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-3 transition-all active:scale-98"
            >
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                {sticker.url ? (
                  <img src={sticker.thumbnail || sticker.url} alt={sticker.name} className="w-8 h-8 object-contain" loading="lazy" />
                ) : (
                  <span className="text-2xl">{sticker.emoji}</span>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium">{sticker.name}</div>
                <div className="text-white/40 text-xs">
                  {sticker.tags?.slice(0, 3).join(' • ')}
                </div>
              </div>
              <Plus className="w-4 h-4 text-white/40" />
            </button>
          ))}
          {filteredStickers.length > 100 && (
            <div className="text-center text-white/40 text-sm py-4">
              + {filteredStickers.length - 100} stickers supplémentaires
            </div>
          )}
        </div>
      )}
      
      {/* Modal avec Portal */}
      {createPortal(modalContent, document.body)}
      
      {/* Footer avec instructions tactiles */}
      <div className="pt-4 border-t border-white/10">
        <p className="text-white/40 text-xs text-center">
          {category === 'animated' 
            ? '✨ Stickers animés • Glissez pour positionner • Pincez pour zoomer'
            : '🎨 Glissez pour positionner • Pincez pour zoomer • Double-cliquez pour réinitialiser'}
        </p>
        <p className="text-white/30 text-xs text-center mt-1">
          Support tactile complet • Optimisé pour mobile
        </p>
      </div>
    </div>
  );
};

const StickerPicker = StickerLibrary;
export default StickerPicker;
LayerList.propTypes = {
  layers: PropTypes.array.isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSelect: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  maxHeight: PropTypes.any,
};
StickerLibrary.propTypes = {
  onAddSticker: PropTypes.func.isRequired,
  initialLayers: PropTypes.any,
  selectedLayerId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onLayerSelect: PropTypes.func.isRequired,
  onLayersChange: PropTypes.func.isRequired,
  maxLayers: PropTypes.any,
  enableCollaboration: PropTypes.bool,
};
