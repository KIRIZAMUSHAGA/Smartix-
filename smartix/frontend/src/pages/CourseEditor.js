import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { 
  ArrowLeft, 
  Save, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  FileText, 
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Sparkles,
  Trophy,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '../hooks/useDebounce';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from '../components/SortableItem';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT DE CONFIRMATION
// =============================
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, description }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-white/60 mb-6">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================
// 2️⃣ COMPOSANT DE BANDEAU DE SAUVEGARDE
// =============================
const SaveIndicator = ({ status }) => {
  const statusConfig = {
    saving: { icon: Loader2, text: 'Enregistrement...', color: 'text-blue-500', spin: true },
    saved: { icon: CheckCircle, text: 'Enregistré', color: 'text-green-500' },
    error: { icon: AlertCircle, text: 'Erreur', color: 'text-red-500' },
    pending: { icon: Clock, text: 'Modifications en attente', color: 'text-yellow-500' }
  };
  
  const config = statusConfig[status] || statusConfig.saved;
  const Icon = config.icon;
  
  return (
    <div className={`flex items-center gap-2 text-xs ${config.color}`}>
      <Icon className={`w-4 h-4 ${config.spin ? 'animate-spin' : ''}`} />
      <span>{config.text}</span>
    </div>
  );
};

// =============================
// 3️⃣ COMPOSANT DE RÉCOMPENSE
// =============================
const RewardToast = ({ xp, streak, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className="fixed bottom-20 right-4 z-50 bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] rounded-xl p-4 shadow-2xl animate-slideUp">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold">🎉 +{xp} XP</p>
          {streak > 0 && (
            <p className="text-white/80 text-xs">🔥 Streak de {streak} jours !</p>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================
// 4️⃣ COMPOSANT PRINCIPAL
// =============================
const CourseEditor = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  const [activePageId, setActivePageId] = useState(null);
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [saveStatus, setSaveStatus] = useState('saved');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [rewardXp, setRewardXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const sidebarRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastSavedRef = useRef({ title: "", content: "" });

  // Sensors pour drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // =============================
  // 5️⃣ QUERIES AVEC REACT QUERY
  // =============================
  const { data: course, isLoading, refetch } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const res = await client.get(`/courses/${courseId}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation pour mettre à jour une page individuellement (PATCH)
  const updatePageMutation = useMutation({
    mutationFn: async ({ pageId, title, content }) => {
      const res = await client.patch(`/courses/${courseId}/pages/${pageId}`, {
        title,
        content
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['course', courseId]);
      setSaveStatus('saved');
      setPendingChanges(false);
    },
    onError: (error) => {
      console.error(error);
      setSaveStatus('error');
      toast.error("Erreur lors de l'enregistrement");
    }
  });

  // Mutation pour créer une page
  const createPageMutation = useMutation({
    mutationFn: async ({ title, content, order }) => {
      const res = await client.post(`/courses/${courseId}/pages`, {
        title,
        content,
        order
      });
      return res.data;
    },
    onSuccess: (newPage) => {
      queryClient.invalidateQueries(['course', courseId]);
      setActivePageId(newPage.id);
      toast.success("Page ajoutée");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erreur lors de l'ajout de la page");
    }
  });

  // Mutation pour supprimer une page
  const deletePageMutation = useMutation({
    mutationFn: async (pageId) => {
      await client.delete(`/courses/${courseId}/pages/${pageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['course', courseId]);
      setDeleteModalOpen(false);
      setPageToDelete(null);
      toast.success("Page supprimée");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erreur lors de la suppression");
    }
  });

  // Mutation pour réordonner les pages
  const reorderPagesMutation = useMutation({
    mutationFn: async (orderedPages) => {
      await client.put(`/courses/${courseId}/pages/reorder`, {
        pages: orderedPages.map((p, i) => ({ id: p.id, order: i }))
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['course', courseId]);
    }
  });

  // Mutation pour publier
  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await client.patch(`/courses/${courseId}/publish`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['course', courseId]);
      toast.success("Cours publié avec succès !");
      
      setRewardXp(50);
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3000);
      client.post('/users/xp', { amount: 50, source: 'course_publish' }).catch(console.error);
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || "Erreur lors de la publication";
      toast.error(msg);
    }
  });

  // =============================
  // 6️⃣ ÉTATS DÉRIVÉS
  // =============================
  const pages = course?.pages || [];
  const activePage = pages.find(p => p.id === activePageId);

  // Synchronisation de l'état local avec la page active
  useEffect(() => {
    if (activePage) {
      setLocalTitle(activePage.title || "");
      setLocalContent(activePage.content || "");
      lastSavedRef.current = { title: activePage.title || "", content: activePage.content || "" };
      setPendingChanges(false);
      setSaveStatus('saved');
    } else if (pages.length > 0 && !activePageId) {
      setActivePageId(pages[0].id);
    }
  }, [activePageId, activePage, pages]);

  // =============================
  // 7️⃣ SAUVEGARDE OPTIMISÉE (PATCH individuel)
  // =============================
  const debouncedTitle = useDebounce(localTitle, 2000);
  const debouncedContent = useDebounce(localContent, 2000);

  useEffect(() => {
    if (activePage && (debouncedTitle !== lastSavedRef.current.title || debouncedContent !== lastSavedRef.current.content)) {
      setPendingChanges(true);
      setSaveStatus('pending');
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        updatePageMutation.mutate({
          pageId: activePage.id,
          title: debouncedTitle,
          content: debouncedContent
        });
      }, 2000);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedTitle, debouncedContent, activePage, updatePageMutation]);

  // Sauvegarde manuelle avec Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        if (activePage) {
          updatePageMutation.mutate({
            pageId: activePage.id,
            title: localTitle,
            content: localContent
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePage, localTitle, localContent, updatePageMutation]);

  // Sauvegarde au blur
  const handleBlur = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (activePage && (localTitle !== lastSavedRef.current.title || localContent !== lastSavedRef.current.content)) {
      updatePageMutation.mutate({
        pageId: activePage.id,
        title: localTitle,
        content: localContent
      });
    }
  }, [activePage, localTitle, localContent, updatePageMutation]);

  // =============================
  // 8️⃣ GESTION DES PAGES
  // =============================
  const handleAddPage = useCallback(() => {
    createPageMutation.mutate({
      title: "Nouvelle Page",
      content: "",
      order: pages.length
    });
  }, [createPageMutation, pages.length]);

  const handleDeletePage = useCallback(() => {
    if (pageToDelete) {
      deletePageMutation.mutate(pageToDelete);
    }
  }, [pageToDelete, deletePageMutation]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = pages.findIndex(p => p.id === active.id);
      const newIndex = pages.findIndex(p => p.id === over?.id);
      const newPages = arrayMove(pages, oldIndex, newIndex);
      
      // Mise à jour optimiste
      queryClient.setQueryData(['course', courseId], (old) => ({
        ...old,
        pages: newPages
      }));
      
      reorderPagesMutation.mutate(newPages);
    }
  }, [pages, courseId, queryClient, reorderPagesMutation]);

  // =============================
  // 9️⃣ CHARGEMENT DU STREAK
  // =============================
  useEffect(() => {
    if (user) {
      client.get('/users/streak').then(res => {
        setStreak(res.data.streak || 0);
      }).catch(console.error);
    }
  }, [user, client]);

  // =============================
  // 🔟 CLIC EXTÉRIEUR SUR LA SIDEBAR
  // =============================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target) && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sidebarOpen]);

  // =============================
  // 1️⃣1️⃣ ÉTATS DE CHARGEMENT
  // =============================
  if (isLoading || !course) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
          <p className="text-muted-foreground font-medium animate-pulse">Chargement du contenu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden font-sans">
      {/* Reward Toast */}
      {showReward && <RewardToast xp={rewardXp} streak={streak} onClose={() => setShowReward(false)} />}
      
      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className={`${
          sidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full'
        } bg-card border-r border-border transition-all duration-300 flex flex-col overflow-hidden fixed md:relative z-50 h-full shadow-2xl md:shadow-none`}
      >
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="font-black text-lg tracking-tight">Plan du cours</h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pages.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {pages.map((page, index) => (
                  <SortableItem key={page.id} id={page.id}>
                    <div
                      onClick={() => setActivePageId(page.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group ${
                        activePageId === page.id 
                        ? 'bg-[#ff6b35] text-white shadow-lg shadow-[#ff6b35]/20' 
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 opacity-30 shrink-0 cursor-grab" />
                      <span className="font-bold text-sm truncate flex-1">{page.title}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white p-0 shrink-0 transition-all"
                        onClick={(e) => { e.stopPropagation(); setPageToDelete(page.id); setDeleteModalOpen(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          
          <Button 
            variant="outline" 
            onClick={handleAddPage}
            disabled={createPageMutation.isPending}
            className="w-full mt-4 border-dashed border-2 rounded-xl py-6 hover:border-[#ff6b35] hover:text-[#ff6b35] transition-all"
          >
            {createPageMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Ajouter une page
          </Button>
        </div>

        <div className="p-4 border-t border-border bg-muted/30">
          <Link to={`/courses/${courseId}/edit`}>
            <Button variant="ghost" className="w-full justify-start text-sm font-bold">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux fichiers
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-xl px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#ff6b35]">Mode Éditeur</span>
              <h1 className="font-black text-sm truncate max-w-[200px] md:max-w-md">{course.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {pendingChanges && <SaveIndicator status="pending" />}
            <SaveIndicator status={saveStatus} />
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
              course.status === 'published' 
              ? 'bg-green-500/10 text-green-500' 
              : 'bg-muted text-muted-foreground'
            }`}>
              {course.status === 'published' ? 'PUBLIÉ' : 'BROUILLON'}
            </span>
            <Button variant="outline" size="sm" className="rounded-xl font-bold" onClick={() => navigate(`/course/${courseId}/preview`)}>
              <Eye className="w-4 h-4 mr-1" />
              Aperçu
            </Button>
            {course.status !== 'published' ? (
              <Button 
                className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-xl font-black shadow-lg shadow-[#ff6b35]/20"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Publier le cours
              </Button>
            ) : (
              <Button 
                className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white rounded-xl font-black shadow-lg shadow-[#ff6b35]/20"
                onClick={() => updatePageMutation.mutate({
                  pageId: activePage.id,
                  title: localTitle,
                  content: localContent
                })}
                disabled={updatePageMutation.isPending}
              >
                {updatePageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Enregistrer
              </Button>
            )}
          </div>
        </header>

         {/* Editor Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/10">
          <div className="max-w-6xl mx-auto h-full">
            {activePage ? (
              <Card className="p-8 md:p-12 border-none shadow-2xl rounded-[32px] bg-card min-h-full flex flex-col">
                <input 
                  type="text" 
                  className="text-3xl md:text-4xl font-black bg-transparent border-none focus:outline-none focus:ring-0 mb-6 placeholder:opacity-20"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Titre de la page..."
                />
                <textarea 
                  className="flex-1 w-full text-lg leading-relaxed bg-transparent border-none focus:outline-none focus:ring-0 resize-none font-medium text-muted-foreground placeholder:opacity-20 scrollbar-hide min-h-[60vh]"
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Commencez à écrire ici..."
                />
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 py-20">
                <FileText className="w-20 h-20 opacity-10" />
                <p className="font-black uppercase tracking-widest opacity-20 text-xl">Sélectionnez une page pour éditer</p>
              </div>
            )}
          </div>
        </main>

        {/* Footer Navigation */}
        <footer className="h-16 border-t border-border bg-card/50 backdrop-blur-xl px-6 flex items-center justify-center gap-8 shrink-0">
          <Button 
            variant="ghost" 
            disabled={!activePageId || pages.findIndex(p => p.id === activePageId) === 0}
            onClick={() => {
              const currentIndex = pages.findIndex(p => p.id === activePageId);
              if (currentIndex > 0) {
                setActivePageId(pages[currentIndex - 1].id);
              }
            }}
            className="font-bold rounded-xl"
          >
            <ChevronLeft className="w-5 h-5 mr-1" /> Précédent
          </Button>
          <span className="font-black text-sm tabular-nums">
            {activePageId ? pages.findIndex(p => p.id === activePageId) + 1 : 0} / {pages.length}
          </span>
          <Button 
            variant="ghost" 
            disabled={!activePageId || pages.findIndex(p => p.id === activePageId) === pages.length - 1}
            onClick={() => {
              const currentIndex = pages.findIndex(p => p.id === activePageId);
              if (currentIndex < pages.length - 1) {
                setActivePageId(pages[currentIndex + 1].id);
              }
            }}
            className="font-bold rounded-xl"
          >
            Suivant <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </footer>
      </div>

      {/* Modal de confirmation suppression */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeletePage}
        title="Supprimer la page"
        description="Cette action est irréversible. La page sera définitivement supprimée."
      />
    </div>
  );
};

CourseEditor.propTypes = {};

export default CourseEditor;
ConfirmModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};
SaveIndicator.propTypes = {
  status: PropTypes.string.isRequired,
};
RewardToast.propTypes = {
  xp: PropTypes.any.isRequired,
  streak: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
};
