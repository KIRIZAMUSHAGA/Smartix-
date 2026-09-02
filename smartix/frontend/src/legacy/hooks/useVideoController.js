import { useState, useCallback, useRef, useEffect } from 'react';

export function useVideoController({ clips = [], currentIndex = 0 } = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const videoRefs = useRef({});

  const getCurrentVideo = useCallback(() => {
    const clip = clips[currentIndex];
    return clip ? videoRefs.current[clip.id] : null;
  }, [clips, currentIndex]);

  const play = useCallback(() => {
    const video = getCurrentVideo();
    if (video) { video.play().catch(() => {}); setIsPlaying(true); }
  }, [getCurrentVideo]);

  const pause = useCallback(() => {
    const video = getCurrentVideo();
    if (video) { video.pause(); setIsPlaying(false); }
  }, [getCurrentVideo]);

  const togglePlay = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const toggleMute = useCallback(() => {
    const video = getCurrentVideo();
    if (video) { video.muted = !isMuted; setIsMuted(!isMuted); }
  }, [isMuted, getCurrentVideo]);

  const setVideoRef = useCallback((id, el) => {
    if (el) videoRefs.current[id] = el;
    else delete videoRefs.current[id];
  }, []);

  const handleTimeUpdate = useCallback((e) => {
    const video = e.target;
    if (video.duration) setProgress((video.currentTime / video.duration) * 100);
  }, []);

  const seek = useCallback((percent) => {
    const video = getCurrentVideo();
    if (video && video.duration) video.currentTime = (percent / 100) * video.duration;
  }, [getCurrentVideo]);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
  }, [currentIndex]);

  return { isPlaying, isMuted, progress, volume, play, pause, togglePlay, toggleMute, setVideoRef, handleTimeUpdate, seek, setVolume };
}

export default useVideoController;
