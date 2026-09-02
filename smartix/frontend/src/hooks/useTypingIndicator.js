// src/hooks/useTypingIndicator.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { messageSocketService } from '../services/messageSocketService';

// =============================
// CONSTANTES
// =============================
const DEFAULT_TYPING_TIMEOUT = 3000; // 3 secondes sans activité = arrêt du typing
const TYPING_THROTTLE_MS = 2000; // Minimum 2 secondes entre deux événements typing
const MIN_TYPING_DURATION = 500; // Durée minimum d'affichage du typing (évite les flashs)
const TYPING_HEARTBEAT_INTERVAL = 2000; // Heartbeat pour maintenir le statut
const MAX_TYPING_USERS_DISPLAY = 2; // Nombre max de noms à afficher

// =============================
// HOOK PRINCIPAL
// =============================
const useTypingIndicator = (conversationId, currentUserId, recipientId, options = {}) => {
  const {
    typingTimeout = DEFAULT_TYPING_TIMEOUT,
    throttleMs = TYPING_THROTTLE_MS,
    minDuration = MIN_TYPING_DURATION,
    enableHeartbeat = true
  } = options;
  
  // États
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  
  // Refs
  const typingTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const isTypingRef = useRef(false);
  const pendingStopRef = useRef(false);
  const conversationIdRef = useRef(conversationId);
  
  // Map pour gérer plusieurs utilisateurs avec leurs propres timeouts
  const typingUsersMapRef = useRef(new Map());

  // Synchronisation isTyping state/ref
  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  // Mettre à jour la ref de conversationId
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  /**
   * Nettoie tous les timeouts
   */
  const clearAllTimeouts = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Arrête l'indicateur de frappe pour un utilisateur spécifique
   * @param {string} userId - ID de l'utilisateur
   * @param {boolean} immediate - Arrêt immédiat (sans délai minimum)
   */
  const stopTypingForUser = useCallback((userId, immediate = false) => {
    const userEntry = typingUsersMapRef.current.get(userId);
    if (!userEntry) return;
    
    const stop = () => {
      // Nettoyer le minDisplayTimeout spécifique à l'utilisateur
      if (userEntry.minDisplayTimeout) {
        clearTimeout(userEntry.minDisplayTimeout);
      }
      if (userEntry.timeout) {
        clearTimeout(userEntry.timeout);
      }
      
      typingUsersMapRef.current.delete(userId);
      const remainingUsers = Array.from(typingUsersMapRef.current.keys());
      setTypingUsers(remainingUsers);
      
      // Si plus personne ne tape, arrêter l'indicateur global
      if (remainingUsers.length === 0) {
        setIsTyping(false);
      }
    };
    
    if (immediate) {
      stop();
    } else {
      // Attendre la durée minimum avant de disparaître (évite les flashs)
      if (userEntry.minDisplayTimeout) {
        clearTimeout(userEntry.minDisplayTimeout);
      }
      
      userEntry.minDisplayTimeout = setTimeout(stop, minDuration);
      typingUsersMapRef.current.set(userId, userEntry);
    }
  }, [minDuration]);

  /**
   * Démarre l'indicateur de frappe pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} userName - Nom de l'utilisateur (optionnel)
   */
  const startTypingForUser = useCallback((userId, userName = null) => {
    const existingEntry = typingUsersMapRef.current.get(userId);
    
    // Nettoyer les timeouts existants
    if (existingEntry?.timeout) {
      clearTimeout(existingEntry.timeout);
    }
    if (existingEntry?.minDisplayTimeout) {
      clearTimeout(existingEntry.minDisplayTimeout);
    }
    
    // Créer un nouveau timeout pour arrêter automatiquement
    const timeout = setTimeout(() => {
      stopTypingForUser(userId, false);
    }, typingTimeout);
    
    typingUsersMapRef.current.set(userId, {
      userName,
      timeout,
      minDisplayTimeout: null,
      startedAt: Date.now()
    });
    
    const users = Array.from(typingUsersMapRef.current.keys());
    setTypingUsers(users);
    setIsTyping(users.length > 0);
  }, [typingTimeout, stopTypingForUser]);

  /**
   * Réinitialise l'écoute de l'utilisateur courant
   */
  const resetInactivityTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        sendTypingStatus(false);
      }
    }, typingTimeout);
  }, [typingTimeout]);

  /**
   * Réinitialise complètement l'indicateur
   */
  const resetTyping = useCallback(() => {
    clearAllTimeouts();
    
    // Nettoyer tous les timeouts des utilisateurs
    for (const [userId, entry] of typingUsersMapRef.current.entries()) {
      if (entry.timeout) clearTimeout(entry.timeout);
      if (entry.minDisplayTimeout) clearTimeout(entry.minDisplayTimeout);
    }
    
    typingUsersMapRef.current.clear();
    setTypingUsers([]);
    setIsTyping(false);
    isTypingRef.current = false;
    pendingStopRef.current = false;
  }, [clearAllTimeouts]);

  /**
   * Envoie le statut de frappe au partenaire (avec heartbeat)
   * @param {boolean} typing - True si l'utilisateur tape
   */
  const sendTypingStatus = useCallback((typing) => {
    if (!recipientId || !currentUserId) return;
    
    const now = Date.now();
    const timeSinceLastSent = now - lastTypingSentRef.current;
    
    // Throttling: ne pas envoyer trop souvent
    if (typing && timeSinceLastSent < throttleMs) {
      return;
    }
    
    // Éviter les envois redondants
    if (isTypingRef.current === typing && !pendingStopRef.current) {
      return;
    }
    
    isTypingRef.current = typing;
    
    if (!typing) {
      // Pour l'arrêt, on peut avoir un petit délai pour éviter les allers-retours
      if (pendingStopRef.current) return;
      pendingStopRef.current = true;
      
      // Arrêter le heartbeat si actif
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      setTimeout(() => {
        if (!isTypingRef.current) {
          messageSocketService.sendTypingStatus(recipientId, false);
          lastTypingSentRef.current = Date.now();
        }
        pendingStopRef.current = false;
      }, 300);
      return;
    }
    
    pendingStopRef.current = false;
    messageSocketService.sendTypingStatus(recipientId, true);
    lastTypingSentRef.current = now;
    
    // Démarrer le heartbeat pour maintenir le statut
    if (enableHeartbeat && !heartbeatIntervalRef.current) {
      heartbeatIntervalRef.current = setInterval(() => {
        if (isTypingRef.current) {
          messageSocketService.sendTypingStatus(recipientId, true);
          lastTypingSentRef.current = Date.now();
        } else if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      }, TYPING_HEARTBEAT_INTERVAL);
    }
  }, [recipientId, currentUserId, throttleMs, enableHeartbeat]);

  /**
   * Gère le changement de texte (à appeler depuis le composant d'input)
   * @param {string} text - Le texte actuel
   */
  const handleTextChange = useCallback((text) => {
    const hasText = text && text.trim().length > 0;
    
    if (hasText) {
      if (!isTypingRef.current) {
        sendTypingStatus(true);
      }
      resetInactivityTimeout();
    } else {
      sendTypingStatus(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [sendTypingStatus, resetInactivityTimeout]);

  /**
   * Appeler quand l'utilisateur envoie un message (arrête immédiatement le typing)
   */
  const onMessageSent = useCallback(() => {
    if (isTypingRef.current) {
      sendTypingStatus(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [sendTypingStatus]);

  /**
   * Formate le texte d'affichage du typing (optimisé UX)
   * @returns {string|null}
   */
  const getTypingDisplayText = useCallback(() => {
    if (!isTyping || typingUsers.length === 0) return null;
    
    const userNames = typingUsers
      .map(userId => {
        const entry = typingUsersMapRef.current.get(userId);
        return entry?.userName || null;
      })
      .filter(Boolean);
    
    const totalTyping = typingUsers.length;
    
    // Cas sans noms (fallback)
    if (userNames.length === 0) {
      if (totalTyping === 1) return "Quelqu'un écrit...";
      if (totalTyping === 2) return "Deux personnes écrivent...";
      return "Plusieurs personnes écrivent...";
    }
    
    // Cas avec noms
    if (userNames.length === 1) {
      return `${userNames[0]} écrit...`;
    }
    
    if (userNames.length === 2) {
      return `${userNames[0]} et ${userNames[1]} écrivent...`;
    }
    
    // Plus de 2 noms : afficher les 2 premiers + compteur
    const remainingCount = totalTyping - MAX_TYPING_USERS_DISPLAY;
    const displayNames = userNames.slice(0, MAX_TYPING_USERS_DISPLAY);
    
    if (remainingCount === 1) {
      return `${displayNames.join(', ')} et 1 autre personne écrivent...`;
    }
    
    return `${displayNames.join(', ')} et ${remainingCount} autres personnes écrivent...`;
  }, [isTyping, typingUsers]);

  // Nettoyage des timeouts au démontage
  useEffect(() => {
    return () => {
      clearAllTimeouts();
      resetTyping();
    };
  }, [clearAllTimeouts, resetTyping]);

  // Écouter les événements de typing WebSocket (namespace par conversation)
  useEffect(() => {
    if (!conversationId) return;
    
    const eventName = `typing:${conversationId}`;
    
    const handleTyping = (data) => {
      // Vérifier que le message est pour cette conversation
      if (data.sender_id === currentUserId) return; // Ignorer ses propres événements
      
      if (data.isTyping) {
        startTypingForUser(data.sender_id, data.sender_name);
      } else {
        stopTypingForUser(data.sender_id, true);
      }
    };
    
    messageSocketService.on(eventName, handleTyping);
    
    return () => {
      messageSocketService.off(eventName, handleTyping);
    };
  }, [conversationId, currentUserId, startTypingForUser, stopTypingForUser]);

  return {
    // États
    isTyping,
    typingUsers,
    typingDisplayText: getTypingDisplayText(),
    
    // Actions
    handleTextChange,
    onMessageSent,
    sendTypingStatus,
    resetTyping,
    
    // Utilitaires
    hasMultipleTyping: typingUsers.length > 1,
    typingCount: typingUsers.length
  };
};

export default useTypingIndicator;
