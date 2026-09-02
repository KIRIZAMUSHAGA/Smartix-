import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Card } from '../ui/card';
import { Mail, Phone, CheckCircle2, Loader2, Link as LinkIcon, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import {
  startGoogleLink,
  unlinkGoogle,
  unlinkPhone,
} from '../../services/authService';
import PhoneLinkDialog from './PhoneLinkDialog';

const GoogleIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.1 4.1-3.9 5.5l6.5 5.5C42 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

/**
 * Carte « Comptes liés » affichée dans le profil de l'utilisateur connecté.
 * Permet de :
 *  - Visualiser les méthodes de connexion actuellement disponibles (email, Google, téléphone)
 *  - Rattacher Google ou un numéro de téléphone
 *  - Détacher (avec garde-fou : impossible si c'est la seule méthode restante)
 */
const LinkedAccountsCard = ({ user }) => {
  const { updateUser } = useAuth();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [busyKey, setBusyKey] = useState(null); // 'google' | 'phone' | 'unlink-google' | 'unlink-phone'

  const methods = useMemo(() => {
    const m = [];
    if (user?.email && user?.hashed_password !== undefined) {
      // Le backend ne renvoie jamais hashed_password ; on considère donc qu'un
      // compte avec email a "email/password" actif si providers contient 'email'.
    }
    if (user?.email) m.push('email');
    if (user?.google_id) m.push('google');
    if (user?.phone) m.push('phone');
    return m;
  }, [user]);

  const onlyOneMethod = methods.length <= 1;

  const handleLinkGoogle = useCallback(async () => {
    if (busyKey) return;
    setBusyKey('google');
    try {
      await startGoogleLink(); // navigation top-level → pas de finally nécessaire en cas de succès
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Erreur inconnue';
      toast.error('Liaison Google impossible', { description: detail });
      setBusyKey(null);
    }
  }, [busyKey]);

  const handleUnlinkGoogle = useCallback(async () => {
    if (busyKey) return;
    setBusyKey('unlink-google');
    try {
      const updated = await unlinkGoogle();
      if (updated) updateUser?.(updated);
      toast.success('Compte Google détaché');
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Erreur inconnue';
      toast.error('Détachement impossible', { description: detail });
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, updateUser]);

  const handleUnlinkPhone = useCallback(async () => {
    if (busyKey) return;
    setBusyKey('unlink-phone');
    try {
      const updated = await unlinkPhone();
      if (updated) updateUser?.(updated);
      toast.success('Numéro détaché');
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Erreur inconnue';
      toast.error('Détachement impossible', { description: detail });
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, updateUser]);

  const handlePhoneLinked = useCallback((updated) => {
    if (updated) updateUser?.(updated);
  }, [updateUser]);

  return (
    <>
      <PhoneLinkDialog
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        onLinked={handlePhoneLinked}
      />

      <Card className="bg-card border-border p-8 rounded-[40px] text-left space-y-6 shadow-sm">
        <div>
          <h4 className="text-xs font-black uppercase text-[#ff6b35] tracking-widest mb-2">
            Comptes liés
          </h4>
          <p className="text-sm text-muted-foreground">
            Gère les méthodes utilisées pour te connecter à ton compte.
          </p>
        </div>

        {/* Email / mot de passe */}
        <div className="flex items-center justify-between gap-4 py-3 border-t border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-foreground/70" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                Email
                {user?.email && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.email || 'Aucun email'}
              </div>
            </div>
          </div>
          <span className="text-xs uppercase tracking-widest font-black text-muted-foreground shrink-0">
            Méthode principale
          </span>
        </div>

        {/* Google */}
        <div className="flex items-center justify-between gap-4 py-3 border-t border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0">
              <GoogleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                Google
                {user?.google_id && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.google_id ? 'Compte Google rattaché' : 'Aucun compte Google lié'}
              </div>
            </div>
          </div>
          {user?.google_id ? (
            <button
              type="button"
              onClick={handleUnlinkGoogle}
              disabled={busyKey === 'unlink-google' || onlyOneMethod}
              className="h-10 px-4 rounded-xl border border-border text-sm font-bold flex items-center gap-2 hover:bg-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title={onlyOneMethod ? 'Au moins une autre méthode est requise' : 'Détacher Google'}
            >
              {busyKey === 'unlink-google' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Détacher
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLinkGoogle}
              disabled={busyKey === 'google'}
              className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 shrink-0"
            >
              {busyKey === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
              Lier
            </button>
          )}
        </div>

        {/* Téléphone */}
        <div className="flex items-center justify-between gap-4 py-3 border-t border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-foreground/70" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                Téléphone
                {user?.phone && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.phone || 'Aucun numéro lié'}
              </div>
            </div>
          </div>
          {user?.phone ? (
            <button
              type="button"
              onClick={handleUnlinkPhone}
              disabled={busyKey === 'unlink-phone' || onlyOneMethod}
              className="h-10 px-4 rounded-xl border border-border text-sm font-bold flex items-center gap-2 hover:bg-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title={onlyOneMethod ? 'Au moins une autre méthode est requise' : 'Détacher le numéro'}
            >
              {busyKey === 'unlink-phone' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Détacher
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPhoneOpen(true)}
              className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all shrink-0"
            >
              <LinkIcon className="w-4 h-4" />
              Lier
            </button>
          )}
        </div>

        {onlyOneMethod && (
          <p className="text-[11px] text-amber-500/90 leading-relaxed">
            Pour détacher une méthode, ajoute d'abord une autre façon de te connecter.
          </p>
        )}
      </Card>
    </>
  );
};

LinkedAccountsCard.propTypes = {
  user: PropTypes.object,
};

export default LinkedAccountsCard;
