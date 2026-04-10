import { logger } from '@/lib/logger';
/**
 * Build version and cache management utilities
 */

export const BUILD_VERSION = typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();

const VERSION_STORAGE_KEY = 'app_build_version';

/**
 * Check if a newer build is available by fetching version.json
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return false;

    const data = await response.json();
    return data.version !== BUILD_VERSION;
  } catch {
    return false;
  }
}

/**
 * Log build info to console for debugging
 */
export function logBuildInfo(): void {
  logger.log(`[Build] Version: ${BUILD_VERSION}`);
  logger.log(`[Build] Time: ${BUILD_TIME}`);
}

/**
 * Check if version changed and clear caches if needed
 * Returns true if a reload is needed
 */
export function handleVersionChange(): boolean {
  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
  
  // First visit or same version
  if (!storedVersion || storedVersion === BUILD_VERSION) {
    localStorage.setItem(VERSION_STORAGE_KEY, BUILD_VERSION);
    return false;
  }

  logger.log(`[Build] Version changed: ${storedVersion} → ${BUILD_VERSION}`);
  
  // Version changed - clear caches
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        logger.log(`[Build] Clearing cache: ${name}`);
        caches.delete(name);
      });
    });
  }

  // Unregister all service workers to force a clean slate
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        logger.log(`[Build] Unregistering service worker:`, registration.scope);
        registration.unregister();
      });
    });
  }

  // Update stored version
  localStorage.setItem(VERSION_STORAGE_KEY, BUILD_VERSION);
  
  return true;
}

/**
 * Clear all caches and reload the page
 * Used for seamless updates during app startup
 */
export async function clearCachesAndReload(): Promise<void> {
  logger.log('[Build] Clearing caches and reloading...');
  
  // Clear all caches
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => {
      logger.log(`[Build] Clearing cache: ${name}`);
      return caches.delete(name);
    }));
  }
  
  // Update stored version to prevent reload loop
  localStorage.setItem(VERSION_STORAGE_KEY, 'updating');
  
  // Force reload from server
  window.location.reload();
}
