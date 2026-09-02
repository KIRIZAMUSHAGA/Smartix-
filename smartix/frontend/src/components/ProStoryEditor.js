import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useReducer, useMemo } from 'react';
import { 
  ArrowLeft, Share2, Eye, Settings, RotateCcw, RotateCw, Music, Users,
  Sparkles, Palette, Type, Grid3x3, Pen, Zap, Brain, Image, Wand, RotateCw as RotateIcon2, 
  Flip2, Crop, Grid3x3 as Grid, Trash2, X, Copy, Check, Layers, Download, 
  Image as ImageIcon, Star, History, Cloud, Instagram, Facebook, Twitter, 
  Video, Zap as ZapIcon, Scissors, Film, Award, Loader2
} from 'lucide-react';
import { publishStoryFast, estimatePublishTime } from '../utils/storyOptimizer';
import { storyEditorReducer, initialEditorState, storyEditorActions } from '../reducers/storyEditorReducer';
import LayersPanel from './LayersPanel';
import DrawPanel from './DrawPanel';
import TextPanel from './TextPanel';
import PropTypes from 'prop-types';

// Lazy loading optimisé - imports dynamiques uniquement
const StickerLibraryOptimized = lazy(() => import('./StickerLibraryOptimized'));
const MusicLibrary = lazy(() => import('./MusicLibrary'));
const MusicPlayer = lazy(() => import('./MusicPlayer'));
const StoryPreview = lazy(() => import('./StoryPreview'));
const TimelineSync = lazy(() => import('./TimelineSync'));
const PublishProgress = lazy(() => import('./PublishProgress'));
const TemplateLibrary = lazy(() => import('./TemplateLibrary'));
const BulkExport = lazy(() => import('./BulkExport'));
const ImageSearch = lazy(() => import('./ImageSearch'));
const CollaborationPanel = lazy(() => import('./CollaborationPanel'));
const AnimationPanel = lazy(() => import('./AnimationPanel'));

// =============================
// IMAGE CACHE AMÉLIORÉ (LRU + TTL + Nettoyage automatique)
// =============================
class ImageCache {
  static cache = new Map();
  static loading = new Map();
  static maxSize = 50;
  static maxAgeMs = 10 * 60 * 1000; // 10 minutes
  static cleanupInterval= null;

  static initialize() {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000); // Nettoyage toutes les 5 min
    }
  }

  static destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  static cleanup() {
    const now = Date.now();
    // Nettoyage par âge
    for (const [url, { timestamp }] of this.cache) {
      if (now - timestamp > this.maxAgeMs) {
        this.cache.delete(url);
      }
    }
    // Nettoyage LRU si trop d'éléments
    if (this.cache.size > this.maxSize) {
      const sorted = [...this.cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      const toDelete = sorted.slice(0, this.cache.size - this.maxSize);
      toDelete.forEach(([url]) => this.cache.delete(url));
    }
  }

  static async get(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL invalide');
    }

    const now = Date.now();
    const cached = this.cache.get(url);
    if (cached) {
      cached.lastUsed = now;
      return cached.img;
    }
    
    if (this.loading.has(url)) {
      return this.loading.get(url);
    }
    
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout chargement image: ${url}`));
      }, 30000); // 30 secondes timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        this.cache.set(url, { img, timestamp: now, lastUsed: now });
        this.loading.delete(url);
        this.cleanup();
        resolve(img);
      };
      img.onerror = (err) => {
        clearTimeout(timeout);
        this.loading.delete(url);
        reject(new Error(`Erreur chargement image: ${url}`));
      };
      img.src = url;
    });
    
    this.loading.set(url, promise);
    return promise;
  }
  
  static getSync(url) {
    const cached = this.cache.get(url);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.img;
    }
    return null;
  }
  
  static clear() {
    this.cache.clear();
    this.loading.clear();
  }

  static cleanupUnused(usedUrls) {
    for (const [url] of this.cache) {
      if (!usedUrls.has(url)) {
        this.cache.delete(url);
      }
    }
  }
}

// Initialisation du cache
ImageCache.initialize();

// =============================
// AUTO-SAVE AMÉLIORÉ (Avec quota check et versioning)
// =============================
const useAutoSave = (state, key = 'story_autosave', delay = 5000) => {
  const timeoutRef = useRef();
  const lastSavedRef = useRef('');
  const isSavingRef = useRef(false);

  useEffect(() => {
    // Éviter de sauvegarder si déjà en cours
    if (isSavingRef.current) return;
    
    const stateStr = JSON.stringify({
      backgroundImage: state.backgroundImage,
      elements: state.elements,
      activeMusic: state.activeMusic,
      canvasFilters: state.canvasFilters,
      layerOrder: state.layerOrder,
      version: 2
    });
    
    if (stateStr === lastSavedRef.current) return;
    
    timeoutRef.current = setTimeout(async () => {
      try {
        isSavingRef.current = true;
        const autosaveData = {
          ...state,
          timestamp: Date.now(),
          version: 2
        };
        
        const serialized = JSON.stringify(autosaveData);
        
        // Vérifier l'espace localStorage disponible
        if (serialized.length > 4.5 * 1024 * 1024) {
          console.warn('Autosave trop volumineux, compression nécessaire');
          // Compression simple si trop gros
          const compressed = btoa(encodeURIComponent(serialized));
          localStorage.setItem(`${key}_compressed`, compressed);
        } else {
          localStorage.setItem(key, serialized);
        }
        
        lastSavedRef.current = stateStr;
      } catch (err) {
        if ((err).name === 'QuotaExceededError') {
          console.warn('LocalStorage plein, nettoyage anciens autosaves');
          // Nettoyer les anciens autosaves
          const keys = Object.keys(localStorage);
          keys.filter(k => k.includes('autosave')).forEach(k => localStorage.removeItem(k));
        } else {
          console.warn('Autosave failed:', err);
        }
      } finally {
        isSavingRef.current = false;
      }
    }, delay);
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [state, key, delay]);
  
  const loadAutosave = useCallback(() => {
    try {
      let saved = localStorage.getItem(key);
      if (!saved) {
        saved = localStorage.getItem(`${key}_compressed`);
        if (saved) {
          saved = decodeURIComponent(atob(saved));
        }
      }
      
      if (saved) {
        const data = JSON.parse(saved);
        // Validation de la structure
        if (data && typeof data === 'object' && data.version >= 1) {
          // Vérifier l'âge (24h max)
          if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            return data;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load autosave:', err);
    }
    return null;
  }, [key]);
  
  const clearAutosave = useCallback(() => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_compressed`);
  }, [key]);
  
  return { loadAutosave, clearAutosave };
};

