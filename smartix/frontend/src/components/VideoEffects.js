import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  Filter, Scissors, Clock, Sparkles, Sliders, RefreshCw,
  Sun, SunDim, Layers, RotateCw, Camera, Eye,
  Activity, Film, Palette, AlertCircle, Check, Loader2
} from 'lucide-react';

import { toast } from 'sonner';
import PropTypes from 'prop-types';

const Brightness = Sun;
const Contrast = SunDim;
const Blur = Layers;

// =============================
// TYPES STRICTS
// =============================

// Effet appliqué structuré

// Types d'effets pour onApplyEffect

// =============================
// CONSTANTES
// =============================

// Liste blanche des filtres CSS sécurisés
const SAFE_FILTER_NAMES = new Set([
  'brightness', 'contrast', 'saturate', 'blur', 'hue-rotate', 
  'sepia', 'grayscale', 'none'
]);

// Validation des shaders
const isValidShader = (shader) => {
  if (!shader || shader === 'none') return true;
  const filterParts = shader.split(' ');
  return filterParts.every(part => {
    const filterName = part.split('(')[0];
    return SAFE_FILTER_NAMES.has(filterName);
  });
};

// Filtres statiques (en prod, viendrait d'une API)
const STATIC_FILTERS = {
  basic: [
    { id: 'normal', name: 'Normal', icon: '🎬', shader: 'none', category: 'basic', description: 'Aucun filtre' },
    { id: 'vintage', name: 'Vintage', icon: '📷', shader: 'sepia(0.5) contrast(1.2)', category: 'retro', description: 'Style vintage' },
    { id: 'bw', name: 'Noir & Blanc', icon: '⚫', shader: 'grayscale(1)', category: 'basic', description: 'Noir et blanc' }
  ],
  color: [
    { id: 'warm', name: 'Chaud', icon: '🔥', shader: 'sepia(0.3) saturate(1.2)', category: 'color', description: 'Teintes chaudes' },
    { id: 'cool', name: 'Froid', icon: '❄️', shader: 'brightness(1.1) saturate(0.9) hue-rotate(30deg)', category: 'color', description: 'Teintes froides' },
    { id: 'neon', name: 'Néon', icon: '💜', shader: 'brightness(1.2) contrast(1.5) saturate(1.5)', category: 'vibrant', description: 'Style néon' }
  ],
  cinematic: [
    { id: 'cinematic', name: 'Cinéma', icon: '🎥', shader: 'contrast(1.1) brightness(0.9) saturate(0.8)', category: 'cinematic', description: 'Look cinématographique' },
    { id: 'teal_orange', name: 'Teal & Orange', icon: '🌊', shader: 'hue-rotate(320deg) saturate(1.2) contrast(1.1)', category: 'cinematic', description: 'Style blockbuster' }
  ],
  creative: [
    { id: 'glitch', name: 'Glitch', icon: '📺', shader: 'contrast(1.2) brightness(1.1) sepia(0.3) hue-rotate(10deg)', category: 'effect', description: 'Effet glitch' },
    { id: 'dreamy', name: 'Rêve', icon: '✨', shader: 'brightness(1.05) contrast(0.9) saturate(0.8) blur(0.5px)', category: 'effect', description: 'Atmosphère onirique' },
    { id: 'vhs', name: 'VHS', icon: '📼', shader: 'contrast(1.1) brightness(0.9) saturate(0.8) sepia(0.2)', category: 'retro', description: 'Style VHS' }
  ]
};

const TRANSITIONS = [
  { id: 'fade', name: 'Fondu', icon: '🌅', duration: 0.5, type: 'fade', description: 'Transition douce' },
  { id: 'slide_left', name: 'Glissement gauche', icon: '⬅️', duration: 0.5, type: 'slide', description: 'Slide vers la gauche' },
  { id: 'zoom', name: 'Zoom', icon: '🔍', duration: 0.5, type: 'zoom', description: 'Zoom progressif' },
  { id: 'flash', name: 'Flash', icon: '⚡', duration: 0.3, type: 'flash', description: 'Flash lumineux' }
];

