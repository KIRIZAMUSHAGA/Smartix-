import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Clock, GraduationCap, ChevronRight, Loader2, Upload, FileText, 
  CheckCircle2, Brain, Maximize2, Minimize2, ArrowLeft, ArrowRight, 
  X, FileQuestion, ListChecks, Menu, BookOpen, Award, Target,
  BarChart3, Lightbulb, Settings, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import { useVirtual } from 'react-virtual';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 1000; // 1 seconde
const UPLOAD_TIMEOUT = 180000; // 3 minutes (réseau Afrique)
const RETRY_COUNT = 3;
const RETRY_DELAY = 2000;
const SESSIONS_PER_PAGE = 20; // Pagination côté frontend

// =============================
// HOOK: RETRY AUTOMATIQUE
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
// HOOK: CIRCUIT BREAKER
// =============================
const useCircuitBreaker = () => {
  const [failureCount, setFailureCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);

  const recordSuccess = useCallback(() => {
    setFailureCount(0);
    if (isOpen) {
      setIsOpen(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [isOpen]);

  const recordFailure = useCallback(() => {
    setFailureCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setIsOpen(true);
        timeoutRef.current = setTimeout(() => {
          setIsOpen(false);
          setFailureCount(0);
        }, 60000); // 1 minute
      }
      return newCount;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { isOpen, recordSuccess, recordFailure };
};

// =============================
// COMPOSANT MODE IMMERSIF
// =============================
const ImmersiveReader = ({ session, onClose, onProgressUpdate }) => {
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const sections = session.analysis?.sections || [];
  const totalSections = sections.length;
  const currentSection = sections[currentSectionIdx];
  const [progress, setProgress] = useState(session.progress || 0);

  const handleNext = useCallback(() => {
    if (currentSectionIdx < totalSections - 1) {
      const newIdx = currentSectionIdx + 1;
      setCurrentSectionIdx(newIdx);
      const newProgress = ((newIdx + 1) / totalSections) * 100;
      setProgress(newProgress);
      onProgressUpdate?.(session.id, newProgress);
    }
  }, [currentSectionIdx, totalSections, onProgressUpdate, session.id]);

  const handlePrev = useCallback(() => {
    if (currentSectionIdx > 0) {
      const newIdx = currentSectionIdx - 1;
      setCurrentSectionIdx(newIdx);
      const newProgress = ((newIdx + 1) / totalSections) * 100;
      setProgress(newProgress);
      onProgressUpdate?.(session.id, newProgress);
    }
  }, [currentSectionIdx, onProgressUpdate, session.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in duration-500">
      {/* ... (contenu existant) ... */}
    </div>
  );
};

// =============================
// COMPOSANT SECTION CARD (OPTIMISÉ)
// =============================
const SectionCard = React.memo(({ section, index, isActive, onClick, onImmersive }) => (
  <button
    onClick={onClick}
    className={`group w-full text-left p-4 rounded-2xl transition-all duration-300 border flex items-center gap-3 ${
      isActive 
      ? 'bg-background shadow-md border-[#ff6b35]/50 text-[#ff6b35]' 
      : 'bg-card border-border hover:border-[#ff6b35]/30 text-muted-foreground'
    }`}
  >
    <span className={`text-xs font-black ${isActive ? 'text-[#ff6b35]' : 'text-muted-foreground'}`}>
      {(index + 1).toString().padStart(2, '0')}
    </span>
    <span className="text-sm font-bold truncate flex-1">{section.title}</span>
    {onImmersive && (
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onImmersive(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
    )}
  </button>
));

SectionCard.displayName = 'SectionCard';

// =============================
// COMPOSANT SIDEBAR VIRTUALISÉ
// =============================
const VirtualizedSessionList = ({ sessions, selectedSessionId, onSelect, formatDate }) => {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtual({
    size: sessions.length,
    parentRef,
    estimateSize: useCallback(() => 120, []),
    overscan: 5
  });

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.totalSize}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.virtualItems.map((virtualRow) => {
          const session = sessions[virtualRow.index];
          return (
            <div
              key={session.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <button
                onClick={() => onSelect(session.id)}
                className={`w-full text-left p-4 rounded-2xl transition-all duration-300 border group ${
                  selectedSessionId === session.id 
                  ? 'bg-[#ff6b35] border-[#ff6b35] text-white shadow-lg' 
                  : 'bg-card border-border hover:border-[#ff6b35]/50 hover:bg-accent text-muted-foreground'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-bold text-sm mb-2 line-clamp-2 flex-1 ${
                    selectedSessionId === session.id ? 'text-white' : 'text-foreground'
                  }`}>
                    {session.title}
                  </h3>
                  {session.status === 'analyzed' && (
                    <CheckCircle2 className={`w-3 h-3 mt-1 ${
                      selectedSessionId === session.id ? 'text-white' : 'text-green-500'
                    }`} />
                  )}
                </div>
                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${
                  selectedSessionId === session.id ? 'text-white/80' : 'text-muted-foreground'
                }`}>
                  <Clock className="w-3 h-3" />
                  {formatDate(session.createdAt)}
                </div>
                {session.progress > 0 && (
                  <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white/60 rounded-full transition-all"
                      style={{ width: `${session.progress}%` }}
                    />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const TeacherMode = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getTeacherCache, updateTeacherCache } = useGlobalCache();
  const { executeWithRetry } = useRetry();
  const { isOpen: circuitOpen, recordSuccess, recordFailure } = useCircuitBreaker();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [activeTab, setActiveTab] = useState('parcours');
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [downloadingExam, setDownloadingExam] = useState(false);
  const [page, setPage] = useState(1);
  
  const fileInputRef = useRef(null);
  const sidebarRef = useRef(null);

  // ✅ Optimisation: selectedSession mémorisé
  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  // ✅ Pagination des sessions
  const paginatedSessions = useMemo(() => {
    return sessions.slice(0, page * SESSIONS_PER_PAGE);
  }, [sessions, page]);

  const hasMore = sessions.length > paginatedSessions.length;

  // ✅ Sélection de session
  const handleSessionSelect = useCallback((sessionId) => {
    setSelectedSessionId(sessionId);
    setSelectedSectionIdx(0);
    setActiveTab('parcours');
    if (window.innerWidth < 1024) {
      setShowSidebar(false);
    }
  }, []);

  // ✅ Progression avec debounce et cancel
  const handleProgressUpdate = useCallback(async (sessionId, progress) => {
    if (circuitOpen) {
      console.warn('Circuit breaker open, skipping progress update');
      return;
    }
    try {
      await executeWithRetry(() => client.post(`/teacher/session/${sessionId}/progress`, { progress }));
      recordSuccess();
    } catch (error) {
      recordFailure();
      console.error('Progress update failed:', error);
    }
  }, [client, executeWithRetry, circuitOpen, recordSuccess, recordFailure]);

  const debouncedProgressUpdate = useMemo(
    () => debounce(handleProgressUpdate, DEBOUNCE_DELAY),
    [handleProgressUpdate]
  );

  // ✅ Nettoyage du debounce
  useEffect(() => {
    return () => {
      debouncedProgressUpdate.cancel();
    };
  }, [debouncedProgressUpdate]);

  // ✅ Récupération des sessions (avec pagination)
  const fetchSessions = useCallback(async (force = false) => {
    if (!user) return;

    try {
      if (!force) {
        const cached = getTeacherCache(user.id);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setSessions(cached.data);
          if (cached.data.length > 0 && !selectedSessionId) {
            setSelectedSessionId(cached.data[0].id);
          }
          setLoading(false);
          return;
        }
      }

      const response = await executeWithRetry(() => client.get('/teacher/sessions?limit=1000'));
      const sessionsData = response.data || [];
      setSessions(sessionsData);
      
      if (sessionsData.length > 0 && !selectedSessionId) {
        setSelectedSessionId(sessionsData[0].id);
      }
      
      updateTeacherCache(user.id, {
        data: sessionsData,
        timestamp: Date.now()
      });
      recordSuccess();
    } catch (error) {
      recordFailure();
      console.error('Failed to fetch sessions:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 403) {
        toast.error('Accès non autorisé');
        navigate('/home');
      } else if (circuitOpen) {
        toast.error('Service temporairement indisponible, réessayez plus tard');
      } else {
        toast.error("Erreur lors de la récupération des sessions");
      }
    } finally {
      setLoading(false);
    }
  }, [user, client, getTeacherCache, updateTeacherCache, selectedSessionId, navigate, executeWithRetry, recordSuccess, recordFailure, circuitOpen]);

  // =============================
  // VÉRIFICATION RÔLE ENSEIGNANT
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (user.role !== 'teacher' && !user.isAdmin) {
      toast.error('Accès réservé aux enseignants');
      navigate('/home');
    } else {
      setIsTeacher(true);
    }
  }, [user, navigate]);

  // =============================
  // CLIC EXTÉRIEUR SIDEBAR
  // =============================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target) && showSidebar) {
        setShowSidebar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSidebar]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    if (isTeacher) {
      fetchSessions();
    }
  }, [isTeacher, fetchSessions]);

  // ✅ Réinitialisation quand la session change
  useEffect(() => {
    setSelectedSectionIdx(0);
    setActiveTab('parcours');
  }, [selectedSessionId]);

  // =============================
  // UPLOAD FICHIER (avec retry)
  // =============================
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.type.includes('text/plain')) {
      toast.error('Format non supporté', {
        description: 'Seuls les fichiers PDF et TXT sont acceptés'
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    setUploading(true);
    try {
      await executeWithRetry(() => client.post('/teacher/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT
      }));
      
      toast.success('Cours importé avec succès');
      await fetchSessions(true);
      
      // Mise à jour optimiste locale
      const newSession = {
        id: Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        status: 'uploaded',
        createdAt: new Date().toISOString(),
        progress: 0
      };
      setSessions(prev => [newSession, ...prev]);
      setSelectedSessionId(newSession.id);
      
    } catch (error) {
      console.error('Upload failed:', error);
      
      if (error.response?.status === 413) {
        toast.error('Fichier trop volumineux', {
          description: 'Taille maximale: 50MB'
        });
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Upload trop long', {
          description: 'Vérifiez votre connexion'
        });
      } else if (circuitOpen) {
        toast.error('Service temporairement indisponible, réessayez plus tard');
      } else {
        toast.error(error.response?.data?.detail || "Erreur lors de l'importation");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // =============================
  // ANALYSE (avec update optimiste)
  // =============================
  const handleAnalyze = async () => {
    if (!selectedSessionId) return;
    
    setAnalyzing(true);
    
    // Mise à jour optimiste
    setSessions(prev => prev.map(s => 
      s.id === selectedSessionId ? { ...s, status: 'analyzing' } : s
    ));
    
    try {
      await executeWithRetry(() => client.post(`/teacher/analyze/${selectedSessionId}`));
      toast.success('Analyse terminée');
      await fetchSessions(true);
      recordSuccess();
    } catch (error) {
      recordFailure();
      console.error('Analysis failed:', error);
      
      // Rollback optimiste
      setSessions(prev => prev.map(s => 
        s.id === selectedSessionId ? { ...s, status: 'uploaded' } : s
      ));
      
      if (error.response?.status === 429) {
        toast.error('Trop de requêtes', {
          description: 'Attendez quelques instants'
        });
      } else if (circuitOpen) {
        toast.error('Service temporairement indisponible, réessayez plus tard');
      } else {
        toast.error(error.response?.data?.detail || "Erreur lors de l'analyse");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // =============================
  // GÉNÉRATION EXAMEN
  // =============================
  const handleGenerateExam = async () => {
    if (!selectedSessionId) return;
    
    setGeneratingExam(true);
    
    // Mise à jour optimiste
    setSessions(prev => prev.map(s => 
      s.id === selectedSessionId ? { ...s, examStatus: 'generating' } : s
    ));
    
    try {
      await executeWithRetry(() => client.post(`/teacher/generate-exam/${selectedSessionId}`));
      toast.success('Fiche d\'examen générée');
      await fetchSessions(true);
      setActiveTab('exam');
      recordSuccess();
    } catch (error) {
      recordFailure();
      console.error('Exam generation failed:', error);
      toast.error(error.response?.data?.detail || "Erreur lors de la génération de l'examen");
    } finally {
      setGeneratingExam(false);
    }
  };

  // =============================
  // TÉLÉCHARGEMENT PDF (avec retry)
  // =============================
  const handleDownloadExam = async () => {
    if (!selectedSession?.exam_sheet?.id) {
      toast.error('Aucun examen à télécharger');
      return;
    }

    setDownloadingExam(true);
    try {
      await executeWithRetry(async () => {
        const response = await fetch(`/api/teacher/exam/${selectedSession.id}/download`, {
          headers: {
            'Authorization': `Bearer ${user?.token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${selectedSession.title.replace(/[^a-z0-9]/gi, '_')}_examen.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        toast.success('Examen téléchargé avec succès');
        recordSuccess();
      });
    } catch (error) {
      recordFailure();
      console.error('Download failed:', error);
      
      if (error.message?.includes('404')) {
        toast.error('Fichier non trouvé', {
          description: 'L\'examen n\'a pas encore été généré'
        });
      } else if (error.message?.includes('401')) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (circuitOpen) {
        toast.error('Service temporairement indisponible, réessayez plus tard');
      } else {
        toast.error('Erreur lors du téléchargement', {
          description: 'Veuillez réessayer'
        });
      }
    } finally {
      setDownloadingExam(false);
    }
  };

  // =============================
  // FORMAT DATE (mémorisé)
  // =============================
  const formatDate = useCallback((dateString) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return 'Date inconnue';
    }
  }, []);

  const totalSections = selectedSession?.analysis?.sections?.length || 0;

  // ✅ Load more pour pagination
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
    }
  }, [hasMore, loading]);

  // =============================
  // RENDU
  // =============================
  if (!isTeacher) return null;

  if (isImmersiveMode && selectedSession?.analysis?.sections) {
    return (
      <ImmersiveReader
        session={selectedSession}
        onClose={() => setIsImmersiveMode(false)}
        onProgressUpdate={debouncedProgressUpdate}
      />
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden transition-all duration-300" />
      )}

      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 w-80 border-r border-border bg-card/80 backdrop-blur-2xl flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#ff6b35] flex items-center justify-center shadow-lg shadow-[#ff6b35]/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight">Espace Enseignant</h1>
          </div>
          
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || circuitOpen}
            className="w-full bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-2xl font-black py-6 shadow-xl shadow-[#ff6b35]/10 transition-all hover:scale-[1.02] active:scale-95"
            aria-label="Importer un cours"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importation...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Importer un cours</>
            )}
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf,.txt" 
            className="hidden" 
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <p className="px-6 pt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Historique des sessions
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 px-4">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium italic">
                Aucun cours dans l'historique
              </p>
            </div>
          ) : (
            <>
              <VirtualizedSessionList
                sessions={paginatedSessions}
                selectedSessionId={selectedSessionId}
                onSelect={handleSessionSelect}
                formatDate={formatDate}
              />
              {hasMore && (
                <div className="p-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={handleLoadMore}
                    className="text-sm text-muted-foreground"
                  >
                    Voir plus de sessions...
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Indicateur circuit breaker */}
        {circuitOpen && (
          <div className="p-4 border-t border-border bg-yellow-500/10">
            <p className="text-xs text-yellow-500 text-center">
              ⚠️ Service temporairement indisponible
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto w-full">
        <div className="max-w-5xl mx-auto">
          {/* Mobile Header */}
          {!selectedSession && (
            <div className="lg:hidden flex items-center justify-between mb-8 p-4 bg-card/50 rounded-2xl border border-border">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowSidebar(true)}
                className="rounded-xl"
                aria-label="Menu"
              >
                <Menu className="w-6 h-6" />
              </Button>
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#ff6b35]" />
                <span className="font-black text-sm">Mode Enseignant</span>
              </div>
              <div className="w-10" />
            </div>
          )}

          {selectedSession ? (
            <div className="space-y-8">
              {/* Header */}
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-8">
                <div className="flex-1">
                  <button
                    onClick={() => setSelectedSessionId(null)}
                    className="text-muted-foreground hover:text-foreground text-sm font-medium mb-2 inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#ff6b35] mb-2">
                    {selectedSession.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4">
                    <p className="text-muted-foreground font-medium text-sm">
                      Session {selectedSession.status === 'uploaded' ? 'importée' : 'consultée'} le {formatDate(selectedSession.lastAccessedAt)}
                    </p>
                    {selectedSession.analysis?.level && (
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                        Niveau: {selectedSession.analysis.level}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="rounded-xl font-bold gap-2"
                    onClick={handleGenerateExam}
                    disabled={generatingExam || !selectedSession.analysis}
                  >
                    {generatingExam ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileQuestion className="w-4 h-4" />}
                    Générer Examen
                  </Button>
                  <Button 
                    onClick={() => {
                      if (selectedSession.status === 'analyzed') {
                        setIsImmersiveMode(true);
                      } else {
                        handleAnalyze();
                      }
                    }}
                    disabled={analyzing}
                    className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-xl font-black px-6"
                  >
                    {analyzing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyse...</>
                    ) : selectedSession.status === 'analyzed' ? (
                      <><Maximize2 className="w-4 h-4 mr-2" /> Lecture immersive</>
                    ) : (
                      'Analyser'
                    )}
                  </Button>
                </div>
              </header>

              {/* Tabs */}
              <div className="flex gap-2 mb-8">
                <Button 
                  variant={activeTab === 'parcours' ? 'default' : 'ghost'} 
                  onClick={() => setActiveTab('parcours')}
                  className="rounded-xl font-black gap-2"
                >
                  <ListChecks className="w-4 h-4" /> Parcours
                </Button>
                <Button 
                  variant={activeTab === 'exam' ? 'default' : 'ghost'} 
                  onClick={() => setActiveTab('exam')}
                  disabled={!selectedSession.exam_sheet}
                  className="rounded-xl font-black gap-2"
                >
                  <FileQuestion className="w-4 h-4" /> Examen
                </Button>
              </div>
              
              {activeTab === 'parcours' ? (
                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Navigation */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="p-4 bg-accent/30 rounded-3xl border border-border">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6b35] mb-4 px-2">
                        Parcours pédagogique
                      </p>
                      <div className="space-y-2">
                        {selectedSession.analysis?.sections?.map((section, idx) => (
                          <SectionCard
                            key={idx}
                            section={section}
                            index={idx}
                            isActive={selectedSectionIdx === idx}
                            onClick={() => setSelectedSectionIdx(idx)}
                            onImmersive={() => setIsImmersiveMode(true)}
                          />
                        ))}
                      </div>
                    </div>

                    {selectedSession.analysis?.keyConcepts && (
                      <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                          <Brain className="w-3 h-3" /> Notions clés
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSession.analysis.keyConcepts.map((concept, idx) => (
                            <span key={idx} className="bg-background/80 px-3 py-1 rounded-lg text-[10px] font-bold border border-border/50">
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="lg:col-span-2">
                    <Card className="p-8 bg-card/50 border border-border rounded-[40px] backdrop-blur-xl h-full">
                      {selectedSession.analysis?.sections ? (
                        <>
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                              <h2 className="text-xl font-black">
                                {selectedSession.analysis.sections[selectedSectionIdx]?.title}
                              </h2>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                Section {selectedSectionIdx + 1}/{totalSections}
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setIsImmersiveMode(true)}
                              className="rounded-full hover:bg-primary/10 text-primary"
                              title="Mode immersif"
                            >
                              <Maximize2 className="w-5 h-5" />
                            </Button>
                          </div>
                          
                          <div className="bg-background/50 rounded-3xl p-6 border border-border/50 max-h-[600px] overflow-y-auto">
                            <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium">
                              {selectedSession.analysis.sections[selectedSectionIdx]?.content}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                            <Brain className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-bold mb-2">Analyse requise</h3>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            Cliquez sur le bouton "Analyser" pour découper le cours en sections pédagogiques.
                          </p>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              ) : (
                // Examen
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-2xl font-black text-[#ff6b35]">
                      {selectedSession.exam_sheet?.title}
                    </h2>
                    <Button 
                      variant="outline" 
                      className="rounded-xl font-bold gap-2"
                      onClick={handleDownloadExam}
                      disabled={downloadingExam}
                    >
                      {downloadingExam ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Télécharger PDF
                    </Button>
                  </div>
                  
                  <div className="grid gap-6">
                    {selectedSession.exam_sheet?.questions?.map((q, idx) => (
                      <Card key={idx} className="p-8 bg-card border border-border rounded-[32px] shadow-xl">
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-[#ff6b35] text-white flex items-center justify-center font-black flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="space-y-4 flex-1">
                            <p className="text-lg font-bold">{q.question}</p>
                            
                            {q.type === 'qcm' && q.options && (
                              <div className="grid sm:grid-cols-2 gap-3">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="p-4 rounded-2xl bg-secondary/50 border border-border text-sm font-medium">
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="pt-4 mt-4 border-t border-border">
                              <p className="text-xs font-black uppercase tracking-widest text-[#ff6b35]">Réponse suggérée :</p>
                              <p className="text-sm text-muted-foreground mt-1 font-medium">{q.answer}</p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Empty State
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="w-32 h-32 bg-accent rounded-[40px] flex items-center justify-center mb-8 animate-pulse">
                <GraduationCap className="w-16 h-16 text-[#ff6b35]" />
              </div>
              <h2 className="text-3xl font-black mb-4">Bienvenue dans le Mode Enseignant</h2>
              <p className="text-muted-foreground max-w-lg text-lg font-medium mb-8">
                Commencez par importer un cours au format PDF ou texte pour l'analyser et créer du contenu pédagogique.
              </p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-2xl font-black px-10 py-8 text-xl shadow-2xl shadow-[#ff6b35]/20 transition-all hover:scale-105"
              >
                {uploading ? (
                  <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Importation...</>
                ) : (
                  <><Upload className="w-6 h-6 mr-3" /> Importer un cours</>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

TeacherMode.propTypes = {};

export default TeacherMode;
ImmersiveReader.propTypes = {
  session: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onProgressUpdate: PropTypes.func.isRequired,
};
VirtualizedSessionList.propTypes = {
  sessions: PropTypes.any.isRequired,
  selectedSessionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSelect: PropTypes.func.isRequired,
  formatDate: PropTypes.any.isRequired,
};