// =============================
// SHARE HOOK AMÉLIORÉ
// =============================
const useShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  
  const share = useCallback(async (data) => {
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: data.title || 'Mon Story SmartClips',
          text: data.text || 'Découvrez mon story créé avec SmartClips!',
          url: data.url
        });
        return { success: true };
      } else {
        if (data.url) {
          await navigator.clipboard.writeText(data.url);
          return { fallback: true, message: 'Lien copié dans le presse-papier!' };
        }
        throw new Error('Partage non supporté');
      }
    } catch (err) {
      if ((err).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
      return { success: false, error: err };
    } finally {
      setIsSharing(false);
    }
  }, []);
  
  return { share, isSharing };
};

// =============================
// EXPORT HOOK AVEC WEB WORKER (Simulation améliorée)
// =============================
const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  const exportToPNG = useCallback(async (canvas, filename = 'story.png') => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      // Simuler le progrès de manière plus réaliste
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 30));
        setExportProgress(i);
      }
      
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      setExportProgress(100);
      return { success: true };
    } catch (err) {
      console.error('Export failed:', err);
      return { success: false, error: err };
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    }
  }, []);
  
  const exportToJPEG = useCallback(async (canvas, quality = 0.9, filename = 'story.jpg') => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 30));
        setExportProgress(i);
      }
      
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/jpeg', quality);
      link.click();
      
      setExportProgress(100);
      return { success: true };
    } catch (err) {
      console.error('Export failed:', err);
      return { success: false, error: err };
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    }
  }, []);
  
  const exportToWebP = useCallback(async (canvas, quality = 0.9, filename = 'story.webp') => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 30));
        setExportProgress(i);
      }
      
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/webp', quality);
      link.click();
      
      setExportProgress(100);
      return { success: true };
    } catch (err) {
      console.error('Export failed:', err);
      return { success: false, error: err };
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    }
  }, []);
  
  return { exportToPNG, exportToJPEG, exportToWebP, isExporting, exportProgress };
};