const SPEEDS = [
  { value: 0.25, label: '0.25x', icon: '🐢', description: 'Ralenti extrême' },
  { value: 0.5, label: '0.5x', icon: '🐢', description: 'Ralenti' },
  { value: 0.75, label: '0.75x', icon: '🚶', description: 'Ralenti léger' },
  { value: 1, label: '1x', icon: '▶️', description: 'Normal' },
  { value: 1.25, label: '1.25x', icon: '🏃', description: 'Accéléré léger' },
  { value: 1.5, label: '1.5x', icon: '🏃', description: 'Accéléré' },
  { value: 2, label: '2x', icon: '⚡', description: 'Accéléré rapide' },
  { value: 3, label: '3x', icon: '🚀', description: 'Time-lapse' }
];

const SPECIAL_EFFECTS = [
  { id: 'shake', name: 'Secousse', icon: '🌊', duration: 0.5, intensity: 5, description: 'Effet de tremblement', type: 'shake' },
  { id: 'pulse', name: 'Pulsation', icon: '❤️', duration: 1, intensity: 1.2, description: 'Pulsation rythmique', type: 'pulse' },
  { id: 'flash', name: 'Flash', icon: '⚡', duration: 0.2, intensity: 1, description: 'Flash lumineux', type: 'flash' }
];

// Tous les filtres (calculé une fois, pas de useMemo inutile)
const ALL_FILTERS = [
  ...STATIC_FILTERS.basic,
  ...STATIC_FILTERS.color,
  ...STATIC_FILTERS.cinematic,
  ...STATIC_FILTERS.creative
];

const MAX_EFFECTS = 5;

// =============================
// HOOK: VIDEO EFFECTS (Logique métier)
// =============================

