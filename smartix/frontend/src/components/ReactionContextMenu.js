import React, { useState } from 'react';
import './ReactionContextMenu.css';
import PropTypes from 'prop-types';

const ReactionContextMenu = ({ 
  reaction, 
  position,
  isOwnComment = false,
  onReply,
  onPin,
  onClose 
}) => {
  const [isPinning, setIsPinning] = useState(false);

  if (!reaction || !position) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="fixed z-[101] bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 min-w-[180px] animate-in fade-in zoom-in duration-200"
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`
        }}
      >
        <button
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white/90 hover:text-[#ff6b35] transition-all rounded-xl font-black text-xs uppercase tracking-widest"
          onClick={() => { onReply?.(reaction); onClose(); }}
        >
          <span className="text-lg">↩️</span> Répondre
        </button>

        {isOwnComment && (
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white/90 hover:text-[#ff6b35] transition-all rounded-xl font-black text-xs uppercase tracking-widest"
            onClick={() => { onPin?.(reaction); onClose(); }}
          >
            <span className="text-lg">📌</span> Épingler
          </button>
        )}

        <button
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white/90 hover:text-[#ff6b35] transition-all rounded-xl font-black text-xs uppercase tracking-widest"
          onClick={() => { navigator.clipboard.writeText(reaction.content); onClose(); }}
        >
          <span className="text-lg">📋</span> Copier
        </button>

        <div className="h-px bg-white/5 my-2 mx-2" />

        <button
          className="w-full px-4 py-3 text-white/30 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] text-center"
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
    </>
  );
};

ReactionContextMenu.propTypes = {
  reaction: PropTypes.object.isRequired,
  position: PropTypes.number.isRequired,
  isOwnComment: PropTypes.bool,
  onReply: PropTypes.func.isRequired,
  onPin: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ReactionContextMenu;