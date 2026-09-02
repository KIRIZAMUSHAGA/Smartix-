import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Heart } from 'lucide-react';

const LikesReactions = ({ postId, initialLikes = 0, onLike, onReaction }) => {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState({});
  const reactionRef = useRef(null);
  const longPressRef = useRef(null);

  const reactionsList = [
    { emoji: '❤️', name: 'Love', label: 'Love' },
    { emoji: '😂', name: 'Haha', label: 'Haha' },
    { emoji: '😮', name: 'Wow', label: 'Wow' },
    { emoji: '😠', name: 'Angry', label: 'Angry' },
    { emoji: '😢', name: 'Sad', label: 'Sad' },
    { emoji: '👍', name: 'Like', label: 'Like' },
  ];

  const handleLikeClick = () => {
    if (isLiked) {
      setLikes(Math.max(0, likes - 1));
      setIsLiked(false);
    } else {
      setLikes(likes + 1);
      setIsLiked(true);
      setReactions({ ...reactions, '👍': (reactions['👍'] || 0) + 1 });
    }
    onLike?.();
  };

  const handleReactionSelect = (emoji, name) => {
    setReactions({
      ...reactions,
      [emoji]: (reactions[emoji] || 0) + 1
    });
    setShowReactions(false);
    onReaction?.(emoji, name);

    // Animation du clic
    const span = document.createElement('span');
    span.textContent = emoji;
    span.className = 'fixed text-3xl pointer-events-none animate-bounce';
    span.style.left = reactionRef.current?.clientX + 'px';
    span.style.top = reactionRef.current?.clientY + 'px';
    span.style.animation = 'float-up 1s ease-out forwards';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 1000);
  };

  const handleMouseDown = () => {
    longPressRef.current = setTimeout(() => {
      setShowReactions(true);
    }, 500);
  };

  const handleMouseUp = () => {
    clearTimeout(longPressRef.current);
  };

  const getReactionSummary = () => {
    const entries = Object.entries(reactions).filter(([, count]) => count > 0);
    if (entries.length === 0) return `${likes} J'aime`;
    return entries.map(([emoji, count]) => `${emoji} ${count}`).join(' ');
  };

  return (
    <div className="space-y-3">
      {/* Affichage du nombre de likes et réactions */}
      {(likes > 0 || Object.values(reactions).some(v => v > 0)) && (
        <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {getReactionSummary()}
          </span>
        </div>
      )}

      {/* Boutons d'interaction */}
      <div className="px-4 py-3 flex gap-2 relative">
        {/* Bouton Like avec animation Instagram */}
        <div
          ref={reactionRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex-1 relative group"
        >
          <button
            onClick={handleLikeClick}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition-all transform hover:scale-110 active:scale-95 ${
              isLiked
                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/50'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Heart
              className={`w-5 h-5 transition-all ${isLiked ? 'fill-current' : ''}`}
            />
            <span className="text-sm">{likes > 0 ? `${likes}` : 'J\'aime'}</span>
          </button>

          {/* Popup de réactions au long press */}
          {showReactions && (
            <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-2 shadow-xl z-50 flex gap-1 animate-scale-in">
              {reactionsList.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReactionSelect(reaction.emoji, reaction.name)}
                  className="text-2xl hover:scale-150 transition-transform duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full p-2"
                  title={reaction.label}
                >
                  {reaction.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bouton Commentaires */}
        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-all hover:scale-105 active:scale-95">
          <span>💬</span>
          <span className="text-sm">Commenter</span>
        </button>

        {/* Bouton Partager */}
        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-all hover:scale-105 active:scale-95">
          <span>🔗</span>
          <span className="text-sm">Partager</span>
        </button>
      </div>

      {/* Affichage des réactions détaillées */}
      {Object.entries(reactions).length > 0 && (
        <div className="px-4 py-2 flex gap-2 flex-wrap border-t border-gray-200 dark:border-gray-700">
          {Object.entries(reactions)
            .filter(([, count]) => count > 0)
            .map(([emoji, count]) => (
              <div
                key={emoji}
                className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1"
              >
                <span className="text-lg">{emoji}</span>
                <span>{count}</span>
              </div>
            ))}
        </div>
      )}

      <style>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(1.5);
          }
        }
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

LikesReactions.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  initialLikes: PropTypes.number,
  onLike: PropTypes.func,
  onReaction: PropTypes.func
};

export default LikesReactions;
