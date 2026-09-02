import { useRef, useCallback } from 'react';

/**
 * Hook pour détecter les gestes tactiles:
 * - Double-tap (2 taps < 350ms)
 * - Long press (> 350ms, < 500ms)
 * - Swipe (mouvement horizontal)
 * - Single tap (tap isolé)
 */
export const useTouchGestures = ({
  onDoubleTap,
  onLongPress,
  onSwipe,
  onSingleTap,
  swipeThreshold = 50,
  doubleTapThreshold = 350,
  longPressMinTime = 350,
  longPressMaxTime = 500
}) => {
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const longPressTimeoutRef = useRef(null);
  const gestureDetectedRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    // Réinitialiser les flags
    gestureDetectedRef.current = false;
    
    // Enregistrer la position du premier touch
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };

    // Démarrer le timer pour long press
    longPressTimeoutRef.current = setTimeout(() => {
      if (!gestureDetectedRef.current && onLongPress) {
        gestureDetectedRef.current = true;
        onLongPress({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        });
      }
    }, longPressMinTime);
  }, [onLongPress]);

  const handleTouchEnd = useCallback((e) => {
    // Annuler le timer long press si le doigt se lève avant le seuil
    if (Date.now() - touchStartRef.current.time < longPressMinTime) {
      clearTimeout(longPressTimeoutRef.current);
    }

    touchEndRef.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const moveX = Math.abs(touchEndRef.current.x - touchStartRef.current.x);
    const moveY = Math.abs(touchEndRef.current.y - touchStartRef.current.y);
    const duration = touchEndRef.current.time - touchStartRef.current.time;

    // Déterminer le type de geste
    
    // 1. SWIPE: mouvement horizontal > threshold
    if (moveX > swipeThreshold && moveX > moveY && !gestureDetectedRef.current) {
      gestureDetectedRef.current = true;
      const direction = touchEndRef.current.x < touchStartRef.current.x ? 'left' : 'right';
      onSwipe?.(direction);
      return;
    }

    // 2. LONG PRESS: déjà géré dans le timeout
    if (gestureDetectedRef.current) {
      return;
    }

    // 3. DOUBLE-TAP ou SINGLE TAP (mouvement minimal)
    if (moveX < swipeThreshold && moveY < swipeThreshold) {
      const timeSinceLastTap = Date.now() - lastTapTimeRef.current;

      if (timeSinceLastTap < doubleTapThreshold && tapCountRef.current === 1) {
        // DOUBLE-TAP détecté
        gestureDetectedRef.current = true;
        tapCountRef.current = 0;
        lastTapTimeRef.current = 0;
        onDoubleTap?.({
          x: touchStartRef.current.x,
          y: touchStartRef.current.y
        });
      } else {
        // Premier tap ou trop de temps écoulé
        tapCountRef.current = 1;
        lastTapTimeRef.current = Date.now();

        // Attendre un peu pour voir si un 2e tap arrive
        setTimeout(() => {
          if (tapCountRef.current === 1 && !gestureDetectedRef.current) {
            // C'était un SINGLE TAP
            tapCountRef.current = 0;
            onSingleTap?.({
              x: touchStartRef.current.x,
              y: touchStartRef.current.y
            });
          }
        }, doubleTapThreshold);
      }
    }
  }, [onDoubleTap, onSwipe, onSingleTap, doubleTapThreshold, swipeThreshold]);

  const handleTouchMove = useCallback((e) => {
    // Si mouvement détecté, annuler le long press
    if (touchStartRef.current) {
      const moveX = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
      const moveY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);

      if ((moveX > 10 || moveY > 10) && !gestureDetectedRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    }
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove
  };
};

export default useTouchGestures;
