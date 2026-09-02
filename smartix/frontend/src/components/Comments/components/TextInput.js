// frontend/src/components/Comments/components/TextInput.js
import React, { forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const MIN_HEIGHT = 44;
const MAX_HEIGHT = 120;

// =============================
// COMPOSANT PRINCIPAL
// =============================
const TextInput = forwardRef(({
  value,
  onChange,
  onSubmit,
  placeholder = "Écrire un commentaire...",
  disabled = false,
  maxLength = 500,
  autoFocus = false,
  onKeyDown,
  onCursorChange,
  onFocus,
  onBlur
}, ref) => {
  const textareaRef = useRef(null);
  const isFocusedRef = useRef(false);

  // =============================
  // EXPOSER LES MÉTHODES AU PARENT
  // =============================
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
    blur: () => {
      textareaRef.current?.blur();
    },
    clear: () => {
      const event = { target: { value: '' } };
      onChange(event);
    },
    getValue: () => value,
    setValue: (newValue) => {
      const event = { target: { value: newValue } };
      onChange(event);
    },
    getCursorPosition: () => textareaRef.current?.selectionStart || 0,
    setCursorPosition: (pos) => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(pos, pos);
        textareaRef.current.focus();
        onCursorChange?.(pos);
      }
    }
  }));

  // =============================
  // AUTO-RESIZE DU TEXTAREA
  // =============================
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // =============================
  // AUTO-FOCUS
  // =============================
  useEffect(() => {
    if (autoFocus && textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // =============================
  // RESIZE À CHAQUE CHANGEMENT DE VALEUR
  // =============================
  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  // =============================
  // GESTIONNAIRES D'ÉVÉNEMENTS
  // =============================
  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // Le maxLength du textarea bloque déjà, cette vérification est optionnelle
    if (newValue.length > maxLength) return;
    
    onChange(e);
  };

  const handleInput = (e) => {
    resizeTextarea();
    
    // Mettre à jour la position du curseur
    const pos = e.target.selectionStart;
    onCursorChange?.(pos);
  };

  const handleSelect = (e) => {
    const pos = e.target.selectionStart;
    onCursorChange?.(pos);
  };

  const handleClick = (e) => {
    const pos = e.target.selectionStart;
    onCursorChange?.(pos);
  };

  const handleKeyDown = (e) => {
    // Gestion spécifique de la touche Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    
    // Propager l'événement au parent
    onKeyDown?.(e);
  };

  const handleFocus = (e) => {
    isFocusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    isFocusedRef.current = false;
    onBlur?.(e);
  };

  // =============================
  // RENDU
  // =============================
  return (
    <div className="flex-1 relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onInput={handleInput}
        onSelect={handleSelect}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={1}
        className={`
          w-full bg-transparent border-none outline-none 
          text-gray-900 dark:text-white 
          placeholder-gray-400 dark:placeholder-gray-500 
          resize-none leading-relaxed text-sm
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
        `}
        style={{ 
          minHeight: `${MIN_HEIGHT}px`,
          maxHeight: `${MAX_HEIGHT}px`,
          height: 'auto'
        }}
        aria-label="Saisie du commentaire"
        aria-invalid={value.length > maxLength}
        aria-describedby={value.length > maxLength ? "text-limit-error" : undefined}
      />
      
      {/* Indicateur de limite de caractères */}
      {value.length > 0 && (
        <div className="absolute right-2 bottom-2 pointer-events-none">
          <span className={`
            text-[10px] font-medium transition-colors duration-200
            ${value.length > maxLength - 50 
              ? 'text-orange-500 dark:text-orange-400' 
              : 'text-gray-400 dark:text-gray-500'
            }
          `}>
            {value.length}/{maxLength}
          </span>
        </div>
      )}
      
      {/* Message d'erreur de limite (accessibilité) */}
      {value.length > maxLength && (
        <div id="text-limit-error" className="sr-only">
          Le texte dépasse la limite de {maxLength} caractères
        </div>
      )}
    </div>
  );
});

TextInput.displayName = 'TextInput';

TextInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  maxLength: PropTypes.number,
  autoFocus: PropTypes.bool,
  onKeyDown: PropTypes.func,
  onCursorChange: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func
};

export default TextInput;
