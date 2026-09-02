import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Grid3x3, Heart, Download } from 'lucide-react';
import PropTypes from 'prop-types';

const StickerLibrary = ({ onStickerSelect, onClose, recentStickers = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState('accessoires');
  const [searchQuery, setSearchQuery] = useState('');
  const [stickersData, setStickersData] = useState(null);
  const [selectedStickers, setSelectedStickers] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());

  // Load manifest
  useEffect(() => {
    fetch('/stickers/manifest.json')
      .then(r => r.json())
      .then(data => setStickersData(data))
      .catch(err => console.error('Error loading stickers:', err));
  }, []);

  // Get current category stickers
  const currentCategory = useMemo(() => {
    if (!stickersData) return { stickers: [] };
    return stickersData.categories.find(c => c.id === selectedCategory) || { stickers: [] };
  }, [stickersData, selectedCategory]);

  // Filter stickers by search
  const filteredStickers = useMemo(() => {
    if (!searchQuery) return currentCategory.stickers;
    const q = searchQuery.toLowerCase();
    return currentCategory.stickers.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [currentCategory, searchQuery]);

  const handleStickerClick = (sticker) => {
    onStickerSelect(sticker);
    setSelectedStickers(new Set([...selectedStickers, sticker.id]));
  };

  const toggleFavorite = (stickerId) => {
    const newFavs = new Set(favorites);
    if (newFavs.has(stickerId)) newFavs.delete(stickerId);
    else newFavs.add(stickerId);
    setFavorites(newFavs);
  };

  if (!stickersData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white">Chargement des stickers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-white/20 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Grid3x3 className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl md:text-2xl font-bold text-white">Stickers Smartix</h2>
            <span className="text-xs md:text-sm text-cyan-400 bg-cyan-500/20 px-3 py-1 rounded-full">{stickersData.total}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden">
          
          {/* Sidebar - Categories */}
          <div className="w-full md:w-48 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0">
            {stickersData.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 md:flex-shrink ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                <span className="hidden md:inline">{cat.title}</span>
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Rechercher des stickers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Quick Access - Recent */}
            {recentStickers.length > 0 && (
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Récemment utilisés</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {recentStickers.slice(0, 6).map(sticker => (
                    <button
                      key={sticker.id}
                      onClick={() => handleStickerClick(sticker)}
                      className="relative flex-shrink-0 w-16 h-16 bg-white/10 rounded-lg border border-white/20 hover:border-cyan-400 overflow-hidden group transition-all"
                      title={sticker.title}
                    >
                      <img 
                        src={`/stickers/${sticker.category}/${sticker.id}.svg`}
                        alt={sticker.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/20 transition-all"></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stickers Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pr-2">
                {filteredStickers.map(sticker => (
                  <div
                    key={sticker.id}
                    className="group relative aspect-square bg-white/5 rounded-lg border border-white/10 hover:border-cyan-400 overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/30"
                  >
                    {/* Sticker Image */}
                    <img
                      src={`/stickers/${selectedCategory}/${sticker.id}.svg`}
                      alt={sticker.title}
                      className="w-full h-full object-cover"
                      onClick={() => handleStickerClick(sticker)}
                    />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <p className="text-white text-xs font-semibold truncate">{sticker.title}</p>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(sticker.id);
                          }}
                          className="flex-1 px-2 py-1 bg-cyan-500/80 hover:bg-cyan-600 text-white text-xs rounded transition-colors"
                        >
                          {favorites.has(sticker.id) ? '❤️' : '🤍'}
                        </button>
                      </div>
                    </div>

                    {/* Selected Badge */}
                    {selectedStickers.has(sticker.id) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {filteredStickers.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-white/60 mb-2">Aucun sticker trouvé</p>
                    <p className="text-white/40 text-sm">Essayez une autre recherche</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-white/10 bg-black/30 flex items-center justify-between">
          <p className="text-white/60 text-sm">
            {filteredStickers.length} sticker{filteredStickers.length > 1 ? 's' : ''} disponible{filteredStickers.length > 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

StickerLibrary.propTypes = {
  onStickerSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  recentStickers: PropTypes.any,
};

export default StickerLibrary;
