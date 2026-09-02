/**
 * hooks/useEventBus.js
 * Système centralisé d'événements pour les commentaires
 * Évite les window.addEventListener globaux et permet une communication propre entre composants
 */

import { useContext, useEffect, useCallback, useRef, useState } from 'react'; // ✅ useState AJOUTÉ
import { CommentEventBusContext } from '../components/PostItem';

// =============================
// 1️⃣ HOOK PRINCIPAL - ACCÈS À L'EVENT BUS
// =============================

/**
 * Hook pour accéder à l'EventBus centralisé
 * @returns {EventTarget} L'EventBus pour écouter/émettre des événements
 * @throws {Error} Si utilisé hors du Provider
 */
export const useEventBus = () => {
  const bus = useContext(CommentEventBusContext);
  
  if (!bus) {
    throw new Error(
      '❌ useEventBus must be used within CommentEventBusProvider\n' +
      'Wrap your component tree with <CommentEventBusProvider> in App.js'
    );
  }
  
  return bus;
};

// =============================
// 2️⃣ HOOK POUR ÉCOUTER LES COMMENTAIRES D'UN POST
// =============================

/**
 * Hook pour écouter les nouveaux commentaires d'un post spécifique
 * @param {string} postId - ID du post à écouter
 * @param {Function} onCommentAdded - Callback appelé quand un commentaire est ajouté
 * @param {Array} dependencies - Dépendances supplémentaires pour le callback
 */
export const useCommentListener = (postId, onCommentAdded, dependencies = []) => {
  const bus = useEventBus();
  const callbackRef = useRef(onCommentAdded);

  // Mettre à jour la référence du callback
  useEffect(() => {
    callbackRef.current = onCommentAdded;
  }, [onCommentAdded, ...dependencies]);

  useEffect(() => {
    if (!postId) return;

    const handler = (event) => {
      // ✅ Sécurité : vérifier que event.detail existe
      if (!event?.detail) return;
      
      const { postId: eventPostId, comment, action } = event.detail;
      
      // Ne traiter que les événements pour ce post
      if (eventPostId === postId && callbackRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`💬 Comment event for post ${postId}:`, { action, comment });
        }
        
        callbackRef.current({
          comment,
          action: action || 'added',
          timestamp: event.detail?.timestamp
        });
      }
    };

    bus.addEventListener('comment', handler);
    
    return () => {
      bus.removeEventListener('comment', handler);
    };
  }, [postId, bus]); // Ne dépend que de postId et bus
};

// =============================
// 3️⃣ HOOK POUR ÉMETTRE DES ÉVÉNEMENTS DE COMMENTAIRES
// =============================

/**
 * Hook pour émettre des événements liés aux commentaires
 * @returns {Object} Fonctions d'émission d'événements
 */
export const useCommentEmitter = () => {
  const bus = useEventBus();

  /**
   * Émet un événement quand un commentaire est ajouté
   * @param {string} postId - ID du post
   * @param {Object} comment - Données du commentaire
   */
  const emitCommentAdded = useCallback((postId, comment) => {
    if (!postId || !comment) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ useCommentEmitter: postId and comment are required');
      }
      return;
    }

    const detail = {
      postId,
      comment,
      action: 'added',
      timestamp: Date.now()
    };

    // ✅ Un seul événement avec action pour différencier
    bus.dispatchEvent(new CustomEvent('comment', { detail }));
    
  }, [bus]);

  /**
   * Émet un événement quand un commentaire est modifié
   * @param {string} postId - ID du post
   * @param {Object} comment - Données du commentaire modifié
   */
  const emitCommentUpdated = useCallback((postId, comment) => {
    if (!postId || !comment) return;

    bus.dispatchEvent(new CustomEvent('comment', {
      detail: {
        postId,
        comment,
        action: 'updated',
        timestamp: Date.now()
      }
    }));
  }, [bus]);

  /**
   * Émet un événement quand un commentaire est supprimé
   * @param {string} postId - ID du post
   * @param {string} commentId - ID du commentaire supprimé
   */
  const emitCommentDeleted = useCallback((postId, commentId) => {
    if (!postId || !commentId) return;

    bus.dispatchEvent(new CustomEvent('comment', {
      detail: {
        postId,
        commentId,
        action: 'deleted',
        timestamp: Date.now()
      }
    }));
  }, [bus]);

  return {
    emitCommentAdded,
    emitCommentUpdated,
    emitCommentDeleted
  };
};

