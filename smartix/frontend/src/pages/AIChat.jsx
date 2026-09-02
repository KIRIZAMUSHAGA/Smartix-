import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAIChat } from '../hooks/useAIChat';
import { useQuota } from '../hooks/useQuota';

// Composants
import ChatHeader from '../components/chat/ChatHeader';
import ChatMessages from '../components/chat/ChatMessages';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import QuotaModal from '../components/chat/QuotaModal';
import RenameModal from '../components/chat/RenameModal';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const QUOTA_REFRESH_INTERVAL = 3 * 60 * 1000; // 3 minutes (réduit la charge backend)

// =============================
// COMPOSANT DE CHARGEMENT
// =============================
const LoadingSpinner = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Chargement de l'assistant...</p>
    </div>
  </div>
);

// =============================
// COMPOSANT D'ERREUR
// =============================
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8">
    <div className="text-red-500 text-center">
      <p className="text-lg font-semibold mb-2">Une erreur est survenue</p>
      <p className="text-sm text-gray-500 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  </div>
);

// =============================
// COMPOSANT PRINCIPAL
// =============================
const AIChat = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const {
    messages,
    threads,
    currentThread,
    sendMessage,
    stopGeneration,
    loadThread,
    createThread,
    deleteThread,
    editMessage,
    regenerate,
    isStreaming,
    loading: chatLoading,
    error: chatError,
    refetchThreads,        // ✅ Pour recharger les threads
    refetchMessages        // ✅ Pour recharger les messages
  } = useAIChat();

  const {
    quota,
    showQuotaModal,
    openQuotaModal,
    closeQuotaModal,
    loading: quotaLoading,
    refreshQuota           // ✅ Pour rafraîchir le quota
  } = useQuota();

  // États pour les modals
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [threadToRename, setThreadToRename] = useState(null);

  // =============================
  // VÉRIFICATION AUTH
  // =============================
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // =============================
  // RAFRAÎCHISSEMENT QUOTA (OPTIMISÉ)
  // =============================
  useEffect(() => {
    if (!user) return;

    // ✅ Rafraîchir uniquement au retour sur l'onglet (pas d'intervalle)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshQuota();
      }
    };
    
    // ✅ Rafraîchir après chaque message (dans le hook useAIChat déjà)
    // ✅ Rafraîchir après actions utilisateur
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // ✅ Intervalle optionnel mais réduit (3 minutes)
    const interval = setInterval(() => {
      refreshQuota();
    }, QUOTA_REFRESH_INTERVAL);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshQuota]);

  // =============================
  // GESTION RENOMMAGE (mémorisée)
  // =============================
  const handleOpenRenameModal = useCallback((thread) => {
    setThreadToRename(thread);
    setShowRenameModal(true);
  }, []);

  const handleCloseRenameModal = useCallback(() => {
    setShowRenameModal(false);
    setThreadToRename(null);
  }, []);

  // ✅ CORRECTION: Renommer un thread recharge les threads, pas le quota
  const handleRenameSuccess = useCallback(async () => {
    try {
      // Recharger les threads après renommage
      await refetchThreads();
      toast.success('Conversation renommée');
    } catch (error) {
      console.error('Erreur après renommage:', error);
      toast.error('Erreur lors du rechargement');
    } finally {
      handleCloseRenameModal();
    }
  }, [refetchThreads, handleCloseRenameModal]);

  // =============================
  // GESTION DES ERREURS (version robuste)
  // =============================
  const handleRetry = useCallback(async () => {
    try {
      // ✅ Recharger tout ce qui peut être rechargé
      await Promise.allSettled([
        refreshQuota(),      // Recharger le quota
        refetchThreads(),    // Recharger les threads
        refetchMessages()    // Recharger les messages
      ]);
      toast.success('Reconnexion réussie');
    } catch (error) {
      console.error('Erreur lors du retry:', error);
      toast.error('Échec de la reconnexion');
    }
  }, [refreshQuota, refetchThreads, refetchMessages]);

  // =============================
  // VÉRIFICATION DU QUOTA (version safe)
  // =============================
  const isQuotaExceeded = useMemo(() => {
    // ✅ Safe: gère null, undefined, loading
    if (!quota) return false;
    if (quotaLoading) return false; // En cours de chargement
    return quota.remaining <= 0;
  }, [quota, quotaLoading]);

  // =============================
  // LOADING GLOBAL
  // =============================
  const isLoading = authLoading || (chatLoading && !messages.length);

  if (isLoading) return <LoadingSpinner />;

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900" role="main" aria-label="Assistant IA">
      {/* Sidebar */}
      <ChatSidebar
        threads={threads}
        currentThread={currentThread}
        loadThread={loadThread}
        createThread={createThread}
        deleteThread={deleteThread}
        onRename={handleOpenRenameModal}
      />

      {/* Zone principale */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <ChatHeader
          currentThread={currentThread}
          threads={threads}
          onOpenQuota={openQuotaModal}
          remainingQuota={quota?.remaining}
          quotaLimit={quota?.limit}
        />

        {chatError ? (
          <ErrorDisplay error={chatError} onRetry={handleRetry} />
        ) : (
          <ChatMessages
            messages={messages}
            onEdit={editMessage}
            onRegenerate={regenerate}
            loading={chatLoading}
          />
        )}

        <ChatInput
          sendMessage={sendMessage}
          stopGeneration={stopGeneration}
          isStreaming={isStreaming}
          disabled={chatLoading || quotaLoading || isQuotaExceeded}
          quotaExceeded={isQuotaExceeded}
          onQuotaExceeded={openQuotaModal}
        />
      </div>

      {/* Modals */}
      <QuotaModal
        open={showQuotaModal}
        quota={quota}
        loading={quotaLoading}
        onClose={closeQuotaModal}
        onUpgrade={() => navigate('/pricing')}
      />

      <RenameModal
        open={showRenameModal}
        thread={threadToRename}
        onClose={handleCloseRenameModal}
        onRenamed={handleRenameSuccess}
      />
    </div>
  );
};

AIChat.propTypes = {};

export default AIChat;
LoadingSpinner.propTypes = {};
ErrorDisplay.propTypes = {
  error: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
};
