// src/hooks/useReadReceipts.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { messageSocketService } from '../services/messageSocketService';

// =============================
// CONSTANTES
// =============================
const BATCH_DELAY_MS = 1000; // Délai avant d'envoyer un lot de lectures
const MAX_BATCH_SIZE = 50; // Taille maximale d'un lot
const READ_RECEIPT_DEBOUNCE_MS = 500; // Debounce pour les messages lus
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 1000;

// =============================
// HOOK PRINCIPAL
// =============================
const useReadReceipts = (conversationId, currentUserId, totalParticipants = 2) => {
  // États - Version optimisée avec lastReadMessageId
  const [lastReadMessageId, setLastReadMessageId] = useState(null);
  const [lastReadTime, setLastReadTime] = useState(null);
  
  // Pour la compatibilité et les groupes
  const [readMessagesSet, setReadMessagesSet] = useState(() => new Set()); // Pour les cas où l'ID n'est pas ordinal
  const [deliveredMessagesSet, setDeliveredMessagesSet] = useState(() => new Set());
  
  // Refs pour le batching
  const pendingReadsRef = useRef(new Set());
  const batchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  
  // Map pour suivre les messages par utilisateur (dans un groupe)
  const userReadsRef = useRef(new Map());

  /**
   * Envoie un lot de lectures avec retry exponentiel
   */
  const flushReadReceipts = useCallback(async () => {
    if (pendingReadsRef.current.size === 0) return;
    
    // Gestion du batch avec conservation des messages restants
    const allPending = Array.from(pendingReadsRef.current);
    const batch = allPending.slice(0, MAX_BATCH_SIZE);
    const remaining = allPending.slice(MAX_BATCH_SIZE);
    
    pendingReadsRef.current = new Set(remaining);
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    
    try {
      // Annuler la requête précédente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      // Envoyer les accusés de lecture groupés avec signal
      await messageSocketService.sendBatchReadReceipts({
        conversationId,
        messageIds: batch,
        readerId: currentUserId,
        timestamp: new Date().toISOString()
      }, {
        signal: abortControllerRef.current.signal
      });
      
      // Mettre à jour l'état local avec optimisation (évite re-render inutile)
      const maxMessageId = Math.max(...batch.filter(id => !isNaN(Number(id))), 0);
      
      setLastReadMessageId(prev => {
        if (maxMessageId > (prev || 0)) {
          return maxMessageId;
        }
        return prev;
      });
      
      // Mise à jour du Set uniquement si nécessaire
      setReadMessagesSet(prev => {
        let changed = false;
        const next = new Set(prev);
        batch.forEach(id => {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      
      setLastReadTime(Date.now());
      
      // Réinitialiser le compteur de retry en cas de succès
      retryCountRef.current = 0;
      
    } catch (err) {
      console.error('Failed to send read receipts:', err);
      
      // Réajouter les messages non envoyés
      batch.forEach(id => pendingReadsRef.current.add(id));
      
      // Retry avec backoff exponentiel
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        const delay = BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current);
        retryCountRef.current++;
        
        if (!batchTimeoutRef.current) {
          batchTimeoutRef.current = setTimeout(flushReadReceipts, delay);
        }
      } else {
        // Trop de tentatives, abandonner
        console.warn('Max retries reached for read receipts');
        retryCountRef.current = 0;
      }
    }
  }, [conversationId, currentUserId]);

  /**
   * Programme l'envoi des accusés de lecture
   */
  const scheduleReadReceipts = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(() => {
      flushReadReceipts();
    }, BATCH_DELAY_MS);
  }, [flushReadReceipts]);

  /**
   * Marque un message comme lu (avec debounce)
   * @param {string} messageId - ID du message
   * @param {string} senderId - ID de l'expéditeur (optionnel, pour groupe)
   */
  const markAsRead = useCallback((messageId, senderId = null) => {
    if (!messageId) return;
    
    // Ne pas marquer ses propres messages
    if (senderId === currentUserId) return;
    
    // Debounce pour éviter les appels multiples (scroll rapide)
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      pendingReadsRef.current.add(messageId);
      
      // Suivre par utilisateur pour les groupes
      if (senderId) {
        const userReads = userReadsRef.current.get(senderId) || new Set();
        userReads.add(messageId);
        userReadsRef.current.set(senderId, userReads);
      }
      
      scheduleReadReceipts();
    }, READ_RECEIPT_DEBOUNCE_MS);
  }, [currentUserId, scheduleReadReceipts]);

  /**
   * Marque plusieurs messages comme lus
   * @param {Array} messageIds - Liste des IDs de messages
   * @param {string} senderId - ID de l'expéditeur
   */
  const markMultipleAsRead = useCallback((messageIds, senderId = null) => {
    if (!messageIds || messageIds.length === 0) return;
    
    // Debounce pour les appels multiples
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      messageIds.forEach(id => {
        if (senderId !== currentUserId) {
          pendingReadsRef.current.add(id);
        }
      });
      
      if (senderId) {
        const userReads = userReadsRef.current.get(senderId) || new Set();
        messageIds.forEach(id => userReads.add(id));
        userReadsRef.current.set(senderId, userReads);
      }
      
      scheduleReadReceipts();
    }, READ_RECEIPT_DEBOUNCE_MS);
  }, [currentUserId, scheduleReadReceipts]);

  /**
   * Marque tous les messages d'une conversation comme lus
   * @param {Array} messages - Liste des messages
   */
  const markConversationAsRead = useCallback((messages) => {
    if (!messages || messages.length === 0) return;
    
    // Debounce pour les appels multiples
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      const unreadMessages = messages.filter(msg => 
        msg.sender_id !== currentUserId && 
        !isMessageRead(msg.id)
      );
      
      if (unreadMessages.length === 0) return;
      
      const messageIds = unreadMessages.map(msg => msg.id);
      messageIds.forEach(id => pendingReadsRef.current.add(id));
      
      scheduleReadReceipts();
    }, READ_RECEIPT_DEBOUNCE_MS);
  }, [currentUserId, scheduleReadReceipts]);

  /**
   * Met à jour le statut de lecture d'un message (reçu depuis WebSocket)
   * @param {Object} data - { messageId, readerId, timestamp, conversationId }
   */
  const updateMessageReadStatus = useCallback((data) => {
    const { messageId, readerId, conversationId: msgConversationId } = data;
    
    // Vérifier que c'est pour cette conversation
    if (msgConversationId !== conversationId) return;
    
    // Ne pas traiter ses propres lectures
    if (readerId === currentUserId) return;
    
    // Stocker la lecture par utilisateur
    const userReads = userReadsRef.current.get(readerId) || new Set();
    userReads.add(messageId);
    userReadsRef.current.set(readerId, userReads);
  }, [conversationId, currentUserId]);

  /**
   * Met à jour le statut de délivrance (reçu depuis WebSocket)
   */
  const updateMessageDeliveredStatus = useCallback((data) => {
    const { messageId, receiverId, conversationId: msgConversationId } = data;
    
    if (msgConversationId !== conversationId) return;
    if (receiverId === currentUserId) return;
    
    setDeliveredMessagesSet(prev => {
      if (prev.has(messageId)) return prev;
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, [conversationId, currentUserId]);

  /**
   * Vérifie si un message a été lu (version optimisée)
   * @param {string} messageId - ID du message
   * @param {string} userId - ID de l'utilisateur (optionnel, pour groupe)
   * @returns {boolean}
   */
  const isMessageRead = useCallback((messageId, userId = null) => {
    // Version optimisée pour les IDs numériques ordonnés
    if (userId) {
      const userReads = userReadsRef.current.get(userId);
      return userReads?.has(messageId) || false;
    }
    
    // Utiliser lastReadMessageId si l'ID est numérique
    const messageIdNum = Number(messageId);
    if (!isNaN(messageIdNum) && lastReadMessageId !== null) {
      return messageIdNum <= lastReadMessageId;
    }
    
    // Fallback sur le Set
    return readMessagesSet.has(messageId);
  }, [lastReadMessageId, readMessagesSet]);

  /**
   * Vérifie si un message a été délivré
   * @param {string} messageId - ID du message
   * @returns {boolean}
   */
  const isMessageDelivered = useCallback((messageId) => {
    return deliveredMessagesSet.has(messageId);
  }, [deliveredMessagesSet]);

  /**
   * Obtient la liste des utilisateurs qui ont lu un message (pour les groupes)
   * @param {string} messageId - ID du message
   * @returns {Array} - Liste des IDs utilisateurs
   */
  const getReaders = useCallback((messageId) => {
    const readers = [];
    for (const [userId, reads] of userReadsRef.current.entries()) {
      if (reads.has(messageId)) {
        readers.push(userId);
      }
    }
    return readers;
  }, []);

  /**
   * Obtient le nombre de lectures pour un message
   * @param {string} messageId - ID du message
   * @returns {number}
   */
  const getReadCount = useCallback((messageId) => {
    let count = 0;
    for (const reads of userReadsRef.current.values()) {
      if (reads.has(messageId)) count++;
    }
    return count;
  }, []);

  /**
   * Vérifie si le message a été lu par tous les participants
   * @param {string} messageId - ID du message
   * @returns {boolean}
   */
  const isSeenByAll = useCallback((messageId) => {
    return getReadCount(messageId) >= totalParticipants - 1;
  }, [getReadCount, totalParticipants]);

  /**
   * Obtient le statut du message (pour affichage)
   * @param {string} messageId - ID du message
   * @returns {string} - 'sending' | 'sent' | 'delivered' | 'read'
   */
  const getMessageStatus = useCallback((messageId) => {
    if (isMessageRead(messageId)) return 'read';
    if (isMessageDelivered(messageId)) return 'delivered';
    return 'sent';
  }, [isMessageRead, isMessageDelivered]);

  /**
   * Réinitialise tous les états (changement de conversation)
   */
  const resetReadReceipts = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    pendingReadsRef.current.clear();
    userReadsRef.current.clear();
    setLastReadMessageId(null);
    setLastReadTime(null);
    // Ne pas réinitialiser readMessagesSet et deliveredMessagesSet
    // pour éviter les re-renders inutiles
    readMessagesSet.clear();
    deliveredMessagesSet.clear();
    retryCountRef.current = 0;
  }, [readMessagesSet, deliveredMessagesSet]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Écouter les événements WebSocket pour les accusés de lecture (namespace par conversation)
  useEffect(() => {
    if (!conversationId) return;
    
    const readReceiptEvent = `read_receipt:${conversationId}`;
    const deliveredReceiptEvent = `delivered_receipt:${conversationId}`;
    
    const handleReadReceipt = (data) => {
      updateMessageReadStatus(data);
    };
    
    const handleDeliveredReceipt = (data) => {
      updateMessageDeliveredStatus(data);
    };
    
    messageSocketService.on(readReceiptEvent, handleReadReceipt);
    messageSocketService.on(deliveredReceiptEvent, handleDeliveredReceipt);
    
    return () => {
      messageSocketService.off(readReceiptEvent, handleReadReceipt);
      messageSocketService.off(deliveredReceiptEvent, handleDeliveredReceipt);
    };
  }, [conversationId, updateMessageReadStatus, updateMessageDeliveredStatus]);

  return {
    // États
    lastReadMessageId,
    lastReadTime,
    pendingCount: pendingReadsRef.current.size,
    
    // Actions
    markAsRead,
    markMultipleAsRead,
    markConversationAsRead,
    resetReadReceipts,
    
    // Requêtes
    isMessageRead,
    isMessageDelivered,
    getReaders,
    getReadCount,
    getMessageStatus,
    isSeenByAll
  };
};

export default useReadReceipts;
