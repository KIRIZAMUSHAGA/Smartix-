import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Search } from 'lucide-react';

const MentionsAutocomplete = ({ onSelect, trigger = '@' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (query.length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Debounce API call
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const backendUrl = window.location.origin.replace(':5000', ':8000');
        const response = await fetch(
          `${backendUrl}/api/autocomplete?query=${query}&trigger=${trigger}&limit=6`
        );
        const data = await response.json();
        setResults(data.results || []);
        setIsOpen(true);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Autocomplete error:', error);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, trigger]);

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelect = (result) => {
    onSelect?.(result);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
        <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">{trigger}</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length > 0 && setIsOpen(true)}
          placeholder="Chercher..."
          className="bg-transparent flex-1 outline-none text-gray-900 dark:text-white placeholder-gray-500"
        />
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className={`w-full px-4 py-3 flex items-center gap-3 transition-all text-left ${
                idx === selectedIndex
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {/* Avatar */}
              {result.avatar ? (
                <img
                  src={result.avatar}
                  alt={result.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {(result.name || 'U')[0]}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {result.name}
                </p>
                {result.username && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    @{result.username}
                  </p>
                )}
                {result.count && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {result.count} posts
                  </p>
                )}
              </div>

              {/* Type Badge */}
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
                {result.type === 'user' ? '👤' : result.type === 'group' ? '👥' : '#'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
          Chargement...
        </div>
      )}
    </div>
  );
};

MentionsAutocomplete.propTypes = {
  onSelect: PropTypes.func.isRequired,
  trigger: PropTypes.string
};

export default MentionsAutocomplete;
