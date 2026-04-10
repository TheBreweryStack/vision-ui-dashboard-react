/**
 * SERVICE WORKER STUB FILE - DO NOT DELETE
 * =========================================
 * 
 * @file public/sw.js
 * @description This is a migration stub that cleans up old Service Worker registrations.
 *              The actual Service Worker is now at /sw-v6.js (versioned filename).
 * 
 * @created 2026-01-26
 * @author TraderCafé Team
 * 
 * @reason CDN caching was serving stale sw.js files even after code updates,
 *         breaking push notifications for users. Switching to versioned filenames
 *         (sw-v6.js, sw-v7.js, etc.) bypasses CDN cache completely since the
 *         filename itself changes with each version.
 * 
 * @migration-strategy
 * When a user visits with an old /sw.js registration:
 * 1. This stub installs and activates (replacing the old SW)
 * 2. Stub sends SW_UPDATED message to all open client windows
 * 3. Clients reload and register the new versioned /sw-v6.js
 * 4. Stub unregisters itself to complete the migration
 * 
 * @keep-forever This file should remain indefinitely for users returning after
 *               extended periods (weeks/months) who still have the old SW registered.
 *               The file is only ~1KB and acts as a safety net for edge cases.
 * 
 * @future-updates When updating the Service Worker in the future:
 * 1. Create new versioned file: public/sw-v7.js (increment version number)
 * 2. Update SW_FILENAME in src/lib/pushNotifications.ts to 'sw-v7.js'
 * 3. Update EXPECTED_SW_VERSION in src/lib/pushNotifications.ts
 * 4. Update EXPECTED_SW_VERSION in src/pages/Diagnostics.tsx
 * 5. Convert the previous sw-v6.js to a stub (copy this file's pattern)
 * 6. Keep this sw.js stub unchanged - it handles the oldest registrations
 * 
 * @see src/lib/pushNotifications.ts - SW_FILENAME and EXPECTED_SW_VERSION constants
 * @see public/sw-v6.js - The current active Service Worker
 */

console.log('[SW-STUB] Old service worker detected, cleaning up...');

self.addEventListener('install', (event) => {
  console.log('[SW-STUB] Installing stub to clean up old SW');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW-STUB] Activating stub, will unregister and reload clients');
  
  event.waitUntil(
    (async () => {
      // Take control of all clients
      await clients.claim();
      
      // Get all clients
      const allClients = await clients.matchAll({ includeUncontrolled: true });
      
      // Tell them to reload (they'll register the new SW on reload)
      for (const client of allClients) {
        client.postMessage({ 
          type: 'SW_UPDATED', 
          message: 'Old service worker cleaned up. Reloading to use new version.' 
        });
      }
      
      // Unregister this stub
      await self.registration.unregister();
      
      console.log('[SW-STUB] Cleanup complete, clients should reload');
    })()
  );
});

// Handle any messages (for compatibility with health checks)
self.addEventListener('message', (event) => {
  console.log('[SW-STUB] Message received, responding with stub version');
  if (event.data?.type === 'PING') {
    event.ports[0].postMessage({ 
      type: 'PONG', 
      version: 'STUB-PLEASE-RELOAD',
      timestamp: Date.now() 
    });
  }
});
