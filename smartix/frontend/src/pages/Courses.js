import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SkeletonCourses, useSkeletonLoader } from '../components/SkeletonComplete';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useTranslation } from 'react-i18next';
import { BookOpen, Clock, TrendingUp, ArrowLeft, Search, Plus, Loader2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '../components/BottomNav';
import { compressImage, validateImageFile } from '../utils/imageUtils';
import { MAX_IMAGE_SIZE, ACCEPTED_IMAGE_TYPES } from '../config/appConfig';
import { useDebounce } from '../hooks/useDebounce';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES PARTAGÉES — Catégories & niveaux
// =============================
// Les valeurs sont alignées sur ce que stocke le backend
// (`backend/routes/courses.py` : `category` défaut `'informatique'`,
// `level` défaut `'débutant'`, cours seed avec `'comptabilité'` /
// `'intermédiaire'`). Toute divergence casserait le filtrage par
// catégorie (`query["category"] = subject`) côté API. Ces objets
// remplacent d'anciens enums TypeScript supprimés lors de la conversion
// en JS — leur absence faisait planter `useMemo` avec
// "Category is not defined" / "Level is not defined".
const Category = Object.freeze({
  IT:         'informatique',
  MATHS:      'mathématiques',
  PHYSICS:    'physique',
  CHEMISTRY:  'chimie',
  LITERATURE: 'littérature',
  ACCOUNTING: 'comptabilité',
});

const Level = Object.freeze({
  BEGINNER:     'débutant',
  INTERMEDIATE: 'intermédiaire',
  ADVANCED:     'avancé',
});

// =============================
// 1️⃣ CONSTANTES & ENUMS
// =============================
const COURSES_PER_PAGE = 12;

// =============================
// 2️⃣ HOOKS PERSONNALISÉS
// =============================
const useCourseFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState(
    (searchParams.get('category')) || 'all'
  );
  const [levelFilter, setLevelFilter] = useState(
    (searchParams.get('level')) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // Debounce pour la recherche
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Synchroniser les filtres avec l'URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (levelFilter !== 'all') params.set('level', levelFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    
    setSearchParams(params, { replace: true });
  }, [categoryFilter, levelFilter, debouncedSearch, setSearchParams]);

  const resetFilters = useCallback(() => {
    setCategoryFilter('all');
    setLevelFilter('all');
    setSearchQuery('');
  }, []);

  return {
    categoryFilter,
    setCategoryFilter,
    levelFilter,
    setLevelFilter,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    resetFilters
  };
};

// =============================
// 3️⃣ COMPOSANT MODAL DE CRÉATION
// =============================

