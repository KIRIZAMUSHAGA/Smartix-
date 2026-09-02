import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import { X, RotateCcw, Zap, Loader2, Save, Clock, Image as ImageIcon, Sparkles, Undo2, Redo2, Move } from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const MAX_CHARS = 500;
const STORAGE_PREFIX = 'text_story_drafts';
const DRAFT_VERSION = 2;
const DRAFT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 heures
const AUTO_SAVE_DELAY = 3000; // 3 secondes
const DEBOUNCE_DELAY = 100;
const MAX_HISTORY = 50;

// =============================
// TYPES
// =============================

// =============================
// VALIDATION
// =============================
const isValidHexColor = (color) => {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};

const isValidGradientAngle = (angle) => {
  return angle >= 0 && angle <= 360;
};

const sanitizeText = (text) => {
  return text.replace(/[<>]/g, ''); // Protection XSS basique
};

// =============================
// HOOK DE DEBOUNCE
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
// HOOK DE CHARGEMENT GOOGLE FONTS
// =============================
const useGoogleFont = (fontFamily) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const googleFonts = ['Poppins', 'Roboto', 'Playfair Display', 'Montserrat', 'Dancing Script'];
    if (!googleFonts.includes(fontFamily)) {
      setLoaded(true);
      return;
    }

    const fontName = fontFamily.replace(' ', '+');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
    link.rel = 'stylesheet';
    link.onload = () => setLoaded(true);
    link.onerror = () => {
      setError(true);
      setLoaded(true);
    };
    document.head.appendChild(link);

    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [fontFamily]);

  return { loaded, error };
};

