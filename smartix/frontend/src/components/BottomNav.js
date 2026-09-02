import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Home, 
  BookOpen, 
  Users, 
  ShoppingBag, 
  Newspaper, 
  GraduationCap,
  Sparkles
} from 'lucide-react';
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
const ACTIVE_COLOR = '#ff6b35';
const ANIMATION_DURATION = 300;

// ✅ Liste des pages principales où la BottomNav doit apparaître
const MAIN_PAGES = new Set([
  '/home',
  '/courses',
  '/feed',
  '/news',
  '/smartix-store',
  '/vibe-coding',
  '/seller/dashboard'
]);

// Types

// =============================
// COMPOSANT PRINCIPAL
// =============================
const BottomNav = () => {
  const { isOpen: isStoryViewerOpen } = useStoryViewer();
  const location = useLocation();
  const { user } = useAuth();
  const { client } = useApiClient();
  const { t } = useTranslation();

  const [counts, setCounts] = useState({
    notifications: 0,
    friend_requests: 0,
    messages: 0,
    groups: 0,
    has_new_friends: false,
    active_suggestions_count: 0
  });

  // ✅ État pour savoir si l'utilisateur a vu les activités
  const [hasSeenActivities, setHasSeenActivities] = useState(false);

  // =============================
  // VÉRIFICATION SI LA PAGE ACTUELLE EST UNE PAGE PRINCIPALE
  // =============================
  const isMainPage = useMemo(() => 
    MAIN_PAGES.has(location.pathname), 
    [location.pathname]
  );

  // ✅ VÉRIFICATION SI ON EST SUR LA PAGE COMMUNAUTÉ
  const isOnFeedPage = location.pathname === '/feed';

  // ✅ CALCUL SI DES ACTIVITÉS SONT PRÉSENTES (TOUS TYPES CONFONDUS)
  const hasAnyActivity = useMemo(() => {
    return counts.messages > 0 || 
           counts.notifications > 0 || 
           counts.friend_requests > 0 || 
           counts.groups > 0 || 
           counts.has_new_friends ||
           counts.active_suggestions_count > 0;
  }, [counts]);

  // ✅ DÉTERMINER SI LE POINT ROUGE DOIT APPARAÎTRE SUR L'ICÔNE COMMUNAUTÉ
  const shouldShowFeedBadge = useMemo(() => {
    // Ne pas afficher si on est déjà sur la page feed
    if (isOnFeedPage) return false;
    
    // Afficher si:
    // 1. Il y a des activités (messages, groupes, amis, notifications) ET
    // 2. L'utilisateur ne les a pas encore vues
    return hasAnyActivity && !hasSeenActivities;
  }, [isOnFeedPage, hasAnyActivity, hasSeenActivities]);

  // =============================
  // CHARGEMENT DES COMPTEURS
  // =============================
  const fetchCounts = useCallback(async () => {
    if (!user) return;

    try {
      const [notifRes, badgeRes] = await Promise.allSettled([
        client.get('/notifications/counts'),
        client.get('/friends/badge-status')
      ]);

      const newCounts = {
        notifications: 0,
        friend_requests: 0,
        messages: 0,
        groups: 0,
        has_new_friends: false,
        active_suggestions_count: 0
      };

      if (notifRes.status === 'fulfilled') {
        const notifData = notifRes.value.data;
        newCounts.notifications = notifData?.notifications || 0;
        newCounts.friend_requests = notifData?.friend_requests || 0;
        newCounts.messages = notifData?.messages || 0;
        newCounts.groups = notifData?.groups || 0;
      }

      if (badgeRes.status === 'fulfilled') {
        const badgeData = badgeRes.value.data;
        newCounts.has_new_friends = badgeData?.has_new_users || false;
        newCounts.active_suggestions_count = badgeData?.active_suggestions_count || 0;
      }

      setCounts(newCounts);
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Failed to fetch notification counts:', error);
        
        if (error?.response?.status === 429) {
          toast.warning('Trop de requêtes, ralentissez');
        }
      }
    }
  }, [user, client]);

  // =============================
  // CHARGEMENT INITIAL + INTERVALLE
  // =============================
  useEffect(() => {
    if (!user) return;

    fetchCounts();
    const interval = setInterval(fetchCounts, REFRESH_INTERVAL);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCounts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchCounts]);

  // ✅ RÉINITIALISER LE BADGE QUAND ON CLIQUE SUR L'ICÔNE COMMUNAUTÉ
  const handleFeedClick = useCallback(() => {
    setHasSeenActivities(true);
  }, []);

  // ✅ RÉINITIALISER LE BADGE QUAND ON REVIENT SUR LA PAGE (si déjà sur feed)
  useEffect(() => {
    if (isOnFeedPage) {
      setHasSeenActivities(true);
    }
  }, [isOnFeedPage]);

  // ✅ RÉINITIALISER LE BADGE QUAND LES COMPTEURS CHANGENT (si on est sur feed)
  useEffect(() => {
    if (isOnFeedPage) {
      setHasSeenActivities(true);
    } else if (hasAnyActivity) {
      // Si de nouvelles activités arrivent et qu'on n'est pas sur feed,
      // le badge réapparaît
      setHasSeenActivities(false);
    }
  }, [hasAnyActivity, isOnFeedPage]);

  // =============================
  // ITEMS DE NAVIGATION (mémorisés)
  // =============================
  const navItems = useMemo(() => [
    { path: '/home', icon: Home, label: t('nav.home') },
    { path: '/courses', icon: GraduationCap, label: t('nav.courses') },
    { path: '/feed', icon: Users, label: t('nav.community') },
    { path: '/news', icon: Newspaper, label: t('nav.news') },
    { path: '/smartix-store', icon: ShoppingBag, label: t('nav.store') },
    { path: '/vibe', icon: Sparkles, label: 'Vibe Coding', exact: true },
    { path: '/seller/dashboard', icon: BookOpen, label: 'Vendre' }
  ], [t]);

  // =============================
  // VÉRIFICATION SI ACTIF (avec support exact)
  // =============================
  const isActivePath = useCallback((item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  }, [location.pathname]);

  // =============================
  // STYLES DYNAMIQUES
  // =============================
  const getIconClasses = useCallback((isActive) => {
    const baseClasses = 'w-5 h-5 transition-all duration-300';
    if (isActive) {
      return `${baseClasses} text-[${ACTIVE_COLOR}] drop-shadow-[0_0_8px_rgba(255,107,53,0.6)]`;
    }
    return `${baseClasses} text-muted-foreground group-hover:text-foreground`;
  }, []);

  const getLabelClasses = useCallback((isActive) => {
    const baseClasses = 'text-[8px] font-black uppercase tracking-tighter mt-1 transition-all duration-300 line-clamp-1 px-0.5';
    if (isActive) {
      return `${baseClasses} text-[${ACTIVE_COLOR}] opacity-100`;
    }
    return `${baseClasses} text-muted-foreground/50 opacity-70 group-hover:opacity-100`;
  }, []);

  // =============================
  // CONDITIONS D'AFFICHAGE
  // =============================
  if (isStoryViewerOpen || !isMainPage) return null;

  return (
    <nav 
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 bg-background/95 border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-50 backdrop-blur-3xl h-20 pb-safe transition-colors duration-300"
    >
      <div className="flex items-center justify-between w-full h-full px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item);
          const isFeedItem = item.path === '/feed';

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={isFeedItem ? handleFeedClick : undefined}
              className="flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 relative group"
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`relative transition-all duration-${ANIMATION_DURATION} ${isActive ? 'scale-110' : 'scale-100'}`}>
                <Icon className={getIconClasses(isActive)} />
                
                {/* ✅ Point rouge pour l'icône communauté - TOUTES les activités */}
                {isFeedItem && shouldShowFeedBadge && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse z-10 shadow-sm" 
                       title="Nouvelles activités (messages, groupes, amis, notifications)" 
                  />
                )}
                
                {/* Point indicateur pour les éléments actifs */}
                {isActive && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#ff6b35] rounded-full shadow-[0_0_10px_#ff6b35]" />
                )}
              </div>

              <span className={getLabelClasses(isActive)}>
                {item.label}
              </span>

              {/* Barre d'accent */}
              {isActive && (
                <div className="absolute bottom-0 w-6 h-1 bg-[#ff6b35] rounded-t-full shadow-[0_0_15px_rgba(255,107,53,0.8)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default React.memo(BottomNav);
BottomNav.propTypes = {};
