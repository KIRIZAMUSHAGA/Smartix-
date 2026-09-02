import React, { useState, useEffect, useRef } from 'react';
import { useTouchGestures } from '../hooks/useTouchGestures';
import PropTypes from 'prop-types';

/**
 * Composant pour gérer les réactions (like + super-like) sur les publications
 * Adapte les animations par type: photos (direct), vidéos (overlay), textes (semi-transparent)
 * Double-tap = Like classique (+1)
 * Long-press = Super-like (+1, une seule réaction)
 */
const PublicationReactionOverlay = ({ 
  publicationId, 
  publicationType = 'photo', // 'photo', 'video', 'text'
  onLike,
  onSuperLike,
  likeCount,
  isDisabled = false,
  animationType = 'like' // 'like' or 'super-like'
}) => {
  const [reactions, setReactions] = useState([]);
  const containerRef = useRef(null);
  const likeTimeoutRef = useRef(null);

  // Générer des particules pour l'animation
  const generateParticles = (x, y, count = 20) => {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const velocity = 2 + Math.random() * 3;
      particles.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 1
      });
    }
    return particles;
  };

  // Animation double-tap (Like classique)
  const handleDoubleTap = (coords) => {
    if (isDisabled) return;
    
    const heart = {
      id: Math.random(),
      x: coords.x,
      y: coords.y,
      type: 'like',
      startTime: Date.now()
    };
    
    setReactions(prev => [...prev, heart]);
    
    // Vibration courte
    if (navigator.vibrate) navigator.vibrate(10);
    
    // Particules légères
    const particles = generateParticles(coords.x, coords.y, 12);
    particles.forEach(p => {
      const particle = {
        ...p,
        id: Math.random(),
        type: 'particle-like',
        startTime: Date.now()
      };
      setReactions(prev => [...prev, particle]);
    });
    
    // Callback
    onLike?.();
    
    // Nettoyer après animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== heart.id));
    }, 800);
  };

  // Animation long-press (Super Like)
  const handleLongPress = (coords) => {
    if (isDisabled) return;
    
    const superLike = {
      id: Math.random(),
      x: coords.x,
      y: coords.y,
      type: 'super-like',
      startTime: Date.now()
    };
    
    setReactions(prev => [...prev, superLike]);
    
    // Vibration longue (20ms)
    if (navigator.vibrate) navigator.vibrate(20);
    
    // Particules éclatées (20-40)
    const particleCount = 20 + Math.floor(Math.random() * 20);
    const particles = generateParticles(coords.x, coords.y, particleCount);
    particles.forEach(p => {
      const particle = {
        ...p,
        id: Math.random(),
        type: 'particle-super',
        startTime: Date.now()
      };
      setReactions(prev => [...prev, particle]);
    });
    
    // Callback
    onSuperLike?.();
    
    // Nettoyer après animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== superLike.id));
    }, 1200);
  };

  // Hook de gestes tactiles
  const touchHandlers = useTouchGestures({
    onDoubleTap: handleDoubleTap,
    onLongPress: handleLongPress,
    doubleTapThreshold: 350,
    longPressMinTime: 350,
    longPressMaxTime: 500
  });

  return (
    <>
      {/* Animations Layer - Overlay uniquement, pas de wrapper */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {reactions.map(reaction => {
          if (reaction.type === 'like') {
            const elapsed = Date.now() - reaction.startTime;
            const progress = Math.min(elapsed / 800, 1);
            const scale = 0 + progress * 1.6;
            const opacity = Math.max(0, 1 - progress * 1.5);
            
            // Adapter l'opacité par type de publication
            const typeOpacity = publicationType === 'text' ? opacity * 0.45 : opacity; // Semi-transparent pour texte

            return (
              <div
                key={reaction.id}
                className="absolute text-4xl font-bold"
                style={{
                  left: `${reaction.x}px`,
                  top: `${reaction.y}px`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  opacity: typeOpacity,
                  animation: 'float-up 0.8s ease-out forwards',
                  filter: publicationType === 'video' ? 'drop-shadow(0 0 8px rgba(0,0,0,0.6))' : 'none'
                }}
              >
                ❤️
              </div>
            );
          }

          if (reaction.type === 'super-like') {
            const elapsed = Date.now() - reaction.startTime;
            const progress = Math.min(elapsed / 1200, 1);
            const scale = 0 + progress * 2;
            const baseOpacity = Math.max(0, 1 - progress * 1.2);
            const haloOpacity = Math.max(0, 1 - progress * 2);
            
            // Adapter opacité par type de publication
            const typeOpacity = publicationType === 'text' ? baseOpacity * 0.45 : baseOpacity;
            const typeHaloOpacity = publicationType === 'text' ? haloOpacity * 0.45 : haloOpacity;

            return (
              <div key={reaction.id}>
                {/* Halo lumineux - adapté par type */}
                <div
                  className="absolute rounded-full"
                  style={{
                    left: `${reaction.x}px`,
                    top: `${reaction.y}px`,
                    width: '80px',
                    height: '80px',
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle, rgba(255,107,107,0.8) 0%, rgba(255,107,107,0) 100%)',
                    opacity: typeHaloOpacity,
                    animation: 'halo-spread 0.5s ease-out forwards'
                  }}
                />

                {/* Super Like cœur - adapté par type */}
                <div
                  className="absolute text-5xl font-bold"
                  style={{
                    left: `${reaction.x}px`,
                    top: `${reaction.y}px`,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    opacity: typeOpacity,
                    filter: publicationType === 'video' 
                      ? 'drop-shadow(0 0 15px rgba(255,107,107,0.9)) drop-shadow(0 0 25px rgba(255,107,107,0.6))'
                      : 'drop-shadow(0 0 10px rgba(255,107,107,0.8))',
                    animation: 'super-like-pop 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
                  }}
                >
                  ❤️
                </div>
              </div>
            );
          }

          if (reaction.type === 'particle-like') {
            const elapsed = Date.now() - reaction.startTime;
            const progress = Math.min(elapsed / 800, 1);
            const x = reaction.x + reaction.vx * 30 * progress;
            const y = reaction.y + reaction.vy * 30 * progress;
            const opacity = Math.max(0, 1 - progress);

            return (
              <div
                key={reaction.id}
                className="absolute w-1 h-1 rounded-full bg-red-400"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  opacity,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            );
          }

          if (reaction.type === 'particle-super') {
            const elapsed = Date.now() - reaction.startTime;
            const progress = Math.min(elapsed / 1200, 1);
            const x = reaction.x + reaction.vx * 50 * progress;
            const y = reaction.y + reaction.vy * 50 * progress;
            const opacity = Math.max(0, 1 - progress);

            return (
              <div
                key={reaction.id}
                className="absolute w-2 h-2 rounded-full bg-red-500"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  opacity,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: 'drop-shadow(0 0 4px rgba(255,107,107,0.8))'
                }}
              />
            );
          }

          return null;
        })}
      </div>

      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(0); opacity: 1; }
          100% { transform: translateY(-80px) scale(1.6); opacity: 0; }
        }
        @keyframes super-like-pop {
          0% { transform: translate(-50%, -50%) scale(0); }
          50% { transform: translate(-50%, -50%) scale(2.2); }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
        @keyframes halo-spread {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>
    </>
  );
};

PublicationReactionOverlay.propTypes = {
  publicationId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  publicationType: PropTypes.any,
  photo: PropTypes.any.isRequired,
  video: PropTypes.object.isRequired,
  text: PropTypes.string.isRequired,
  onLike: PropTypes.func.isRequired,
  onSuperLike: PropTypes.func.isRequired,
  likeCount: PropTypes.any.isRequired,
  isDisabled: PropTypes.bool,
  animationType: PropTypes.any,
};

export default PublicationReactionOverlay;
