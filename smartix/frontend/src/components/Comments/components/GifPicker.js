
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Loader2, Search } from 'lucide-react';
import { useGifSearch } from '../hooks/useGifSearch';

// =============================
// CONSTANTES
// =============================
const GIF_GRID_COLUMNS = 3;
const GIF_ITEM_HEIGHT = 120;

// =============================
// COMPOSANT GIF PICKER
// =============================
const GifPicker = ({ isOpen, onClose, onSelect }) => {
  const {
    gifs,
    isSearching,
    query,
    error,
    hasMore,
    search,
    loadMore,
    clear
  } = useGifSearch();
  
  const inputRef = useRef(null);
  const gridRef = useRef(null);

  // Auto-focus à l'ouverture
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Nettoyer à la fermeture
  useEffect(() => {
    if (!isOpen) {
      clear();
    }
  }, [isOpen, clear]);

  // Gestion du scroll infini
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !isSearching) {
      loadMore();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#1C1E21] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Rechercher un GIF..."
          className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-sm"
        />
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Contenu */}
      <div 
        ref={gridRef}
        className="max-h-96 overflow-y-auto p-3"
        onScroll={handleScroll}
      >
        {/* État de chargement initial */}
        {isSearching && gifs.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 text-sm mb-2">{error}</p>
            <button
              onClick={() => search(query)}
              className="text-blue-500 text-sm hover:underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Grille de GIFs */}
        {gifs.length > 0 && (
          <div 
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${GIF_GRID_COLUMNS}, 1fr)` }}
          >
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => {
                  onSelect(gif);
                  onClose();
                }}
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 hover:scale-105 transition-transform duration-200"
                style={{ height: GIF_ITEM_HEIGHT }}
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium">Sélectionner</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Loader pour "charger plus" */}
        {isSearching && gifs.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        )}

        {/* Message de fin */}
        {!hasMore && gifs.length > 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">Plus de résultats</p>
          </div>
        )}

        {/* Aucun résultat */}
        {!isSearching && gifs.length === 0 && query && !error && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">Aucun GIF trouvé pour "{query}"</p>
          </div>
        )}

        {/* Message initial */}
        {!isSearching && gifs.length === 0 && !query && !error && (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Recherchez un GIF...</p>
          </div>
        )}
      </div>
    </div>
  );
};

GifPicker.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired
};

export default GifPicker;
