/**
 * 🎨 LAZY LOADED STICKER LIBRARY
 * Code-split and virtualized for performance
 * Only renders visible stickers + preloads nearby items
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, X, Grid3x3 } from 'lucide-react';
import { stickerCache } from '../utils/stickerCache';
import PropTypes from 'prop-types';

const STICKERS_PER_PAGE = 20;
const THUMBNAIL_SIZE = 64;

const StickerLibraryLazy = ({ onStickerSelect, onClose, recentStickers = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState('accessoires');
  const [searchQuery, setSearchQuery] = useState('');
  const [stickersData, setStickersData] = useState(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: STICKERS_PER_PAGE });
  const scrollContainerRef = useRef(null);

  // Load manifest once
  useEffect(() => {
    fetch('/stickers/manifest.json')
      .then(r => r.json())
      .then(data => {
        setStickersData(data);
        // Preload first category in background
        const firstCat = data.categories[0];
        stickerCache.preloadCategory(firstCat.id, firstCat.stickers);
      })
      .catch(err => console.error('Error loading stickers:', err));
  }, []);

  // Preload category when changed
  useEffect(() => {
    if (stickersData) {
      const category = stickersData.categories.find(c => c.id === selectedCategory);
      if (category) {
        stickerCache.preloadCategory(selectedCategory, category.stickers);
      }
    }
  }, [selectedCategory, stickersData]);

  // Get current category
  const currentCategory = useMemo(() => {
    if (!stickersData) return { stickers: [] };
    return stickersData.categories.find(c => c.id === selectedCategory) || { stickers: [] };
  }, [stickersData, selectedCategory]);

  // Filter stickers
  const filteredStickers = useMemo(() => {
    if (!searchQuery) return currentCategory.stickers;
    const q = searchQuery.toLowerCase();
    return currentCategory.stickers.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [currentCategory, searchQuery]);

  // Handle scroll for virtualization
  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollPercentage = container.scrollTop / (container.scrollHeight - container.clientHeight);
    const totalStickers = filteredStickers.length;
    const newStart = Math.floor((scrollPercentage * totalStickers) - 10);
    const newEnd = newStart + STICKERS_PER_PAGE + 20;

    setVisibleRange({
      start: Math.max(0, newStart),
      end: Math.min(totalStickers, newEnd)
    });
  }, [filteredStickers.length]);

  // Get visible stickers only
  const visibleStickers = useMemo(() => {
    return filteredStickers.slice(visibleRange.start, visibleRange.end);
  }, [filteredStickers, visibleRange]);

  if (!stickersData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-white">Chargement...</p>
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
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden">
          
          {/* Categories */}
          <div className="w-full md:w-48 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-2">
            {stickersData.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setVisibleRange({ start: 0, end: STICKERS_PER_PAGE });
                }}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                }`}
              >
                {cat.icon}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleRange({ start: 0, end: STICKERS_PER_PAGE });
                }}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Virtualized Grid */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto pr-2"
            >
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {visibleStickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => onStickerSelect(sticker)}
                    className="group relative aspect-square bg-white/5 rounded-lg border border-white/10 hover:border-cyan-400 overflow-hidden transition-all hover:shadow-lg"
                    title={sticker.title}
                  >
                    <img
                      src={`/stickers/${selectedCategory}/${sticker.id}.svg`}
                      alt={sticker.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                      <p className="text-white text-xs truncate">{sticker.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/30 flex justify-between">
          <p className="text-white/60 text-sm">{filteredStickers.length} stickers</p>
          <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">Fermer</button>
        </div>
      </div>
    </div>
  );
};

StickerLibraryLazy.propTypes = {
  onStickerSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  recentStickers: PropTypes.any,
};

export default StickerLibraryLazy;
