
/**
 * SoundPlayer - Gère la lecture des effets sonores
 * Précharge les sons pour éviter la latence
 */

class SoundPlayer {
  constructor() {
    this.sounds = {};
    this.preloadSounds();
  }

  preloadSounds() {
    const soundFiles = {
      success: '/sounds/success.mp3',
      error: '/sounds/error.mp3',
      timeover: '/sounds/timeover.mp3',
      pageturn: '/sounds/pageturn.mp3'
    };

    Object.keys(soundFiles).forEach(key => {
      try {
        const audio = new Audio(soundFiles[key]);
        audio.preload = 'auto';
        this.sounds[key] = audio;
      } catch (error) {
        console.warn(`Failed to preload sound: ${key}`, error);
      }
    });
  }

  play(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      try {
        sound.currentTime = 0;
        sound.play().catch(err => console.warn('Sound play error:', err));
      } catch (error) {
        console.warn(`Error playing sound: ${soundName}`, error);
      }
    }
  }

  playSuccess() {
    this.play('success');
  }

  playError() {
    this.play('error');
  }

  playTimeover() {
    this.play('timeover');
  }

  playPageTurn() {
    this.play('pageturn');
  }
}

export const soundPlayer = new SoundPlayer();
export const playSuccess = () => soundPlayer.playSuccess();
export const playError = () => soundPlayer.playError();
export const playTimeover = () => soundPlayer.playTimeover();
export const playPageTurn = () => soundPlayer.playPageTurn();
