/**
 * 🎵 MUSIQUE SMARTIX - ENHANCED METADATA
 * Bibliothèque enrichie avec BPM, genre, mood tags
 */

export const musicLibrary = {
  total: 50,
  categories: [
    {
      id: 'trending',
      title: '🔥 Trending',
      icon: '🔥',
      description: 'Chansons populaires du moment',
      songs: [
        { id: 'trending_1', title: 'Top Vibes', artist: 'Smartix Music', duration: 45, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', energy: 'high', bpm: 128, genre: 'Electronic', mood: ['uplifting', 'energetic', 'modern'] },
        { id: 'trending_2', title: 'Vibes Up', artist: 'Smartix Music', duration: 52, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', energy: 'high', bpm: 124, genre: 'Pop', mood: ['happy', 'energetic', 'uplifting'] },
        { id: 'trending_3', title: 'Fresh Beat', artist: 'Smartix Music', duration: 48, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', energy: 'medium', bpm: 110, genre: 'Pop', mood: ['smooth', 'trendy', 'modern'] },
        { id: 'trending_4', title: 'Sun Rising', artist: 'Smartix Music', duration: 55, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', energy: 'high', bpm: 130, genre: 'Electronic', mood: ['inspiring', 'energetic', 'uplifting'] },
        { id: 'trending_5', title: 'Electric Feel', artist: 'Smartix Music', duration: 50, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', energy: 'high', bpm: 126, genre: 'Electronic', mood: ['energetic', 'fun', 'modern'] },
      ]
    },
    {
      id: 'fun',
      title: '😄 Fun & Playful',
      icon: '😄',
      description: 'Musiques amusantes et légères',
      songs: [
        { id: 'fun_1', title: 'Happy Moments', artist: 'Smartix Music', duration: 42, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', energy: 'high', bpm: 120, genre: 'Pop', mood: ['happy', 'playful', 'uplifting'] },
        { id: 'fun_2', title: 'Silly Dance', artist: 'Smartix Music', duration: 50, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', energy: 'high', bpm: 128, genre: 'Pop', mood: ['fun', 'playful', 'energetic'] },
        { id: 'fun_3', title: 'Bounce Around', artist: 'Smartix Music', duration: 48, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', energy: 'high', bpm: 122, genre: 'Electronic', mood: ['playful', 'fun', 'energetic'] },
        { id: 'fun_4', title: 'Party Time', artist: 'Smartix Music', duration: 55, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', energy: 'high', bpm: 130, genre: 'Electronic', mood: ['party', 'fun', 'energetic'] },
      ]
    },
    {
      id: 'motivational',
      title: '💪 Motivational',
      icon: '💪',
      description: 'Musiques inspirantes et énergiques',
      songs: [
        { id: 'mot_1', title: 'Rise Up', artist: 'Smartix Music', duration: 52, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', energy: 'high', bpm: 125, genre: 'Pop', mood: ['inspiring', 'motivating', 'powerful'] },
        { id: 'mot_2', title: 'Champion', artist: 'Smartix Music', duration: 50, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', energy: 'high', bpm: 128, genre: 'Electronic', mood: ['powerful', 'motivating', 'inspiring'] },
        { id: 'mot_3', title: 'Go Getter', artist: 'Smartix Music', duration: 48, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', energy: 'high', bpm: 130, genre: 'Hip-Hop', mood: ['motivating', 'energetic', 'powerful'] },
        { id: 'mot_4', title: 'Victory', artist: 'Smartix Music', duration: 55, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', energy: 'high', bpm: 128, genre: 'Electronic', mood: ['powerful', 'triumphant', 'inspiring'] },
      ]
    },
    {
      id: 'emotional',
      title: '😢 Emotional',
      icon: '😢',
      description: 'Musiques émouvantes et nostalgiques',
      songs: [
        { id: 'emo_1', title: 'Missing You', artist: 'Smartix Music', duration: 50, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', energy: 'low', bpm: 85, genre: 'Ballad', mood: ['sad', 'emotional', 'nostalgic'] },
        { id: 'emo_2', title: 'Broken Heart', artist: 'Smartix Music', duration: 48, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', energy: 'low', bpm: 80, genre: 'Ballad', mood: ['sad', 'melancholic', 'emotional'] },
        { id: 'emo_3', title: 'Memories', artist: 'Smartix Music', duration: 52, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', energy: 'low', bpm: 90, genre: 'Ambient', mood: ['nostalgic', 'emotional', 'reflective'] },
        { id: 'emo_4', title: 'Peaceful Night', artist: 'Smartix Music', duration: 56, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3', energy: 'low', bpm: 75, genre: 'Ambient', mood: ['peaceful', 'calm', 'relaxing'] },
      ]
    },
    {
      id: 'background',
      title: '🎶 Background',
      icon: '🎶',
      description: 'Musique de fond subtile',
      songs: [
        { id: 'bg_1', title: 'Subtle Groove', artist: 'Smartix Music', duration: 54, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-18.mp3', energy: 'low', bpm: 95, genre: 'Ambient', mood: ['calm', 'subtle', 'background'] },
        { id: 'bg_2', title: 'Ambient Vibes', artist: 'Smartix Music', duration: 59, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-19.mp3', energy: 'low', bpm: 80, genre: 'Ambient', mood: ['ambient', 'calming', 'background'] },
        { id: 'bg_3', title: 'Chill Lounge', artist: 'Smartix Music', duration: 55, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-20.mp3', energy: 'low', bpm: 100, genre: 'Chillout', mood: ['chill', 'relaxing', 'lounge'] },
      ]
    },
    {
      id: 'hiphop',
      title: '🎤 Hip-Hop',
      icon: '🎤',
      description: 'Beats Hip-Hop énergiques',
      songs: [
        { id: 'hh_1', title: 'Street Flow', artist: 'Smartix Music', duration: 50, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-21.mp3', energy: 'high', bpm: 95, genre: 'Hip-Hop', mood: ['urban', 'energetic', 'cool'] },
        { id: 'hh_2', title: 'Boom Bap', artist: 'Smartix Music', duration: 52, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-22.mp3', energy: 'high', bpm: 100, genre: 'Hip-Hop', mood: ['classic', 'energetic', 'cool'] },
        { id: 'hh_3', title: 'Rap Game', artist: 'Smartix Music', duration: 48, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-23.mp3', energy: 'high', bpm: 98, genre: 'Hip-Hop', mood: ['intense', 'energetic', 'powerful'] },
      ]
    },
    {
      id: 'rock',
      title: '🎸 Rock',
      icon: '🎸',
      description: 'Rock classique et moderne',
      songs: [
        { id: 'rock_1', title: 'Guitar Hero', artist: 'Smartix Music', duration: 51, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-24.mp3', energy: 'high', bpm: 120, genre: 'Rock', mood: ['powerful', 'energetic', 'intense'] },
        { id: 'rock_2', title: 'Stone Cold', artist: 'Smartix Music', duration: 53, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-25.mp3', energy: 'high', bpm: 115, genre: 'Rock', mood: ['hard', 'intense', 'powerful'] },
        { id: 'rock_3', title: 'Metal Rush', artist: 'Smartix Music', duration: 50, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-26.mp3', energy: 'high', bpm: 140, genre: 'Metal', mood: ['intense', 'powerful', 'energetic'] },
      ]
    },
    {
      id: 'dance',
      title: '💃 Dance',
      icon: '💃',
      description: 'Musique de danse époustouflante',
      songs: [
        { id: 'dance_1', title: 'Dance Floor', artist: 'Smartix Music', duration: 50, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-27.mp3', energy: 'high', bpm: 130, genre: 'Dance', mood: ['party', 'energetic', 'fun'] },
        { id: 'dance_2', title: 'Disco Fever', artist: 'Smartix Music', duration: 54, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-28.mp3', energy: 'high', bpm: 120, genre: 'Dance', mood: ['fun', 'party', 'retro'] },
        { id: 'dance_3', title: 'EDM Night', artist: 'Smartix Music', duration: 52, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-29.mp3', energy: 'high', bpm: 135, genre: 'EDM', mood: ['energetic', 'intense', 'modern'] },
        { id: 'dance_4', title: 'Pulse', artist: 'Smartix Music', duration: 49, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-30.mp3', energy: 'high', bpm: 128, genre: 'Dance', mood: ['energetic', 'hypnotic', 'fun'] },
      ]
    }
  ]
};

// Filter by mood
export const filterByMood = (mood) => {
  return musicLibrary.categories.flatMap(cat => 
    cat.songs.filter(song => song.mood?.includes(mood))
  );
};

// Filter by energy level
export const filterByEnergy = (energy) => {
  return musicLibrary.categories.flatMap(cat =>
    cat.songs.filter(song => song.energy === energy)
  );
};

// Filter by BPM range
export const filterByBPM = (minBPM, maxBPM) => {
  return musicLibrary.categories.flatMap(cat =>
    cat.songs.filter(song => song.bpm >= minBPM && song.bpm <= maxBPM)
  );
};

// Get all songs flattened
export const getAllSongs = () => {
  return musicLibrary.categories.flatMap(cat => cat.songs.map(song => ({ ...song, category: cat.id })));
};

// Search songs
export const searchSongs = (query) => {
  const q = query.toLowerCase();
  return getAllSongs().filter(song => 
    song.title.toLowerCase().includes(q) || 
    song.artist.toLowerCase().includes(q) ||
    song.genre?.toLowerCase().includes(q) ||
    song.mood?.some(m => m.toLowerCase().includes(q))
  );
};
