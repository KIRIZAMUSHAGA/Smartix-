import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense, memo } from 'react';
import { SkeletonCreatePost } from '../components/SkeletonComplete';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ArrowLeft, Image as ImageIcon, Zap, BookOpen, Mic, Tag, Type, Link2, Lock, ChevronDown, X, Globe, Smile, Users } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';

// Composants
import BottomNav from '../components/BottomNav';
import PropTypes from 'prop-types';

// Lazy load pour la galerie d'arrière-plans
const BackgroundGallery = lazy(() => import('../components/BackgroundGallery'));

// =============================
// CONSTANTES
// =============================
const QUICK_EMOJIS = ['😊', '❤️', '🔥', '👍', '🎉', '💡', '📚', '✨'];
const UPLOAD_TIMEOUT = 60000;
const MAX_CHARS = 5000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 2000;
const MAX_CACHE_POSTS = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

// BACKGROUNDS (hors composant, pas de re-render)
const BACKGROUNDS = [
  { id: 1, name: 'Cosmique Bleu', css: 'bg-gradient-to-br from-[#001a4d] via-[#0033cc] to-[#0066ff]' },
  { id: 2, name: 'Violet Turquoise', css: 'bg-gradient-to-br from-[#9d4edd] via-[#7209b7] to-[#00d9ff]' },
  { id: 3, name: 'Bokeh Jaune', css: 'bg-gradient-to-br from-[#fffacd] to-[#ffeb3b]' },
  { id: 4, name: 'Vert Éducatif', css: 'bg-gradient-to-br from-[#1b5e20] to-[#4caf50]' },
  { id: 5, name: 'Orange Dynamique', css: 'bg-gradient-to-br from-[#ff6f00] via-[#ff9800] to-[#ffb74d]' },
  { id: 6, name: 'Rose Néon', css: 'bg-gradient-to-br from-[#ff1493] to-[#ff69b4]' },
  { id: 7, name: 'Bleu Nuit', css: 'bg-gradient-to-br from-[#0a0e27] to-[#16213e]' },
  { id: 8, name: 'Blanc Minimaliste', css: 'bg-gradient-to-br from-white to-[#f5f5f5]' },
  { id: 9, name: 'Noir Premium', css: 'bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d]' },
  { id: 10, name: 'Rouge Énergique', css: 'bg-gradient-to-br from-[#dc143c] via-[#ff4500] to-[#ff6347]' },
  { id: 11, name: 'Icônes Éducation', css: 'bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6]' },
  { id: 12, name: 'Pixels IA', css: 'bg-gradient-to-br from-[#000000] to-[#1a1a2e]' },
  { id: 13, name: 'Réseau Social', css: 'bg-gradient-to-br from-[#4f46e5] to-[#7c3aed]' },
  { id: 14, name: 'Holographique', css: 'bg-gradient-to-br from-[#00d4ff] via-[#0099ff] to-[#ff00ff]' },
  { id: 15, name: 'Feuilles Dorées', css: 'bg-gradient-to-br from-[#8b7500] to-[#daa520]' },
  { id: 16, name: 'Circuits Tech', css: 'bg-gradient-to-br from-[#0d1117] to-[#161b22]' },
  { id: 17, name: 'Cercles Fluides', css: 'bg-gradient-to-br from-[#f5f5f5] to-[#e0e0e0]' },
  { id: 18, name: 'Nuages Colorés', css: 'bg-gradient-to-br from-[#ff6b9d] via-[#feca57] to-[#48dbfb]' },
  { id: 19, name: 'Formes 3D', css: 'bg-gradient-to-br from-[#667eea] to-[#764ba2]' },
  { id: 20, name: 'Rayons Lumineux', css: 'bg-gradient-to-br from-[#1a1a1a] to-[#2d5016]' }
];

// =============================
// PRIVACY OPTIONS
// =============================
const PRIVACY_OPTIONS = [
  { value: 'public', label: '🌍 Public', icon: Globe },
  { value: 'friends', label: '👥 Amis seulement', icon: Users },
  { value: 'anonymous', label: '🎭 Anonyme', icon: Lock }
];

// =============================
// UTILITAIRES
// =============================
const getAvatarUrl = (avatar) => avatar || '/default-avatar.png';
const handleAvatarError = (e) => { e.target.src = '/default-avatar.png'; };

// =============================
// HOOK: RETRY
// =============================
const useRetry = () => {
  const executeWithRetry = useCallback(async (fn, retries = RETRY_COUNT) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        if (error.response?.status === 429 || error.code === 'ECONNABORTED') {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, i)));
          continue;
        }
        throw error;
      }
    }
  }, []);

  return { executeWithRetry };
};

