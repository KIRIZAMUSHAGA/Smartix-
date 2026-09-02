import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';

// =============================
// PROPS
// =============================

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ThreadMenu = ({ onRename, onDelete, isOpen = false, onToggle }) => {
  const [localOpen, setLocalOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Utiliser la prop isOpen si fournie, sinon l'état local
  const open = onToggle !== undefined ? isOpen : localOpen;

  // =============================
  // FERMETURE AU CLIC EXTÉRIEUR
  // =============================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (onToggle) {
          onToggle(); // Fermer via prop
        } else {
          setLocalOpen(false);
        }
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onToggle]);

  // =============================
  // GESTION DES TOUCHES CLAVIER
  // =============================
  const handleKeyDown = (e) => {
    if (!open) return;

    switch (e.key) {
      case 'Escape':
        if (onToggle) {
          onToggle();
        } else {
          setLocalOpen(false);
        }
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Focus sur le premier élément
        const firstItem = menuRef.current?.querySelector('button[role="menuitem"]');
        firstItem?.focus();
        break;
    }
  };

  // =============================
  // GESTION DE L'OUVERTURE
  // =============================
  const toggleMenu = (e) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle();
    } else {
      setLocalOpen(!localOpen);
    }
  };

  // =============================
  // GESTION DES ACTIONS
  // =============================
  const handleAction = (action: () => void) => (e) => {
    e.stopPropagation();
    action();
    if (onToggle) {
      onToggle();
    } else {
      setLocalOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Bouton du menu */}
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="
          p-2 rounded-lg
          text-gray-600 dark:text-gray-400
          hover:bg-gray-100 dark:hover:bg-gray-700
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
        "
        aria-label="Options de la conversation"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={18} />
      </button>

      {/* Menu déroulant */}
      {open && (
        <div
          className="
            absolute right-0 mt-2 w-40
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            py-1
            z-50
          "
          role="menu"
          aria-label="Menu des options"
        >
          {/* Option Renommer */}
          <button
            onClick={handleAction(onRename)}
            className="
              w-full px-4 py-2
              flex items-center gap-2
              text-left text-sm
              text-gray-700 dark:text-gray-200
              hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
              focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
            "
            role="menuitem"
          >
            <Edit2 size={16} className="text-gray-500 dark:text-gray-400" />
            Renommer
          </button>

          {/* Option Supprimer */}
          <button
            onClick={handleAction(onDelete)}
            className="
              w-full px-4 py-2
              flex items-center gap-2
              text-left text-sm
              text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20
              transition-colors
              focus:outline-none focus:bg-red-50 dark:focus:bg-red-900/20
            "
            role="menuitem"
          >
            <Trash2 size={16} />
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
};

ThreadMenu.propTypes = {
  onRename: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isOpen: PropTypes.bool,
  onToggle: PropTypes.func
};

export default ThreadMenu;
