
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { encryptMessage, decryptMessage } from '../utils/encryptionUtils';

// Configuration
const SOCKET_URL = window.location.origin;
const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 1000;
const TYPING_THROTTLE_MS = 2000; // 2 secondes minimum entre deux events typing
const TYPING_TIMEOUT = 3000;
const MAX_MESSAGE_LENGTH = 500;
const BATCH_SIZE = 5; // Nombre de messages à traiter par lot

// Types d'événements
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_ERROR: 'reconnect_error',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_EDITED: 'message_edited',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  TYPING: 'typing',
  REACTION_ADD: 'reaction_add',
  REACTION_REMOVE: 'reaction_remove',
  MESSAGE_REACTION: 'message_reaction',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  USER_STATUS: 'user_status',
  CONVERSATION_JOIN: 'conversation_join',
  CONVERSATION_LEAVE: 'conversation_leave',
  CONVERSATION_UPDATED: 'conversation_updated',
  READ_RECEIPT: 'read_receipt',
  DELIVERED_RECEIPT: 'delivered_receipt',
  ERROR: 'error',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_REFRESH: 'token_refresh'
};

// Événements internes (enum)
const INTERNAL_EVENTS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  RECONNECTED: 'reconnected',
  AUTH_EXPIRED: 'auth_expired',
  ERROR: 'error',
  OPTIMISTIC_MESSAGE: 'optimistic_message',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_ERROR: 'message_error',
  SYNC_MESSAGES: 'sync_messages'
};

// Statuts de message
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  ERROR: 'error'
};

/**
 * Stockage sécurisé IndexedDB pour la file d'attente
 */
class SecureMessageQueue {
  constructor(socketGetter) {
    this.queue = [];
    this.isProcessing = false;
    this.getSocket = socketGetter;
    this.dbName = 'MessageQueueDB';
    this.storeName = 'messages';
    this.db = null;
    this._initDB();
  }

  async _initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this._loadFromDB().then(resolve);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  async _loadFromDB() {
    if (!this.db) return;
    
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        this.queue = request.result || [];
        this.queue = this.queue.filter(msg => msg.retries < 3);
        resolve();
      };
      
      request.onerror = () => resolve();
    });
  }

  async _saveToDB() {
    if (!this.db) return;
    
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    // Clear existing
    store.clear();
    
    // Save all
    this.queue.forEach(msg => {
      store.put(msg);
    });
  }

  async add(message) {
    // Chiffrer le message avant stockage
    const encryptedContent = await encryptMessage(message.content);
    
    const queuedMessage = {
      ...message,
      content: encryptedContent,
      id: message.id || uuidv4(),
      timestamp: Date.now(),
      retries: 0,
      status: MESSAGE_STATUS.SENDING
    };
    
    this.queue.push(queuedMessage);
    await this._saveToDB();
    this.process();
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    const processNext = async () => {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }
      
      const batch = this.queue.slice(0, BATCH_SIZE);
      const remaining = this.queue.slice(BATCH_SIZE);
      
      for (const message of batch) {
        const socket = this.getSocket();
        
        try {
          if (socket && socket.connected) {
            const result = await this._sendWithTimeout(socket, message);
            if (result.success) {
              // Supprimer de la queue
              const index = this.queue.findIndex(m => m.id === message.id);
              if (index !== -1) this.queue.splice(index, 1);
            } else {
              throw new Error('Send failed');
            }
          } else {
            break;
          }
        } catch (err) {
          message.retries++;
          
          if (message.retries >= 3) {
            const index = this.queue.findIndex(m => m.id === message.id);
            if (index !== -1) this.queue.splice(index, 1);
          }
        }
      }
      
      await this._saveToDB();
      
      // Traiter le prochain lot asynchrone
      setTimeout(processNext, 0);
    };
    
    await processNext();
    this.isProcessing = false;
  }

  _sendWithTimeout(socket, message, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout'));
      }, timeout);
      
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, message, (response) => {
        clearTimeout(timer);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve({ success: true, data: response });
        }
      });
    });
  }

  async clear() {
    this.queue = [];
    await this._saveToDB();
  }

  getPendingCount() {
    return this.queue.length;
  }

  async updateMessageStatus(messageId, status) {
    const index = this.queue.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.queue[index].status = status;
      await this._saveToDB();
    }
  }
}

/**
 * Gestionnaire de rate limiting (côté client, mais le serveur doit aussi valider)
 */
