
import { useState, useRef, useCallback, useEffect } from 'react';

const useScrollNavigation = (clipsLength, hasMore, loadingMore, loadMore, isOnline) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const loadMoreLockRef = useRef(false);
  const rafRef = useRef(null);

  // =============================
  // CALCUL DE L'INDEX
  // =============================
  const calculateIndex = useCallback((scrollTop, windowHeight) => {
    if (windowHeight <= 0) return 0;
    // Utiliser Math.floor pour plus de prévisibilité
    const index = Math.floor(scrollTop / windowHeight);
    return Math.max(0, Math.min(index, clipsLength - 1));
  }, [clipsLength]);

  // =============================
  // GESTION DU REDIMENSIONNEMENT
  // =============================
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const windowHeight = window.innerHeight;
      const newIndex = calculateIndex(scrollTop, windowHeight);
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentIndex, calculateIndex]);

  // =============================
  // GESTION DU SCROLL (AVEC RAF)
  // =============================
  const handleScroll = useCallback((e) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const scrollTop = e.target.scrollTop;
      const windowHeight = window.innerHeight;
      const newIndex = calculateIndex(scrollTop, windowHeight);
      
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < clipsLength) {
        setCurrentIndex(newIndex);
      }

      // Gestion de l'état de scroll (pour UI)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      setIsScrolling(true);
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      // Scroll infini avec lock pour éviter les appels multiples
      if (!loadingMore && hasMore && isOnline && !loadMoreLockRef.current) {
        const scrollBottom = e.target.scrollTop + windowHeight;
        const scrollHeight = e.target.scrollHeight;
        const threshold = windowHeight * 2;
        
        if (scrollHeight - scrollBottom <= threshold) {
          loadMoreLockRef.current = true;
          loadMore?.();
          // Débloquer après un délai pour laisser le temps au chargement
          setTimeout(() => {
            loadMoreLockRef.current = false;
          }, 1000);
        }
      }
    });
  }, [currentIndex, clipsLength, loadingMore, hasMore, isOnline, loadMore, calculateIndex]);

  // =============================
  // NETTOYAGE
  // =============================
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // =============================
  // NAVIGATION VERS UN INDEX SPÉCIFIQUE
  // =============================
  const navigateToIndex = useCallback((index, smooth = true) => {
    if (!containerRef.current) return;
    
    const targetIndex = Math.max(0, Math.min(index, clipsLength - 1));
    const targetScrollTop = targetIndex * window.innerHeight;
    
    containerRef.current.scrollTo({
      top: targetScrollTop,
      behavior: smooth ? 'smooth' : 'auto'
    });
    
    setCurrentIndex(targetIndex);
  }, [clipsLength]);

  // =============================
  // NAVIGATION VERS LE SUIVANT
  // =============================
  const nextClip = useCallback(() => {
    if (currentIndex < clipsLength - 1) {
      navigateToIndex(currentIndex + 1);
    }
  }, [currentIndex, clipsLength, navigateToIndex]);

  // =============================
  // NAVIGATION VERS LE PRÉCÉDENT
  // =============================
  const prevClip = useCallback(() => {
    if (currentIndex > 0) {
      navigateToIndex(currentIndex - 1);
    }
  }, [currentIndex, navigateToIndex]);

  // =============================
  // RÉINITIALISER L'INDEX
  // =============================
  const resetIndex = useCallback(() => {
    setCurrentIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  return {
    containerRef,
    currentIndex,
    setCurrentIndex,
    isScrolling,
    handleScroll,
    navigateToIndex,
    nextClip,
    prevClip,
    resetIndex
  };
};

export default useScrollNavigation;
