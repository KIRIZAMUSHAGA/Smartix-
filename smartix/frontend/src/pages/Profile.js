import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  BookOpen, Award, Users, LogOut, Edit, Camera, MapPin, Calendar, 
  Link as LinkIcon, TrendingUp, Zap, Star, Trophy, Crown, Target, 
  Brain, Sparkles, UserPlus, ChevronDown, Share2, Settings, Lock, 
  Globe, Heart, MessageCircle, History, Smile, Eye, ArrowLeft, Image as ImageIcon,
  Check, Mail, GraduationCap, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchCurrentUser } from '../services/authService';
import LinkedAccountsCard from '../components/Profile/LinkedAccountsCard';
import DataPrivacyCard from '../components/Profile/DataPrivacyCard';
import SessionsCard from '../components/Profile/SessionsCard';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { getImageUrl, getAvatarUrl } from '../config/apiClient';
import PropTypes from 'prop-types';

// Lazy loading
const FeedSimple = lazy(() => import('../components/FeedSimple'));

// Composants UI
import { SkeletonProfile, useSkeletonLoader } from '../components/SkeletonComplete';
import BottomNav from '../components/BottomNav';
import NeoGlassHeader from '../components/NeoGlassHeader';
import SideDrawer from '../components/SideDrawer';
import { useRegisterRefresh } from '../contexts/PullToRefreshContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

// =============================
// CONSTANTES
// =============================
const POSTS_PER_PAGE = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 500;

// =============================
// VALIDATEURS
// =============================
const validateFullName = (name) => {
  if (!name || name.trim().length < MIN_NAME_LENGTH) {
    return { valid: false, error: `Le nom doit contenir au moins ${MIN_NAME_LENGTH} caractères` };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Le nom ne peut pas dépasser ${MAX_NAME_LENGTH} caractères` };
  }
  return { valid: true, error: null };
};

const validateBio = (bio) => {
  if (bio && bio.length > MAX_BIO_LENGTH) {
    return { valid: false, error: `La bio ne peut pas dépasser ${MAX_BIO_LENGTH} caractères` };
  }
  return { valid: true, error: null };
};

const validateWebsite = (url) => {
  if (!url) return { valid: true, error: null };
  try {
    new URL(url);
    return { valid: true, error: null };
  } catch {
    return { valid: false, error: 'URL invalide (ex: https://exemple.com)' };
  }
};

const validateImageFile = (file) => {
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Format non supporté (JPEG, PNG, WebP, GIF uniquement)' };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image trop lourde (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)` };
  }
  return { valid: true, error: null };
};

