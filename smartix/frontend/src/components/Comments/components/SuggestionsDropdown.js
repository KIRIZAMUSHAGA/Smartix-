// frontend/src/components/Comments/components/SuggestionsDropdown.js
import React, { useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Loader2, User, Hash, AtSign, TrendingUp, Users } from 'lucide-react';

// =============================
// CONSTANTES
// =============================
const MAX_VISIBLE_SUGGESTIONS = 8;
const SCROLL_ITEM_HEIGHT = 48; // px

// =============================
// HELPER : HIGHLIGHT DU TEXTE RECHERCHÉ
// =============================
const highlightText = (text, query) => {
  if (!query || !text) return text;
  
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <strong key={i} className="font-bold text-blue-600 dark:text-blue-400">
        {part}
      </strong>
    ) : (
      part
    )
  );
};

// =============================
// COMPOSANT D'UNE SUGGESTION INDIVIDUELLE (AVEC FORWARDREF)
// =============================
const SuggestionItem = forwardRef(({ 
  suggestion, 
  isActive, 
  onSelect, 
  index, 
  onMouseEnter,
  searchQuery = ''
}, ref) => {
  const isMention = suggestion.type === 'mention';
  const isHashtag = suggestion.type === 'hashtag';
  
  // Optimisation avec useMemo pour les éléments statiques
  const { icon, badge } = useMemo(() => {
    let iconElement = null;
    let badgeElement = null;
    
    if (isMention) {
      iconElement = <AtSign className="w-4 h-4 text-blue-500" />;
    } else if (isHashtag) {
      iconElement = <Hash className="w-4 h-4 text-purple-500" />;
    } else {
      iconElement = <User className="w-4 h-4 text-gray-500" />;
    }
    
    if (isHashtag && suggestion.trending) {
      badgeElement = (
        <span className="flex items-center gap-1 text-[10px] text-orange-500">
          <TrendingUp className="w-3 h-3" />
          Tendance
        </span>
      );
    } else if (isMention && suggestion.is_friend) {
      badgeElement = (
        <span className="flex items-center gap-1 text-[10px] text-green-500">
          <Users className="w-3 h-3" />
          Ami
        </span>
      );
    }
    
    return { icon: iconElement, badge: badgeElement };
  }, [isMention, isHashtag, suggestion.trending, suggestion.is_friend]);

  // Highlight du texte recherché
  const highlightedValue = useMemo(() => 
    highlightText(suggestion.value, searchQuery),
    [suggestion.value, searchQuery]
  );

  const handleMouseDown = (e) => {
    e.preventDefault(); // Évite le blur de l'input avant la sélection
    onSelect(suggestion);
  };

  return (
    <li
      ref={ref}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => onMouseEnter(index)}
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-all duration-150 ${
        isActive 
          ? 'bg-blue-50 dark:bg-blue-900/30' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      role="option"
      aria-selected={isActive}
      id={`suggestion-${index}`}
      tabIndex={-1}
    >
      {/* Avatar ou icône */}
      {isMention && suggestion.avatar ? (
        <img
          src={suggestion.avatar}
          alt={suggestion.label}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isMention ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-purple-100 dark:bg-purple-900/50'
        }`}>
          {icon}
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm truncate ${
            isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
          }`}>
            {highlightedValue}
          </span>
          {badge}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {suggestion.label}
          {isHashtag && suggestion.post_count > 0 && (
            <span className="ml-2 text-[10px]">
              • {suggestion.post_count} post{suggestion.post_count > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Indicateur de sélection */}
      {isActive && (
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
      )}
    </li>
  );
});

SuggestionItem.displayName = 'SuggestionItem';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SuggestionsDropdown = ({ 
  suggestions, 
  activeIndex = -1, 
  isLoading = false,
  onSelect, 
  onClose,
  onActiveIndexChange,
  searchQuery = '',
  className = ""
}) => {
  const dropdownRef = useRef(null);
  const activeItemRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevActiveIndexRef = useRef(activeIndex);

  // =============================
  // GESTION CLAVIER SUR LE COMPOSANT (SANS LISTENER GLOBAL)
  // =============================
  const handleKeyDown = useCallback((e) => {
    if (!suggestions.length || isLoading) return;
    
    const isNavigationKey = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key);
    if (!isNavigationKey) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = (activeIndex + 1) % suggestions.length;
        onActiveIndexChange?.(nextIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
        onActiveIndexChange?.(prevIndex);
        break;
      case 'Enter':
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          e.preventDefault();
          onSelect(suggestions[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  }, [suggestions, activeIndex, isLoading, onSelect, onClose, onActiveIndexChange]);

  // =============================
  // FERMETURE AU CLIC EXTÉRIEUR (OPTIMISÉ AVEC useCallback + pointerdown)
  // =============================
  const handleClickOutside = useCallback((event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      onClose();
    }
  }, [onClose]);

  // =============================
  // GESTION DU FOCUS POUR CAPTURER LE CLAVIER
  // =============================
  const handleFocus = useCallback(() => {
    // Le container est focusable, on peut capturer les événements clavier
  }, []);

  // =============================
  // EFFETS
  // =============================
  useEffect(() => {
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [handleClickOutside]);

  // Scroll automatique avec comportement adaptatif
  useEffect(() => {
    if (activeIndex >= 0 && activeItemRef.current && scrollContainerRef.current) {
      const shouldSmooth = Math.abs(activeIndex - prevActiveIndexRef.current) === 1;
      activeItemRef.current.scrollIntoView({ 
        block: 'nearest', 
        behavior: shouldSmooth ? 'smooth' : 'auto'
      });
    }
    prevActiveIndexRef.current = activeIndex;
  }, [activeIndex]);

  // =============================
  // GESTION DU SURVOL DE LA SOURIS
  // =============================
  const handleMouseEnter = useCallback((index) => {
    if (onActiveIndexChange && index !== activeIndex) {
      onActiveIndexChange(index);
    }
  }, [activeIndex, onActiveIndexChange]);

  // =============================
  // LIMITER LE NOMBRE DE SUGGESTIONS AFFICHÉES
  // =============================
  const visibleSuggestions = useMemo(() => 
    suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS),
    [suggestions]
  );
  
  const hasMore = suggestions.length > MAX_VISIBLE_SUGGESTIONS;

  // =============================
  // GÉNÉRATION D'UNE CLÉ UNIQUE ET STABLE
  // =============================
  const getUniqueKey = useCallback((suggestion) => {
    // Utiliser l'ID si disponible, sinon une combinaison type+valeur
    return suggestion.id ?? `${suggestion.type}-${suggestion.value}`;
  }, []);

  // =============================
  // PAS DE SUGGESTIONS
  // =============================
  if (!suggestions.length && !isLoading) return null;

  // =============================
  // RENDU
  // =============================
  return (
    <div
      ref={dropdownRef}
      className={`absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden ${className}`}
      role="listbox"
      aria-label="Suggestions"
      aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onFocus={handleFocus}
    >
      {/* En-tête avec compteur */}
      {suggestions.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Liste des suggestions */}
      <div 
        ref={scrollContainerRef}
        className="max-h-64 overflow-y-auto"
        style={{ maxHeight: MAX_VISIBLE_SUGGESTIONS * SCROLL_ITEM_HEIGHT }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">Chargement...</span>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleSuggestions.map((suggestion, idx) => (
              <SuggestionItem
                key={getUniqueKey(suggestion)}
                ref={idx === activeIndex ? activeItemRef : null}
                suggestion={suggestion}
                isActive={idx === activeIndex}
                onSelect={onSelect}
                index={idx}
                onMouseEnter={handleMouseEnter}
                searchQuery={searchQuery}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Indicateur "plus de résultats" */}
      {hasMore && !isLoading && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-[10px] text-center text-gray-500 dark:text-gray-400">
            +{suggestions.length - MAX_VISIBLE_SUGGESTIONS} autres suggestions
          </p>
        </div>
      )}

      {/* Pied de page avec raccourcis clavier */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-[10px] text-gray-400 flex justify-between">
        <span>↑↓ pour naviguer</span>
        <span>↵ pour sélectionner</span>
        <span>⎋ pour fermer</span>
      </div>
    </div>
  );
};

// =============================
// MÉMOÏSATION AVEC COMPARAISON PERSONNALISÉE
// =============================
const arePropsEqual = (prev, next) => {
  return (
    prev.suggestions === next.suggestions &&
    prev.activeIndex === next.activeIndex &&
    prev.isLoading === next.isLoading &&
    prev.searchQuery === next.searchQuery &&
    prev.onSelect === next.onSelect &&
    prev.onClose === next.onClose &&
    prev.onActiveIndexChange === next.onActiveIndexChange &&
    prev.className === next.className
  );
};

SuggestionsDropdown.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string,
      type: PropTypes.string,
      trending: PropTypes.bool,
      is_friend: PropTypes.bool,
      post_count: PropTypes.number
    })
  ).isRequired,
  activeIndex: PropTypes.number,
  isLoading: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onActiveIndexChange: PropTypes.func,
  searchQuery: PropTypes.string,
  className: PropTypes.string
};

export default React.memo(SuggestionsDropdown, arePropsEqual);
