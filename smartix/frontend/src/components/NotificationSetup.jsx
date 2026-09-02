import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, ShieldCheck, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;
const SERVICE_WORKER_PATH = '/sw.js';

// =============================
// COMPOSANT PRINCIPAL
// =============================
const NotificationSetup = () => {
  const { user } = useAuth();
  const { client } = useApiClient();

  const [status, setStatus] = useState('default');
  const [loading, setLoading] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [subscription, setSubscription] = useState(null);

  // =============================
  // VÉRIFICATION DE LA PRISE EN CHARGE
  // =============================
  const isPushSupported = useCallback(() => {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }, []);

  // =============================
  // VÉRIFICATION DU STATUT INITIAL
  // =============================
  useEffect(() => {
    if (isPushSupported()) {
      setStatus(Notification.permission);
      
      // Vérifier l'existence du service worker
      navigator.serviceWorker.ready.then((registration) => {
        setServiceWorkerReady(true);
        return registration.pushManager.getSubscription();
      }).then((subscription) => {
        if (subscription) {
          setSubscription(subscription);
        }
      }).catch((error) => {
        console.error('Service worker error:', error);
      });
    }
  }, [isPushSupported]);

  // =============================
  // ENREGISTREMENT DU SERVICE WORKER
  // =============================
  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
      console.log('Service Worker registered:', registration);
      setServiceWorkerReady(true);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      toast.error('Impossible d\'enregistrer le service worker');
      throw error;
    }
  }, []);

  // =============================
  // CRÉATION DE LA SOUSCRIPTION PUSH
  // =============================
  const subscribeToPush = useCallback(async (registration) => {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY
      });
      
      // Envoyer la souscription au backend
      await client.post('/notifications/register-token', {
        user_id: user?.id,
        subscription: subscription.toJSON(),
        platform: 'web'
      });
      
      setSubscription(subscription);
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission refusée');
      } else if (error.name === 'InvalidStateError') {
        throw new Error('Service worker non prêt');
      } else {
        throw new Error('Erreur de souscription push');
      }
    }
  }, [user, client]);

  // =============================
  // DEMANDE DE PERMISSION
  // =============================
  const requestPermission = useCallback(async () => {
    if (!isPushSupported()) {
      toast.error('Votre navigateur ne supporte pas les notifications push');
      return;
    }

    setLoading(true);

    try {
      // 1. Demander la permission
      const permission = await Notification.requestPermission();
      setStatus(permission);
      
      if (permission !== 'granted') {
        if (permission === 'denied') {
          toast.error(
            'Notifications bloquées. Veuillez autoriser les notifications dans les paramètres de votre navigateur.',
            { duration: 8000 }
          );
        }
        return;
      }

      // 2. Enregistrer le service worker
      let registration;
      try {
        registration = await navigator.serviceWorker.ready;
        if (!registration) {
          registration = await registerServiceWorker();
        }
      } catch {
        registration = await registerServiceWorker();
      }

      // 3. Créer la souscription push
      await subscribeToPush(registration);
      
      toast.success('Notifications activées avec succès ! 🎉');
      
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error(error.message || 'Erreur lors de l\'activation');
    } finally {
      setLoading(false);
    }
  }, [isPushSupported, registerServiceWorker, subscribeToPush]);

  // =============================
  // DÉSABONNEMENT
  // =============================
  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    
    setLoading(true);
    try {
      await subscription.unsubscribe();
      await client.post('/notifications/unregister-token', {
        user_id: user?.id,
        endpoint: subscription.endpoint
      });
      
      setSubscription(null);
      toast.success('Notifications désactivées');
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Erreur lors de la désactivation');
    } finally {
      setLoading(false);
    }
  }, [subscription, user, client]);

  // =============================
  // RENDU
  // =============================
  const getStatusIcon = () => {
    if (status === 'granted' && subscription) {
      return <ShieldCheck className="w-6 h-6 text-green-500" />;
    }
    if (status === 'denied') {
      return <BellOff className="w-6 h-6 text-red-500" />;
    }
    return <Bell className="w-6 h-6 text-[#ff6b35]" />;
  };

  const getStatusMessage = () => {
    if (status === 'granted' && subscription) {
      return "Génial ! Vous recevrez des alertes en temps réel même si Smartix est fermé.";
    }
    if (status === 'denied') {
      return "Les notifications sont bloquées. Pour les activer, cliquez sur l'icône de cadenas à gauche de l'URL et autorisez les notifications.";
    }
    if (!isPushSupported()) {
      return "Votre navigateur ne supporte pas les notifications push. Utilisez Chrome, Firefox ou Edge pour cette fonctionnalité.";
    }
    return "Activez les notifications pour ne rater aucun message ou cours important.";
  };

  const getStatusColor = () => {
    if (status === 'granted' && subscription) return 'bg-green-500/10 border-green-500/20';
    if (status === 'denied') return 'bg-red-500/10 border-red-500/20';
    return 'bg-[#ff6b35]/10 border-[#ff6b35]/20';
  };

  const showActionButton = status !== 'granted' || !subscription;

  return (
    <div className={`p-5 rounded-[24px] border ${getStatusColor()} mb-4 transition-all`}>
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-white/5">
          {getStatusIcon()}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-black uppercase tracking-widest text-white/90">
            Notifications Push Web
          </h3>
          <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
            {getStatusMessage()}
          </p>
          
          {showActionButton && isPushSupported() && (
            <button 
              onClick={requestPermission}
              disabled={loading}
              className="mt-4 w-full py-3 bg-[#ff6b35] hover:bg-[#ff6b35]/80 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#ff6b35]/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Activation...
                </>
              ) : (
                "Activer les notifications"
              )}
            </button>
          )}

          {status === 'granted' && subscription && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-green-500/80">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Service actif et opérationnel
              </div>
              <button
                onClick={unsubscribe}
                disabled={loading}
                className="text-[10px] text-white/40 hover:text-red-500 transition-colors"
              >
                Désactiver les notifications
              </button>
            </div>
          )}

          {!isPushSupported() && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-yellow-500/80">
              <AlertCircle className="w-3 h-3" />
              <span>Navigateur non supporté</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

NotificationSetup.propTypes = {};

export default NotificationSetup;