const useVideoEffects = (
  onApplyEffect,
  onError = null,
  getTimestamp = () => Date.now(),
  maxEffects = MAX_EFFECTS,
  enableEventLogging = false
) => {
  const [activeFilterId, setActiveFilterId] = useState(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState(null);
  const [selectedSpeed, setSelectedSpeed] = useState(1);
  const [selectedEffectId, setSelectedEffectId] = useState(null);
  const [effectDuration, setEffectDuration] = useState(1);
  const [appliedEffects, setAppliedEffects] = useState({});
  const [effectHistory, setEffectHistory] = useState([]);
  const [isApplying, setIsApplying] = useState(false);

  const now = useCallback(() => getTimestamp(), [getTimestamp]);

  const addToHistory = useCallback((payload) => {
    setEffectHistory(prev => [...prev.slice(-49), payload]);
    if (enableEventLogging) {
      console.debug('[VideoEffects]', payload);
    }
  }, [enableEventLogging]);

  const showToast = useCallback((message, type = 'success') => {
    toast.dismiss();
    if (type === 'success') {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, []);

  const applyFilter = useCallback((filter) => {
    if (!isValidShader(filter.shader)) {
      const error = new Error(`Invalid shader: ${filter.shader}`);
      onError?.(error);
      showToast('Filtre invalide', 'error');
      return;
    }

    if (Object.keys(appliedEffects).length >= maxEffects) {
      showToast(`Maximum ${maxEffects} effets atteint`, 'error');
      return;
    }

    setIsApplying(true);
    try {
      setActiveFilterId(filter.id);
      const payload = {
        type: 'filter',
        data
      };
      onApplyEffect(payload);
      addToHistory(payload);
      setAppliedEffects(prev => ({ ...prev, filter: filter.id, customFilter: filter.id === 'custom' ? filter : null }));
      showToast(`Filtre "${filter.name}" appliqué`);
    } catch (err) {
      onError?.(err);
      showToast("Erreur lors de l'application du filtre", 'error');
    } finally {
      setIsApplying(false);
    }
  }, [onApplyEffect, effectDuration, now, onError, showToast, appliedEffects, maxEffects, addToHistory]);

  const applyTransition = useCallback((transition) => {
    if (Object.keys(appliedEffects).length >= maxEffects) {
      showToast(`Maximum ${maxEffects} effets atteint`, 'error');
      return;
    }

    setIsApplying(true);
    try {
      setSelectedTransitionId(transition.id);
      const payload = {
        type: 'transition',
        data
      };
      onApplyEffect(payload);
      addToHistory(payload);
      setAppliedEffects(prev => ({ ...prev, transition: transition.id }));
      showToast(`Transition "${transition.name}" ajoutée`);
    } catch (err) {
      onError?.(err);
      showToast("Erreur lors de l'application de la transition", 'error');
    } finally {
      setIsApplying(false);
    }
  }, [onApplyEffect, now, onError, showToast, appliedEffects, maxEffects, addToHistory]);

  const applySpeed = useCallback((speed) => {
    if (Object.keys(appliedEffects).length >= maxEffects) {
      showToast(`Maximum ${maxEffects} effets atteint`, 'error');
      return;
    }

    setIsApplying(true);
    try {
      setSelectedSpeed(speed.value);
      const payload = {
        type: 'speed',
        data
      };
      onApplyEffect(payload);
      addToHistory(payload);
      setAppliedEffects(prev => ({ ...prev, speed: speed.value }));
      showToast(`Vitesse ${speed.label} appliquée`);
    } catch (err) {
      onError?.(err);
      showToast("Erreur lors de l'application de la vitesse", 'error');
    } finally {
      setIsApplying(false);
    }
  }, [onApplyEffect, effectDuration, now, onError, showToast, appliedEffects, maxEffects, addToHistory]);

  const applySpecialEffect = useCallback((effect) => {
    if (Object.keys(appliedEffects).length >= maxEffects) {
      showToast(`Maximum ${maxEffects} effets atteint`, 'error');
      return;
    }

    setIsApplying(true);
    try {
      setSelectedEffectId(effect.id);
      const payload = {
        type: 'effect',
        data
      };
      onApplyEffect(payload);
      addToHistory(payload);
      setAppliedEffects(prev => ({ ...prev, effect: effect.id }));
      showToast(`Effet "${effect.name}" appliqué`);
    } catch (err) {
      onError?.(err);
      showToast("Erreur lors de l'application de l'effet", 'error');
    } finally {
      setIsApplying(false);
    }
  }, [onApplyEffect, now, onError, showToast, appliedEffects, maxEffects, addToHistory]);

  const resetEffects = useCallback(() => {
    setIsApplying(true);
    try {
      setActiveFilterId(null);
      setSelectedTransitionId(null);
      setSelectedSpeed(1);
      setSelectedEffectId(null);
      setAppliedEffects({});
      
      const payload = { type: 'reset', data };
      onApplyEffect(payload);
      addToHistory(payload);
      showToast('Tous les effets ont été réinitialisés');
    } catch (err) {
      onError?.(err);
      showToast("Erreur lors de la réinitialisation", 'error');
    } finally {
      setIsApplying(false);
    }
  }, [onApplyEffect, now, onError, showToast, addToHistory]);

  const setDuration = useCallback((duration) => {
    if (!isNaN(duration) && duration >= 0.2 && duration <= 3) {
      setEffectDuration(duration);
    }
  }, []);

  const getAppliedEffectsCount = useCallback(() => Object.keys(appliedEffects).length, [appliedEffects]);

  return {
    activeFilterId,
    selectedTransitionId,
    selectedSpeed,
    selectedEffectId,
    effectDuration,
    appliedEffects,
    effectHistory,
    isApplying,
    appliedEffectsCount: getAppliedEffectsCount(),
    applyFilter,
    applyTransition,
    applySpeed,
    applySpecialEffect,
    resetEffects,
    setDuration
  };
};

// =============================
// COMPOSANTS MEMOIZED (Performance)
// =============================

const FilterCard = memo(({ filter, isActive, onClick, disabled = false }) => {
  const handleClick = useCallback(() => {
    if (!disabled) onClick(filter);
  }, [filter, onClick, disabled]);
  
  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onClick(filter);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#005CFF] ${
        isActive
          ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] ring-2 ring-white'
          : 'bg-white/10 hover:bg-white/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={`Appliquer le filtre ${filter.name}`}
      role="button"
      tabIndex={0}
    >
      <span className="text-2xl">{filter.icon}</span>
      <span className="text-white text-xs">{filter.name}</span>
    </button>
  );
});

FilterCard.displayName = 'FilterCard';

const TransitionCard = memo(({ transition, isActive, onClick, disabled = false }) => {
  const handleClick = useCallback(() => {
    if (!disabled) onClick(transition);
  }, [transition, onClick, disabled]);
  
  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onClick(transition);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#005CFF] ${
        isActive
          ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] ring-2 ring-white'
          : 'bg-white/10 hover:bg-white/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={`Appliquer la transition ${transition.name}`}
      role="button"
      tabIndex={0}
    >
      <span className="text-2xl">{transition.icon}</span>
      <span className="text-white text-xs">{transition.name}</span>
      <span className="text-white/40 text-[10px]">{transition.duration}s</span>
    </button>
  );
});

