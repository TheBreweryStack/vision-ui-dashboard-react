import { supabase } from "@/lib/supabase";
import { captureDeviceMetadata, generateDeviceLabel, type DeviceMetadata } from "@/lib/deviceMetadata";
import { logger } from '@/lib/logger';

// VAPID public key for push subscription
// This must match the VAPID_KEYS_JWK secret configured in Supabase
// Generated using @negrel/webpush library for Safari compatibility
// Updated 2026-01-30 with new key pair to fix Safari BadJwtToken error
export const VAPID_PUBLIC_KEY =
  "BGfZdt36Mr5kMDNWbVYaPEhXNYlQ9Ena6sXE19pvNE3uYH060WoIxtSeHU760gGXGFFlEQ6NIHSuallMpjGkq_M";

// Re-export DeviceMetadata type for consumers
export type { DeviceMetadata };

// Versioned SW filename - update this when making SW changes
export const SW_FILENAME = "sw-v6.js";

// Expected SW version - must match SW_VERSION in the versioned SW file
export const EXPECTED_SW_VERSION = "v6-2026-01-26b";

// localStorage key for stable device identifier
const DEVICE_ID_KEY = "push_device_id";

/**
 * Get or create a stable device identifier for this browser/device.
 * This ID persists across push subscription changes and ensures we can
 * always find and replace the old subscription for THIS device.
 */
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    logger.log("[Push] Created new device ID:", deviceId.slice(0, 8) + "...");
  }
  return deviceId;
}

/**
 * Generate a fingerprint hash of the VAPID key for comparison
 * Uses first 20 chars as a simple but effective fingerprint
 */
export function getVapidKeyHash(key: string): string {
  return key.slice(0, 20);
}

/**
 * Convert a base64 URL-safe string to Uint8Array
 * Required for Push API's applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported in this browser
 */
export function isPushNotificationSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Listen for Service Worker updates from the stub
 * The old sw.js will tell clients to reload when it's replaced
 */
export function listenForServiceWorkerUpdates(): void {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_UPDATED") {
      logger.log("[Push] Service Worker updated, reloading page...", event.data.message);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  });

  logger.log("[Push] Listening for SW update messages");
}

/**
 * Register the service worker with versioned filename to bypass CDN caching
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    logger.warn("[Push] Service workers not supported");
    return null;
  }

  try {
    // Check for existing registrations with wrong script URL
    const existingRegistrations = await navigator.serviceWorker.getRegistrations();

    for (const reg of existingRegistrations) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";

      // If registered with old sw.js (not versioned), unregister it
      if (scriptURL.includes("/sw.js") && !scriptURL.includes(SW_FILENAME)) {
        logger.log("[Push] Found old SW registration, unregistering:", scriptURL);
        await reg.unregister();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // If already registered with correct versioned file, verify it works
      if (scriptURL.includes(SW_FILENAME)) {
        logger.log("[Push] Found existing versioned SW:", scriptURL);

        // Test if it responds correctly
        if (reg.active) {
          const isValid = await testSwVersion(reg.active);
          if (isValid) {
            logger.log("[Push] Existing SW is valid, keeping it");
            return reg;
          } else {
            logger.log("[Push] Existing SW version mismatch, updating...");
            await reg.update();
            return reg;
          }
        }
      }
    }

    // Register with versioned filename (no query params needed - filename IS the version)
    logger.log("[Push] Registering fresh SW:", `/${SW_FILENAME}`);
    const registration = await navigator.serviceWorker.register(`/${SW_FILENAME}`, {
      scope: "/",
      updateViaCache: "none",
    });

    logger.log("[Push] SW registered:", registration.scope);

    // Force update check
    await registration.update();

    return registration;
  } catch (error) {
    logger.error("[Push] Service worker registration failed:", error);
    return null;
  }
}

/**
 * Test if SW responds with expected version
 */
export async function testSwVersion(sw: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => resolve(false), 2000);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      const receivedVersion = event.data?.version;
      logger.log("[Push] SW version check:", receivedVersion, "expected:", EXPECTED_SW_VERSION);
      resolve(receivedVersion === EXPECTED_SW_VERSION);
    };

    sw.postMessage({ type: "PING" }, [channel.port2]);
  });
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    logger.warn("[Push] Notifications not supported");
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    logger.warn("[Push] Notifications are blocked by user");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    logger.log("[Push] Notification permission:", permission);
    return permission;
  } catch (error) {
    logger.error("[Push] Failed to request permission:", error);
    return "denied";
  }
}

