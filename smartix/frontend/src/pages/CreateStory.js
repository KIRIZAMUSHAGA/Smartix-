import React, { useState, useRef, useEffect, Suspense, lazy, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { Type, Image as ImageIcon, X, Loader2, Video, AlertCircle } from 'lucide-react';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { normalizeStoryOrbits } from '../utils/storyNormalizer';
import PropTypes from 'prop-types';

// 🚀 LAZY LOAD HEAVY COMPONENTS avec préchargement
const ProStoryEditor = lazy(() => import('../components/ProStoryEditor'));
const TextStoryEditor = lazy(() => import('../components/TextStoryEditor'));

// =============================
// CONSTANTES
// =============================
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  quality: 0.8
};

const LOADER_TIMEOUT = 10000; // 10 secondes
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VALID_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB pour vidéo

// Cache pour les images compressées
const imageCache = new Map();

// =============================
// COMPOSANT LOADER OPTIMISÉ
// =============================
const StoryLoader = ({ message = "Chargement de l'éditeur..." }) => (
  <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center">
    <div className="text-center space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-white/80 mx-auto" />
      <p className="text-white/80 font-medium">{message}</p>
    </div>
  </div>
);

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CreateStory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { prependNewStories } = useGlobalCache();

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [selectedMediaType, setSelectedMediaType] = useState(null); // 'image' ou 'video'
  const [isLoading, setIsLoading] = useState(false);
  const [storyType, setStoryType] = useState(null); // 'text' ou 'media'
  const [loadTimeout, setLoadTimeout] = useState(false);
  
  const fileInputRef = useRef(null);
  const timeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // NETTOYAGE
  // =============================
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Nettoyer les URLs blob
      if (selectedMedia && selectedMedia.startsWith('blob:')) {
        URL.revokeObjectURL(selectedMedia);
      }
    };
  }, [selectedMedia]);

  // =============================
  // ANNULER LE TIMEOUT QUAND L'ÉDITEUR CHARGE
  // =============================
  useEffect(() => {
    if (storyType === 'text' || selectedMedia) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [storyType, selectedMedia]);

  // =============================
  // PRÉCHARGEMENT DES ÉDITEURS
  // =============================
  const preloadEditors = useCallback(() => {
    // Précharger les deux éditeurs en arrière-plan
    import('../components/ProStoryEditor');
    import('../components/TextStoryEditor');
  }, []);

  // =============================
  // GESTION DE LA SÉLECTION DE MÉDIA
  // =============================
  const handleMediaChoice = useCallback((type) => {
    setStoryType(type);
    setLoadTimeout(false);
    preloadEditors();
    
    if (type === 'media') {
      // Ouvrir le file picker immédiatement
      fileInputRef.current?.click();
    }
    
    // Timeout pour les chargements longs
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && (storyType === 'text' || !selectedMedia)) {
        setLoadTimeout(true);
      }
    }, LOADER_TIMEOUT);
  }, [preloadEditors, storyType, selectedMedia]);

  // =============================
  // VALIDATION DU FICHIER
  // =============================
  const validateFile = useCallback((file) => {
    if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };

    if (file.type.startsWith('image/')) {
      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        return { valid: false, error: 'Format image non supporté (JPEG, PNG, WebP, GIF uniquement)' };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { valid: false, error: 'L\'image est trop lourde (max 10MB)' };
      }
      return { valid: true, type: 'image' };
    }
    
    if (file.type.startsWith('video/')) {
      if (!VALID_VIDEO_TYPES.includes(file.type)) {
        return { valid: false, error: 'Format vidéo non supporté (MP4, QuickTime, WebM uniquement)' };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: 'La vidéo est trop lourde (max 50MB)' };
      }
      return { valid: true, type: 'video' };
    }
    
    return { valid: false, error: 'Format non supporté (images et vidéos uniquement)' };
  }, []);

  // =============================
  // SÉLECTION ET COMPRESSION D'IMAGE/VIDÉO
  // =============================
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setStoryType(null);
      return;
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      setStoryType(null);
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading(validation.type === 'image' ? 'Compression de l\'image...' : 'Préparation de la vidéo...');

    try {
      let mediaUrl;
      
      if (validation.type === 'image') {
        // Vérifier le cache
        const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
        if (imageCache.has(cacheKey)) {
          mediaUrl = imageCache.get(cacheKey);
        } else {
          const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
          mediaUrl = URL.createObjectURL(compressedFile);
          imageCache.set(cacheKey, mediaUrl);
        }
        setSelectedMediaType('image');
      } else {
        // Vidéo - pas de compression, juste création d'URL
        mediaUrl = URL.createObjectURL(file);
        setSelectedMediaType('video');
      }

      if (isMountedRef.current) {
        setSelectedMedia(mediaUrl);
        setIsLoading(false);
        toast.dismiss(loadingToast);
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.dismiss(loadingToast);
      
      // Fallback : utiliser l'URL originale
      if (validation.type === 'image') {
        toast.error('Compression échouée, image originale utilisée');
        const fallbackUrl = URL.createObjectURL(file);
        setSelectedMedia(fallbackUrl);
        setSelectedMediaType('image');
        setIsLoading(false);
      } else {
        toast.error('Erreur lors du chargement de la vidéo');
        setStoryType(null);
        setIsLoading(false);
      }
    }
  }, [validateFile]);

  // =============================
  // CRÉATION DE L'OBJET STORY DE BASE
  // =============================
  const createBaseStory = useCallback((id, type) => ({
    id,
    storyId: id,
    media_type: type,
    created_at: new Date().toISOString(),
    user: {
      id: user?.id,
      full_name: user?.full_name || user?.name || 'Vous',
      avatar: user?.avatar
    },
    userId: user?.id,
    userName: user?.full_name || user?.name || 'Vous',
    userAvatar: user?.avatar
  }), [user]);

  // =============================
  // PUBLICATION D'UNE STORY TEXTE
  // =============================
  const handleTextStoryPublish = useCallback(async (publishResult) => {
    if (!publishResult?.id || !user) return;

    const baseStory = createBaseStory(publishResult.id, 'text');
    const newStory = {
      ...baseStory,
      text: publishResult.text,
      style: publishResult.style,
    };

    const normalizedOrbits = normalizeStoryOrbits([newStory]);
    prependNewStories(normalizedOrbits);

    toast.success('Story publiée ! ✨', { duration: 2000 });
    navigate('/feed', { replace: true });
  }, [user, createBaseStory, prependNewStories, navigate]);

  // =============================
  // PUBLICATION D'UNE STORY MÉDIA
  // =============================
  const handleMediaStoryPublish = useCallback(async (publishResult) => {
    if (!publishResult?.id || !user) return;

    const baseStory = createBaseStory(publishResult.id, selectedMediaType === 'video' ? 'video' : 'image');
    const newStory = {
      ...baseStory,
      media_url: publishResult.media || publishResult.backgroundImage,
      backgroundImage: publishResult.backgroundImage,
      story_cover_url: publishResult.backgroundImage,
      elements: publishResult.elements || [],
      music: publishResult.music || null,
      filters: publishResult.filters || {}
    };

    const normalizedOrbits = normalizeStoryOrbits([newStory]);
    prependNewStories(normalizedOrbits);

    toast.success(`Story ${selectedMediaType === 'video' ? 'vidéo' : 'photo'} publiée ! 📸`, { duration: 2000 });
    navigate('/feed', { replace: true });
  }, [user, selectedMediaType, createBaseStory, prependNewStories, navigate]);

  // =============================
  // FERMETURE DES ÉDITEURS
  // =============================
  const handleClose = useCallback(() => {
    setSelectedMedia(null);
    setSelectedMediaType(null);
    setStoryType(null);
    navigate(-1);
  }, [navigate]);

  // =============================
  // RENDU DE L'ÉDITEUR TEXTE
  // =============================
  if (storyType === 'text') {
    return (
      <Suspense fallback={<StoryLoader message="Chargement de l'éditeur de texte..." />}>
        <TextStoryEditor
          onPublish={handleTextStoryPublish}
          onClose={handleClose}
        />
      </Suspense>
    );
  }

  // =============================
  // RENDU DE L'ÉDITEUR MÉDIA
  // =============================
  if (selectedMedia) {
    return (
      <Suspense fallback={<StoryLoader message="Chargement de l'éditeur..." />}>
        <ProStoryEditor
          onMediaSave={handleMediaStoryPublish}
          onClose={handleClose}
          initialMedia={selectedMedia}
          initialMediaType={selectedMediaType}
        />
      </Suspense>
    );
  }

  // =============================
  // CHARGEMENT (compression)
  // =============================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#00B894] mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Traitement du fichier...</p>
        </div>
      </div>
    );
  }

  // =============================
  // TIME OUT
  // =============================
  if (loadTimeout) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Chargement trop long</h2>
          <p className="text-gray-600 mb-6">L'éditeur met trop de temps à se charger. Vérifiez votre connexion.</p>
          <button
            onClick={() => {
              setLoadTimeout(false);
              setStoryType(null);
            }}
            className="w-full px-4 py-2 bg-[#00B894] text-white rounded-lg font-semibold hover:bg-[#00a182] transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // =============================
  // MENU DE SÉLECTION
  // =============================
  if (!user) return null;

  return (
    <>
      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Créer une story</h1>
            <p className="text-gray-600">Choisissez le type de story</p>
          </div>

          <div className="space-y-4">
            {/* Story Texte */}
            <button
              onClick={() => handleMediaChoice('text')}
              className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-cyan-500 hover:bg-cyan-50 transition-all duration-200 group"
              aria-label="Créer une story texte"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <Type className="w-6 h-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-900 group-hover:text-cyan-600">Story Texte</h3>
                <p className="text-sm text-gray-600">Créez avec du texte stylisé</p>
              </div>
            </button>

            {/* Story Média */}
            <button
              onClick={() => handleMediaChoice('media')}
              className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
              aria-label="Créer une story média"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-900 group-hover:text-purple-600">Story Média</h3>
                <p className="text-sm text-gray-600">Photo ou vidéo avec effets</p>
              </div>
            </button>
          </div>

          {/* Bouton Retour */}
          <button
            onClick={() => navigate(-1)}
            className="w-full mt-6 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </>
  );
};

CreateStory.propTypes = {};

export default CreateStory;
StoryLoader.propTypes = {
  message: PropTypes.object,
};