TransitionCard.displayName = 'TransitionCard';

const SpeedCard = memo(({ speed, isActive, onClick, disabled = false }) => {
  const handleClick = useCallback(() => {
    if (!disabled) onClick(speed);
  }, [speed, onClick, disabled]);
  
  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onClick(speed);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#005CFF] ${
        isActive
          ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] ring-2 ring-white'
          : 'bg-white/10 hover:bg-white/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={`Appliquer la vitesse ${speed.label}`}
      role="button"
      tabIndex={0}
    >
      <span className="text-xl">{speed.icon}</span>
      <span className="text-white text-sm font-semibold">{speed.label}</span>
      <span className="text-white/40 text-[10px]">{speed.description}</span>
    </button>
  );
});

SpeedCard.displayName = 'SpeedCard';

const EffectCard = memo(({ effect, isActive, onClick, disabled = false }) => {
  const handleClick = useCallback(() => {
    if (!disabled) onClick(effect);
  }, [effect, onClick, disabled]);
  
  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onClick(effect);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#005CFF] ${
        isActive
          ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] ring-2 ring-white'
          : 'bg-white/10 hover:bg-white/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={`Appliquer l'effet ${effect.name}`}
      role="button"
      tabIndex={0}
    >
      <span className="text-2xl">{effect.icon}</span>
      <span className="text-white text-xs">{effect.name}</span>
      <span className="text-white/40 text-[10px]">{effect.duration}s</span>
    </button>
  );
});

EffectCard.displayName = 'EffectCard';

// =============================
// COMPOSANT FILTRE PERSONNALISÉ (avec validation)
// =============================

const CustomFilterEditor = ({ onApply, disabled = false }) => {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [hue, setHue] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [grayscale, setGrayscale] = useState(0);

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  const generateShader = useCallback(() => {
    const filters = [];
    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
    if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
    if (blur > 0) filters.push(`blur(${blur}px)`);
    if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
    if (sepia > 0) filters.push(`sepia(${sepia}%)`);
    if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);
    return filters.length > 0 ? filters.join(' ') : 'none';
  }, [brightness, contrast, saturation, blur, hue, sepia, grayscale]);

  const applyCustomFilter = () => {
    if (disabled) return;
    const shader = generateShader();
    onApply({
      id: 'custom',
      name: 'Personnalisé',
      icon: '🎨',
      shader,
      category: 'custom',
      description: 'Filtre personnalisé'
    });
  };

  const handleNumberChange = (setter: (value) => void, min, max) => 
    (e) => {
      const rawValue = e.target.value;
      const value = Number(rawValue);
      if (!isNaN(value)) {
        setter(clamp(value, min, max));
      } else if (rawValue === '') {
        setter(min);
      }
    };

  const handleFloatChange = (setter: (value) => void, min, max) => 
    (e) => {
      const rawValue = e.target.value;
      const value = Number(rawValue);
      if (!isNaN(value)) {
        setter(clamp(value, min, max));
      } else if (rawValue === '') {
        setter(min);
      }
    };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-white/60 text-sm flex items-center gap-2">
          <Brightness className="w-4 h-4" />
          Luminosité ({brightness}%)
        </label>
        <input
          type="range"
          min="0"
          max="200"
          value={brightness}
          onChange={handleNumberChange(setBrightness, 0, 200)}
          className="w-full mt-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          disabled={disabled}
        />
      </div>
      
      <div>
        <label className="text-white/60 text-sm flex items-center gap-2">
          <Contrast className="w-4 h-4" />
          Contraste ({contrast}%)
        </label>
        <input
          type="range"
          min="0"
          max="200"
          value={contrast}
          onChange={handleNumberChange(setContrast, 0, 200)}
          className="w-full mt-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          disabled={disabled}
        />
      </div>
      
      <div>
        <label className="text-white/60 text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Saturation ({saturation}%)
        </label>
        <input
          type="range"
          min="0"
          max="200"
          value={saturation}
          onChange={handleNumberChange(setSaturation, 0, 200)}
          className="w-full mt-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          disabled={disabled}
        />
      </div>
      
      <div>
        <label className="text-white/60 text-sm flex items-center gap-2">
          <Blur className="w-4 h-4" />
          Flou ({blur}px)
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={blur}
          onChange={handleFloatChange(setBlur, 0, 10)}
          className="w-full mt-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          disabled={disabled}
        />
      </div>
      
      <div>
        <label className="text-white/60 text-sm flex items-center gap-2">
          <RotateCw className="w-4 h-4" />
          Teinte ({hue}°)
        </label>
        <input
          type="range"
          min="-180"
          max="180"
          value={hue}
          onChange={handleNumberChange(setHue, -180, 180)}
          className="w-full mt-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          disabled={disabled}
        />
      </div>
      
      <div>
        <label className="text-white/60 text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Sépia ({sepia}%)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={sepia}
          onChange={handleNumberChange(setSepia, 0, 100)}
          className="w-full mt-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          disabled={disabled}
        />
      </div>
      
      <div>
        <label className="text-white/60 text-sm flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Noir & Blanc ({grayscale}%)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={grayscale}
          onChange={handleNumberChange(setGrayscale, 0, 100)}
          className="w-full mt-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          disabled={disabled}
        />
      </div>
      
      <button
        onClick={applyCustomFilter}
        disabled={disabled}
        className={`w-full py-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white rounded-lg font-semibold mt-4 transition-all active:scale-98 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        Appliquer le filtre personnalisé
      </button>
    </div>
  );
};
// =============================
// COMPOSANT INDICATEUR D'EFFETS ACTIFS
// =============================