class RateLimiter {
  constructor(maxMessages = 10, windowMs = 10000) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
    this.messages = [];
  }

  canSend() {
    const now = Date.now();
    this.messages = this.messages.filter(t => now - t < this.windowMs);
    return this.messages.length < this.maxMessages;
  }

  recordSend() {
    this.messages.push(Date.now());
  }

  getRemaining() {
    const now = Date.now();
    this.messages = this.messages.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxMessages - this.messages.length);
  }

  getResetTime() {
    if (this.messages.length === 0) return 0;
    const oldest = Math.min(...this.messages);
    return Math.max(0, oldest + this.windowMs - Date.now());
  }
}

/**
 * Sanitize un message pour prévenir XSS
 * @param {string} content - Contenu du message
 * @returns {string} - Contenu sanitizé
 */
const sanitizeMessage = (content) => {
  if (!content) return '';
  
  return content
    .replace(/[<>]/g, '') // Supprimer les balises HTML
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .slice(0, MAX_MESSAGE_LENGTH);
};

class MessageSocketService {
  constructor() {
    this._socket = null;
    this._isConnected = false;
    this.reconnectAttempts = 0;
    this.eventHandlers = new Map();
    this.currentUserId = null;
    this.currentConversationId = null;
    this.typingTimeouts = new Map();
    this.lastTypingSent = new Map(); // Throttle typing events
    this.rateLimiter = new RateLimiter();
    this.pendingMessageIds = new Set(); // Pour éviter les doublons
    this.lastSyncTime = null;
    
    // Initialiser la queue avec une fonction getter
    this.messageQueue = new SecureMessageQueue(() => this._socket);
  }

