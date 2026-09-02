import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, X } from 'lucide-react';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const QuotaModal = ({ isOpen, onClose, quota, loading = false }) => {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  // =============================
  // PIÉGER LE FOCUS DANS LA MODAL
  // =============================
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // =============================
  // FOCUS SUR LE BOUTON DE FERMETURE À L'OUVERTURE
  // =============================
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const percentage = quota && quota.total > 0
    ? Math.round((quota.used / quota.total) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="quota-modal-title"
    >
      <div
        ref={modalRef}
        className="
          bg-white dark:bg-gray-800
          rounded-2xl shadow-2xl
          w-full max-w-md
          p-6
          relative
          transform transition-all
          scale-100
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton de fermeture */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="
            absolute top-4 right-4
            p-2 rounded-lg
            text-gray-400 hover:text-gray-600
            dark:text-gray-500 dark:hover:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-indigo-500
          "
          aria-label="Fermer"
        >
          <X size={20} />
        </button>

        {/* Icône */}
        <div className="flex justify-center mb-4">
          <div className="
            w-16 h-16 rounded-full
            bg-yellow-100 dark:bg-yellow-900/30
            flex items-center justify-center
          ">
            <AlertTriangle size={32} className="text-yellow-600 dark:text-yellow-500" />
          </div>
        </div>

        {/* Titre */}
        <h2
          id="quota-modal-title"
          className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2"
        >
          Limite quotidienne atteinte
        </h2>

        {/* Description */}
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Vous avez atteint votre quota d'utilisation de l'IA pour aujourd'hui.
        </p>

        {/* Barre de progression (si quota disponible) */}
        {quota && !loading && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Utilisation aujourd'hui</span>
              <span>{quota.used} / {quota.total} messages</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 dark:bg-yellow-600 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 text-center">
              {quota.remaining === 0
                ? "Plus de messages disponibles aujourd'hui"
                : `Il vous reste ${quota.remaining} message${quota.remaining > 1 ? 's' : ''}`
              }
            </p>
          </div>
        )}

        {/* Loader */}
        {loading && (
          <div className="flex justify-center mb-6">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Options d'upgrade */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
            Pour continuer à utiliser l'IA aujourd'hui, vous pouvez :
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                // Redirection vers la page d'abonnement
                window.location.href = '/pricing';
              }}
              className="
                w-full px-4 py-3
                bg-indigo-600 hover:bg-indigo-700
                text-white font-medium
                rounded-lg
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500
              "
            >
              Passer à la version supérieure
            </button>
            <button
              onClick={onClose}
              className="
                w-full px-4 py-2
                text-gray-600 dark:text-gray-400
                hover:text-gray-900 dark:hover:text-white
                hover:bg-gray-100 dark:hover:bg-gray-700
                rounded-lg
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-gray-400
              "
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

QuotaModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  quota: PropTypes.object,
  loading: PropTypes.bool,
};

export default QuotaModal;