/**
 * Subscribe to push notifications and save the subscription to the database
 */
export async function subscribeToPushNotifications(userId: string): Promise<boolean> {
  try {
    // 1. Ensure service worker is registered
    const registration = await registerServiceWorker();
    if (!registration) {
      throw new Error("Service worker registration failed");
    }

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    // 2. Request permission
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      logger.warn("[Push] Permission not granted");
      return false;
    }

    // 3. Always force fresh subscription to ensure VAPID key binding is correct
    // This handles VAPID key rotations - existing subscriptions may be bound to old keys
    let subscription = await registration.pushManager.getSubscription();

    // Always unsubscribe existing subscription to force fresh VAPID binding
    if (subscription) {
      logger.log("[Push] Unsubscribing existing subscription to force fresh VAPID binding...");
      await subscription.unsubscribe();
      subscription = null;
    }

    // Create fresh subscription with current VAPID key
    // Safari is strict about ArrayBuffer handling - using .buffer directly can include
    // extra bytes if the Uint8Array doesn't start at offset 0 of its ArrayBuffer.
    // Create a new ArrayBuffer with exactly the right bytes via slice().
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const keyBuffer = applicationServerKey.buffer.slice(
      applicationServerKey.byteOffset,
      applicationServerKey.byteOffset + applicationServerKey.byteLength,
    ) as ArrayBuffer;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBuffer,
    });
    logger.log("[Push] New subscription created");

    // 4. Extract keys from subscription
    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subscriptionJson.keys?.p256dh || "";
    const auth = subscriptionJson.keys?.auth || "";

    if (!p256dh || !auth) {
      throw new Error("Failed to get subscription keys");
    }

    // 5. Get stable device ID for upsert
    const deviceId = getOrCreateDeviceId();

    // 6. Delete any existing subscription for THIS DEVICE (not by endpoint!)
    // This ensures we always replace the old entry even if the endpoint changed
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("device_id", deviceId);

    if (deleteError) {
      logger.warn("[Push] Failed to delete old subscription:", deleteError);
    }

    // 7. Capture device metadata
    const deviceMetadata = captureDeviceMetadata();
    const deviceLabel = generateDeviceLabel(deviceMetadata);

    // 8. Insert new subscription with device_id and metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertData: any = {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      vapid_key_hash: getVapidKeyHash(VAPID_PUBLIC_KEY),
      device_id: deviceId,
      device_label: deviceLabel,
      device_metadata: deviceMetadata,
    };
    const { error: insertError } = await supabase.from("push_subscriptions").insert(insertData);

    if (insertError) {
      throw insertError;
    }

    logger.log("[Push] Subscription saved with device_id:", deviceId.slice(0, 8) + "...");
    return true;
  } catch (error) {
    logger.error("[Push] Subscribe failed:", error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe from push
      await subscription.unsubscribe();

      // Remove from database
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", subscription.endpoint);
    }

    logger.log("[Push] Unsubscribed successfully");
    return true;
  } catch (error) {
    logger.error("[Push] Unsubscribe failed:", error);
    return false;
  }
}

/**
 * Check if the user is currently subscribed to push notifications
 */
export async function isPushNotificationSubscribed(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * Get the current push subscription
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  try {
    if (!isPushNotificationSupported()) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Force the Service Worker to take control of the page
 * Call this when SW is active but not controlling
 */
export async function forceServiceWorkerControl(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      logger.warn("[Push] No SW registration found");
      return false;
    }

    // If there's a waiting worker, activate it immediately
    if (registration.waiting) {
      logger.log("[Push] Activating waiting service worker...");
      registration.waiting.postMessage({ type: "SKIP_WAITING" });

      // Wait for the new SW to take control
      return new Promise((resolve) => {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            logger.log("[Push] New service worker took control");
            resolve(true);
          },
          { once: true },
        );

        // Timeout after 3 seconds
        setTimeout(() => resolve(false), 3000);
      });
    }

    // If SW is active but not controlling, force unregister and re-register
    if (registration.active && !navigator.serviceWorker.controller) {
      logger.log("[Push] SW active but not controlling, forcing re-registration...");
      await registration.unregister();

      // Re-register with versioned filename
      const newRegistration = await navigator.serviceWorker.register(`/${SW_FILENAME}`, {
        scope: "/",
        updateViaCache: "none",
      });
      logger.log("[Push] New SW registered:", newRegistration.scope);

      // Wait for it to become active and controlling
      await navigator.serviceWorker.ready;
      return true;
    }

    return true;
  } catch (error) {
    logger.error("[Push] Failed to force SW control:", error);
    return false;
  }
}

