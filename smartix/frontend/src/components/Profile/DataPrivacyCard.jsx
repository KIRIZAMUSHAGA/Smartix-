import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/card';
import { Dialog, DialogContent } from '../ui/dialog';
import { Download, Trash2, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { exportMyData, deleteMyAccount } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';

/**
 * Carte « Mes données & confidentialité » (RGPD).
 * Visible uniquement sur le profil de l'utilisateur connecté.
 *
 *  - Bouton EXPORTER : télécharge un JSON contenant toutes les données
 *    associées au compte (profil, posts, commentaires, etc.).
 *  - Bouton SUPPRIMER : ouvre un dialog de confirmation à double facteur
 *    (taper SUPPRIMER + saisir le mot de passe si applicable). Au succès :
 *    déconnexion + redirection vers /.
 */
const DataPrivacyCard = ({ user }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [exporting, setExporting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Si l'utilisateur a un mot de passe local (provider 'email'), on l'exige.
  const requiresPassword = useMemo(
    () => Array.isArray(user?.providers) && user.providers.includes('email'),
    [user?.providers]
  );

  const closeDialog = useCallback(() => {
    if (deleting) return;
    setShowDialog(false);
    setConfirmation('');
    setPassword('');
  }, [deleting]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportMyData();
      const url = window.URL.createObjectURL(
        blob instanceof Blob ? blob : new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartix-export-${user?.id || 'me'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Vos données ont été téléchargées.');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Échec de l'export";
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirmation !== 'SUPPRIMER') {
      toast.error('Tapez SUPPRIMER en majuscules pour confirmer.');
      return;
    }
    if (requiresPassword && !password) {
      toast.error('Mot de passe requis.');
      return;
    }
    setDeleting(true);
    try {
      await deleteMyAccount({
        confirmation,
        password: requiresPassword ? password : undefined,
      });
      toast.success('Compte supprimé. À bientôt.');
      setShowDialog(false);
      try { await logout(); } catch (_) { /* on continue même si logout échoue */ }
      navigate('/', { replace: true });
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Échec de la suppression';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const canSubmitDelete =
    confirmation === 'SUPPRIMER' && (!requiresPassword || password.length > 0);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-5 h-5 text-foreground" />
        <h3 className="text-lg font-bold">Mes données & confidentialité</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Téléchargez l'intégralité de vos données ou supprimez définitivement votre compte (RGPD).
      </p>

      <div className="space-y-4">
        {/* Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Download className="w-4 h-4" /> Exporter mes données
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Profil, publications, commentaires, paramètres… au format JSON.
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 inline-flex items-center gap-2 min-w-[110px] justify-center"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Exporter'}
          </button>
        </div>

        {/* Delete */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
          <div>
            <div className="font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Supprimer mon compte
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Action irréversible. Vos données personnelles seront effacées.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 min-w-[110px]"
          >
            Supprimer
          </button>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={(o) => (o ? setShowDialog(true) : closeDialog())}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold">Supprimer définitivement votre compte ?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Cette action est <strong>irréversible</strong>. Toutes vos données personnelles
                  seront supprimées de Smartix. Les messages que vous avez envoyés resteront
                  visibles aux autres participants mais apparaîtront comme provenant d'un compte
                  supprimé.
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="rgpd-confirm">
                Tapez <code className="bg-muted px-1.5 py-0.5 rounded font-mono">SUPPRIMER</code> pour confirmer
              </label>
              <input
                id="rgpd-confirm"
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-destructive/40"
                placeholder="SUPPRIMER"
                autoComplete="off"
                disabled={deleting}
              />
            </div>

            {requiresPassword && (
              <div>
                <label className="text-sm font-medium block mb-1" htmlFor="rgpd-password">
                  Votre mot de passe
                </label>
                <input
                  id="rgpd-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-destructive/40"
                  autoComplete="current-password"
                  disabled={deleting}
                />
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || !canSubmitDelete}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

DataPrivacyCard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    providers: PropTypes.arrayOf(PropTypes.string),
  }),
};

export default DataPrivacyCard;
