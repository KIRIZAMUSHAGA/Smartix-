import { useState, useEffect, useCallback, useRef } from 'react';
import { getQuota } from '../services/aiService';
import { toast } from 'sonner';

// =============================
// CONSTANTES
// =============================
const REFRESH_INTERVAL = 60000; // 1 minute
const WARNING_THRESHOLD = 0.2; // 20% du quota restant

export const useQuota = () => {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const refreshTimerRef = useRef(null);

  // =============================
  // CHARGEMENT DU QUOTA
  // =============================
  const loadQuota = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getQuota(force);
      setQuota(data);

      // Alerte si quota faible
      if (data.remaining && data.total) {
        const ratio = data.remaining / data.total;
        if (ratio < WARNING_THRESHOLD && !showQuotaModal) {
          setShowQuotaModal(true);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to load quota:', err);
    } finally {
      setLoading(false);
    }
  }, [showQuotaModal]);

  // =============================
  // RAFRAÎCHISSEMENT PÉRIODIQUE
  // =============================
  useEffect(() => {
    loadQuota();

    refreshTimerRef.current = setInterval(() => {
      loadQuota(true); // force refresh
    }, REFRESH_INTERVAL);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [loadQuota]);

  // =============================
  // VÉRIFICATION DU QUOTA
  // =============================
  const checkQuota = useCallback(() => {
    if (!quota) return false;
    
    if (quota.remaining <= 0) {
      setShowQuotaModal(true);
      return false;
    }
    
    return true;
  }, [quota]);

  // =============================
  // DÉCRÉMENTER LE QUOTA (après envoi)
  // =============================
  const decrementQuota = useCallback(() => {
    setQuota(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        remaining: Math.max(0, prev.remaining - 1)
      };
    });
  }, []);

  // =============================
  // OUVERTURE MODAL
  // =============================
  const openQuotaModal = useCallback(() => {
    setShowQuotaModal(true);
  }, []);

  // =============================
  // FERMETURE MODAL
  // =============================
  const closeQuotaModal = useCallback(() => {
    setShowQuotaModal(false);
  }, []);

  // =============================
  // RÉINITIALISATION (après achat)
  // =============================
  const resetQuota = useCallback(() => {
    loadQuota(true);
    closeQuotaModal();
    toast.success('Quota mis à jour !');
  }, [loadQuota, closeQuotaModal]);

  return {
    quota,
    loading,
    error,
    showQuotaModal,
    openQuotaModal,
    closeQuotaModal,
    checkQuota,
    decrementQuota,
    resetQuota
  };
};