const ActiveEffectsIndicator = memo(({ 
  appliedEffects,
  activeFilterId, 
  selectedTransitionId, 
  selectedSpeed, 
  selectedEffectId,
  effectsCount,
  maxEffects
}) => {
  const hasEffects = effectsCount > 0;
  
  if (!hasEffects) return null;
  
  const getFilterName = () => {
    if (activeFilterId === 'custom') return 'Personnalisé';
    const found = ALL_FILTERS.find(f => f.id === activeFilterId);
    return found?.name;
  };
  
  const getTransitionName = () => {
    const found = TRANSITIONS.find(t => t.id === selectedTransitionId);
    return found?.name;
  };
  
  const getEffectName = () => {
    const found = SPECIAL_EFFECTS.find(e => e.id === selectedEffectId);
    return found?.name;
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm flex items-center gap-2 shadow-lg">
      <Sparkles className="w-4 h-4 text-[#ff6b35]" />
      <span>
        {getFilterName() && `Filtre: ${getFilterName()}`}
        {getTransitionName() && ` • Transition: ${getTransitionName()}`}
        {selectedSpeed !== 1 && ` • Vitesse ${selectedSpeed}x`}
        {getEffectName() && ` • Effet: ${getEffectName()}`}
        {effectsCount >= maxEffects && ` • Limite atteinte (${effectsCount}/${maxEffects})`}
      </span>
    </div>
  );
});

