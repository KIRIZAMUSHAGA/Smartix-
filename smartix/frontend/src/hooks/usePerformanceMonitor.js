import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook pour monitorer les performances et détecter les ralentissements
 * Mesure FPS, détecte si le système réactions doit être désactivé
 */
export const usePerformanceMonitor = (enabled = true) => {
  const [fps, setFps] = useState(60);
  const [shouldDisable, setShouldDisable] = useState(false);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef([]);
  const animationFrameRef = useRef(null);
  const checkIntervalRef = useRef(null);

  const measureFrame = useCallback(() => {
    frameCountRef.current += 1;
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;

    // Update FPS every 500ms
    if (elapsed >= 500) {
      const currentFps = Math.round((frameCountRef.current / elapsed) * 1000);
      setFps(currentFps);
      
      // Garder un historique des 10 derniers mesures
      fpsHistoryRef.current.push(currentFps);
      if (fpsHistoryRef.current.length > 10) {
        fpsHistoryRef.current.shift();
      }

      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    animationFrameRef.current = requestAnimationFrame(measureFrame);
  }, []);

  const checkPerformance = useCallback(() => {
    if (fpsHistoryRef.current.length === 0) return;

    // Calculer la moyenne FPS
    const avgFps = Math.round(
      fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length
    );

    // Si FPS < 20 de manière consistante, désactiver
    const lowFpsCount = fpsHistoryRef.current.filter(f => f < 20).length;
    const shouldAutoDisable = lowFpsCount >= 6; // Plus de 6 sur 10

    if (shouldAutoDisable && !shouldDisable) {
      console.warn(`⚠️ Performance too low (${avgFps} FPS avg) - disabling reactions overlay`);
      setShouldDisable(true);
    } else if (!shouldAutoDisable && shouldDisable) {
      console.log(`✅ Performance recovered (${avgFps} FPS avg) - enabling reactions overlay`);
      setShouldDisable(false);
    }
  }, [shouldDisable]);

  useEffect(() => {
    if (!enabled) return;

    let animFrameId = null;
    let checkIntervalId = null;

    // Start measuring frames
    const startMeasuring = () => {
      animFrameId = requestAnimationFrame(() => {
        measureFrame();
        startMeasuring();
      });
    };
    
    startMeasuring();

    // Check performance every 2 seconds
    checkIntervalId = setInterval(checkPerformance, 2000);

    return () => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      if (checkIntervalId) {
        clearInterval(checkIntervalId);
      }
      frameCountRef.current = 0;
      fpsHistoryRef.current = [];
    };
  }, [enabled, measureFrame, checkPerformance]);

  return {
    fps,
    shouldDisableReactions: shouldDisable,
    performanceStatus: shouldDisable ? 'DEGRADED' : 'OK'
  };
};

export default usePerformanceMonitor;