  /**
   * Rafraîchit le token d'authentification
   */
  async _refreshToken() {
    try {
      const refreshToken = localStorage.getItem('access_token');
      if (!refreshToken) throw new Error('No refresh token');
      
      const response = await fetch(`${SOCKET_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      
      if (!response.ok) throw new Error('Refresh failed');
      
      const { token } = await response.json();
      localStorage.setItem('auth_token', token);
      
      return token;
    } catch (err) {
      console.error('Token refresh failed:', err);
      this._triggerEvent(INTERNAL_EVENTS.AUTH_EXPIRED, {});
      return null;
    }
  }

  /**
   * Synchronise les messages perdus après reconnexion
   */
  async _syncMissedMessages() {
    if (!this.currentConversationId || !this._isConnected) return;
    
    try {
      const since = this.lastSyncTime || new Date(Date.now() - 3600000).toISOString();
      const response = await fetch(`${SOCKET_URL}/api/messages/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          conversationId: this.currentConversationId,
          since
        })
      });
      
      if (response.ok) {
        const messages = await response.json();
        if (messages.length > 0) {
          this._triggerEvent(INTERNAL_EVENTS.SYNC_MESSAGES, { messages });
        }
        this.lastSyncTime = new Date().toISOString();
      }
    } catch (err) {
      console.warn('Message sync failed:', err);
    }
  }

  /**
   * Initialise la connexion WebSocket
   * @param {string} token - Token d'authentification
   * @param {string} userId - ID de l'utilisateur courant
   */
  connect(token, userId) {
    if (this._socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.currentUserId = userId;

    this._socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      reconnectionDelay: RECONNECTION_DELAY,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this._setupEventListeners();
  }

  /**
   * Configure les écouteurs d'événements de base
   */
  _setupEventListeners() {
    if (!this._socket) return;

    this._socket.on(SOCKET_EVENTS.CONNECT, async () => {
      console.log('Socket connected');
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this._triggerEvent(INTERNAL_EVENTS.CONNECTED, { userId: this.currentUserId });
      
      if (this.currentConversationId) {
        this.joinConversation(this.currentConversationId);
      }
      
      await this.messageQueue.process();
      await this._syncMissedMessages();
    });

    this._socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log('Socket disconnected:', reason);
      this._isConnected = false;
      this._triggerEvent(INTERNAL_EVENTS.DISCONNECTED, { reason });
    });

    this._socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attempt) => {
      this.reconnectAttempts = attempt;
      this._triggerEvent(INTERNAL_EVENTS.RECONNECTING, { attempt });
    });

    this._socket.on(SOCKET_EVENTS.RECONNECT, () => {
      this._triggerEvent(INTERNAL_EVENTS.RECONNECTED, {});
    });

    this._socket.on(SOCKET_EVENTS.CONNECT_ERROR, async (error) => {
      console.error('Socket connection error:', error);
      
      if (error.message?.includes('jwt expired') || error.message?.includes('unauthorized')) {
        const newToken = await this._refreshToken();
        if (newToken && this._socket) {
          this._socket.auth = { token: newToken };
          this._socket.connect();
        } else {
          this._triggerEvent(INTERNAL_EVENTS.AUTH_EXPIRED, {});
          this.disconnect();
        }
      }
      
      this._triggerEvent(INTERNAL_EVENTS.ERROR, { error });
    });

    // Événements messages
    this._socket.on(SOCKET_EVENTS.NEW_MESSAGE, (data) => {
      // Vérifier doublon
      if (this.pendingMessageIds.has(data.id)) {
        return;
      }
      this.pendingMessageIds.add(data.id);
      setTimeout(() => this.pendingMessageIds.delete(data.id), 5000);
      
      this._triggerEvent('new_message', data);
    });

    this._socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, async (data) => {
      await this.messageQueue.updateMessageStatus(data.tempId, MESSAGE_STATUS.DELIVERED);
      this._triggerEvent('message_delivered', data);
    });

    this._socket.on(SOCKET_EVENTS.MESSAGE_READ, (data) => {
      this._triggerEvent('message_read', data);
    });

    this._socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data) => {
      this._triggerEvent('message_deleted', data);
    });

    this._socket.on(SOCKET_EVENTS.MESSAGE_EDITED, (data) => {
      this._triggerEvent('message_edited', data);
    });

    // Typing (avec throttling)
    this._socket.on(SOCKET_EVENTS.TYPING, (data) => {
      this._triggerEvent('typing', data);
    });

    // Réactions
    this._socket.on(SOCKET_EVENTS.MESSAGE_REACTION, (data) => {
      this._triggerEvent('message_reaction', data);
    });

    // Statut utilisateur
    this._socket.on(SOCKET_EVENTS.USER_STATUS, (data) => {
      this._triggerEvent('user_status', data);
    });

    // Conversations
    this._socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, (data) => {
      this._triggerEvent('conversation_updated', data);
    });

    // Read receipts
    this._socket.on(SOCKET_EVENTS.READ_RECEIPT, (data) => {
      this._triggerEvent('read_receipt', data);
    });

    this._socket.on(SOCKET_EVENTS.DELIVERED_RECEIPT, (data) => {
      this._triggerEvent('delivered_receipt', data);
    });

    this._socket.on(SOCKET_EVENTS.ERROR, (error) => {
      console.error('Socket error:', error);
      this._triggerEvent('socket_error', error);
    });
  }

  /**
   * Déconnecte le socket
   */
  disconnect() {
    if (this._socket) {
      if (this.currentConversationId) {
        this.leaveConversation(this.currentConversationId);
      }
      this._socket.disconnect();
      this._socket = null;
      this._isConnected = false;
      this.currentUserId = null;
      this.currentConversationId = null;
    }
  }

  /**
   * Rejoint une conversation (pour recevoir les messages)
   * @param {string} conversationId - ID de la conversation
   */
  joinConversation(conversationId) {
    if (!this._socket || !this._isConnected) return;
    
    if (this.currentConversationId) {
      this.leaveConversation(this.currentConversationId);
    }
    
    this.currentConversationId = conversationId;
    this._socket.emit(SOCKET_EVENTS.CONVERSATION_JOIN, { conversationId });
    this._syncMissedMessages();
  }

  /**
   * Quitte une conversation
   * @param {string} conversationId - ID de la conversation
   */
  leaveConversation(conversationId) {
    if (!this._socket || !this._isConnected) return;
    this._socket.emit(SOCKET_EVENTS.CONVERSATION_LEAVE, { conversationId });
  }

  /**
   * Valide un message avant envoi
   * @param {Object} message - Message à valider
   * @returns {Object} - { valid, error }
   */
  _validateMessage(message) {
    if (!message.content || !message.content.trim()) {
      return { valid: false, error: 'Message vide' };
    }
    
    if (message.content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères)` };
    }
    
    if (!this.rateLimiter.canSend()) {
      const resetTime = this.rateLimiter.getResetTime();
      return { valid: false, error: `Trop de messages, réessayez dans ${Math.ceil(resetTime / 1000)}s` };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Envoie un message (avec optimistic UI)
   * @param {Object} message - Message à envoyer
   * @returns {Promise} - Promesse résolue à l'envoi
   */
  async sendMessage(message) {
    // Sanitize et validation
    const sanitizedContent = sanitizeMessage(message.content);
    const validation = this._validateMessage({ ...message, content: sanitizedContent });
    
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Rate limiting
    this.rateLimiter.recordSend();
    
    // Génération d'un ID temporaire pour optimistic UI
    const tempId = uuidv4();
    const optimisticMessage = {
      ...message,
      content: sanitizedContent,
      id: tempId,
      status: MESSAGE_STATUS.SENDING,
      created_at: new Date().toISOString(),
      optimistic: true
    };
    
    // Notifier l'UI immédiatement
    this._triggerEvent(INTERNAL_EVENTS.OPTIMISTIC_MESSAGE, optimisticMessage);
    
    if (!this._socket || !this._isConnected) {
      await this.messageQueue.add(message);
      return { tempId, queued: true };
    }
    
    try {
      const response = await this._sendWithTimeout(message, tempId);
      this._triggerEvent(INTERNAL_EVENTS.MESSAGE_SENT, { tempId, ...response });
      return { tempId, success: true, ...response };
    } catch (error) {
      this._triggerEvent(INTERNAL_EVENTS.MESSAGE_ERROR, { tempId, error: error.message });
      throw error;
    }
  }

  _sendWithTimeout(message, tempId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout'));
      }, timeout);
      
      this._socket.emit(SOCKET_EVENTS.SEND_MESSAGE, { ...message, tempId }, (response) => {
        clearTimeout(timer);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Envoie un accusé de lecture
   * @param {string} messageId - ID du message
   * @param {string} senderId - ID de l'expéditeur
   */
  sendReadReceipt(messageId, senderId) {
    if (!this._socket || !this._isConnected) return;
    
    this._socket.emit(SOCKET_EVENTS.READ_RECEIPT, {
      messageId,
      senderId,
      readerId: this.currentUserId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Envoie un accusé de réception
   * @param {string} messageId - ID du message
   * @param {string} senderId - ID de l'expéditeur
   */
  sendDeliveredReceipt(messageId, senderId) {
    if (!this._socket || !this._isConnected) return;
    
    this._socket.emit(SOCKET_EVENTS.DELIVERED_RECEIPT, {
      messageId,
      senderId,
      receiverId: this.currentUserId
    });
  }

  /**
   * Envoie le statut de frappe (avec throttling)
   * @param {string} recipientId - ID du destinataire
   * @param {boolean} isTyping - Est en train d'écrire
   */
  sendTypingStatus(recipientId, isTyping) {
    if (!this._socket || !this._isConnected) return;
    
    const key = `${recipientId}`;
    const now = Date.now();
    const lastSent = this.lastTypingSent.get(key) || 0;
    
    // Throttle: ne pas envoyer plus d'une fois toutes les 2 secondes
    if (isTyping && now - lastSent < TYPING_THROTTLE_MS) {
      return;
    }
    
    // Nettoyer l'ancien timeout
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key));
      this.typingTimeouts.delete(key);
    }
    
    this.lastTypingSent.set(key, now);
    this._socket.emit(SOCKET_EVENTS.TYPING, {
      recipientId,
      isTyping,
      senderId: this.currentUserId
    });
    
    if (isTyping) {
      const timeout = setTimeout(() => {
        this.sendTypingStatus(recipientId, false);
        this.typingTimeouts.delete(key);
      }, TYPING_TIMEOUT);
      
      this.typingTimeouts.set(key, timeout);
    }
  }

  /**
   * Ajoute une réaction à un message
   * @param {string} messageId - ID du message
   * @param {string} senderId - ID de l'expéditeur
   * @param {string} reaction - Emoji de réaction
   */
  sendReaction(messageId, senderId, reaction) {
    if (!this._socket || !this._isConnected) return;
    
    this._socket.emit(SOCKET_EVENTS.REACTION_ADD, {
      messageId,
      senderId,
      reaction,
      userId: this.currentUserId
    });
  }

  /**
   * Supprime une réaction
   * @param {string} messageId - ID du message
   * @param {string} senderId - ID de l'expéditeur
   */
  removeReaction(messageId, senderId) {
    if (!this._socket || !this._isConnected) return;
    
    this._socket.emit(SOCKET_EVENTS.REACTION_REMOVE, {
      messageId,
      senderId,
      userId: this.currentUserId
    });
  }

  /**
   * Enregistre un gestionnaire d'événement
   * @param {string} event - Nom de l'événement
   * @param {Function} handler - Fonction de rappel
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  /**
   * Supprime un gestionnaire d'événement
   * @param {string} event - Nom de l'événement
   * @param {Function} handler - Fonction de rappel
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  /**
   * Déclenche un événement
   * @param {string} event - Nom de l'événement
   * @param {any} data - Données associées
   */
  _triggerEvent(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Vérifie si le socket est connecté
   * @returns {boolean}
   */
  isConnected() {
    return this._isConnected && this._socket?.connected;
  }

  /**
   * Obtient le nombre de messages en attente
   * @returns {number}
   */
  getPendingMessageCount() {
    return this.messageQueue.getPendingCount();
  }

  /**
   * Obtient les statistiques de rate limiting
   * @returns {Object}
   */
  getRateLimitInfo() {
    return {
      remaining: this.rateLimiter.getRemaining(),
      resetTime: this.rateLimiter.getResetTime()
    };
  }

  /**
   * Nettoie toutes les ressources
   */
  destroy() {
    this.disconnect();
    this.eventHandlers.clear();
    this.messageQueue.clear();
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
    this.lastTypingSent.clear();
    this.pendingMessageIds.clear();
  }
}

  // =============================
// FONCTIONS D'ABONNEMENT POUR LA LISTE DES CONVERSATIONS
// =============================

export const subscribeToTypingStatuses = (callback, errorCallback) => {
  const socket = messageSocketService._socket;
  
  if (!socket || !messageSocketService._isConnected) {
    console.warn('Socket not available for typing subscription');
    if (errorCallback) errorCallback(new Error('Socket not connected'));
    return () => {};
  }
  
  const handleTyping = (data) => {
    try {
      callback(data);
    } catch (err) {
      console.error('Error in typing callback:', err);
      if (errorCallback) errorCallback(err);
    }
  };
  
  socket.on(SOCKET_EVENTS.TYPING, handleTyping);
  
  return () => {
    socket.off(SOCKET_EVENTS.TYPING, handleTyping);
  };
};

export const subscribeToUserStatus = (callback, errorCallback) => {
  const socket = messageSocketService._socket;
  
  if (!socket || !messageSocketService._isConnected) {
    console.warn('Socket not available for status subscription');
    if (errorCallback) errorCallback(new Error('Socket not connected'));
    return () => {};
  }
  
  const handleUserStatus = (data) => {
    try {
      callback(data);
    } catch (err) {
      console.error('Error in status callback:', err);
      if (errorCallback) errorCallback(err);
    }
  };
  
  socket.on(SOCKET_EVENTS.USER_STATUS, handleUserStatus);
  
  return () => {
    socket.off(SOCKET_EVENTS.USER_STATUS, handleUserStatus);
  };
};

// =============================
// EXPORT DE L'INSTANCE UNIQUE
// =============================

// Export d'une instance unique (singleton)
export const messageSocketService = new MessageSocketService();

// Hook React pour utiliser le service
export const useMessageSocket = () => {
  const [isConnected, setIsConnected] = React.useState(messageSocketService.isConnected());
  const [pendingCount, setPendingCount] = React.useState(0);
  const [rateLimitInfo, setRateLimitInfo] = React.useState(messageSocketService.getRateLimitInfo());

  React.useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setPendingCount(messageSocketService.getPendingMessageCount());
    };
    
    const handleDisconnected = () => {
      setIsConnected(false);
    };
    
    const handleReconnecting = () => {
      setIsConnected(false);
    };
    
    const handleAuthExpired = () => {
      window.location.href = '/login';
    };
    
    const handleMessageSent = () => {
      setPendingCount(messageSocketService.getPendingMessageCount());
    };
    
    messageSocketService.on(INTERNAL_EVENTS.CONNECTED, handleConnected);
    messageSocketService.on(INTERNAL_EVENTS.DISCONNECTED, handleDisconnected);
    messageSocketService.on(INTERNAL_EVENTS.RECONNECTING, handleReconnecting);
    messageSocketService.on(INTERNAL_EVENTS.AUTH_EXPIRED, handleAuthExpired);
    messageSocketService.on(INTERNAL_EVENTS.MESSAGE_SENT, handleMessageSent);
    
    return () => {
      messageSocketService.off(INTERNAL_EVENTS.CONNECTED, handleConnected);
      messageSocketService.off(INTERNAL_EVENTS.DISCONNECTED, handleDisconnected);
      messageSocketService.off(INTERNAL_EVENTS.RECONNECTING, handleReconnecting);
      messageSocketService.off(INTERNAL_EVENTS.AUTH_EXPIRED, handleAuthExpired);
      messageSocketService.off(INTERNAL_EVENTS.MESSAGE_SENT, handleMessageSent);
    };
  }, []);

  return {
    socketService: messageSocketService,
    isConnected,
    pendingCount,
    rateLimitInfo
  };
};

// Fonctions d'interface nommées pour compatibilité avec les imports existants
export const initiateSocket = (userId) => {
  const token = localStorage.getItem('access_token');
  messageSocketService.connect(token, userId);
};

export const disconnectSocket = () => {
  messageSocketService.disconnect();
};

// Import React pour le hook (nécessaire)
import React from 'react';

export default messageSocketService;
