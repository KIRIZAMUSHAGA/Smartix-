import React, { useState, useEffect, useRef, memo, useCallback, useMemo, useId, startTransition, useDeferredValue } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle } from 'lucide-react';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { getImageUrl } from '../config/apiClient';

// =============================
// CONSTANTES
// =============================
const VISIBLE_ITEMS = 4;
const ITEM_WIDTH = 80; // 64px + 16px gap
const FALLBACK_AVATAR = '/default-avatar.png';
const FALLBACK_AVATAR_ALT = '/default-avatar-alt.png';
const IMAGE_LOAD_DELAY = 400;
const SCROLL_DEBOUNCE_DELAY = 150;
const PRELOAD_RANGE = 2;
const VIRTUALIZATION_THRESHOLD = 50; // Nombre d'items avant virtualisation

// =============================
// HOOK: PRELOAD IMAGE (AVEC PROGRESSIVE LOADING)
// =============================
const usePreloadImage = (url) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!url) return;
    
    const img = new Image();
    img.onload = () => {
      setIsLoaded(true);
      setProgress(100);
    };
    img.onerror = () => setError(true);
    
    // Simulation de progression pour UX
    let interval;
    if (!isLoaded) {
      interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 50);
    }
    
    img.src = url;
    
    return () => {
      img.onload = null;
      img.onerror = null;
      if (interval) clearInterval(interval);
    };
  }, [url, isLoaded]);

  return { isLoaded, error, progress };
};

// =============================
// HOOK: SCROLL POSITION (OPTIMISÉ RAF)
// =============================
const useScrollPosition = (ref) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const timeoutRef = useRef();
  const tickingRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      if (!tickingRef.current) {
        requestAnimationFrame(() => {
          setScrollPosition(element.scrollLeft);
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
      
      setIsScrolling(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, SCROLL_DEBOUNCE_DELAY);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [ref]);

  return { scrollPosition, isScrolling };
};

// =============================
// HOOK: NETWORK TYPE (SMART PRELOADING)
// =============================
const useNetworkType = () => {
  const [networkType, setNetworkType] = useState('unknown');

  useEffect(() => {
    const connection = navigator.connection;
    if (connection) {
      const type = connection.effectiveType;
      setNetworkType(type === '4g' || type === '5g' ? 'fast' : 'slow');
      
      const handleChange = () => {
        setNetworkType(connection.effectiveType === '4g' || connection.effectiveType === '5g' ? 'fast' : 'slow');
      };
      connection.addEventListener('change', handleChange);
      return () => connection.removeEventListener('change', handleChange);
    }
  }, []);

  return networkType;
};

// =============================
// COMPOSANT CERCLE DE STORY (AVEC useId)
// =============================
const StoryCircleRing = memo(({ storiesCount, isViewed, size = 64, animate = true }) => {
  // React 18 useId pour IDs uniques et stables SSR
  const uniqueId = useId();
  const gradientId = `unseen-gradient-${uniqueId}`;
  const viewedGradientId = `viewed-gradient-${uniqueId}`;
  
  if (!storiesCount || storiesCount === 0) return null;
  
  const segments = Math.min(storiesCount, 8);
  const strokeColor = isViewed ? `url(#${viewedGradientId})` : `url(#${gradientId})`;
  
  const gradientDefs = (
    <defs>
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06b6d4" />
        <stop offset="50%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
      <linearGradient id={viewedGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6b7280" />
        <stop offset="100%" stopColor="#9ca3af" />
      </linearGradient>
    </defs>
  );
  
  const circleProps = {
    cx: 50,
    cy: 50,
    r: 46,
    fill: "none",
    stroke: strokeColor,
    strokeWidth: 4,
    strokeLinecap: "round",
    style: animate ? {
      strokeDasharray: 2 * Math.PI * 46,
      strokeDashoffset: isViewed ? 0 : 2 * Math.PI * 46,
      transition: 'stroke-dashoffset 0.6s ease-out'
    } : {}
  };
  
  if (segments === 1) {
    return (
      <svg 
        className="absolute inset-0" 
        viewBox="0 0 100 100"
        style={{ width: size, height: size, willChange: 'transform' }}
      >
        {gradientDefs}
        <circle {...circleProps} />
      </svg>
    );
  }
  
  const gapAngle = 8;
  const segmentAngle = (360 - gapAngle * segments) / segments;
  
  return (
    <svg 
      className="absolute inset-0" 
      viewBox="0 0 100 100"
      style={{ width: size, height: size, willChange: 'transform' }}
    >
      {gradientDefs}
      {Array.from({ length: segments }).map((_, i) => {
        const startAngle = -90 + i * (segmentAngle + gapAngle);
        const endAngle = startAngle + segmentAngle;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const x1 = 50 + 46 * Math.cos(startRad);
        const y1 = 50 + 46 * Math.sin(startRad);
        const x2 = 50 + 46 * Math.cos(endRad);
        const y2 = 50 + 46 * Math.sin(endRad);
        const largeArc = segmentAngle > 180 ? 1 : 0;
        
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A 46 46 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
            strokeLinecap="round"
            style={animate ? {
              strokeDasharray: 2 * Math.PI * 46 * (segmentAngle / 360),
              strokeDashoffset: isViewed ? 0 : 2 * Math.PI * 46 * (segmentAngle / 360),
              transition: 'stroke-dashoffset 0.6s ease-out'
            } : {}}
          />
        );
      })}
    </svg>
  );
});

StoryCircleRing.displayName = 'StoryCircleRing';

// =============================
// COMPOSANT CERCLE DE STORY (ADD)
// =============================
const AddStoryCircle = memo(({ onClick }) => {
  const handleClick = useCallback(() => onClick(), [onClick]);
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }, [onClick]);
  
  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg"
      aria-label="Ajouter une story"
      tabIndex={0}
      role="button"
    >
      <div className="relative w-16 h-16 will-change-transform">
        <div className="w-full h-full rounded-full bg-gradient-to-r from-gray-600 to-gray-700 p-0.5">
          <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center">
            <Plus className="w-6 h-6 text-gray-400 group-hover:text-gray-300 transition" />
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-cyan-500 rounded-full p-1 border-2 border-black shadow-lg">
          <Plus className="w-3 h-3 text-white" />
        </div>
      </div>
      <p className="text-white text-xs text-center truncate w-16 font-medium">
        Votre story
      </p>
    </button>
  );
});

