
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

// =============================
// CONSTANTES
// =============================
const DEFAULT_LIKE_TIMEOUT = 5000;
const DEFAULT_DEBOUNCE_DELAY = 300;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// =============================
// UTILITAIRES
// =============================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fallback clipboard pour navigateurs sans navigator.clipboard
 */
const copyToClipboardFallback = async (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

/**
 * Copie du texte avec gestion des erreurs
 */
const copyToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, using fallback:', err);
    }
  }
  return copyToClipboardFallback(text);
};

// =============================
// HOOK PRINCIPAL
// =============================
const usePostActions = ({ 
  user, 
  post: initialPost, 
  onUpdate, 
  client,
  likeTimeout = DEFAULT_LIKE_TIMEOUT,
  enableRetry = true,
  onError,
  showToast = true
}) => {
  // États
  const [isLiking, setIsLiking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs pour éviter les stale closures
  const postRef = useRef(initialPost);
  const abortControllerRef = useRef(null);
  const likeLockRef = useRef(false);
  const deleteLockRef = useRef(false);
  const shareLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const toastIdRef = useRef(null);

  // Mettre à jour le ref quand post change
  useEffect(() => {
    postRef.current = initialPost;
  }, [initialPost]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Annuler toutes les requêtes en cours
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Réinitialiser les locks
      likeLockRef.current = false;
      deleteLockRef.current = false;
      shareLockRef.current = false;
      // Nettoyer le toast
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  // =============================
  // AUTH CHECK
  // =============================
  const checkAuth = useCallback(() => {
    if (!user) {
      if (showToast) toast.error('Connectez-vous pour interagir');
      return false;
    }
    return true;
  }, [user, showToast]);

  // =============================
  // VALIDATION POST
  // =============================
  const validatePost = useCallback(() => {
    const currentPost = postRef.current;
    if (!currentPost?.id) {
      console.error('Post invalide:', currentPost);
      return false;
    }
    return true;
  }, []);

  // =============================
  // RESET ERROR
  // =============================
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // =============================
  // RÉINITIALISATION DU LOCK LIKE
  // =============================
  const resetLikeLock = useCallback(() => {
    likeLockRef.current = false;
    setIsLiking(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, []);

  // =============================
  // AFFICHAGE DES TOASTS
  // =============================
  const showLoadingToast = useCallback((message) => {
    if (!showToast) return;
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = toast.loading(message);
  }, [showToast]);

  const updateToast = useCallback((message, type = 'success') => {
    if (!showToast || !toastIdRef.current) return;
    if (type === 'success') {
      toast.success(message, { id: toastIdRef.current });
    } else if (type === 'error') {
      toast.error(message, { id: toastIdRef.current });
    }
    toastIdRef.current = null;
  }, [showToast]);

  // =============================
  // LIKE AVEC RETRY ET DEBOUNCE
  // =============================
  const handleLikeClick = useCallback(async () => {
    const currentPost = postRef.current;
    
    // Vérifications préalables
    if (!checkAuth()) return;
    if (!validatePost()) return;
    if (isLiking || likeLockRef.current) return;
    
    // Debounce
    const now = Date.now();
    if (now - (likeLockRef.current?.timestamp || 0) < DEFAULT_DEBOUNCE_DELAY) {
      return;
    }
    
    likeLockRef.current = { active: true, timestamp: now };
    setIsLiking(true);
    
    const wasLiked = currentPost.liked;
    const previousLikes = currentPost.likes_count || 0;
    
    // Optimistic update
    const optimisticPost = {
      ...currentPost,
      liked: !wasLiked,
      likes_count: wasLiked ? Math.max(0, previousLikes - 1) : previousLikes + 1
    };
    onUpdate?.(optimisticPost);
    
    showLoadingToast('Envoi...');
    
    let retries = 0;
    let success = false;
    
    while (retries < MAX_RETRIES && !success && isMountedRef.current) {
      // Créer un nouveau controller pour chaque tentative
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const timeoutId = setTimeout(() => controller.abort(), likeTimeout);
      
      try {
        // Envoyer l'état attendu pour validation backend
        const response = await client.post(`/api/posts/${currentPost.id}/like`, {
          expectedLiked: !wasLiked  // Le backend peut valider l'état
        }, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Synchroniser avec la réponse serveur
        if (response.data?.likes_count !== undefined && isMountedRef.current) {
          onUpdate?.({
            ...optimisticPost,
            likes_count: response.data.likes_count,
            liked: response.data.liked !== undefined ? response.data.liked : !wasLiked
          });
        }
        
        success = true;
        updateToast('Like enregistré !', 'success');
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          if (isMountedRef.current) {
            updateToast('Requête trop lente, réessayez', 'error');
          }
          break;
        }
        
        // Retry uniquement pour les erreurs réseau passagères
        const isRetryable = !error.response || error.response?.status >= 500;
        
        if (enableRetry && isRetryable && retries < MAX_RETRIES - 1) {
          retries++;
          updateToast(`Tentative ${retries + 1}/${MAX_RETRIES}...`, 'loading');
          await sleep(RETRY_DELAY * Math.pow(2, retries - 1));
          continue;
        }
        
        // Rollback en cas d'erreur définitive
        if (isMountedRef.current) {
          onUpdate?.({
            ...currentPost,
            liked: wasLiked,
            likes_count: previousLikes
          });
          
          setError(error);
          onError?.(error);
          
          if (error.response?.status === 401) {
            updateToast('Session expirée, reconnectez-vous', 'error');
          } else if (error.response?.status === 429) {
            updateToast('Trop de requêtes, ralentissez', 'error');
          } else if (error.response?.status === 403) {
            updateToast('Action non autorisée', 'error');
          } else {
            updateToast('Erreur lors du like', 'error');
          }
        }
        break;
      }
    }
    
    if (isMountedRef.current) {
      setIsLiking(false);
      likeLockRef.current = false;
      abortControllerRef.current = null;
    }
  }, [checkAuth, validatePost, isLiking, onUpdate, client, likeTimeout, enableRetry, onError, showLoadingToast, updateToast]);
  
  // =============================
  // SHARE
  // =============================
  const handleShareClick = useCallback(async () => {
    const currentPost = postRef.current;
    
    if (!checkAuth()) return;
    if (!validatePost()) return;
    if (isSharing || shareLockRef.current) return;
    
    shareLockRef.current = true;
    setIsSharing(true);
    
    const shareUrl = `${window.location.origin}/posts/${currentPost.id}`;
    const shareTitle = currentPost.title || currentPost.content?.substring(0, 100) || 'Smartix';
    const shareText = currentPost.content?.substring(0, 200) || 'Découvrez ce post sur Smartix';
    
    let shareSuccess = false;
    
    try {
      // Tentative de partage natif
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        shareSuccess = true;
        if (showToast) toast.success('Partagé !');
      } else {
        // Fallback clipboard avec gestion d'erreur
        const copySuccess = await copyToClipboard(shareUrl);
        if (copySuccess) {
          shareSuccess = true;
          if (showToast) toast.success('Lien copié dans le presse-papier !');
        } else {
          throw new Error('Clipboard fallback failed');
        }
      }
      
      // Incrémenter le compteur UNIQUEMENT si le partage a réussi
      if (shareSuccess && isMountedRef.current) {
        try {
          await client.post(`/api/posts/${currentPost.id}/share`);
          onUpdate?.({
            ...currentPost,
            shares_count: (currentPost.shares_count || 0) + 1
          });
        } catch (e) {
          console.warn('Share count increment failed:', e);
        }
      }
      
    } catch (error) {
      // L'utilisateur a annulé le partage natif
      if (error.name !== 'AbortError' && error.name !== 'InvalidStateError') {
        console.error('Share error:', error);
        
        if (isMountedRef.current) {
          setError(error);
          onError?.(error);
          
          if (showToast) {
            if (error.name === 'NotAllowedError') {
              toast.error('Permission refusée pour le partage');
            } else {
              toast.error('Impossible de partager');
            }
          }
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsSharing(false);
        shareLockRef.current = false;
      }
    }
  }, [checkAuth, validatePost, isSharing, client, onUpdate, onError, showToast]);

  // =============================
  // DELETE
  // =============================
  const handleDelete = useCallback(async (skipConfirm = false) => {
    const currentPost = postRef.current;
    
    if (!checkAuth()) return;
    if (!validatePost()) return;
    if (isDeleting || deleteLockRef.current) return;
    
    // Vérification des permissions (un seul champ user_id)
    const isAuthor = user?.id === currentPost?.user_id;
    const isAdmin = user?.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      if (showToast) toast.error('Vous n\'avez pas le droit de supprimer ce post');
      return;
    }
    
    // Confirmation - À remplacer par une modal personnalisée
    if (!skipConfirm) {
      // Émettre un événement pour ouvrir une modal personnalisée
      const confirmEvent = new CustomEvent('openConfirmModal', {
        detail: {
          title: 'Supprimer le post',
          message: 'Voulez-vous vraiment supprimer ce post ? Cette action est irréversible.',
          onConfirm: () => handleDelete(true)
        }
      });
      window.dispatchEvent(confirmEvent);
      return;
    }
    
    deleteLockRef.current = true;
    setIsDeleting(true);
    showLoadingToast('Suppression...');
    
    try {
      await client.delete(`/api/posts/${currentPost.id}`);
      
      if (isMountedRef.current) {
        updateToast('Post supprimé', 'success');
        onUpdate?.(null);
      }
    } catch (error) {
      console.error('Delete error:', error);
      
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
        
        if (error.response?.status === 401) {
          updateToast('Session expirée, reconnectez-vous', 'error');
        } else if (error.response?.status === 403) {
          updateToast('Vous n\'avez pas le droit de supprimer ce post', 'error');
        } else if (error.response?.status === 404) {
          updateToast('Post introuvable', 'error');
        } else {
          updateToast('Erreur lors de la suppression', 'error');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
      deleteLockRef.current = false;
    }
  }, [checkAuth, validatePost, isDeleting, user, client, onUpdate, onError, showLoadingToast, updateToast, showToast]);

  // =============================
  // RETOUR DU HOOK
  // =============================
  const currentPost = postRef.current;
  
  return {
    // États
    isLiking,
    isSharing,
    isDeleting,
    error,
    
    // Actions
    handleLikeClick,
    handleShareClick,
    handleDelete,
    resetError,
    resetLikeLock,
    
    // Utilitaires
    canLike: !isLiking && !likeLockRef.current,
    canShare: !isSharing && !shareLockRef.current,
    canDelete: !isDeleting && !deleteLockRef.current && 
               (user?.id === currentPost?.user_id || user?.role === 'admin')
  };
};

export default usePostActions;

export { usePostActions };
