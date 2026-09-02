import React, { useState } from 'react';
import PropTypes from 'prop-types';

function ClipOptionsMenu({ clip, onDelete, onShare, onReport }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 text-white">⋮</button>
      {open && (
        <div className="absolute right-0 bg-white rounded shadow-lg py-1 z-10 min-w-32">
          {onShare && (
            <button onClick={() => { onShare(clip); setOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
              Partager
            </button>
          )}
          {onReport && (
            <button onClick={() => { onReport(clip); setOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
              Signaler
            </button>
          )}
          {onDelete && (
            <button onClick={() => { onDelete(clip); setOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100">
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

ClipOptionsMenu.propTypes = {
  clip: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  onDelete: PropTypes.func,
  onShare: PropTypes.func,
  onReport: PropTypes.func
};

export default ClipOptionsMenu;