// =============================
// 4️⃣ HOOK POUR METTRE À JOUR LE COMPTEUR DE COMMENTAIRES
// =============================

/**
 * Hook pour gérer le compteur de commentaires d'un post
 * @param {string} postId - ID du post
 * @param {number} initialCount - Compteur initial
 * @returns {Object} État et fonctions de mise à jour du compteur
 */
export const useCommentCounter = (postId, initialCount = 0) => {
  const [count, setCount] = useState(initialCount);
  const { emitCommentAdded } = useCommentEmitter();

  // Mettre à jour quand initialCount change
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // Écouter les événements de commentaires pour ce post
  useCommentListener(postId, (event) => {
    if (!event) return;
    
    if (event.action === 'added') {
      setCount(prev => prev + 1);
    } else if (event.action === 'deleted') {
      setCount(prev => Math.max(0, prev - 1));
    }
  });

  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(prev => Math.max(0, prev - 1));
  }, []);

  return {
    count,
    increment,
    decrement,
    emitCommentAdded: (comment) => emitCommentAdded(postId, comment)
  };
};

// =============================
// 5️⃣ HOOK POUR DÉTECTER LES ERREURS D'ÉVÉNEMENTS (DEBUG)
// =============================

/**
 * Hook de debug pour surveiller tous les événements (dev only)
 */
export const useEventBusDebug = () => {
  const bus = useEventBus();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handler = (event) => {
      console.log('📡 EventBus:', {
        type: event.type,
        detail: event.detail,
        timestamp: new Date().toISOString()
      });
    };

    bus.addEventListener('comment', handler);

    return () => {
      bus.removeEventListener('comment', handler);
    };
  }, [bus]);
};

// =============================
// 6️⃣ HOOK POUR COMPOSANT AVEC COMMENTAIRES (HIGH-LEVEL)
// =============================

/**
 * Hook complet pour gérer les commentaires dans un composant
 * @param {string} postId - ID du post
 * @param {Array} initialComments - Commentaires initiaux
 * @returns {Object} Tout ce qu'il faut pour gérer les commentaires
 */
export const useComments = (postId, initialComments = []) => {
  const [comments, setComments] = useState(initialComments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { count, increment, decrement, emitCommentAdded } = useCommentCounter(
    postId, 
    initialComments.length
  );

  // Écouter les nouveaux commentaires
  useCommentListener(postId, (event) => {
    // ✅ Sécurité : vérifier l'événement
    if (!event) return;
    
    if (event.action === 'added' && event.comment) {
      setComments(prev => [...prev, event.comment]);
    } else if (event.action === 'deleted' && event.commentId) {
      setComments(prev => prev.filter(c => c.id !== event.commentId));
    }
  });

  const addComment = useCallback(async (content) => {
    setLoading(true);
    setError(null);
    
    // ✅ Commentaire temporaire pour UI optimiste
    const tempComment = {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      isTemp: true
    };
    
    setComments(prev => [...prev, tempComment]);
    increment();
    
    try {
      // TODO: Remplacer par ton appel API
      // const newComment = await api.post(...);
      
      // Simuler un délai réseau
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remplacer le temporaire par le vrai commentaire
      setComments(prev => 
        prev.map(c => c.id === tempComment.id 
          ? { ...c, id: `real-${Date.now()}`, isTemp: false } 
          : c
        )
      );
      
      // Émettre l'événement
      emitCommentAdded(tempComment);
      
    } catch (err) {
      // Rollback en cas d'erreur
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
      decrement();
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [emitCommentAdded, increment, decrement]);

  return {
    comments,
    count,
    loading,
    error,
    addComment,
    setComments,
    increment,
    decrement
  };
};

// =============================
// 7️⃣ EXPORT PAR DÉFAUT
// =============================

export default {
  useEventBus,
  useCommentListener,
  useCommentEmitter,
  useCommentCounter,
  useEventBusDebug,
  useComments
};
