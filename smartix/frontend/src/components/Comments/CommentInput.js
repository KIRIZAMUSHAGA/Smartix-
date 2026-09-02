// frontend/src/components/Comments/CommentInput.js
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Mic, X, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getAvatarUrl } from '../../config/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { useDraft } from './hooks/useDraft';
import { useGifSearch } from './hooks/useGifSearch';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { useSuggestions } from './hooks/useSuggestions';
import GifPicker from './components/GifPicker';
import VoiceRecorder from './components/VoiceRecorder';
import SuggestionsDropdown from './components/SuggestionsDropdown';
import TextInput from './components/TextInput';
import MediaActions from './components/MediaActions';

// =============================
// CONSTANTES
// =============================
const MAX_TEXT_LENGTH = 500;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// =============================
// TYPES DE PAYLOAD
// =============================
const PAYLOAD_TYPES = {
  TEXT: 'text',
  GIF: 'gif',
  IMAGE: 'image',
  VIDEO: 'video',
  VOICE: 'voice'
};

// =============================
// VALIDATION DES FICHIERS
// =============================
const validateFile = (file, type) => {
  if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };

  const maxSize = type === 'video' ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    return { valid: false, error: `Le fichier est trop lourd (max ${maxSize / 1024 / 1024}MB)` };
  }

  const acceptedTypes = type === 'video' ? ACCEPTED_VIDEO_TYPES : ACCEPTED_IMAGE_TYPES;
  if (!acceptedTypes.includes(file.type)) {
    return { valid: false, error: `Format ${type} non supporté (${acceptedTypes.join(', ')})` };
  }

  return { valid: true, error: null };
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CommentInput = ({ 
  postId,
  onSubmit,
  placeholder = "Ajouter un commentaire...",
  replyingTo = null,
  autoFocus = false,
  disabled = false,
  maxLength = MAX_TEXT_LENGTH
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  
  // ✅ CENTRALISATION DU PAYLOAD (SOURCE DE VÉRITÉ UNIQUE)
  const [payload, setPayload] = useState({
    type: PAYLOAD_TYPES.TEXT,
    text: '',
    file: null,
    fileUrl: null,
    gifUrl: null,
    audioBlob: null,
    audioUrl: null
  });

  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const objectUrlsRef = useRef([]); // Pour nettoyer les ObjectURLs

  // =============================
  // NETTOYAGE DES OBJECTURLS
  // =============================
  const cleanupObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    objectUrlsRef.current = [];
  }, []);

  // =============================
  // MISE À JOUR DU PAYLOAD AVEC NETTOYAGE
  // =============================
  const updatePayload = useCallback((updates) => {
    setPayload(prev => {
      // Nettoyer les anciennes URLs si on les remplace
      if (updates.fileUrl && prev.fileUrl && prev.fileUrl !== updates.fileUrl) {
        URL.revokeObjectURL(prev.fileUrl);
      }
      if (updates.audioUrl && prev.audioUrl && prev.audioUrl !== updates.audioUrl) {
        URL.revokeObjectURL(prev.audioUrl);
      }
      return { ...prev, ...updates };
    });
  }, []);

  // =============================
  // RÉINITIALISATION COMPLÈTE
  // =============================
  const resetPayload = useCallback(() => {
    cleanupObjectUrls();
    setPayload({
      type: PAYLOAD_TYPES.TEXT,
      text: '',
      file: null,
      fileUrl: null,
      gifUrl: null,
      audioBlob: null,
      audioUrl: null
    });
  }, [cleanupObjectUrls]);

  // =============================
  // BROUILLON
  // =============================
  const {
    text: draftText,
    setText: setDraftText,
    commentType: draftType,
    setCommentType: setDraftType,
    clearDraft,
    hasDraft
  } = useDraft(postId, replyingTo);

  // Synchronisation brouillon -> payload au chargement
  useEffect(() => {
    if (draftText && !payload.text && !payload.gifUrl && !payload.fileUrl) {
      setPayload(prev => ({ ...prev, type: PAYLOAD_TYPES.TEXT, text: draftText }));
    }
  }, [draftText, payload.text, payload.gifUrl, payload.fileUrl]);

  // Synchronisation payload -> brouillon
  useEffect(() => {
    if (!replyingTo && payload.type === PAYLOAD_TYPES.TEXT && payload.text.trim()) {
      setDraftText(payload.text);
      setDraftType('text');
    } else if (!replyingTo && (!payload.text || payload.text.trim() === '')) {
      clearDraft();
    }
  }, [payload.text, payload.type, replyingTo, setDraftText, setDraftType, clearDraft]);

  // =============================
  // RECHERCHE GIF
  // =============================
  const {
    gifs,
    isSearching: isSearchingGif,
    query: gifQuery,
    search: searchGifs,
    clear: clearGifs,
    hasMore: hasMoreGifs,
    loadMore: loadMoreGifs,
    error: gifError
  } = useGifSearch();

  // =============================
  // ENREGISTREMENT VOCAL
  // =============================
  const {
    isRecording,
    recordingTime,
    recordingBlob,
    error: voiceError,
    canRecord,
    startRecording,
    stopRecording,
    cancelRecording,
    reset: resetRecording
  } = useVoiceRecorder({
    maxDuration: 60,
    minDuration: 1,
    onError: (err) => setLocalError(err.message),
    onStop: (blob, duration) => {
      const audioUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.push(audioUrl);
      updatePayload({
        type: PAYLOAD_TYPES.VOICE,
        audioBlob: blob,
        audioUrl,
        text: ''
      });
      setShowVoiceRecorder(false);
    }
  });

  // =============================
  // SUGGESTIONS (MENTIONS/HASHTAGS)
  // =============================
  const {
    suggestions,
    showSuggestions,
    activeIndex,
    isLoading: isLoadingSuggestions,
    selectSuggestion,
    navigate,
    reset: resetSuggestions
  } = useSuggestions(payload.text, cursorPosition);

  // =============================
  // SOUMISSION DU COMMENTAIRE
  // =============================
  const handleSubmit = useCallback(async () => {
    if (disabled || isSubmitting) return;

    let content = '';
    let type = payload.type;
    let file = null;

    switch (payload.type) {
      case PAYLOAD_TYPES.TEXT:
        content = payload.text.trim();
        if (!content) {
          setLocalError('Le commentaire ne peut pas être vide');
          return;
        }
        if (content.length > maxLength) {
          setLocalError(`Maximum ${maxLength} caractères`);
          return;
        }
        break;
        
      case PAYLOAD_TYPES.GIF:
        content = payload.gifUrl;
        if (!content) {
          setLocalError('GIF invalide');
          return;
        }
        break;
        
      case PAYLOAD_TYPES.IMAGE:
      case PAYLOAD_TYPES.VIDEO:
        content = payload.fileUrl;
        file = payload.file;
        if (!content) {
          setLocalError('Fichier invalide');
          return;
        }
        break;
        
      case PAYLOAD_TYPES.VOICE:
        content = payload.audioUrl;
        file = payload.audioBlob;
        if (!content) {
          setLocalError('Enregistrement vocal invalide');
          return;
        }
        break;
        
      default:
        return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        type,
        content,
        file,
        replyTo: replyingTo?.id
      });

      // Reset après succès
      resetPayload();
      clearDraft();
      resetSuggestions();
      textInputRef.current?.clear();
      
    } catch (err) {
      console.error('Error submitting comment:', err);
      setLocalError('Erreur lors de la publication');
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, isSubmitting, payload, onSubmit, replyingTo, resetPayload, clearDraft, resetSuggestions, maxLength]);

  // =============================
  // GESTION DES FICHIERS
  // =============================
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith('video') ? PAYLOAD_TYPES.VIDEO : PAYLOAD_TYPES.IMAGE;
    const validation = validateFile(file, type === PAYLOAD_TYPES.VIDEO ? 'video' : 'image');
    
    if (!validation.valid) {
      setLocalError(validation.error);
      return;
    }

    setLocalError(null);
    
    const fileUrl = URL.createObjectURL(file);
    objectUrlsRef.current.push(fileUrl);

    updatePayload({
      type,
      file,
      fileUrl,
      text: ''
    });
    
    e.target.value = ''; // Reset input
  }, [updatePayload]);

  // =============================
  // GESTION DES GIFS
  // =============================
  const handleGifSelect = useCallback((gif) => {
    updatePayload({
      type: PAYLOAD_TYPES.GIF,
      gifUrl: gif.url,
      text: ''
    });
    setShowGifPicker(false);
    clearGifs();
  }, [updatePayload, clearGifs]);

  // =============================
  // ANNULATION DU CONTENU ACTUEL
  // =============================
  const handleClearContent = useCallback(() => {
    resetPayload();
    setShowVoiceRecorder(false);
    setShowGifPicker(false);
  }, [resetPayload]);

  // =============================
  // DÉTERMINER SI LE CONTENU EST PRÉSENT
  // =============================
  const hasContent = useMemo(() => {
    switch (payload.type) {
      case PAYLOAD_TYPES.TEXT:
        return payload.text.trim().length > 0;
      case PAYLOAD_TYPES.GIF:
        return !!payload.gifUrl;
      case PAYLOAD_TYPES.IMAGE:
      case PAYLOAD_TYPES.VIDEO:
        return !!payload.fileUrl;
      case PAYLOAD_TYPES.VOICE:
        return !!payload.audioUrl;
      default:
        return false;
    }
  }, [payload]);

  // =============================
  // AFFICHAGE DU CONTENU PRÉVISUALISÉ
  // =============================
  const renderPreview = () => {
    if (!hasContent) return null;

    let previewContent = null;
    let previewLabel = '';

    switch (payload.type) {
      case PAYLOAD_TYPES.GIF:
        previewContent = (
          <img src={payload.gifUrl} alt="GIF" className="h-12 w-auto rounded" />
        );
        previewLabel = 'GIF';
        break;
      case PAYLOAD_TYPES.IMAGE:
        previewContent = (
          <img src={payload.fileUrl} alt="Image" className="h-12 w-auto rounded object-cover" />
        );
        previewLabel = 'Image';
        break;
      case PAYLOAD_TYPES.VIDEO:
        previewContent = (
          <video src={payload.fileUrl} className="h-12 w-auto rounded" />
        );
        previewLabel = 'Vidéo';
        break;
      case PAYLOAD_TYPES.VOICE:
        previewContent = (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Message vocal
            </span>
          </div>
        );
        previewLabel = 'Audio';
        break;
      default:
        return null;
    }

    return (
      <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase">
            {previewLabel}:
          </span>
          {previewContent}
        </div>
        <button
          onClick={handleClearContent}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
          aria-label="Supprimer"
        >
          <Trash2 className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    );
  };

  // =============================
  // NETTOYAGE AU DÉMONTAGE
  // =============================
  useEffect(() => {
    return cleanupObjectUrls;
  }, [cleanupObjectUrls]);

  // =============================
  // RENDU
  // =============================
  return (
    <div className="relative">
      {/* Message d'erreur local */}
      {localError && (
        <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center justify-between">
          <span>{localError}</span>
          <button 
            onClick={() => setLocalError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Indicateur de réponse */}
      {replyingTo && (
        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg text-sm flex items-center justify-between">
          <span>
            Réponse à{' '}
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {replyingTo.author?.full_name}
            </span>
          </span>
          <button
            onClick={handleClearContent}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Annuler la réponse"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Prévisualisation du contenu (GIF, image, vidéo, audio) */}
      {renderPreview()}

      {/* Zone de saisie principale */}
      <div className="flex items-start gap-2">
        {/* Avatar utilisateur */}
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={getAvatarUrl(user?.avatar)} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-bold">
            {user?.full_name?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>

        {/* Conteneur d'input */}
        <div className="flex-1 relative bg-gray-100 dark:bg-gray-800 rounded-2xl border border-transparent focus-within:border-blue-500 transition-all">
          <div className="flex items-center gap-2 p-1.5 px-3">
            {/* Champ de texte (visible seulement pour le mode texte) */}
            {payload.type === PAYLOAD_TYPES.TEXT && (
              <TextInput
                ref={textInputRef}
                value={payload.text}
                onChange={(e) => updatePayload({ text: e.target.value })}
                onSubmit={handleSubmit}
                placeholder={placeholder}
                disabled={disabled || isSubmitting}
                autoFocus={autoFocus || !!replyingTo}
                onKeyDown={(e) => {
                  if (showSuggestions) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      navigate('down');
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      navigate('up');
                    } else if (e.key === 'Enter' && activeIndex >= 0) {
                      e.preventDefault();
                      const suggestion = suggestions[activeIndex];
                      const newText = selectSuggestion(suggestion);
                      updatePayload({ text: newText });
                      resetSuggestions();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      resetSuggestions();
                    }
                  }
                }}
                onCursorChange={setCursorPosition}
                maxLength={maxLength}
              />
            )}

            {/* Actions média - VERSION CORRIGÉE (sans fileInputRef) */}
            <MediaActions
              onImageClick={() => fileInputRef.current?.click()}
              onMicClick={() => setShowVoiceRecorder(true)}
              onGifClick={() => setShowGifPicker(true)}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              disabled={disabled || isSubmitting}
              hasContent={hasContent}
              onClear={handleClearContent}
            />
          </div>

          {/* Suggestions (mentions/hashtags) - VERSION OPTIMISÉE */}
          {payload.type === PAYLOAD_TYPES.TEXT && (
            <SuggestionsDropdown
              suggestions={suggestions}
              activeIndex={activeIndex}
              isLoading={isLoadingSuggestions}
              onSelect={(s) => {
                const newText = selectSuggestion(s);
                updatePayload({ text: newText });
                resetSuggestions();
                textInputRef.current?.focus();
              }}
              onClose={resetSuggestions}
              searchQuery={payload.text}
            />
          )}
        </div>
      </div>

      {/* Indicateur de brouillon */}
      {hasDraft && !replyingTo && !hasContent && (
        <div className="flex justify-center mt-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isSubmitting}
      />

      {/* Sélecteur GIF */}
      <GifPicker
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
        gifs={gifs}
        isSearching={isSearchingGif}
        query={gifQuery}
        onSearch={searchGifs}
        hasMore={hasMoreGifs}
        onLoadMore={loadMoreGifs}
        error={gifError}
      />

      {/* Enregistrement vocal - VERSION AVEC OBJET RECORDER */}
      <VoiceRecorder
        isOpen={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        recorder={{
          isRecording,
          time: recordingTime,
          start: startRecording,
          stop: stopRecording,
          cancel: cancelRecording,
          canRecord,
          error: voiceError
        }}
      />

      {/* Astuce clavier */}
      <div className="mt-1.5 text-right">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          Entrée pour envoyer • Shift+Entrée pour nouvelle ligne
        </p>
      </div>
    </div>
  );
};

CommentInput.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSubmit: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  replyingTo: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    author: PropTypes.shape({
      full_name: PropTypes.string
    })
  }),
  autoFocus: PropTypes.bool,
  disabled: PropTypes.bool,
  maxLength: PropTypes.number
};

export default CommentInput;
