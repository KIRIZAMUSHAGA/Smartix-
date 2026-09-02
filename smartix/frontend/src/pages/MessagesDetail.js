// src/pages/MessagesDetail.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApiClient } from '../contexts/ApiClientContext';
import { messageSocketService } from '../services/messageSocketService';

// Composants
import MessageHeader from '../components/messages/MessageHeader';
import MessageBubble from '../components/messages/MessageBubble';
import MessageInput from '../components/messages/MessageInput';
import DateSeparator from '../components/messages/DateSeparator';
import TypingIndicator from '../components/messages/TypingIndicator';
import EncryptionBadge from '../components/ui/EncryptionBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

// Hooks personnalisés
import useMessages from '../hooks/useMessages';
import useConversationPartner from '../hooks/useConversationPartner';
import useTypingIndicator from '../hooks/useTypingIndicator';
import useReadReceipts from '../hooks/useReadReceipts';
import useMessageReactions from '../hooks/useMessageReactions';
import { useAudioManager } from '../services/AudioManager';

// Utilitaires
import { shouldShowDateSeparator } from '../utils/dateUtils';
import { sanitizeMessage, validateFile, formatFileSize } from '../utils/messageUtils';
import { API_BASE_URL } from '../config/api';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const SCROLL_NEAR_BOTTOM_THRESHOLD = 100;
const OBSERVER_CONFIG = { threshold: 0.5, rootMargin: '0px' };
const TOTAL_PARTICIPANTS = 2; // Conversation 1-1

