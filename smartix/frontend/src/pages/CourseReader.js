import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import BookCover from '../components/BookCover';
import PageTurn from '../components/PageTurn';
import QuizPage from '../components/QuizPage';
import QuizSummary from '../components/QuizSummary';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const XP_REWARD = 50;
const MAX_ATTEMPTS = 3;
const COOLDOWN_HOURS = 24;
const ANALYTICS_BATCH_SIZE = 5; // Envoyer les analytics par lots de 5 pages

/**
 * CourseReader - Page principale de lecture de cours et quiz
 * Route: /course/:chapterId
 */
const CourseReader = () => {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();

  // États principaux
  const [mode, setMode] = useState('cover'); // cover, reading, quiz, summary
  const [currentPage, setCurrentPage] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizResults, setQuizResults] = useState([]);
  const [currentSeries, setCurrentSeries] = useState('A');
  const [attemptCount, setAttemptCount] = useState(0);
  const [chapter, setChapter] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextAttemptAt, setNextAttemptAt] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [isPreloadingQuiz, setIsPreloadingQuiz] = useState(false);

  // Analytics
  const [pageViewTimes, setPageViewTimes] = useState([]);
  const [pageStartTime, setPageStartTime] = useState(null);
  const analyticsQueueRef = useRef([]);
  const pageSaveTimeout = useRef(null);

  // =============================
  // 1️⃣ CHARGEMENT DES DONNÉES AVEC REACT QUERY
  // =============================
  const { data: chapterData, isLoading: chapterLoading } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: async () => {
      const res = await client.get(`/courses/chapters/${chapterId}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!chapterId,
    placeholderData: () => {
      const cached = localStorage.getItem(`chapter-${chapterId}`);
      return cached ? JSON.parse(cached) : undefined;
    }
  });

  const { data: progressData, refetch: refetchProgress } = useQuery({
    queryKey: ['chapter-progress', chapterId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await client.get(`/users/progress/chapter/${chapterId}`);
      return res.data;
    },
    enabled: !!user && !!chapterId,
    staleTime: 30 * 1000 // 30 secondes
  });

  // ✅ PRÉCHARGEMENT DU QUIZ PENDANT LA LECTURE
  const { data: preloadedQuiz, refetch: refetchQuiz } = useQuery({
    queryKey: ['quiz', chapterId, currentSeries],
    queryFn: async () => {
      const res = await client.get(`/courses/chapters/${chapterId}/quiz`, {
        params: { series: currentSeries }
      });
      return res.data;
    },
    enabled: mode === 'reading' && !!chapterId && !!currentSeries,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000
  });

  // Mettre à jour les données locales quand React Query les charge
  useEffect(() => {
    if (chapterData) {
      setChapter(chapterData);
      localStorage.setItem(`chapter-${chapterId}`, JSON.stringify(chapterData));
    }
  }, [chapterData, chapterId]);

  useEffect(() => {
    if (progressData) {
      setAttemptCount(progressData.attempt_count || 0);
      setCurrentPage(progressData.current_page || 0);
      setNextAttemptAt(progressData.next_attempt_at || null);
      
      if (progressData.current_page > 0 && !progressData.completed) {
        setShowResumeModal(true);
      }
      
      if (progressData.completed) {
        toast.success('🎉 Chapitre déjà validé !');
      }
      
      if (progressData.next_attempt_at && new Date(progressData.next_attempt_at) > new Date()) {
        toast.warning(`Trop d'échecs. Réessaie après ${formatCooldown(progressData.next_attempt_at)}`);
      }
    }
  }, [progressData]);

  // ✅ Utiliser le quiz préchargé quand on lance le quiz
  useEffect(() => {
    if (preloadedQuiz && mode === 'cover') {
      setQuizData(preloadedQuiz);
      setIsPreloadingQuiz(false);
    }
  }, [preloadedQuiz, mode]);

  // =============================
  // 2️⃣ ANALYTICS - TEMPS PAR PAGE
  // =============================
  useEffect(() => {
    if (mode === 'reading' && chapter?.pages?.length) {
      setPageStartTime(Date.now());
      
      return () => {
        if (pageStartTime) {
          const timeSpent = Date.now() - pageStartTime;
          const newView = {
            pageNumber: currentPage + 1,
            timeSpent,
            timestamp: new Date().toISOString(),
            chapterId
          };
          setPageViewTimes(prev => [...prev, newView]);
          analyticsQueueRef.current.push(newView);
          
          // Envoyer par lots
          if (analyticsQueueRef.current.length >= ANALYTICS_BATCH_SIZE) {
            sendAnalytics();
          }
        }
      };
    }
  }, [mode, currentPage, chapter?.pages?.length, pageStartTime, chapterId]);

  const sendAnalytics = useCallback(async () => {
    if (analyticsQueueRef.current.length === 0) return;
    
    const batch = [...analyticsQueueRef.current];
    analyticsQueueRef.current = [];
    
    try {
      await client.post('/analytics/page-views', { views: batch });
    } catch (err) {
      console.error('Error sending analytics:', err);
      // Réintégrer les données non envoyées
      analyticsQueueRef.current = [...batch, ...analyticsQueueRef.current];
    }
  }, [client]);

  // Envoyer les analytics restants avant de quitter
  useEffect(() => {
    return () => {
      if (analyticsQueueRef.current.length > 0) {
        sendAnalytics();
      }
    };
  }, [sendAnalytics]);

  // =============================
  // 3️⃣ SAUVEGARDE DE LA PROGRESSION
  // =============================
  const saveProgress = useCallback(async (data = {}) => {
    if (!user || !chapterId) return;
    
    if (pageSaveTimeout.current) {
      clearTimeout(pageSaveTimeout.current);
    }
    
    pageSaveTimeout.current = setTimeout(async () => {
      try {
        await client.post(`/users/progress/chapter/${chapterId}`, {
          current_page: currentPage,
          attempt_count: attemptCount,
          last_series: currentSeries,
          ...data
        });
        refetchProgress();
      } catch (err) {
        console.error('Error saving progress:', err);
      }
    }, 1000);
  }, [user, chapterId, client, currentPage, attemptCount, currentSeries, refetchProgress]);

  // Sauvegarde automatique
  useEffect(() => {
    if (mode === 'reading' && currentPage > 0) {
      saveProgress();
    }
  }, [currentPage, mode, saveProgress]);

  // =============================
  // 4️⃣ RÉCOMPENSE XP
  // =============================
  const awardXP = useCallback(async () => {
    try {
      await client.post('/users/xp', { amount: XP_REWARD, source: 'chapter_completion', chapterId });
      toast.success(`🎉 +${XP_REWARD} XP gagné !`);
    } catch (err) {
      console.error('Error awarding XP:', err);
    }
  }, [client, chapterId]);

  // =============================
  // 5️⃣ HANDLERS
  // =============================
  const handleOpenBook = useCallback(() => {
    setMode('reading');
    saveProgress({ current_page: 0 });
    // ✅ Déclencher le préchargement du quiz
    setIsPreloadingQuiz(true);
    refetchQuiz();
  }, [saveProgress, refetchQuiz]);

  const handleResume = useCallback(() => {
    setShowResumeModal(false);
    setMode('reading');
  }, []);

  const handleRestart = useCallback(() => {
    setShowResumeModal(false);
    setCurrentPage(0);
    setMode('reading');
    saveProgress({ current_page: 0 });
  }, [saveProgress]);

  const handleNextPage = useCallback(() => {
    if (currentPage < (chapter?.pages?.length || 0) - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      launchQuiz();
    }
  }, [currentPage, chapter]);

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  // ✅ LAUNCH QUIZ AVEC LES DONNÉES PRÉCHARGÉES
  const launchQuiz = useCallback(async () => {
    // Vérifier les tentatives
    if (attemptCount >= MAX_ATTEMPTS) {
      if (nextAttemptAt && new Date(nextAttemptAt) > new Date()) {
        toast.error(`Trop de tentatives. Réessaie après ${formatCooldown(nextAttemptAt)}`);
        navigate('/courses');
        return;
      }
    }
    
    // ✅ Utiliser les données préchargées si disponibles
    if (preloadedQuiz?.questions?.length) {
      setQuizData(preloadedQuiz);
      setMode('quiz');
      setCurrentQuestionIndex(0);
      setQuizResults([]);
      return;
    }
    
    // Fallback: charger maintenant
    try {
      const quizRes = await client.get(`/courses/chapters/${chapterId}/quiz`, {
        params: { series: currentSeries }
      });
      
      if (!quizRes.data?.questions?.length) {
        toast.info('Ce chapitre n\'a pas encore de quiz. Tu peux le marquer comme terminé.', {
          duration: 5000,
          icon: '📚'
        });
        setMode('summary');
        setQuizResults([]);
        setQuizData({ questions: [] });
        return;
      }
      
      setQuizData(quizRes.data);
      setMode('quiz');
      setCurrentQuestionIndex(0);
      setQuizResults([]);
      
    } catch (err) {
      console.error('Error loading quiz:', err);
      toast.info('Quiz temporairement indisponible. Tu peux continuer sans.', {
        duration: 4000,
        icon: '⚠️'
      });
      setMode('summary');
      setQuizResults([]);
      setQuizData({ questions: [] });
    }
  }, [attemptCount, nextAttemptAt, navigate, preloadedQuiz, chapterId, client, currentSeries]);

  const handleQuizAnswer = useCallback((isCorrect, timeSpent, choiceIndex, explanation) => {
    const result = {
      questionNumber: currentQuestionIndex + 1,
      isCorrect,
      timeSpent,
      choiceIndex,
      explanation
    };
    setQuizResults(prev => [...prev, result]);
    
    if (isCorrect) {
      toast.success('✅ Bonne réponse !');
    } else {
      toast.error('❌ Mauvaise réponse');
      if (explanation) {
        toast.info(`💡 ${explanation}`);
      }
    }
  }, [currentQuestionIndex]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < (quizData?.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setMode('summary');
    }
  }, [currentQuestionIndex, quizData]);

  const handleRestartQuiz = useCallback(async () => {
    const nextAttempt = new Date();
    nextAttempt.setHours(nextAttempt.getHours() + COOLDOWN_HOURS);
    
    setNextAttemptAt(nextAttempt);
    
    await client.post(`/users/progress/chapter/${chapterId}`, {
      next_attempt_at: nextAttempt.toISOString()
    });
    
    const seriesOrder = ['A', 'B', 'C'];
    const currentIndex = seriesOrder.indexOf(currentSeries);
    const nextSeries = seriesOrder[(currentIndex + 1) % seriesOrder.length];
    
    setCurrentSeries(nextSeries);
    setAttemptCount(prev => prev + 1);
    setMode('reading');
    setCurrentPage(0);
    setQuizResults([]);
    setIsPreloadingQuiz(true);
    refetchQuiz();
    
    toast.info(`Prochaine tentative: Série ${nextSeries}`);
  }, [currentSeries, client, chapterId, refetchQuiz]);

  const handleQuitQuiz = useCallback(async () => {
    const correctCount = quizResults.filter(r => r.isCorrect).length;
    const totalQuestions = quizData?.questions?.length || 0;
    const score = totalQuestions > 0 
      ? Math.round((correctCount / totalQuestions) * 100) 
      : 100;
    const isPassed = score >= 70;

    // Envoyer les résultats du quiz pour analytics
    await client.post('/analytics/quiz-results', {
      chapterId,
      series: currentSeries,
      score,
      results: quizResults,
      attemptNumber: attemptCount + 1
    }).catch(console.error);

    if (isPassed) {
      await awardXP();
      await saveProgress({ completed: true, completed_at: new Date().toISOString() });
      toast.success('🎉 Chapitre validé ! +50 XP');
    } else {
      await saveProgress({ completed: false });
      toast.info('Progression sauvegardée.');
    }
    
    navigate('/courses');
  }, [quizResults, quizData, currentSeries, attemptCount, awardXP, saveProgress, navigate, client, chapterId]);

  // =============================
  // 6️⃣ UTILITAIRES
  // =============================
  const formatCooldown = (date) => {
    const diff = new Date(date) - new Date();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // =============================
  // 7️⃣ MODAL DE REPRISE
  // =============================
  const ResumeModal = () => (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-white mb-4">Reprendre la lecture ?</h2>
        <p className="text-white/60 mb-6">
          Tu étais à la page {currentPage + 1} sur {chapter?.pages?.length || 0}.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleResume}
            className="flex-1 px-4 py-2 bg-[#ff6b35] text-white rounded-xl font-medium"
          >
            Reprendre
          </button>
          <button
            onClick={handleRestart}
            className="flex-1 px-4 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20"
          >
            Recommencer
          </button>
        </div>
      </div>
    </div>
  );

  // États de chargement
  if (chapterLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#ff6b35]/20 border-t-[#ff6b35] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Chargement du cours...</p>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Chapitre non trouvé'}</p>
          <button
            onClick={() => navigate('/courses')}
            className="px-6 py-2 bg-[#ff6b35] text-white rounded-full"
          >
            Retour aux cours
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="course-reader min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      {/* Modal de reprise */}
      {showResumeModal && <ResumeModal />}
      
      {/* Indicateur de préchargement du quiz */}
      {mode === 'reading' && isPreloadingQuiz && (
        <div className="fixed bottom-20 right-4 z-50 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
          ⚡ Chargement du quiz...
        </div>
      )}
      
      {mode === 'cover' && (
        <BookCover 
          chapter={chapter} 
          onOpen={handleOpenBook} 
          attemptCount={attemptCount}
          maxAttempts={MAX_ATTEMPTS}
        />
      )}

      {mode === 'reading' && (
        <PageTurn
          content={chapter.pages?.[currentPage]}
          pageNumber={currentPage}
          totalPages={chapter.pages?.length || 0}
          onNext={handleNextPage}
          onPrevious={handlePreviousPage}
        />
      )}

      {mode === 'quiz' && quizData?.questions?.length > 0 && (
        <QuizPage
          question={quizData.questions[currentQuestionIndex]}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={quizData.questions.length}
          timePerQuestion={quizData.timePerQuestion || 30}
          onAnswer={handleQuizAnswer}
          onNext={handleNextQuestion}
        />
      )}

      {mode === 'summary' && (
        <QuizSummary
          results={quizResults}
          totalQuestions={quizData?.questions?.length || 0}
          onRestart={handleRestartQuiz}
          onQuit={handleQuitQuiz}
          maxAttempts={MAX_ATTEMPTS}
          attemptsLeft={MAX_ATTEMPTS - attemptCount}
          nextAttemptAt={nextAttemptAt}
        />
      )}
    </div>
  );
};

CourseReader.propTypes = {};

export default CourseReader;
