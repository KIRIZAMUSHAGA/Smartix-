import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Card } from '../ui/card';
import { Dialog, DialogContent } from '../ui/dialog';
import {
  Monitor, Smartphone, Tablet, Loader2, ShieldCheck, LogOut, AlertTriangle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  listMySessions, revokeSession, revokeAllSessions
} from '../../services/authService';

const formatRelative = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "à l'instant";
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `il y a ${Math.floor(sec / 3600)} h`;
  if (sec < 86400 * 7) return `il y a ${Math.floor(sec / 86400)} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const deviceIcon = (label = '') => {
  const l = label.toLowerCase();
  if (l.includes('iphone') || l.includes('android') && !l.includes('tablet')) return Smartphone;
  if (l.includes('ipad') || l.includes('tablet')) return Tablet;
  return Monitor;
};

/**
 * Carte « Sessions actives » : liste les appareils connectés au compte courant.
 * - Met en avant la session courante (badge)
 * - Permet de révoquer chaque autre session individuellement
 * - Permet de tout révoquer d'un coup (sauf la courante) avec confirmation
 *
 * NB : la révocation marque `is_active=false` côté DB. Le JWT en cours de vie
 * (durée max 30 min) reste techniquement valide jusqu'à expiration ; le
 * rafraîchissement du token sera bloqué et la session disparaîtra de cette
 * liste immédiatement.
 */
const SessionsCard = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [showAllDialog, setShowAllDialog] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMySessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Impossible de charger les sessions';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (sessionId) => {
    setRevokingId(sessionId);
    try {
      await revokeSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session déconnectée.');
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Échec de la révocation';
      toast.error(msg);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await revokeAllSessions();
      // On garde uniquement la session courante
      setSessions(prev => prev.filter(s => s.is_current));
      toast.success('Toutes les autres sessions ont été déconnectées.');
      setShowAllDialog(false);
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Échec de la révocation';
      toast.error(msg);
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-foreground" />
          <h3 className="text-lg font-bold">Sessions actives</h3>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Rafraîchir"
          className="p-2 rounded-lg hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Liste des appareils actuellement connectés à votre compte. Vous pouvez en
        déconnecter un individuellement ou tous à la fois.
      </p>

      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          Aucune session active enregistrée. (Les sessions créées avant cette mise à
          jour ne sont pas tracées — elles apparaîtront à la prochaine connexion.)
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {sessions.map(s => {
              const Icon = deviceIcon(s.device);
              return (
                <li
                  key={s.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${
                    s.is_current
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-secondary shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        <span className="truncate">{s.device}</span>
                        {s.is_current && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                            Cette session
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-x-2">
                        {s.ip && <span>IP : {s.ip}</span>}
                        <span>•</span>
                        <span>Activité : {formatRelative(s.last_activity)}</span>
                      </div>
                    </div>
                  </div>
                  {!s.is_current && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(s.id)}
                      disabled={revokingId === s.id}
                      className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 inline-flex items-center gap-2 text-sm font-semibold shrink-0"
                    >
                      {revokingId === s.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <LogOut className="w-4 h-4" />}
                      Déconnecter
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {otherSessions.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowAllDialog(true)}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-2 text-sm font-semibold"
              >
                <LogOut className="w-4 h-4" />
                Déconnecter toutes les autres ({otherSessions.length})
              </button>
            </div>
          )}
        </>
      )}

      <Dialog open={showAllDialog} onOpenChange={(o) => !revokingAll && setShowAllDialog(o)}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold">Déconnecter toutes les autres sessions ?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Toutes les sessions actives sur d'autres appareils seront fermées.
                  Vous resterez connecté ici.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAllDialog(false)}
                disabled={revokingAll}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRevokeAll}
                disabled={revokingAll}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {revokingAll && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

SessionsCard.propTypes = {};

export default SessionsCard;
