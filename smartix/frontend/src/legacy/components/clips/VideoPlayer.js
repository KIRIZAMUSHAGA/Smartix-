// src/components/clips/VideoPlayer.js
import React, { forwardRef, useEffect } from 'react';
import { WifiOff, Play } from 'lucide-react';
import useVideoPlayer from '../../hooks/useVideoPlayer';
// (chemin inchangé : on est passé de src/components/clips/ → src/legacy/components/clips/
//  et src/hooks/useVideoPlayer → src/legacy/hooks/useVideoPlayer, donc même profondeur relative)

// =============================
// CONSTANTES
// =============================
const MAX_GLOBAL_PRELOADS = 2;

// =============================
// GLOBAL PRELOAD MANAGER (Avec cleanup)
// =============================
let globalPreloadQueue = [];
let activePreloads = 0;
let preloadElements = new Set();

const cleanupPreloadElement = (element) => {
  if (element) {
    element.src = '';
    element.load();
    element.remove();
    preloadElements.delete(element);
  }
};

const startPreload = (task) => {
  activePreloads++;
  const { src, resolve } = task;
  
  const tempVideo = document.createElement('video');
  tempVideo.preload = 'auto';
  tempVideo.src = src;
  preloadElements.add(tempVideo);
  
  const cleanup = () => {
    cleanupPreloadElement(tempVideo);
    activePreloads--;
    if (globalPreloadQueue.length > 0) {
      startPreload(globalPreloadQueue.shift());
    }
    resolve();
  };
  
  tempVideo.oncanplay = cleanup;
  tempVideo.onerror = cleanup;
  
  // Timeout de sécurité (10 secondes)
  setTimeout(cleanup, 10000);
};

const requestPreload = (src) => {
  return new Promise((resolve) => {
    const task = { src, resolve };
    
    if (activePreloads < MAX_GLOBAL_PRELOADS) {
      startPreload(task);
    } else {
      globalPreloadQueue.push(task);
    }
  });
};

// =============================
// COMPOSANT PRINCIPAL (AVEC FORWARDREF)
// =============================
const VideoPlayer = forwardRef(({ 
  src, 
  index, 
  currentIndex, 
  muted, 
  onProgress, 
  isOnline 
}, externalRef) => {
  const isActive = index === currentIndex;
  const isNext = index === currentIndex + 1;
  
  // Utilisation du hook useVideoPlayer
  const {
    videoRef,
    error,
    loaded,
    buffering,
    needsInteraction,
    isSlowNetwork,
    handleUserInteraction,
    resetAndRetry
  } = useVideoPlayer({
    src,
    isActive,
    muted,
    onProgress,
    isOnline
  });
  
  // Forward ref vers l'extérieur (SmartClips)
  useEffect(() => {
    if (externalRef) {
      externalRef.current = videoRef.current;
    }
  }, [externalRef, videoRef.current]);
  
  // Préchargement global contrôlé (uniquement pour la vidéo suivante)
  useEffect(() => {
    if (isNext && !isSlowNetwork && src) {
      requestPreload(src);
    }
  }, [isNext, src, isSlowNetwork]);
  
  // =============================
  // RENDU
  // =============================
  if (error) {
    return (
      <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <WifiOff className="w-12 h-12 text-white/40 mb-3" />
        <p className="text-center mb-2">❌ Vidéo indisponible</p>
        <p className="text-sm text-gray-400 text-center mb-4">
          {isOnline ? 'Erreur de chargement' : 'Mode hors-ligne'}
        </p>
        {isOnline && (
          <button 
            onClick={resetAndRetry}
            className="px-4 py-2 bg-[#005CFF] rounded-lg text-sm hover:bg-[#0044CC] transition-colors"
          >
            Réessayer
          </button>
        )}
      </div>
    );
  }
  
  return (
    <>
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        playsInline
        muted={muted}
        preload={isActive ? 'auto' : 'metadata'}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease' }}
      />
      
      {/* Indicateur de buffer */}
      {buffering && isActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Mise en mémoire tampon...
          </div>
        </div>
      )}
      
      {/* Indicateur hors-ligne */}
      {!isOnline && !loaded && isActive && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20">
          <WifiOff className="w-12 h-12 text-white/60 mb-3" />
          <p className="text-white/80 text-sm">Hors-ligne - Vidéo non disponible</p>
        </div>
      )}
      
      {/* Indicateur réseau lent */}
      {isSlowNetwork && isActive && !loaded && !error && (
        <div className="absolute bottom-4 left-4 z-20">
          <div className="bg-black/50 backdrop-blur-md text-white/60 text-xs px-2 py-1 rounded-full">
            📶 Réseau lent - qualité adaptée
          </div>
        </div>
      )}
      
      {/* Bouton de lecture manuelle (Tap to play) */}
      {isActive && needsInteraction && !loaded && !buffering && !error && (
        <button
          onClick={handleUserInteraction}
          className="absolute inset-0 flex items-center justify-center z-20 bg-black/30 hover:bg-black/40 transition-colors"
          aria-label="Lire la vidéo"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-110">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </button>
      )}
    </>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
