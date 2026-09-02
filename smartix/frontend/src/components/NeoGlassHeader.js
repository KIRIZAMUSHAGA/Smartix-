import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Menu, Mail, User, Users } from 'lucide-react'; // ✅ User au lieu de UserCheck, Users conservé
import { toast } from 'sonner';

// Hooks personnalisés
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { useStoryViewer } from '../contexts/StoryViewerContext';
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================
const REFRESH_INTERVAL = 30000; // 30 secondes
const MAX_COUNT = 99;
const DISPLAY_LIMIT = 9;

// Configuration des endpoints API
const API_ENDPOINTS = {
  NOTIFICATIONS: '/notifications/counts',
  MESSAGES: '/messages/unread-count',
  BADGE_STATUS: '/friends/badge-status'
};

// Types

// =============================
// FONCTIONS UTILITAIRES HORS COMPOSANT
// =============================
const formatCount = (count, max = MAX_COUNT) => {
  if (count === 0) return '';
  if (count > max) return `${max}+`;
  return count.toString();
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const NeoGlassHeader = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { isOpen: isStoryViewerOpen } = useStoryViewer();

  const [counts, setCounts] = useState({
    notifications: 0,
    messages: 0,
    suggestions: 0,
    friendRequests: 0,
    groups: 0
  });

  // ✅ VÉRIFICATION SI LA PAGE ACTUELLE EST LA PAGE COMMUNAUTÉ
  const isFeedPage = useMemo(() => 
    location.pathname === '/feed', 
    [location.pathname]
  );

  // =============================
  // CHARGEMENT DES COMPTEURS
  // =============================
  const fetchCounts = useCallback(async () => {
    if (!user) return;

    try {
      const [notifRes, msgRes, badgeRes] = await Promise.allSettled([
        client.get(API_ENDPOINTS.NOTIFICATIONS),
        client.get(API_ENDPOINTS.MESSAGES),
        client.get(API_ENDPOINTS.BADGE_STATUS)
      ]);

      const newCounts = {
        notifications: notifRes.status === 'fulfilled' ? notifRes.value.data?.unread_count ?? 0 : 0,
        messages: msgRes.status === 'fulfilled' ? msgRes.value.data?.unread_count ?? 0 : 0,
        suggestions: 0,
        friendRequests: 0,
        groups: 0
      };

      if (badgeRes.status === 'fulfilled') {
        const badgeData = badgeRes.value.data;
        newCounts.suggestions = badgeData?.active_suggestions_count ?? 0;
        newCounts.friendRequests = badgeData?.friend_requests_count ?? 0;
        newCounts.groups = badgeData?.groups_count ?? 0;
      }

      setCounts(newCounts);

    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Error fetching counts:', error);
      }
    }
  }, [user, client]);

  // =============================
  // GESTIONNAIRES D'ÉVÉNEMENTS
  // =============================
  const handleMarkAsRead = useCallback((type) => {
    setCounts(prev => ({
      ...prev,
      [type]: 0
    }));
  }, []);

  // =============================
  // EFFETS
  // =============================
  useEffect(() => {
    if (!user) return;

    fetchCounts();
    const interval = setInterval(fetchCounts, REFRESH_INTERVAL);
    
    const handleNotifUpdate = () => handleMarkAsRead('notifications');
    const handleMsgUpdate = () => handleMarkAsRead('messages');
    
    window.addEventListener('notificationsMarkedRead', handleNotifUpdate);
    window.addEventListener('messagesMarkedRead', handleMsgUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationsMarkedRead', handleNotifUpdate);
      window.removeEventListener('messagesMarkedRead', handleMsgUpdate);
    };
  }, [user, fetchCounts, handleMarkAsRead]);

  // ✅ CONDITIONS D'AFFICHAGE
  if (isStoryViewerOpen || !isFeedPage || !user) return null;

  // =============================
  // CONFIGURATION DES BOUTONS
  // =============================
  const buttons = [
    {
      id: 'messages',
      icon: Mail,
      label: 'Messages',
      path: '/messages',
      count: counts.messages,
      badgeColor: 'bg-red-600',
      badgeSize: 'w-5 h-5',
      maxCount: MAX_COUNT
    },
    {
      id: 'friends',
      icon: User,  // ✅ Icône 👤 (User)
      label: 'Amis',
      path: '/friends',
      primaryCount: counts.suggestions,
      secondaryCount: counts.friendRequests,
      badgeColor: counts.suggestions > 0 ? 'bg-blue-500' : 'bg-[#ff6b35]',
      badgeSize: 'w-4 h-4',
      maxCount: MAX_COUNT,
      isComposite: true
    },
    {
      id: 'groups',
      icon: Users,  // ✅ Icône 👥 (Users)
      label: 'Groupes',
      path: '/groups',
      count: counts.groups,
      badgeColor: 'bg-[#ff6b35]',
      badgeSize: 'w-4 h-4',
      maxCount: DISPLAY_LIMIT
    },
    {
      id: 'notifications',
      icon: Bell,  // ✅ Icône 🔔 (Bell)
      label: 'Notifications',
      path: '/notifications',
      count: counts.notifications,
      badgeColor: 'bg-red-600',
      badgeSize: 'w-5 h-5',
      maxCount: MAX_COUNT
    },
    {
      id: 'menu',
      icon: Menu,
      label: 'Menu',
      onClick: onMenuClick,
      isMenu: true
    }
  ];

  return (
    <div className="z-50 w-full flex items-center justify-center h-20 px-4">
      <div className="flex items-center justify-around w-full max-w-2xl bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl h-14 shadow-2xl px-2 transition-colors duration-300">
        {buttons.map((button) => (
          <button
            key={button.id}
            onClick={() => {
              if (button.isMenu) {
                button.onClick?.();
              } else {
                navigate(button.path);
              }
            }}
            className="relative p-2.5 hover:bg-accent rounded-2xl transition-all group"
            aria-label={button.label}
          >
            <button.icon className="w-5 h-5 text-muted-foreground group-hover:text-[#ff6b35]" />
            
            {/* Badge pour les boutons avec compteurs */}
            {!button.isMenu && (
              <>
                {button.isComposite ? (
                  // Cas spécial pour le bouton Friends avec double compteur
                  <>
                    {button.primaryCount > 0 && (
                      <span className={`absolute -top-1 -right-1 ${button.badgeColor} text-white text-[10px] rounded-full ${button.badgeSize} flex items-center justify-center font-black shadow-lg`}>
                        {formatCount(button.primaryCount, button.maxCount)}
                      </span>
                    )}
                    {button.secondaryCount > 0 && button.primaryCount === 0 && (
                      <span className={`absolute -top-1 -right-1 bg-[#ff6b35] text-white text-[10px] rounded-full ${button.badgeSize} flex items-center justify-center font-black shadow-lg`}>
                        {formatCount(button.secondaryCount, button.maxCount)}
                      </span>
                    )}
                  </>
                ) : (
                  button.count > 0 && (
                    <span className={`absolute -top-1 -right-1 ${button.badgeColor} text-white text-[10px] rounded-full ${button.badgeSize} flex items-center justify-center font-bold shadow-lg border-2 border-white dark:border-[#1C1E21] animate-in zoom-in duration-300`}>
                      {formatCount(button.count, button.maxCount)}
                    </span>
                  )
                )}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

NeoGlassHeader.propTypes = {
  onMenuClick: PropTypes.func.isRequired,
};

export default NeoGlassHeader;
