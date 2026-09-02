import { useRef, useCallback } from 'react';

// =============================
// CONSTANTES
// =============================
const DEFAULT_TIMEOUT = 60000; // 60 secondes
const MAX_RETRIES = 3;

// =============================
// UTILITAIRES
// =============================
const getToken = () => localStorage.getItem('access_token');

// =============================
// HOOK PRINCIPAL
// =============================
export const useStreaming = () => {
  const controllerRef = useRef(null);
  const timeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  // =============================
  // NETTOYAGE
  // =============================
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  // =============================
  // DÉMARRAGE DU STREAMING (VERSION AMÉLIORÉE)
  // =============================
  const startStream = useCallback(async ({
    message,
    thread_id,
    onToken,        // ✅ Remplacé onChunk par onToken (plus simple)
    onDone,
    onError,
    onStart,
    timeout = DEFAULT_TIMEOUT,
    retryOnError = true,
    parseJSON = true // Option pour parser ou non le JSON
  }) => {
    // Nettoyer toute session précédente
    cleanup();

    try {
      controllerRef.current = new AbortController();
      
      // Timeout global
      timeoutRef.current = setTimeout(() => {
        controllerRef.current?.abort();
        onError?.(new Error('Délai d\'attente dépassé'));
        cleanup();
      }, timeout);

      const token = getToken();
      if (!token) {
        throw new Error('Non authentifié');
      }

      const response = await fetch('/api/ai/chat/stream', { // ✅ URL correcte pour le streaming
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message, thread_id }),
        signal: controllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Streaming non supporté');
      }

      onStart?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Vider le buffer restant
          if (buffer) {
            try {
              onToken?.(buffer);
            } catch (e) {
              console.warn('Erreur décodage chunk final:', e);
            }
          }
          onDone?.();
          cleanup();
          retryCountRef.current = 0;
          break;
        }

        // Décoder le chunk
        let chunk;
        try {
          chunk = decoder.decode(value, { stream: true });
        } catch (e) {
          console.warn('Erreur décodage chunk:', e);
          continue;
        }

        // Ajouter au buffer et traiter les lignes complètes
        buffer += chunk;
        
        // Traiter les lignes complètes
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Dernière ligne incomplète

        for (const line of lines) {
          if (line.trim()) {
            if (parseJSON) {
              try {
                // Essayer de parser comme JSON
                const parsed = JSON.parse(line);
                if (parsed.content) {
                  onToken?.(parsed.content);
                } else if (parsed.text) {
                  onToken?.(parsed.text);
                } else if (parsed.token) {
                  onToken?.(parsed.token);
                }
              } catch {
                // Si ce n'est pas du JSON, envoyer la ligne brute
                onToken?.(line);
              }
            } else {
              // Pas de parsing, envoyer directement
              onToken?.(line);
            }
          }
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        // Annulation volontaire, pas d'erreur
        onDone?.();
      } else {
        console.error('Streaming error:', error);
        
        // Tentative de retry pour erreurs réseau (optionnel)
        if (retryOnError && retryCountRef.current < MAX_RETRIES && 
            (error.message.includes('Network') || error.message.includes('fetch'))) {
          retryCountRef.current++;
          const delay = Math.pow(2, retryCountRef.current) * 1000;
          console.log(`Retry ${retryCountRef.current}/${MAX_RETRIES} dans ${delay}ms`);
          
          setTimeout(() => {
            startStream({ 
              message, 
              thread_id, 
              onToken, 
              onDone, 
              onError, 
              onStart, 
              timeout,
              retryOnError,
              parseJSON
            });
          }, delay);
        } else {
          onError?.(error);
        }
      }
      cleanup();
    }
  }, [cleanup]);

  // =============================
  // ARRÊT DU STREAMING
  // =============================
  const stopStream = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // =============================
  // ÉTAT DU STREAMING
  // =============================
  const isStreaming = useCallback(() => {
    return controllerRef.current !== null;
  }, []);

  return {
    startStream,
    stopStream,
    isStreaming
  };
};
