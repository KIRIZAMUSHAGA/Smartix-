import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, Grid3x3 } from 'lucide-react';
import PropTypes from 'prop-types';

const BATCH_SIZE = 15;

const StickerLibraryOptimized = ({ onStickerSelect, onClose, recentStickers = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState('accessoires');
  const [searchQuery, setSearchQuery] = useState('');
  const [stickersData, setStickersData] = useState(null);
  const [visibleIndices, setVisibleIndices] = useState({ start: 0, end: BATCH_SIZE });
  const scrollRef = useRef(null);

  // Load manifest once
  useEffect(() => {
    const controller = new AbortController();
    
    fetch('/stickers/manifest.json', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setStickersData(data);
        // Preload first category in background
        const firstCat = data.categories[0];
        firstCat.stickers.slice(0, 5).forEach(s => {
          fetch(`/stickers/${firstCat.id}/${s.id}.svg`, { signal: controller.signal }).catch(() => {});
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const currentCategory = useMemo(() => {
    if (!stickersData) return { stickers: [] };
    return stickersData.categories.find(c => c.id === selectedCategory) || { stickers: [] };
  }, [stickersData, selectedCategory]);

  const filteredStickers = useMemo(() => {
    if (!searchQuery) return currentCategory.stickers;
    const q = searchQuery.toLowerCase();
    return currentCategory.stickers.filter(s =>
      s.title.toLowerCase().includes(q) || s.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [currentCategory, searchQuery]);

  const visibleStickers = useMemo(() => {
    return filteredStickers.slice(visibleIndices.start, visibleIndices.end);
  }, [filteredStickers, visibleIndices]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollPercentage = container.scrollTop / (container.scrollHeight - container.clientHeight);
    const totalStickers = filteredStickers.length;
    const newStart = Math.max(0, Math.floor(scrollPercentage * totalStickers - 10));
    const newEnd = Math.min(totalStickers, newStart + BATCH_SIZE + 20);
    setVisibleIndices({ start: newStart, end: newEnd });
  }, [filteredStickers.length]);

  // Preload visible stickers
  useEffect(() => {
    visibleStickers.forEach(sticker => {
      const img = new Image();
      img.loading = 'lazy';
      img.src = `/stickers/${selectedCategory}/${sticker.id}.svg`;
    });
  }, [visibleStickers, selectedCategory]);

  if (!stickersData) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto mb-2"></div>
          <p className="text-white text-xs">Chargement rapide...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-white/20">
        
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Stickers</h2>
            <span className="text-xs text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded">{stickersData.total}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 flex gap-3 p-4 overflow-hidden">
          <div className="w-32 flex flex-col gap-1 overflow-y-auto pb-2">
            {stickersData.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setVisibleIndices({ start: 0, end: BATCH_SIZE });
                }}
                className={`px-3 py-2 rounded text-xs font-medium transition ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                }`}
              >
                {cat.icon} {cat.title}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col gap-2 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleIndices({ start: 0, end: BATCH_SIZE });
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/50 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-4 md:grid-cols-5 gap-1.5">
                {visibleStickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => onStickerSelect(sticker)}
                    className="group aspect-square bg-white/5 rounded border border-white/10 hover:border-cyan-400 overflow-hidden transition"
                    title={sticker.title}
                  >
                    <img
                      src={`/stickers/${selectedCategory}/${sticker.id}.svg`}
                      alt={sticker.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

StickerLibraryOptimized.propTypes = {
  onStickerSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  recentStickers: PropTypes.any,
};

export default StickerLibraryOptimized;
