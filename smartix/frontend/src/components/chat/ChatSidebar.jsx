import React, { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { MessageSquarePlus, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import ThreadMenu from './ThreadMenu';

// =============================
// PROPS
// =============================

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ChatSidebar = ({
  threads,
  currentThreadId,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onDeleteThread,
  collapsed = false,
  onToggleCollapse
}) => {
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const listRef = useRef(null);
  const searchInputRef = useRef(null);

  // =============================
  // FERMER LE MENU AU CLIC EXTÉRIEUR
  // =============================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpenFor && !(e.target).closest('.thread-menu')) {
        setMenuOpenFor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenFor]);

  // =============================
  // FILTRAGE DES THREADS
  // =============================
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    
    const query = searchQuery.toLowerCase().trim();
    return threads.filter(thread => 
      thread.title.toLowerCase().includes(query)
    );
  }, [threads, searchQuery]);

  // =============================
  // RACCOURCI CLAVIER POUR LA RECHERCHE
  // =============================
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K pour focus la recherche
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape pour effacer la recherche
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // =============================
  // FORMATAGE DE LA DATE
  // =============================
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR');
  };

  // =============================
  // GESTIONNAIRES DE RECHERCHE
  // =============================
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <div
      className={`
        h-full flex flex-col
        bg-white dark:bg-gray-800
        border-r border-gray-200 dark:border-gray-700
        transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
      `}
      role="complementary"
      aria-label="Historique des conversations"
    >
      {/* Header avec bouton collapse */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && (
          <h3 className="font-semibold text-gray-900 dark:text-white">Conversations</h3>
        )}
        
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="
              p-2 rounded-lg
              hover:bg-gray-100 dark:hover:bg-gray-700
              text-gray-600 dark:text-gray-300
              transition-colors
            "
            aria-label={collapsed ? 'Développer' : 'Réduire'}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </div>

      {/* Bouton Nouveau Chat */}
      <button
        onClick={onNewThread}
        className={`
          m-3 p-2
          bg-blue-600 hover:bg-blue-700
          text-white font-medium
          rounded-lg
          transition-all
          flex items-center justify-center gap-2
          focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800
        `}
        aria-label="Nouvelle conversation"
      >
        <MessageSquarePlus size={20} />
        {!collapsed && <span>Nouveau chat</span>}
      </button>

      {/* ✅ Barre de recherche (visible seulement quand non replié) */}
      {!collapsed && (
        <div className="px-3 mb-3">
          <div
            className={`
              relative flex items-center
              transition-all duration-200
              ${searchFocused ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}
            `}
          >
            <Search
              size={16}
              className="absolute left-3 text-gray-400 dark:text-gray-500"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Rechercher... (Ctrl+K)"
              className="
                w-full pl-9 pr-8 py-2
                bg-gray-100 dark:bg-gray-700
                border border-gray-200 dark:border-gray-600
                rounded-lg
                text-sm text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400
                focus:outline-none
                transition-colors
              "
              aria-label="Rechercher une conversation"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Effacer la recherche"
              >
                <X size={14} className="text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>
          
          {/* Résultats de recherche */}
          {searchQuery && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
              {filteredThreads.length} résultat{filteredThreads.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Liste des threads */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        role="list"
        aria-label="Liste des conversations"
      >
        {filteredThreads.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            {!collapsed && (
              <>
                {searchQuery ? (
                  <>
                    <p>Aucune conversation trouvée</p>
                    <p className="text-xs mt-2">Essayez un autre terme</p>
                  </>
                ) : (
                  <>
                    <p>Aucune conversation</p>
                    <p className="text-xs mt-2">Cliquez sur "Nouveau chat"</p>
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isActive = thread.id === currentThreadId;
            const menuOpen = menuOpenFor === thread.id;

            return (
              <div
                key={thread.id}
                className={`
                  flex items-center justify-between p-3
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors
                  cursor-pointer
                  ${isActive ? 'bg-gray-100 dark:bg-gray-700' : ''}
                  ${collapsed ? 'justify-center' : ''}
                `}
                onClick={() => onSelectThread(thread.id)}
                role="listitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectThread(thread.id);
                  }
                }}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Conversation ${thread.title}${isActive ? ' (active)' : ''}`}
              >
                {/* Titre du thread */}
                {!collapsed ? (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {thread.title}
                    </p>
                    {thread.updatedAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDate(thread.updatedAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                )}

                {/* Menu des actions (visible seulement quand non replié) */}
                {!collapsed && (
                  <div className="thread-menu opacity-0 group-hover:opacity-100 transition-opacity">
                    <ThreadMenu
                      onRename={() => {
                        onRenameThread(thread);
                        setMenuOpenFor(null);
                      }}
                      onDelete={() => {
                        onDeleteThread(thread.id);
                        setMenuOpenFor(null);
                      }}
                      isOpen={menuOpen}
                      onToggle={() => setMenuOpenFor(menuOpen ? null : thread.id)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

ChatSidebar.propTypes = {
  threads: PropTypes.array.isRequired,
  currentThreadId: PropTypes.string,
  onSelectThread: PropTypes.func,
  onNewThread: PropTypes.func,
  onRenameThread: PropTypes.func,
  onDeleteThread: PropTypes.func,
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
};

export default ChatSidebar;
