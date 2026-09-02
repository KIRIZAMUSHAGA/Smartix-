import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  BookOpen, 
  Edit, 
  Trash2, 
  Globe, 
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import { getImageUrl } from '../config/apiClient';

// Composants UI
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import BottomNav from '../components/BottomNav';
import {

  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const FALLBACK_IMAGE = '/placeholder-course.jpg';

// =============================
// SKELETON CARD
// =============================
const SkeletonCard = () => (
  <Card className="overflow-hidden border-border bg-card rounded-[32px] animate-pulse">
    <div className="aspect-video bg-muted" />
    <div className="p-6 space-y-3">
      <div className="h-6 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="h-8 bg-muted rounded-xl" />
        <div className="h-8 bg-muted rounded-xl" />
        <div className="h-8 bg-muted rounded-xl" />
      </div>
    </div>
  </Card>
);

// =============================
// DRAFT CARD
// =============================
const DraftCard = ({ draft, onEdit, onDelete, onPublish, isDeleting, isPublishing, isOptimistic = false }) => {
  const coverImage = draft.coverImage ? getImageUrl(draft.coverImage, 'uploads') : null;
  const [imgError, setImgError] = useState(false);

  const handleImageError = () => setImgError(true);

  return (
    <Card className={`overflow-hidden border-border bg-card rounded-[32px] shadow-xl group hover:border-[#ff6b35]/30 transition-all duration-300 ${
      isOptimistic ? 'opacity-60' : ''
    }`}>
      <div className="aspect-video relative bg-muted overflow-hidden">
        {coverImage && !imgError ? (
          <img 
            src={coverImage}
            alt={draft.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#ff6b35]/10 to-[#ff8c61]/10">
            <BookOpen className="w-12 h-12 opacity-20 text-[#ff6b35]" />
          </div>
        )}
        <div className="absolute top-4 right-4">
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/20 font-black text-[10px] uppercase tracking-widest">
            {isOptimistic ? 'Suppression...' : 'Brouillon'}
          </Badge>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-black mb-2 truncate text-foreground">{draft.title}</h3>
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-6">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Modifié le {new Date(draft.updated_at || draft.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button 
            onClick={onEdit}
            variant="outline"
            className="rounded-xl border-border hover:border-[#ff6b35] hover:text-[#ff6b35] font-black text-xs gap-1.5 transition-all"
            aria-label="Modifier le brouillon"
            disabled={isOptimistic}
          >
            <Edit className="w-3.5 h-3.5" /> Modifier
          </Button>
          <Button 
            onClick={onDelete}
            disabled={isDeleting || isOptimistic}
            variant="outline"
            className="rounded-xl border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 font-black text-xs gap-1.5 transition-all disabled:opacity-50"
            aria-label="Supprimer le brouillon"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Supprimer
          </Button>
          <Button 
            onClick={onPublish}
            disabled={isPublishing || isOptimistic}
            className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black rounded-xl text-xs gap-1.5 transition-all disabled:opacity-50"
            aria-label="Publier le cours"
          >
            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            Publier
          </Button>
        </div>
      </div>
    </Card>
  );
};

// =============================
// CONFIRMATION DIALOG
// =============================
const ConfirmDialog = ({ open, onOpenChange, title, description, onConfirm, isLoading, targetId, currentTargetId }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="bg-card border border-border rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          {description}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="bg-secondary text-foreground hover:bg-accent border-border">
          Annuler
        </AlertDialogCancel>
        <AlertDialogAction 
          onClick={onConfirm}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          {isLoading && currentTargetId === targetId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Confirmer
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// =============================
// PUBLISH DIALOG
// =============================
const PublishDialog = ({ open, onOpenChange, onConfirm, isLoading, targetId, currentTargetId }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="bg-card border border-border rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-foreground">Publier ce cours ?</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          Voulez-vous publier ce cours ? Il sera visible par tous les utilisateurs.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="bg-secondary text-foreground hover:bg-accent border-border">
          Annuler
        </AlertDialogCancel>
        <AlertDialogAction 
          onClick={onConfirm}
          disabled={isLoading}
          className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white"
        >
          {isLoading && currentTargetId === targetId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Publier
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// =============================
// HOOK PERSONNALISÉ POUR LES BROUILLONS
// =============================
const useDrafts = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getDraftsCache, updateDraftsCache } = useGlobalCache();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction unique pour mettre à jour drafts + cache atomiquement
  const updateDrafts = useCallback((updater) => {
    setDrafts(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      
      if (user?.id) {
        updateDraftsCache(user.id, {
          data: updated,
          timestamp: Date.now()
        });
      }
      
      return updated;
    });
  }, [user, updateDraftsCache]);

  const fetchDrafts = useCallback(async (force = false) => {
    if (!user) return;

    try {
      if (!force) {
        const cached = getDraftsCache(user.id);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setDrafts(cached.data);
          setLoading(false);
          return;
        }
      }

      const response = await client.get('/courses/drafts');
      const draftsData = Array.isArray(response.data) ? response.data : [];
      
      updateDrafts(draftsData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      setError(err);
      
      if (err.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (err.response?.status !== 404) {
        toast.error('Erreur de chargement des brouillons');
      }
      updateDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [user, client, getDraftsCache, updateDrafts]);

  const deleteDraft = useCallback(async (draftId, draftTitle) => {
    if (!user) return false;

    // Sauvegarde pour rollback
    const previousDrafts = [...drafts];
    
    // Optimistic update
    updateDrafts(prev => prev.filter(d => d.id !== draftId));
    
    try {
      await client.delete(`/courses/${draftId}`);
      toast.success(`Brouillon "${draftTitle}" supprimé`);
      
      // Précharger la page suivante
      client.get('/courses').catch(() => {});
      
      return true;
    } catch (error) {
      // Rollback
      updateDrafts(previousDrafts);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur lors de la suppression');
      }
      return false;
    }
  }, [user, client, drafts, updateDrafts]);

  const publishDraft = useCallback(async (draftId, draftTitle) => {
    if (!user) return false;

    // Sauvegarde pour rollback
    const previousDrafts = [...drafts];
    
    // Optimistic update
    updateDrafts(prev => prev.filter(d => d.id !== draftId));
    
    try {
      await client.post(`/courses/${draftId}/publish`);
      toast.success(`Cours "${draftTitle}" publié avec succès !`);
      
      // Précharger la page des cours
      client.get('/courses').catch(() => {});
      
      return true;
    } catch (error) {
      // Rollback
      updateDrafts(previousDrafts);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else if (error.response?.status === 409) {
        toast.error('Ce cours a déjà été publié');
      } else {
        toast.error('Erreur lors de la publication');
      }
      return false;
    }
  }, [user, client, drafts, updateDrafts]);

  return {
    drafts,
    loading,
    error,
    fetchDrafts,
    deleteDraft,
    publishDraft,
    updateDrafts
  };
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const MyDrafts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { drafts, loading, error, fetchDrafts, deleteDraft, publishDraft } = useDrafts();

  const [deletingId, setDeletingId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, draftId: null, draftTitle: '' });

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // =============================
  // SUPPRIMER UN BROUILLON
  // =============================
  const handleDelete = useCallback(async () => {
    const { draftId, draftTitle } = confirmDialog;
    if (!draftId) return;

    setDeletingId(draftId);
    setConfirmDialog({ open: false, type: null, draftId: null, draftTitle: '' });

    await deleteDraft(draftId, draftTitle);
    
    setDeletingId(null);
  }, [confirmDialog, deleteDraft]);

  // =============================
  // PUBLIER UN COURS
  // =============================
  const handlePublish = useCallback(async () => {
    const { draftId, draftTitle } = confirmDialog;
    if (!draftId) return;

    setPublishingId(draftId);
    setConfirmDialog({ open: false, type: null, draftId: null, draftTitle: '' });

    const success = await publishDraft(draftId, draftTitle);
    
    if (success) {
      navigate('/courses', { replace: true });
    }
    
    setPublishingId(null);
  }, [confirmDialog, publishDraft, navigate]);

  // =============================
  // OUVERTURE DES DIALOGUES
  // =============================
  const openDeleteDialog = useCallback((draftId, draftTitle) => {
    setConfirmDialog({ open: true, type: 'delete', draftId, draftTitle });
  }, []);

  const openPublishDialog = useCallback((draftId, draftTitle) => {
    setConfirmDialog({ open: true, type: 'publish', draftId, draftTitle });
  }, []);

  // =============================
  // RENDU
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-background border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-20 bg-muted rounded-lg animate-pulse" />
              <div className="h-8 w-40 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-10 w-36 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error && drafts.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Erreur de chargement</h2>
          <p className="text-muted-foreground mb-6">
            Impossible de charger vos brouillons. Veuillez réessayer.
          </p>
          <Button onClick={() => fetchDrafts(true)} className="bg-[#ff6b35] hover:bg-[#ff8c61]">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-background border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/courses">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                </Button>
              </Link>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Mes brouillons</h1>
            </div>
            <Button 
              onClick={() => navigate('/courses')}
              className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black rounded-xl"
              aria-label="Créer un nouveau cours"
            >
              <Plus className="w-4 h-4 mr-2" /> Créer un nouveau cours
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {drafts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {drafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onEdit={() => navigate(`/courses/${draft.id}/edit`)}
                onDelete={() => openDeleteDialog(draft.id, draft.title)}
                onPublish={() => openPublishDialog(draft.id, draft.title)}
                isDeleting={deletingId === draft.id}
                isPublishing={publishingId === draft.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-card rounded-[40px] border border-border max-w-2xl mx-auto shadow-sm">
            <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-4 tracking-tight">
              Vous n’avez encore aucun brouillon.
            </h3>
            <p className="text-muted-foreground font-medium mb-8 max-w-sm mx-auto">
              Cliquez sur “Créer un nouveau cours” pour commencer à rédiger votre premier cours.
            </p>
            <Button 
              onClick={() => navigate('/courses')}
              className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black px-8 py-6 rounded-2xl shadow-xl shadow-[#ff6b35]/20 transition-all hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2" /> Créer mon premier cours
            </Button>
          </div>
        )}
      </div>
      
      <BottomNav />

      {/* Dialog de confirmation suppression */}
      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.type === 'delete'}
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, type: null, draftId: null, draftTitle: '' })}
        title="Supprimer le brouillon ?"
        description={`Êtes-vous sûr de vouloir supprimer définitivement le brouillon "${confirmDialog.draftTitle}" ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        isLoading={deletingId !== null}
        targetId={confirmDialog.draftId}
        currentTargetId={deletingId}
      />

      {/* Dialog de confirmation publication */}
      <PublishDialog
        open={confirmDialog.open && confirmDialog.type === 'publish'}
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, type: null, draftId: null, draftTitle: '' })}
        onConfirm={handlePublish}
        isLoading={publishingId !== null}
        targetId={confirmDialog.draftId}
        currentTargetId={publishingId}
      />
    </div>
  );
};

MyDrafts.propTypes = {};

export default MyDrafts;
SkeletonCard.propTypes = {};
DraftCard.propTypes = {
  draft: PropTypes.bool.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onPublish: PropTypes.func.isRequired,
  isDeleting: PropTypes.bool.isRequired,
  isPublishing: PropTypes.bool.isRequired,
  isOptimistic: PropTypes.bool,
};
ConfirmDialog.propTypes = {
  open: PropTypes.func.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  targetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  currentTargetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
PublishDialog.propTypes = {
  open: PropTypes.func.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  targetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  currentTargetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
