import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Edit2, X } from 'lucide-react';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const RenameModal = ({ isOpen, onClose, onRename, thread }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const closeButtonRef = useRef(null);

  // =============================
  // METTRE À JOUR LE NOM QUAND LE THREAD CHANGE
  // =============================
  useEffect(() => {
    if (thread?.title) {
      setName(thread.title);
      setError('');
    }
  }, [thread]);

  // =============================
  // PIÉGER LE FOCUS ET GÉRER ESCAPE
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
  // FOCUS SUR L'INPUT À L'OUVERTURE
  // =============================
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // =============================
  // SOUMISSION DU FORMULAIRE
  // =============================
  const handleSubmit = (e) => {
    e?.preventDefault();

    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Le nom ne peut pas être vide');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Le nom est trop long (max 100 caractères)');
      return;
    }

    onRename(trimmedName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="rename-modal-title"
    >
      <div
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
            bg-indigo-100 dark:bg-indigo-900/30
            flex items-center justify-center
          ">
            <Edit2 size={32} className="text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* Titre */}
        <h2
          id="rename-modal-title"
          className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6"
        >
          Renommer la conversation
        </h2>

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="thread-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Nouveau nom
            </label>
            <input
              ref={inputRef}
              id="thread-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className={`
                w-full px-4 py-3
                bg-gray-100 dark:bg-gray-700
                border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                rounded-lg
                text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-indigo-500
                transition-colors
              `}
              placeholder="Ma conversation"
              aria-label="Nom de la conversation"
              aria-invalid={!!error}
              aria-describedby={error ? 'rename-error' : undefined}
            />
            {error && (
              <p id="rename-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="
                flex-1 px-4 py-3
                bg-gray-200 dark:bg-gray-700
                hover:bg-gray-300 dark:hover:bg-gray-600
                text-gray-900 dark:text-white
                font-medium
                rounded-lg
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-gray-400
              "
              aria-label="Annuler"
            >
              Annuler
            </button>

            <button
              type="submit"
              className="
                flex-1 px-4 py-3
                bg-indigo-600 hover:bg-indigo-700
                text-white font-medium
                rounded-lg
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500
              "
              aria-label="Sauvegarder"
            >
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

RenameModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onRename: PropTypes.func,
  thread: PropTypes.object,
};

export default RenameModal;
