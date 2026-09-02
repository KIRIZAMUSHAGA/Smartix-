import React from 'react';
import PropTypes from 'prop-types';
import { MessageSquarePlus, Menu, Moon, Sun } from 'lucide-react';
import useTheme from '../../hooks/useTheme';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ChatHeader = ({
  title = 'AI Chat',
  onNewChat,
  onMenuClick,
  showMenu = false
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="
        flex items-center justify-between
        p-4 border-b
        bg-white dark:bg-gray-800
        border-gray-200 dark:border-gray-700
        sticky top-0 z-10
      "
      role="banner"
    >
      {/* Bouton menu (mobile) */}
      {showMenu && (
        <button
          onClick={onMenuClick}
          className="
            p-2 rounded-lg
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors
            lg:hidden
          "
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* Titre */}
      <h2
        className="
          text-lg font-semibold
          text-gray-900 dark:text-white
          truncate flex-1
          lg:ml-0
        "
      >
        {title}
      </h2>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* ✅ Bouton Dark Mode */}
        <button
          onClick={toggleTheme}
          className="
            p-2 rounded-lg
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
          "
          aria-label={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Moon className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        {/* Bouton Nouveau Chat */}
        {onNewChat && (
          <button
            onClick={onNewChat}
            className="
              flex items-center gap-2
              px-4 py-2 rounded-lg
              bg-blue-600 dark:bg-blue-500
              hover:bg-blue-700 dark:hover:bg-blue-600
              text-white font-medium
              transition-all duration-200
              hover:shadow-lg
              focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800
            "
            aria-label="Nouvelle conversation"
          >
            <MessageSquarePlus className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">Nouveau chat</span>
          </button>
        )}
      </div>
    </header>
  );
};

ChatHeader.propTypes = {
  title: PropTypes.string,
  onNewChat: PropTypes.func,
  onMenuClick: PropTypes.func,
  showMenu: PropTypes.bool,
};

export default ChatHeader;
