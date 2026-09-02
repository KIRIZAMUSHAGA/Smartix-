// =============================
// SERVICE WORKER FUSIONNÉ
// Smartix PWA + Notifications Push
// =============================

const CACHE_VERSION = 'smartix-v1.0.0';
const CACHE_NAME = CACHE_VERSION;

// URLs à mettre en cache
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/static/js/main.js',
  '/static/css/main.css'
];

// =============================
// 1️⃣ INSTALLATION
// =============================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(CACHE_URLS);
    })
  );
  
  self.skipWaiting();
});

// =============================
// 2️⃣ ACTIVATION
// =============================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  // Nettoyer les anciens caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  
  self.clients.claim();
});

// =============================
// 3️⃣ FETCH (GESTION DES REQUÊTES)
// =============================
self.addEventListener('fetch', (event) => {
  // ⛔ Le Cache API ne supporte que les GET. On laisse passer tel quel
  // toutes les requêtes non-GET (POST/PUT/DELETE…) sans interception.
  if (event.request.method !== 'GET') {
    return;
  }

  // Stratégie pour les appels API
  if (event.request.url.includes('/api/')) {
    // Network first pour les API
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Mettre en cache la réponse (GET uniquement)
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback en cache si hors ligne
          return caches.match(event.request);
        })
    );
  } else {
    // Cache first pour les assets statiques
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Fallback offline pour les pages HTML
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/offline.html');
          }
        });
      })
    );
  }
});

// =============================
// 4️⃣ NOTIFICATIONS PUSH
// =============================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    data = {
      title: 'Smartix',
      body: 'Nouvelle notification',
      data: {
        screen: 'feed',
        id: null
      }
    };
  }
  
  const options = {
    body: data.body || 'Vous avez une nouvelle notification',
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    vibrate: [200, 100, 200],
    data: data.data || {
      screen: data.screen || 'feed',
      id: data.id || data.postId || null
    },
    actions: [
      {
        action: 'open',
        title: 'Ouvrir'
      },
      {
        action: 'dismiss',
        title: 'Ignorer'
      }
    ],
    tag: data.tag || Date.now().toString(),
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Smartix', options)
  );
});

// =============================
// 5️⃣ CLIC SUR NOTIFICATION
// =============================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  // Récupérer les données de la notification
  const notificationData = event.notification.data || {};
  const screen = notificationData.screen;
  const id = notificationData.id || notificationData.postId;
  
  // Action de la notification
  if (event.action === 'dismiss') {
    console.log('[SW] User dismissed notification');
    return;
  }
  
  // Construire l'URL en fonction du type de notification
  let url = '/';
  
  if (screen === 'post' && id) {
    url = `/post/${id}`;
  } else if (screen === 'message' && id) {
    url = `/messages/${id}`;
  } else if (screen === 'like' && id) {
    url = `/post/${id}`;
  } else if (screen === 'comment' && id) {
    url = `/post/${id}`;
  } else if (screen === 'friend_request' && id) {
    url = `/profile/${id}`;
  } else if (screen === 'group_invite' && id) {
    url = `/groups/${id}`;
  } else if (screen === 'notification') {
    url = '/notifications';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Vérifier si une fenêtre est déjà ouverte sur cette URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// =============================
// 6️⃣ SYNC BACKGROUND (optionnel)
// =============================
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  console.log('[SW] Syncing notifications...');
  // Ici, on pourrait envoyer des notifications en attente
}

// =============================
// 7️⃣ MISE À JOUR DE L'ABONNEMENT
// =============================
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    fetch('/api/notifications/update-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldSubscription: event.oldSubscription,
        newSubscription: event.newSubscription
      })
    })
  );
});

// =============================
// 8️⃣ MESSAGES DEPUIS LE CLIENT
// =============================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
