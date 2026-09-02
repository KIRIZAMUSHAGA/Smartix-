// frontend/src/hooks/useVideoEngine.js
// Hook React pour interagir avec le singleton VideoEngine.
// Phase 3 : expose isBuffering, currentTime, duration, progress.

import { useEffect, useCallback, useRef, useState } from 'react';
import { videoEngine } from '../lib/video/VideoEngine';

export const useVideoEngine = () => {
  const attachedRef = useRef(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!videoEngine.video) {
      videoEngine.init();
    }
  }, []);

  // Synchroniser les états du moteur avec le composant
  useEffect(() => {
    const handleBuffering = (data) => {
      setIsBuffering(!!data?.isBuffering);
    };

    const handleTimeUpdate = () => {
      const v = videoEngine.video;
      if (!v) return;
      setCurrentTime(v.currentTime || 0);
      const d = v.duration;
      setDuration(Number.isFinite(d) ? d : 0);
    };

    const handleLoadedMetadata = () => {
      const v = videoEngine.video;
      if (!v) return;
      const d = v.duration;
      setDuration(Number.isFinite(d) ? d : 0);
    };

    const offBuf = videoEngine.on('buffering', handleBuffering);
    const offTime = videoEngine.on('timeupdate', handleTimeUpdate);
    const offMeta = videoEngine.on('loadedmetadata', handleLoadedMetadata);

    return () => {
      if (typeof offBuf === 'function') offBuf();
      if (typeof offTime === 'function') offTime();
      if (typeof offMeta === 'function') offMeta();
    };
  }, []);

  const attach = useCallback((containerEl, src, options = {}) => {
    if (!containerEl || !src) return;
    videoEngine.attach(containerEl, src, options);
    attachedRef.current = true;
  }, []);

  const detach = useCallback(() => {
    videoEngine.detach();
    attachedRef.current = false;
  }, []);

  const preload = useCallback((src) => {
    videoEngine.preload(src);
  }, []);

  const play = useCallback(() => videoEngine.play(), []);
  const pause = useCallback(() => videoEngine.pause(), []);
  const setMuted = useCallback((muted) => videoEngine.setMuted(muted), []);
  const seek = useCallback((time) => videoEngine.seek(time), []);

  const on = useCallback((event, callback) => {
    return videoEngine.on(event, callback);
  }, []);

  const off = useCallback((event, callback) => {
    videoEngine.off(event, callback);
  }, []);

  const transitionTo = useCallback((src, onComplete) => {
    videoEngine.transitionTo(src, onComplete);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return {
    attach,
    detach,
    preload,
    play,
    pause,
    setMuted,
    seek,
    on,
    off,
    transitionTo,
    isBuffering,
    currentTime,
    duration,
    progress,
    isAttached: attachedRef.current,
    engine: videoEngine
  };
};

export default useVideoEngine;
