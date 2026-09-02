// hooks/useSettings.js
import { useReducer, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { DEFAULT_SETTINGS } from '../constants/defaultSettings';
import { validateSettings } from '../utils/validators';

// =============================
// 1️⃣ REDUCER AVEC ACTIONS ASYNCHRONES
// =============================
const SETTINGS_ACTIONS = {
  UPDATE_FIELD: 'UPDATE_FIELD',
  UPDATE_CATEGORY: 'UPDATE_CATEGORY',
  UPDATE_NESTED: 'UPDATE_NESTED',
  RESET_ALL: 'RESET_ALL',
  RESET_CONTENT: 'RESET_CONTENT',
  SET_LAST_SAVED: 'SET_LAST_SAVED',
  SET_IS_DIRTY: 'SET_IS_DIRTY'
};

const settingsReducer = (state, action) => {
  switch (action.type) {
    case SETTINGS_ACTIONS.UPDATE_FIELD:
      return {
        ...state,
        [action.payload.key]: action.payload.value
      };
      
    case SETTINGS_ACTIONS.UPDATE_CATEGORY:
      return {
        ...state,
        [action.payload.category]: action.payload.value
      };
      
    case SETTINGS_ACTIONS.UPDATE_NESTED:
      return {
        ...state,
        [action.payload.category]: {
          ...state[action.payload.category],
          [action.payload.key]: action.payload.value
        }
      };
      
    case SETTINGS_ACTIONS.RESET_ALL:
      return { ...DEFAULT_SETTINGS, isDirty: false, lastSaved: null };
      
    case SETTINGS_ACTIONS.RESET_CONTENT:
      return {
        ...state,
        feed: DEFAULT_SETTINGS.feed,
        interests: DEFAULT_SETTINGS.interests,
        hidden: DEFAULT_SETTINGS.hidden,
        isDirty: true
      };
      
    case SETTINGS_ACTIONS.SET_LAST_SAVED:
      return {
        ...state,
        lastSaved: action.payload.timestamp,
        isDirty: false
      };
      
    case SETTINGS_ACTIONS.SET_IS_DIRTY:
      return {
        ...state,
        isDirty: action.payload.isDirty
      };
      
    default:
      return state;
  }
};

// =============================
// 2️⃣ HOOK PRINCIPAL
// =============================
export const useSettings = () => {
  // État initial avec validation
  const [state, dispatch] = useReducer(settingsReducer, null, () => {
    const loaded = {
      fontSize: storage.get(STORAGE_KEYS.FONT_SIZE, DEFAULT_SETTINGS.fontSize),
      animationsEnabled: storage.get(STORAGE_KEYS.ANIMATIONS, DEFAULT_SETTINGS.animationsEnabled),
      language: storage.get(STORAGE_KEYS.LANGUAGE, DEFAULT_SETTINGS.language),
      region: storage.get(STORAGE_KEYS.REGION, DEFAULT_SETTINGS.region),
      notifications: storage.get(STORAGE_KEYS.NOTIFICATIONS, DEFAULT_SETTINGS.notifications),
      content: storage.get(STORAGE_KEYS.CONTENT, DEFAULT_SETTINGS.content),
      performance: storage.get(STORAGE_KEYS.PERFORMANCE, DEFAULT_SETTINGS.performance),
      accessibility: storage.get(STORAGE_KEYS.ACCESSIBILITY, DEFAULT_SETTINGS.accessibility),
      feed: storage.get(STORAGE_KEYS.FEED, DEFAULT_SETTINGS.feed),
      interests: storage.get(STORAGE_KEYS.INTERESTS, DEFAULT_SETTINGS.interests),
      fav: storage.get(STORAGE_KEYS.FAV, DEFAULT_SETTINGS.fav),
      filter: storage.get(STORAGE_KEYS.FILTER, DEFAULT_SETTINGS.filter),
      ai: storage.get(STORAGE_KEYS.AI, DEFAULT_SETTINGS.ai),
      study: storage.get(STORAGE_KEYS.STUDY, DEFAULT_SETTINGS.study),
      hidden: storage.get(STORAGE_KEYS.HIDDEN, DEFAULT_SETTINGS.hidden),
      isDirty: false,
      lastSaved: null
    };
    return validateSettings(loaded);
  });

  // États réactifs pour l'UI (isDirty visible)
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef(null);

  // =============================
  // 3️⃣ ACTIONS AVEC STORAGE SYNC
  // =============================
  const updateField = useCallback(async (key, value) => {
    dispatch({ type: SETTINGS_ACTIONS.UPDATE_FIELD, payload: { key, value } });
    dispatch({ type: SETTINGS_ACTIONS.SET_IS_DIRTY, payload: { isDirty: true } });
    setIsDirty(true);
    
    try {
      await storage.setAsync(STORAGE_KEYS[key.toUpperCase()], value);
    } catch (error) {
      console.error('Storage error:', error);
      // Rollback ? À implémenter si nécessaire
    }
  }, []);

  const updateCategory = useCallback(async (category, value) => {
    dispatch({ type: SETTINGS_ACTIONS.UPDATE_CATEGORY, payload: { category, value } });
    dispatch({ type: SETTINGS_ACTIONS.SET_IS_DIRTY, payload: { isDirty: true } });
    setIsDirty(true);
    
    try {
      await storage.setAsync(STORAGE_KEYS[category.toUpperCase()], value);
    } catch (error) {
      console.error('Storage error:', error);
    }
  }, []);

  const updateNested = useCallback(async (category, key, value) => {
    const currentCategory = state[category] || {};
    const newCategory = { ...currentCategory, [key]: value };
    
    dispatch({ type: SETTINGS_ACTIONS.UPDATE_CATEGORY, payload: { category, value: newCategory } });
    dispatch({ type: SETTINGS_ACTIONS.SET_IS_DIRTY, payload: { isDirty: true } });
    setIsDirty(true);
    
    try {
      await storage.setAsync(STORAGE_KEYS[category.toUpperCase()], newCategory);
    } catch (error) {
      console.error('Storage error:', error);
    }
  }, [state]);

  // =============================
  // 4️⃣ ACTIONS SPÉCIALISÉES
  // =============================
  const saveSettings = useCallback(async () => {
    if (!isDirty) return;
    
    try {
      // Sauvegarde de tout l'état (si nécessaire)
      // await syncService.syncAllSettings(state);
      dispatch({ type: SETTINGS_ACTIONS.SET_LAST_SAVED, payload: { timestamp: Date.now() } });
      setIsDirty(false);
      toast.success('Paramètres sauvegardés');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  }, [isDirty]);

  const resetAllPreferences = useCallback(() => {
    if (window.confirm('Voulez-vous vraiment réinitialiser toutes vos préférences ?')) {
      dispatch({ type: SETTINGS_ACTIONS.RESET_ALL });
      storage.clearAllSettings();
      setIsDirty(false);
      toast.success('Toutes les préférences ont été réinitialisées');
    }
  }, []);

  const resetContentPreferences = useCallback(() => {
    if (window.confirm('Voulez-vous vraiment réinitialiser vos préférences de contenu ?')) {
      dispatch({ type: SETTINGS_ACTIONS.RESET_CONTENT });
      storage.set(STORAGE_KEYS.FEED, DEFAULT_SETTINGS.feed);
      storage.set(STORAGE_KEYS.INTERESTS, DEFAULT_SETTINGS.interests);
      storage.set(STORAGE_KEYS.HIDDEN, DEFAULT_SETTINGS.hidden);
      setIsDirty(true);
      toast.success('Préférences de contenu réinitialisées');
    }
  }, []);

  // =============================
  // 5️⃣ AUTO-SAVE (debounced)
  // =============================
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings();
    }, 2000);
  }, [saveSettings]);

  // =============================
  // 6️⃣ VALEUR RETOURNÉE
  // =============================
  return {
    // État
    ...state,
    isDirty,
    
    // Actions
    updateField,
    updateCategory,
    updateNested,
    saveSettings,
    resetAllPreferences,
    resetContentPreferences,
    debouncedSave,
    
    // Raccourcis pour les catégories principales
    updateNotifications: (value) => updateCategory('notifications', value),
    updateContent: (value) => updateCategory('content', value),
    updatePerformance: (value) => updateCategory('performance', value),
    updateAccessibility: (value) => updateCategory('accessibility', value),
    
    // Cache (géré séparément)
    cache: null // Sera géré par useCacheManager
  };
};

export default useSettings;
