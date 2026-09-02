// src/components/modals/CommentsModal.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import CommentSection from '../clips/CommentSection';

// =============================
// GLOBAL SCROLL LOCK MANAGER (Singleton)
// =============================
let scrollLocks = 0;

const lockScroll = () => {
  scrollLocks++;
  if (scrollLocks === 1) {
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
  }
};

const unlockScroll = () => {
  scrollLocks--;
  if (scrollLocks === 0) {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
};

// =============================
// GLOBAL ESCAPE LISTENER MANAGER (Singleton)
// =============================
let escapeCallbacks = new Map();
let isEscapeListenerActive = false;
let currentTopModalId = null;

const registerEscapeCallback = (id, callback) => {
  escapeCallbacks.set(id, callback);
  
  if (!isEscapeListenerActive) {
    isEscapeListenerActive = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && currentTopModalId && escapeCallbacks.has(currentTopModalId)) {
        escapeCallbacks.get(currentTopModalId)();
      }
    });
  }
};

const unregisterEscapeCallback = (id) => {
  escapeCallbacks.delete(id);
  
  if (escapeCallbacks.size === 0) {
    isEscapeListenerActive = false;
    currentTopModalId = null;
  }
};

const setTopModal = (id) => {
  currentTopModalId = id;
};

// =============================
// GLOBAL MODAL STACK MANAGER
// =============================
let modalStack = [];

const pushModal = (id) => {
  modalStack.push(id);
  setTopModal(id);
  lockScroll();
};

const popModal = (id) => {
  const index = modalStack.indexOf(id);
  if (index !== -1) modalStack.splice(index, 1);
  setTopModal(modalStack[modalStack.length - 1] || null);
  unlockScroll();
};

// =============================
// HOOK: FOCUS TRAP
// =============================
const useFocusTrap = (containerRef, isActive, onEscape) => {
  const previousFocusRef = useRef(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    // Sauvegarder l'élément qui avait le focus
    previousFocusRef.current = document.activeElement;
    
    // Trouver tous les éléments focusables
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    // Focus sur le premier élément
    if (firstElement) {
      firstElement.focus();
    }
    
    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // Shift + Tab: si focus sur premier, aller au dernier
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: si focus sur dernier, aller au premier
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        onEscape?.();
      }
    };
    
    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
      
      // Restaurer le focus précédent
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, containerRef, onEscape]);
};

// =============================
// HOOK: ANIMATION DE SORTIE (transitionend)
// =============================
const useExitAnimation = (isOpen, onClose, duration = 300) => {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const elementRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
    }
  }, [isOpen, shouldRender]);
  
  const handleTransitionEnd = useCallback(() => {
    if (isClosing) {
      setShouldRender(false);
      onClose();
    }
  }, [isClosing, onClose]);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    element.addEventListener('transitionend', handleTransitionEnd);
    return () => element.removeEventListener('transitionend', handleTransitionEnd);
  }, [handleTransitionEnd]);
  
  return {
    shouldRender,
    isClosing,
    elementRef
  };
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CommentsModal = ({ show, clipId, onClose, onCountChange }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const modalId = useRef(`modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).current;
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  
  const {
    shouldRender,
    isClosing,
    elementRef: modalContentRef
  } = useExitAnimation(show, onClose, 300);
  
  // Gestion du stack et scroll lock
  useEffect(() => {
    if (show) {
      pushModal(modalId);
      registerEscapeCallback(modalId, () => {
        if (hasUnsavedChanges) {
          if (window.confirm('Vous avez un commentaire non envoyé. Quitter quand même ?')) {
            onClose();
          }
        } else {
          onClose();
        }
      });
    }
    
    return () => {
      if (show) {
        popModal(modalId);
        unregisterEscapeCallback(modalId);
      }
    };
  }, [show, modalId, onClose, hasUnsavedChanges]);
  
  // Focus trap
  useFocusTrap(modalRef, show, () => {
    if (hasUnsavedChanges) {
      if (window.confirm('Vous avez un commentaire non envoyé. Quitter quand même ?')) {
        onClose();
      }
    } else {
      onClose();
    }
  });
  
  // Détection des changements non sauvegardés (via CommentSection)
  const handleUnsavedChanges = useCallback((hasChanges) => {
    setHasUnsavedChanges(hasChanges);
  }, []);
  
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      if (hasUnsavedChanges) {
        if (window.confirm('Vous avez un commentaire non envoyé. Quitter quand même ?')) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  }, [hasUnsavedChanges, onClose]);
  
  const handleCloseClick = useCallback(() => {
    if (hasUnsavedChanges) {
      if (window.confirm('Vous avez un commentaire non envoyé. Quitter quand même ?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);
  
  if (!shouldRender) return null;
  
  return createPortal(
    <div 
      className={`fixed inset-0 bg-black/80 z-50 flex items-end justify-center transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comments-modal-title"
      aria-describedby="comments-modal-description"
    >
      <div 
        ref={modalRef}
        className={`w-full max-w-lg h-[85vh] min-h-[400px] bg-[#1A1A1A] rounded-t-3xl overflow-hidden flex flex-col transition-transform duration-300 ${
          isClosing ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
        {/* Header avec bouton de fermeture */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 
            id="comments-modal-title" 
            className="text-white font-semibold text-lg"
          >
            Commentaires
          </h2>
          <button
            ref={closeButtonRef}
            onClick={handleCloseClick}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
        
        {/* Section des commentaires */}
        <div 
          id="comments-modal-description"
          className="flex-1 overflow-hidden"
        >
          <CommentSection 
            clipId={clipId}
            onClose={onClose}
            onCountChange={onCountChange}
            onUnsavedChanges={handleUnsavedChanges}
          />
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
};

CommentsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  clipId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClose: PropTypes.func.isRequired,
  onCountChange: PropTypes.func
};

export default CommentsModal;
