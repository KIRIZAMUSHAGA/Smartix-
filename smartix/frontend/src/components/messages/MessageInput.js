// src/components/messages/MessageInput.js
import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Send, Paperclip, Mic, Loader2, X, FileAudio, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import VoiceRecorder from './VoiceRecorder';
import AudioPreview from './AudioPreview';
import { validateMessage, MAX_MESSAGE_LENGTH, validateFile, formatFileSize } from '../../utils/messageUtils';
import { toast } from 'sonner';
import useTypingIndicator from '../../hooks/useTypingIndicator'; // ← AJOUT

// Constantes
const MAX_MOBILE_HEIGHT = 80;

// =============================
// Composants minimaux créés suite à audit
// =============================

// FilePreview : props utilisées = { file, onClear }
const FilePreview = memo(({ file, onClear }) => {
  if (!file) return null;
  const isImage = file.type?.startsWith('image/');
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {isImage ? (
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          className="w-10 h-10 object-cover rounded"
        />
      ) : (
        <Paperclip className="w-5 h-5 text-gray-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        aria-label="Retirer le fichier"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
});
FilePreview.displayName = 'FilePreview';
FilePreview.propTypes = {
  file: PropTypes.object,
  onClear: PropTypes.func.isRequired,
};

// CharCounter : props utilisées = { length, maxLength }
const CharCounter = memo(({ length, maxLength }) => {
  const remaining = maxLength - length;
  const isWarn = remaining < 50;
  const isError = remaining < 0;
  return (
    <span
      className={`text-xs tabular-nums ${
        isError ? 'text-red-500' : isWarn ? 'text-orange-500' : 'text-gray-400'
      }`}
    >
      {length}/{maxLength}
    </span>
  );
});
CharCounter.displayName = 'CharCounter';
CharCounter.propTypes = {
  length: PropTypes.number.isRequired,
  maxLength: PropTypes.number.isRequired,
};

// EphemeralOptions : props utilisées = { value, onChange } (durée en secondes, 0 = désactivé)
const EPHEMERAL_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1 min', value: 60 },
  { label: '1 h', value: 3600 },
  { label: '24 h', value: 86400 },
  { label: '7 j', value: 604800 },
];
const EphemeralOptions = memo(({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange?.(Number(e.target.value))}
    className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300"
    aria-label="Durée éphémère du message"
  >
    {EPHEMERAL_OPTIONS.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
));
EphemeralOptions.displayName = 'EphemeralOptions';
EphemeralOptions.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

// Composant principal
const MessageInput = ({
  conversationId,      // ← NOUVEAU : requis pour useTypingIndicator
  currentUserId,       // ← NOUVEAU : requis pour useTypingIndicator
  recipientId,         // ← NOUVEAU : requis pour useTypingIndicator
  onSendMessage,
  onFileUpload,
  onVoiceMessageSend,
  isSending = false,
  isUploading = false,
  disabled = false,
  placeholder = "Tapez un message..."
}) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioMetadata, setAudioMetadata] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [expiryTime, setExpiryTime] = useState(0);
  const [pendingFile, setPendingFile] = useState(null);
  const [validationError, setValidationError] = useState(null);
  
  const textareaRef = useRef(null);
  const isSendingRef = useRef(false);

  // 🔥 Utilisation du hook useTypingIndicator
  const {
    handleTextChange,    // ← Remplace handleMessageChange
    onMessageSent,       // ← À appeler après envoi
    isTyping,            // ← Indique si le partenaire tape (optionnel)
    typingDisplayText    // ← Texte à afficher (optionnel)
  } = useTypingIndicator(conversationId, currentUserId, recipientId);

  // Détection mobile pour ajuster la hauteur max
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const maxTextareaHeight = isMobile ? MAX_MOBILE_HEIGHT : 120;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxTextareaHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message, maxTextareaHeight]);

  // Gestion de la frappe - DÉLÉGUÉ au hook
  const handleMessageChange = useCallback((e) => {
    const newValue = e.target.value;
    setMessage(newValue);
    setValidationError(null);
    
    // 🔥 Déléguer au hook useTypingIndicator
    handleTextChange(newValue);
  }, [handleTextChange]);

  // Envoi du message avec protection contre double envoi
  const handleSend = useCallback(async () => {
    // Protection contre les envois multiples
    if (isSendingRef.current || isSending) {
      toast.warning("Envoi en cours, veuillez patienter");
      return;
    }
    
    let content = message.trim();
    
    // Mode audio
    if (audioBlob) {
      if (onVoiceMessageSend) {
        isSendingRef.current = true;
        try {
          await onVoiceMessageSend(audioBlob, recordingDuration, audioMetadata);
          setAudioBlob(null);
          setRecordingDuration(0);
          setAudioMetadata(null);
          // 🔥 Arrêter le typing après envoi
          onMessageSent();
        } finally {
          isSendingRef.current = false;
        }
      }
      return;
    }
    
    // Mode fichier
    if (pendingFile) {
      if (onFileUpload) {
        isSendingRef.current = true;
        try {
          await onFileUpload(pendingFile);
          setPendingFile(null);
          // 🔥 Arrêter le typing après envoi
          onMessageSent();
        } finally {
          isSendingRef.current = false;
        }
      }
      return;
    }
    
    // Mode texte
    const validation = validateMessage(content);
    
    if (!validation.valid) {
      setValidationError(validation.error);
      toast.error(validation.error);
      return;
    }
    
    isSendingRef.current = true;
    
    try {
      await onSendMessage(content, expiryTime);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      // 🔥 Arrêter le typing après envoi
      onMessageSent();
      
    } finally {
      isSendingRef.current = false;
    }
  }, [message, audioBlob, pendingFile, expiryTime, onSendMessage, onVoiceMessageSend, onFileUpload, recordingDuration, isSending, onMessageSent]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Validation du fichier avant envoi
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const validation = validateFile(file);
    
    if (!validation.valid) {
      toast.error(validation.error);
      e.target.value = '';
      return;
    }
    
    setPendingFile(file);
    e.target.value = '';
  }, []);

  const clearPendingFile = useCallback(() => {
    setPendingFile(null);
  }, []);

  const handleVoiceSend = useCallback(async (blob, duration, metadata) => {
    if (onVoiceMessageSend) {
      await onVoiceMessageSend(blob, duration, metadata || audioMetadata);
    }
    setAudioBlob(null);
    setRecordingDuration(0);
    setAudioMetadata(null);
    // 🔥 Arrêter le typing après envoi vocal
    onMessageSent();
  }, [onVoiceMessageSend, onMessageSent, audioMetadata]);

  const handleRecordingStop = useCallback((blob, duration, metadata) => {
    setIsRecording(false);
    if (blob) {
      setAudioBlob(blob);
      setRecordingDuration(duration);
      setAudioMetadata(metadata || null);
    }
  }, []);

  const handleRecordingCancel = useCallback(() => {
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingDuration(0);
    setAudioMetadata(null);
  }, []);

  const cancelAudioPreview = useCallback(() => {
    setAudioBlob(null);
    setRecordingDuration(0);
    setAudioMetadata(null);
  }, []);

  const isSendDisabled = (!message.trim() && !audioBlob && !pendingFile) || isSending || isUploading || disabled || isSendingRef.current;
  const currentMode = audioBlob ? 'audio' : (pendingFile ? 'file' : 'text');
  const showCharCounter = message.length > MAX_MESSAGE_LENGTH - 50;

  return (
    <div className="p-3 border-t border-border bg-[#f0f2f5] dark:bg-[#202c33]">
      {/* 🔥 Indicateur de frappe du partenaire (optionnel - à afficher où tu veux) */}
      {isTyping && typingDisplayText && (
        <div className="text-xs text-muted-foreground/70 mb-2 px-2">
          {typingDisplayText}
        </div>
      )}
      
      {/* Interface d'enregistrement vocal */}
      {isRecording ? (
        <VoiceRecorder
          onStart={() => setIsRecording(true)}
          onStop={handleRecordingStop}
          onCancel={handleRecordingCancel}
          maxDuration={60}
          enableCompression={true}
        />
      ) : (
        <div className="max-w-3xl mx-auto">
          {/* Aperçu audio */}
          {audioBlob && (
            <AudioPreview
              blob={audioBlob}
              duration={recordingDuration}
              onClear={cancelAudioPreview}
              onSend={() => handleVoiceSend(audioBlob, recordingDuration)}
              isUploading={isUploading}
            />
          )}
          
          {/* Aperçu fichier */}
          {pendingFile && (
            <FilePreview file={pendingFile} onClear={clearPendingFile} />
          )}
          
          {/* Zone de saisie principale (uniquement en mode texte) */}
          {currentMode === 'text' && (
            <>
              <div className={`flex items-end gap-2 bg-white dark:bg-[#2a3942] rounded-3xl px-3 py-2 shadow-sm border transition-all ${
                isFocused ? 'border-primary/30' : 'border-transparent'
              } ${disabled ? 'opacity-50' : ''}`}>
                {/* Bouton pièce jointe */}
                <input
                  type="file"
                  id="file-input"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={isUploading || disabled}
                  aria-label="Joindre un fichier"
                />
                <label
                  htmlFor="file-input"
                  className={`p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer ${
                    (isUploading || disabled) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  aria-label="Joindre un fichier"
                  aria-disabled={isUploading || disabled}
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </label>
                
                {/* Zone de texte */}
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={placeholder}
                  rows={1}
                  disabled={disabled || isSending}
                  maxLength={MAX_MESSAGE_LENGTH}
                  className="flex-1 bg-transparent border-none py-2 px-2 text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50 resize-none max-h-[120px] overflow-y-auto disabled:opacity-50"
                  style={{ minHeight: '40px' }}
                  aria-label="Message"
                  aria-invalid={!!validationError}
                />
                
                {/* Bouton microphone / envoi */}
                {message.trim() ? (
                  <button
                    onClick={handleSend}
                    disabled={isSendDisabled}
                    className="p-2 text-primary hover:text-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
                    aria-label="Envoyer le message"
                    aria-disabled={isSendDisabled}
                  >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                ) : (
                  <button
                    onClick={() => setIsRecording(true)}
                    disabled={disabled}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
                    aria-label="Enregistrer un message vocal"
                    aria-disabled={disabled}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Message d'erreur de validation */}
              {validationError && (
                <div className="flex items-center gap-1 mt-1 text-red-500 text-[10px]">
                  <AlertCircle className="w-3 h-3" />
                  <span>{validationError}</span>
                </div>
              )}
              
              {/* Compteur de caractères */}
              <CharCounter length={message.length} maxLength={MAX_MESSAGE_LENGTH} />
            </>
          )}
          
          {/* Options éphémères (uniquement en mode texte) */}
          {currentMode === 'text' && (
            <EphemeralOptions value={expiryTime} onChange={setExpiryTime} />
          )}
          
          {/* Indicateur de raccourci clavier */}
          {currentMode === 'text' && (
            <p className="text-center text-[9px] text-muted-foreground/40 mt-2">
              Entrée pour envoyer · Shift+Entrée pour une nouvelle ligne
            </p>
          )}
        </div>
      )}
    </div>
  );
};

MessageInput.propTypes = {
  conversationId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  recipientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSendMessage: PropTypes.func.isRequired,
  onFileUpload: PropTypes.func,
  onVoiceMessageSend: PropTypes.func,
  isSending: PropTypes.bool,
  isUploading: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string
};

export default memo(MessageInput);
