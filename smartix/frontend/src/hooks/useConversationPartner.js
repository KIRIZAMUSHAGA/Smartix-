// src/hooks/useConversationPartner.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getKeyFingerprint } from '../utils/encryptionUtils';
import { messageSocketService } from '../services/messageSocketService';
import { toast } from 'sonner';

// Hooks personnalisés
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';

// =============================
// CONSTANTES
// =============================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const RETRY_BACKOFF_MULTIPLIER = 2;

// =============================
// HOOK PRINCIPAL
// =============================
const useConversationPartner = (conversationId, currentUser) => {
  const { client } = useApiClient();
  const { getConversationPartnerCache, updateConversationPartnerCache, invalidateConversationPartnerCache } = useGlobalCache();
  
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const retryTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);
  const cachedPartnerRef = useRef(null);

  // =============================
  // FONCTION DE RÉCUPÉRATION AVEC RETRY
  // =============================
  const fetchPartnerWithRetry = useCallback(async (attempt = 0) => {
    try {
      const response = await client.get(`/api/conversations/${conversationId}/partner`, {
        signal: abortControllerRef.current?.signal
      });
      return response.data;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      
      // Retry uniquement pour les erreurs serveur (5xx) ou timeout
      const isRetryable = err.code === 'ECONNABORTED' || 
                          (err.response?.status >= 500 && err.response?.status < 600);
      
      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchPartnerWithRetry(attempt + 1);
      }
      throw err;
    }
  }, [client, conversationId]);

  /**
   * Vérifie si la clé publique a changé (rotation)
   */
  const checkPublicKeyChange = useCallback((newPublicKey, oldPublicKey) => {
    if (!oldPublicKey || !newPublicKey) return false;
    if (oldPublicKey === newPublicKey) return false;
    
    // Clé modifiée - avertir l'utilisateur
    setVerificationStatus({
      success: false,
      message: '⚠️ La clé de sécurité a été mise à jour. Vérifiez l\'identité du contact.',
      severity: 'warning'
    });
    
    toast.warning('La clé de sécurité a changé', {
      description: 'Vérifiez l\'identité de votre contact',
      duration: 5000
    });
    
    return true;
  }, []);

  /**
   * Récupère les informations du partenaire
   */
  const fetchPartner = useCallback(async (force = false) => {
    // Éviter les appels simultanés
    if (isFetchingRef.current) {
      return;
    }
    
    if (!conversationId || !currentUser?.id) {
      setLoading(false);
      return;
    }

    // Vérifier le cache (sauf si force refresh)
    if (!force) {
      const cached = getConversationPartnerCache(conversationId, currentUser.id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        cachedPartnerRef.current = cached.data;
        setPartner(cached.data);
        setLoading(false);
        return;
      }
    }

    // Rate limiting côté client (éviter les spams de refresh)
    const now = Date.now();
    if (!force && (now - lastFetchRef.current) < 1000) {
      return;
    }
    lastFetchRef.current = now;

    // Annuler la requête précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const partnerData = await fetchPartnerWithRetry();
      
      if (!partnerData && isMountedRef.current) {
        throw new Error('Partenaire non trouvé');
      }
      
      if (partnerData && isMountedRef.current) {
        // Vérifier si la clé publique a changé
        const oldPublicKey = cachedPartnerRef.current?.public_key;
        checkPublicKeyChange(partnerData.public_key, oldPublicKey);
        
        // Récupérer l'empreinte de la clé publique
        let fingerprint = null;
        if (partnerData.public_key) {
          fingerprint = await getKeyFingerprint(partnerData.public_key);
        }
        
        const enrichedPartner = {
          id: partnerData.id,
          full_name: partnerData.full_name || partnerData.username,
          username: partnerData.username,
          avatar: partnerData.avatar,
          is_online: partnerData.is_online || false,
          last_seen: partnerData.last_seen,
          public_key: partnerData.public_key,
          verified: partnerData.verified || false,
          fingerprint,
          encryption_verified: partnerData.verified || false
        };
        
        cachedPartnerRef.current = enrichedPartner;
        setPartner(enrichedPartner);
        
        // Mettre en cache
        updateConversationPartnerCache(conversationId, currentUser.id, {
          data: enrichedPartner,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        console.error('Fetch partner error:', err);
        
        if (err.response?.status === 401) {
          setError('Session expirée, reconnectez-vous');
          toast.error('Session expirée');
        } else if (err.response?.status === 404) {
          setError('Conversation ou utilisateur non trouvé');
        } else if (err.response?.status === 429) {
          setError('Trop de requêtes, patientez');
          toast.error('Trop de requêtes');
        } else if (err.code === 'ECONNABORTED') {
          setError('La requête a expiré, réessayez');
        } else {
          setError('Impossible de charger les informations');
          
          // Retry automatique uniquement si pas déjà en cours
          if (!retryTimeoutRef.current && !force) {
            retryTimeoutRef.current = setTimeout(() => {
              retryTimeoutRef.current = null;
              if (isMountedRef.current) {
                fetchPartner(false);
              }
            }, 2000);
          }
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [conversationId, currentUser?.id, getConversationPartnerCache, updateConversationPartnerCache, fetchPartnerWithRetry, checkPublicKeyChange]);

  /**
   * Rafraîchit les données du partenaire
   */
  const refresh = useCallback(() => {
    // Annuler tout retry en cours
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    return fetchPartner(true);
  }, [fetchPartner]);

  /**
   * Met à jour le statut en ligne du partenaire (sans dépendance circulaire)
   */
  const updatePartnerStatus = useCallback((statusData) => {
    setPartner(prev => {
      if (!prev) return prev;
      
      const updated = {
        ...prev,
        is_online: statusData.is_online,
        last_seen: statusData.last_seen || prev.last_seen
      };
      
      // Mettre à jour le cache
      if (conversationId && currentUser?.id) {
        updateConversationPartnerCache(conversationId, currentUser.id, {
          data: updated,
          timestamp: Date.now()
        });
      }
      
      return updated;
    });
  }, [conversationId, currentUser?.id, updateConversationPartnerCache]);

  /**
   * Vérifie l'identité du partenaire
   */
  const verifyIdentity = useCallback(async (expectedFingerprint = null) => {
    if (!partner?.id || !partner?.public_key) {
      toast.error('Impossible de vérifier l\'identité : clé publique manquante');
      return false;
    }
    
    setIsVerifying(true);
    setVerificationStatus(null);
    
    try {
      const response = await client.get(`/api/users/${partner.id}/public-key`);
      const serverPublicKey = response.data.public_key;
      
      if (!serverPublicKey) {
        throw new Error('Clé publique non trouvée sur le serveur');
      }
      
      if (serverPublicKey !== partner.public_key) {
        setVerificationStatus({
          success: false,
          message: '⚠️ La clé publique a changé. Méfiez-vous d\'une possible interception.',
          severity: 'error'
        });
        toast.error('Vérification échouée : clé publique modifiée');
        return false;
      }
      
      const fingerprint = await getKeyFingerprint(serverPublicKey);
      
      if (expectedFingerprint && fingerprint !== expectedFingerprint) {
        setVerificationStatus({
          success: false,
          message: '🔐 L\'empreinte ne correspond pas. Vérifiez avec votre contact.',
          severity: 'warning'
        });
        toast.warning('L\'empreinte ne correspond pas');
        return false;
      }
      
      setVerificationStatus({
        success: true,
        message: '✅ Identité vérifiée. La conversation est sécurisée.',
        severity: 'success',
        fingerprint
      });
      
      setPartner(prev => {
        if (!prev) return prev;
        
        const updated = {
          ...prev,
          encryption_verified: true,
          fingerprint
        };
        
        // Mettre à jour le cache
        if (conversationId && currentUser?.id) {
          updateConversationPartnerCache(conversationId, currentUser.id, {
            data: updated,
            timestamp: Date.now()
          });
        }
        
        return updated;
      });
      
      toast.success('Identité vérifiée avec succès');
      return true;
      
    } catch (err) {
      console.error('Identity verification failed:', err);
      setVerificationStatus({
        success: false,
        message: '❌ Erreur lors de la vérification',
        severity: 'error'
      });
      toast.error('Erreur lors de la vérification');
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [partner, client, conversationId, currentUser?.id, updateConversationPartnerCache]);

  /**
   * Génère une empreinte lisible
   */
  const getDisplayFingerprint = useCallback(() => {
    if (!partner?.fingerprint) return null;
    // Format: XXXX XXXX XXXX XXXX (4 blocs de 4 caractères)
    const fp = partner.fingerprint;
    return fp.match(/.{1,4}/g)?.join(' ') || fp;
  }, [partner?.fingerprint]);

  /**
   * Vérifie si la conversation est sécurisée
   */
  const isEncrypted = useCallback(() => {
    return !!partner?.public_key;
  }, [partner?.public_key]);

  /**
   * Vérifie si l'identité est vérifiée
   */
  const isVerified = useCallback(() => {
    return partner?.encryption_verified === true;
  }, [partner?.encryption_verified]);

  /**
   * Niveau de sécurité (pour affichage)
   */
  const securityLevel = useMemo(() => {
    if (!isEncrypted()) return 'none';
    if (isVerified()) return 'verified';
    return 'encrypted';
  }, [isEncrypted, isVerified]);

  // Invalider le cache à la déconnexion du composant
  useEffect(() => {
    return () => {
      if (conversationId && currentUser?.id) {
        // Invalider le cache (optionnel, selon besoin)
        // invalidateConversationPartnerCache(conversationId, currentUser.id);
      }
    };
  }, [conversationId, currentUser?.id]);

  // Écouter les changements de statut WebSocket
  useEffect(() => {
    if (!partner?.id) return;
    
    const handleUserStatus = (data) => {
      if (data.user_id === partner.id) {
        updatePartnerStatus({
          is_online: data.status === 'online',
          last_seen: data.last_seen
        });
      }
    };
    
    messageSocketService.on('user_status', handleUserStatus);
    
    return () => {
      messageSocketService.off('user_status', handleUserStatus);
    };
  }, [partner?.id, updatePartnerStatus]);

  // Chargement initial
  useEffect(() => {
    isMountedRef.current = true;
    fetchPartner();
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      isFetchingRef.current = false;
    };
  }, [fetchPartner]);

  return {
    partner,
    loading,
    error,
    refresh,
    updatePartnerStatus,
    verifyIdentity,
    getDisplayFingerprint,
    isEncrypted,
    isVerified,
    securityLevel,
    isVerifying,
    verificationStatus
  };
};

export default useConversationPartner;
