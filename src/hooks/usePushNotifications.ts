import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  registerServiceWorker,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushNotificationSubscribed,
  isSubscriptionValid
} from '@/lib/pushNotifications';

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  needsResubscribe: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  resubscribe: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [needsResubscribe, setNeedsResubscribe] = useState(false);

  // Check initial state
  const checkSubscriptionStatus = useCallback(async () => {
    console.log('[usePushNotifications] Starting check for user:', user?.id);
    
    if (!user) {
      console.log('[usePushNotifications] No user, setting loading false');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supported = isPushNotificationSupported();
      console.log('[usePushNotifications] Push supported:', supported);
      setIsSupported(supported);

      if (!supported) {
        console.log('[usePushNotifications] Push not supported, exiting');
        setIsLoading(false);
        return;
      }

      const currentPermission = getNotificationPermission();
      console.log('[usePushNotifications] Current permission:', currentPermission);
      setPermission(currentPermission);

      const subscribed = await isPushNotificationSubscribed();
      console.log('[usePushNotifications] Is subscribed:', subscribed);
      setIsSubscribed(subscribed);

      // Check if subscription is still valid (VAPID key matches)
      if (subscribed) {
        const valid = await isSubscriptionValid(user.id);
        console.log('[usePushNotifications] Subscription valid:', valid);
        if (!valid) {
          console.log('[usePushNotifications] Subscription invalid, needs re-subscribe');
          setNeedsResubscribe(true);
          setIsSubscribed(false); // Mark as not subscribed since it's invalid
        } else {
          setNeedsResubscribe(false);
        }
      } else {
        setNeedsResubscribe(false);
      }
    } catch (error) {
      console.error('[usePushNotifications] Check failed:', error);
    } finally {
      console.log('[usePushNotifications] Check complete, setting loading false');
      setIsLoading(false);
    }
  }, [user]);

  // Initialize on mount
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Register service worker immediately
    registerServiceWorker().catch(console.error);

    // Check subscription status
    checkSubscriptionStatus();
  }, [user, checkSubscriptionStatus]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('[usePushNotifications] No user logged in');
      return false;
    }

    setIsLoading(true);
    try {
      const success = await subscribeToPushNotifications(user.id);
      if (success) {
        setIsSubscribed(true);
        setPermission('granted');
        setNeedsResubscribe(false);
      }
      return success;
    } catch (error) {
      console.error('[usePushNotifications] Subscribe failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('[usePushNotifications] No user logged in');
      return false;
    }

    setIsLoading(true);
    try {
      const success = await unsubscribeFromPushNotifications(user.id);
      if (success) {
        setIsSubscribed(false);
        setNeedsResubscribe(false);
      }
      return success;
    } catch (error) {
      console.error('[usePushNotifications] Unsubscribe failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Resubscribe: unsubscribe old, subscribe new
  const resubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('[usePushNotifications] No user logged in');
      return false;
    }

    setIsLoading(true);
    try {
      // First unsubscribe (clears old subscription)
      await unsubscribeFromPushNotifications(user.id);
      
      // Then create a new subscription
      const success = await subscribeToPushNotifications(user.id);
      if (success) {
        setIsSubscribed(true);
        setPermission('granted');
        setNeedsResubscribe(false);
        console.log('[usePushNotifications] Re-subscription successful');
      }
      return success;
    } catch (error) {
      console.error('[usePushNotifications] Resubscribe failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Refresh subscription status
  const refresh = useCallback(async () => {
    await checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    needsResubscribe,
    subscribe,
    unsubscribe,
    resubscribe,
    refresh
  };
}
