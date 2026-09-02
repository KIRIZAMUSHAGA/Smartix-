/**
 * 🎵 Singleton Audio Context Manager
 * Centralizes audio management with fade transitions
 * Prevents memory leaks with proper cleanup
 */

class AudioContextManager {
  constructor() {
    this.audioElement = null;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.fadeInProgress = false;
    this.fadeOutProgress = false;
    this.webAudioInitialized = false;
  }

  /**
   * Initialize Web Audio API safely with fallback
   */
  initializeWebAudio() {
    if (this.webAudioInitialized || !this.audioElement) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('AudioContext not supported in this browser');
        return;
      }

      this.audioContext = new AudioContextClass();
      
      // Only create analyser if methods are available
      if (this.audioContext && typeof this.audioContext.createAnalyser === 'function') {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        
        // Create source from audio element
        if (typeof this.audioContext.createMediaElementAudioSource === 'function') {
          const source = this.audioContext.createMediaElementAudioSource(this.audioElement);
          source.connect(this.analyser);
          this.analyser.connect(this.audioContext.destination);
          this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
      }
      this.webAudioInitialized = true;
    } catch (err) {
      console.warn('Failed to initialize Web Audio API:', err.message);
      this.webAudioInitialized = true; // Mark as attempted to prevent retry loops
    }
  }

  /**
   * Get or create audio element
   */
  getAudioElement() {
    if (!this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      
      // Initialize Web Audio API after element is created
      setTimeout(() => this.initializeWebAudio(), 0);
    }
    return this.audioElement;
  }

  /**
   * Load music
   */
  loadMusic(url) {
    const audio = this.getAudioElement();
    if (audio.src !== url) {
      audio.src = url;
    }
    return audio;
  }

  /**
   * Play with smooth fade in (0 → 0.8 volume)
   */
  async playWithFade(url, duration = 500) {
    if (this.fadeInProgress) return;
    
    try {
      this.fadeInProgress = true;
      const audio = this.loadMusic(url);
      audio.volume = 0;
      
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }
      
      await audio.play().catch(err => console.warn('Play failed:', err.message));
      
      const startTime = Date.now();
      const targetVolume = 0.8;
      
      return new Promise((resolve) => {
        const fade = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          audio.volume = progress * targetVolume;
          
          if (progress < 1) {
            requestAnimationFrame(fade);
          } else {
            this.fadeInProgress = false;
            resolve();
          }
        };
        fade();
      });
    } catch (err) {
      console.warn('playWithFade error:', err.message);
      this.fadeInProgress = false;
    }
  }

  /**
   * Stop with smooth fade out (volume → 0)
   */
  async stopWithFade(duration = 500) {
    if (this.fadeOutProgress) return; // Prevent concurrent fades
    
    this.fadeOutProgress = true;
    const audio = this.getAudioElement();
    const startVolume = audio.volume;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const fade = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        audio.volume = startVolume * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(fade);
        } else {
          audio.pause();
          audio.currentTime = 0;
          this.fadeOutProgress = false;
          resolve();
        }
      };
      fade();
    });
  }

  /**
   * Get frequency data for visualizer (real-time)
   */
  getFrequencyData() {
    try {
      if (this.analyser && this.dataArray && typeof this.analyser.getByteFrequencyData === 'function') {
        this.analyser.getByteFrequencyData(this.dataArray);
        return Array.from(this.dataArray).slice(0, 12);
      }
    } catch (err) {
      console.warn('Failed to get frequency data:', err.message);
    }
    return Array(12).fill(0);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
  }
}

// Singleton instance
export const audioManager = new AudioContextManager();