/**
 * Check if the current subscription's VAPID key matches the one used to create it
 * Returns false if there's a mismatch (user needs to re-subscribe)
 */
export async function isSubscriptionValid(userId: string): Promise<boolean> {
  try {
    const subscription = await getPushSubscription();
    if (!subscription) return false;

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("vapid_key_hash")
      .eq("user_id", userId)
      .eq("endpoint", subscription.endpoint)
      .maybeSingle();

    if (error || !data?.vapid_key_hash) {
      logger.log("[Push] No stored VAPID hash found, subscription may be outdated");
      return false;
    }

    const currentHash = getVapidKeyHash(VAPID_PUBLIC_KEY);
    const isValid = data.vapid_key_hash === currentHash;

    if (!isValid) {
      logger.log("[Push] VAPID key mismatch! Stored:", data.vapid_key_hash, "Current:", currentHash);
    }

    return isValid;
  } catch (error) {
    logger.error("[Push] Error checking subscription validity:", error);
    return false;
  }
}

/**
 * Force Service Worker recovery by updating (NOT unregistering to preserve push subscription)
 */
async function forceServiceWorkerRecovery(): Promise<void> {
  logger.log("[SW Health] Forcing recovery via update (preserving push subscription)...");
  const registrations = await navigator.serviceWorker.getRegistrations();

  for (const reg of registrations) {
    // Use update() instead of unregister() to preserve the push subscription!
    // Unregistering kills the push endpoint, causing duplicate subscriptions
    await reg.update();
  }

  // Wait for SW to become active
  await navigator.serviceWorker.ready;
  logger.log("[SW Health] Recovery complete (push subscription preserved)");
}

/**
 * Start automatic SW health monitoring
 * Runs a silent ping test every 30 seconds and auto-recovers if SW is unresponsive
 *
 * @param onHealthy - Callback when SW responds successfully
 * @param onUnhealthy - Callback when SW fails to respond
 * @returns Cleanup function to stop the monitor
 */
export function startServiceWorkerHealthMonitor(onHealthy?: () => void, onUnhealthy?: () => void): () => void {
  if (!("serviceWorker" in navigator)) {
    logger.log("[SW Health] Service workers not supported, skipping monitor");
    return () => {};
  }

  let intervalId: number | undefined;
  let consecutiveFailures = 0;
  const MAX_FAILURES_BEFORE_RECOVERY = 2;
  const CHECK_INTERVAL_MS = 30000; // 30 seconds

  const checkHealth = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (!registration?.active) {
        consecutiveFailures++;
        logger.warn("[SW Health] No active SW, failures:", consecutiveFailures);
        onUnhealthy?.();

        // Try to recover if no SW at all
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_RECOVERY) {
          logger.log("[SW Health] No SW detected, attempting registration...");
          await registerServiceWorker();
          consecutiveFailures = 0;
        }
        return;
      }

      // Silent ping test with timeout
      const isAlive = await testSwVersion(registration.active);

      if (isAlive) {
        if (consecutiveFailures > 0) {
          logger.log("[SW Health] SW recovered, resetting failure count");
        }
        consecutiveFailures = 0;
        onHealthy?.();
      } else {
        consecutiveFailures++;
        logger.warn("[SW Health] Ping failed, consecutive failures:", consecutiveFailures);
        onUnhealthy?.();

        // Auto-recover after consecutive failures
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_RECOVERY) {
          logger.log("[SW Health] Too many failures, triggering recovery...");
          await forceServiceWorkerRecovery();
          consecutiveFailures = 0;
        }
      }
    } catch (error) {
      logger.error("[SW Health] Check failed:", error);
      consecutiveFailures++;
      onUnhealthy?.();
    }
  };

  // Run first check after a short delay (let app initialize)
  const initialTimeout = setTimeout(() => {
    checkHealth();
    // Then run every 30 seconds
    intervalId = window.setInterval(checkHealth, CHECK_INTERVAL_MS);
  }, 5000);

  // Return cleanup function
  return () => {
    clearTimeout(initialTimeout);
    if (intervalId) {
      clearInterval(intervalId);
    }
    logger.log("[SW Health] Monitor stopped");
  };
}
