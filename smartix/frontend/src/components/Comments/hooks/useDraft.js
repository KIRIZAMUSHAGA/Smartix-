import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';

// =============================
// CONSTANTES
// =============================
const DRAFT_SAVE_DELAY = 1500; // 1.5 secondes
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours
const MAX_DRAFTS_PER_USER = 50; // Limite pour éviter explosion

// =============================
// GESTION DES BROUILLONS AVEC TTL
// =============================

/**
 * Nettoie les brouillons expirés pour un post donné
 */
const cleanExpiredDraft = (postId) => {
  try {
    const draft = localStorage.getItem(`comment_draft_${postId}`);
    if (draft) {
      const { timestamp } = JSON.parse(draft);
      if (timestamp && Date.now() - timestamp > DRAFT_TTL) {
        localStorage.removeItem(`comment_draft_${postId}`);
      }
    }
  } catch (e) {
    // Ignorer les erreurs de parsing
  }
};

/**
 * Nettoie tous les brouillons expirés (à appeler périodiquement)
 */
export const cleanAllExpiredDrafts = () => {
  try {
    const keys = Object.keys(localStorage);
    let cleaned = 0;
    
    for (const key of keys) {
      if (key.startsWith('comment_draft_')) {
        try {
          const draft = localStorage.getItem(key);
          if (draft) {
            const { timestamp } = JSON.parse(draft);
            if (timestamp && Date.now() - timestamp > DRAFT_TTL) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch (e) {
          // Corrompu, supprimer
          localStorage.removeItem(key);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Nettoyage drafts: ${cleaned} brouillons expirés supprimés`);
    }
  } catch (e) {
    console.warn('Erreur nettoyage drafts:', e);
  }
};

/**
 * Nettoie les brouillons en trop (LRU)
 */
const enforceMaxDrafts = () => {
  try {
    const drafts = [];
    
    // Récupérer tous les brouillons avec leur timestamp
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('comment_draft_')) {
        try {
          const draft = localStorage.getItem(key);
          if (draft) {
            const { timestamp } = JSON.parse(draft);
            drafts.push({ key, timestamp: timestamp || 0 });
          }
        } catch (e) {
          // Ignorer
        }
      }
    }
    
    // Trier par date (plus ancien en premier)
    drafts.sort((a, b) => a.timestamp - b.timestamp);
    
    // Supprimer les plus anciens si trop de brouillons
    while (drafts.length > MAX_DRAFTS_PER_USER) {
      const oldest = drafts.shift();
      localStorage.removeItem(oldest.key);
    }
  } catch (e) {
    console.warn('Erreur limitation drafts:', e);
  }
};

// =============================
// HOOK PRINCIPAL
// =============================

export const useDraft = (postId, replyingTo) => {
  const [text, setText] = useState('');
  const [commentType, setCommentType] = useState('text');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const autoSaveTimerRef = useRef(null);
  
  // ✅ Fonction de sauvegarde avec timestamp
  const saveDraft = useCallback(() => {
    if (!postId || replyingTo) return;
    
    const trimmedText = text.trim();
    
    // Supprimer le draft si le texte est vide
    if (!trimmedText) {
      localStorage.removeItem(`comment_draft_${postId}`);
      return;
    }
    
    // Sauvegarder avec timestamp
    localStorage.setItem(`comment_draft_${postId}`, JSON.stringify({
      text: trimmedText,
      type: commentType,
      timestamp: Date.now()
    }));
    
    // Limiter le nombre de drafts
    enforceMaxDrafts();
    
  }, [text, commentType, postId, replyingTo]);

  // ✅ Sauvegarde avec debounce (évite setTimeout manuel)
  const debouncedSave = useDebounce(saveDraft, DRAFT_SAVE_DELAY);

  // ✅ Sauvegarde automatique (déclenchée à chaque changement)
  useEffect(() => {
    if (replyingTo) return;
    debouncedSave();
  }, [text, commentType, debouncedSave, replyingTo]);

  // ✅ Nettoyage du timer au démontage
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // ✅ Chargement du brouillon avec nettoyage si expiré
  useEffect(() => {
    if (!postId || replyingTo || isDraftLoaded) return;
    
    // Nettoyer les drafts expirés avant chargement
    cleanExpiredDraft(postId);
    
    const draft = localStorage.getItem(`comment_draft_${postId}`);
    if (draft) {
      try {
        const { text: savedText, type, timestamp } = JSON.parse(draft);
        
        // Vérifier si le draft n'est pas trop vieux (double sécurité)
        if (timestamp && Date.now() - timestamp <= DRAFT_TTL) {
          setText(savedText);
          setCommentType(type || 'text');
        } else {
          // Draft expiré, supprimer
          localStorage.removeItem(`comment_draft_${postId}`);
        }
      } catch (e) {
        // Draft corrompu, supprimer
        localStorage.removeItem(`comment_draft_${postId}`);
      }
    }
    
    setIsDraftLoaded(true);
  }, [postId, replyingTo, isDraftLoaded]);

  // ✅ Effacement du brouillon (appelé après soumission)
  const clearDraft = useCallback(() => {
    if (postId) {
      localStorage.removeItem(`comment_draft_${postId}`);
    }
    setText('');
    setCommentType('text');
  }, [postId]);

  // ✅ Effacement forcé (appelé manuellement)
  const forceClearDraft = useCallback(() => {
    if (postId) {
      localStorage.removeItem(`comment_draft_${postId}`);
    }
  }, [postId]);

  return {
    text,
    setText,
    commentType,
    setCommentType,
    clearDraft,
    forceClearDraft,
    hasDraft: text.trim().length > 0
  };
};

// =============================
// HOOK POUR NETTOYAGE PÉRIODIQUE
// =============================

export const useDraftCleanup = (interval = 24 * 60 * 60 * 1000) => {
  useEffect(() => {
    // Nettoyage initial
    cleanAllExpiredDrafts();
    
    // Nettoyage périodique
    const cleanupInterval = setInterval(cleanAllExpiredDrafts, interval);
    
    return () => clearInterval(cleanupInterval);
  }, [interval]);
};
