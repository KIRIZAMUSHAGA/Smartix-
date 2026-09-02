import React, { useState, useMemo } from 'react';
import { X, Search, Play, Pause } from 'lucide-react';
import { musicLibrary } from '../utils/musicLibrary';
import { audioManager } from '../utils/audioContext';
import MusicUpload from './MusicUpload';
import PropTypes from 'prop-types';

const MusicLibrary = ({ onSelectMusic, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [filterMood, setFilterMood] = useState('all');
  const [filterEnergy, setFilterEnergy] = useState('all');

  const currentCategory = useMemo(() => {
    return musicLibrary.categories.find(c => c.id === selectedCategory) || { songs: [] };
  }, [selectedCategory]);

  const filteredSongs = useMemo(() => {
    let songs = currentCategory.songs || [];
    
    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      songs = songs.filter(s =>
        (s.title?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q))
      );
    }

    // Filter by mood
    if (filterMood !== 'all') {
      songs = songs.filter(s => s.mood?.includes(filterMood));
    }

    // Filter by energy
    if (filterEnergy !== 'all') {
      songs = songs.filter(s => s.energy === filterEnergy);
    }

    return songs;
  }, [currentCategory, searchQuery, filterMood, filterEnergy]);

  const handlePlayPreview = (song) => {
    const audio = audioManager.getAudioElement();
    if (playingId === song.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audioManager.loadMusic(song.url);
      audio.play().catch(err => console.warn('Preview play failed:', err));
      setPlayingId(song.id);
    }
  };

  const handleSelectSong = (song) => {
    setSelectedSong(song);
  };

  const handleValidateMusic = () => {
    if (selectedSong) {
      audioManager.getAudioElement().pause();
      onSelectMusic({
        id: selectedSong.id,
        title: selectedSong.title,
        artist: selectedSong.artist,
        duration: selectedSong.duration,
        url: selectedSong.url,
        category: selectedCategory,
        isCustom: selectedSong.isCustom
      });
    }
  };

  const handleMusicUploaded = (musicData) => {
    audioManager.getAudioElement().pause();
    onSelectMusic(musicData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2">
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-black rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col border border-white/20">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">🎵 Musique Smartix</h2>
          <div className="flex items-center gap-2">
            {!showUpload && (
              <button 
                onClick={() => setShowUpload(true)}
                className="px-3 py-1 text-sm bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 rounded-lg transition"
                title="Importer votre musique"
              >
                ⬆️ Importer
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {showUpload ? (
            <div className="flex-1 flex items-center justify-center">
              <MusicUpload
                onMusicUploaded={handleMusicUploaded}
                onClose={() => setShowUpload(false)}
              />
            </div>
          ) : (
            <>
              {/* Categories */}
              <div className="w-32 flex flex-col gap-1 overflow-y-auto pb-2">
                {musicLibrary.categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSearchQuery('');
                    }}
                    className={`px-3 py-2 rounded text-sm font-medium transition whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white/80'
                    }`}
                  >
                    {cat.icon} {cat.title}
                  </button>
                ))}
              </div>

              {/* Songs List */}
              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <input
                    type="text"
                    placeholder="Rechercher une chanson..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/50 focus:outline-none focus:border-purple-400"
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-2 text-xs">
                  <select
                    value={filterEnergy}
                    onChange={(e) => setFilterEnergy(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white/10 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-purple-400"
                  >
                    <option value="all">Energy: All</option>
                    <option value="high">⚡ High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">💤 Low</option>
                  </select>
                  <select
                    value={filterMood}
                    onChange={(e) => setFilterMood(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white/10 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-purple-400"
                  >
                    <option value="all">Mood: All</option>
                    <option value="energetic">⚡ Energetic</option>
                    <option value="calm">😌 Calm</option>
                    <option value="happy">😊 Happy</option>
                    <option value="sad">😢 Sad</option>
                    <option value="uplifting">🚀 Uplifting</option>
                    <option value="cool">😎 Cool</option>
                  </select>
                </div>

                {/* Songs Grid */}
                <div className="flex-1 overflow-y-auto pr-2 flex flex-col">
                  <div className="space-y-2 flex-1">
                    {filteredSongs.map(song => (
                      <div
                        key={song.id}
                        className={`rounded-lg p-3 border transition cursor-pointer group ${
                          selectedSong?.id === song.id
                            ? 'bg-purple-500/40 border-purple-400'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-purple-400'
                        }`}
                        onClick={() => handleSelectSong(song)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className={`font-semibold ${selectedSong?.id === song.id ? 'text-purple-200' : 'text-white group-hover:text-purple-300'}`}>{song.title}</p>
                            <p className="text-xs text-white/60">{song.artist} • {song.duration}s</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayPreview(song);
                            }}
                            className="p-2 bg-purple-500/20 hover:bg-purple-500/40 rounded-lg transition"
                          >
                            {playingId === song.id ? (
                              <Pause className="w-4 h-4 text-white" />
                            ) : (
                              <Play className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Validation Button */}
                  <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                    <button
                      onClick={handleValidateMusic}
                      disabled={!selectedSong}
                      className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-white/10 disabled:text-white/40 text-white font-semibold rounded-lg transition"
                    >
                      ✓ Valider
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

MusicLibrary.propTypes = {
  onSelectMusic: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MusicLibrary;
