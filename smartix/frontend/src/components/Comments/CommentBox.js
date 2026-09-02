import React, { useState, useRef, useEffect, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import CommentInput from './CommentInput';

// =============================
// CONSTANTES
// =============================
const COMMENT_MAX_LENGTH = 500;

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CommentBox = ({ 
  onSubmit, 
  onCancelReply, 
  replyingTo,
  placeholder,
  disabled = false,
  autoFocus = false
}) => {
  const { user } = useAuth();
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef(null);

  // =============================
  // AUTO-FOCUS SUR LE CHAMP DE TEXTE EN MODE RÉPONSE
  // =============================
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // =============================
  // GESTION DU SOUMISSION
  // =============================
  const handleSubmit = async (data) => {
    if (disabled) return;
    
    // Validation locale
    if (!data.content?.trim()) {
      setLocalError('Le commentaire ne peut pas être vide');
      return;
    }
    
    if (data.content.length > COMMENT_MAX_LENGTH) {
      setLocalError(`Maximum ${COMMENT_MAX_LENGTH} caractères`);
      return;
    }

    setLocalError(null);

    try {
      // Fire-and-forget avec gestion optimiste
      // Le parent gère le rollback en cas d'erreur
      await onSubmit(data, replyingTo?.id);
      
      // Reset après soumission réussie
      if (inputRef.current) {
        inputRef.current.clear?.(); // Si CommentInput a une méthode clear
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      setLocalError('Erreur lors de l\'envoi. Veuillez réessayer.');
    }
  };

  // =============================
  // RENDU
  // =============================
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10 shadow-lg">
      <div className="max-w-2xl mx-auto p-4 pb-safe">
        {/* Indicateur de réponse */}
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Réponse à{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {replyingTo.authorName || replyingTo.author?.full_name}
              </span>
            </span>
            <button
              onClick={onCancelReply}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Annuler la réponse"
              disabled={disabled}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Message d'erreur local */}
        {localError && (
          <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {localError}
          </div>
        )}

        {/* Champ de saisie */}
        <CommentInput
          ref={inputRef}
          onSubmit={handleSubmit}
          placeholder={placeholder || (replyingTo ? 'Écrire une réponse...' : 'Ajouter un commentaire...')}
          disabled={disabled}
          maxLength={COMMENT_MAX_LENGTH}
          autoFocus={autoFocus || !!replyingTo}
        />

        {/* Indicateur de chargement (optionnel) */}
        {disabled && (
          <div className="mt-2 flex justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          </div>
        )}

        {/* Raccourci clavier */}
        <div className="mt-2 text-right">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Entrée pour envoyer • Shift+Entrée pour nouvelle ligne
          </span>
        </div>
      </div>
    </div>
  );
};

CommentBox.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onCancelReply: PropTypes.func,
  replyingTo: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    authorName: PropTypes.string,
    author: PropTypes.shape({
      full_name: PropTypes.string
    })
  }),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool
};

export default CommentBox;
