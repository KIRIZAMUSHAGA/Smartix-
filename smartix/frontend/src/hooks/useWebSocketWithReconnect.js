// hooks/useWebSocketWithReconnect.js
import { useState, useEffect, useRef, useCallback } from 'react';

// =============================
// CONSTANTES
// =============================
const DEFAULT_RECONNECT_INTERVAL = 3000; // 3 secondes
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_HEARTBEAT_INTERVAL = 30000; // 30 secondes
const DEFAULT_HEARTBEAT_TIMEOUT = 5000; // 5 secondes
const DEFAULT_MESSAGE_TIMEOUT = 10000; // 10 secondes

// =============================
// HOOK: WEBSOCKET AVEC RECONNEXION
// =============================
export const useWebSocketWithReconnect = ({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = DEFAULT_RECONNECT_INTERVAL,
  maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
  heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
  heartbeatTimeout = DEFAULT_HEARTBEAT_TIMEOUT,
  authToken = null,
  autoConnect = true
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastError, setLastError] = useState(null);

  // Refs pour éviter les closures stale
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const isExplicitlyClosedRef = useRef(false);
  const currentWsRef = useRef(null); // Pour éviter les doubles appels
  const reconnectAttemptRef = useRef(0);
  const pendingMessagesRef = useRef(new Map());

  // =============================
  // NETTOYAGE DES TIMEOUTS
  // =============================
  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // =============================
  // FERMETURE PROPRE
  // =============================
  const close = useCallback((code = 1000, reason = 'Normal closure') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(code, reason);
    }
    clearHeartbeat();
    setIsConnected(false);
    setIsConnecting(false);
  }, [clearHeartbeat]);

  // =============================
  // ANNULATION DE LA RECONNEXION
  // =============================
  const cancelReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // =============================
  // RECONNEXION AVEC BACKOFF EXPONENTIEL (basé sur ref)
  // =============================
  const scheduleReconnect = useCallback(() => {
    if (!reconnect || isExplicitlyClosedRef.current) return;
    
    cancelReconnect();
    
    const nextAttempt = reconnectAttemptRef.current + 1;
    
    if (nextAttempt > maxReconnectAttempts) {
      setLastError(new Error(`Max reconnect attempts (${maxReconnectAttempts}) reached`));
      setReconnectAttempt(nextAttempt);
      return;
    }
    
    // Backoff exponentiel avec jitter
    const backoff = Math.min(
      reconnectInterval * Math.pow(1.5, reconnectAttemptRef.current),
      60000 // Max 60 secondes
    );
    const jitter = Math.random() * 1000;
    const delay = backoff + jitter;
    
    reconnectAttemptRef.current = nextAttempt;
    setReconnectAttempt(nextAttempt);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !isExplicitlyClosedRef.current) {
        connect();
      }
    }, delay);
  }, [reconnect, maxReconnectAttempts, reconnectInterval]);

  // =============================
  // ENVOI DE MESSAGE (corrigé)
  // =============================
  const send = useCallback((data, timeout = DEFAULT_MESSAGE_TIMEOUT) => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const messageId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      
      // ✅ CORRECTION: payload correct pour string et objet
      let payload;
      if (typeof data === 'string') {
        payload = JSON.stringify({ id: messageId, data });
      } else if (typeof data === 'object') {
        payload = JSON.stringify({ id: messageId, ...data });
      } else {
        payload = JSON.stringify({ id: messageId, data });
      }
      
      let timeoutId;
      
      const handleResponse = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.id === messageId) {
            cleanup();
            resolve(response);
          }
        } catch (err) {
          // Ignorer les messages non JSON
        }
      };
      
      const cleanup = () => {
        ws.removeEventListener('message', handleResponse);
        clearTimeout(timeoutId);
        pendingMessagesRef.current.delete(messageId);
      };
      
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Message timeout'));
      }, timeout);
      
      pendingMessagesRef.current.set(messageId, cleanup);
      ws.addEventListener('message', handleResponse);
      ws.send(payload);
    });
  }, []);

  // =============================
  // HEARTBEAT (corrigé)
  // =============================
  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    
    heartbeatIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && !isExplicitlyClosedRef.current) {
        try {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          
          // ✅ CORRECTION: nettoyer l'ancien timeout avant d'en créer un nouveau
          if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
          }
          
          heartbeatTimeoutRef.current = setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN && !isExplicitlyClosedRef.current) {
              ws.close(1000, 'Heartbeat timeout');
            }
          }, heartbeatTimeout);
        } catch (err) {
          console.warn('Heartbeat send error:', err);
        }
      }
    }, heartbeatInterval);
  }, [clearHeartbeat, heartbeatInterval, heartbeatTimeout]);

  // =============================
  // CONNEXION PRINCIPALE (corrigée)
  // =============================
  const connect = useCallback(() => {
    if (isConnecting || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }
    
    setIsConnecting(true);
    setLastError(null);
    
    let wsUrl = url;
    
    if (authToken) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(authToken)}`;
    }
    
    try {
      const ws = new WebSocket(wsUrl);
      currentWsRef.current = ws;
      wsRef.current = ws;
      
      ws.onopen = () => {
        if (!isMountedRef.current || currentWsRef.current !== ws) return;
        
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        startHeartbeat();
        
        if (onOpen) onOpen();
      };
      
      ws.onmessage = (event) => {
        if (!isMountedRef.current || currentWsRef.current !== ws) return;
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'pong') {
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
              heartbeatTimeoutRef.current = null;
            }
            return;
          }
          
          if (onMessage) onMessage(data);
        } catch (err) {
          if (onMessage) onMessage(event.data);
        }
      };
      
      ws.onerror = (event) => {
        if (!isMountedRef.current || currentWsRef.current !== ws) return;
        
        const error = new Error('WebSocket connection error');
        setLastError(error);
        if (onError) onError(error);
      };
      
      ws.onclose = (event) => {
        if (!isMountedRef.current || currentWsRef.current !== ws) return;
        
        setIsConnected(false);
        setIsConnecting(false);
        clearHeartbeat();
        
        // Nettoyer tous les messages en attente
        for (const [_, cleanup] of pendingMessagesRef.current) {
          cleanup();
        }
        pendingMessagesRef.current.clear();
        
        // ✅ CORRECTION: éviter double reconnect
        if (!isExplicitlyClosedRef.current && !reconnectTimeoutRef.current) {
          scheduleReconnect();
        }
        
        if (onClose) onClose(event);
      };
      
    } catch (err) {
      if (currentWsRef.current === wsRef.current) {
        setLastError(err);
        setIsConnecting(false);
        if (onError) onError(err);
        
        if (!isExplicitlyClosedRef.current) {
          scheduleReconnect();
        }
      }
    }
  }, [url, authToken, onOpen, onMessage, onClose, onError, startHeartbeat, scheduleReconnect, isConnecting]);

  // =============================
  // RECONNEXION MANUELLE
  // =============================
  const reconnectNow = useCallback(() => {
    cancelReconnect();
    isExplicitlyClosedRef.current = false;
    close();
    setTimeout(() => connect(), 100);
  }, [cancelReconnect, close, connect]);

  // =============================
  // FERMETURE MANUELLE
  // =============================
  const disconnect = useCallback(() => {
    isExplicitlyClosedRef.current = true;
    cancelReconnect();
    close();
  }, [cancelReconnect, close]);

  // =============================
  // RÉINITIALISATION
  // =============================
  const reset = useCallback(() => {
    isExplicitlyClosedRef.current = false;
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    setLastError(null);
    reconnectNow();
  }, [reconnectNow]);

  // =============================
  // CONNEXION AUTOMATIQUE
  // =============================
  useEffect(() => {
    isMountedRef.current = true;
    
    if (autoConnect) {
      connect();
    }
    
    return () => {
      isMountedRef.current = false;
      isExplicitlyClosedRef.current = true;
      cancelReconnect();
      clearHeartbeat();
      
      // Nettoyer tous les messages en attente
      for (const [_, cleanup] of pendingMessagesRef.current) {
        cleanup();
      }
      pendingMessagesRef.current.clear();
      
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'Component unmount');
        }
        wsRef.current = null;
      }
      currentWsRef.current = null;
    };
  }, [autoConnect, connect, cancelReconnect, clearHeartbeat]);

  return {
    isConnected,
    isConnecting,
    reconnectAttempt,
    lastError,
    send,
    connect,
    disconnect,
    reconnectNow,
    reset,
    close: disconnect
  };
};

export default useWebSocketWithReconnect;