const CreateCourseModal = ({ isOpen, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: Category.IT,
    level: Level.BEGINNER
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const categories = useMemo(() => [
    { value: Category.IT, label: t('courses.categories.it'), icon: '💻' },
    { value: Category.MATHS, label: t('courses.categories.maths'), icon: '🔢' },
    { value: Category.PHYSICS, label: t('courses.categories.physics'), icon: '⚛️' },
    { value: Category.CHEMISTRY, label: t('courses.categories.chemistry'), icon: '🧪' },
    { value: Category.LITERATURE, label: t('courses.categories.literature'), icon: '📖' },
    { value: Category.ACCOUNTING, label: t('courses.categories.accounting'), icon: '💼' }
  ], [t]);

  const levels = useMemo(() => [
    { value: Level.BEGINNER, label: t('courses.levels.beginner') },
    { value: Level.INTERMEDIATE, label: t('courses.levels.intermediate') },
    { value: Level.ADVANCED, label: t('courses.levels.advanced') }
  ], [t]);

  const handleImageChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError('');
    
    if (!validateImageFile(file)) {
      setError(`Format non supporté. Types acceptés: ${ACCEPTED_IMAGE_TYPES.map(t => t.split('/')[1]).join(', ')}`);
      return;
    }
    
    try {
      setIsUploading(true);
      const compressedFile = await compressImage(file, 800, 400);
      
      // Vérification après compression
      if (compressedFile.size > MAX_IMAGE_SIZE) {
        setError(`Image trop lourde après compression (max ${MAX_IMAGE_SIZE / (1024 * 1024)}MB)`);
        setIsUploading(false);
        return;
      }
      
      setImageFile(compressedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setIsUploading(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error('Error compressing image:', err);
      setError('Erreur lors du traitement de l\'image');
      setIsUploading(false);
    }
  }, []);

  const validateForm = useCallback(() => {
    if (!formData.title.trim()) {
      setError('Le titre est requis');
      return false;
    }
    if (formData.title.length > 100) {
      setError('Le titre est trop long (max 100 caractères)');
      return false;
    }
    if (!formData.description.trim()) {
      setError('La description est requise');
      return false;
    }
    if (formData.description.length > 500) {
      setError('La description est trop longue (max 500 caractères)');
      return false;
    }
    return true;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    
    setError('');
    await onCreate({ ...formData, imageFile });
    
    // Réinitialiser le formulaire
    setFormData({ title: '', description: '', category: Category.IT, level: Level.BEGINNER });
    setImageFile(null);
    setImagePreview(null);
  }, [formData, imageFile, onCreate, validateForm]);

  const handleClose = useCallback(() => {
    setError('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
      <Card className="bg-card border-border rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#ff6b35] p-6 text-white sticky top-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight">{t('courses.modal.title')}</h2>
            <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="relative group">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleImageChange}
              className="hidden"
              id="cover-upload"
            />
            <label
              htmlFor="cover-upload"
              className="block w-full aspect-video rounded-2xl border-2 border-dashed border-border hover:border-[#ff6b35] transition-all cursor-pointer relative overflow-hidden bg-background"
            >
              {isUploading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
                  <span className="text-xs text-muted-foreground">Compression...</span>
                </div>
              ) : imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Plus className="w-8 h-8" />
                  <span className="text-xs font-black uppercase tracking-wider">Image de couverture (Optionnelle)</span>
                </div>
              )}
            </label>
          </div>
          
          <div>
            <Input
              placeholder={t('courses.modal.placeholderTitle')}
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              maxLength={100}
              className="h-14 bg-background border-border text-foreground rounded-xl"
            />
            <div className="text-right mt-1">
              <span className={`text-xs ${formData.title.length > 90 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {formData.title.length}/100
              </span>
            </div>
          </div>
          
          <div>
            <textarea
              placeholder={t('courses.modal.placeholderDesc')}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              maxLength={500}
              className="w-full bg-background border-border text-foreground rounded-xl p-4 min-h-[100px] focus:ring-2 focus:ring-[#ff6b35] outline-none"
            />
            <div className="text-right mt-1">
              <span className={`text-xs ${formData.description.length > 450 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {formData.description.length}/500
              </span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Catégorie</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full bg-background border border-border text-foreground rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Niveau</label>
            <select
              value={formData.level}
              onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
              className="w-full bg-background border border-border text-foreground rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff6b35]"
            >
              {levels.map(lvl => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label}
                </option>
              ))}
            </select>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          
          <div className="flex gap-4 pt-4">
            <Button onClick={handleClose} variant="ghost" className="flex-1 text-muted-foreground hover:text-foreground">
              {t('courses.modal.cancel')}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isUploading}
              className="flex-1 bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                t('courses.modal.create')
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

// =============================
// 4️⃣ COMPOSANT CARD COURS (MEMOISÉ)
// =============================

const CourseCard = React.memo(({ course }) => {
  const { t } = useTranslation();
  
  const getLevelColor = useCallback((level) => {
    const levelMap = {
      [Level.BEGINNER]: 'bg-green-500/10 text-green-400 border-green-500/20',
      [Level.INTERMEDIATE]: 'bg-orange-500/10 text-[#ff6b35] border-[#ff6b35]/20',
      [Level.ADVANCED]: 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return levelMap[level] || 'bg-white/5 text-white/50 border-white/10';
  }, []);

  const getLevelLabel = useCallback((level) => {
    const levelMap = {
      [Level.BEGINNER]: t('courses.levels.beginner'),
      [Level.INTERMEDIATE]: t('courses.levels.intermediate'),
      [Level.ADVANCED]: t('courses.levels.advanced')
    };
    return levelMap[level];
  }, [t]);

  const getFullImageUrl = useCallback((path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^\/?(api\/)?/, '/');
    return cleanPath;
  }, []);

  const getBookColors = useCallback((category, coverImage) => {
    if (coverImage) return { spine: '#1e293b', cover: 'transparent', accent: 'transparent' };
    
    const colors = {
      [Category.IT]: { spine: '#1e293b', cover: '#3b82f6', accent: '#60a5fa' },
      [Category.MATHS]: { spine: '#1e293b', cover: '#8b5cf6', accent: '#a78bfa' },
      [Category.PHYSICS]: { spine: '#1e293b', cover: '#06b6d4', accent: '#22d3ee' },
      [Category.CHEMISTRY]: { spine: '#1e293b', cover: '#10b981', accent: '#34d399' },
      [Category.LITERATURE]: { spine: '#1e293b', cover: '#f59e0b', accent: '#fbbf24' },
      [Category.ACCOUNTING]: { spine: '#1e293b', cover: '#ef4444', accent: '#f87171' }
    };
    return colors[category] || { spine: '#0f172a', cover: '#ff6b35', accent: '#ff8c61' };
  }, []);

  const bookColors = getBookColors(course.category, course.coverImage);
  
  return (
    <Link to={`/courses/${course.id}`} className="group">
      <div className="relative mb-6 transition-all duration-500 group-hover:-translate-y-2">
        <div 
          className="aspect-[3/4] rounded-2xl shadow-2xl relative overflow-hidden flex flex-col justify-between p-6"
          style={{ 
            backgroundImage: course.coverImage 
              ? `url(${getFullImageUrl(course.coverImage)})`
              : `linear-gradient(135deg, ${bookColors.cover}, ${bookColors.accent})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
          <div className="absolute top-4 left-4 flex gap-2">
            <Badge className={`font-black text-[10px] uppercase tracking-widest ${getLevelColor(course.level)}`}>
              {getLevelLabel(course.level)}
            </Badge>
            {course.status === 'draft' && (
              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/20 font-black text-[10px] uppercase tracking-widest">
                Brouillon
              </Badge>
            )}
          </div>
          <div>
            <h3 className="text-lg font-black text-white leading-tight mb-4 drop-shadow-lg">
              {course.title}
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/80">
              <Clock className="w-4 h-4" />
              <span>{course.chapters?.length || 0} {t('courses.book.chapters')}</span>
            </div>
          </div>
        </div>
        <div 
          className="absolute left-0 top-0 bottom-0 w-6 bg-black/20 backdrop-blur-sm rounded-l-md border-r border-white/10"
          style={{ background: bookColors.spine }}
        />
      </div>
      <Button className="w-full bg-card border border-border hover:bg-[#ff6b35] hover:border-[#ff6b35] hover:text-white text-foreground font-black rounded-xl transition-all">
        {t('courses.book.open')}
      </Button>
    </Link>
  );
});

CourseCard.displayName = 'CourseCard';

// =============================
// 5️⃣ COMPOSANT PRINCIPAL
// =============================
const Courses = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const { isLoading: skeletonLoading } = useSkeletonLoader(500);
  const loadMoreRef = useRef(null);
  
  const {
    categoryFilter,
    setCategoryFilter,
    levelFilter,
    setLevelFilter,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    resetFilters
  } = useCourseFilters();

  // =============================
  // 6️⃣ INFINITE QUERY
  // =============================
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['courses', viewMode, categoryFilter, levelFilter, debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const endpoint = viewMode === 'drafts' ? '/courses/drafts' : '/courses';
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: COURSES_PER_PAGE.toString(),
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(levelFilter !== 'all' && { level: levelFilter }),
        ...(debouncedSearch && { search: debouncedSearch })
      });
      
      const res = await client.get(`${endpoint}?${params.toString()}`);
      const courses = res.data.courses || res.data || [];
      const total = res.data.total || courses.length;
      const currentPage = pageParam;
      
      return {
        courses,
        total,
        hasMore: currentPage * COURSES_PER_PAGE < total,
        nextPage: currentPage + 1
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextPage : undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Scroll infini avec Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Mutation pour créer un cours avec optimistic update
  const createCourseMutation = useMutation({
    mutationFn: async ({ title, description, category, level, imageFile }) => {
      let coverImageUrl = null;
      
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadRes = await client.post('/courses/upload-cover', formData);
        coverImageUrl = uploadRes.data.url;
      }
      
      const courseData = { title, description, category, level, coverImage: coverImageUrl };
      const res = await client.post('/courses', courseData);
      return res.data;
    },
    onMutate: async (newCourse) => {
      // Annuler les requêtes en cours
      await queryClient.cancelQueries({ 
        queryKey: ['courses', viewMode, categoryFilter, levelFilter, debouncedSearch] 
      });

      // Sauvegarder les données précédentes
      const previousData = queryClient.getQueryData(['courses', viewMode, categoryFilter, levelFilter, debouncedSearch]);

      // Optimistic update
      queryClient.setQueryData(
        ['courses', viewMode, categoryFilter, levelFilter, debouncedSearch],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: [
              {
                ...old.pages[0],
                courses: [{ ...newCourse, id: 'temp-id', status: 'draft' }, ...(old.pages[0]?.courses || [])],
                total: (old.pages[0]?.total || 0) + 1
              },
              ...old.pages.slice(1)
            ]
          };
        }
      );

      return { previousData };
    },
    onError: (err, newCourse, context) => {
      // Rollback en cas d'erreur
      queryClient.setQueryData(
        ['courses', viewMode, categoryFilter, levelFilter, debouncedSearch],
        context?.previousData
      );
      const errorMessage = (err).response?.data?.detail || 'Erreur lors de la création du cours';
      toast.error(errorMessage);
    },
    onSuccess: (data) => {
      toast.success('Cours créé avec succès!');
      setShowAddModal(false);
      
      if (data?.id) {
        navigate(`/courses/${data.id}/edit`);
      }
    }
  });

   // =============================
  // 7️⃣ UTILITAIRES MEMOISÉS
  // =============================
  const categories = useMemo(() => [
    { key: 'all', label: t('courses.categories.all'), icon: '📚' },
    { key: Category.IT, label: t('courses.categories.it'), icon: '💻' },
    { key: Category.MATHS, label: t('courses.categories.maths'), icon: '🔢' },
    { key: Category.PHYSICS, label: t('courses.categories.physics'), icon: '⚛️' },
    { key: Category.CHEMISTRY, label: t('courses.categories.chemistry'), icon: '🧪' },
    { key: Category.LITERATURE, label: t('courses.categories.literature'), icon: '📖' },
    { key: Category.ACCOUNTING, label: t('courses.categories.accounting'), icon: '💼' }
  ], [t]);

  const levels = useMemo(() => [
    { key: 'all', label: t('courses.levels.all') },
    { key: Level.BEGINNER, label: t('courses.levels.beginner') },
    { key: Level.INTERMEDIATE, label: t('courses.levels.intermediate') },
    { key: Level.ADVANCED, label: t('courses.levels.advanced') }
  ], [t]);

  const courses = data?.pages.flatMap(page => page.courses) ?? [];

  const handleAddCourse = useCallback(() => {
    if (!user) {
      toast.error('Vous devez être connecté pour créer un cours');
      return;
    }
    setShowAddModal(true);
  }, [user]);

  if ((isLoading && !data) || skeletonLoading) {
    return (
      <div className="min-h-screen bg-background pb-24 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <SkeletonCourses isLoading={true} />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div data-testid="courses-page" className="min-h-screen bg-background text-foreground pb-24 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-background border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <Link to="/home">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-accent">
                <ArrowLeft className="w-4 h-4 mr-2" /> {t('courses.back')}
              </Button>
            </Link>
            {user && (
              <Button 
                onClick={handleAddCourse}
                className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('courses.addCourse')}
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-6 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#ff6b35] flex items-center justify-center shadow-2xl shadow-[#ff6b35]/20">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-foreground tracking-tight">{t('courses.title')}</h1>
              <p className="text-muted-foreground font-medium">{t('courses.subtitle')}</p>
            </div>
          </div>

          {/* Recherche avec debounce */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
            <Input
              type="text"
              placeholder={t('courses.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 bg-card border-border text-foreground rounded-2xl focus:ring-[#ff6b35] focus:border-[#ff6b35]"
            />
          </div>
          
          {/* Bouton brouillons et filtres */}
          <div className="space-y-6">
            {user && (
              <Button 
                onClick={() => navigate('/courses/drafts')}
                variant="outline"
                className="border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35] hover:text-white font-black rounded-xl"
              >
                Mes Brouillons
              </Button>
            )}
            
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key | 'all')}
                  className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                    categoryFilter === cat.key
                      ? 'bg-[#ff6b35] text-white shadow-xl shadow-[#ff6b35]/20'
                      : 'bg-card text-muted-foreground hover:bg-accent border border-border/50'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {levels.map(level => (
                <button
                  key={level.key}
                  onClick={() => setLevelFilter(level.key | 'all')}
                  className={`px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${
                    levelFilter === level.key
                      ? 'bg-[#ff6b35] text-white shadow-xl shadow-[#ff6b35]/20'
                      : 'bg-card text-muted-foreground hover:bg-accent border border-border/50'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

     {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Progression Card */}
        <Card className="p-8 mb-12 bg-card border border-border rounded-[40px] backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff6b35]/5 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="flex items-start gap-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-[#ff6b35] flex items-center justify-center shadow-2xl shadow-[#ff6b35]/20">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">{t('courses.progression.title')}</h2>
              <div className="flex items-center gap-6 mb-4">
                <div className="flex-1 bg-secondary rounded-full h-4 overflow-hidden border border-border/50">
                  <div className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] h-full" style={{ width: '45%' }} />
                </div>
                <span className="text-lg font-black text-[#ff6b35]">45%</span>
              </div>
              <Button className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black px-8 py-6 rounded-xl transition-all hover:scale-105 active:scale-95">
                {t('courses.progression.resume')}
              </Button>
            </div>
          </div>
        </Card>

        {/* Grille des cours */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {/* Élément de référence pour le scroll infini */}
        <div ref={loadMoreRef} className="h-10" />

        {/* Indicateur de chargement */}
        {isFetchingNextPage && (
          <div className="text-center mt-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35] mx-auto" />
          </div>
        )}

        {/* État vide */}
        {courses.length === 0 && !isLoading && (
          <div className="text-center py-24 bg-card rounded-[40px] border border-border">
            <BookOpen className="w-20 h-20 text-muted-foreground/20 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-foreground mb-2 tracking-tight">{t('courses.empty.title')}</h3>
            <p className="text-muted-foreground font-medium">{t('courses.empty.desc')}</p>
            {user && (
              <Button 
                onClick={handleAddCourse}
                className="mt-6 bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer mon premier cours
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modal de création */}
      <CreateCourseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={createCourseMutation.mutate}
      />

      <BottomNav />
    </div>
  );
};

Courses.propTypes = {};

export default Courses;
CreateCourseModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
};
