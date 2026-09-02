import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Mic, MicOff, Send, Square, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import FileDropZone from './FileDropZone';
import { uploadFileToAI } from '../../services/aiService';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ChatInput = ({
  sendMessage,
  stopGeneration,
  isStreaming,
  disabled = false,
  placeholder = "Pose ta question à KIRIX...",
  onFileUpload
}) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const [showFileDrop, setShowFileDrop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // =============================
  // VÉRIFICATION SUPPORT VOIX
  // =============================
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionSupported(false);
    }
  }, []);

  // =============================
  // AUTO-REDIMENSIONNEMENT TEXTAREA
  // =============================
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [text]);

  // =============================
  // ENVOI DU MESSAGE
  // =============================
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled) return;

    if (trimmed.length > 2000) {
      toast.error('Message trop long (max 2000 caractères)');
      return;
    }

    setIsSending(true);
    setText('');

    try {
      await sendMessage(trimmed);
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  // =============================
  // RECONNAISSANCE VOCALE
  // =============================
  const startVoiceRecognition = () => {
    if (!recognitionSupported) {
      toast.error('Reconnaissance vocale non supportée');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'fr-FR';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      toast.info('Parlez maintenant...');
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');
      setText(prev => prev + ' ' + transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        toast.error('Accès microphone refusé');
      } else if (event.error === 'network') {
        toast.error('Erreur réseau');
      } else {
        toast.error('Erreur de reconnaissance vocale');
      }
      
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      toast.error('Impossible de démarrer la reconnaissance vocale');
      setIsListening(false);
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // =============================
  // UPLOAD DE FICHIER
  // =============================
  const handleFileUpload = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadedFile(file);

    try {
      // Appel à l'API d'upload
      const result = await uploadFileToAI(file, (progress) => {
        setUploadProgress(progress);
      });

      // Ajouter un message système ou envoyer le contenu
      if (result.text) {
        setText(prev => prev + ' ' + result.text);
      }

      // Notifier le parent si nécessaire
      if (onFileUpload) {
        onFileUpload(file, result.text);
      }

      toast.success('Fichier uploadé avec succès !');
      
      // Fermer la zone de drop après upload
      setTimeout(() => {
        setShowFileDrop(false);
        setUploadedFile(null);
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload du fichier');
      setUploadedFile(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // =============================
  // GESTIONNAIRE DE CLIC SUR LE BOUTON FICHIER
  // =============================
  const toggleFileDrop = () => {
    setShowFileDrop(prev => !prev);
  };

  // =============================
  // RACCOURCI CLAVIER
  // =============================
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || isSending || uploading;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Zone de drop de fichiers (conditionnelle) */}
      {showFileDrop && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <FileDropZone
            onFileUpload={handleFileUpload}
            uploading={uploading}
            progress={uploadProgress}
            uploadedFile={uploadedFile}
            onCancel={() => {
              setShowFileDrop(false);
              setUploadedFile(null);
            }}
          />
        </div>
      )}

      {/* Barre de saisie principale */}
      <div className="p-4">
        <div className="flex gap-2 items-end">
          {/* Bouton fichier */}
          <button
            onClick={toggleFileDrop}
            disabled={isDisabled}
            className={`
              p-3 rounded-lg transition-all
              ${showFileDrop 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label={showFileDrop ? 'Masquer l\'upload' : 'Uploader un fichier'}
            title={showFileDrop ? 'Masquer' : 'Uploader un fichier'}
          >
            <Paperclip size={20} />
          </button>

          {/* Bouton microphone */}
          {recognitionSupported && (
            <button
              onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
              disabled={isDisabled}
              className={`
                p-3 rounded-lg transition-all
                ${isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-label={isListening ? 'Arrêter la dictée' : 'Dictée vocale'}
              title={isListening ? 'Arrêter' : 'Dictée vocale'}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          {/* Zone de texte */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploading ? 'Upload en cours...' : placeholder}
              disabled={isDisabled || uploading}
              rows={1}
              className="
                w-full px-4 py-3 pr-20
                bg-gray-100 dark:bg-gray-700
                border border-gray-200 dark:border-gray-600
                rounded-lg
                text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500
                disabled:opacity-50 disabled:cursor-not-allowed
                resize-none
              "
              aria-label="Saisie du message"
            />
            
            {/* Indicateur de longueur */}
            <span className="
              absolute bottom-2 right-3
              text-xs text-gray-400 dark:text-gray-500
              pointer-events-none
            ">
              {text.length}/2000
            </span>
          </div>

          {/* Bouton d'envoi/stop */}
          {!isStreaming ? (
            <button
              onClick={handleSend}
              disabled={(!text.trim() && !uploadedFile) || isDisabled}
              className="
                px-6 py-3
                bg-indigo-600 hover:bg-indigo-700
                disabled:bg-indigo-400 disabled:cursor-not-allowed
                text-white font-medium
                rounded-lg
                transition-colors
                flex items-center gap-2
              "
              aria-label="Envoyer le message"
            >
              {isSending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="hidden sm:inline">Envoi...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span className="hidden sm:inline">Envoyer</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={stopGeneration}
              className="
                px-6 py-3
                bg-red-500 hover:bg-red-600
                text-white font-medium
                rounded-lg
                transition-colors
                flex items-center gap-2
              "
              aria-label="Arrêter la génération"
            >
              <Square size={18} className="fill-current" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

ChatInput.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  stopGeneration: PropTypes.func,
  isStreaming: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  onFileUpload: PropTypes.func,
};

export default ChatInput;
