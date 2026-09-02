import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Trash2, Volume2, Filter, CheckCheck, Check, Loader, ExternalLink } from 'lucide-react';
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
const NOTIFICATIONS_PER_PAGE = 20;
const REFRESH_INTERVAL = 15000; // 15 secondes
const CACHE_TTL = 30000; // 30 secondes
const FILTER_OPTIONS = [
  { id: 'all', label: 'Toutes', icon: '🔔' },
  { id: 'unread', label: 'Non lues', icon: '🆕' },
  { id: 'mentions', label: 'Mentions', icon: '@' }
];

// =============================
// MODAL DE CONFIRMATION LIEN EXTERNE
// =============================
const ExternalLinkModal = ({ isOpen, onClose, url, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-2xl animate-slideUp">
        <div className="flex items-center gap-3 mb-4">
          <ExternalLink className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Lien externe</h3>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Vous allez quitter l'application pour accéder à :
        </p>
        
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-6 break-all">
          <span className="text-blue-500 text-sm">{url}</span>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            Continuer
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  const globalCache = useGlobalCache();
  const { getNotificationsCache, updateNotificationsCache } = globalCache;

  console.log('[NOTIFICATIONS][RENDER]', {
    hasUser: !!user,
    hasClient: !!client,
    getNotificationsCache_type: typeof getNotificationsCache,
    updateNotificationsCache_type: typeof updateNotificationsCache,
  });

  // États
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [groupedNotifications, setGroupedNotifications] = useState({});
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [pendingLink, setPendingLink] = useState(null);
  
  const highlightTimeoutRef = useRef(null);

  // =============================
  // REDIRECTION SI NON CONNECTÉ
  // =============================
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // =============================
  // NETTOYAGE DES TIMEOUTS
  // =============================
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // =============================
  // GROUPEMENT PAR DATE (mémorisé)
  // =============================
  const groupByDate = useCallback((notifs) => {
    const grouped = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifs.forEach((notif) => {
      const date = new Date(notif.created_at);
      let dateKey = '';

      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Aujourd\'hui';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Hier';
      } else {
        dateKey = date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(notif);
    });

    return grouped;
  }, []);

  // =============================
  // FORMATAGE RELATIF DU TEMPS (mémorisé)
  // =============================
  const getRelativeTime = useCallback((date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diff = Math.floor((now - notifDate) / 1000); // secondes

    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return notifDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  }, []);

  // =============================
  // CHARGEMENT DES NOTIFICATIONS
  // =============================
  const fetchNotifications = useCallback(async (reset = false) => {
    if (!user) return;

    try {
      // Vérification du cache pour le reset
      if (reset) {
        const cached = getNotificationsCache();
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setNotifications(cached.data);
          setGroupedNotifications(groupByDate(cached.data));
          setLoading(false);
          return;
        }
        setNotifications([]); // ✅ UNIQUEMENT si cache vide ou expiré
      } else {
        setLoadingMore(true);
      }

      const response = await client.get('/notifications', {
        params: {
          page: reset ? 1 : page,
          limit: NOTIFICATIONS_PER_PAGE
        }
      });

      if (response?.success) {
        const newNotifications = response.notifications || [];
        
        setNotifications(prev => reset ? newNotifications : [...prev, ...newNotifications]);
        setHasMore(newNotifications.length === NOTIFICATIONS_PER_PAGE);

        // Mettre à jour le cache pour la page 1
        if (reset) {
          updateNotificationsCache({
            data: newNotifications,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else {
        toast.error('Erreur de chargement des notifications');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, client, page, getNotificationsCache, updateNotificationsCache, groupByDate, navigate]);

  // =============================
  // GROUPEMENT DES NOTIFICATIONS (quand elles changent)
  // =============================
  useEffect(() => {
    setGroupedNotifications(groupByDate(notifications));
  }, [notifications, groupByDate]);

  // =============================
  // CHARGEMENT INITIAL + REFRESH
  // =============================
  useEffect(() => {
    if (user) {
      fetchNotifications(true);
      
      const interval = setInterval(() => {
        fetchNotifications(true);
      }, REFRESH_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]); // ✅ fetchNotifications inclus dans les dépendances

  // =============================
  // CHARGER PLUS (pagination)
  // =============================
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    if (page > 1) {
      fetchNotifications();
    }
  }, [page, fetchNotifications]); // ✅ fetchNotifications inclus

  // =============================
  // MARQUER COMME LU
  // =============================
  const handleMarkAsRead = useCallback(async (ids) => {
    try {
      await client.post('/notifications/mark-read', { ids });
      
      // Mise à jour optimiste
      setNotifications(prev =>
        prev.map(n =>
          ids.includes(n.id) ? { ...n, read: true } : n
        )
      );

      // Animation de highlight
      ids.forEach(id => {
        setHighlightedId(id);
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedId(null);
        }, 1000);
      });

      toast.success('Notification marquée comme lue');
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Erreur lors du marquage');
    }
  }, [client]);

  // =============================
  // SUPPRIMER
  // =============================
  const handleDelete = useCallback(async (id) => {
    try {
      await client.delete(`/notifications/${id}`);
      
      // Mise à jour optimiste
      setNotifications(prev => prev.filter(n => n.id !== id));

      toast.success('Notification supprimée');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Erreur lors de la suppression');
    }
  }, [client]);

  // =============================
  // MARQUER TOUT COMME LU (AVEC ANIMATION)
  // =============================
  const handleMarkAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAllAsRead(true);

    try {
      await client.post('/notifications/mark-read', { ids: unreadIds });
      
      // Animation séquentielle pour un effet visuel
      unreadIds.forEach((id, index) => {
        setTimeout(() => {
          setHighlightedId(id);
        }, index * 100);
      });

      // Mise à jour optimiste
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );

      setTimeout(() => {
        setHighlightedId(null);
        toast.success('Toutes les notifications marquées comme lues');
      }, unreadIds.length * 100 + 500);

    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Erreur lors du marquage global');
    } finally {
      setMarkingAllAsRead(false);
    }
  }, [client, notifications]);

  // =============================
  // GESTION DU CLIC SUR NOTIFICATION
  // =============================
  const handleNotificationClick = useCallback(async (notification) => {
    // 1. Marquer comme lu si non lu
    if (!notification.read) {
      await handleMarkAsRead([notification.id]);
    }

    // 2. Fonction de redirection interne
    const redirect = (path) => {
      if (path) navigate(path);
    };

    // 3. Fonction pour lien externe avec confirmation
    const redirectExternal = (url) => {
      setPendingLink(url);
      setShowExternalLinkModal(true);
    };

    // 4. Si pas de destination, juste afficher le contenu
    if (!notification.link && !notification.postId && !notification.userId && !notification.groupId) {
      toast.info(notification.content);
      return;
    }

    // 5. Lien direct prioritaire
    if (notification.link) {
      if (notification.link.startsWith('http')) {
        redirectExternal(notification.link);
      } else {
        redirect(notification.link);
      }
      return;
    }

    // 6. Redirection basée sur le type
    switch (notification.type) {
      case 'like':
      case 'comment':
      case 'mention':
        if (notification.postId) redirect(`/posts/${notification.postId}`);
        break;

      case 'friend_request':
      case 'friend_accept':
        if (notification.userId) redirect(`/profile/${notification.userId}`);
        break;

      case 'group_invite':
      case 'group_join':
        if (notification.groupId) redirect(`/groups/${notification.groupId}`);
        break;

      default:
        if (notification.link) redirect(notification.link);
    }
  }, [handleMarkAsRead, navigate]);

  // =============================
  // FILTRE (optimisé avec Set)
  // =============================
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread') return !n.read;
      if (filter === 'mentions') return n.priority === 'high' || n.type === 'mention';
      return true;
    });
  }, [notifications, filter]);

  // Set des IDs filtrés pour recherche O(1)
  const filteredIds = useMemo(() => 
    new Set(filteredNotifications.map(n => n.id)), 
    [filteredNotifications]
  );

  // =============================
  // STATISTIQUES
  // =============================
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length, 
    [notifications]
  );

  const mentionsCount = useMemo(() => 
    notifications.filter(n => n.priority === 'high').length,
    [notifications]
  );

  // =============================
  // RENDU D'UNE NOTIFICATION
  // =============================
  const renderNotificationItem = useCallback((notification) => {
    const priorityColor = notification.priority === 'high' 
      ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500' 
      : 'bg-white dark:bg-gray-800 border-l-4 border-gray-200 dark:border-gray-700';

    const isHighlighted = highlightedId === notification.id;

    return (
      <div
        key={notification.id}
        className={`p-4 ${priorityColor} rounded-lg transition-all duration-300 hover:shadow-md cursor-pointer ${
          isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' : ''
        }`}
        onClick={() => handleNotificationClick(notification)}
      >
        <div className="flex items-start gap-3">
          {/* Avatar(s) - avec clé unique */}
          <div className="relative flex-shrink-0">
            {notification.actors && notification.actors.length > 0 ? (
              <div className="flex -space-x-2">
                {notification.actors.slice(0, 2).map((actor) => (
                  <Avatar key={actor.id} className="w-10 h-10 border-2 border-white dark:border-gray-900">
                    <AvatarImage src={actor.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white">
                      {(actor.name || 'U')[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            ) : (
              <Avatar className="w-10 h-10">
                <AvatarImage src={notification.actor_avatar} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white">
                  {(notification.actor_name || 'U')[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <p className={`text-gray-900 dark:text-white ${!notification.read ? 'font-bold' : 'font-normal'}`}>
              {notification.content}
            </p>

            {notification.count > 1 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                et {notification.count - 1} autres
              </p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {getRelativeTime(notification.created_at)}
              </span>

              {notification.priority === 'high' && (
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {!notification.read && (
              <button
                onClick={() => handleMarkAsRead([notification.id])}
                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-all"
                title="Marquer comme lu"
              >
                <Bell className="w-4 h-4 text-blue-500" />
              </button>
            )}

            <button
              onClick={() => handleDelete(notification.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-all"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }, [handleMarkAsRead, handleDelete, getRelativeTime, highlightedId, handleNotificationClick]);

  // Rendu si non connecté
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-blue-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAllAsRead}
                className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingAllAsRead ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Tout marquer comme lu</span>
              </button>
            )}
          </div>

          {/* Filtres */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                  filter === f.id
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="mr-2">{f.icon}</span>
                {f.label}
                {f.id === 'unread' && unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
                {f.id === 'mentions' && mentionsCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {mentionsCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

           {/* Contenu */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'unread' 
                ? 'Aucune notification non lue' 
                : filter === 'mentions'
                ? 'Aucune mention'
                : 'Aucune notification'}
            </p>
          </div>
        ) : (
          <>
            {Object.entries(groupedNotifications).map(([dateKey, notifs]) => {
              // Filtrage optimisé avec Set (O(1))
              const filteredInGroup = notifs.filter(n => filteredIds.has(n.id));
              
              if (filteredInGroup.length === 0) return null;

              return (
                <div key={dateKey} className="mb-6">
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {dateKey}
                  </h2>
                  <div className="space-y-2">
                    {filteredInGroup.map(notif => renderNotificationItem(notif))}
                  </div>
                </div>
              );
            })}

            {/* Bouton Charger plus */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <div className="flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Chargement...</span>
                    </div>
                  ) : (
                    'Charger plus'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de confirmation lien externe */}
      <ExternalLinkModal
        isOpen={showExternalLinkModal}
        onClose={() => {
          setShowExternalLinkModal(false);
          setPendingLink(null);
        }}
        url={pendingLink}
        onConfirm={() => {
          if (pendingLink) {
            window.open(pendingLink, '_blank');
          }
          setShowExternalLinkModal(false);
          setPendingLink(null);
        }}
      />
    </div>
  );
};

NotificationsPage.propTypes = {};

export default NotificationsPage;
ExternalLinkModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  url: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
