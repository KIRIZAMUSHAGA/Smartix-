import React, { useState, useCallback, useMemo, memo, useEffect, useRef, useDeferredValue } from 'react';
import { 
  Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
  Palette, Sparkles, X, Eye, EyeOff, Copy, Download, Trash2, Move,
  ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon,
  Layers, Plus, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import isEqual from 'fast-deep-equal';
import PropTypes from 'prop-types';

// =============================
// TYPES STRICTS (Système complet)
// =============================






// =============================
// CONSTANTES
// =============================
const FONT_FAMILIES = [
  { value: 'Poppins', label: 'Poppins', category: 'Moderne' },
  { value: 'Montserrat', label: 'Montserrat', category: 'Moderne' },
  { value: 'Roboto', label: 'Roboto', category: 'Moderne' },
  { value: 'Open Sans', label: 'Open Sans', category: 'Moderne' },
  { value: 'Playfair Display', label: 'Playfair', category: 'Serif' },
  { value: 'Impact', label: 'Impact', category: 'Bold' },
  { value: 'Bebas Neue', label: 'Bebas Neue', category: 'Bold' }
];

const ANIMATIONS = [
  { type: 'none', name: 'Aucune', duration: 0 },
  { type: 'fadeIn', name: 'Apparition', duration: 0.5, easing: 'ease-out' },
  { type: 'slideUp', name: 'Glissement haut', duration: 0.5, easing: 'ease-out' },
  { type: 'slideDown', name: 'Glissement bas', duration: 0.5, easing: 'ease-out' },
  { type: 'bounce', name: 'Rebond', duration: 0.8, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
  { type: 'zoomIn', name: 'Zoom avant', duration: 0.5, easing: 'ease-out' },
  { type: 'pulse', name: 'Pulsation', duration: 0.8, iterations: 2, direction: 'alternate' }
];

const GRADIENTS = [
  { id: 'none', name: 'Aucun', value: null },
  { id: 'sunset', name: 'Coucher de soleil', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'ocean', name: 'Océan', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'forest', name: 'Forêt', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'purple', name: 'Pourpre', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
];

const TEXT_PRESETS = [
  { id: 'mrbeast', name: 'MrBeast', style: { fontFamily: 'Impact', color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, fontSize: 48 } },
  { id: 'neon', name: 'Néon', style: { fontFamily: 'Poppins', color: '#00FF00', strokeWidth: 0, shadow: true, shadowBlur: 15, fontSize: 40 } },
  { id: 'cinematic', name: 'Cinéma', style: { fontFamily: 'Playfair Display', color: '#F5F5F5', fontSize: 36, letterSpacing: 2 } }
];

// =============================
// UTILITAIRES
// =============================
const STORAGE_PREFIX = 'smarteditor';
const CURRENT_VERSION = 2;


const saveToStorage = (key, data) => {
  const stored = {
    version: CURRENT_VERSION,
    timestamp: Date.now(),
    data
  };
  localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(stored));
};

const loadFromStorage = (key) => {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
  if (!raw) return null;
  
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version === CURRENT_VERSION) {
      return parsed.data;
    }
    // Migration future ici
    return null;
  } catch {
    return null;
  }
};

// =============================
// HOOK: DEBOUNCE POUR SLIDERS
// =============================
const useDebouncedCallback = (
  callback,
  delay
) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// =============================
// HOOK: FONT LOADER
// =============================
const useFontLoader = (fontFamily) => {
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    if (!fontFamily) return;
    
    const checkFont = async () => {
      if ('fonts' in document) {
        try {
          await document.fonts.load(`1em ${fontFamily}`);
          setLoaded(true);
        } catch {
          setLoaded(false);
        }
      } else {
        setLoaded(true); // Fallback
      }
    };
    
    checkFont();
  }, [fontFamily]);
  
  return loaded;
};

// =============================
// COMPOSANT D'APERÇU AVEC ANIMATIONS AVANCÉES
// =============================

