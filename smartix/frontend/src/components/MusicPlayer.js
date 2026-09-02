import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Volume2, Volume1, VolumeX, X } from 'lucide-react';
import { audioManager } from '../utils/audioContext';

const MusicPlayer = ({ music, onRemove }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [visualizerBars, setVisualizerBars] = useState(Array(12).fill(0));

  // Update visualizer with REAL frequency data
  useEffect(() => {
    if (!isPlaying) {
      setVisualizerBars(Array(12).fill(0));
      return;
    }

    const interval = setInterval(() => {
      const frequencyData = audioManager.getFrequencyData();
      // Scale frequency data to visualizer height (0-100px)
      const bars = frequencyData.map(value => (value / 255) * 100);
      setVisualizerBars(bars);
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Get audio from singleton manager
  const audio = audioManager.getAudioElement();

  // Load music
  useEffect(() => {
    audioManager.loadMusic(music.url);
  }, [music.url]);
  
  useEffect(() => {
    audio.volume = volume / 100;
  }, [volume, audio]);

  useEffect(() => {
    if (isPlaying) {
      audio.play().catch(err => console.warn('Play failed:', err));
    } else {
      audio.pause();
    }
  }, [isPlaying, audio]);

  useEffect(() => {
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / music.duration) * 100;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-purple-900/50 to-transparent border-t border-white/10 p-4 z-40">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        
        {/* Visualizer */}
        <div className="flex items-center gap-1 h-12">
          {visualizerBars.map((height, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full transition-all"
              style={{
                height: isPlaying ? `${Math.max(20, height)}px` : '4px'
              }}
            />
          ))}
        </div>

        {/* Song Info */}
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{music.title}</p>
          <p className="text-white/60 text-xs">{music.artist}</p>
          
          {/* Progress Bar */}
          <div className="mt-2 bg-white/10 rounded-full h-1 cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const newTime = (e.clientX - rect.left) / rect.width * music.duration;
            audio.currentTime = newTime;
          }}>
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          
          <div className="flex justify-between text-xs text-white/60 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(music.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1">
            {volume === 0 ? (
              <VolumeX className="w-4 h-4 text-white" />
            ) : volume < 50 ? (
              <Volume1 className="w-4 h-4 text-white" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-16 h-1 bg-white/20 rounded accent-purple-500"
            />
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:shadow-lg transition"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => {
              audio.pause();
              onRemove();
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

MusicPlayer.propTypes = {
  music: PropTypes.object,
  onRemove: PropTypes.func,
};

export default MusicPlayer;
