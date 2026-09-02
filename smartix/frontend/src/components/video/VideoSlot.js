// frontend/src/components/video/VideoSlot.js
// Placeholder DOM par clip. Ne contient PAS de balise <video>.
// L'élément <video> unique géré par VideoEngine y est attaché dynamiquement
// quand le slot devient "actif" (visible à plus de 60% du viewport).

import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useVideoEngine } from '../../hooks/useVideoEngine';
import { FEATURES } from '../../config/features';

const VideoSlot = ({
  clip,
  isActive,
  onBecameActive,
  onBecameInactive,
  slotRef: externalSlotRef,
  hideDefaultInfo = false,
  children
}) => {
  const slotRef = useRef(null);
  const [posterError, setPosterError] = useState(false);
  const { preload } = useVideoEngine();

  // Forward du ref vers le parent (via callback ref)
  useEffect(() => {
    if (typeof externalSlotRef === 'function') {
      externalSlotRef(slotRef.current);
      return () => externalSlotRef(null);
    }
  }, [externalSlotRef]);

  // Observer "actif" : 60% visible
  useEffect(() => {
    if (!FEATURES.USE_SINGLE_PLAYER) return;
    const node = slotRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            onBecameActive?.(clip, slotRef.current);
          } else if (!entry.isIntersecting) {
            onBecameInactive?.(clip);
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [clip, onBecameActive, onBecameInactive]);

  // Observer "préchargement" : 30% visible
  useEffect(() => {
    if (!FEATURES.USE_SINGLE_PLAYER) return;
    const node = slotRef.current;
    if (!node || !clip?.video_url) return;

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            preload(clip.video_url);
          }
        });
      },
      { threshold: 0.3 }
    );

    preloadObserver.observe(node);
    return () => preloadObserver.disconnect();
  }, [clip, preload]);

  return (
    <div
      ref={slotRef}
      className="video-slot"
      data-clip-id={clip?.id}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        position: 'relative',
        scrollSnapAlign: 'start'
      }}
    >
      {!posterError && clip?.thumbnail_url && (
        <img
          src={clip.thumbnail_url}
          alt={clip?.title || 'Aperçu vidéo'}
          className="video-poster"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1
          }}
          onError={() => setPosterError(true)}
        />
      )}

      {isActive && (
        <div className="video-loading-indicator" style={{ zIndex: 2 }}>
          <div className="spinner" />
        </div>
      )}

      {!hideDefaultInfo && (
        <div
          className="video-info"
          style={{
            zIndex: 3,
            position: 'absolute',
            bottom: 24,
            left: 16,
            right: 16,
            color: 'white'
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{clip?.title}</h3>
          <p style={{ margin: '4px 0 8px', fontSize: 14, opacity: 0.85 }}>
            @{clip?.user?.username || clip?.author?.username || 'inconnu'}
          </p>
          <div className="video-stats">
            <span>❤️ {clip?.likes_count || 0}</span>
            <span>👁️ {clip?.views_count || 0}</span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
};

VideoSlot.propTypes = {
  clip: PropTypes.object.isRequired,
  isActive: PropTypes.bool,
  onBecameActive: PropTypes.func,
  onBecameInactive: PropTypes.func,
  slotRef: PropTypes.func,
  hideDefaultInfo: PropTypes.bool,
  children: PropTypes.node
};

export default VideoSlot;