// =============================
// HOOK: SESSIONSTORAGE AVEC GESTION ROBUSTE
// =============================
const useSecureSessionStorage = () => {
  const savePosts = useCallback((key, posts) => {
    try {
      // Limiter le nombre de posts
      const limitedPosts = posts.slice(0, MAX_CACHE_POSTS);
      const data = {
        posts: limitedPosts,
        timestamp: Date.now(),
        version: 1
      };
      const serialized = JSON.stringify(data);
      if (serialized.length < 4.5 * 1024 * 1024) {
        sessionStorage.setItem(key, serialized);
        return true;
      }
      console.warn('Cache too large, skipping');
      return false;
    } catch (error) {
      console.warn('Failed to save to sessionStorage:', error);
      return false;
    }
  }, []);

  const loadPosts = useCallback((key) => {
    try {
      const saved = sessionStorage.getItem(key);
      if (!saved) return null;
      
      const data = JSON.parse(saved);
      
      // Vérifier TTL
      if (data.timestamp && (Date.now() - data.timestamp) > CACHE_TTL_MS) {
        sessionStorage.removeItem(key);
        return null;
      }
      
      return data.posts || [];
    } catch (error) {
      console.warn('Failed to load from sessionStorage:', error);
      sessionStorage.removeItem(key);
      return null;
    }
  }, []);

  const clearPosts = useCallback((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error);
    }
  }, []);

  return { savePosts, loadPosts, clearPosts };
};