// =============================
// HOOK D'HISTOIRE (UNDO/REDO)
// =============================
const useHistory = (initialState) => {
  const [history, setHistory] = useState({
    past: [],
    present: initialState,
    future: []
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const pushState = useCallback((newState) => {
    setHistory(prev => ({
      past: [...prev.past, prev.present].slice(-MAX_HISTORY),
      present: newState,
      future: []
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const reset = useCallback((newState) => {
    setHistory({
      past: [],
      present: newState,
      future: []
    });
  }, []);

  return { state: history.present, pushState, undo, redo, reset, canUndo, canRedo };
};

// =============================
// HOOK DE SAUVEGARDE AUTO (MULTI-USER)
// =============================
const useAutoSave = (userId, state) => {
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const timeoutRef = useRef(null);
  const lastSavedStateRef = useRef('');

  const storageKey = userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX;

  // Créer une version string de l'état pour comparaison (optimisé)
  const stateKey = useMemo(() => JSON.stringify({
    text: state.text,
    fontSize: state.fontSize,
    fontFamily: state.fontFamily,
    textColor: state.textColor,
    bgColor: state.bgColor,
    useGradient: state.useGradient,
    gradientColor2: state.gradientColor2,
    gradientAngle: state.gradientAngle,
    textAlign: state.textAlign,
    textShadow: state.textShadow,
    textOutline: state.textOutline,
    textGlow: state.textGlow,
    textPosition: state.textPosition
  }), [state.text, state.fontSize, state.fontFamily, state.textColor, state.bgColor,
      state.useGradient, state.gradientColor2, state.gradientAngle, state.textAlign,
      state.textShadow, state.textOutline, state.textGlow, state.textPosition]);

  useEffect(() => {
    if (!state.text) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (stateKey === lastSavedStateRef.current) return;

      try {
        const saveData = {
          version: DRAFT_VERSION,
          data: state,
          timestamp: Date.now()
        };

        localStorage.setItem(storageKey, JSON.stringify(saveData));
        lastSavedStateRef.current = stateKey;
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          toast.error('Stockage plein, impossible de sauvegarder');
          // Nettoyer les anciens brouillons
          localStorage.removeItem(storageKey);
        } else {
          console.error('Auto-save error:', error);
        }
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [stateKey, storageKey]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { version, data, timestamp } = JSON.parse(saved);
        if (version === DRAFT_VERSION && (Date.now() - timestamp) < DRAFT_MAX_AGE) {
          setHasUnsavedChanges(true);
          return data;
        }
      }
    } catch (error) {
      console.error('Load draft error:', error);
      localStorage.removeItem(storageKey);
    }
    return null;
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasUnsavedChanges(false);
    lastSavedStateRef.current = '';
  }, [storageKey]);

  return { lastSaved, hasUnsavedChanges, loadDraft, clearDraft };
};

// =============================
// FONTS
// =============================
const FONTS = [
  { name: 'Arial', value: 'Arial', category: 'sans-serif', googleFont: false },
  { name: 'Georgia', value: 'Georgia', category: 'serif', googleFont: false },
  { name: 'Times New Roman', value: 'Times New Roman', category: 'serif', googleFont: false },
  { name: 'Courier New', value: 'Courier New', category: 'monospace', googleFont: false },
  { name: 'Verdana', value: 'Verdana', category: 'sans-serif', googleFont: false },
  { name: 'Poppins', value: 'Poppins', category: 'sans-serif', googleFont: true },
  { name: 'Roboto', value: 'Roboto', category: 'sans-serif', googleFont: true },
  { name: 'Playfair Display', value: 'Playfair Display', category: 'serif', googleFont: true },
  { name: 'Montserrat', value: 'Montserrat', category: 'sans-serif', googleFont: true },
  { name: 'Dancing Script', value: 'Dancing Script', category: 'cursive', googleFont: true }
];

const FONT_SIZES = [16, 20, 24, 28, 32, 36, 40, 48];

// =============================
// TEMPLATES
// =============================
const TEMPLATES = [
  { name: 'Moderne', text: 'Votre texte ici', fontSize: 32, fontFamily: 'Arial', textColor: '#ffffff', bgColor: '#000000', useGradient: false, textAlign: 'center', textShadow: 'none', textOutline: false, textGlow: false, gradientAngle: 135, textPosition },
  { name: 'Neon', text: 'Brille', fontSize: 36, fontFamily: 'Georgia', textColor: '#00FF00', bgColor: '#000000', useGradient: false, textAlign: 'center', textShadow: '0 0 20px #00FF00', textOutline: false, textGlow: true, gradientAngle: 135, textPosition },
  { name: 'Gradient', text: 'Coloré', fontSize: 28, fontFamily: 'Verdana', textColor: '#FFFFFF', bgColor: '#0066FF', useGradient: true, gradientColor2: '#FF00FF', textAlign: 'center', textShadow: '0 4px 8px rgba(0,0,0,0.5)', textOutline: false, textGlow: false, gradientAngle: 45, textPosition },
  { name: 'Premium', text: 'Élégant', fontSize: 30, fontFamily: 'Georgia', textColor: '#FFD700', bgColor: '#1a1a1a', useGradient: false, textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.8)', textOutline: true, textGlow: false, gradientAngle: 135, textPosition }
];

// =============================
// OPTIONS D'OMBRE
// =============================
const SHADOW_OPTIONS = [
  { name: 'Aucun', value: 'none' },
  { name: 'Léger', value: '0 2px 4px rgba(0,0,0,0.5)' },
  { name: 'Moyen', value: '0 4px 8px rgba(0,0,0,0.7)' },
  { name: 'Lourd', value: '0 8px 16px rgba(0,0,0,0.9)' },
  { name: 'Neon vert', value: '0 0 20px rgba(0, 255, 0, 0.8)' },
  { name: 'Neon bleu', value: '0 0 20px rgba(0, 100, 255, 0.8)' },
  { name: 'Neon rose', value: '0 0 20px rgba(255, 0, 255, 0.8)' }
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const TextStoryEditor = ({ onPublish, onClose }) => {
  const { user } = useAuth();
  const { client } = useApiClient();

  // État initial
  const initialState = {
    text: '',
    fontSize: 24,
    fontFamily: 'Arial',
    textColor: '#ffffff',
    bgColor: '#000000',
    useGradient: false,
    gradientColor2: '#6B21A8',
    gradientAngle: 135,
    textAlign: 'center',
    textShadow: 'none',
    textOutline: false,
    textGlow: false,
    textPosition
  };

  // History (Undo/Redo)
  const { state, pushState, undo, redo, reset, canUndo, canRedo } = useHistory(initialState);

  // États locaux
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Debounce pour les sliders
  const debouncedFontSize = useDebounce(state.fontSize, DEBOUNCE_DELAY);
  const debouncedGradientAngle = useDebounce(state.gradientAngle, DEBOUNCE_DELAY);
  const debouncedTextPosition = useDebounce(state.textPosition, DEBOUNCE_DELAY);

  // Google Fonts
  const { loaded: fontLoaded } = useGoogleFont(state.fontFamily);

  // Auto-save (multi-user)
  const { loadDraft, clearDraft, lastSaved, hasUnsavedChanges } = useAutoSave(user?.id, state);

  // =============================
  // HANDLERS AVEC HISTORIQUE
  // =============================
  const setText = useCallback((newText) => {
    pushState({ ...state, text: sanitizeText(newText) });
  }, [state, pushState]);

  const setFontSize = useCallback((size) => {
    if (size >= 16 && size <= 48) pushState({ ...state, fontSize: size });
  }, [state, pushState]);

  const setFontFamily = useCallback((family) => {
    pushState({ ...state, fontFamily: family });
  }, [state, pushState]);

  const setTextColor = useCallback((color) => {
    if (isValidHexColor(color)) pushState({ ...state, textColor: color });
  }, [state, pushState]);

  const setBgColor = useCallback((color) => {
    if (isValidHexColor(color)) pushState({ ...state, bgColor: color });
  }, [state, pushState]);

  const setUseGradient = useCallback((value) => {
    pushState({ ...state, useGradient: value });
  }, [state, pushState]);

  const setGradientColor2 = useCallback((color) => {
    if (isValidHexColor(color)) pushState({ ...state, gradientColor2: color });
  }, [state, pushState]);

  const setGradientAngle = useCallback((angle) => {
    if (isValidGradientAngle(angle)) pushState({ ...state, gradientAngle: angle });
  }, [state, pushState]);

  const setTextAlign = useCallback((align) => {
    pushState({ ...state, textAlign: align });
  }, [state, pushState]);

  const setTextShadow = useCallback((shadow) => {
    pushState({ ...state, textShadow: shadow });
  }, [state, pushState]);

  const setTextOutline = useCallback((outline) => {
    pushState({ ...state, textOutline: outline });
  }, [state, pushState]);

  const setTextGlow = useCallback((glow) => {
    pushState({ ...state, textGlow: glow });
  }, [state, pushState]);

  const setTextPosition = useCallback((position) => {
    pushState({ ...state, textPosition: position });
  }, [state, pushState]);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      toast.error('Connectez-vous pour créer une story');
      onClose();
    }
  }, [user, onClose]);

  // =============================
  // CHARGER BROUILLON
  // =============================
  useEffect(() => {
    const draft = loadDraft();
    if (draft?.text) {
      if (window.confirm('Un brouillon non publié a été trouvé. Voulez-vous le restaurer ?')) {
        reset(draft);
        toast.success('Brouillon restauré');
      } else {
        clearDraft();
      }
    }
  }, [loadDraft, clearDraft, reset]);

  // =============================
  // LIMITER À MAX_CHARS
  // =============================
  const handleTextChange = (e) => {
    const newText = e.target.value;
    if (newText.length <= MAX_CHARS) {
      setText(newText);
    }
  };

  // =============================
  // CALCULER LA COULEUR DU COMPTEUR
  // =============================
  const charPercentage = (state.text.length / MAX_CHARS) * 100;
  const counterColor = charPercentage > 90 ? '#EF4444' : charPercentage > 75 ? '#F59E0B' : '#10B981';

  // =============================
  // STYLE DE FOND
  // =============================
  const getBackgroundStyle = () => {
    if (state.useGradient) {
      return {
        background: `linear-gradient(${debouncedGradientAngle}deg, ${state.bgColor} 0%, ${state.gradientColor2} 100%)`
      };
    }
    return { backgroundColor: state.bgColor };
  };

  // =============================
  // STYLE DE TEXTE (CORRIGÉ)
  // =============================
  const getTextStyle = () => {
    const styles = {
      fontSize: `${debouncedFontSize}px`,
      fontFamily: state.fontFamily,
      color: state.textColor,
      textAlign: state.textAlign,
      lineHeight: '1.5',
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
      width: '100%',
      cursor: isDraggingText ? 'grabbing' : 'grab',
      userSelect: 'none',
      transition: 'transform 0.1s ease'
    };

    // Ombre
    if (state.textShadow !== 'none') {
      styles.textShadow = state.textShadow;
    } else if (state.textGlow) {
      styles.textShadow = `0 0 15px ${state.textColor}`;
    }

    // Contour
    if (state.textOutline) {
      styles.WebkitTextStroke = `1px ${state.textColor}`;
      styles.textStroke = `1px ${state.textColor}`;
    }

    // Glow via filter
    if (state.textGlow && state.textShadow === 'none') {
      styles.filter = `drop-shadow(0 0 8px ${state.textColor})`;
    }

    return styles;
  };

  // =============================
  // GESTION DU DRAG TEXT
  // =============================
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingText(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingText) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    const newX = Math.min(100, Math.max(0, state.textPosition.x + deltaX / 5));
    const newY = Math.min(100, Math.max(0, state.textPosition.y + deltaY / 5));
    
    setTextPosition({ x: newX, y: newY });
    setDragStart({ x: clientX, y: clientY });
  };

  const handleDragEnd = () => {
    setIsDraggingText(false);
  };

  // =============================
  // PRÉSÉLECTIONS
  // =============================
  const presetBackgrounds = [
    { name: 'Noir', color: '#000000' },
    { name: 'Blanc', color: '#ffffff' },
    { name: 'Bleu', color: '#0066FF' },
    { name: 'Rose', color: '#FF00FF' },
    { name: 'Vert', color: '#00CC00' },
    { name: 'Orange', color: '#FF6600' },
    { name: 'Rouge', color: '#FF0000' },
    { name: 'Violet', color: '#9400D3' },
  ];

  const presetGradients = [
    { name: 'Bleu→Violet', from: '#0066FF', to: '#6B21A8' },
    { name: 'Rose→Orange', from: '#FF00FF', to: '#FF6600' },
    { name: 'Vert→Cyan', from: '#00CC00', to: '#00FFFF' },
    { name: 'Pourpre→Bleu', from: '#9400D3', to: '#0066FF' },
    { name: 'Rouge→Orange', from: '#FF0000', to: '#FF6600' }
  ];

  // =============================
  // APPLIQUER TEMPLATE
  // =============================
  const applyTemplate = (template) => {
    reset({
      ...template,
      text: template.text
    });
    toast.success(`Template "${template.name}" appliqué!`);
  };

  // =============================
  // RÉINITIALISATION (AVEC CONFIRMATION)
  // =============================
  const handleReset = () => {
    if (window.confirm('⚠️ Réinitialiser tous les paramètres ? Les modifications non publiées seront perdues.')) {
      reset(initialState);
      clearDraft();
      toast.info('Paramètres réinitialisés');
    }
  };

  // =============================
  // EXPORT IMAGE (AVEC WRAP DE TEXTE)
  // =============================
  const handleExportImage = async () => {
    setIsExportingImage(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920; // Format 9:16 (story)
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dessiner le fond
      if (state.useGradient) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, state.bgColor);
        gradient.addColorStop(1, state.gradientColor2);
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = state.bgColor;
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

       // Configuration texte
      const fontSize = state.fontSize * 2.5; // Ajustement pour 1080px
      const maxWidth = canvas.width - 100;
      const lineHeight = fontSize * 1.2;
      
      ctx.font = `${fontSize}px ${state.fontFamily}`;
      ctx.fillStyle = state.textColor;
      ctx.textAlign = state.textAlign;
      ctx.textBaseline = 'top';

      // Appliquer effets
      if (state.textShadow !== 'none') {
        const shadowMatch = state.textShadow.match(/(\d+)px (\d+)px (\d+)px/);
        if (shadowMatch) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = parseInt(shadowMatch[3]);
          ctx.shadowOffsetX = parseInt(shadowMatch[1]);
          ctx.shadowOffsetY = parseInt(shadowMatch[2]);
        }
      }
      if (state.textOutline) {
        ctx.strokeStyle = state.textColor;
        ctx.lineWidth = 2;
      }
      if (state.textGlow) {
        ctx.shadowColor = state.textColor;
        ctx.shadowBlur = 20;
      }

      // Wrap du texte
      const words = state.text.split(' ');
      const lines = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Position de départ (pourcentage)
      const startY = (state.textPosition.y / 100) * canvas.height - (lines.length * lineHeight) / 2;
      const startX = (state.textPosition.x / 100) * canvas.width;

      // Dessiner les lignes
      lines.forEach((line, index) => {
        const y = startY + index * lineHeight;
        if (state.textOutline) {
          ctx.strokeText(line, startX, y, maxWidth);
        }
        ctx.fillText(line, startX, y, maxWidth);
      });

      // Télécharger
      const link = document.createElement('a');
      link.download = 'story.png';
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('Image exportée en HD (1080x1920) !');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExportingImage(false);
    }
  };

  // =============================
  // PUBLICATION
  // =============================
  const handlePublish = async () => {
    if (!user) {
      toast.error('Connectez-vous pour publier');
      onClose();
      return;
    }

    if (!state.text.trim()) {
      toast.error('Le texte ne peut pas être vide');
      return;
    }

    if (state.text.length > MAX_CHARS) {
      toast.error(`Maximum ${MAX_CHARS} caractères`);
      return;
    }

    setIsPublishing(true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await client.post('/stories/upload-text/', {
        text: state.text.trim(),
        style: {
          fontSize: state.fontSize,
          fontFamily: state.fontFamily,
          textColor: state.textColor,
          backgroundColor: state.bgColor,
          useGradient: state.useGradient,
          gradientColor2: state.gradientColor2,
          gradientAngle: state.gradientAngle,
          textAlign: state.textAlign,
          textShadow: state.textShadow,
          textOutline: state.textOutline,
          textGlow: state.textGlow,
          textPosition: state.textPosition
        }
      }, { signal: controller.signal });

      clearTimeout(timeoutId);
      clearDraft();
      
      onPublish({
        id: response.data.id,
        storyId: response.data.id,
        text: state.text.trim(),
        style: {
          fontSize: state.fontSize,
          fontFamily: state.fontFamily,
          textColor: state.textColor,
          backgroundColor: state.bgColor,
          useGradient: state.useGradient,
          gradientColor2: state.gradientColor2,
          textAlign: state.textAlign
        }
      });
      
      toast.success('Story publiée ! ✨');
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Erreur publication:', error);
      
      if (error.name === 'AbortError') {
        toast.error('Timeout de connexion');
      } else if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        onClose();
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else if (error.response?.status === 413) {
        toast.error('Texte trop long');
      } else if (!navigator.onLine) {
        toast.error('Pas de connexion internet');
      } else {
        toast.error('Erreur lors de la publication');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // =============================
  // RENDU
  // =============================
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="space-y-3 p-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Créer une Story Texte</h2>
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <Save className="w-3 h-3" />
                  <span>Brouillon</span>
                </div>
              )}
              {lastSaved && (
                <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <Clock className="w-3 h-3" />
                  <span>{lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-30"
                title="Annuler (Ctrl+Z)"
              >
                <Undo2 className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-30"
                title="Rétablir (Ctrl+Y)"
              >
                <Redo2 className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleReset}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Réinitialiser"
              >
                <RotateCcw className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          
          {/* Quick Templates */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                onClick={() => applyTemplate(tmpl)}
                className="px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap bg-gray-100 hover:bg-cyan-100 text-gray-700 transition flex-shrink-0"
              >
                <Zap className="w-3 h-3 inline mr-1" />
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 p-4 lg:p-6 max-h-[90vh] overflow-y-auto">
          {/* Left: Editor */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* Textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Votre texte
                </label>
                <span style={{ color: counterColor }} className="text-xs font-bold">
                  {state.text.length}/{MAX_CHARS}
                </span>
              </div>
              <textarea
                value={state.text}
                onChange={handleTextChange}
                placeholder="Écrivez votre story texte..."
                maxLength={MAX_CHARS}
                className="w-full h-24 md:h-32 p-3 border-2 border-gray-200 rounded-lg focus:border-cyan-500 focus:outline-none resize-none text-gray-900 text-sm md:text-base"
              />
              <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${charPercentage}%`,
                    backgroundColor: counterColor
                  }}
                />
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Police
              </label>
              <select
                value={state.fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-cyan-500 focus:outline-none"
              >
                {FONTS.map(font => (
                  <option key={font.value} value={font.value}>{font.name}</option>
                ))}
              </select>
              {!fontLoaded && state.fontFamily !== 'Arial' && (
                <p className="text-xs text-amber-600 mt-1">Chargement de la police...</p>
              )}
            </div>

   {/* Font Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Taillepx
              </label>
              <input
                type="range"
                min="16"
                max="48"
                step="2"
                value={state.fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {FONT_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition ${
                      state.fontSize === size
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Text Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Couleur du texte
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={state.textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border-2 border-gray-200"
                />
                <span className="text-gray-600 text-sm">{state.textColor}</span>
              </div>
            </div>

            {/* Text Align */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alignement
              </label>
              <div className="flex gap-2">
                {['left', 'center', 'right'].map(align => (
                  <button
                    key={align}
                    onClick={() => setTextAlign(align)}
                    className={`flex-1 px-3 py-2 rounded font-semibold transition ${
                      state.textAlign === align
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {align === 'left' ? '←' : align === 'center' ? '↔' : '→'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Background & Preview */}
          <div className="space-y-4 order-1 lg:order-2">
            {/* Preview avec drag & drop */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Aperçu (9:16 - Story)
                </label>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Move className="w-3 h-3" />
                  <span>Glissez pour déplacer le texte</span>
                </div>
              </div>
              <div
                data-preview-container
                className="w-full aspect-[9/16] rounded-lg flex items-center justify-center p-4 border-2 border-gray-200 overflow-hidden shadow-md transition-all relative"
                style={getBackgroundStyle()}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${debouncedTextPosition.x}%`,
                    top: `${debouncedTextPosition.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxHeight: '80%',
                    cursor: isDraggingText ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onTouchStart={handleDragStart}
                  onTouchMove={handleDragMove}
                  onTouchEnd={handleDragEnd}
                >
                  <p
                    style={getTextStyle()}
                    className="w-full max-h-full overflow-y-auto break-words"
                  >
                    {state.text || 'Votre texte apparaîtra ici...'}
                  </p>
                </div>
              </div>
              
              {/* Export Image Button */}
              <button
                onClick={handleExportImage}
                disabled={isExportingImage || !state.text.trim()}
                className="mt-2 w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExportingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                Exporter en image HD (1080x1920)
              </button>
            </div>

            {/* Background Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fond
              </label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setUseGradient(false)}
                  className={`flex-1 px-3 py-2 rounded font-semibold transition ${
                    !state.useGradient
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Couleur
                </button>
                <button
                  onClick={() => setUseGradient(true)}
                  className={`flex-1 px-3 py-2 rounded font-semibold transition ${
                    state.useGradient
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Gradient
                </button>
              </div>

              {!state.useGradient ? (
                <div className="grid grid-cols-4 gap-2">
                  {presetBackgrounds.map(preset => (
                    <button
                      key={preset.color}
                      onClick={() => setBgColor(preset.color)}
                      className="p-3 rounded-lg border-2 transition"
                      style={{
                        backgroundColor: preset.color,
                        borderColor: state.bgColor === preset.color ? '#0066FF' : '#E5E7EB'
                      }}
                      title={preset.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={state.bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-full h-12 rounded cursor-pointer border-2 border-gray-200"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Angle°</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={state.gradientAngle}
                      onChange={(e) => setGradientAngle(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {presetGradients.map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setBgColor(preset.from);
                          setGradientColor2(preset.to);
                        }}
                        className="p-3 rounded-lg border-2 text-white text-xs font-semibold transition"
                        style={{
                          background: `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`,
                          borderColor: state.bgColor === preset.from ? '#0066FF' : '#E5E7EB'
                        }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Couleur 1</label>
                      <input
                        type="color"
                        value={state.bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-full h-8 rounded cursor-pointer border-2 border-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Couleur 2</label>
                      <input
                        type="color"
                        value={state.gradientColor2}
                        onChange={(e) => setGradientColor2(e.target.value)}
                        className="w-full h-8 rounded cursor-pointer border-2 border-gray-200"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Text Effects */}
            <div className="space-y-3 pt-3 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ombre du texte</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SHADOW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTextShadow(opt.value)}
                      className={`px-2 py-2 rounded text-xs font-semibold transition ${
                        state.textShadow === opt.value
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="outline"
                  checked={state.textOutline}
                  onChange={(e) => setTextOutline(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="outline" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Contour du texte
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="glow"
                  checked={state.textGlow}
                  onChange={(e) => setTextGlow(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="glow" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Lueur (Glow)
                </label>
              </div>
            </div>
          </div>
        </div>

 {/* Footer */}
        <div className="flex gap-2 md:gap-3 p-4 md:p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 transition text-sm md:text-base"
          >
            Annuler
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || !state.text.trim() || state.text.length > MAX_CHARS}
            className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                Publication...
              </>
            ) : (
              'Publier la Story'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

TextStoryEditor.propTypes = {
  onPublish: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default TextStoryEditor;
