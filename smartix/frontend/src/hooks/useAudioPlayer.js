import { useState } from 'react';
export const useAudioPlayer = () => {
  const [playing, setPlaying] = useState(false);
  return { playing, play: () => setPlaying(true), pause: () => setPlaying(false), stop: () => setPlaying(false) };
};
export default useAudioPlayer;
