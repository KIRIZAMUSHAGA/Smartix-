import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useStoryViewer } from '../contexts/StoryViewerContext';
import { getOptimizedImageUrl } from '../config/apiClient';

// =============================
// CONSTANTES
// =============================

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;
const GAP = 16;
const MOBILE_GAP = 8;
const ASPECT_RATIO = 16 / 9; // 9:16 inversé pour hauteur/largeur

// =============================
// STORY IMAGE AVEC RETRY EXPONENTIEL
// =============================
const StoryImage = memo(({ story, index }) => {
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef(null);

  const imageUrl = useMemo(() => {
    if (error) return null;
    const originalUrl = story?.backgroundImage || story?.media_url;
    if (!originalUrl) return null;
    return getOptimizedImageUrl(originalUrl, 'story');
  }, [story, error]);

  const handleError = useCallback(() => {
    if (retryCount < 2) {
      // Retry exponentiel : 500ms, 2000ms
      const delay = retryCount === 0 ? 500 : 2000;
      
      retryTimerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(false);
      }, delay);
    } else {
      setError(true);
    }
  }, [retryCount]);

  // Nettoyage du timer
  React.useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  if (!imageUrl) {
    return (
      <div
        className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center"
        aria-label={`Image indisponible pour la story de ${story?.userName || `utilisateur ${index + 1}`}`}
      >
        <span className="text-white/40 text-sm" aria-hidden="true">📸</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`Story de ${story?.userName || 'utilisateur'}`}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={handleError}
    />
  );
});

StoryImage.displayName = 'StoryImage';

// =============================
// COMPOSANT DE CELLULE
// =============================
const Cell = memo(({ columnIndex, rowIndex, style, data }) => {
  const { stories, columnCount, gap, onStoryClick, onMouseEnter } = data;
  
  const index = rowIndex * columnCount + columnIndex;
  if (index >= stories.length) return null;

  const story = stories[index];
  const key = story?.id ?? `story-${index}`;

  // Ajuster le style avec le gap
  const adjustedStyle = {
    ...style,
    left: style.left + gap,
    top: style.top + gap,
    width: style.width - gap,
    height: style.height - gap
  };

  return (
    <div
      key={key}
      style={adjustedStyle}
      onClick={() => onStoryClick(index)}
      onMouseEnter={() => onMouseEnter(story)}
      className="aspect-[9/16] rounded-lg overflow-hidden cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-transform duration-200 relative group focus:outline-none focus:ring-2 focus:ring-cyan-500 will-change-transform"
      role="listitem"
      tabIndex={0}
      aria-label={`Story de ${story?.userName || `l'utilisateur ${index + 1}`}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStoryClick(index);
        }
      }}
    >
      <StoryImage story={story} index={index} />

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />

      {story?.music && (
        <div
          className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full text-white text-xs flex items-center gap-1"
          aria-label="Story avec musique"
        >
          <span aria-hidden="true">🎵</span>
          <span className="sr-only">Musique</span>
        </div>
      )}

      {story?.userName && (
        <div className="absolute bottom-2 left-2 right-2 text-white text-sm font-medium truncate">
          {story.userName}
        </div>
      )}
    </div>
  );
});

Cell.displayName = 'Cell';

// =============================
// STORIES FEED VIRTUALISÉ
// =============================
const StoriesFeed = memo(({ stories = [] }) => {
  const { openViewer } = useStoryViewer();
  const preloadedImages = useRef({});

  const safeStories = useMemo(() => (Array.isArray(stories) ? stories : []), [stories]);

  const handleStoryClick = useCallback((index) => {
    openViewer(safeStories, index);
  }, [safeStories, openViewer]);

  const handleMouseEnter = useCallback((story) => {
    const url = story?.backgroundImage || story?.media_url;
    if (!url || preloadedImages.current[url]) return;
    
    // Préchargement différé (requestIdleCallback si disponible)
    const preload = () => {
      const img = new Image();
      img.src = getOptimizedImageUrl(url, 'story');
      preloadedImages.current[url] = true;
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload, { timeout: 2000 });
    } else {
      setTimeout(preload, 200);
    }
  }, []);

  if (safeStories.length === 0) {
    return (
      <div
        className="p-8 text-gray-500 text-center bg-gray-50 dark:bg-gray-800 rounded-lg m-4"
        role="status"
        aria-label="Aucune story disponible"
      >
        📭 Aucune story
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', padding: GAP / 2 }}>
      <AutoSizer>
        {({ height, width }) => {
          // Déterminer le nombre de colonnes selon la largeur
          const columnCount = width < MOBILE_BREAKPOINT ? 2 
                            : width < TABLET_BREAKPOINT ? 3 
                            : 4;
          
          // Calculer la largeur de colonne et la hauteur correspondante
          const columnWidth = (width - (columnCount + 1) * GAP) / columnCount;
          const rowHeight = columnWidth * ASPECT_RATIO;
          
          const rowCount = Math.ceil(safeStories.length / columnCount);
          
          // Gap adaptatif
          const currentGap = width < MOBILE_BREAKPOINT ? MOBILE_GAP : GAP;

          return (
            <Grid
              columnCount={columnCount}
              columnWidth={columnWidth + currentGap}
              height={height}
              rowCount={rowCount}
              rowHeight={rowHeight + currentGap}
              width={width}
              itemData={{
                stories: safeStories,
                columnCount,
                gap: currentGap,
                onStoryClick: handleStoryClick,
                onMouseEnter: handleMouseEnter
              }}
            >
              {Cell}
            </Grid>
          );
        }}
      </AutoSizer>
    </div>
  );
});

StoriesFeed.propTypes = {
  stories: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    media_url: PropTypes.string,
    type: PropTypes.string,
    user: PropTypes.object
  }))
};

StoriesFeed.displayName = 'StoriesFeed';

export default StoriesFeed;
