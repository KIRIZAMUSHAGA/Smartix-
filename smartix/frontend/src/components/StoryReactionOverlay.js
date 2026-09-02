import React, { useState, useEffect, useRef } from 'react';
import ReactionContextMenu from './ReactionContextMenu';
import './StoryReactionOverlay.css';
import PropTypes from 'prop-types';

/**
 * Overlay de réactions pour story viewer
 * Affiche un flux vertical montant de réactions/commentaires
 * Max 5 éléments visibles, durée de vie 3-7s
 * Avec support context menu et performance monitoring
 */
const StoryReactionOverlay = ({ 
  storyId, 
  reactions = [], 
  onCommentTap,
  onLongPress,
  onReply,
  onPin,
  shouldDisable = false,
  fps = 60,
  enabled = true 
}) => {
  const [remoteReactions, setRemoteReactions] = useState([]);
  const [myReaction, setMyReaction] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedReaction, setSelectedReaction] = useState(null);

  useEffect(() => {
    setRemoteReactions(reactions);
    setMyReaction(null); // Reset local reaction on story change
  }, [storyId, reactions]);

  // Fusionner les réactions pour l'affichage
  const mergedReactions = [...remoteReactions, myReaction].filter(Boolean);
  
  // Doubler la liste pour l'effet de boucle infinie (si assez de réactions)
  const displayReactions = mergedReactions.length > 3 
    ? [...mergedReactions, ...mergedReactions] 
    : mergedReactions;

  if (shouldDisable || !enabled) return null;

  return (
    <>
      <div className="story-reaction-overlay">
        {displayReactions.length === 0 ? (
          <div className="reaction-item reaction-empty-state">
            <div className="empty-message-content">
              <span className="empty-message-text">✨ Aucune interaction pour l'instant</span>
            </div>
          </div>
        ) : (
          <div className="reaction-queue-container" style={{ 
            animationDuration: `${Math.max(5, displayReactions.length * 1.5)}s` 
          }}>
            {displayReactions.map((reaction, idx) => (
              <ReactionItem
                key={`${reaction.id || 'local'}-${idx}`}
                reaction={reaction}
                index={idx}
                onTap={() => onCommentTap?.(reaction)}
                onLongPress={(element) => {
                  if (!element || typeof element.getBoundingClientRect !== 'function') return;
                  try {
                    const rect = element.getBoundingClientRect();
                    setSelectedReaction(reaction);
                    setContextMenu({
                      x: rect.left,
                      y: rect.top - 10
                    });
                  } catch (err) {
                    console.error('Error getting bounding rect:', err);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu - Long press */}
      <ReactionContextMenu
        reaction={selectedReaction}
        position={contextMenu}
        isOwnComment={selectedReaction?.user_id === (JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.id)}
        onReply={() => onReply?.(selectedReaction)}
        onPin={() => onPin?.(selectedReaction)}
        onClose={() => {
          setContextMenu(null);
          setSelectedReaction(null);
        }}
      />
    </>
  );
};

const ReactionItem = ({ reaction, index, onTap, onLongPress }) => {
  const [touchStart, setTouchStart] = useState(null);
  const longPressTimeout = React.useRef(null);
  const elementRef = React.useRef(null);  // 🔥 REF pour garder l'élément

  useEffect(() => {
    return () => {
      if (longPressTimeout.current) {
        clearTimeout(longPressTimeout.current);
      }
    };
  }, []);

  const handleTouchStart = (e) => {
    setTouchStart(Date.now());
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    longPressTimeout.current = setTimeout(() => {
      // 🔥 Passer la ref de l'élément, pas l'événement stale
      onLongPress(elementRef.current);
    }, 400);
  };

  const handleTouchEnd = () => {
    const duration = Date.now() - touchStart;
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
    
    if (duration < 300) {
      onTap();
    }
  };

  const getReactionContent = () => {
    const renderAvatar = () => {
      const avatarUrl = reaction.user?.avatar || reaction.avatar;
      if (avatarUrl) {
        return <img src={avatarUrl} alt="" className="reaction-avatar" />;
      }
      // Fallback: Afficher les initiales si pas d'avatar
      const initials = (reaction.username || reaction.user?.full_name || 'U')[0]?.toUpperCase() || '?';
      return (
        <div className="reaction-avatar fallback-avatar">
          <span>{initials}</span>
        </div>
      );
    };

    switch (reaction.type) {
      case 'like':
        // ❤️ ULTRA-COMPACT: Affiche le like minimaliste (nom + emoji)
        return (
          <>
            {renderAvatar()}
            <div className="reaction-text">
              <span className="username">{reaction.username || 'Utilisateur'}</span>
              <p className="content">❤️ a aimé</p>
            </div>
          </>
        );
      case 'comment':
        return (
          <>
            {renderAvatar()}
            <div className="reaction-text">
              <span className="username">{reaction.username || 'Utilisateur'}</span>
              <p className="content">{reaction.content?.substring(0, 30)}</p>
            </div>
          </>
        );
      case 'reply':
        return (
          <>
            {renderAvatar()}
            <div className="reaction-text">
              <span className="username">{reaction.username || 'Utilisateur'}</span>
              <p className="content reply">{reaction.content?.substring(0, 25)}</p>
            </div>
          </>
        );
      case 'aggregated_likes':
        return (
          <div className="reaction-likes">
            <span className="like-label">{reaction.label}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={elementRef}
      className={`reaction-item reaction-${reaction.type}${reaction.type === 'like' ? ' reaction-like' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {getReactionContent()}
    </div>
  );
};

StoryReactionOverlay.propTypes = {
  storyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  reactions: PropTypes.array,
  onCommentTap: PropTypes.func.isRequired,
  onLongPress: PropTypes.func.isRequired,
  onReply: PropTypes.func.isRequired,
  onPin: PropTypes.func.isRequired,
  shouldDisable: PropTypes.bool,
  fps: PropTypes.any,
  enabled: PropTypes.bool,
};

export default StoryReactionOverlay;
ReactionItem.propTypes = {
  reaction: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onTap: PropTypes.func.isRequired,
  onLongPress: PropTypes.func.isRequired,
};
