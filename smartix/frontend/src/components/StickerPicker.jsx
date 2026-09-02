import React, { useState } from 'react';
import PropTypes from 'prop-types';

const DEFAULT_STICKERS = ['😀','😂','❤️','🎉','🔥','✨','👍','🙏','😍','🤔','😭','🎊','💯','🚀','⭐'];

function StickerPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = DEFAULT_STICKERS.filter(s => s.includes(search));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 w-64">
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-sm">Stickers</span>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher..."
        className="w-full border rounded px-2 py-1 text-sm mb-3"
      />
      <div className="grid grid-cols-5 gap-2">
        {filtered.map((sticker, i) => (
          <button
            key={i}
            onClick={() => onSelect && onSelect(sticker)}
            className="text-2xl hover:scale-125 transition-transform"
          >
            {sticker}
          </button>
        ))}
      </div>
    </div>
  );
}

StickerPicker.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default StickerPicker;