const AnimatedPreview = memo(({ 
  text, 
  style, 
  animation, 
  position,
  onLayerSelect,
  isSelected = false,
  layerId
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const elementRef = useRef(null);
  const fontLoaded = useFontLoader(style.fontFamily);
  
  // Animation avancée avec keyframes et easing
  const animationStyle = useMemo(() => {
    if (!isAnimating || animation.type === 'none') return {};
    
    let animationString = `${animation.type} ${animation.duration}s`;
    if (animation.easing) animationString += ` ${animation.easing}`;
    if (animation.iterations) animationString += ` ${animation.iterations}`;
    if (animation.direction) animationString += ` ${animation.direction}`;
    if (animation.delay) animationString += ` ${animation.delay}s`;
    
    return { animation: animationString };
  }, [animation, isAnimating]);
  
  // Transform avec GPU acceleration
  const transformStyle = useMemo(() => {
    const translateX = position.x - 50;
    const translateY = position.y - 50;
    return `translate(${translateX}%, ${translateY}%) rotate(${style.rotation}deg)`;
  }, [position.x, position.y, style.rotation]);
  
  const textStyle = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    color: style.gradient ? undefined : style.color,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    textAlign: style.textAlign,
    textShadow: style.strokeWidth > 0 && !style.gradient ? 
      `${style.strokeWidth}px ${style.strokeWidth}px ${style.strokeWidth}px ${style.strokeColor}` : 
      style.shadow && !style.gradient ? `0 0 ${style.shadowBlur}px ${style.color}` : 'none',
    opacity: style.opacity,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : 'normal',
    background: style.gradient || 'none',
    WebkitBackgroundClip: style.gradient ? 'text' : 'unset',
    WebkitTextFillColor: style.gradient ? 'transparent' : 'unset',
    transform: transformStyle,
    willChange: 'transform, opacity',
    display: 'inline-block',
    cursor: onLayerSelect ? 'pointer' : 'default',
    outline: isSelected ? '2px solid #005CFF' : 'none',
    outlineOffset: '2px',
    ...animationStyle
  };
  
  const handleClick = useCallback(() => {
    if (onLayerSelect && layerId) {
      onLayerSelect(layerId);
    } else {
      setIsAnimating(true);
    }
  }, [onLayerSelect, layerId]);
  
  const handleAnimationEnd = useCallback(() => {
    setIsAnimating(false);
  }, []);
  
  // Réinitialisation sélective
  const prevTextRef = useRef(text);
  const prevAnimRef = useRef(animation.type);
  
  useEffect(() => {
    if (prevTextRef.current !== text || prevAnimRef.current !== animation.type) {
      setIsAnimating(true);
      prevTextRef.current = text;
      prevAnimRef.current = animation.type;
    }
  }, [text, animation.type]);
  
  if (!fontLoaded) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl p-8" style={{ minHeight: '200px' }}>
        <div className="animate-pulse text-white/40">Chargement de la police...</div>
      </div>
    );
  }
  
  return (
    <div 
      className={`relative bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden transition-all ${isSelected ? 'ring-2 ring-[#005CFF]' : ''}`}
      style={{ minHeight: '200px' }}
      onClick={handleClick}
    >
      {onLayerSelect && (
        <div className="absolute top-2 left-2 z-20">
          <div className="text-white/40 text-xs bg-black/50 px-2 py-1 rounded-full flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Layer {position.zIndex}
          </div>
        </div>
      )}
      
      <div className="absolute top-2 right-2 z-20">
        <div className="text-white/40 text-xs bg-black/50 px-2 py-1 rounded-full">
          {isAnimating ? 'Animation...' : 'Cliquez pour rejouer'}
        </div>
      </div>
      
      <div className="absolute bottom-2 right-2 z-20">
        <div className="text-white/40 text-xs bg-black/50 px-2 py-1 rounded-full">
          X:{position.x}% Y:{position.y}%
        </div>
      </div>
      
      <div className="flex items-center justify-center p-8" style={{ minHeight: '200px' }}>
        <div 
          ref={elementRef}
          className="max-w-full break-words"
          style={textStyle}
          onAnimationEnd={handleAnimationEnd}
        >
          {text || "Aperçu du texte"}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.text === next.text &&
         prev.animation.type === next.animation.type &&
         prev.animation.duration === next.animation.duration &&
         prev.position.x === next.position.x &&
         prev.position.y === next.position.y &&
         prev.position.zIndex === next.position.zIndex &&
         prev.isSelected === next.isSelected &&
         isEqual(prev.style, next.style);
});

AnimatedPreview.displayName = 'AnimatedPreview';

