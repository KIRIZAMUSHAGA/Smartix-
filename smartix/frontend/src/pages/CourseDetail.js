import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SkeletonCourseDetail, useSkeletonLoader } from '../components/SkeletonComplete';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import BottomNav from '../components/BottomNav';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { ArrowLeft, BookOpen, Clock, Users, CheckCircle, PlayCircle, Loader2, AlertCircle, Lock, Sparkles, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getImageUrl } from '../config/apiClient';
import PropTypes from 'prop-types';

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedChapters, setCompletedChapters] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [lastCompletedChapter, setLastCompletedChapter] = useState(null);

  // =============================
  // 1️⃣ CHARGEMENT DU COURS ET DE LA PROGRESSION
  // =============================
  const fetchCourse = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Charger le cours
      const courseRes = await client.get(`/courses/${courseId}`);
      setCourse(courseRes.data);
      
      // Charger la progression de l'utilisateur depuis le backend (source unique de vérité)
      const progressRes = await client.get(`/users/progress/course/${courseId}`);
      if (progressRes.data?.completed_chapters) {
        setCompletedChapters(progressRes.data.completed_chapters);
        
        // Trouver le dernier chapitre complété
        const lastCompleted = progressRes.data.completed_chapters.length > 0 
          ? progressRes.data.completed_chapters[progressRes.data.completed_chapters.length - 1]
          : null;
        setLastCompletedChapter(lastCompleted);
      }
      
    } catch (error) {
      console.error('Failed to fetch course:', error);
      setError('Impossible de charger le cours');
      toast.error('Cours non trouvé');
    } finally {
      setLoading(false);
    }
  }, [courseId, client, user]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  // =============================
  // 2️⃣ SAUVEGARDE DE LA PROGRESSION (source unique)
  // =============================
  const saveProgress = useCallback(async (chapterId, completed) => {
    if (!user || !courseId) return;
    
    setUpdating(true);
    
    try {
      // Appel API pour marquer le chapitre
      const res = await client.post(`/users/progress/course/${courseId}/chapter/${chapterId}`, {
        completed
      });
      
      // ✅ Mettre à jour avec les données du backend (source unique)
      setCompletedChapters(res.data.completed_chapters);
      
      // Mettre à jour le dernier chapitre complété
      if (completed) {
        setLastCompletedChapter(chapterId);
      } else if (lastCompletedChapter === chapterId) {
        // Trouver le nouveau dernier chapitre
        const newLast = res.data.completed_chapters.length > 0 
          ? res.data.completed_chapters[res.data.completed_chapters.length - 1]
          : null;
        setLastCompletedChapter(newLast);
      }
      
      return res.data;
    } catch (err) {
      console.error('Error saving progress:', err);
      toast.error('Erreur lors de la sauvegarde');
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [user, courseId, client, lastCompletedChapter]);

  // =============================
  // 3️⃣ COMPLÉTER UN CHAPITRE (via quiz)
  // =============================
  const completeChapter = useCallback(async (chapterId) => {
    if (updating) return;
    
    // Vérifier que les chapitres précédents sont complétés
    const chapterIndex = course?.chapters?.findIndex(c => c.id === chapterId) || 0;
    const previousChapters = course?.chapters?.slice(0, chapterIndex) || [];
    const allPreviousCompleted = previousChapters.every(c => completedChapters.includes(c.id));
    
    if (!allPreviousCompleted && chapterIndex > 0) {
      toast.warning('Complétez d\'abord les chapitres précédents');
      return;
    }
    
    // Rediriger vers le lecteur de chapitre (qui gère le vrai quiz)
    navigate(`/course/${chapterId}`);
    
  }, [course, completedChapters, navigate, updating]);

  // =============================
  // 4️⃣ NAVIGATION CONTINUER
  // =============================
  const getNextChapter = useCallback(() => {
    if (!course?.chapters) return null;
    
    // Trouver le prochain chapitre non complété
    const nextChapter = course.chapters.find(c => !completedChapters.includes(c.id));
    return nextChapter;
  }, [course, completedChapters]);

  const handleContinue = useCallback(() => {
    const nextChapter = getNextChapter();
    if (nextChapter) {
      navigate(`/course/${nextChapter.id}`);
    }
  }, [getNextChapter, navigate]);

  // =============================
  // 5️⃣ UTILITAIRES
  // =============================
  const progress = useMemo(() => {
    if (!course?.chapters?.length) return 0;
    return (completedChapters.length / course.chapters.length) * 100;
  }, [course, completedChapters]);

  const getCoverImageUrl = useCallback(() => {
    if (!course?.coverImage || imageError) return null;
    if (course.coverImage.startsWith('http')) return course.coverImage;
    return getImageUrl(course.coverImage, 'uploads');
  }, [course, imageError]);

  const isChapterLocked = useCallback((index) => {
    // Le premier chapitre n'est jamais verrouillé
    if (index === 0) return false;
    
    // Vérifier si tous les chapitres précédents sont complétés
    const previousChapters = course?.chapters?.slice(0, index) || [];
    return !previousChapters.every(c => completedChapters.includes(c.id));
  }, [course, completedChapters]);

  const isChapterCompleted = useCallback((chapterId) => {
    return completedChapters.includes(chapterId);
  }, [completedChapters]);

  // =============================
  // 6️⃣ ÉTATS DE CHARGEMENT
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24 transition-colors duration-300">
        <div className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white px-4 py-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold">Chargement du cours...</h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <SkeletonCourseDetail isLoading={true} />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-300">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error || 'Cours non trouvé'}</p>
          <Link to="/courses">
            <Button className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white">
              Retour aux cours
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const nextChapter = getNextChapter();

  return (
    <div data-testid="course-detail-page" className="min-h-screen bg-background transition-colors duration-300 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/courses">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          
          <div className="flex items-start gap-4">
            {/* Image de couverture avec fallback */}
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {getCoverImageUrl() ? (
                <img 
                  src={getCoverImageUrl()}
                  alt={course.title}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <BookOpen className="w-8 h-8" />
              )}
            </div>
            <div className="flex-1">
              <Badge className="mb-2 bg-white/20 text-white border-white/30">
                {course.level || 'Débutant'}
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">{course.title}</h1>
              <p className="text-white/90 mb-4">{course.description}</p>
              
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{course.chapters?.length || 0} chapitres</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{course.students_count || 0} étudiants</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Progress Card */}
        <Card className="p-6 mb-6 bg-card border border-border shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-foreground">Ta progression</h2>
            <span className="text-sm font-semibold text-[#00B894]">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 mb-2 bg-secondary" />
          <p className="text-sm text-muted-foreground">
            {completedChapters.length} sur {course.chapters?.length || 0} chapitres complétés
          </p>
          {updating && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Synchronisation...
            </div>
          )}
        </Card>

        {/* Bouton Continuer */}
        {nextChapter && (
          <Button 
            onClick={handleContinue}
            className="w-full mb-6 bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white font-black py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
          >
            <Sparkles className="w-5 h-5 mr-2 group-hover:animate-pulse" />
            Continuer le cours
            <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}

        {/* Chapters */}
        <Card className="p-6 bg-card border border-border shadow-md">
          <h2 className="text-xl font-bold text-foreground mb-4">Contenu du cours</h2>
          
          {course.chapters && course.chapters.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {course.chapters.map((chapter, index) => {
                const isCompleted = isChapterCompleted(chapter.id);
                const isLocked = isChapterLocked(index);
                
                return (
                  <AccordionItem key={chapter.id} value={chapter.id} className="border-border">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : isLocked ? (
                          <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-muted flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={`font-semibold ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {index + 1}. {chapter.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{chapter.duration || '30 min'}</p>
                        </div>
                        {isCompleted && (
                          <Badge className="bg-green-500/20 text-green-500 border-none text-[10px]">
                            Complété ✓
                          </Badge>
                        )}
                        {isLocked && !isCompleted && (
                          <Badge className="bg-yellow-500/20 text-yellow-500 border-none text-[10px]">
                            Verrouillé
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-8 pt-2 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {chapter.description || `Ce chapitre couvre les concepts essentiels de ${chapter.title.toLowerCase()}. 
                          Vous apprendrez les principes fondamentaux et leur application pratique.`}
                        </p>
                        
                        <div className="flex gap-2">
                          {!isLocked ? (
                            <Button 
                              size="sm"
                              className="bg-gradient-to-r from-[#00B894] to-[#0984E3] text-white"
                              onClick={() => completeChapter(chapter.id)}
                              disabled={updating}
                            >
                              <PlayCircle className="w-4 h-4 mr-2" />
                              {isCompleted ? 'Revoir le chapitre' : 'Commencer'}
                            </Button>
                          ) : (
                            <Button 
                              size="sm"
                              variant="outline"
                              className="border-border text-muted-foreground cursor-not-allowed"
                              disabled
                            >
                              <Lock className="w-4 h-4 mr-2" />
                              Complétez les chapitres précédents
                            </Button>
                          )}
                          
                          {isCompleted && (
                            <Badge className="bg-green-500/20 text-green-500 border-none py-1.5 px-3">
                              ✓ Complété
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun chapitre disponible</p>
            </div>
          )}
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

CourseDetail.propTypes = {};

export default CourseDetail;
