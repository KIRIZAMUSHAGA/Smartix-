import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook WebSocket pour réactions temps réel story
 * Gère connexion, reconnexion, et messaging
 */
export const useWebSocket = (storyId, onMessage, enabled = true) => {
  const ws = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000; // 1s initial, exponential backoff

  const connect = useCallback(() => {
    if (!enabled || !storyId || ws.current) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/stories/${storyId}/reactions/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected for story:', storyId);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };

      ws.current.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        ws.current = null;
        
        // Reconnect avec backoff exponentiel
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    }
  }, [storyId, enabled, onMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
  }, []);

  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds
  }, []);

  const send = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (enabled && storyId) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [storyId, enabled, connect, disconnect]);

  return {
    isConnected,
    send,
    disconnect
  };
};

export default useWebSocket;