AddStoryCircle.displayName = 'AddStoryCircle';

// =============================
// COMPOSANT CERCLE DE STORY (USER)
// =============================
const UserStoryCircle = memo(({ orbit, onClick, isActive = false, priority = false }) => {
  const [imgError, setImgError] = useState(false);
  const [secondFallback, setSecondFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);
  const loadTimeoutRef = useRef();
  
  // Construction de l'URL de l'avatar
  const avatarUrl = useMemo(() => {
    try {
      return getImageUrl(orbit.userAvatar, 'avatars') || null;
    } catch {
      return null;
    }
  }, [orbit.userAvatar]);
  
  // Préchargement intelligent avec priorité
  const { isLoaded: isPreloaded, progress } = usePreloadImage(priority ? avatarUrl || orbit.thumbnailUrl || null : null);
  
  // Déterminer la source de l'image
  const imageSrc = useMemo(() => {
    if (secondFallback) return FALLBACK_AVATAR_ALT;
    if (imgError) return FALLBACK_AVATAR;
    return avatarUrl || orbit.thumbnailUrl || FALLBACK_AVATAR;
  }, [avatarUrl, orbit.thumbnailUrl, imgError, secondFallback]);
  
  // Initiale pour fallback premium
  const initial = orbit.userName?.[0]?.toUpperCase() || '?';
  
  // Gestion des erreurs d'image avec double fallback
  const handleImageError = useCallback(() => {
    if (!imgError) {
      setImgError(true);
      setIsLoading(false);
    } else if (!secondFallback) {
      setSecondFallback(true);
      setIsLoading(false);
    }
  }, [imgError, secondFallback]);
  
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
  }, []);
  
  // Timeout pour afficher le fallback si l'image met trop de temps
  useEffect(() => {
    if (isLoading && !isPreloaded && !priority) {
      loadTimeoutRef.current = setTimeout(() => {
        setShowFallback(true);
        setIsLoading(false);
      }, IMAGE_LOAD_DELAY);
    }
    
    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [isLoading, isPreloaded, priority]);
  
  // Si préchargé, on peut éviter le loader
  useEffect(() => {
    if (isPreloaded && isLoading) {
      setIsLoading(false);
    }
  }, [isPreloaded, isLoading]);
  
  const handleClick = useCallback(() => {
    onClick(orbit);
  }, [orbit, onClick]);
  
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(orbit);
    }
  }, [orbit, onClick]);
  
  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg ${
        orbit.isViewed ? 'opacity-70' : 'opacity-100'
      }`}
      aria-label={`Story de ${orbit.userName}${orbit.storyCount > 1 ? `, ${orbit.storyCount} stories` : ''}${orbit.isViewed ? ' (déjà vue)' : ' (nouvelle)'}`}
      tabIndex={0}
      role="button"
    >
      <div className="relative w-16 h-16 will-change-transform">
        <StoryCircleRing 
          storiesCount={orbit.storyCount} 
          isViewed={orbit.isViewed}
          size={64}
          animate={!orbit.isViewed}
        />
        <div className="absolute inset-1 rounded-full overflow-hidden bg-gray-800">
          {(isLoading && !showFallback && !isPreloaded && !priority) ? (
            <div className="w-full h-full flex items-center justify-center">
              <div 
                className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"
                style={{ 
                  background: `conic-gradient(from 0deg, rgba(6,182,212,0.5) 0deg, rgba(6,182,212,0.5) ${progress * 3.6}deg, transparent ${progress * 3.6}deg)`
                }}
              />
            </div>
          ) : (imgError || secondFallback || showFallback) ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-500">
              <span className="text-white text-xl font-bold">
                {initial}
              </span>
            </div>
          ) : (
            <img
              src={imageSrc}
              alt={orbit.userName}
              className="w-full h-full rounded-full object-cover transition-opacity duration-300"
              loading={priority ? "eager" : "lazy"}
              onError={handleImageError}
              onLoad={handleImageLoad}
              style={{ 
                opacity: isLoading ? 0 : 1,
                filter: isLoading ? 'blur(10px)' : 'none',
                transition: 'opacity 0.3s ease, filter 0.3s ease'
              }}
            />
          )}
        </div>
        {orbit.storyCount > 1 && (
          <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg z-10">
            {orbit.storyCount > 9 ? '9+' : orbit.storyCount}
          </span>
        )}
        {!orbit.isViewed && orbit.storyCount > 0 && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyan-500 rounded-full border border-black animate-pulse" />
        )}
      </div>
      <p className="text-white text-xs text-center truncate w-16 font-medium">
        {orbit.userName}
      </p>
    </button>
  );
});

UserStoryCircle.displayName = 'UserStoryCircle';

// =============================
// COMPOSANT SKELETON LOADER (AVEC SKELETON ANIMÉ)
// =============================
const StoryCarouselSkeleton = () => {
  return (
    <div className="bg-black py-4 px-2 border-b border-white/10">
      <div className="flex items-center gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="w-16 h-16 rounded-full bg-gray-800 animate-pulse relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
            <div className="w-12 h-3 bg-gray-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================
// HOOK: GESTURE SWIPE (AVEC LOCK)
// =============================
const useSwipe = (ref, onSwipe) => {
  const touchStartRef = useRef(null);
  const isSwipingRef = useRef(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const handleTouchStart = (e) => {
      isSwipingRef.current = true;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };
    
    const handleTouchMove = (e) => {
      if (!isSwipingRef.current || !touchStartRef.current) return;
      
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
        e.preventDefault();
      }
    };
    
    const handleTouchEnd = (e) => {
      if (!isSwipingRef.current || !touchStartRef.current) {
        isSwipingRef.current = false;
        touchStartRef.current = null;
        return;
      }
      
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          onSwipe('right');
        } else {
          onSwipe('left');
        }
      }
      
      isSwipingRef.current = false;
      touchStartRef.current = null;
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, onSwipe]);
};

// =============================
// COMPOSANT PRINCIPAL (AVEC VIRTUALISATION)
// =============================
const StoryCarousel = ({ 
  storyOrbits = [], 
  onStorySelect, 
  onPreload, 
  onAddStory,
  isLoading: externalLoading = false
}) => {
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const { scrollPosition, isScrolling } = useScrollPosition(scrollRef);
  const [internalLoading, setInternalLoading] = useState(false);
  const [preloadedOrbitIds, setPreloadedOrbitIds] = useState(new Set());
  const networkType = useNetworkType();
  const deferredScrollPosition = useDeferredValue(scrollPosition);
  
  // Défensive rendering
  const safeOrbits = useMemo(() => {
    if (!Array.isArray(storyOrbits)) return [];
    return storyOrbits;
  }, [storyOrbits]);
  
  // Virtualisation: calcul des indices visibles
  const visibleIndices = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(deferredScrollPosition / ITEM_WIDTH) - PRELOAD_RANGE);
    const endIndex = Math.min(safeOrbits.length - 1, Math.ceil((deferredScrollPosition + (scrollRef.current?.clientWidth || 0)) / ITEM_WIDTH) + PRELOAD_RANGE);
    return { startIndex, endIndex };
  }, [deferredScrollPosition, safeOrbits.length]);
  
  // Décider si on virtualise
  const shouldVirtualize = safeOrbits.length > VIRTUALIZATION_THRESHOLD;
  
  // Items visibles (virtualisés ou non)
  const visibleOrbits = useMemo(() => {
    if (shouldVirtualize) {
      return safeOrbits.slice(visibleIndices.startIndex, visibleIndices.endIndex + 1);
    }
    return safeOrbits;
  }, [shouldVirtualize, safeOrbits, visibleIndices]);
  
  const currentUser = user;
  const isLoading = externalLoading || internalLoading;
  
 // =============================
  // SCROLL (VRAI SCROLL HORIZONTAL)
  // =============================
  const scrollTo = useCallback((direction) => {
    if (!scrollRef.current) return;
    
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    const newScrollLeft = direction === 'left' 
      ? scrollRef.current.scrollLeft - scrollAmount
      : scrollRef.current.scrollLeft + scrollAmount;
    
    scrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  }, []);
  
  // Gestion du swipe
  useSwipe(scrollRef, scrollTo);
  
  // =============================
  // PRÉCHARGEMENT INTELLIGENT (Intersection Observer)
  // =============================
  useEffect(() => {
    if (!onPreload || !scrollRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = entry.target.getAttribute('data-index');
            if (index) {
              const orbit = safeOrbits[parseInt(index)];
              if (orbit && !preloadedOrbitIds.has(orbit.userId)) {
                // Smart preloading basé sur le réseau
                const shouldPreload = networkType === 'fast' || Math.random() > 0.5;
                if (shouldPreload) {
                  startTransition(() => {
                    setPreloadedOrbitIds(prev => {
                      const next = new Set(prev);
                      next.add(orbit.userId);
                      return next;
                    });
                    onPreload(orbit);
                  });
                }
              }
            }
          }
        });
      },
      { root: scrollRef.current, rootMargin: networkType === 'fast' ? '200px' : '100px' }
    );
    
    const items = scrollRef.current.querySelectorAll('[data-story-circle]');
    items.forEach(item => observer.observe(item));
    
    return () => {
      items.forEach(item => observer.unobserve(item));
      observer.disconnect();
    };
  }, [safeOrbits, onPreload, preloadedOrbitIds, networkType]);
  
  // =============================
  // CHARGEMENT SIMULÉ
  // =============================
  useEffect(() => {
    if (safeOrbits.length === 0 && !externalLoading && !internalLoading) {
      setInternalLoading(true);
      const timer = setTimeout(() => {
        setInternalLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [safeOrbits.length, externalLoading]);
  
  // =============================
  // GESTION DES CLICS
  // =============================
  const handleStorySelect = useCallback((orbit) => {
    if (onStorySelect) {
      onStorySelect(orbit);
    }
  }, [onStorySelect]);
  
  const handleAddStory = useCallback(() => {
    if (onAddStory) {
      onAddStory();
    }
  }, [onAddStory]);
  
  // Calcul de la pagination (corrigé)
  const currentIndex = Math.round(deferredScrollPosition / ITEM_WIDTH);
  const currentPage = Math.floor(currentIndex / VISIBLE_ITEMS);
  const totalPages = Math.ceil(safeOrbits.length / VISIBLE_ITEMS);
  
  // =============================
  // RENDU
  // =============================
  if (isLoading) {
    return <StoryCarouselSkeleton />;
  }
  
  if (safeOrbits.length === 0 && !currentUser) {
    return (
      <div className="bg-black py-8 px-4 border-b border-white/10">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-white/60 text-sm">Aucune story disponible</p>
          <p className="text-white/40 text-xs mt-1">Les stories de vos amis apparaîtront ici</p>
        </div>
      </div>
    );
  }
  
  // Ajouter un offset pour la virtualisation
  const virtualOffset = shouldVirtualize ? visibleIndices.startIndex * ITEM_WIDTH : 0;
  
  return (
    <div 
      className="relative bg-black py-4 border-b border-white/10"
      role="region"
      aria-label="Carrousel de stories"
    >
      <div className="relative">
        {/* Bouton gauche */}
        <button
          onClick={() => scrollTo('left')}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
            scrollPosition <= 10 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-label="Stories précédentes"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        
        {/* Scroll horizontal natif */}
        <div 
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 px-8 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          role="list"
          aria-label="Liste des stories"
        >
          {/* Ajouter une story */}
          {currentUser && (
            <div className="snap-start flex-shrink-0" data-story-circle>
              <AddStoryCircle onClick={handleAddStory} />
            </div>
          )}
          
          {/* Stories des utilisateurs avec virtualisation */}
          <div 
            className="flex gap-3"
            style={shouldVirtualize ? { transform: `translateX(${virtualOffset}px)`, willChange: 'transform' } : {}}
          >
            {visibleOrbits.map((orbit, idx) => {
              const globalIndex = shouldVirtualize ? visibleIndices.startIndex + idx : idx;
              return (
                <div 
                  key={orbit.userId} 
                  className="snap-start flex-shrink-0"
                  data-story-circle
                  data-index={globalIndex}
                  role="listitem"
                >
                  <UserStoryCircle
                    orbit={orbit}
                    onClick={handleStorySelect}
                    priority={globalIndex < VISIBLE_ITEMS}
                  />
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Bouton droit */}
        <button
          onClick={() => scrollTo('right')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
            scrollPosition >= (scrollRef.current?.scrollWidth || 0) - (scrollRef.current?.clientWidth || 0) - 10 
              ? 'opacity-0 pointer-events-none' 
              : 'opacity-100'
          }`}
          aria-label="Stories suivantes"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {/* Indicateur de pagination */}
      {totalPages > 1 && (
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-4 rounded-full transition-all duration-200 ${
                i === Math.min(currentPage, totalPages - 1) ? 'bg-cyan-500' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Indicateur de scroll (feedback) */}
      {isScrolling && (
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/50 rounded-full px-2 py-0.5">
            <span className="text-white/60 text-xs">◀ ▶</span>
          </div>
        </div>
      )}
      
      {/* Indicateur de réseau (optionnel) */}
      {networkType === 'slow' && safeOrbits.length > 10 && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-1">
          <div className="bg-black/50 rounded-full px-2 py-0.5">
            <span className="text-white/40 text-[10px]">📶 Connexion lente</span>
          </div>
        </div>
      )}
    </div>
  );
};

StoryCircleRing.propTypes = {
  storiesCount: PropTypes.number,
  isViewed: PropTypes.bool,
  size: PropTypes.number,
  animate: PropTypes.bool
};

AddStoryCircle.propTypes = {
  onClick: PropTypes.func.isRequired
};

UserStoryCircle.propTypes = {
  orbit: PropTypes.shape({
    userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    userName: PropTypes.string,
    userAvatar: PropTypes.string,
    thumbnailUrl: PropTypes.string,
    storyCount: PropTypes.number,
    isViewed: PropTypes.bool
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  priority: PropTypes.bool
};

StoryCarousel.propTypes = {
  storyOrbits: PropTypes.arrayOf(
    PropTypes.shape({
      userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      userName: PropTypes.string,
      userAvatar: PropTypes.string,
      thumbnailUrl: PropTypes.string,
      storyCount: PropTypes.number,
      isViewed: PropTypes.bool
    })
  ),
  onStorySelect: PropTypes.func,
  onPreload: PropTypes.func,
  onAddStory: PropTypes.func,
  isLoading: PropTypes.bool
};

export default StoryCarousel;
StoryCarouselSkeleton.propTypes = {};
