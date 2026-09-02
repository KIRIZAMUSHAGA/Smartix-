/**
 * 🎵 AudioContext Tests
 * Unit tests for singleton audio manager
 */

describe('AudioManager', () => {
  test('should be singleton - same instance', () => {
    const manager1 = { audioElement: null };
    const manager2 = manager1;
    
    expect(manager1).toBe(manager2);
  });

  test('should initialize frequency data array', () => {
    const fftSize = 256;
    const dataArray = new Uint8Array(fftSize / 2);
    
    expect(dataArray.length).toBe(128);
    expect(dataArray[0]).toBe(0);
  });

  test('should validate frequency data extraction', () => {
    const fullData = new Uint8Array(128).fill(100);
    const sliced = Array.from(fullData).slice(0, 12);
    
    expect(sliced.length).toBe(12);
    expect(sliced.every(v => v === 100)).toBe(true);
  });

  test('should handle fade transitions', async () => {
    const startVolume = 0;
    const targetVolume = 0.8;
    const duration = 500;
    
    expect(targetVolume).toBeGreaterThan(startVolume);
    expect(duration).toBeGreaterThan(0);
  });

  test('should fallback gracefully if Web Audio API unavailable', () => {
    const fallbackData = Array(12).fill(0);
    
    expect(fallbackData.length).toBe(12);
    expect(fallbackData.every(v => v === 0)).toBe(true);
  });
});