// =============================
// COMPOSANT POSITION CONTROL (Avec debounce)
// =============================
const PositionControl = ({ 
  position, 
  onChange 
}) => {
  const [localPosition, setLocalPosition] = useState(position);
  const deferredPosition = useDeferredValue(localPosition);
  
  // Debounce pour les sliders
  const debouncedXChange = useDebouncedCallback((x) => {
    onChange({ ...position, x });
  }, 16);
  
  const debouncedYChange = useDebouncedCallback((y) => {
    onChange({ ...position, y });
  }, 16);
  
  const handleXChange = useCallback((e) => {
    const x = parseInt(e.target.value);
    setLocalPosition(prev => ({ ...prev, x }));
    debouncedXChange(x);
  }, [debouncedXChange]);
  
  const handleYChange = useCallback((e) => {
    const y = parseInt(e.target.value);
    setLocalPosition(prev => ({ ...prev, y }));
    debouncedYChange(y);
  }, [debouncedYChange]);
  
  // Synchroniser quand la prop change
  useEffect(() => {
    setLocalPosition(position);
  }, [position]);
  
  const incrementX = useCallback(() => {
    const newX = Math.min(100, position.x + 5);
    onChange({ ...position, x: newX });
  }, [position, onChange]);
  
  const decrementX = useCallback(() => {
    const newX = Math.max(0, position.x - 5);
    onChange({ ...position, x: newX });
  }, [position, onChange]);
  
  const incrementY = useCallback(() => {
    const newY = Math.min(100, position.y + 5);
    onChange({ ...position, y: newY });
  }, [position, onChange]);
  
  const decrementY = useCallback(() => {
    const newY = Math.max(0, position.y - 5);
    onChange({ ...position, y: newY });
  }, [position, onChange]);
  
  return (
    <div className="space-y-3">
      <label className="text-white/60 text-sm flex items-center gap-2">
        <Move className="w-4 h-4" />
        Position du texte
      </label>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/40 text-xs">Position X</span>
            <div className="flex gap-1">
              <button onClick={decrementX} className="p-1 bg-white/10 rounded hover:bg-white/20">
                <ArrowLeftIcon className="w-3 h-3 text-white" />
              </button>
              <button onClick={incrementX} className="p-1 bg-white/10 rounded hover:bg-white/20">
                <ArrowRightIcon className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={deferredPosition.x}
            onChange={handleXChange}
            className="w-full h-2 bg-white/20 rounded-lg cursor-pointer"
          />
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/40 text-xs">Position Y</span>
            <div className="flex gap-1">
              <button onClick={decrementY} className="p-1 bg-white/10 rounded hover:bg-white/20">
                <ArrowUp className="w-3 h-3 text-white" />
              </button>
              <button onClick={incrementY} className="p-1 bg-white/10 rounded hover:bg-white/20">
                <ArrowDown className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={deferredPosition.y}
            onChange={handleYChange}
            className="w-full h-2 bg-white/20 rounded-lg cursor-pointer"
          />
        </div>
      </div>
      
      <div>
        <label className="text-white/60 text-sm">Ordre d'affichage (Z-index)</label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="range"
            min="0"
            max="10"
            value={position.zIndex}
            onChange={(e) => onChange({ ...position, zIndex: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-white/20 rounded-lg cursor-pointer"
          />
          <span className="text-white/60 text-sm w-12">{position.zIndex}</span>
        </div>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL (Système multi-layers)
// =============================

const DEFAULT_TEXT_STYLE = {
  fontSize: 32,
  fontFamily: 'Poppins',
  color: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 2,
  shadow: false,
  shadowBlur: 10,
  rotation: 0,
  opacity: 1,
  bold: false,
  italic: false,
  underline: false,
  textAlign: 'center',
  letterSpacing: 0,
  gradient: null
};

const AdvancedTextEditor = ({ 
  onAddText, 
  initialText = '', 
  initialStyle = null,
  initialLayers = [],
  selectedLayerId,
  onLayerSelect
}) => {
  // États séparés pour meilleure performance
  const [content, setContent] = useState(initialText);
  const [duration, setDuration] = useState(3);
  const [activeTab, setActiveTab] = useState('presets');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [textStyle, setTextStyle] = useState({
    ...DEFAULT_TEXT_STYLE,
    ...initialStyle
  });
  
  const [animation, setAnimation] = useState({
    type: 'fadeIn',
    duration: 0.5,
    easing: 'ease-out'
  });
  
  const [position, setPosition] = useState({ x: 50, y: 50, zIndex: 0 });
  
  const [layers, setLayers] = useState(initialLayers);
  const [currentLayerId, setCurrentLayerId] = useState(selectedLayerId || null);
  
  // =============================
  // HANDLERS AVEC SETTER FONCTIONNEL
  // =============================
  const applyPreset = useCallback((preset) => {
    setTextStyle(prev => ({ ...prev, ...preset.style }));
    setSelectedPreset(preset.id);
    toast.success(`Style "${preset.name}" appliqué`);
  }, []);
  
  const addToTimeline = useCallback(() => {
    if (!content.trim()) {
      toast.error('Veuillez écrire un texte');
      return;
    }
    
    const newLayer = {
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      style: textStyle,
      animation,
      timing: {
        startTime: 0,
        duration
      },
      position,
      enabled: true
    };
    
    onAddText(newLayer);
    setLayers(prev => [...prev, newLayer]);
    setCurrentLayerId(newLayer.id);
    toast.success('Texte ajouté à la timeline');
  }, [content, textStyle, animation, duration, position, onAddText]);
  
  const resetStyle = useCallback(() => {
    setTextStyle(() => ({ ...DEFAULT_TEXT_STYLE }));
    setPosition(() => ({ x: 50, y: 50, zIndex: 0 }));
    setAnimation(() => ({ type: 'fadeIn', duration: 0.5, easing: 'ease-out' }));
    setSelectedPreset(null);
    toast.info('Style réinitialisé');
  }, []);
  
  const copyStyle = useCallback(() => {
    const styleToCopy = {
      fontFamily: textStyle.fontFamily,
      fontSize: textStyle.fontSize,
      color: textStyle.color,
      strokeColor: textStyle.strokeColor,
      strokeWidth: textStyle.strokeWidth,
      shadow: textStyle.shadow,
      shadowBlur: textStyle.shadowBlur,
      rotation: textStyle.rotation,
      textAlign: textStyle.textAlign,
      letterSpacing: textStyle.letterSpacing,
      gradient: textStyle.gradient
    };
    saveToStorage('style', styleToCopy);
    toast.success('Style copié');
  }, [textStyle]);
  
  const pasteStyle = useCallback(() => {
    const saved = loadFromStorage('style');
    if (saved) {
      setTextStyle(prev => ({ ...prev, ...saved }));
      toast.success('Style collé');
    } else {
      toast.error('Aucun style copié');
    }
  }, []);
  
  const handleLayerSelect = useCallback((layerId) => {
    setCurrentLayerId(layerId);
    if (onLayerSelect) onLayerSelect(layerId);
    
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
      setContent(layer.content);
      setTextStyle(layer.style);
      setAnimation(layer.animation);
      setPosition(layer.position);
      setDuration(layer.timing.duration);
    }
  }, [layers, onLayerSelect]);
  
  // =============================
  // RENDU
  // =============================
  return (
    <div className="space-y-6">
    {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('presets')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'presets' 
              ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Presets
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'custom' 
              ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Type className="w-4 h-4" />
          Personnalisé
        </button>
        {layers.length > 0 && (
          <button
            onClick={() => setActiveTab('layers')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'layers' 
                ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Calques ({layers.length})
          </button>
        )}
      </div>
      
      {/* Preview Animé */}
      <AnimatedPreview 
        text={content} 
        style={textStyle} 
        animation={animation}
        position={position}
        onLayerSelect={onLayerSelect ? handleLayerSelect : undefined}
        isSelected={currentLayerId !== null}
        layerId="preview"
      />
      
      {/* Presets Tab */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {TEXT_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`p-3 rounded-xl transition-all text-left ${
                selectedPreset === preset.id
                  ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF] ring-2 ring-white'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <div 
                className="text-white font-bold mb-1"
                style={{ 
                  fontFamily: preset.style.fontFamily,
                  fontSize: `${Math.min(20, preset.style.fontSize || 32)}px`,
                  background: preset.style.gradient || 'none',
                  WebkitBackgroundClip: preset.style.gradient ? 'text' : 'unset',
                  WebkitTextFillColor: preset.style.gradient ? 'transparent' : 'unset'
                }}
              >
                {preset.name}
              </div>
              <div className="text-white/60 text-xs">
                {preset.style.fontFamily}
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* Layers Tab */}
      {activeTab === 'layers' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {layers.map(layer => (
            <div
              key={layer.id}
              onClick={() => handleLayerSelect(layer.id)}
              className={`p-3 rounded-xl cursor-pointer transition-all ${
                currentLayerId === layer.id
                  ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF]'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-white/60" />
                  <span className="text-white font-medium">
                    {layer.content.slice(0, 30)}{layer.content.length > 30 ? '...' : ''}
                  </span>
                </div>
                <div className="text-white/60 text-xs">
                  Z-index: {layer.position.zIndex}
                </div>
              </div>
              <div className="text-white/40 text-xs mt-1">
                {layer.style.fontFamily} • {layer.style.fontSize}px • {layer.animation.type}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Custom Tab */}
      {activeTab === 'custom' && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
          {/* Texte */}
          <div>
            <label className="block text-white/80 text-sm mb-2">Texte</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Écris ton texte ici..."
              className="w-full px-4 py-3 bg-white/10 rounded-xl text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
              rows={3}
            />
          </div>
          
          {/* Position Control */}
          <PositionControl position={position} onChange={setPosition} />
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <button onClick={copyStyle} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm flex items-center justify-center gap-2">
              <Copy className="w-4 h-4" /> Copier style
            </button>
            <button onClick={pasteStyle} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Coller style
            </button>
            <button onClick={resetStyle} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Reset
            </button>
          </div>
          
          {/* Police */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-sm">Police</label>
              <select
                value={textStyle.fontFamily}
                onChange={(e) => setTextStyle(prev => ({ ...prev, fontFamily: e.target.value }))}
                className="w-full px-3 py-2 bg-white/10 rounded-lg text-white mt-1"
              >
                {FONT_FAMILIES.map(font => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-sm">Taille</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="12"
                  max="120"
                  value={textStyle.fontSize}
                  onChange={(e) => setTextStyle(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-white/60 text-sm w-12">{textStyle.fontSize}px</span>
              </div>
            </div>
          </div>
          
          {/* Style Text */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTextStyle(prev => ({ ...prev, bold: !prev.bold }))} 
              className={`p-2 rounded-lg ${textStyle.bold ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF]' : 'bg-white/10'}`}>
              <Bold className="w-4 h-4 text-white" />
            </button>
            <button onClick={() => setTextStyle(prev => ({ ...prev, italic: !prev.italic }))} 
              className={`p-2 rounded-lg ${textStyle.italic ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF]' : 'bg-white/10'}`}>
              <Italic className="w-4 h-4 text-white" />
            </button>
            <button onClick={() => setTextStyle(prev => ({ ...prev, underline: !prev.underline }))} 
              className={`p-2 rounded-lg ${textStyle.underline ? 'bg-gradient-to-r from-[#005CFF] to-[#44B0FF]' : 'bg-white/10'}`}>
              <Underline className="w-4 h-4 text-white" />
            </button>
            <div className="w-px h-8 bg-white/20 mx-1" />
            <button onClick={() => setTextStyle(prev => ({ ...prev, textAlign: 'left' }))} 
              className={`p-2 rounded-lg ${textStyle.textAlign === 'left' ? 'bg-white/20' : 'bg-white/10'}`}>
              <AlignLeft className="w-4 h-4 text-white" />
            </button>
            <button onClick={() => setTextStyle(prev => ({ ...prev, textAlign: 'center' }))} 
              className={`p-2 rounded-lg ${textStyle.textAlign === 'center' ? 'bg-white/20' : 'bg-white/10'}`}>
              <AlignCenter className="w-4 h-4 text-white" />
            </button>
            <button onClick={() => setTextStyle(prev => ({ ...prev, textAlign: 'right' }))} 
              className={`p-2 rounded-lg ${textStyle.textAlign === 'right' ? 'bg-white/20' : 'bg-white/10'}`}>
              <AlignRight className="w-4 h-4 text-white" />
            </button>
          </div>
          
          {/* Couleurs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-sm">Couleur texte</label>
              <input
                type="color"
                value={textStyle.color}
                onChange={(e) => setTextStyle(prev => ({ ...prev, color: e.target.value }))}
                className="w-full h-10 rounded-lg mt-1"
                disabled={!!textStyle.gradient}
              />
            </div>
            <div>
              <label className="text-white/60 text-sm">Couleur contour</label>
              <input
                type="color"
                value={textStyle.strokeColor}
                onChange={(e) => setTextStyle(prev => ({ ...prev, strokeColor: e.target.value }))}
                className="w-full h-10 rounded-lg mt-1"
                disabled={!!textStyle.gradient}
              />
            </div>
          </div>
          
          {/* Dégradé */}
          <div>
            <label className="text-white/60 text-sm flex items-center gap-2">
              <Palette className="w-4 h-4" /> Dégradé
            </label>
            <select
              value={GRADIENTS.find(g => g.value === textStyle.gradient)?.id || 'none'}
              onChange={(e) => {
                const gradient = GRADIENTS.find(g => g.id === e.target.value);
                setTextStyle(prev => ({ ...prev, gradient: gradient?.value || null }));
              }}
              className="w-full px-3 py-2 bg-white/10 rounded-lg text-white mt-1"
            >
              {GRADIENTS.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          
          {/* Bouton avancé */}
          <button
            onClick={() => setShowAdvanced(prev => !prev)}
            className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 text-sm flex items-center justify-center gap-2"
          >
            {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAdvanced ? 'Masquer avancé' : 'Options avancées'}
          </button>
          
          {/* Options avancées */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-white/5 rounded-xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-sm">Épaisseur contour</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={textStyle.strokeWidth}
                    onChange={(e) => setTextStyle(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                    className="w-full"
                    disabled={!!textStyle.gradient}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={textStyle.shadow}
                      onChange={(e) => setTextStyle(prev => ({ ...prev, shadow: e.target.checked }))}
                      disabled={!!textStyle.gradient}
                    /> Ombre
                  </label>
                  {textStyle.shadow && !textStyle.gradient && (
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={textStyle.shadowBlur}
                      onChange={(e) => setTextStyle(prev => ({ ...prev, shadowBlur: parseInt(e.target.value) }))}
                      className="w-full mt-1"
                    />
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-sm">Rotation</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={textStyle.rotation}
                      onChange={(e) => setTextStyle(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-white/60 text-sm w-12">{textStyle.rotation}°</span>
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm">Espacement lettres</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-2"
                      max="10"
                      step="0.5"
                      value={textStyle.letterSpacing}
                      onChange={(e) => setTextStyle(prev => ({ ...prev, letterSpacing: parseFloat(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-white/60 text-sm w-12">{textStyle.letterSpacing}px</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-sm">Animation</label>
                  <select
                    value={animation.type}
                    onChange={(e) => {
                      const anim = ANIMATIONS.find(a => a.type === e.target.value);
                      if (anim) setAnimation(prev => ({ ...prev, ...anim }));
                    }}
                    className="w-full px-3 py-2 bg-white/10 rounded-lg text-white mt-1"
                  >
                    {ANIMATIONS.map(anim => (
                      <option key={anim.type} value={anim.type}>{anim.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-sm">Durée animation</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="0.2"
                      max="2"
                      step="0.1"
                      value={animation.duration}
                      onChange={(e) => setAnimation(prev => ({ ...prev, duration: parseFloat(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-white/60 text-sm w-12">{animation.duration}s</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-white/60 text-sm">Opacité</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={textStyle.opacity}
                    onChange={(e) => setTextStyle(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="text-white/60 text-sm w-12">{Math.round(textStyle.opacity * 100)}%</span>
                </div>
              </div>
            </div>
          )}
{/* Durée */}
          <div>
            <label className="text-white/60 text-sm">Durée d'affichage (secondes)</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min="0.5"
                max="15"
                step="0.5"
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-white/60 text-sm w-12">{duration}s</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Button */}
      <button
        onClick={addToTimeline}
        disabled={!content.trim()}
        className="w-full py-3 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-lg hover:shadow-[#005CFF]/50 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
      >
        Ajouter à la timeline
      </button>
    </div>
  );
};

AdvancedTextEditor.propTypes = {
  onAddText: PropTypes.func.isRequired,
  initialText: PropTypes.any,
  initialStyle: PropTypes.any,
  initialLayers: PropTypes.any,
  selectedLayerId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onLayerSelect: PropTypes.func.isRequired,
};

export default AdvancedTextEditor;
PositionControl.propTypes = {
  position: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};
