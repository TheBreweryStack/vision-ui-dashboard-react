// Service Worker for TraderCafé Push Notifications
// IMPORTANT: Update SW_VERSION when making SW changes to force refresh on published sites
const SW_VERSION = 'v6-2026-03-03a';
const CACHE_VERSION = SW_VERSION;

// Import Workbox for caching (same functionality VitePWA would provide)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

console.log('[SW] Service Worker loading, version:', SW_VERSION);

// Workbox runtime caching for fonts and static assets
if (typeof workbox !== 'undefined') {
  console.log('[SW] Workbox loaded successfully');
  
  workbox.core.clientsClaim();
  
  // Cache Google Fonts
  workbox.routing.registerRoute(
    /^https:\/\/fonts\.googleapis\.com\/.*/i,
    new workbox.strategies.CacheFirst({
      cacheName: 'google-fonts-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365
        })
      ]
    })
  );
  
  workbox.routing.registerRoute(
    /^https:\/\/fonts\.gstatic\.com\/.*/i,
    new workbox.strategies.CacheFirst({
      cacheName: 'gstatic-fonts-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365
        })
      ]
    })
  );
} else {
  console.log('[SW] Workbox not available, continuing without caching');
}

// Handle messages from clients (for skip waiting and health checks)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  // Respond to ping messages WITH VERSION for client-side validation
  if (event.data && event.data.type === 'PING') {
    console.log('[SW] PING received, sending PONG with version:', SW_VERSION);
    event.ports[0].postMessage({ 
      type: 'PONG', 
      timestamp: Date.now(),
      version: SW_VERSION 
    });
    return;
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting and taking control...');
    self.skipWaiting();
    return;
  }

  // Handle local notification requests from the client
  // This uses registration.showNotification() which has higher OS priority than new Notification()
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, tag } = event.data;
    console.log('[SW] SHOW_NOTIFICATION received:', { title, body, url, tag });
    
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/app-icon.png',
        badge: '/app-icon.png',
        tag: tag || 'local-alert',
        data: { url: url || '/dashboard' },
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200]
      })
    );
    return;
  }
});

// Update app badge (PWA icon badge)
async function updateBadge(count = 1) {
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    } catch (e) {
      console.log('[SW] Badge update failed:', e);
    }
  }
}

// Forward push payload to all open clients for in-app toast
async function forwardToClients(payload) {
  try {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        payload: {
          title: payload.title,
          body: payload.body,
          url: payload.data?.url || '/dashboard'
        }
      });
    }
    console.log('[SW] Forwarded push to', allClients.length, 'clients');
  } catch (e) {
    console.log('[SW] Failed to forward to clients:', e);
  }
}

// Handle push events from the server
self.addEventListener('push', (event) => {
  console.log('[SW] ✅ Push event received!', event);
  console.log('[SW] Has data:', !!event.data);
  
  let payload = {
    title: 'TraderCafé',
    body: 'You have a new notification',
    icon: '/app-icon.png',
    badge: '/app-icon.png',
    tag: 'default',
    data: { url: '/dashboard' }
  };

  // Try to parse the push payload
  if (event.data) {
    try {
      console.log('[SW] Raw push data:', event.data.text());
      const data = event.data.json();
      console.log('[SW] Parsed payload:', data);
      payload = {
        title: data.title || payload.title,
        body: data.body || payload.body,
        icon: data.icon || payload.icon,
        badge: data.badge || payload.badge,
        tag: data.tag || payload.tag,
        data: data.data || payload.data
      };
    } catch (e) {
      console.log('[SW] JSON parse failed, using text:', e);
      // If JSON parsing fails, use the text as body
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    data: payload.data,
    requireInteraction: false,
    silent: false, // EXPLICIT: Enable system notification sound
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    (async () => {
      // Show the system notification
      await self.registration.showNotification(payload.title, options);
      await updateBadge(1);
      
      // Forward to open clients for in-app toast
      await forwardToClients(payload);
    })()
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');
  
  event.notification.close();

  // Clear app badge when user interacts with notification
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL to open from notification data
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate the existing window and focus it
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed by user');
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed, version:', SW_VERSION);
  self.skipWaiting();
});

// Handle service worker activation - clear all old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated, version:', SW_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW] Clearing', cacheNames.length, 'caches on activation');
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => clients.claim())
  );
});
