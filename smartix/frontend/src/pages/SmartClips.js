// src/pages/SmartClips.js
import React, { useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Bookmark, UserPlus, Music2, Volume2, VolumeX, Plus, WifiOff } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';

// Composants découpés
import CommentSection from '../components/clips/CommentSection';
import ClipOptionsMenu from '../components/clips/ClipOptionsMenu';
import VideoPlayer from '../legacy/components/clips/VideoPlayer';
import CommentsModal from '../components/modals/CommentsModal';

// Hooks personnalisés
import useOnlineStatus from '../hooks/useOnlineStatus';
import useClips from '../hooks/useClips';
import useTouchGestures from '../hooks/useTouchGestures';
import { useVideoController } from '../legacy/hooks/useVideoController';
import PropTypes from 'prop-types';

// Migration single-player (Phase 2) - utilisés uniquement si FEATURES.USE_SINGLE_PLAYER === true
import { FEATURES } from '../config/features';
import VideoSlot from '../components/video/VideoSlot';
import VideoViewport from '../components/video/VideoViewport';
import { useVideoEngine } from '../hooks/useVideoEngine';
import { videoEngine } from '../lib/video/VideoEngine';
import '../styles/video.css';

// =============================
// CONSTANTES
// =============================
const PRELOAD_RANGE = 2;
const UNLOAD_RANGE = 3;
const SCROLL_THROTTLE_MS = 16;