// =============================
// HOOK PERSONNALISÉ POUR LES DONNÉES DU PROFIL
// =============================
const useProfileData = (userId) => {
  const { user: currentUser } = useAuth();
  const { client } = useApiClient();
  const { getProfileCache, updateProfileCache } = useGlobalCache();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const isOwnProfile = !userId || userId === currentUser?.id;
  const displayUser = isOwnProfile ? currentUser : profile;

  const fetchProfile = useCallback(async (force = false) => {
    if (isOwnProfile) {
      setLoading(false);
      return;
    }

    try {
      if (!force) {
        const cached = getProfileCache(userId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setProfile(cached.data);
          setIsFollowing(cached.isFollowing || false);
          setLoading(false);
          return;
        }
      }

      const res = await client.get(`/users/${userId}`);
      setProfile(res.data);
      setIsFollowing(currentUser?.following?.includes(userId) || false);
      
      updateProfileCache(userId, {
        data: res.data,
        isFollowing: currentUser?.following?.includes(userId) || false,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      if (err.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (err.response?.status === 404) {
        toast.error('Profil non trouvé');
      } else {
        toast.error('Erreur de chargement');
      }
    } finally {
      setLoading(false);
    }
  }, [userId, isOwnProfile, client, getProfileCache, updateProfileCache, currentUser]);

  return {
    profile,
    loading,
    isFollowing,
    isOwnProfile,
    displayUser,
    fetchProfile,
    setIsFollowing
  };
};

// =============================
// HOOK PERSONNALISÉ POUR LES ACTIONS
// =============================
const useProfileActions = () => {
  const { user: currentUser, updateUser } = useAuth();
  const { client } = useApiClient();
  const { getProfileCache, updateProfileCache } = useGlobalCache();
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [coverVersion, setCoverVersion] = useState(0);

  const refreshImages = useCallback(() => {
    setAvatarVersion(Date.now());
    setCoverVersion(Date.now());
  }, []);

  const followUser = useCallback(async (targetUserId, currentIsFollowing) => {
    if (!targetUserId) return { success: false };

    const previousState = currentIsFollowing;
    
    try {
      await client.post(`/users/${targetUserId}/follow`);
      toast.success(previousState ? 'Désabonné' : 'Abonné');
      
      const cached = getProfileCache(targetUserId);
      if (cached) {
        updateProfileCache(targetUserId, {
          ...cached,
          isFollowing: !previousState,
          timestamp: Date.now()
        });
      }
      return { success: true, newState: !previousState };
    } catch (error) {
      toast.error('Erreur');
      return { success: false, newState: previousState };
    }
  }, [client, getProfileCache, updateProfileCache]);

  const updateProfile = useCallback(async (data) => {
    if (!currentUser) return { success: false, error: 'Non authentifié' };

    try {
      const res = await client.put(`/users/${currentUser.id}`, data);
      if (res.data.success && res.data.user) {
        updateUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      throw new Error('Update failed');
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Erreur lors de la mise à jour';
      return { success: false, error: errorMessage };
    }
  }, [currentUser, client, updateUser]);

  const uploadImage = useCallback(async (file, type, onProgress) => {
    if (!currentUser) return { success: false, error: 'Non authentifié' };

    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await client.post('/auth/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (onProgress) onProgress(percentCompleted);
        }
      });
      
      const imageUrl = res.data.url;
      if (!imageUrl) throw new Error('No image URL');

      const updateRes = await client.put(`/users/${currentUser.id}`, { [type]: imageUrl });
      if (updateRes.data.success && updateRes.data.user) {
        updateUser(updateRes.data.user);
        refreshImages();
        return { success: true, user: updateRes.data.user };
      }
      throw new Error('Update failed');
    } catch (error) {
      console.error('Error uploading image:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Erreur lors de l\'upload';
      return { success: false, error: errorMessage };
    }
  }, [currentUser, client, updateUser, refreshImages]);

  return {
    avatarVersion,
    coverVersion,
    followUser,
    updateProfile,
    uploadImage,
    refreshImages
  };
};

// =============================
// HOOK PERSONNALISÉ POUR LES POSTS
// =============================
const useUserPosts = (userId, isOwnProfile) => {
  const { user: currentUser } = useAuth();
  const { client } = useApiClient();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);

  const fetchPosts = useCallback(async (reset = false) => {
    const targetUserId = isOwnProfile ? currentUser?.id : userId;
    if (!targetUserId) return;

    try {
      if (reset) {
        setPage(1);
        setPosts([]);
        setHasMore(true);
        setLoadingMore(false);
      } else if (!hasMore || loadingMore) return;

      if (!reset) setLoadingMore(true);
      const response = await client.get('/posts', {
        params: {
          user_id: targetUserId,
          page: reset ? 1 : page,
          limit: POSTS_PER_PAGE
        }
      });

      const newPosts = response.data || [];
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(newPosts.length === POSTS_PER_PAGE);
      if (!reset && newPosts.length > 0) setPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [isOwnProfile, currentUser?.id, userId, client, page, hasMore, loadingMore]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loadingMore || posts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPosts(false);
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, posts.length, fetchPosts]);

  return {
    posts,
    loadingMore,
    hasMore,
    loadMoreRef,
    fetchPosts,
    setPosts
  };
};

// =============================
// COMPOSANT SKELETON
// =============================
const ProfileSkeleton = () => (
  <div className="min-h-screen bg-background transition-colors duration-300 pb-24">
    <div className="relative h-64 sm:h-80 w-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 animate-pulse" />
    <div className="max-w-4xl mx-auto px-4 -mt-24 relative">
      <div className="flex flex-col items-center text-center">
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[40px] bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="mt-6 space-y-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
          <div className="h-16 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
        </div>
      </div>
    </div>
    <BottomNav />
  </div>
);

// =============================
// COMPOSANT PRINCIPAL
// =============================
const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, logout, updateUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // ─── Retour de liaison Google : lit ?linked=google / ?linked_error=… ───
  // posé par /api/auth/google/callback en mode link, affiche un toast et
  // rafraîchit l'objet user (qui contient désormais google_id).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const linked = params.get('linked');
    const linkedError = params.get('linked_error');
    if (!linked && !linkedError) return;

    if (linked === 'google') {
      toast.success('Compte Google rattaché 🎉');
      // On recharge le user pour récupérer le nouveau google_id.
      fetchCurrentUser()
        .then(({ user }) => { if (user) updateUser?.(user); })
        .catch(() => {});
    } else if (linkedError) {
      const messages = {
        google_already_linked: 'Ce compte Google est déjà lié à un autre utilisateur',
        user_not_found: 'Utilisateur introuvable',
        state_mismatch: 'Session expirée, recommence la liaison',
        token_exchange_failed: 'Échange de jeton Google échoué',
        id_token_invalid: 'Jeton Google invalide',
        no_id_token: 'Aucun jeton Google reçu',
        no_google_sub: 'Identifiant Google manquant',
      };
      toast.error('Liaison Google impossible', {
        description: messages[linkedError] || linkedError,
      });
    }

    // Nettoie l'URL pour ne pas re-déclencher au refresh
    const cleanUrl = location.pathname;
    window.history.replaceState(null, '', cleanUrl);
  }, [location.search, location.pathname, updateUser]);

  const [editedProfile, setEditedProfile] = useState({
    full_name: '',
    bio: '',
    school: '',
    level: '',
    location: '',
    website: ''
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const {
    profile,
    loading,
    isFollowing,
    isOwnProfile,
    displayUser,
    fetchProfile,
    setIsFollowing
  } = useProfileData(userId);

  const {
    avatarVersion,
    coverVersion,
    followUser,
    updateProfile,
    uploadImage
  } = useProfileActions();

  const {
    posts,
    loadingMore,
    hasMore,
    loadMoreRef,
    fetchPosts
  } = useUserPosts(userId, isOwnProfile);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchPosts(true);
  }, [userId, fetchPosts]);

  // =============================
  // FORMULAIRE D'ÉDITION
  // =============================
  useEffect(() => {
    if (displayUser) {
      setEditedProfile({
        full_name: displayUser.full_name || '',
        bio: displayUser.bio || '',
        school: displayUser.school || '',
        level: displayUser.level || '',
        location: displayUser.location || '',
        website: displayUser.website || ''
      });
    }
  }, [displayUser]);

  // =============================
  // VALIDATION
  // =============================
  const validateForm = useCallback(() => {
    const errors = {};
    
    const nameValidation = validateFullName(editedProfile.full_name);
    if (!nameValidation.valid) errors.full_name = nameValidation.error;
    
    const bioValidation = validateBio(editedProfile.bio);
    if (!bioValidation.valid) errors.bio = bioValidation.error;
    
    const websiteValidation = validateWebsite(editedProfile.website);
    if (!websiteValidation.valid) errors.website = websiteValidation.error;
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editedProfile]);

  // =============================
  // GESTIONNAIRES
  // =============================
  const handleSaveProfile = async () => {
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs');
      return;
    }
    
    setUpdating(true);
    const result = await updateProfile(editedProfile);
    if (result.success) {
      setShowEditDialog(false);
      toast.success('Profil mis à jour !');
    } else {
      toast.error(result.error);
    }
    setUpdating(false);
  };

  const handleImageUpload = async (file, type) => {
    if (!file) return;
    
    setUploading(true);
    setUploadProgress(0);
    const toastId = toast.loading('Upload en cours...');
    
    const result = await uploadImage(file, type, (progress) => {
      setUploadProgress(progress);
      toast.loading(`Upload en cours... ${progress}%`, { id: toastId });
    });
    
    if (result.success) {
      toast.success('Photo mise à jour !', { id: toastId });
    } else {
      toast.error(result.error, { id: toastId });
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleFollow = async () => {
    const result = await followUser(userId, isFollowing);
    if (result.success) {
      setIsFollowing(result.newState);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: displayUser?.full_name,
          url
        });
      } catch {
        // L'utilisateur a annulé
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié !');
      } catch {
        toast.error('Impossible de copier le lien');
      }
    }
  };

  // =============================
  // DONNÉES DÉRIVÉES
  // =============================
  const userLevel = useMemo(() => 
    Math.floor((displayUser?.points || 0) / 100) + 1,
    [displayUser?.points]
  );

  const userProgress = useMemo(() => 
    (displayUser?.points || 0) % 100,
    [displayUser?.points]
  );

  const stats = useMemo(() => [
    { label: 'Points', value: displayUser?.points || 0, icon: Star, color: 'text-orange-400' },
    { label: 'Niveau', value: userLevel, icon: Trophy, color: 'text-yellow-400' },
    { label: 'Amis', value: displayUser?.followers?.length || 0, icon: Users, color: 'text-blue-400' },
    { label: 'Cours', value: displayUser?.courses_completed || 0, icon: BookOpen, color: 'text-green-400' }
  ], [displayUser, userLevel]);

  // URLs des images avec version
  const coverImage = useMemo(() => {
    const url = getImageUrl(displayUser?.cover_photo, 'uploads');
    return url ? `${url}?t=${coverVersion}` : null;
  }, [displayUser?.cover_photo, coverVersion]);

  const avatarImage = useMemo(() => {
    const url = getAvatarUrl(displayUser?.avatar);
    return `${url}?t=${avatarVersion}`;
  }, [displayUser?.avatar, avatarVersion]);

  // =============================
  // RENDU
  // =============================
  useRegisterRefresh(useCallback(() => fetchProfile(true), [fetchProfile]));

  if (loading) return <ProfileSkeleton />;

  if (!displayUser) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans transition-colors duration-300">
      <NeoGlassHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideDrawer 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        user={currentUser} 
        onLogout={handleLogout}
      />

      {/* Header Cover */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-muted">
        {coverImage ? (
          <>
            <img 
              src={coverImage} 
              alt="Photo de couverture" 
              className="absolute inset-0 w-full h-full object-cover"
              style={{ zIndex: 0 }}
              loading="lazy"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" style={{ zIndex: 1 }} />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] flex items-center justify-center">
            <span className="text-white font-black text-9xl opacity-20 select-none">
              {displayUser?.full_name?.charAt(0).toUpperCase() || displayUser?.username?.charAt(0).toUpperCase() || 'S'}
            </span>
          </div>
        )}
        
        {isOwnProfile && (
          <label className="absolute top-4 right-4 bg-black/40 p-3 rounded-2xl cursor-pointer hover:bg-black/60 transition-all z-20">
            {uploading ? (
              <div className="relative">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white whitespace-nowrap">
                  {uploadProgress}%
                </span>
              </div>
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
            <input 
              type="file" 
              className="hidden" 
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0], 'cover_photo')}
              disabled={uploading}
              aria-label="Changer la photo de couverture"
            />
          </label>
        )}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-15" />
      </div>

      {/* Profile Info */}
      <div className="max-w-4xl mx-auto px-4 -mt-24 relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[40px] border-4 border-background bg-card overflow-hidden shadow-2xl relative">
              <img 
                src={avatarImage} 
                alt="Photo de profil" 
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
              {isOwnProfile && (
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploading ? (
                    <div className="relative">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-white whitespace-nowrap">
                        {uploadProgress}%
                      </span>
                    </div>
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0], 'avatar')}
                    disabled={uploading}
                    aria-label="Changer la photo de profil"
                  />
                </label>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#ff6b35] p-2.5 rounded-2xl shadow-lg border-2 border-background">
              <Trophy className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Info utilisateur */}
          <div className="mt-6">
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              {displayUser?.full_name}
            </h1>
            <p className="text-[#ff6b35] font-black uppercase tracking-[0.2em] text-xs mt-2">
              @{displayUser?.username || 'utilisateur'}
            </p>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto font-medium leading-relaxed">
              {displayUser?.bio || "Étudiant passionné sur Smartix Platform. Prêt à relever tous les défis académiques ! 🚀"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            {isOwnProfile ? (
              <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-card hover:bg-accent text-foreground border border-border rounded-2xl px-8 py-6 font-black h-auto transition-all hover:scale-105 shadow-sm"
                    aria-label="Modifier le profil"
                  >
                    <Edit className="w-5 h-5 mr-2" />
                    Modifier le profil
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border text-foreground rounded-[32px] sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Modifier ton profil</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Mets à jour tes informations pour la communauté.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                        Nom complet *
                      </Label>
                      <Input 
                        value={editedProfile.full_name} 
                        onChange={(e) => setEditedProfile({...editedProfile, full_name: e.target.value})}
                        className={`bg-background border-border rounded-xl ${validationErrors.full_name ? 'border-red-500' : ''}`}
                        aria-label="Nom complet"
                        aria-invalid={!!validationErrors.full_name}
                      />
                      {validationErrors.full_name && (
                        <p className="text-xs text-red-500">{validationErrors.full_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                        Bio
                      </Label>
                      <Textarea 
                        value={editedProfile.bio} 
                        onChange={(e) => setEditedProfile({...editedProfile, bio: e.target.value})}
                        className={`bg-background border-border rounded-xl min-h-[100px] ${validationErrors.bio ? 'border-red-500' : ''}`}
                        aria-label="Bio"
                        aria-invalid={!!validationErrors.bio}
                      />
                      <p className="text-right text-xs text-muted-foreground">
                        {editedProfile.bio.length}/{MAX_BIO_LENGTH}
                      </p>
                      {validationErrors.bio && (
                        <p className="text-xs text-red-500">{validationErrors.bio}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                          Établissement
                        </Label>
                        <Input 
                          value={editedProfile.school} 
                          onChange={(e) => setEditedProfile({...editedProfile, school: e.target.value})}
                          className="bg-background border-border rounded-xl"
                          aria-label="Établissement"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                          Niveau
                        </Label>
                        <Input 
                          value={editedProfile.level} 
                          onChange={(e) => setEditedProfile({...editedProfile, level: e.target.value})}
                          className="bg-background border-border rounded-xl"
                          aria-label="Niveau"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                          Localisation
                        </Label>
                        <Input 
                          value={editedProfile.location} 
                          onChange={(e) => setEditedProfile({...editedProfile, location: e.target.value})}
                          className="bg-background border-border rounded-xl"
                          aria-label="Localisation"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                          Site web
                        </Label>
                        <Input 
                          value={editedProfile.website} 
                          onChange={(e) => setEditedProfile({...editedProfile, website: e.target.value})}
                          className={`bg-background border-border rounded-xl ${validationErrors.website ? 'border-red-500' : ''}`}
                          aria-label="Site web"
                          aria-invalid={!!validationErrors.website}
                        />
                        {validationErrors.website && (
                          <p className="text-xs text-red-500">{validationErrors.website}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={updating}
                    className="w-full bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black py-6 rounded-2xl h-auto"
                    aria-label="Enregistrer les modifications"
                  >
                    {updating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    Enregistrer les modifications
                  </Button>
                </DialogContent>
              </Dialog>
            ) : (
              <Button 
                onClick={handleFollow}
                className={`${isFollowing ? 'bg-secondary text-foreground' : 'bg-[#ff6b35] text-white'} rounded-2xl px-10 py-6 font-black h-auto transition-all hover:scale-105 shadow-sm`}
                aria-label={isFollowing ? 'Se désabonner' : 'S\'abonner'}
              >
                {isFollowing ? <Check className="w-5 h-5 mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
                {isFollowing ? 'Suivi' : 'Suivre'}
              </Button>
            )}
            <Button 
              variant="outline" 
              className="border-border bg-card text-foreground hover:bg-accent rounded-2xl px-8 py-6 font-black h-auto transition-all shadow-sm"
              onClick={handleShare}
              aria-label="Partager le profil"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Partager
            </Button>
          </div>
{/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full mt-12">
            {stats.map((stat, i) => (
              <Card key={i} className="bg-card border-border p-6 rounded-[32px] hover:bg-accent/50 transition-all shadow-sm">
                <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                <div className="text-2xl font-black text-foreground">{stat.value}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</div>
              </Card>
            ))}
          </div>

          {/* Progress Section */}
          <Card className="w-full mt-8 bg-card border-border p-8 rounded-[40px] shadow-sm">
            <div className="flex justify-between items-end mb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Progression Niveau
                </span>
                <h3 className="text-xl font-black text-foreground mt-1">
                  Vers le Niveau {userLevel + 1}
                </h3>
              </div>
              <span className="text-2xl font-black text-[#ff6b35]">{userProgress}%</span>
            </div>
            <Progress 
              value={userProgress} 
              className="h-3 bg-secondary" 
              indicatorClassName="bg-gradient-to-r from-[#ff6b35] to-[#ff8c61]" 
            />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4 text-center">
              {100 - userProgress} XP restants pour le prochain palier
            </p>
          </Card>

          {/* Activity Tabs */}
          <Tabs defaultValue="posts" className="w-full mt-12">
            <TabsList className="w-full bg-card border border-border p-1.5 rounded-2xl h-auto mb-8 shadow-sm">
              <TabsTrigger value="posts" className="flex-1 py-3 rounded-xl data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white font-black uppercase text-xs tracking-widest transition-all">
                Publications
              </TabsTrigger>
              <TabsTrigger value="badges" className="flex-1 py-3 rounded-xl data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white font-black uppercase text-xs tracking-widest transition-all">
                Badges
              </TabsTrigger>
              <TabsTrigger value="about" className="flex-1 py-3 rounded-xl data-[state=active]:bg-[#ff6b35] data-[state=active]:text-white font-black uppercase text-xs tracking-widest transition-all">
                À propos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="space-y-6">
              {posts.length > 0 ? (
                <>
                  <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" /></div>}>
                    <FeedSimple 
                      posts={posts}
                      user={currentUser}
                      onLike={() => fetchPosts(true)}
                      onComment={(post) => navigate(`/posts/${post.id}`)}
                      onShare={() => toast.info('Partage bientôt disponible')}
                    />
                  </Suspense>
                  {hasMore && (
                    <div ref={loadMoreRef} className="h-8" />
                  )}
                  {loadingMore && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-[#ff6b35]" />
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center text-muted-foreground/20 font-black uppercase tracking-widest">
                  Aucune publication pour le moment
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="badges">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="bg-card border-border p-8 rounded-[40px] flex flex-col items-center group shadow-sm hover:shadow-md transition-all">
                    <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-500">
                      <Award className="w-10 h-10 text-[#ff6b35]" />
                    </div>
                    <h4 className="text-sm font-black text-foreground uppercase tracking-tight">Badge Expert</h4>
                    <p className="text-[10px] text-muted-foreground font-bold mt-1">Obtenu en 2025</p>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="about">
              <Card className="bg-card border-border p-8 rounded-[40px] text-left space-y-8 shadow-sm">
                <div>
                  <h4 className="text-xs font-black uppercase text-[#ff6b35] tracking-widest mb-4">
                    Informations Personnelles
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3 text-foreground/70">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          Email
                        </p>
                        <p className="font-medium truncate">{displayUser?.email || "Non renseigné"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-foreground/70">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          Date de naissance
                        </p>
                        <p className="font-medium">{displayUser?.date_of_birth || "Non renseignée"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-foreground/70">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          Localisation
                        </p>
                        <p className="font-medium">{displayUser?.location || "Non renseignée"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-foreground/70">
                      <History className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          Membre depuis
                        </p>
                        <p className="font-medium">
                          {displayUser?.created_at 
                            ? new Date(displayUser.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                            : 'Janvier 2024'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-border/50">
                  <h4 className="text-xs font-black uppercase text-[#ff6b35] tracking-widest mb-4">
                    Parcours Académique
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3 text-foreground/70">
                      <GraduationCap className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          Établissement
                        </p>
                        <p className="font-medium">{displayUser?.school || "Non renseigné"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-foreground/70">
                      <TrendingUp className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          Niveau
                        </p>
                        <p className="font-medium">{displayUser?.level || "Non renseigné"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-border/50">
                  <h4 className="text-xs font-black uppercase text-[#ff6b35] tracking-widest mb-4">
                    Compétences
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['Mathématiques', 'Physique', 'Python', 'IA', 'Comptabilité', 'Gestion'].map(skill => (
                      <Badge key={skill} className="bg-secondary text-foreground border-border px-4 py-2 rounded-xl">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Comptes liés (visible uniquement sur son propre profil) */}
              {isOwnProfile && (
                <div className="mt-8">
                  <LinkedAccountsCard user={displayUser} />
                </div>
              )}

              {/* Mes données & confidentialité (RGPD) — own profile only */}
              {isOwnProfile && (
                <div className="mt-6">
                  <DataPrivacyCard user={displayUser} />
                </div>
              )}

              {/* Sessions actives — own profile only */}
              {isOwnProfile && (
                <div className="mt-6">
                  <SessionsCard />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

Profile.propTypes = {};

export default Profile;
ProfileSkeleton.propTypes = {};
