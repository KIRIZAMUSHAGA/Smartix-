// components/SectionContent/NotificationsSection.jsx
import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import NotificationSetup from '../../../../components/NotificationSetup';
import ToggleSwitch from '../ToggleSwitch';
import { Bell, BellOff, Mail, Heart, Info, Loader2, Check } from 'lucide-react';
import useSettings from '../../hooks/useSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONFIGURATION RÉELLE DES NOTIFICATIONS
// =============================
const NOTIFICATION_TYPES = [
  { 
    id: 'posts', 
    labelKey: 'settings.notifications.posts', 
    descKey: 'settings.notifications.postsDesc',
    icon: Bell,
    color: 'text-blue-500'
  },
  { 
    id: 'messages', 
    labelKey: 'settings.notifications.messages', 
    descKey: 'settings.notifications.messagesDesc',
    icon: Mail,
    color: 'text-green-500'
  },
  { 
    id: 'likes', 
    labelKey: 'settings.notifications.likes', 
    descKey: 'settings.notifications.likesDesc',
    icon: Heart,
    color: 'text-red-500'
  },
  { 
    id: 'system', 
    labelKey: 'settings.notifications.system', 
    descKey: 'settings.notifications.systemDesc',
    icon: Info,
    color: 'text-purple-500'
  }
];

// =============================
// 2️⃣ COMPOSANT PRINCIPAL
// =============================
const NotificationsSection = () => {
  const { t } = useTranslation();
  const { notifications, updateNotifications, isDirty, saveSettings } = useSettings();
  
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);
  
  // État local pour les notifications (basé sur les vraies données)
  const notificationState = useMemo(() => ({
    posts: notifications?.posts ?? true,
    messages: notifications?.messages ?? true,
    likes: notifications?.likes ?? true,
    system: notifications?.system ?? true
  }), [notifications]);

  // =============================
  // 3️⃣ SAUVEGARDE AVEC DEBOUNCE (RÉELLE)
  // =============================
  useEffect(() => {
    if (!isDirty) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveSettings();
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
        toast.success(t('settings.notifications.saved'));
      } catch (error) {
        toast.error(t('settings.saveError'));
      } finally {
        setSaving(false);
      }
    }, 800);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isDirty, saveSettings, t]);

  // =============================
  // 4️⃣ GESTIONNAIRES (basés sur les vraies données)
  // =============================
  const toggleNotification = useCallback((typeId) => {
    const newValue = !notificationState[typeId];
    updateNotifications({
      ...notificationState,
      [typeId]: newValue
    });
  }, [notificationState, updateNotifications]);

  const enableAllNotifications = useCallback(() => {
    const allEnabled = {
      posts: true,
      messages: true,
      likes: true,
      system: true
    };
    updateNotifications(allEnabled);
    toast.success(t('settings.notifications.allEnabled'));
  }, [updateNotifications, t]);

  const disableAllNotifications = useCallback(() => {
    const allDisabled = {
      posts: false,
      messages: false,
      likes: false,
      system: false
    };
    updateNotifications(allDisabled);
    toast.success(t('settings.notifications.allDisabled'));
  }, [updateNotifications, t]);

  // =============================
  // 5️⃣ COMPTEUR DE NOTIFICATIONS ACTIVES
  // =============================
  const activeCount = useMemo(() => {
    return Object.values(notificationState).filter(Boolean).length;
  }, [notificationState]);

  // =============================
  // 6️⃣ RENDU AVEC COMPOSANT RÉEL NotificationSetup
  // =============================
  return (
    <div className="space-y-8">
      {/* En-tête avec compteur */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#ff6b35]" />
          <div>
            <h3 className="font-bold text-lg">{t('settings.notifications.title')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('settings.notifications.subtitle', { count: activeCount })}
            </p>
          </div>
        </div>
        <div aria-live="polite">
          {showSaved && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-green-500 flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              {t('settings.saved')}
            </motion.span>
          )}
        </div>
      </div>

      {/* Liste des notifications */}
      <div className="space-y-3">
        {NOTIFICATION_TYPES.map((type) => {
          const Icon = type.icon;
          const isEnabled = notificationState[type.id];
          
          return (
            <div
              key={type.id}
              className={`
                flex items-center justify-between p-4 rounded-2xl border transition-all
                ${isEnabled 
                  ? 'bg-foreground/5 border-[#ff6b35]/30' 
                  : 'bg-foreground/5 border-foreground/10'
                }
              `}
            >
              <div className="flex items-center gap-4">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center
                  ${isEnabled ? 'bg-[#ff6b35]/10' : 'bg-foreground/5'}
                `}>
                  <Icon className={`w-5 h-5 ${type.color}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {t(type.labelKey)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {t(type.descKey)}
                  </p>
                </div>
              </div>
              <ToggleSwitch 
                enabled={isEnabled} 
                onChange={() => toggleNotification(type.id)}
                aria-label={t(type.labelKey)}
              />
            </div>
          );
        })}
      </div>

      {/* Actions groupées */}
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={enableAllNotifications}
          className="flex-1 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest border-border hover:bg-[#ff6b35]/10 hover:border-[#ff6b35] transition-all"
        >
          <Bell className="w-4 h-4 mr-2" />
          {t('settings.notifications.enableAll')}
        </Button>
        <Button 
          variant="destructive" 
          onClick={disableAllNotifications}
          className="flex-1 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest"
        >
          <BellOff className="w-4 h-4 mr-2" />
          {t('settings.notifications.disableAll')}
        </Button>
      </div>

      {/* Composant NotificationSetup RÉEL */}
      <div className="pt-4 border-t border-border/50">
        <NotificationSetup />
      </div>

      {/* Indicateur de sauvegarde */}
      <AnimatePresence>
        {saving && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-8 z-50"
          >
            <div className="bg-[#ff6b35] text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('settings.saving')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

NotificationsSection.propTypes = {};

export default NotificationsSection;
