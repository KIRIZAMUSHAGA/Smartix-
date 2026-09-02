import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Key, Mail, Smartphone, LogOut, Trash2, ChevronRight,
  AlertTriangle, ArrowLeft, Clock, Globe, X, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';

// Composants UI
import { Button } from '../components/ui/button';
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

// =============================
// COMPOSANT MODAL
// =============================
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-full transition-all" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// =============================
// INDICATEUR DE FORCE MOT DE PASSE
// =============================
const PasswordStrengthIndicator = ({ password }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const strengthText = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'][strength];
  const strengthColor = [
    'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'
  ][strength];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
        <div className={`h-full ${strengthColor} transition-all duration-300`} 
             style={{ width: `${(strength / 4) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{strengthText}</p>
    </div>
  );
};

// =============================
// MODAL CHANGEMENT MOT DE PASSE
// =============================
const ChangePasswordModal = ({ isOpen, onClose, onSuccess }) => {
  const { client } = useApiClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    
    if (!currentPassword) {
      newErrors.currentPassword = 'Mot de passe actuel requis';
    }
    
    if (!newPassword) {
      newErrors.newPassword = 'Nouveau mot de passe requis';
    } else {
      if (newPassword.length < 8) {
        newErrors.newPassword = '8 caractères minimum';
      } else if (!/[A-Z]/.test(newPassword)) {
        newErrors.newPassword = 'Doit contenir une majuscule';
      } else if (!/[0-9]/.test(newPassword)) {
        newErrors.newPassword = 'Doit contenir un chiffre';
      } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
        newErrors.newPassword = 'Doit contenir un caractère spécial (!@#$%^&*)';
      }
    }
    
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    if (currentPassword === newPassword) {
      newErrors.newPassword = 'Le nouveau mot de passe doit être différent';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      await client.post('/security/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      toast.success('Mot de passe modifié avec succès');
      onSuccess?.();
      onClose();
      resetForm();
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || 'Mot de passe actuel incorrect');
      } else if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (error.response?.status === 429) {
        toast.error('Trop de tentatives. Veuillez patienter.');
      } else {
        toast.error('Erreur lors du changement de mot de passe');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier le mot de passe">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Mot de passe actuel</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 bg-accent/30 rounded-xl border border-border focus:border-[#ff6b35] focus:outline-none transition-all"
              placeholder="••••••••"
              aria-label="Mot de passe actuel"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showCurrent ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.currentPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.currentPassword}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-accent/30 rounded-xl border border-border focus:border-[#ff6b35] focus:outline-none transition-all"
              placeholder="••••••••"
              aria-label="Nouveau mot de passe"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrengthIndicator password={newPassword} />
          {errors.newPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.newPassword}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-accent/30 rounded-xl border border-border focus:border-[#ff6b35] focus:outline-none transition-all"
            placeholder="••••••••"
            aria-label="Confirmation du mot de passe"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6b35] hover:bg-[#ff5722] text-white font-bold rounded-xl h-12"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {loading ? 'Modification...' : 'Modifier le mot de passe'}
        </Button>
      </form>
    </Modal>
  );
};

// =============================
// MODAL CHANGEMENT EMAIL
// =============================
const ChangeEmailModal = ({ isOpen, onClose, onSuccess }) => {
  const { client } = useApiClient();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await client.post('/security/change-email', {
        new_email: newEmail,
        password: password
      });
      
      toast.success('Un email de confirmation a été envoyé à votre nouvelle adresse');
      onSuccess?.();
      onClose();
      setNewEmail('');
      setPassword('');
    } catch (error) {
      if (error.response?.status === 400) {
        setError(error.response.data.detail);
      } else if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (error.response?.status === 429) {
        toast.error('Trop de tentatives. Veuillez patienter.');
      } else {
        setError('Erreur lors de la demande de changement');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Changer d'email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Nouvelle adresse email</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-4 py-3 bg-accent/30 rounded-xl border border-border focus:border-[#ff6b35] focus:outline-none transition-all"
            placeholder="nouveau@email.com"
            required
            aria-label="Nouvelle adresse email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Mot de passe</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-accent/30 rounded-xl border border-border focus:border-[#ff6b35] focus:outline-none transition-all"
              placeholder="••••••••"
              required
              aria-label="Mot de passe"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6b35] hover:bg-[#ff5722] text-white font-bold rounded-xl h-12"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {loading ? 'Envoi...' : 'Envoyer la confirmation'}
        </Button>
      </form>
    </Modal>
  );
};

// =============================
// MODAL SUPPRESSION COMPTE
// =============================
const DeleteAccountModal = ({ isOpen, onClose, onSuccess }) => {
  const { client, logout } = useApiClient();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('confirm');

  const handleRequestDeletion = async (e) => {
    e.preventDefault();
    if (confirmText !== 'SUPPRIMER') {
      toast.error('Veuillez taper SUPPRIMER pour confirmer');
      return;
    }
    
    setLoading(true);
    try {
      await client.post('/security/account/request-deletion', {
        password: password,
        confirm: true
      });
      
      setStep('waiting');
      toast.success('Un email de confirmation vous a été envoyé');
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail);
      } else if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (error.response?.status === 429) {
        toast.error('Trop de tentatives. Veuillez patienter.');
      } else {
        toast.error('Erreur lors de la demande de suppression');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'waiting') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Confirmation par email">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            Un email de confirmation a été envoyé. Cliquez sur le lien dans l'email pour confirmer la suppression définitive de votre compte.
          </p>
          <p className="text-xs text-muted-foreground">
            Le lien expire dans 24 heures.
          </p>
          <Button
            onClick={onClose}
            className="w-full bg-accent hover:bg-accent/80 font-bold"
          >
            Fermer
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Supprimer le compte">
      <form onSubmit={handleRequestDeletion} className="space-y-4">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold text-sm">Attention : Action irréversible</span>
          </div>
          <p className="text-xs text-muted-foreground">
            La suppression de votre compte entraînera la perte définitive de toutes vos données : posts, commentaires, messages, likes, et historiques.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Mot de passe</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-accent/30 rounded-xl border border-border focus:border-red-500 focus:outline-none transition-all"
              placeholder="••••••••"
              required
              aria-label="Mot de passe"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Tapez <span className="font-mono font-bold text-red-500">SUPPRIMER</span> pour confirmer
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 bg-accent/30 rounded-xl border border-border focus:border-red-500 focus:outline-none transition-all font-mono text-center"
            placeholder="SUPPRIMER"
            aria-label="Confirmation de suppression"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-12"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {loading ? 'Demande en cours...' : 'Demander la suppression'}
        </Button>
      </form>
    </Modal>
  );
};

// =============================
// MODAL RÉVOCATION DE SESSION
// =============================
const RevokeSessionDialog = ({ isOpen, onClose, session, onSuccess }) => {
  const { client } = useApiClient();
  const [loading, setLoading] = useState(false);

  const handleRevoke = async () => {
    if (!session?.id) return;
    
    setLoading(true);
    try {
      await client.post(`/security/sessions/revoke/${session.id}`);
      toast.success('Session déconnectée');
      onSuccess?.();
      onClose();
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else {
        toast.error(error.response?.data?.detail || 'Erreur lors de la déconnexion');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-card border-border rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Déconnecter la session</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Êtes-vous sûr de vouloir déconnecter cet appareil ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="p-4 bg-accent/30 rounded-xl my-2">
          <p className="font-medium">{session.device}</p>
          {session.location && (
            <p className="text-xs text-muted-foreground mt-1">📍 {session.location}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Dernière activité : {new Date(session.last_activity).toLocaleString()}
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-secondary text-foreground hover:bg-accent">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleRevoke}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Déconnecter
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SecurityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getSessionsCache, updateSessionsCache } = useGlobalCache();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [lastPasswordChange, setLastPasswordChange] = useState(null);
  
  // Modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  
  const [revokingAll, setRevokingAll] = useState(false);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // CHARGEMENT DES SESSIONS
  // =============================
  const fetchSessions = useCallback(async (force = false) => {
    if (!user) return;

    try {
      if (!force) {
        const cached = getSessionsCache(user.id);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setSessions(cached.data);
          const current = cached.data.find(s => s.is_current);
          if (current) setCurrentSessionId(current.id);
          setLoading(false);
          return;
        }
      }

      const { data } = await client.get('/security/sessions');
      setSessions(data);
      const current = data.find(s => s.is_current);
      if (current) setCurrentSessionId(current.id);
      
      updateSessionsCache(user.id, {
        data: data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else {
        toast.error('Impossible de charger vos sessions');
      }
    } finally {
      setLoading(false);
    }
  }, [user, client, getSessionsCache, updateSessionsCache]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // =============================
  // RÉVOCATION DE TOUTES LES SESSIONS
  // =============================
  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await client.post('/security/sessions/revoke-all');
      toast.success('Toutes les autres sessions ont été déconnectées');
      await fetchSessions(true);
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else {
        toast.error('Erreur lors de la déconnexion des sessions');
      }
    } finally {
      setRevokingAll(false);
    }
  };

  // =============================
  // FORMATAGE DES DATES
  // =============================
  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return `Aujourd'hui à ${date.toLocaleTimeString()}`;
    if (diffDays === 1) return `Hier à ${date.toLocaleTimeString()}`;
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString();
  };

  const formatLastPasswordChange = () => {
    if (!lastPasswordChange) return 'Jamais modifié';
    const date = new Date(lastPasswordChange);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays < 30) return `Il y a ${diffDays} jours`;
    return `Il y a ${Math.floor(diffDays / 30)} mois`;
  };

  // =============================
  // RENDU
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-12">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-full transition-all"
            aria-label="Retour"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tight">Sécurité</h1>
        </div>

        <div className="space-y-8">
          {/* Authentification */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#ff6b35] mb-4 ml-2">Authentification</h2>
            <div className="bg-accent/30 rounded-[32px] border border-border/50 overflow-hidden">
              <button 
                onClick={() => setShowPasswordModal(true)} 
                className="w-full flex items-center justify-between p-6 hover:bg-accent/50 transition-all border-b border-border/50 group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                    <Key className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Modifier le mot de passe</p>
                    <p className="text-xs text-muted-foreground">
                      Dernière modification : {formatLastPasswordChange()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button 
                onClick={() => setShowEmailModal(true)}
                className="w-full flex items-center justify-between p-6 hover:bg-accent/50 transition-all group border-b border-border/50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Changer l'email</p>
                    <p className="text-xs text-muted-foreground">Recevez une confirmation par email</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="flex items-center justify-between p-6 hover:bg-accent/50 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Double authentification (2FA)</p>
                    <p className="text-xs text-muted-foreground">Bientôt disponible</p>
                  </div>
                </div>
                <span className="text-[10px] font-black bg-accent px-2 py-1 rounded-md uppercase">Prochainement</span>
              </div>
            </div>
          </section>

          {/* Connexions actives */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#ff6b35] mb-4 ml-2">
              Connexions actives ({sessions.length})
            </h2>
            <div className="bg-accent/30 rounded-[32px] border border-border/50 p-6 space-y-6">
              {sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucune session active</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div 
                      key={session.id} 
                      className="flex items-center justify-between p-4 bg-accent/20 rounded-2xl hover:bg-accent/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${session.is_current ? 'bg-green-500/10 text-green-500' : 'bg-muted/10 text-muted-foreground'}`}>
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{session.device}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            Actif {formatDate(session.last_activity)}
                          </p>
                          {session.location && (
                            <p className="text-xs text-muted-foreground">{session.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.is_current ? (
                          <span className="text-[10px] font-black bg-green-500/20 text-green-500 px-2 py-1 rounded-md uppercase">
                            Actuel
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSession(session);
                              setShowRevokeDialog(true);
                            }}
                            className="p-2 hover:bg-red-500/10 rounded-xl text-red-500 transition-all"
                            aria-label="Déconnecter cette session"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <button 
                onClick={handleRevokeAll}
                disabled={revokingAll || sessions.length <= 1}
                className="w-full py-4 rounded-2xl bg-accent/50 hover:bg-accent text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {revokingAll && <Loader2 className="w-4 h-4 animate-spin" />}
                Déconnecter tous les autres appareils
              </button>
            </div>
          </section>

          {/* Zone de danger */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-red-500 mb-4 ml-2">Zone de danger</h2>
            <div className="bg-red-500/5 rounded-[32px] border border-red-500/20 overflow-hidden">
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-between p-6 hover:bg-red-500/10 transition-all group text-red-600"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-red-600/10">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold uppercase tracking-tight">Supprimer définitivement</p>
                    <p className="text-xs opacity-70">Action irréversible</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Modals */}
      <ChangePasswordModal 
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => setLastPasswordChange(new Date().toISOString())}
      />
      
      <ChangeEmailModal 
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
      
      <DeleteAccountModal 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
      
      <RevokeSessionDialog 
        isOpen={showRevokeDialog}
        onClose={() => {
          setShowRevokeDialog(false);
          setSelectedSession(null);
        }}
        session={selectedSession}
        onSuccess={() => fetchSessions(true)}
      />
    </div>
  );
};

SecurityPage.propTypes = {};

export default SecurityPage;
Modal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
PasswordStrengthIndicator.propTypes = {
  password: PropTypes.any.isRequired,
};
ChangePasswordModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
ChangeEmailModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
DeleteAccountModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
RevokeSessionDialog.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  session: PropTypes.object.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