// =============================
// COMPOSANT POST PREVIEW (memoized)
// =============================
const PostPreview = memo(({ user, content, selectedBg, imagePreview, privacyOption, onRemoveImage }) => {
  const userInitial = user?.full_name?.[0] || user?.username?.[0] || '?';
  
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700">
        <Avatar className="w-10 h-10 ring-2 ring-[#00B894]">
          <AvatarImage src={getAvatarUrl(user?.avatar)} onError={handleAvatarError} />
          <AvatarFallback className="bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white text-xs font-bold">
            {userInitial}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">{user?.full_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            À l'instant · {privacyOption?.label}
          </p>
        </div>
      </div>

      <div className="min-h-32">
        {selectedBg ? (
          <div className={`${selectedBg.css} p-6 min-h-32 flex items-center justify-center relative overflow-hidden`}>
            <div className="relative z-10 text-center max-w-md">
              {content ? (
                <p className="text-white text-base font-medium break-words whitespace-pre-wrap drop-shadow-lg">
                  {content}
                </p>
              ) : (
                <p className="text-white/60 text-sm italic">Votre texte apparaîtra ici...</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gray-50 dark:bg-gray-800">
            {content ? (
              <p className="text-gray-900 dark:text-white text-base break-words whitespace-pre-wrap">
                {content}
              </p>
            ) : (
              <p className="text-gray-400 italic text-sm">Votre texte apparaîtra ici...</p>
            )}
          </div>
        )}
      </div>

      {imagePreview && (
        <div className="relative">
          <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover" />
          <button
            onClick={onRemoveImage}
            className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-all shadow-lg"
            aria-label="Supprimer l'image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex gap-4 text-sm text-gray-600 dark:text-gray-400">
        <button className="hover:text-[#00B894] transition-colors flex items-center gap-1">
          <span>👍</span> Aimer
        </button>
        <button className="hover:text-[#00B894] transition-colors flex items-center gap-1">
          <span>💬</span> Commenter
        </button>
        <button className="hover:text-[#00B894] transition-colors flex items-center gap-1">
          <span>↗️</span> Partager
        </button>
      </div>
    </div>
  );
});

PostPreview.displayName = 'PostPreview';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const CreatePost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { groupId } = useParams();
  const { executeWithRetry } = useRetry();
  const { savePosts, loadPosts, clearPosts } = useSecureSessionStorage();
  
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState('public');
  const [selectedBg, setSelectedBg] = useState(null);
  const [showBgGallery, setShowBgGallery] = useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const toastIdRef = useRef(null);
  const isPublishingRef = useRef(false);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // GESTION DE L'IMAGE AVEC URL.createObjectURL
  // =============================
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Format non supporté', {
        description: 'Seules les images sont acceptées pour le moment'
      });
      return;
    }

    toastIdRef.current = toast.loading('Compression de l\'image...', { duration: 60000 });
    
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        quality: 0.8
      };
      
      if (file.size < 0.5 * 1024 * 1024) {
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
        setImageFile(file);
        toast.dismiss(toastIdRef.current);
        toast.success('Image prête !', { duration: 2000 });
        return;
      }
      
      let compressedFile;
      try {
        compressedFile = await imageCompression(file, options);
      } catch (compressionError) {
        console.warn('Compression failed, using original file:', compressionError);
        compressedFile = file;
      }
      
      const previewUrl = URL.createObjectURL(compressedFile);
      setImagePreview(previewUrl);
      setImageFile(compressedFile);
      toast.dismiss(toastIdRef.current);
      toast.success('Image compressée et prête !', { duration: 2000 });
    } catch (error) {
      console.error('Compression error:', error);
      toast.dismiss(toastIdRef.current);
      toast.error('Erreur lors de la compression', { duration: 3000 });
      
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setImageFile(file);
      toast.info('Image originale utilisée', { duration: 2000 });
    }
  };

  // =============================
  // PUBLICATION (avec anti-spam)
  // =============================
  const handlePublish = async () => {
    if (isPublishingRef.current) return;
    if (!user) {
      toast.error('Connectez-vous pour publier');
      navigate('/auth');
      return;
    }

    if (!content.trim() && !imageFile && !selectedBg) {
      toast.error('Veuillez ajouter du contenu (texte, image ou arrière-plan)');
      return;
    }

    isPublishingRef.current = true;
    setIsPublishing(true);
    const publishToastId = toast.loading('Publication en cours...', { duration: 60000 });
    
    try {
      let imageData = null;
      
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        
        const uploadRes = await executeWithRetry(() => 
          client.post('/posts/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percent);
              toast.loading(`Upload: ${percent}%`, { id: publishToastId });
            }
          })
        );
        
        imageData = uploadRes.data;
      }

      const postPayload = {
        content: content.trim(),
        image: imageData?.image || null,
        image_thumbnail: imageData?.image_thumbnail || null,
        background_id: selectedBg?.id || null,
        category: 'general',
        privacy_level: privacyLevel
      };

      let response;
      if (groupId) {
        response = await executeWithRetry(() => 
          client.post(`/groups/${groupId}/posts`, postPayload, { timeout: UPLOAD_TIMEOUT })
        );
      } else {
        response = await executeWithRetry(() => 
          client.post(`/api/posts`, postPayload, { timeout: UPLOAD_TIMEOUT })
        );
      }
      
      const finalPost = { ...response.data, status: 'published' };
      
      // Mettre en cache avec gestion robuste
      const cacheKey = `latest_posts_v1`;
      const existingPosts = loadPosts(cacheKey) || [];
      const newPosts = [finalPost, ...existingPosts];
      savePosts(cacheKey, newPosts);
      
      toast.dismiss(publishToastId);
      toast.success('Votre post a été publié avec succès ✅', { duration: 3000 });
      
      // Nettoyer les URLs blob
      if (imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      
      navigate(groupId ? `/groups/${groupId}` : '/feed');
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.dismiss(publishToastId);
      
      if (error.code === 'ECONNABORTED') {
        toast.error('Connexion lente, réessayez', { duration: 4000 });
      } else if (error.response?.status === 413) {
        toast.error('Fichier trop volumineux', { duration: 3000 });
      } else if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous', { duration: 3000 });
        navigate('/auth');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez', { duration: 4000 });
      } else {
        toast.error(error.response?.data?.detail || 'Erreur lors de la publication', { duration: 3000 });
      }
    } finally {
      isPublishingRef.current = false;
      setIsPublishing(false);
      setUploadProgress(0);
    }
  };

  // =============================
  // INSÉRER EMOJI
  // =============================
  const insertEmoji = (emoji) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // =============================
  // SÉLECTIONNER ARRIÈRE-PLAN
  // =============================
  const handleSelectBackground = (bg) => {
    setSelectedBg(bg);
    setShowBgGallery(false);
    toast.success(`Arrière-plan "${bg.name}" sélectionné ✅`);
  };

  // =============================
  // RETIRER IMAGE
  // =============================
  const handleRemoveImage = () => {
    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setImageFile(null);
  };

  // =============================
  // NETTOYAGE DES URLs BLOB
  // =============================
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // =============================
  // RENDU
  // =============================
  if (!user) return null;

  const userInitial = user?.full_name?.[0] || user?.username?.[0] || '?';
  const privacyOption = PRIVACY_OPTIONS.find(opt => opt.value === privacyLevel);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-700 dark:text-gray-300 hover:text-[#00B894] transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {groupId ? '✍️ Créer une publication de groupe' : '✍️ Nouvelle publication'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
              className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Confidentialité"
              aria-label="Confidentialité"
            >
              {privacyOption?.icon ? <privacyOption.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" /> : <Globe className="w-5 h-5" />}
              {showPrivacyMenu && (
                <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2 z-50 min-w-48">
                  <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    🔒 Confidentialité
                  </div>
                  {PRIVACY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPrivacyLevel(opt.value); setShowPrivacyMenu(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm text-gray-700 dark:text-gray-300"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </button>
            <Button
              onClick={handlePublish}
              disabled={isPublishing || (!content.trim() && !imageFile && !selectedBg)}
              className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white font-bold px-6 py-2 rounded-full hover:shadow-lg disabled:opacity-50 whitespace-nowrap transition-all"
            >
              {isPublishing ? (
                <span className="flex items-center justify-center gap-2">
                  {uploadProgress > 0 ? (
                    <span className="text-sm">{uploadProgress}%</span>
                  ) : (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  )}
                  Publication...
                </span>
              ) : (
                '📝 Publier maintenant'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-2 border-transparent hover:border-[#00B894]/30 transition-all overflow-hidden">
          
          {/* Prévisualisation */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            <div className="p-4">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                👁️ Aperçu en temps réel
              </h3>
              
              <PostPreview
                user={user}
                content={content}
                selectedBg={selectedBg}
                imagePreview={imagePreview}
                privacyOption={privacyOption}
                onRemoveImage={handleRemoveImage}
              />
            </div>
          </div>

          {/* Formulaire */}
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Avatar className="w-12 h-12 ring-2 ring-gray-200 dark:ring-gray-700">
                <AvatarImage src={getAvatarUrl(user?.avatar)} onError={handleAvatarError} />
                <AvatarFallback className="bg-gradient-to-br from-[#00B894] to-[#0984E3] text-white font-bold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="relative">
                  <Textarea
                    placeholder="Tu as une idée, une question ou une info à partager ?"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows="5"
                    className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:border-[#00B894] text-gray-900 dark:text-white placeholder-gray-500 text-base p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B894]/20 transition-all resize-none"
                    maxLength={MAX_CHARS}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                      title="Ajouter un emoji"
                    >
                      <Smile className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  {showEmojiPicker && (
                    <div className="absolute bottom-14 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 z-50 flex gap-2">
                      {QUICK_EMOJIS.map((emoji, idx) => (
                        <button
                          key={idx}
                          onClick={() => insertEmoji(emoji)}
                          className="text-2xl hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {content.length} / {MAX_CHARS} caractères
                  </p>
                  {content.length > MAX_CHARS - 500 && (
                    <p className="text-xs text-orange-500 font-medium">
                      ⚠️ Bientôt à la limite !
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">✨ Ajouter à ta publication</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setShowBgGallery(!showBgGallery)}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-[#00B894]/10 hover:to-[#0984E3]/10 rounded-xl transition-all border-2 border-transparent hover:border-[#00B894] group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-[#00B894] to-[#0984E3] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-xl">🖼️</span>
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Arrière-plan</span>
                </button>

                <label className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-[#0984E3]/10 hover:to-[#00B894]/10 rounded-xl cursor-pointer transition-all border-2 border-transparent hover:border-[#0984E3] group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0984E3] to-[#00B894] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Média</span>
                </label>

                <button
                  onClick={() => toast.info('🤖 Génération IA - À venir !')}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-yellow-500/10 hover:to-orange-500/10 rounded-xl transition-all border-2 border-transparent hover:border-yellow-500 group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">IA</span>
                </button>

                <button
                  onClick={() => toast.info('📚 Ajouter un cours - À venir !')}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-green-500/10 hover:to-emerald-500/10 rounded-xl transition-all border-2 border-transparent hover:border-green-500 group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Cours</span>
                </button>
              </div>
            </div>

            {/* Galerie d'arrière-plans (lazy load) */}
            {showBgGallery && (
              <Suspense fallback={<div className="mt-4 p-8 text-center">Chargement des arrière-plans...</div>}>
                <BackgroundGallery
                  backgrounds={BACKGROUNDS}
                  selectedBg={selectedBg}
                  onSelectBackground={handleSelectBackground}
                  onClose={() => setShowBgGallery(false)}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

CreatePost.propTypes = {};

export default CreatePost;
