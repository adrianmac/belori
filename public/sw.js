// Belori Service Worker — Push Notifications + Offline Caching
const CACHE_NAME = 'belori-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for assets, network-first for API
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, supabase auth calls
  if (request.method !== 'GET') return;
  if (url.pathname.includes('/auth/v1/')) return;

  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
    // Network first for API, fall back to cache
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Cache first for static assets
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // Network first for HTML/navigation
  event.respondWith(
    fetch(request).catch(() => caches.match('/index.html'))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: 'Belori', body: event.data.text() }; }

  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-badge.png',
    tag: payload.tag || 'belori-notification',
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Belori', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      self.clients.openWindow(url);
    })
  );
});
