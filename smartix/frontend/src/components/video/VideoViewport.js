// frontend/src/components/video/VideoViewport.js
// Phase 3 : viewport unique avec UI synchronisée (buffering, progression, mute, fin).

import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useVideoEngine } from '../../hooks/useVideoEngine';
import { FEATURES } from '../../config/features';

const VideoViewport = ({
  activeSlotRef,
  activeClip,
  onVideoReady,
  onVideoEnd,
  defaultMuted = true,
  muted: controlledMuted,
  loop = false,
  showMuteButton = true,
  showProgressBar = true,
  showBufferingOverlay = true
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [internalMuted, setInternalMuted] = useState(defaultMuted);
  const isMuted = typeof controlledMuted === 'boolean' ? controlledMuted : internalMuted;
  const transitionTimerRef = useRef(null);

  const {
    attach,
    detach,
    setMuted,
    on,
    isBuffering,
    progress
  } = useVideoEngine();

  // Attacher la vidéo au slot actif courant (avec crossfade)
  useEffect(() => {
    if (!FEATURES.USE_SINGLE_PLAYER) return;
    const containerEl = activeSlotRef?.current;
    if (!containerEl || !activeClip?.video_url) return;

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    setIsTransitioning(true);

    // Snapshot du muted courant pour éviter le re-attach lors d'un toggle mute
    const initialMuted = isMuted;

    transitionTimerRef.current = setTimeout(() => {
      attach(containerEl, activeClip.video_url, {
        autoplay: true,
        muted: initialMuted,
        loop
      });
      if (typeof onVideoReady === 'function') onVideoReady(activeClip);
      setIsTransitioning(false);
    }, 50);

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [activeSlotRef, activeClip, attach, loop, onVideoReady]);

  // Détecter la fin de la vidéo
  useEffect(() => {
    if (!FEATURES.USE_SINGLE_PLAYER) return;
    const handleEnded = () => {
      if (typeof onVideoEnd === 'function') onVideoEnd();
    };
    const off = on('ended', handleEnded);
    return () => {
      if (typeof off === 'function') off();
    };
  }, [on, onVideoEnd]);

  // Détacher au démontage
  useEffect(() => {
    return () => {
      if (FEATURES.USE_SINGLE_PLAYER) detach();
    };
  }, [detach]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setInternalMuted(next);
    setMuted(next);
  };

  // Si la prop "muted" est contrôlée par le parent, suivre ses changements
  useEffect(() => {
    if (typeof controlledMuted === 'boolean') {
      setMuted(controlledMuted);
    }
  }, [controlledMuted, setMuted]);

  return (
    <div
      className="video-viewport"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        pointerEvents: 'none',
        opacity: isTransitioning ? 0.4 : 1,
        transition: 'opacity 0.2s ease'
      }}
    >
      {/* L'élément <video> est inséré dans le slot actif par VideoEngine */}

      {showBufferingOverlay && isBuffering && (
        <div className="video-buffering-overlay" style={{ pointerEvents: 'none' }}>
          <div className="spinner-large" />
          <span>Chargement...</span>
        </div>
      )}

      {showProgressBar && (
        <div className="video-progress-bar" style={{ pointerEvents: 'none' }}>
          <div
            className="video-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {showMuteButton && (
        <button
          type="button"
          className="video-mute-btn"
          onClick={handleToggleMute}
          aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
          style={{ pointerEvents: 'auto' }}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}
    </div>
  );
};

VideoViewport.propTypes = {
  activeSlotRef: PropTypes.object,
  activeClip: PropTypes.object,
  onVideoReady: PropTypes.func,
  onVideoEnd: PropTypes.func,
  defaultMuted: PropTypes.bool,
  muted: PropTypes.bool,
  loop: PropTypes.bool,
  showMuteButton: PropTypes.bool,
  showProgressBar: PropTypes.bool,
  showBufferingOverlay: PropTypes.bool
};

export default VideoViewport;