// =============================
// COMPOSANT PRINCIPAL CORRIGÉ
// =============================
const ProStoryEditor = ({ onMediaSave, onClose, initialMedia }) => {
  // Reducer
  const [state, dispatch] = useReducer(storyEditorReducer, initialEditorState);
  
  const {
    elements, selectedElement, backgroundImage, activeCategory, canvasFilters,
    textInput, textColor, fontSize, fontFamily, textCopied,
    isDrawing, drawColor, drawThickness, drawMode,
    cropAspectRatio, cropScale, cropOffsetX, cropOffsetY,
    aiPrompt, aiSuggestions, aiLoading,
    activeMusic, history, historyIndex,
    publishProgress, publishStatus, estimatedTime,
    showSettings, showStickerLibrary, showMusicLibrary,
    layerOrder,
    textBold, textItalic, textShadow, textAlign,
    showLayers, drawShape, shapeStart,
    feedbackMsg, feedbackType,
    mobileTab, cropWarning,
    showPreview, showTimeline, elementTimestamps,
    showTemplateLibrary, showBulkExport, showImageSearch, showCollaboration, showAnimation
  } = state;

  // Refs
  const canvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const backgroundImageCache = useRef(null);
  const elementImageCache = useRef>(new Map());
  const rafRef = useRef();
  const renderScheduledRef = useRef(false);
  const touchDragRef = useRef({
    active: false, elementId: null, startX: 0, startY: 0,
    startElementX: 0, startElementY: 0, touch1: null, touch2: null,
    initialDistance: 0, initialAngle: 0, startScale: 1, startRotation: 0
  });
  const filterTimeoutRef = useRef();
  const mountedRef = useRef(true);

  // Hooks
  const { loadAutosave, clearAutosave } = useAutoSave(state);
  const { share, isSharing } = useShare();
  const { exportToPNG, exportToJPEG, exportToWebP, isExporting, exportProgress } = useExport();

  // Limites de sécurité
  const MAX_ELEMENTS = 100;
  const MAX_HISTORY = 50;

  // Helpers avec validation
  const setElements = useCallback((els) => {
    if (Array.isArray(els) && els.length <= MAX_ELEMENTS) {
      dispatch({ type: storyEditorActions.SET_ELEMENTS, payload: els });
    } else if (els.length > MAX_ELEMENTS) {
      showFeedback(`⚠️ Limite de ${MAX_ELEMENTS} éléments atteinte`, 'error');
      dispatch({ type: storyEditorActions.SET_ELEMENTS, payload: els.slice(0, MAX_ELEMENTS) });
    }
  }, []);

  const setSelectedElement = (el) => dispatch({ type: storyEditorActions.SELECT_ELEMENT, payload: el });
  const setBackgroundImage = (img) => dispatch({ type: storyEditorActions.SET_BACKGROUND_IMAGE, payload: img });
  const setCanvasFilters = (filters) => dispatch({ type: storyEditorActions.SET_CANVAS_FILTERS, payload: filters });
  const setActiveCategory = (cat) => dispatch({ type: storyEditorActions.SET_ACTIVE_CATEGORY, payload: cat });
  const setTextInput = (txt) => dispatch({ type: storyEditorActions.SET_TEXT_INPUT, payload: txt });
  const setTextColor = (color) => dispatch({ type: storyEditorActions.SET_TEXT_COLOR, payload: color });
  const setFontSize = (size) => dispatch({ type: storyEditorActions.SET_FONT_SIZE, payload: size });
  const setFontFamily = (fam) => dispatch({ type: storyEditorActions.SET_FONT_FAMILY, payload: fam });
  const setActiveMusic = (music) => dispatch({ type: storyEditorActions.SET_ACTIVE_MUSIC, payload: music });
  const setShowStickerLibrary = (show) => dispatch({ type: storyEditorActions.SET_SHOW_STICKER_LIBRARY, payload: show });
  const setShowMusicLibrary = (show) => dispatch({ type: storyEditorActions.SET_SHOW_MUSIC_LIBRARY, payload: show });
  const setShowLayers = (show) => dispatch({ type: storyEditorActions.SET_SHOW_LAYERS, payload: show });
  const setFeedbackMsg = (msg) => dispatch({ type: storyEditorActions.SET_FEEDBACK_MSG, payload: msg });
  const setFeedbackType = (type) => dispatch({ type: storyEditorActions.SET_FEEDBACK_TYPE, payload: type });
  const setTextCopied = (copied) => dispatch({ type: storyEditorActions.SET_TEXT_COPIED, payload: copied });
  
  const saveToHistory = useCallback(() => {
    dispatch({ type: storyEditorActions.SAVE_TO_HISTORY });
    // Limiter la taille de l'historique
    setTimeout(() => {
      if (history.length > MAX_HISTORY) {
        const trimmedHistory = history.slice(-MAX_HISTORY);
        dispatch({ type: storyEditorActions.SET_HISTORY, payload: trimmedHistory });
      }
    }, 0);
  }, [history]);

  const handleUndo = () => dispatch({ type: storyEditorActions.UNDO });
  const handleRedo = () => dispatch({ type: storyEditorActions.REDO });

  // Element Map pour O(1) lookup
  const elementMap = useMemo(() => {
    return new Map(elements.map(el => [el.id, el]));
  }, [elements]);

  // Afficher un feedback avec auto-nettoyage
  const showFeedback = useCallback((msg, type = 'info', duration = 2000) => {
    if (!mountedRef.current) return;
    setFeedbackMsg(msg);
    setFeedbackType(type);
    setTimeout(() => {
      if (mountedRef.current) {
        setFeedbackMsg('');
      }
    }, duration);
  }, []);

  // =============================
  // RENDU CANVAS OPTIMISÉ (CORRIGÉ)
  // =============================
  const renderCanvas = useCallback(() => {
    if (!canvasRef.current || !mountedRef.current) return;
    
    // Éviter les rendus multiples
    if (renderScheduledRef.current) return;
    renderScheduledRef.current = true;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      renderScheduledRef.current = false;
      return;
    }
    
    const performRender = async () => {
      try {
        ctx.clearRect(0, 0, 1080, 1920);
        
        // Dessiner l'image de fond
        if (backgroundImage) {
          try {
            let img = backgroundImageCache.current;
            if (!img) {
              img = await ImageCache.get(backgroundImage);
              backgroundImageCache.current = img;
            }
            if (img) {
              ctx.filter = `brightness(${canvasFilters.brightness}%) contrast(${canvasFilters.contrast}%) saturate(${canvasFilters.saturation}%) hue-rotate(${canvasFilters.hue}deg) blur(${canvasFilters.blur}px)`;
              ctx.drawImage(img, 0, 0, 1080, 1920);
              ctx.filter = 'none';
            }
          } catch (err) {
            console.error('Failed to load background image:', err);
            // Fallback: grille de test
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 1080, 1920);
          }
        }
        
        // Dessiner les éléments avec Map O(1)
        for (const elementId of layerOrder) {
          const element = elementMap.get(elementId);
          if (!element || element.opacity === 0) continue;
          
          ctx.globalAlpha = element.opacity / 100;
          
          if (element.type === 'text') {
            ctx.font = `${element.italic ? 'italic' : ''} ${element.bold ? 'bold' : ''} ${element.fontSize || 24}px ${element.fontFamily || 'Arial'}`;
            ctx.fillStyle = element.color || '#FFFFFF';
            ctx.textAlign = element.align || 'center';
            if (element.shadow) {
              ctx.shadowColor = 'rgba(0,0,0,0.8)';
              ctx.shadowBlur = 12;
              ctx.shadowOffsetY = 4;
            }
            ctx.fillText(element.content, element.x, element.y);
            ctx.shadowColor = 'transparent';
          } else if (element.type === 'sticker' || element.type === 'image') {
            try {
              let img = elementImageCache.current.get(element.content);
              if (!img) {
                img = await ImageCache.get(element.content);
                elementImageCache.current.set(element.content, img);
              }
              if (img) {
                ctx.save();
                ctx.translate(element.x, element.y);
                ctx.rotate((element.rotation || 0) * Math.PI / 180);
                ctx.scale(element.scale || 1, element.scale || 1);
                ctx.drawImage(img, -element.width / 2, -element.height / 2, element.width, element.height);
                ctx.restore();
              }
            } catch (err) {
              console.error('Failed to load sticker/image:', err);
            }
          } else if (element.type === 'drawing') {
            try {
              const img = await ImageCache.get(element.image);
              if (img) {
                ctx.drawImage(img, 0, 0, 1080, 1920);
              }
            } catch (err) {
              console.error('Failed to load drawing:', err);
            }
          }
        }
        
        ctx.globalAlpha = 1;
      } catch (err) {
        console.error('Render error:', err);
      } finally {
        renderScheduledRef.current = false;
      }
    };
    
    // Utiliser requestAnimationFrame pour le rendu fluide
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      performRender();
    });
  }, [backgroundImage, canvasFilters, elementMap, layerOrder]);

  // Nettoyage du cache des éléments non utilisés
  useEffect(() => {
    const usedUrls = new Set();
    if (backgroundImage) usedUrls.add(backgroundImage);
    elements.forEach(el => {
      if (el.content && (el.type === 'sticker' || el.type === 'image')) {
        usedUrls.add(el.content);
      }
      if (el.image) usedUrls.add(el.image);
    });
    
    ImageCache.cleanupUnused(usedUrls);
    
    // Nettoyer elementImageCache
    for (const [url] of elementImageCache.current) {
      if (!usedUrls.has(url)) {
        elementImageCache.current.delete(url);
      }
    }
  }, [backgroundImage, elements]);

  // =============================
  // DESSIN (CORRIGÉ AVEC VALIDATION)
  // =============================
  const handleDrawStart = useCallback((clientX, clientY) => {
    if (!drawCanvasRef.current) return;
    const rect = drawCanvasRef.current.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.min(1080, Math.max(0, (clientX - rect.left) * (1080 / rect.width)));
    const y = Math.min(1920, Math.max(0, (clientY - rect.top) * (1920 / rect.height)));
    
    dispatch({ type: storyEditorActions.SET_SHAPE_START, payload: { x, y } });
    const ctx = drawCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    if (drawMode === 'eraser') {
      ctx.clearRect(x - drawThickness, y - drawThickness, drawThickness * 2, drawThickness * 2);
    } else if (drawShape) {
      // Shapes - just mark start position
    } else {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = drawThickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    dispatch({ type: storyEditorActions.SET_IS_DRAWING, payload: true });
  }, [drawMode, drawShape, drawThickness, drawColor]);

  const handleDrawMove = useCallback((clientX, clientY) => {
    if (!state.isDrawing || !drawCanvasRef.current) return;
    const rect = drawCanvasRef.current.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.min(1080, Math.max(0, (clientX - rect.left) * (1080 / rect.width)));
    const y = Math.min(1920, Math.max(0, (clientY - rect.top) * (1920 / rect.height)));
    
    const ctx = drawCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawThickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (drawMode === 'eraser') {
      ctx.clearRect(x - drawThickness, y - drawThickness, drawThickness * 2, drawThickness * 2);
    } else if (drawShape === 'line' && shapeStart) {
      ctx.clearRect(0, 0, 1080, 1920);
      ctx.beginPath();
      ctx.moveTo(shapeStart.x, shapeStart.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (drawShape === 'circle' && shapeStart) {
      ctx.clearRect(0, 0, 1080, 1920);
      const radius = Math.sqrt(Math.pow(x - shapeStart.x, 2) + Math.pow(y - shapeStart.y, 2));
      ctx.beginPath();
      ctx.arc(shapeStart.x, shapeStart.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (drawShape === 'rectangle' && shapeStart) {
      ctx.clearRect(0, 0, 1080, 1920);
      ctx.strokeRect(shapeStart.x, shapeStart.y, x - shapeStart.x, y - shapeStart.y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }, [state.isDrawing, drawMode, drawShape, drawThickness, drawColor, shapeStart]);

  const handleDrawEnd = useCallback(() => {
    if (state.isDrawing && drawCanvasRef.current) {
      try {
        const drawingImage = drawCanvasRef.current.toDataURL();
        if (drawingImage && drawingImage !== 'data:image/png;base64,') {
          if (elements.length >= MAX_ELEMENTS) {
            showFeedback(`⚠️ Limite de ${MAX_ELEMENTS} éléments atteinte`, 'error');
            return;
          }
          setElements([...elements, {
            id: crypto.randomUUID(),
            type: 'drawing',
            image: drawingImage,
            x: 0,
            y: 0,
            width: 1080,
            height: 1920,
            opacity: 100
          }]);
          saveToHistory();
          const ctx = drawCanvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, 1080, 1920);
          showFeedback('✓ Dessin sauvegardé', 'success', 1500);
        }
      } catch (err) {
        console.error('Draw save error:', err);
        showFeedback('❌ Erreur lors de la sauvegarde du dessin', 'error');
      }
    }
    dispatch({ type: storyEditorActions.SET_IS_DRAWING, payload: false });
    dispatch({ type: storyEditorActions.SET_DRAW_MODE, payload: 'pen' });
    dispatch({ type: storyEditorActions.SET_DRAW_SHAPE, payload: null });
  }, [state.isDrawing, elements, setElements, saveToHistory, showFeedback]);

  // =============================
  // FILTRES (DEBOUNCED AVEC SAVE)
  // =============================
  const updateFilters = useCallback((newFilters) => {
    setCanvasFilters(prev => ({ ...prev, ...newFilters }));
    
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => {
      saveToHistory();
    }, 500);
  }, [setCanvasFilters, saveToHistory]);

  // =============================
  // TEXTE (AVEC VALIDATION)
  // =============================
  const handleAddText = useCallback(() => {
    if (!textInput.trim()) {
      showFeedback('⚠️ Entrez du texte', 'error');
      return;
    }
    
    if (elements.length >= MAX_ELEMENTS) {
      showFeedback(`⚠️ Limite de ${MAX_ELEMENTS} éléments atteinte`, 'error');
      return;
    }
    
    const newElement = {
      id: crypto.randomUUID(),
      type: 'text',
      content: textInput,
      x: 540,
      y: 960,
      fontSize: fontSize,
      color: textColor,
      fontFamily: fontFamily,
      bold: textBold,
      italic: textItalic,
      shadow: textShadow,
      align: textAlign,
      opacity: 100,
      rotation: 0,
      scale: 1
    };
    
    setElements([...elements, newElement]);
    saveToHistory();
    setTextInput('');
    dispatch({ type: storyEditorActions.SET_TEXT_BOLD, payload: false });
    dispatch({ type: storyEditorActions.SET_TEXT_ITALIC, payload: false });
    dispatch({ type: storyEditorActions.SET_TEXT_SHADOW, payload: false });
    dispatch({ type: storyEditorActions.SET_TEXT_ALIGN, payload: 'center' });
    showFeedback('✓ Texte ajouté', 'success');
    setActiveCategory(null);
  }, [textInput, elements, fontSize, textColor, fontFamily, textBold, textItalic, textShadow, textAlign, setElements, saveToHistory, showFeedback, setActiveCategory]);

  // =============================
  // PUBLICATION (AVEC VALIDATION)
  // =============================
  const handlePublish = useCallback(async () => {
    try {
      if (!backgroundImage && elements.length === 0) {
        showFeedback('❌ Veuillez ajouter du contenu avant de publier', 'error');
        return;
      }

      const story = {
        id: Date.now(),
        backgroundImage,
        elements,
        music: activeMusic,
        filters: canvasFilters
      };

      const eta = estimatePublishTime(story);
      dispatch({ type: storyEditorActions.SET_ESTIMATED_TIME, payload: eta });
      dispatch({ type: storyEditorActions.SET_PUBLISH_PROGRESS, payload: 0 });
      dispatch({ type: storyEditorActions.SET_PUBLISH_STATUS, payload: 'publishing' });

      const result = await publishStoryFast(story, (progress) => {
        dispatch({ type: storyEditorActions.SET_PUBLISH_PROGRESS, payload: progress });
      });

      dispatch({ type: storyEditorActions.SET_PUBLISH_STATUS, payload: 'success' });
      dispatch({ type: storyEditorActions.SET_PUBLISH_PROGRESS, payload: 100 });

      const fullResult = {
        ...result,
        media: backgroundImage,
        backgroundImage: backgroundImage,
        elements: elements,
        music: activeMusic,
        filters: canvasFilters
      };

      onMediaSave?.(fullResult);
      
      const shareResult = await share({
        title: 'Mon Story SmartClips',
        text: 'Je viens de créer un story avec SmartClips!',
        url: result.url
      });
      
      if (shareResult.fallback) {
        showFeedback(shareResult.message, 'success');
      } else if (shareResult.success) {
        showFeedback('✓ Story publié et partagé!', 'success');
      }
    } catch (error) {
      console.error('Publish error:', error);
      dispatch({ type: storyEditorActions.SET_PUBLISH_STATUS, payload: 'error' });
      dispatch({ type: storyEditorActions.SET_PUBLISH_PROGRESS, payload: 0 });
      showFeedback('❌ Erreur lors de la publication', 'error');
    }
  }, [backgroundImage, elements, activeMusic, canvasFilters, onMediaSave, share, showFeedback]);

  // =============================
  // EFFETS MAGIQUES
  // =============================
  const handleApplyEffect = useCallback((effectName) => {
    const effectMap = {
      'Glow': { blur: 8, brightness: 110 },
      'Neon': { saturation: 150, hue: 45, brightness: 120 },
      'Blur': { blur: 15 },
      'Vintage': { saturation: 70, hue: 30, brightness: 95 },
      'HDR': { contrast: 130, saturation: 120 },
      'Cinéma': { contrast: 125, hue: -15, brightness: 105 },
      'Pixelisation': { brightness: 100, contrast: 120 },
      'Sépia': { brightness: 110, contrast: 100 },
      'Cartoon': { saturate: 180, contrast: 140, brightness: 110 },
      'Monochrome': { saturate: 0, contrast: 120, brightness: 100 }
    };
    const effect = effectMap[effectName];
    if (effect) {
      setCanvasFilters(prev => ({ ...prev, ...effect }));
      saveToHistory();
      showFeedback(`✨ Effet ${effectName} appliqué`, 'success', 1500);
    }
  }, [setCanvasFilters, saveToHistory, showFeedback]);

  // =============================
  // RECADRAGE
  // =============================
  const handleCropApply = useCallback(() => {
    if (!backgroundImage) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = cropAspectRatio === '9:16' ? 9/16 :
                    cropAspectRatio === '1:1' ? 1 :
                    cropAspectRatio === '16:9' ? 16/9 :
                    cropAspectRatio === '4:5' ? 4/5 :
                    cropAspectRatio === '3:4' ? 3/4 : 1;
      
      canvas.width = 1080;
      canvas.height = Math.round(1080 / ratio);
      
      const ctx = canvas.getContext('2d');
      const imgWidth = img.width * cropScale;
      const imgHeight = img.height * cropScale;
      const offsetX = (cropOffsetX / 100) * (imgWidth - canvas.width);
      const offsetY = (cropOffsetY / 100) * (imgHeight - canvas.height);
      
      ctx?.drawImage(img, -offsetX, -offsetY, imgWidth, imgHeight);
      
      setBackgroundImage(canvas.toDataURL());
      setActiveCategory(null);
      showFeedback('✓ Recadrage appliqué', 'success');
    };
    img.src = backgroundImage;
  }, [backgroundImage, cropAspectRatio, cropScale, cropOffsetX, cropOffsetY, setBackgroundImage, setActiveCategory, showFeedback]);

  // =============================
  // GESTION DES ÉLÉMENTS
  // =============================
  const handleDeleteElement = useCallback(() => {
    if (selectedElement) {
      const updated = elements.filter(el => el.id !== selectedElement);
      setElements(updated);
      saveToHistory();
      setSelectedElement(null);
      showFeedback('✓ Élément supprimé', 'success');
    }
  }, [selectedElement, elements, setElements, saveToHistory, showFeedback]);

  const handleReorderElement = useCallback((elementId, direction) => {
    dispatch({ type: storyEditorActions.REORDER_ELEMENTS, payload: { elementId, direction } });
    saveToHistory();
  }, [saveToHistory]);

  const handleToggleVisibility = useCallback((elementId) => {
    const element = elements.find(el => el.id === elementId);
    if (element) {
      dispatch({ 
        type: storyEditorActions.UPDATE_ELEMENT, 
        payload: { id: elementId, updates: { opacity: element.opacity === 0 ? 100 : 0 } } 
      });
    }
  }, [elements]);

  // =============================
  // PARTAGE
  // =============================
  const handleShareViaFriends = useCallback(async () => {
    const storyLink = `${window.location.origin}/story/${Date.now()}`;
    const result = await share({
      title: 'Mon Story SmartClips',
      text: 'Découvrez mon story créé avec SmartClips!',
      url: storyLink
    });
    
    if (result.fallback) {
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    } else if (result.success) {
      showFeedback('✓ Story partagé!', 'success');
    }
  }, [share, showFeedback]);

  // =============================
  // EXPORT
  // =============================
  const handleExport = useCallback(async (format) => {
    if (!canvasRef.current) return;
    
    let result;
    switch (format) {
      case 'png':
        result = await exportToPNG(canvasRef.current);
        break;
      case 'jpeg':
        result = await exportToJPEG(canvasRef.current);
        break;
      case 'webp':
        result = await exportToWebP(canvasRef.current);
        break;
    }
    
    if (result?.success) {
      showFeedback(`✓ Export ${format.toUpperCase()} réussi`, 'success');
    } else {
      showFeedback('❌ Erreur lors de l\'export', 'error');
    }
  }, [exportToPNG, exportToJPEG, exportToWebP, showFeedback]);
           // =============================
  // RACCOURCIS CLAVIER
  // =============================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Delete' && selectedElement) {
        handleDeleteElement();
      }
      if (e.key === 'Escape') {
        setActiveCategory(null);
        setSelectedElement(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, handleDeleteElement]);

  // =============================
  // VALIDATION INITIAL MEDIA
  // =============================
  useEffect(() => {
    if (initialMedia && !backgroundImage) {
      // Validation du type d'initialMedia
      if (typeof initialMedia === 'string' && (initialMedia.startsWith('http') || initialMedia.startsWith('data:'))) {
        setBackgroundImage(initialMedia);
      } else if (initialMedia instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => setBackgroundImage(e.target?.result);
        reader.readAsDataURL(initialMedia);
      } else if (initialMedia && typeof initialMedia === 'object' && initialMedia.url) {
        setBackgroundImage(initialMedia.url);
      }
    }
  }, [initialMedia, backgroundImage, setBackgroundImage]);

  // =============================
  // RENDU INITIAL ET NETTOYAGE
  // =============================
  useEffect(() => {
    mountedRef.current = true;
    renderCanvas();
    
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
      ImageCache.destroy();
    };
  }, [renderCanvas]);

  // =============================
  // TOOLS
  // =============================
  const toolsList = [
    { id: 'music', icon: Music, label: 'Musique', color: 'text-pink-400' },
    { id: 'effects', icon: Sparkles, label: 'Effets', color: 'text-yellow-400' },
    { id: 'filters', icon: Palette, label: 'Filtres', color: 'text-cyan-400' },
    { id: 'text', icon: Type, label: 'Texte', color: 'text-blue-400' },
    { id: 'stickers', icon: Layers, label: 'Stickers', color: 'text-green-400' },
    { id: 'draw', icon: Pen, label: 'Dessin', color: 'text-orange-400' },
    { id: 'crop', icon: Crop, label: 'Recadrer', color: 'text-red-400' },
    { id: 'adjust', icon: Settings, label: 'Ajuster', color: 'text-amber-400' },
    { id: 'templates', icon: Grid, label: 'Templates', color: 'text-purple-400' },
    { id: 'export', icon: Download, label: 'Exporter', color: 'text-emerald-400' },
    { id: 'share', icon: Share2, label: 'Partager', color: 'text-indigo-400' }
  ];

  // Story ID pour collaboration
  const storyId = useMemo(() => crypto.randomUUID(), []);

  // Loading states UI
  const [isImageLoading, setIsImageLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col md:flex-row overflow-hidden">
      {/* Top Bar - Mobile */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/80 backdrop-blur">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex gap-2 items-center">
          <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-50">
            <RotateCcw className="w-5 h-5 text-white" />
          </button>
          <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-50">
            <RotateCw className="w-5 h-5 text-white" />
          </button>
        </div>
        <button onClick={() => dispatch({ type: storyEditorActions.TOGGLE_SETTINGS })} className="p-2 hover:bg-white/10 rounded-lg">
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black" data-canvas-area onClick={() => setActiveCategory(null)}>
        <div className="relative w-full h-full md:w-[60vw] md:h-full">
          {/* Loading indicator */}
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full h-full object-contain cursor-crosshair"
            style={{ touchAction: 'none' }}
            onWheel={(e) => {
              if (!selectedElement) return;
              const selectedEl = elementMap.get(selectedElement);
              if (!selectedEl) return;
              const delta = e.deltaY > 0 ? -2 : 2;
              if (selectedEl.type === 'text') {
                const newFontSize = Math.max(8, Math.min(120, (selectedEl.fontSize || 24) + delta));
                setElements(elements.map(el => el.id === selectedElement ? { ...el, fontSize: newFontSize } : el));
              } else if (selectedEl.type === 'sticker') {
                const newScale = Math.max(0.5, Math.min(3, (selectedEl.scale || 1) + delta / 50));
                setElements(elements.map(el => el.id === selectedElement ? { ...el, scale: newScale } : el));
              }
            }}
            onMouseDown={(e) => { if (drawMode === 'pen' || drawMode === 'eraser' || drawShape) handleDrawStart(e.clientX, e.clientY); }}
            onMouseMove={(e) => { if (state.isDrawing) handleDrawMove(e.clientX, e.clientY); }}
            onMouseUp={() => { if (state.isDrawing) handleDrawEnd(); }}
            onMouseLeave={() => { if (state.isDrawing) handleDrawEnd(); }}
            onTouchStart={(e) => {
              e.preventDefault();
              if ((drawMode === 'pen' || drawMode === 'eraser' || drawShape) && e.touches.length === 1) {
                handleDrawStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              if (state.isDrawing && e.touches.length === 1) {
                handleDrawMove(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchEnd={() => { if (state.isDrawing) handleDrawEnd(); }}
          />
          
          {/* Canvas de dessin superposé */}
          <canvas
            ref={drawCanvasRef}
            width={1080}
            height={1920}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ touchAction: 'none' }}
          />
          
          {/* Éléments interactifs */}
          {elements.map(element => (
            <div
              key={element.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement(element.id);
              }}
              className={`absolute cursor-move transition-all ${
                selectedElement === element.id 
                  ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black/50' 
                  : 'hover:ring-1 hover:ring-white/30'
              }`}
              style={{
                left: `${(element.x / 1080) * 100}%`,
                top: `${(element.y / 1920) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${element.rotation || 0}deg) scale(${element.scale || 1})`,
                opacity: element.opacity / 100,
                touchAction: 'none',
                cursor: 'grab'
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.touches.length === 1) {
                  touchDragRef.current = {
                    active: true,
                    elementId: element.id,
                    startX: e.touches[0].clientX,
                    startY: e.touches[0].clientY,
                    startElementX: element.x,
                    startElementY: element.y,
                    touch1: null,
                    touch2: null,
                    initialDistance: 0,
                    initialAngle: 0,
                    startScale: element.scale || 1,
                    startRotation: element.rotation || 0
                  };
                  setSelectedElement(element.id);
                } else if (e.touches.length === 2) {
                  const t1 = e.touches[0];
                  const t2 = e.touches[1];
                  const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                  const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
                  touchDragRef.current = {
                    active: true,
                    elementId: element.id,
                    touch1: { x: t1.clientX, y: t1.clientY },
                    touch2: { x: t2.clientX, y: t2.clientY },
                    initialDistance: distance,
                    initialAngle: angle,
                    startScale: element.scale || 1,
                    startRotation: element.rotation || 0,
                    startX: 0,
                    startY: 0,
                    startElementX: element.x,
                    startElementY: element.y
                  };
                  setSelectedElement(element.id);
                }
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (!touchDragRef.current.active || touchDragRef.current.elementId !== element.id) return;
                
                const canvasBounds = canvasRef.current?.getBoundingClientRect();
                if (!canvasBounds) return;
                
                if (e.touches.length === 1 && !touchDragRef.current.touch1) {
                  const deltaX = e.touches[0].clientX - touchDragRef.current.startX;
                  const deltaY = e.touches[0].clientY - touchDragRef.current.startY;
                  const scaledDeltaX = (deltaX / canvasBounds.width) * 1080;
                  const scaledDeltaY = (deltaY / canvasBounds.height) * 1920;
                  const newX = Math.max(0, Math.min(1080, touchDragRef.current.startElementX + scaledDeltaX));
                  const newY = Math.max(0, Math.min(1920, touchDragRef.current.startElementY + scaledDeltaY));
                  setElements(elements.map(el => el.id === element.id ? { ...el, x: newX, y: newY } : el));
                } else if (e.touches.length === 2 && touchDragRef.current.touch1) {
                  const t1 = e.touches[0];
                  const t2 = e.touches[1];
                  const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                  const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
                  const scaleFactor = currentDistance / touchDragRef.current.initialDistance;
                  const newScale = Math.max(0.5, Math.min(3, touchDragRef.current.startScale * scaleFactor));
                  const angleDelta = currentAngle - touchDragRef.current.initialAngle;
                  const newRotation = (touchDragRef.current.startRotation + angleDelta) % 360;
                  setElements(elements.map(el => el.id === element.id ? { ...el, scale: newScale, rotation: newRotation } : el));
                }
              }}
              onTouchEnd={() => {
                if (touchDragRef.current.elementId === element.id) {
                  touchDragRef.current = {
                    active: false, elementId: null, startX: 0, startY: 0,
                    startElementX: 0, startElementY: 0, touch1: null, touch2: null,
                    initialDistance: 0, initialAngle: 0, startScale: 1, startRotation: 0
                  };
                  saveToHistory();
                }
              }}
            >
              {element.type === 'text' && (
                <p style={{ 
                  fontSize: `${element.fontSize || 24}px`, 
                  color: element.color || '#FFFFFF',
                  fontFamily: element.fontFamily || 'Arial',
                  fontWeight: element.bold ? 'bold' : 'normal',
                  fontStyle: element.italic ? 'italic' : 'normal',
                  textDecoration: element.underline ? 'underline' : 'none',
                  textAlign: element.align || 'center',
                  textShadow: element.shadow ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
                  whiteSpace: 'nowrap',
                  margin: 0,
                  padding: '0 8px'
                }}>
                  {element.content}
                </p>
              )}
              {element.type === 'sticker' && element.content && (
                <img 
                  src={element.content} 
                  alt="Sticker"
                  style={{ 
                    width: `${element.width || 150}px`, 
                    height: `${element.height || 150}px`,
                    objectFit: 'contain',
                    pointerEvents: 'none'
                  }}
                />
              )}
              {selectedElement === element.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteElement();
                  }}
                  className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition z-10"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Outils côté droit */}
        <div className="absolute right-0 top-0 h-full flex flex-col items-center justify-center gap-2 p-2 md:p-4 bg-black/50 backdrop-blur z-30">
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition bg-white/10" title="Fermer">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <button 
            onClick={() => dispatch({ type: storyEditorActions.TOGGLE_PREVIEW })}
            className={`p-2 rounded-lg transition ${showPreview ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white' : 'hover:bg-white/20 text-white/80 bg-white/10'}`}
            title="Aperçu"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button 
            onClick={handlePublish}
            className="p-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:shadow-lg text-white rounded-lg transition"
            title="Publier"
          >
            <Share2 className="w-5 h-5" />
          </button>
          {historyIndex > 0 && (
            <button onClick={handleUndo} className="p-2 hover:bg-white/20 rounded-lg transition bg-white/10" title="Annuler">
              <RotateCcw className="w-5 h-5 text-white" />
            </button>
          )}
          {historyIndex < history.length - 1 && (
            <button onClick={handleRedo} className="p-2 hover:bg-white/20 rounded-lg transition bg-white/10" title="Rétablir">
              <RotateCw className="w-5 h-5 text-white" />
            </button>
          )}
          
          <div className="w-px h-4 bg-white/20"></div>
          
          <button 
            onClick={() => setShowLayers(!showLayers)}
            className={`p-2 rounded-lg transition ${showLayers ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white' : 'hover:bg-white/20 text-white/80 bg-white/10'}`}
            title="Calques"
          >
            <Layers className="w-5 h-5" />
          </button>
          {toolsList.map(tool => (
            <button
              key={tool.id}
              onClick={(e) => {
                e.stopPropagation();
                if (tool.id === 'stickers') setShowStickerLibrary(true);
                else if (tool.id === 'music') setShowMusicLibrary(true);
                else if (tool.id === 'share') handleShareViaFriends();
                else if (tool.id === 'export') handleExport('png');
                else if (tool.id === 'templates') dispatch({ type: storyEditorActions.TOGGLE_TEMPLATE_LIBRARY });
                else setActiveCategory(tool.id);
              }}
              className={`p-2 rounded-lg transition ${
                activeCategory === tool.id || (tool.id === 'stickers' && showStickerLibrary) || (tool.id === 'music' && showMusicLibrary)
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={tool.label}
            >
              <tool.icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>
             {/* Panneau latéral Desktop */}
      <div className="hidden md:flex md:w-1/3 md:flex-col md:border-l md:border-white/10 md:bg-black/80 md:overflow-y-auto">
        {showLayers && (
          <LayersPanel 
            elements={elements}
            layerOrder={layerOrder}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onReorderElement={handleReorderElement}
            onDeleteElement={handleDeleteElement}
            onToggleVisibility={handleToggleVisibility}
          />
        )}

        {!showLayers && activeCategory === 'filters' && (
          <div className="p-4 space-y-4" data-panel onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">Filtres</h3>
            <div>
              <label className="text-white/80 text-sm">Luminosité: {canvasFilters.brightness}%</label>
              <input type="range" min="50" max="150" value={canvasFilters.brightness} onChange={(e) => updateFilters({ brightness: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="text-white/80 text-sm">Contraste: {canvasFilters.contrast}%</label>
              <input type="range" min="50" max="150" value={canvasFilters.contrast} onChange={(e) => updateFilters({ contrast: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="text-white/80 text-sm">Saturation: {canvasFilters.saturation}%</label>
              <input type="range" min="0" max="150" value={canvasFilters.saturation} onChange={(e) => updateFilters({ saturation: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="text-white/80 text-sm">Teinte: {canvasFilters.hue}°</label>
              <input type="range" min="0" max="360" value={canvasFilters.hue} onChange={(e) => updateFilters({ hue: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
            </div>
            <div>
              <label className="text-white/80 text-sm">Flou: {canvasFilters.blur}px</label>
              <input type="range" min="0" max="20" value={canvasFilters.blur} onChange={(e) => updateFilters({ blur: parseInt(e.target.value) })} className="w-full accent-cyan-500" />
            </div>
            <div className="pt-2 border-t border-white/10">
              <h4 className="text-white/80 text-sm mb-2">Effets rapides</h4>
              <div className="grid grid-cols-2 gap-2">
                {['Glow', 'Neon', 'Blur', 'Vintage', 'HDR', 'Cinéma', 'Cartoon', 'Monochrome'].map(effect => (
                  <button
                    key={effect}
                    onClick={() => handleApplyEffect(effect)}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white text-xs transition"
                  >
                    {effect}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'text' && (
          <TextPanel
            textInput={textInput}
            setTextInput={setTextInput}
            textColor={textColor}
            setTextColor={setTextColor}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            textBold={textBold}
            setTextBold={(bold) => dispatch({ type: storyEditorActions.SET_TEXT_BOLD, payload: bold })}
            textItalic={textItalic}
            setTextItalic={(italic) => dispatch({ type: storyEditorActions.SET_TEXT_ITALIC, payload: italic })}
            textShadow={textShadow}
            setTextShadow={(shadow) => dispatch({ type: storyEditorActions.SET_TEXT_SHADOW, payload: shadow })}
            textAlign={textAlign}
            setTextAlign={(align) => dispatch({ type: storyEditorActions.SET_TEXT_ALIGN, payload: align })}
            onAddText={handleAddText}
            onClose={() => setActiveCategory(null)}
            showLayers={showLayers}
          />
        )}

        {activeCategory === 'adjust' && (
          <div className="p-4 space-y-4" data-panel onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">Ajustements</h3>
            {selectedElement ? (
              <>
                <div>
                  <label className="text-white/80 text-sm">Opacité: {elementMap.get(selectedElement)?.opacity || 100}%</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={elementMap.get(selectedElement)?.opacity || 100}
                    onChange={(e) => {
                      const updated = elements.map(el => el.id === selectedElement ? { ...el, opacity: parseInt(e.target.value) } : el);
                      setElements(updated);
                    }}
                    className="w-full accent-cyan-500" 
                  />
                </div>
                <div>
                  <label className="text-white/80 text-sm">Échelle: {Math.round((elementMap.get(selectedElement)?.scale || 1) * 100)}%</label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="3" 
                    step="0.1"
                    value={elementMap.get(selectedElement)?.scale || 1}
                    onChange={(e) => {
                      const updated = elements.map(el => el.id === selectedElement ? { ...el, scale: parseFloat(e.target.value) } : el);
                      setElements(updated);
                    }}
                    className="w-full accent-purple-500" 
                  />
                </div>
                <div>
                  <label className="text-white/80 text-sm">Rotation: {elementMap.get(selectedElement)?.rotation || 0}°</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    value={elementMap.get(selectedElement)?.rotation || 0}
                    onChange={(e) => {
                      const updated = elements.map(el => el.id === selectedElement ? { ...el, rotation: parseInt(e.target.value) } : el);
                      setElements(updated);
                    }}
                    className="w-full accent-pink-500" 
                  />
                </div>
                <button
                  onClick={handleDeleteElement}
                  className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-semibold"
                >
                  🗑️ Supprimer l'élément
                </button>
              </>
            ) : (
              <p className="text-white/60 text-xs">Sélectionnez un élément d'abord</p>
            )}
          </div>
        )}

        {activeCategory === 'effects' && (
          <div className="p-4 space-y-3" data-panel onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">✨ Effets Spéciaux</h3>
            <div className="grid grid-cols-2 gap-2">
              {['Glow', 'Neon', 'Blur', 'Vintage', 'HDR', 'Cinéma', 'Pixelisation', 'Sépia', 'Cartoon', 'Monochrome'].map(effect => (
                <button
                  key={effect}
                  onClick={() => handleApplyEffect(effect)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg transition font-semibold text-sm"
                >
                  {effect}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setCanvasFilters({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 });
                saveToHistory();
                showFeedback('🔄 Filtres réinitialisés', 'success', 1500);
              }}
              className="w-full px-4 py-3 bg-red-500/50 hover:bg-red-600/70 border border-red-400 text-white rounded-lg transition font-semibold text-sm mt-2"
            >
              🔄 Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Draw Panel */}
      {activeCategory === 'draw' && (
        <DrawPanel
          drawMode={drawMode}
          setDrawMode={(mode) => dispatch({ type: storyEditorActions.SET_DRAW_MODE, payload: mode })}
          drawShape={drawShape}
          setDrawShape={(shape) => dispatch({ type: storyEditorActions.SET_DRAW_SHAPE, payload: shape })}
          drawColor={drawColor}
          setDrawColor={(color) => dispatch({ type: storyEditorActions.SET_DRAW_COLOR, payload: color })}
          drawThickness={drawThickness}
          setDrawThickness={(thick) => dispatch({ type: storyEditorActions.SET_DRAW_THICKNESS, payload: thick })}
          onClose={() => setActiveCategory(null)}
          showLayers={showLayers}
        />
      )}

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-white z-50 animate-pulse ${
          feedbackType === 'success' ? 'bg-green-500' : feedbackType === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {feedbackMsg}
        </div>
      )}

      {/* Modals Lazy Loaded */}
      {showStickerLibrary && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <StickerLibraryOptimized
            onStickerSelect={(sticker) => {
              if (elements.length >= MAX_ELEMENTS) {
                showFeedback(`⚠️ Limite de ${MAX_ELEMENTS} éléments atteinte`, 'error');
                return;
              }
              const stickerUrl = sticker.url || (process.env.REACT_APP_STICKER_CDN 
                ? `${process.env.REACT_APP_STICKER_CDN}/${sticker.category}/${sticker.id}.svg`
                : `/stickers/${sticker.category}/${sticker.id}.svg`);
              const newElement = {
                id: crypto.randomUUID(),
                type: 'sticker',
                content: stickerUrl,
                x: 540,
                y: 960,
                width: sticker.defaultWidth || 150,
                height: sticker.defaultHeight || 150,
                opacity: 100,
                rotation: 0,
                scale: 1
              };
              setElements([...elements, newElement]);
              saveToHistory();
              setShowStickerLibrary(false);
              showFeedback('✓ Sticker ajouté', 'success');
            }}
            onClose={() => setShowStickerLibrary(false)}
          />
        </Suspense>
      )}

      {showMusicLibrary && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <MusicLibrary
            onSelectMusic={(music) => {
              setActiveMusic(music);
              setShowMusicLibrary(false);
              showFeedback(`🎵 Musique "${music.title}" ajoutée`, 'success');
            }}
            onClose={() => setShowMusicLibrary(false)}
          />
        </Suspense>
      )}

      {showTemplateLibrary && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <TemplateLibrary
            onSelectTemplate={(template) => {
              if (template.backgroundImage) setBackgroundImage(template.backgroundImage);
              if (template.elements) setElements(template.elements);
              if (template.canvasFilters) setCanvasFilters(template.canvasFilters);
              dispatch({ type: storyEditorActions.TOGGLE_TEMPLATE_LIBRARY });
              showFeedback('✓ Template appliqué', 'success');
            }}
            onClose={() => dispatch({ type: storyEditorActions.TOGGLE_TEMPLATE_LIBRARY })}
          />
        </Suspense>
      )}

      {showBulkExport && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <BulkExport
            elements={elements}
            backgroundImage={backgroundImage}
            onClose={() => dispatch({ type: storyEditorActions.TOGGLE_BULK_EXPORT })}
          />
        </Suspense>
      )}

      {showImageSearch && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <ImageSearch
            onSelectImage={(image) => {
              setBackgroundImage(image.url);
              dispatch({ type: storyEditorActions.TOGGLE_IMAGE_SEARCH });
              showFeedback('✓ Image importée', 'success');
            }}
            onClose={() => dispatch({ type: storyEditorActions.TOGGLE_IMAGE_SEARCH })}
          />
        </Suspense>
      )}

      {showCollaboration && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <CollaborationPanel
            storyId={storyId}
            onClose={() => dispatch({ type: storyEditorActions.TOGGLE_COLLABORATION })}
          />
        </Suspense>
      )}

      {showAnimation && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <AnimationPanel
            selectedElement={selectedElement}
            onApplyAnimation={(animation) => {
              if (selectedElement) {
                setElements(elements.map(el => el.id === selectedElement ? { ...el, animation } : el));
                showFeedback(`✨ Animation ${animation.name} appliquée`, 'success');
              }
              dispatch({ type: storyEditorActions.TOGGLE_ANIMATION });
            }}
            onClose={() => dispatch({ type: storyEditorActions.TOGGLE_ANIMATION })}
          />
        </Suspense>
      )}

      {/* Publish Progress */}
      {publishStatus && (
        <Suspense fallback={null}>
          <PublishProgress 
            status={publishStatus} 
            progress={publishProgress}
            estimatedTime={estimatedTime}
          />
        </Suspense>
      )}

      {/* Timeline Sync */}
      {activeMusic && elements.length > 0 && (
        <Suspense fallback={null}>
          <div className="fixed bottom-24 right-4 w-80 max-h-96 overflow-y-auto bg-black/80 rounded-lg p-4 border border-white/10 z-40">
            <TimelineSync
              elements={elements}
              activeMusic={activeMusic}
              onUpdateElement={(el) => {
                const idx = elements.findIndex(e => e.id === el.id);
                if (idx >= 0) {
                  const newElements = [...elements];
                  newElements[idx] = el;
                  setElements(newElements);
                }
              }}
            />
          </div>
        </Suspense>
      )}

      {/* Story Preview */}
      {showPreview && (
        <Suspense fallback={null}>
          <StoryPreview 
            story={{
              backgroundImage,
              elements,
              music: activeMusic,
              filters: canvasFilters
            }}
            onClose={() => dispatch({ type: storyEditorActions.TOGGLE_PREVIEW })}
          />
        </Suspense>
      )}

      {/* Music Player */}
      {activeMusic && !showPreview && (
        <Suspense fallback={null}>
          <div className="fixed bottom-0 left-0 right-0 z-40">
            <MusicPlayer 
              music={activeMusic}
              onRemove={() => {
                dispatch({ type: storyEditorActions.SET_ACTIVE_MUSIC, payload: null });
                showFeedback('🎵 Musique retirée', 'info');
              }}
            />
          </div>
        </Suspense>
      )}

      {/* Export Progress */}
      {isExporting && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur px-4 py-2 rounded-full z-50 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-white text-sm">Export en cours... {exportProgress}%</span>
        </div>
      )}

      {/* Share Toast */}
      {textCopied && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 z-50">
          <Check className="w-5 h-5" />
          Lien copié! Partagez avec vos amis
        </div>
      )}
    </div>
  );
};

ProStoryEditor.propTypes = {
  onMediaSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  initialMedia: PropTypes.any.isRequired,
};

export default ProStoryEditor;
