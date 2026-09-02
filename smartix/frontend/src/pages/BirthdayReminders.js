import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Cake, Gift, Heart, Settings, Bell, Eye, Calendar, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useGlobalCache } from '../contexts/GlobalCacheContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const DAYS_AHEAD = 30;
const REFRESH_INTERVAL = 3600000; // 1 heure

// =============================
// COMPOSANT PRINCIPAL
// =============================
const BirthdayReminders = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const { getBirthdayCache, updateBirthdayCache } = useGlobalCache();

  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState({
    notifyFriends: true,
    showAge: true,
    autoPost: true
  });

  // =============================
  // SÉPARATION DES CACHES
  // =============================
  const getBirthdayData = useCallback(() => {
    const cache = getBirthdayCache(user?.id);
    return cache?.data || null;
  }, [user, getBirthdayCache]);

  const getBirthdaySettings = useCallback(() => {
    const cache = getBirthdayCache(user?.id);
    return cache?.settings || null;
  }, [user, getBirthdayCache]);

  // =============================
  // CHARGEMENT DES ANNIVERSAIRES
  // =============================
  const fetchUpcomingBirthdays = useCallback(async (force = false) => {
    if (!user?.id) return;

    // Vérifier le cache d'abord
    if (!force) {
      const cached = getBirthdayData();
      if (cached && Date.now() - cached.timestamp < REFRESH_INTERVAL) {
        setUpcomingBirthdays(cached.data);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const response = await client.get(`/users/${user.id}/upcoming-birthdays`, {
        params: { days_ahead: DAYS_AHEAD }
      });

      if (response.data.success) {
        const birthdays = (response.data.upcoming_birthdays || [])
          .sort((a, b) => a.days_until - b.days_until);
        
        setUpcomingBirthdays(birthdays);
        
        // Mettre à jour le cache
        const currentCache = getBirthdayCache(user.id) || {};
        updateBirthdayCache(user.id, {
          ...currentCache,
          data: {
            data: birthdays,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('Error fetching birthdays:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else {
        toast.error('Erreur chargement anniversaires');
      }
    } finally {
      setLoading(false);
    }
  }, [user, client, getBirthdayData, getBirthdayCache, updateBirthdayCache]);

  // =============================
  // CHARGEMENT DES PRÉFÉRENCES
  // =============================
  const fetchSettings = useCallback(async () => {
    if (!user?.id) return;

    // Vérifier le cache des settings
    const cachedSettings = getBirthdaySettings();
    if (cachedSettings) {
      setSettings(cachedSettings);
      return;
    }

    try {
      const response = await client.get(`/users/${user.id}/birthday-settings`);
      if (response.data) {
        const newSettings = {
          notifyFriends: response.data.notify_friends ?? true,
          showAge: response.data.show_age ?? true,
          autoPost: response.data.auto_post ?? true
        };
        setSettings(newSettings);
        
        // Mettre en cache les settings
        const currentCache = getBirthdayCache(user.id) || {};
        updateBirthdayCache(user.id, {
          ...currentCache,
          settings: newSettings
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, [user, client, getBirthdaySettings, getBirthdayCache, updateBirthdayCache]);

  // =============================
  // CHARGEMENT INITIAL
  // =============================
  useEffect(() => {
    if (user?.id) {
      fetchUpcomingBirthdays();
      fetchSettings();
    }
  }, [user, fetchUpcomingBirthdays, fetchSettings]);

  // =============================
  // ENVOI D'UN VŒU D'ANNIVERSAIRE
  // =============================
  const sendBirthdayWish = useCallback(async (friendId, friendName) => {
    if (!user?.id) return;

    // Éviter les envois multiples
    if (sent[friendId]) return;

    // Optimistic update
    setSent(prev => ({ ...prev, [friendId]: true }));

    try {
      const response = await client.post('/posts', {
        content: `🎂 Joyeux anniversaire ${friendName}! Je te souhaite une merveilleuse journée remplie de bonheur et de joie! 🎉`,
        visibility: 'public',
        type: 'birthday_wish',
        recipient_id: friendId
      });

      if (response?.success) {
        toast.success(`Vœu envoyé à ${friendName} ! 🎉`);
        // Le bouton reste désactivé (pas de reset)
      } else {
        throw new Error('Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Error sending birthday wish:', error);
      // Rollback
      setSent(prev => ({ ...prev, [friendId]: false }));
      
      if (error.response?.status === 429) {
        toast.error('Trop de messages, patientez');
      } else if (error.response?.status === 401) {
        toast.error('Session expirée');
      } else {
        toast.error('Erreur lors de l\'envoi du vœu');
      }
    }
  }, [user, client, sent]);

  // =============================
  // SAUVEGARDE DES PARAMÈTRES
  // =============================
  const saveSettings = useCallback(async () => {
    if (!user?.id) return;

    setSavingSettings(true);
    try {
      await client.put(`/users/${user.id}/birthday-settings`, {
        notify_friends: settings.notifyFriends,
        show_age: settings.showAge,
        auto_post: settings.autoPost
      });
      
      toast.success('Paramètres enregistrés');
      
      // Mettre à jour le cache des settings
      const currentCache = getBirthdayCache(user.id) || {};
      updateBirthdayCache(user.id, {
        ...currentCache,
        settings
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSavingSettings(false);
    }
  }, [user, settings, getBirthdayCache, updateBirthdayCache]);

  // =============================
  // FORMATAGE DES DATES
  // =============================
  const getBirthdayMessage = useCallback((birthday) => {
    if (birthday.days_until === 0) {
      return { 
        text: "Aujourd'hui!", 
        className: "bg-pink-500 text-white px-2 py-0.5 rounded-full text-xs font-medium"
      };
    }
    if (birthday.days_until === 1) {
      return {
        text: "demain",
        className: "text-pink-500 font-medium"
      };
    }
    return {
      text: `dans ${birthday.days_until} jours`,
      className: "text-gray-500 dark:text-gray-400"
    };
  }, []);

  // =============================
  // RENDU D'UNE LISTE D'ANNIVERSAIRES (mémoïsée)
  // =============================
  const renderBirthdayList = useCallback((birthdays, title, icon = null) => {
    if (birthdays.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          {title}
        </h3>
        <div className="space-y-3">
          {birthdays.map((birthday) => {
            const birthdayMsg = getBirthdayMessage(birthday);
            const isSent = sent[birthday.user_id];
            const isToday = birthday.days_until === 0;
            
            return (
              <div
                key={birthday.user_id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="w-12 h-12 ring-2 ring-pink-100 dark:ring-pink-900/30">
                    <AvatarImage src={birthday.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                      {birthday.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {birthday.name}
                      </p>
                      {isToday && (
                        <span className={birthdayMsg.className}>
                          {birthdayMsg.text}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Cake className="w-4 h-4 text-pink-500" />
                      {settings.showAge && (
                        <span className="text-gray-600 dark:text-gray-400">
                          {birthday.age} ans
                        </span>
                      )}
                      {!isToday && (
                        <span className={`text-xs ${birthdayMsg.className}`}>
                          {birthdayMsg.text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => sendBirthdayWish(birthday.user_id, birthday.name)}
                  disabled={!isToday || isSent}
                  className={`ml-4 px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    isSent
                      ? 'bg-green-500 text-white cursor-default'
                      : isToday
                        ? 'bg-pink-500 hover:bg-pink-600 text-white hover:shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }`}
                  aria-label={
                    isToday 
                      ? `Souhaiter un joyeux anniversaire à ${birthday.name}`
                      : `Anniversaire de ${birthday.name} dans ${birthday.days_until} jours`
                  }
                >
                  {isSent ? (
                    <>
                      <span>✓</span>
                      <span>Envoyé</span>
                    </>
                  ) : isToday ? (
                    <>
                      <Heart className="w-4 h-4" />
                      <span>Souhaiter</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      <span>À venir</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [sent, settings.showAge, getBirthdayMessage, sendBirthdayWish]);

  // =============================
  // GROUPEMENT PAR DATE
  // =============================
  const groupedBirthdays = useMemo(() => {
    const groups = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: []
    };
    
    upcomingBirthdays.forEach(b => {
      if (b.days_until === 0) {
        groups.today.push(b);
      } else if (b.days_until === 1) {
        groups.tomorrow.push(b);
      } else if (b.days_until <= 7) {
        groups.thisWeek.push(b);
      } else {
        groups.later.push(b);
      }
    });
    
    return groups;
  }, [upcomingBirthdays]);

  // =============================
  // RENDU
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 dark:text-gray-400">Chargement des anniversaires...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Cake className="w-8 h-8 text-pink-500" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Anniversaires à venir
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Prochains {DAYS_AHEAD} jours
          </p>
        </div>

        {/* Birthdays List */}
        {upcomingBirthdays.length === 0 ? (
          <div className="text-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-2xl">
            <Gift className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Aucun anniversaire à venir
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {renderBirthdayList(groupedBirthdays.today, "🎉 Aujourd'hui", "🎉")}
            {renderBirthdayList(groupedBirthdays.tomorrow, "📅 Demain", "📅")}
            {renderBirthdayList(groupedBirthdays.thisWeek, "📆 Cette semaine", "📆")}
            {renderBirthdayList(groupedBirthdays.later, "📎 Prochainement", "📎")}
          </div>
        )}

        {/* Settings Section */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Paramètres des anniversaires
            </h2>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.notifyFriends}
                onChange={(e) => setSettings(prev => ({ ...prev, notifyFriends: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
              />
              <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Notifier mes amis de mon anniversaire
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.showAge}
                onChange={(e) => setSettings(prev => ({ ...prev, showAge: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
              />
              <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Afficher mon âge
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.autoPost}
                onChange={(e) => setSettings(prev => ({ ...prev, autoPost: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
              />
              <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Publier automatiquement un post le jour de mon anniversaire
              </span>
            </label>
          </div>

          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="mt-6 w-full px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </button>
        </div>

        {/* Refresh Button */}
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchUpcomingBirthdays(true)}
            className="text-sm text-gray-500 hover:text-pink-500 transition-colors flex items-center gap-1 mx-auto"
          >
            <Sparkles className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>
    </div>
  );
};

BirthdayReminders.propTypes = {};

export default BirthdayReminders;
