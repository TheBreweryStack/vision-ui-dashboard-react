/// <reference types="vite/client" />

declare const __BUILD_VERSION__: string;
declare const __BUILD_TIME__: string;

// Push API types - pushManager exists on ServiceWorkerRegistration at runtime
// but may not be included in all TypeScript lib configurations.
interface PushSubscriptionOptionsInit {
  userVisibleOnly?: boolean;
  applicationServerKey?: BufferSource | string | null;
}

interface PushManager {
  getSubscription(): Promise<PushSubscription | null>;
  subscribe(options?: PushSubscriptionOptionsInit): Promise<PushSubscription>;
  permissionState(options?: PushSubscriptionOptionsInit): Promise<PushPermissionState>;
}

type PushPermissionState = 'denied' | 'granted' | 'prompt';

interface ServiceWorkerRegistration {
  readonly pushManager: PushManager;
}