// =============================
// HOOK: VISIBILITY API
// =============================
const useVisibilityPause = (videoElement, isActive) => {
  useEffect(() => {
    if (!videoElement || !isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        videoElement.pause();
      } else {
        videoElement.play().catch(() => {
          // Autoplay bloqué, afficher un toast
          toast.info("Touchez pour activer le son ou lancer la vidéo", { duration: 2000 });
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [videoElement, isActive]);
};

// =============================
// HOOK: SCROLL AVEC THROTTLE
// =============================
const useThrottledScroll = (onScroll, deps = []) => {
  const tickingRef = useRef(false);
  const lastIndexRef = useRef(-1);

  const handleScroll = useCallback((e) => {
    if (!tickingRef.current) {
      window.requestAnimationFrame(() => {
        onScroll(e);
        tickingRef.current = false;
      });
      tickingRef.current = true;
    }
  }, [onScroll]);

  return handleScroll;
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SmartClips = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [commentsModal, setCommentsModal] = useState({ 
    show: false, 
    clipId: null 
  });
  const [progress, setProgress] = useState(0);
  
  // Refs
  const videoRefs = useRef([]);
  const containerRef = useRef(null);
  const videoControllersRef = useRef({});
  const lastScrollTimeRef = useRef(0);
  const isScrollingRef = useRef(false);
  
  // Hooks personnalisés
  const isOnline = useOnlineStatus({ enableToasts: false });
  const {
    clips,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    handleLike,
    handleSave,
    handleFollow,
    handleDownload,
    updateCommentCount,
    isValidVideoUrl,
    getClipById
  } = useClips({ user, isOnline });

  // =============================
  // WITH AUTH HELPER
  // =============================
  const withAuth = useCallback((callback) => () => {
    if (!user) {
      toast.error('Connectez-vous pour interagir');
      navigate('/login');
      return;
    }
    callback();
  }, [user, navigate]);

  // =============================
  // Gestion des gestes tactiles
  // =============================
  const currentClipId = clips[currentIndex]?.id;
  const gestureHandlers = useTouchGestures({
    containerRef,
    videoController: videoControllersRef.current[currentClipId],
    immersiveMode,
    setImmersiveMode,
    onNext: () => {
      if (currentIndex < clips.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setProgress(0);
      }
    },
    onPrevious: () => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setProgress(0);
      }
    },
    enableHaptic: true,
    enableToasts: true,
    onToast: (msg) => toast.info(msg)
  });

  // =============================
  // Chargement initial
  // =============================
  useEffect(() => {
    refresh();
    return () => {
      // Nettoyer toutes les vidéos et les contrôleurs
      Object.values(videoControllersRef.current).forEach(controller => {
        if (controller && typeof controller.destroy === 'function') {
          controller.destroy();
        }
      });
      videoControllersRef.current = {};
      videoRefs.current = [];
    };
  }, [refresh]);

  // =============================
  // Mise à jour des contrôleurs vidéo
  // =============================
  useEffect(() => {
    clips.forEach((clip, index) => {
      if (clip && !videoControllersRef.current[clip.id]) {
        const videoElement = videoRefs.current[index];
        if (videoElement) {
          videoControllersRef.current[clip.id] = {
            play: () => videoElement.play(),
            pause: () => videoElement.pause(),
            isPlaying: () => !videoElement.paused,
            getCurrentTime: () => videoElement.currentTime,
            getDuration: () => videoElement.duration,
            destroy: () => {
              videoElement.pause();
              videoElement.src = '';
              videoElement.load();
              // Nettoyer les listeners
              videoElement.onplay = null;
              videoElement.onpause = null;
              videoElement.onended = null;
              videoElement.onerror = null;
            }
          };
        }
      }
    });
  }, [clips]);

  // =============================
  // Lecture vidéo avec gestion hors-ligne et autoplay
  // =============================
  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    const currentClip = clips[currentIndex];
    
    if (!currentVideo || !currentClip) return;
    
    if (isOnline && isValidVideoUrl(currentClip.video_url)) {
      // Nettoyer les vidéos hors écran (au-delà de UNLOAD_RANGE)
      videoRefs.current.forEach((video, idx) => {
        if (Math.abs(idx - currentIndex) > UNLOAD_RANGE && video && video.src) {
          video.pause();
          video.src = '';
          video.load();
        }
      });

      // Préchargement intelligent des vidéos suivantes
      for (let i = 1; i <= PRELOAD_RANGE; i++) {
        const nextVideo = videoRefs.current[currentIndex + i];
        const nextClip = clips[currentIndex + i];
        if (nextVideo && nextClip && isValidVideoUrl(nextClip.video_url) && !nextVideo.src) {
          nextVideo.load();
        }
      }

      // Mise en pause des vidéos non actives
      videoRefs.current.forEach((video, idx) => {
        if (idx !== currentIndex && video && !video.paused) {
          video.pause();
          video.currentTime = 0;
        }
      });

      // Lecture de la vidéo courante
      const playPromise = currentVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => { 
          if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') { 
            console.warn('Erreur lecture:', err);
            // Afficher un toast pour l'autoplay bloqué
            if (err.name === 'NotAllowedError') {
              toast.info("Touchez pour activer le son ou lancer la vidéo", { duration: 2000 });
            }
          }
        });
      }
    } else if (!isOnline) {
      // Hors-ligne: afficher un message
      toast.error('Vidéo indisponible hors-ligne', { duration: 2000 });
    }
  }, [currentIndex, isOnline, clips, isValidVideoUrl]);

  // =============================
  // Visibility API (pause si onglet caché)
  // =============================
  const currentVideo = videoRefs.current[currentIndex];
  useVisibilityPause(currentVideo, true);

  // =============================
  // Mise à jour de la progression
  // =============================
  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;
    
    let rafId = null;
    
    const updateProgress = () => {
      if (currentVideo.duration > 0 && !currentVideo.paused) {
        setProgress((currentVideo.currentTime / currentVideo.duration) * 100);
      }
      rafId = requestAnimationFrame(updateProgress);
    };
    
    rafId = requestAnimationFrame(updateProgress);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [currentIndex]);

  // =============================
  // Scroll avec throttling
  // =============================
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    const windowHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / windowHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < clips.length) {
      setCurrentIndex(newIndex);
      setProgress(0);
    }

    // Charger plus de clips avec debounce
    if (!loadingMore && hasMore && isOnline) {
      const scrollBottom = e.target.scrollTop + windowHeight;
      const scrollHeight = e.target.scrollHeight;
      if (scrollHeight - scrollBottom <= windowHeight * 2) {
        const now = Date.now();
        if (now - lastScrollTimeRef.current > 500) {
          lastScrollTimeRef.current = now;
          loadMore();
        }
      }
    }
  }, [currentIndex, loadingMore, hasMore, isOnline, clips.length, loadMore]);

  const throttledScroll = useThrottledScroll(handleScroll, [currentIndex]);

  // =============================
  // Double tap like
  // =============================
  const handleDoubleTap = useCallback((e) => {
    const target = e.target;
    // Vérifier que le double tap n'est pas sur un bouton interactif
    const isInteractive = target?.closest?.('button, a, [role="button"], .interactive');
    if (!isInteractive && clips[currentIndex]) {
      handleLike(clips[currentIndex].id);
      toast.success('❤️', { duration: 500, icon: '❤️' });
    }
  }, [clips, currentIndex, handleLike]);

  // =============================
  // Smart buffering indicator
  // =============================
  const [isBuffering, setIsBuffering] = useState(false);
  
  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;
    
    const checkBuffering = () => {
      // readyState < 3 = en train de charger
      const isBufferingState = currentVideo.readyState < 3 && !currentVideo.paused;
      setIsBuffering(isBufferingState);
    };
    
    currentVideo.addEventListener('waiting', checkBuffering);
    currentVideo.addEventListener('playing', () => setIsBuffering(false));
    currentVideo.addEventListener('canplay', () => setIsBuffering(false));
    
    return () => {
      currentVideo.removeEventListener('waiting', checkBuffering);
      currentVideo.removeEventListener('playing', () => setIsBuffering(false));
      currentVideo.removeEventListener('canplay', () => setIsBuffering(false));
    };
  }, [currentIndex]);

  // =============================
  // Loader
  // =============================
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0A0A0A] to-[#1A1A2E] flex flex-col items-center justify-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#005CFF] to-[#44B0FF] blur-3xl opacity-50 animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#005CFF] to-[#44B0FF] flex items-center justify-center shadow-2xl animate-bounce">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">SmartClips</h2>
        <p className="text-white/60 text-sm mb-8">Chargement de vos vidéos...</p>
        <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#005CFF] to-[#44B0FF] rounded-full animate-loading"></div>
        </div>
        <style>{`
          @keyframes loading {
            0% { width: 0%; margin-left: 0%; }
            50% { width: 75%; margin-left: 12.5%; }
            100% { width: 0%; margin-left: 100%; }
          }
          .animate-loading {
            animation: loading 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  // Empty state
  if (!loading && clips.length === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0A0A0A] via-[#1A1A2E] to-[#16213E] flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#005CFF]/20 to-[#44B0FF]/20 flex items-center justify-center">
            <svg className="w-16 h-16 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Aucun SmartClip</h2>
          <p className="text-white/60 mb-8 max-w-md">Soyez le premier à créer un SmartClip et partagez-le avec la communauté !</p>
          <button
            onClick={() => navigate('/create-story')}
            className="px-8 py-4 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-2xl hover:shadow-[#005CFF]/50 text-white rounded-full font-semibold text-lg transition-all transform hover:scale-105"
          >
            Créer mon premier SmartClip
          </button>
        </div>
      </div>
    );
  }

  // =============================
  // Mode single-player (Phase 3) : actif quand FEATURES.USE_SINGLE_PLAYER === true
  // Reproduit toutes les fonctionnalités du legacy avec un seul <video>.
  // L'ancien rendu ci-dessous reste intact comme fallback.
  // =============================
  if (FEATURES.USE_SINGLE_PLAYER) {
    return (
      <SingleSmartClips
        clips={clips}
        isOnline={isOnline}
        user={user}
        navigate={navigate}
        loadingMore={loadingMore}
        hasMore={hasMore}
        loadMore={loadMore}
        handleLike={handleLike}
        handleSave={handleSave}
        handleFollow={handleFollow}
        handleDownload={handleDownload}
        updateCommentCount={updateCommentCount}
        commentsModal={commentsModal}
        setCommentsModal={setCommentsModal}
      />
    );
  }

  // Main render
  return (
    <div className="fixed inset-0 bg-[#0A0A0A] overflow-hidden">
      {/* Indicateur de connexion global */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-600/90 text-white text-center py-1 text-sm z-50 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Mode hors-ligne - Certaines actions sont désactivées
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={throttledScroll}
        onDoubleClick={handleDoubleTap}
        {...gestureHandlers}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            className="relative h-screen w-full snap-start snap-always flex items-center justify-center"
          >
            {/* Video Player */}
            <VideoPlayer
              ref={el => videoRefs.current[index] = el}
              src={isValidVideoUrl(clip.video_url) ? clip.video_url : ''}
              index={index}
              currentIndex={currentIndex}
              muted={muted}
              onProgress={() => {}} // La progression est gérée séparément
              isOnline={isOnline}
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none" />

            {/* Progress Bar */}
            {index === currentIndex && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-20">
                <div
                  className="h-full bg-gradient-to-r from-[#005CFF] to-[#44B0FF] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Buffering Indicator (smart) */}
            {isBuffering && index === currentIndex && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                <div className="bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Chargement...
                </div>
              </div>
            )}

            {/* Top Bar */}
            <div className={`absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 transition-opacity duration-300 ${immersiveMode ? 'opacity-0' : 'opacity-100'}`}>
              <button onClick={() => navigate('/feed')} className="text-white text-xl font-bold drop-shadow-lg flex items-center gap-2">
                SmartClips
                {!isOnline && <WifiOff className="w-4 h-4 text-yellow-400" />}
              </button>
              <button
                onClick={() => isOnline ? navigate('/create-story') : toast.error('Création impossible hors-ligne')}
                className={`px-5 py-2.5 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-lg hover:shadow-[#005CFF]/50 text-white rounded-full font-semibold transition-all flex items-center gap-2 ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!isOnline}
              >
                <Plus className="w-5 h-5" />
                Créer
              </button>
            </div>

            {/* Mute Button */}
            <button
              onClick={() => setMuted(!muted)}
              className={`absolute top-20 right-4 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center z-10 transition-opacity duration-300 ${immersiveMode ? 'opacity-0' : 'opacity-100'}`}
            >
              {muted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>

            {/* Author Info */}
            <div className={`absolute bottom-24 left-4 right-20 z-10 transition-opacity duration-300 ${immersiveMode ? 'opacity-0' : 'opacity-100'}`}>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => navigate(`/profile/${clip.author?.id}`)} className="flex items-center gap-2">
                  <Avatar className="w-10 h-10 ring-2 ring-white/50">
                    <AvatarImage src={clip.author?.avatar} loading="lazy" />
                    <AvatarFallback>{clip.author?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="text-white font-semibold drop-shadow-lg">{clip.author?.name}</span>
                </button>
                
                {!clip.author?.following && user && user.id !== clip.author?.id && isOnline && (
                  <button
                    onClick={() => handleFollow(clip.author.id)}
                    className="px-4 py-1.5 bg-[#005CFF] hover:bg-[#0044CC] text-white rounded-full text-sm font-semibold transition-all"
                  >
                    Suivre
                  </button>
                )}
              </div>

              {clip.description && (
                <p className="text-white text-sm mb-2 drop-shadow-lg line-clamp-2">{clip.description}</p>
              )}

              {clip.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {clip.hashtags.map((tag, idx) => (
                    <span key={idx} className="text-[#44B0FF] text-sm font-semibold drop-shadow-lg">#{tag}</span>
                  ))}
                </div>
              )}

              {clip.sound && (
                <button className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full hover:bg-black/40 transition-all">
                  <Music2 className="w-4 h-4 text-white animate-pulse" />
                  <span className="text-white text-sm truncate max-w-[180px]">{clip.sound.name}</span>
                </button>
              )}
            </div>

            {/* Action Bar */}
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10 transition-opacity duration-300 ${immersiveMode ? 'opacity-0' : 'opacity-100'}`}>
              
              {/* Avatar + Follow */}
              <button 
                onClick={() => navigate(`/profile/${clip.author?.id}`)} 
                className="relative group mb-2"
              >
                <Avatar className="w-14 h-14 ring-2 ring-white group-hover:ring-[#005CFF] transition-all">
                  <AvatarImage src={clip.author?.avatar} loading="lazy" />
                  <AvatarFallback className="bg-gradient-to-br from-[#005CFF] to-[#44B0FF] text-white">
                    {clip.author?.name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!clip.author?.following && user && user.id !== clip.author?.id && isOnline && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-[#005CFF] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    <UserPlus className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>

              {/* LIKE */}
              <button 
                onClick={withAuth(() => handleLike(clip.id))} 
                className="flex flex-col items-center gap-1 group"
                disabled={!isOnline}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform ${
                  clip.liked 
                    ? 'bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/50 scale-110' 
                    : 'bg-white/20 backdrop-blur-md group-hover:bg-white/30 group-hover:scale-110'
                } ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Heart className={`w-7 h-7 transition-all ${clip.liked ? 'fill-white text-white animate-pulse' : 'text-white'}`} />
                </div>
                <span className="text-white text-xs font-bold drop-shadow-lg">
                  {clip.likes > 0 ? clip.likes : ''}
                  {!isOnline && <span className="text-xs ml-1 text-yellow-400">⛔</span>}
                </span>
              </button>

              {/* COMMENTS */}
              <button 
                onClick={withAuth(() => {
                  if (!isOnline) {
                    toast.error('Commentaires indisponibles hors-ligne');
                    return;
                  }
                  setCommentsModal({ show: true, clipId: clip.id });
                })} 
                className="flex flex-col items-center gap-1 group"
                disabled={!isOnline}
              >
                <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-md group-hover:bg-white/30 group-hover:scale-110 flex items-center justify-center transition-all ${!isOnline ? 'opacity-50' : ''}`}>
                  <MessageCircle className="w-7 h-7 text-white" />
                </div>
                <span className="text-white text-xs font-bold drop-shadow-lg">
                  {clip.comments_count > 0 ? clip.comments_count : ''}
                </span>
              </button>

              {/* SAVE */}
              <button 
                onClick={withAuth(() => handleSave(clip.id))} 
                className="flex flex-col items-center gap-1 group"
                disabled={!isOnline}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform ${
                  clip.saved 
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/50 scale-110' 
                    : 'bg-white/20 backdrop-blur-md group-hover:bg-white/30 group-hover:scale-110'
                } ${!isOnline ? 'opacity-50' : ''}`}>
                  <Bookmark className={`w-7 h-7 ${clip.saved ? 'fill-white text-white' : 'text-white'}`} />
                </div>
              </button>

              {/* MENU */}
              <ClipOptionsMenu clip={clip} handleDownload={handleDownload} user={user} isOnline={isOnline} />
            </div>

            {/* Loading More Indicator */}
            {loadingMore && index === clips.length - 1 && (
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20">
                <div className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Chargement...
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* COMMENTS MODAL */}
      <CommentsModal 
        show={commentsModal.show}
        clipId={commentsModal.clipId}
        onClose={() => setCommentsModal({ show: false, clipId: null })}
        onCountChange={(data) => updateCommentCount(commentsModal.clipId, data.action === 'add' ? 'increment' : 'decrement')}
      />
    </div>
  );
};

SmartClips.propTypes = {};

// =============================
// PHASE 3 - Mode single-player COMPLET
// Reproduit toutes les fonctionnalités du legacy avec un seul <video> :
//  - top bar (logo, créer)
//  - mute / unmute
//  - barre de progression
//  - infos auteur (avatar, nom, suivre, description, hashtags, son)
//  - action bar (like, comments, save, options)
//  - double-tap like
//  - gestes tactiles + immersive mode
//  - commentaires modal
//  - infinite scroll (loadMore)
//  - autoplay clip suivant à la fin
// =============================
const SingleSmartClips = ({
  clips,
  isOnline,
  user,
  navigate,
  loadingMore,
  hasMore,
  loadMore,
  handleLike,
  handleSave,
  handleFollow,
  handleDownload,
  updateCommentCount,
  commentsModal,
  setCommentsModal
}) => {
  const [activeClip, setActiveClip] = useState(null);
  const [activeSlotEl, setActiveSlotEl] = useState(null);
  const [muted, setMuted] = useState(true);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(null); // {x, y, key}

  const slotRefs = useRef({});
  const containerRef = useRef(null);
  const lastLoadMoreRef = useRef(0);

  const activeSlotRef = useMemo(() => ({ current: activeSlotEl }), [activeSlotEl]);
  const activeIndex = useMemo(
    () => clips.findIndex((c) => c.id === activeClip?.id),
    [clips, activeClip]
  );

  // ----- Helpers -----
  const withAuth = useCallback(
    (cb) => () => {
      if (!user) {
        toast.error('Connectez-vous pour interagir');
        navigate('/login');
        return;
      }
      cb();
    },
    [user, navigate]
  );

  const setSlotRef = useCallback(
    (id) => (el) => {
      if (el) slotRefs.current[id] = el;
      else delete slotRefs.current[id];
    },
    []
  );

  const scrollToClip = useCallback((clipId) => {
    const el = slotRefs.current[clipId];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // ----- Activation / fin de vidéo -----
  const handleBecameActive = useCallback((clip, slotElement) => {
    if (!clip || !slotElement) return;
    setActiveClip(clip);
    setActiveSlotEl(slotElement);
  }, []);

  const handleVideoEnd = useCallback(() => {
    if (activeIndex < 0) return;
    const next = clips[activeIndex + 1];
    if (next) scrollToClip(next.id);
  }, [activeIndex, clips, scrollToClip]);

  // ----- Infinite scroll : déclencher loadMore quand on approche du bas -----
  const onScroll = useCallback(
    (e) => {
      if (!hasMore || loadingMore || !isOnline) return;
      const el = e.target;
      const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (remaining < window.innerHeight * 2) {
        const now = Date.now();
        if (now - lastLoadMoreRef.current > 500) {
          lastLoadMoreRef.current = now;
          loadMore();
        }
      }
    },
    [hasMore, loadingMore, isOnline, loadMore]
  );

  // ----- Double tap -> like + petit cœur animé -----
  const triggerDoubleTapHeart = useCallback(
    (x, y) => {
      if (!activeClip) return;
      handleLike(activeClip.id);
      setDoubleTapHeart({ x, y, key: Date.now() });
      setTimeout(() => setDoubleTapHeart(null), 800);
    },
    [activeClip, handleLike]
  );

  const handleDoubleClick = useCallback(
    (e) => {
      const target = e.target;
      const isInteractive = target?.closest?.('button, a, [role="button"], .interactive');
      if (isInteractive) return;
      const rect = e.currentTarget.getBoundingClientRect();
      triggerDoubleTapHeart(e.clientX - rect.left, e.clientY - rect.top);
    },
    [triggerDoubleTapHeart]
  );

  // ----- Gestes tactiles -----
  const gestureHandlers = useTouchGestures({
    onDoubleTap: ({ x, y }) => {
      const rect = containerRef.current?.getBoundingClientRect();
      triggerDoubleTapHeart(x - (rect?.left || 0), y - (rect?.top || 0));
    },
    onSingleTap: () => setImmersiveMode((v) => !v),
    onLongPress: () => {
      // Pause directe via le singleton VideoEngine
      if (videoEngine && typeof videoEngine.pause === 'function') {
        videoEngine.pause();
      }
    }
  });

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] overflow-hidden">
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-600/90 text-white text-center py-1 text-sm z-50 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Mode hors-ligne - Certaines actions sont désactivées
        </div>
      )}

      {/* Viewport unique : pas de chrome interne (mute/progress fournis par chaque slot) */}
      <VideoViewport
        activeSlotRef={activeSlotRef}
        activeClip={activeClip}
        muted={muted}
        loop={false}
        onVideoEnd={handleVideoEnd}
        showMuteButton={false}
        showProgressBar={false}
      />

      <div
        ref={containerRef}
        onScroll={onScroll}
        onDoubleClick={handleDoubleClick}
        {...gestureHandlers}
        className="clips-list h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {clips.map((clip, index) => {
          const isCurrent = activeClip?.id === clip.id;
          return (
            <VideoSlot
              key={clip.id}
              clip={clip}
              isActive={isCurrent}
              onBecameActive={handleBecameActive}
              slotRef={setSlotRef(clip.id)}
              hideDefaultInfo
            >
              {/* ===== Overlays (au-dessus de la vidéo) ===== */}

              {/* Gradient bas */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 pointer-events-none"
                style={{ zIndex: 6 }}
              />

              {/* Progress bar (uniquement sur le clip actif) */}
              {isCurrent && (
                <ActiveProgressBar />
              )}

              {/* Top bar */}
              <div
                className={`absolute top-0 left-0 right-0 p-4 flex items-center justify-between transition-opacity duration-300 ${
                  immersiveMode ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ zIndex: 12 }}
              >
                <button
                  onClick={() => navigate('/feed')}
                  className="text-white text-xl font-bold drop-shadow-lg flex items-center gap-2 interactive"
                >
                  SmartClips
                  {!isOnline && <WifiOff className="w-4 h-4 text-yellow-400" />}
                </button>
                <button
                  onClick={() =>
                    isOnline
                      ? navigate('/create-story')
                      : toast.error('Création impossible hors-ligne')
                  }
                  className={`px-5 py-2.5 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-lg hover:shadow-[#005CFF]/50 text-white rounded-full font-semibold transition-all flex items-center gap-2 interactive ${
                    !isOnline ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={!isOnline}
                >
                  <Plus className="w-5 h-5" />
                  Créer
                </button>
              </div>

              {/* Mute button */}
              <button
                onClick={() => setMuted((m) => !m)}
                className={`absolute top-20 right-4 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-opacity duration-300 interactive ${
                  immersiveMode ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ zIndex: 12 }}
                aria-label={muted ? 'Activer le son' : 'Couper le son'}
              >
                {muted ? (
                  <VolumeX className="w-6 h-6 text-white" />
                ) : (
                  <Volume2 className="w-6 h-6 text-white" />
                )}
              </button>

              {/* Author info */}
              <div
                className={`absolute bottom-24 left-4 right-20 transition-opacity duration-300 ${
                  immersiveMode ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ zIndex: 11 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => navigate(`/profile/${clip.author?.id}`)}
                    className="flex items-center gap-2 interactive"
                  >
                    <Avatar className="w-10 h-10 ring-2 ring-white/50">
                      <AvatarImage src={clip.author?.avatar} loading="lazy" />
                      <AvatarFallback>{clip.author?.name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-white font-semibold drop-shadow-lg">
                      {clip.author?.name}
                    </span>
                  </button>

                  {!clip.author?.following &&
                    user &&
                    user.id !== clip.author?.id &&
                    isOnline && (
                      <button
                        onClick={() => handleFollow(clip.author.id)}
                        className="px-4 py-1.5 bg-[#005CFF] hover:bg-[#0044CC] text-white rounded-full text-sm font-semibold transition-all interactive"
                      >
                        Suivre
                      </button>
                    )}
                </div>

                {clip.description && (
                  <p className="text-white text-sm mb-2 drop-shadow-lg line-clamp-2">
                    {clip.description}
                  </p>
                )}

                {clip.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {clip.hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[#44B0FF] text-sm font-semibold drop-shadow-lg"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {clip.sound && (
                  <button className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full hover:bg-black/40 transition-all interactive">
                    <Music2 className="w-4 h-4 text-white animate-pulse" />
                    <span className="text-white text-sm truncate max-w-[180px]">
                      {clip.sound.name}
                    </span>
                  </button>
                )}
              </div>

              {/* Action bar */}
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-4 transition-opacity duration-300 ${
                  immersiveMode ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ zIndex: 11 }}
              >
                <button
                  onClick={() => navigate(`/profile/${clip.author?.id}`)}
                  className="relative group mb-2 interactive"
                >
                  <Avatar className="w-14 h-14 ring-2 ring-white group-hover:ring-[#005CFF] transition-all">
                    <AvatarImage src={clip.author?.avatar} loading="lazy" />
                    <AvatarFallback className="bg-gradient-to-br from-[#005CFF] to-[#44B0FF] text-white">
                      {clip.author?.name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!clip.author?.following &&
                    user &&
                    user.id !== clip.author?.id &&
                    isOnline && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-[#005CFF] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                        <UserPlus className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                </button>

                {/* LIKE */}
                <button
                  onClick={withAuth(() => handleLike(clip.id))}
                  className="flex flex-col items-center gap-1 group interactive"
                  disabled={!isOnline}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform ${
                      clip.liked
                        ? 'bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/50 scale-110'
                        : 'bg-white/20 backdrop-blur-md group-hover:bg-white/30 group-hover:scale-110'
                    } ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Heart
                      className={`w-7 h-7 transition-all ${
                        clip.liked ? 'fill-white text-white animate-pulse' : 'text-white'
                      }`}
                    />
                  </div>
                  <span className="text-white text-xs font-bold drop-shadow-lg">
                    {clip.likes > 0 ? clip.likes : ''}
                    {!isOnline && <span className="text-xs ml-1 text-yellow-400">⛔</span>}
                  </span>
                </button>

                {/* COMMENTS */}
                <button
                  onClick={withAuth(() => {
                    if (!isOnline) {
                      toast.error('Commentaires indisponibles hors-ligne');
                      return;
                    }
                    setCommentsModal({ show: true, clipId: clip.id });
                  })}
                  className="flex flex-col items-center gap-1 group interactive"
                  disabled={!isOnline}
                >
                  <div
                    className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-md group-hover:bg-white/30 group-hover:scale-110 flex items-center justify-center transition-all ${
                      !isOnline ? 'opacity-50' : ''
                    }`}
                  >
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-white text-xs font-bold drop-shadow-lg">
                    {clip.comments_count > 0 ? clip.comments_count : ''}
                  </span>
                </button>

                {/* SAVE */}
                <button
                  onClick={withAuth(() => handleSave(clip.id))}
                  className="flex flex-col items-center gap-1 group interactive"
                  disabled={!isOnline}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform ${
                      clip.saved
                        ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/50 scale-110'
                        : 'bg-white/20 backdrop-blur-md group-hover:bg-white/30 group-hover:scale-110'
                    } ${!isOnline ? 'opacity-50' : ''}`}
                  >
                    <Bookmark
                      className={`w-7 h-7 ${clip.saved ? 'fill-white text-white' : 'text-white'}`}
                    />
                  </div>
                </button>

                {/* MENU */}
                <ClipOptionsMenu
                  clip={clip}
                  handleDownload={handleDownload}
                  user={user}
                  isOnline={isOnline}
                />
              </div>

              {/* Loading more (sur le dernier clip) */}
              {loadingMore && index === clips.length - 1 && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2" style={{ zIndex: 13 }}>
                  <div className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Chargement...
                  </div>
                </div>
              )}

              {/* Cœur double-tap */}
              {isCurrent && doubleTapHeart && (
                <div
                  key={doubleTapHeart.key}
                  className="absolute pointer-events-none"
                  style={{
                    left: doubleTapHeart.x - 40,
                    top: doubleTapHeart.y - 40,
                    zIndex: 14,
                    animation: 'heartPop 0.8s ease-out forwards'
                  }}
                >
                  <Heart className="w-20 h-20 text-red-500 fill-red-500 drop-shadow-2xl" />
                </div>
              )}
            </VideoSlot>
          );
        })}
      </div>

      {/* Comments modal */}
      <CommentsModal
        show={commentsModal.show}
        clipId={commentsModal.clipId}
        onClose={() => setCommentsModal({ show: false, clipId: null })}
        onCountChange={(data) =>
          updateCommentCount(
            commentsModal.clipId,
            data.action === 'add' ? 'increment' : 'decrement'
          )
        }
      />

      <style>{`
        @keyframes heartPop {
          0% { transform: scale(0.5); opacity: 0; }
          30% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

SingleSmartClips.propTypes = {
  clips: PropTypes.array.isRequired,
  isOnline: PropTypes.bool,
  user: PropTypes.object,
  navigate: PropTypes.func.isRequired,
  loadingMore: PropTypes.bool,
  hasMore: PropTypes.bool,
  loadMore: PropTypes.func.isRequired,
  handleLike: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  handleFollow: PropTypes.func.isRequired,
  handleDownload: PropTypes.func.isRequired,
  updateCommentCount: PropTypes.func.isRequired,
  commentsModal: PropTypes.object.isRequired,
  setCommentsModal: PropTypes.func.isRequired
};

// Petit composant interne : barre de progression alimentée par le hook moteur
const ActiveProgressBar = () => {
  const { progress } = useVideoEngine();
  return (
    <div className="absolute top-0 left-0 right-0 h-1 bg-white/20" style={{ zIndex: 12 }}>
      <div
        className="h-full bg-gradient-to-r from-[#005CFF] to-[#44B0FF] transition-all duration-150"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
};

export default SmartClips;