// =============================
// COMPOSANT PRINCIPAL
// =============================
const MessagesDetail = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  
  // Refs
  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const previousConversationIdRef = useRef(null);
  const observerRef = useRef(null);
  const messageElementsRef = useRef(new Map());
  
  // États locaux
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);
  const [showEncryptionDetails, setShowEncryptionDetails] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  
  // Hooks personnalisés
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
    loadMoreMessages,
    markMessageAsDelivered,
    markMessageAsRead: markMessageReadOnServer
  } = useMessages(conversationId, user?.id);
  
  // ============================================================
  // HOOK useConversationPartner - Version complète
  // ============================================================
  const {
    partner,
    loading: partnerLoading,
    error: partnerError,
    refresh: refreshPartner,
    verifyIdentity,
    getDisplayFingerprint,
    isEncrypted,
    isVerified,
    securityLevel,
    isVerifying,
    verificationStatus
  } = useConversationPartner(conversationId, user);
  
  // Hook pour l'indicateur de frappe
  const {
    isTyping: isPartnerTyping,
    typingUsers
  } = useTypingIndicator(conversationId, user?.id, partner?.id);
  
  // ============================================================
  // HOOK useReadReceipts
  // ============================================================
  const {
    lastReadMessageId,
    lastReadTime,
    pendingCount: pendingReadReceiptsCount,
    markAsRead,
    markMultipleAsRead,
    markConversationAsRead,
    resetReadReceipts,
    isMessageRead,
    isMessageDelivered,
    getReaders,
    getReadCount,
    getMessageStatus,
    isSeenByAll
  } = useReadReceipts(conversationId, user?.id, TOTAL_PARTICIPANTS);
  
  const {
    getCurrentUserReaction,
    getGroupedReactions,
    toggleReaction,
    animatedReactions
  } = useMessageReactions(conversationId, user?.id);
  
  const { audioManager } = useAudioManager();
  
  // =============================
  // AFFICHAGE DES STATUTS DE SÉCURITÉ
  // =============================
  
  // Afficher une notification si la clé publique a changé
  useEffect(() => {
    if (verificationStatus && !verificationStatus.success && verificationStatus.severity === 'warning') {
      toast.warning(verificationStatus.message, {
        duration: 8000,
        action: {
          label: 'Vérifier',
          onClick: () => {
            setShowEncryptionDetails(true);
            verifyIdentity();
          }
        }
      });
    }
  }, [verificationStatus, verifyIdentity]);
  
  // =============================
  // UTILITAIRES SCROLL
  // =============================
  
  const isNearBottom = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_NEAR_BOTTOM_THRESHOLD;
  }, []);
  
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);
  
  const scrollToBottomIfNeeded = useCallback(() => {
    if (isInitialLoadRef.current || isNearBottom()) {
      scrollToBottom('smooth');
    } else {
      setUnreadCount(prev => prev + 1);
      setShowNewMessagesButton(true);
    }
  }, [isNearBottom, scrollToBottom]);
  
  const handleNewMessagesClick = useCallback(() => {
    scrollToBottom('smooth');
    setUnreadCount(0);
    setShowNewMessagesButton(false);
  }, [scrollToBottom]);
  
  // =============================
  // OBSERVER DE VISIBILITÉ
  // =============================
  
  const setupVisibilityObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver((entries) => {
      const visibleMessageIds = [];
      
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageId = entry.target.dataset.messageId;
          if (messageId) {
            visibleMessageIds.push(messageId);
          }
        }
      });
      
      if (visibleMessageIds.length > 0) {
        const messagesToMark = messages.filter(m => 
          visibleMessageIds.includes(m.id) && 
          m.sender_id !== user?.id &&
          !isMessageRead(m.id)
        );
        
        if (messagesToMark.length > 0) {
          markMultipleAsRead(
            messagesToMark.map(m => m.id),
            messagesToMark[0]?.sender_id
          );
          
          messagesToMark.forEach(msg => {
            markMessageReadOnServer(msg.id);
          });
        }
      }
    }, OBSERVER_CONFIG);
    
    messageElementsRef.current.forEach((element, messageId) => {
      if (element) {
        observerRef.current.observe(element);
      }
    });
  }, [messages, user?.id, isMessageRead, markMultipleAsRead, markMessageReadOnServer]);
  
  const registerMessageElement = useCallback((messageId, element) => {
    if (element) {
      messageElementsRef.current.set(messageId, element);
      if (observerRef.current) {
        observerRef.current.observe(element);
      }
    }
  }, []);
  
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);
  
  useEffect(() => {
    if (!messagesLoading && messages.length > 0) {
      setupVisibilityObserver();
    }
  }, [messages, messagesLoading, setupVisibilityObserver]);
  
  // =============================
  // GESTION DU SCROLL
  // =============================
  
  const handleScroll = useCallback(async () => {
    if (!isLoadingMore && hasMoreMessages) {
      const scrollTop = scrollAreaRef.current?.scrollTop;
      if (scrollTop === 0) {
        const prevHeight = scrollAreaRef.current.scrollHeight;
        setIsLoadingMore(true);
        
        const result = await loadMoreMessages(page + 1);
        if (result) {
          setPage(prev => prev + 1);
          setHasMoreMessages(result.hasMore);
          
          const newHeight = scrollAreaRef.current.scrollHeight;
          if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = newHeight - prevHeight;
          }
        }
        setIsLoadingMore(false);
      }
    }
    
    if (isNearBottom()) {
      setShowNewMessagesButton(false);
      setUnreadCount(0);
    }
  }, [isLoadingMore, hasMoreMessages, loadMoreMessages, page, isNearBottom]);
  
  // =============================
  // UPLOAD AVEC PROGRESSION (XHR pour onprogress)
  // =============================

  const uploadWithProgress = useCallback((path, formData, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
      xhr.open('POST', url, true);

      const token = client?.getToken ? client.getToken() : null;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (xhr.upload && typeof onProgress === 'function') {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch (_) { data = xhr.responseText; }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject({ status: xhr.status, message: data?.detail || data?.message || `HTTP ${xhr.status}`, data });
      };
      xhr.onerror = () => reject({ status: 0, message: 'Erreur réseau' });
      xhr.onabort = () => reject({ status: 0, message: 'Upload annulé' });
      xhr.send(formData);
    });
  }, [client]);

  // =============================
  // MESSAGE VOCAL
  // =============================

  const handleVoiceMessageSend = useCallback(async (blob, duration, metadata) => {
    if (!blob || !partner) return;
    setIsSendingVoice(true);
    setUploadProgress(0);
    const toastId = toast.loading('Envoi du message vocal…');
    try {
      const formData = new FormData();
      const ext = (blob.type || 'audio/webm').includes('mpeg') ? 'mp3' : 'webm';
      formData.append('file', blob, `voice_${Date.now()}.${ext}`);
      formData.append('conversation_id', conversationId);
      formData.append('duration_ms', String(Math.round((duration || 0) * 1000)));
      formData.append('mime_type', metadata?.mimeType || blob.type || 'audio/webm');
      if (metadata?.bitrate) formData.append('bitrate', String(metadata.bitrate));
      if (metadata?.sampleRate) formData.append('sample_rate', String(metadata.sampleRate));
      if (user?.id) formData.append('sender_id', user.id);
      if (partner?.id) formData.append('recipient_id', partner.id);

      const result = await uploadWithProgress('/api/messages/voice', formData, setUploadProgress);
      if (!result?.success) throw new Error(result?.detail || result?.error || 'Échec de l\'envoi');

      toast.success('Message vocal envoyé', { id: toastId });
      scrollToBottomIfNeeded();
    } catch (err) {
      console.error('Voice upload error:', err);
      toast.error(err?.message || 'Erreur lors de l\'envoi du message vocal', { id: toastId });
    } finally {
      setIsSendingVoice(false);
      setUploadProgress(0);
    }
  }, [partner, conversationId, user?.id, uploadWithProgress, scrollToBottomIfNeeded]);

  // =============================
  // UPLOAD DE FICHIER
  // =============================

  const detectFileCategory = useCallback((file) => {
    const t = (file.type || '').toLowerCase();
    if (t.startsWith('image/')) return 'screenshot';
    if (t.startsWith('video/')) return 'media';
    if (t === 'application/pdf' || t.includes('word') || t.includes('document')) return 'document';
    return 'document';
  }, []);

  const handleFileUpload = useCallback(async (file) => {
    if (!file || !partner) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const toastId = toast.loading(`Envoi de ${file.name}…`);
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('category', detectFileCategory(file));

      const upload = await uploadWithProgress('/api/uploads/simple', formData, setUploadProgress);
      const fileUrl = upload?.url || upload?.file_url || upload?.path || upload?.location;
      if (!fileUrl && !upload?.file_id) throw new Error('Réponse upload invalide');

      // Publier un message média/document avec l'URL retournée
      const params = new URLSearchParams({
        recipient_id: partner.id,
        content: fileUrl || `file:${upload.file_id}`,
        user_id: user.id,
        message_type: file.type?.startsWith('image/') ? 'media'
                   : file.type?.startsWith('video/') ? 'media'
                   : 'document',
      });
      const sendRes = await client.post(`/messages/send?${params.toString()}`, {});
      if (sendRes?.success === false) throw new Error(sendRes?.error || 'Échec de l\'envoi');

      toast.success(`${file.name} envoyé (${formatFileSize(file.size)})`, { id: toastId });
      scrollToBottomIfNeeded();
    } catch (err) {
      console.error('File upload error:', err);
      toast.error(err?.message || 'Erreur lors de l\'upload du fichier', { id: toastId });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [partner, user?.id, detectFileCategory, uploadWithProgress, client, scrollToBottomIfNeeded]);

  // =============================
  // DRAG & DROP
  // =============================

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!partner || isUploading) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer?.types?.includes('Files')) setIsDragging(true);
  }, [partner, isUploading]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    files.forEach((file) => { handleFileUpload(file); });
  }, [handleFileUpload]);

  // =============================
  // ENVOI DE MESSAGE
  // =============================
  
  const handleSendMessage = useCallback(async (content, expiryTime = 0) => {
    if (!content?.trim()) return;
    
    const sanitizedContent = sanitizeMessage(content.trim());
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const messageData = {
      id: tempId,
      conversation_id: conversationId,
      content: sanitizedContent,
      sender_id: user.id,
      recipient_id: partner?.id,
      type: expiryTime > 0 ? 'ephemeral' : 'text',
      expires_in: expiryTime,
      created_at: new Date().toISOString(),
      status: 'sending',
      optimistic: true
    };
    
    try {
      const result = await sendMessage(messageData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        markMessageAsDelivered(tempId);
      }
      scrollToBottomIfNeeded();
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Erreur lors de l\'envoi');
    }
  }, [conversationId, user?.id, partner?.id, sendMessage, scrollToBottomIfNeeded, markMessageAsDelivered]);
  
  // =============================
  // GESTION AUDIO
  // =============================
  
  useEffect(() => {
    audioManager.stop(true);
  }, [conversationId, audioManager]);
  
  // =============================
  // RÉINITIALISATION AU CHANGEMENT DE CONVERSATION
  // =============================
  
  useEffect(() => {
    if (previousConversationIdRef.current !== conversationId) {
      isInitialLoadRef.current = true;
      setPage(1);
      setHasMoreMessages(true);
      setUnreadCount(0);
      setShowNewMessagesButton(false);
      setShowEncryptionDetails(false);
      
      resetReadReceipts();
      
      previousConversationIdRef.current = conversationId;
    }
  }, [conversationId, resetReadReceipts]);
  
  // =============================
  // MARQUER TOUS LES MESSAGES COMME LUS À L'OUVERTURE
  // =============================
  
  useEffect(() => {
    if (!messagesLoading && messages.length > 0 && isInitialLoadRef.current) {
      markConversationAsRead(messages);
      
      const unreadMessages = messages.filter(m => 
        m.sender_id !== user?.id && !isMessageRead(m.id)
      );
      unreadMessages.forEach(msg => {
        markMessageReadOnServer(msg.id);
      });
    }
  }, [messages, messagesLoading, user?.id, isMessageRead, markConversationAsRead, markMessageReadOnServer]);
  
  // =============================
  // SCROLL EN BAS
  // =============================
  
  useEffect(() => {
    if (!messagesLoading && messages.length > 0) {
      if (isInitialLoadRef.current) {
        scrollToBottom('auto');
        isInitialLoadRef.current = false;
      } else {
        scrollToBottomIfNeeded();
      }
    }
  }, [messages, messagesLoading, scrollToBottomIfNeeded, scrollToBottom]);
  
  // =============================
  // RENDU DES MESSAGES (memoized)
  // =============================
  
  const renderedMessages = useMemo(() => {
    if (!messages.length) return null;
    
    return messages.map((message, index) => {
      const isMe = message.sender_id === user?.id;
      const showDateSeparator = shouldShowDateSeparator(message, messages[index - 1]);
      const userReaction = getCurrentUserReaction(message.id);
      const groupedReactions = getGroupedReactions(message.id);
      const isAnimated = animatedReactions.has(message.id);
      
      const readStatus = getMessageStatus(message.id);
      const isRead = isMessageRead(message.id);
      const isDelivered = isMessageDelivered(message.id);
      const readCount = getReadCount(message.id);
      const readers = getReaders(message.id);
      const seenByAll = isSeenByAll(message.id);
      
      return (
        <React.Fragment key={message.id || index}>
          {showDateSeparator && (
            <DateSeparator date={message.created_at} variant="pill" />
          )}
          
          <div 
            data-message-id={message.id}
            className="message-bubble-wrapper"
            ref={(el) => {
              if (el && message.id) {
                registerMessageElement(message.id, el);
              }
            }}
          >
            <MessageBubble
              message={message}
              isMe={isMe}
              partner={partner}
              onReaction={toggleReaction}
              onRetry={() => sendMessage(message)}
              currentUserReaction={userReaction}
              groupedReactions={groupedReactions}
              isAnimated={isAnimated}
              status={readStatus}
              isRead={isRead}
              isDelivered={isDelivered}
              readCount={readCount}
              readers={readers}
              seenByAll={seenByAll}
              isGroup={TOTAL_PARTICIPANTS > 2}
            />
          </div>
        </React.Fragment>
      );
    });
  }, [
    messages, 
    user?.id, 
    partner, 
    getCurrentUserReaction, 
    getGroupedReactions, 
    animatedReactions, 
    toggleReaction, 
    sendMessage, 
    registerMessageElement,
    getMessageStatus,
    isMessageRead,
    isMessageDelivered,
    getReadCount,
    getReaders,
    isSeenByAll
  ]);
  
  // =============================
  // GESTION DES ÉTATS DE CHARGEMENT
  // =============================
  
  // État de chargement
  if (messagesLoading || partnerLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <MessageHeader 
          partner={null}
          isPartnerTyping={false}
          onBackClick={() => navigate('/messages')}
          onVerifyIdentity={verifyIdentity}
          isVerified={false}
          securityLevel="none"
          fingerprint={null}
          isVerifying={false}
        />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Chargement des messages..." />
        </div>
      </div>
    );
  }
  
  // État d'erreur
  if (messagesError || partnerError) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <MessageHeader 
          partner={partner}
          isPartnerTyping={isPartnerTyping}
          onBackClick={() => navigate('/messages')}
          onVerifyIdentity={verifyIdentity}
          isVerified={isVerified || false}
          securityLevel={securityLevel || 'none'}
          fingerprint={getDisplayFingerprint()}
          isVerifying={isVerifying}
        />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="⚠️"
            title="Erreur"
            description={messagesError || partnerError || "Impossible de charger la conversation"}
            buttonText="Réessayer"
            buttonAction={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }
  
  // État partenaire non trouvé
  if (!partner) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <MessageHeader 
          partner={null}
          isPartnerTyping={false}
          onBackClick={() => navigate('/messages')}
          onVerifyIdentity={verifyIdentity}
          isVerified={false}
          securityLevel="none"
          fingerprint={null}
          isVerifying={false}
        />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="👤"
            title="Utilisateur non trouvé"
            description="Cette conversation n'existe pas ou a été supprimée."
            buttonText="Retour aux messages"
            buttonLink="/messages"
          />
        </div>
      </div>
    );
  }
  
  // =============================
  // RENDU PRINCIPAL
  // =============================
  
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header - Toutes les props sont transmises */}
      <MessageHeader
        partner={partner}
        isPartnerTyping={isPartnerTyping}
        onBackClick={() => navigate('/messages')}
        onVerifyIdentity={verifyIdentity}
        isVerified={isVerified}
        securityLevel={securityLevel}
        fingerprint={getDisplayFingerprint()}
        isVerifying={isVerifying}
      />
      
      {/* Zone des messages */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-[#efeae2] dark:bg-[#0b141a] relative"
        onScroll={handleScroll}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <div className="bg-card/95 px-6 py-4 rounded-xl shadow-lg text-center">
              <p className="text-base font-semibold">📎 Déposez votre fichier ici</p>
              <p className="text-xs text-muted-foreground mt-1">Images, vidéos, documents (max 5 MB)</p>
            </div>
          </div>
        )}
        {(isUploading || isSendingVoice) && uploadProgress > 0 && (
          <div className="sticky top-0 z-10 mb-2 bg-card/95 backdrop-blur rounded-lg p-2 shadow-sm">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                {isSendingVoice ? 'Envoi du message vocal…' : 'Upload en cours…'}
              </span>
              <span className="font-mono">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <LoadingSpinner size="sm" text="Chargement..." />
          </div>
        )}
        
        <div className="max-w-3xl mx-auto space-y-2">
          {renderedMessages}
          
          {/* Indicateur de frappe du partenaire - Version corrigée avec le nom */}
          {isPartnerTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-[#202c33] rounded-2xl rounded-bl-md px-4 py-2 shadow-sm flex items-center gap-2">
                <TypingIndicator size="sm" showText={false} />
                <span className="text-xs text-muted-foreground">
                  {partner?.full_name || partner?.username} est en train d'écrire...
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Bouton "nouveaux messages" avec compteur */}
        {showNewMessagesButton && (
          <button
            onClick={handleNewMessagesClick}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-primary text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 animate-bounce z-10"
          >
            ↓ {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''} message{unreadCount > 1 ? 's' : ''}
          </button>
        )}
        
        {/* Badge de sécurité flottant (optionnel) */}
        {isEncrypted && !showEncryptionDetails && (
          <button
            onClick={() => setShowEncryptionDetails(true)}
            className="fixed bottom-24 right-4 bg-black/70 backdrop-blur-md text-white rounded-full px-3 py-1.5 text-xs flex items-center gap-1 z-10 hover:bg-black/80 transition-colors"
          >
            <EncryptionBadge 
              securityLevel={securityLevel}
              isVerified={isVerified}
              variant="icon"
              size="sm"
            />
            <span>Chiffré</span>
          </button>
        )}
      </div>
      
      {/* Modal détails chiffrement (optionnel) */}
      {showEncryptionDetails && isEncrypted && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Sécurité de la conversation</h3>
              <button
                onClick={() => setShowEncryptionDetails(false)}
                className="p-1 hover:bg-accent rounded-full"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <EncryptionBadge 
                securityLevel={securityLevel}
                isVerified={isVerified}
                variant="detailed"
                showDescription={true}
              />
              
              {getDisplayFingerprint() && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Empreinte de sécurité
                  </p>
                  <p className="text-xs font-mono break-all">
                    {getDisplayFingerprint()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Vérifiez cette empreinte avec {partner.full_name} en personne.
                  </p>
                </div>
              )}
              
              {!isVerified && (
                <button
                  onClick={() => {
                    verifyIdentity();
                    setShowEncryptionDetails(false);
                  }}
                  disabled={isVerifying}
                  className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isVerifying ? 'Vérification...' : 'Vérifier l\'identité'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Input */}
      <MessageInput
        conversationId={conversationId}
        currentUserId={user?.id}
        recipientId={partner?.id}
        onSendMessage={handleSendMessage}
        onFileUpload={handleFileUpload}
        onVoiceMessageSend={handleVoiceMessageSend}
        isSending={isSendingVoice}
        isUploading={isUploading}
        disabled={!partner}
      />
    </div>
  );
};

MessagesDetail.propTypes = {};

export default MessagesDetail;
