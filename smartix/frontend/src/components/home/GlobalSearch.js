import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, History, TrendingUp, Users, BookOpen, Code2, ShoppingBag, Newspaper } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import PropTypes from 'prop-types';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([
    'React tutorial',
    'Créer une app mobile',
    'Template e-commerce'
  ]);

  // Suggestions populaires (simulées)
  const popularSuggestions = [
    { type: 'course', icon: BookOpen, text: 'Introduction à React', color: 'text-orange-400' },
    { type: 'project', icon: Code2, text: 'Application météo', color: 'text-purple-400' },
    { type: 'product', icon: ShoppingBag, text: 'Template dashboard', color: 'text-green-400' },
    { type: 'post', icon: Users, text: 'Discussion IA', color: 'text-blue-400' },
    { type: 'news', icon: Newspaper, text: 'OpenAI nouvelle version', color: 'text-yellow-400' }
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Sauvegarder dans l'historique
      setRecentSearches(prev => {
        const newSearches = [searchQuery, ...prev.filter(s => s !== searchQuery)].slice(0, 5);
        return newSearches;
      });
      
      // Naviguer vers la page de recherche
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      
      // Fermer la suggestion
      setIsFocused(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    handleSearch({ preventDefault: () => {} });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsFocused(true);
  };

  const removeRecentSearch = (search, e) => {
    e.stopPropagation();
    setRecentSearches(prev => prev.filter(s => s !== search));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 mb-16">
      <Card className="p-2 bg-card/60 border border-border/30 relative">
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center">
            {/* Icône de recherche */}
            <Search className={`w-5 h-5 ml-3 flex-shrink-0 transition-colors duration-200 ${
              isFocused ? 'text-[#ff6b35]' : 'text-muted-foreground'
            }`} />
            
            {/* Input de recherche */}
            <input
              type="text"
              placeholder="Rechercher des cours, projets, templates, produits, publications ou utilisateurs…"
              className="flex-1 py-4 px-3 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            />
            
            {/* Bouton d'effacement */}
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="mr-2 p-1 hover:bg-card/80 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            
            {/* Bouton de recherche */}
            <Button 
              type="submit" 
              className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-bold px-6 py-3 rounded-xl ml-2"
              disabled={!searchQuery.trim()}
            >
              Rechercher
            </Button>
          </div>
        </form>

        {/* Panneau de suggestions (dropdown) */}
        {isFocused && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50">
            <Card className="p-4 bg-card border border-border/50 shadow-xl">
              
              {/* Recherches récentes */}
              {recentSearches.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground">RECHERCHES RÉCENTES</span>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between group hover:bg-card/80 p-2 rounded-lg cursor-pointer"
                        onClick={() => handleSuggestionClick(search)}
                      >
                        <span className="text-sm text-foreground">{search}</span>
                        <button
                          onClick={(e) => removeRecentSearch(search, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-muted-foreground hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions populaires */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground">TENDANCES</span>
                </div>
                <div className="space-y-1">
                  {popularSuggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 hover:bg-card/80 p-2 rounded-lg cursor-pointer"
                        onClick={() => handleSuggestionClick(suggestion.text)}
                      >
                        <Icon className={`w-4 h-4 ${suggestion.color}`} />
                        <span className="text-sm text-foreground flex-1">{suggestion.text}</span>
                        <span className="text-xs text-muted-foreground capitalize">{suggestion.type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Catégories rapides */}
              <div className="mt-4 pt-4 border-t border-border/30">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { icon: BookOpen, label: 'Cours', color: 'text-orange-400', path: '/courses' },
                    { icon: Code2, label: 'Projets', color: 'text-purple-400', path: '/vibe/projects' },
                    { icon: ShoppingBag, label: 'Marketplace', color: 'text-green-400', path: '/smartix-store' },
                    { icon: Users, label: 'Communauté', color: 'text-blue-400', path: '/feed' },
                    { icon: Newspaper, label: 'Actualités', color: 'text-yellow-400', path: '/news' }
                  ].map((cat, index) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => navigate(cat.path)}
                        className="flex flex-col items-center p-2 hover:bg-card/80 rounded-lg transition-colors"
                      >
                        <Icon className={`w-5 h-5 ${cat.color} mb-1`} />
                        <span className="text-xs text-muted-foreground">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </Card>
          </div>
        )}
      </Card>
    </div>
  );
};

GlobalSearch.propTypes = {};

export default GlobalSearch;