ActiveEffectsIndicator.displayName = 'ActiveEffectsIndicator';

// =============================
// COMPOSANT PRINCIPAL
// =============================

export const VideoEffects = ({ 
  videoRef: _videoRef, // Préfixé avec _ pour indiquer qu'il n'est pas utilisé actuellement
  onApplyEffect, 
  onError,
  getTimestamp = () => Date.now(),
  maxEffects = MAX_EFFECTS,
  enableEventLogging = false
}) => {
  const [activeTab, setActiveTab] = useState('filters');
  
  const {
    activeFilterId,
    selectedTransitionId,
    selectedSpeed,
    selectedEffectId,
    effectDuration,
    appliedEffects,
    isApplying,
    appliedEffectsCount,
    applyFilter,
    applyTransition,
    applySpeed,
    applySpecialEffect,
    resetEffects,
    setDuration
  } = useVideoEffects(onApplyEffect, onError, getTimestamp, maxEffects, enableEventLogging);

  const handleDurationChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setDuration(value);
  }, [setDuration]);

  const isDisabled = isApplying || appliedEffectsCount >= maxEffects;

  return (
    <div className="space-y-6">
      {/* Loading overlay pendant l'application */}
      {isApplying && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 rounded-full p-3">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        </div>
      )}
      
      {/* Tabs - Responsive */}
      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('filters')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'filters' 
              ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtres
        </button>
        <button
          onClick={() => setActiveTab('transitions')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'transitions' 
              ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Scissors className="w-4 h-4" />
          Transitions
        </button>
        <button
          onClick={() => setActiveTab('speed')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'speed' 
              ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          Vitesse
        </button>
        <button
          onClick={() => setActiveTab('effects')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'effects' 
              ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Effets
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'custom' 
              ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Personnalisé
        </button>
        <button
          onClick={resetEffects}
          disabled={isDisabled && appliedEffectsCount === 0}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all whitespace-nowrap flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className="w-4 h-4" />
          Réinitialiser
        </button>
      </div>
      
      {/* Limite d'effets atteinte */}
      {appliedEffectsCount >= maxEffects && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 text-sm">
            Limite de {maxEffects} effets atteinte. Réinitialisez pour ajouter de nouveaux effets.
          </span>
        </div>
      )}
      
      {/* Duration Control */}
      <div className="flex items-center gap-4 px-1">
        <label className="text-white/60 text-sm">Durée de l'effet</label>
        <input
          type="range"
          min="0.2"
          max="3"
          step="0.1"
          value={effectDuration}
          onChange={handleDurationChange}
          disabled={isDisabled}
          className="flex-1 h-2 bg-white/20 rounded-lg cursor-pointer disabled:opacity-50"
        />
        <span className="text-white/60 text-sm w-12">{effectDuration}s</span>
      </div>
      
      {/* Filters Tab */}
      {activeTab === 'filters' && (
        <div className="space-y-6 max-h-96 overflow-y-auto pr-1">
          <div>
            <h3 className="text-white/80 text-sm mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Filtres de base
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {STATIC_FILTERS.basic.map(filter => (
                <FilterCard
                  key={filter.id}
                  filter={filter}
                  isActive={activeFilterId === filter.id}
                  onClick={applyFilter}
                  disabled={isDisabled}
                />
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-white/80 text-sm mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Filtres de couleur
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {STATIC_FILTERS.color.map(filter => (
                <FilterCard
                  key={filter.id}
                  filter={filter}
                  isActive={activeFilterId === filter.id}
                  onClick={applyFilter}
                  disabled={isDisabled}
                />
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-white/80 text-sm mb-3 flex items-center gap-2">
              <Film className="w-4 h-4" />
              Cinématique
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {STATIC_FILTERS.cinematic.map(filter => (
                <FilterCard
                  key={filter.id}
                  filter={filter}
                  isActive={activeFilterId === filter.id}
                  onClick={applyFilter}
                  disabled={isDisabled}
                />
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-white/80 text-sm mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Effets créatifs
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {STATIC_FILTERS.creative.map(filter => (
                <FilterCard
                  key={filter.id}
                  filter={filter}
                  isActive={activeFilterId === filter.id}
                  onClick={applyFilter}
                  disabled={isDisabled}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Transitions Tab */}
      {activeTab === 'transitions' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
          {TRANSITIONS.map(transition => (
            <TransitionCard
              key={transition.id}
              transition={transition}
              isActive={selectedTransitionId === transition.id}
              onClick={applyTransition}
              disabled={isDisabled}
            />
          ))}
        </div>
      )}
      
      {/* Speed Tab */}
      {activeTab === 'speed' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
          {SPEEDS.map(speed => (
            <SpeedCard
              key={speed.value}
              speed={speed}
              isActive={selectedSpeed === speed.value}
              onClick={applySpeed}
              disabled={isDisabled}
            />
          ))}
        </div>
      )}
      
      {/* Special Effects Tab */}
      {activeTab === 'effects' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
          {SPECIAL_EFFECTS.map(effect => (
            <EffectCard
              key={effect.id}
              effect={effect}
              isActive={selectedEffectId === effect.id}
              onClick={applySpecialEffect}
              disabled={isDisabled}
            />
          ))}
        </div>
      )}
      
      {/* Custom Filter Tab */}
      {activeTab === 'custom' && (
        <div className="max-h-96 overflow-y-auto pr-1">
          <CustomFilterEditor onApply={applyFilter} disabled={isDisabled} />
        </div>
      )}
      
      {/* Active Effects Indicator */}
      <ActiveEffectsIndicator
        appliedEffects={appliedEffects}
        activeFilterId={activeFilterId}
        selectedTransitionId={selectedTransitionId}
        selectedSpeed={selectedSpeed}
        selectedEffectId={selectedEffectId}
        effectsCount={appliedEffectsCount}
        maxEffects={maxEffects}
      />
      
      {/* Footer Tips */}
      <div className="pt-4 border-t border-white/10">
        <div className="text-white/40 text-xs text-center space-y-1">
          <p>💡 Astuce: Cliquez sur "Personnalisé" pour créer vos propres filtres</p>
          <p>🎬 Les transitions sont automatiquement ajoutées entre les clips</p>
          <p>⚡ La vitesse affecte la lecture et l'export final</p>
          <p className="text-white/30">📊 Limite/{maxEffects} effets actifs</p>
        </div>
      </div>
    </div>
  );
};

VideoEffects.propTypes = {
  videoRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  _videoRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  Pr: PropTypes.any.isRequired,
  fix: PropTypes.any.isRequired,
  avec: PropTypes.any.isRequired,
  pour: PropTypes.any.isRequired,
  indiquer: PropTypes.any.isRequired,
  qu: PropTypes.any.isRequired,
  il: PropTypes.any.isRequired,
  est: PropTypes.any.isRequired,
  pas: PropTypes.any.isRequired,
  utilis: PropTypes.any.isRequired,
  actuellement: PropTypes.any.isRequired,
  onApplyEffect: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  getTimestamp: PropTypes.any,
  maxEffects: PropTypes.any,
  enableEventLogging: PropTypes.bool,
};

export default VideoEffects;
CustomFilterEditor.propTypes = {
  onApply: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
