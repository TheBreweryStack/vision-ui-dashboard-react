import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  registerServiceWorker, 
  subscribeToPushNotifications,
  getNotificationPermission,
  getOrCreateDeviceId
} from '@/lib/pushNotifications';
import type { DeviceMetadata } from '@/lib/deviceMetadata';
import { getDeviceIcon, generateDeviceLabel, getDeviceTypeLabel } from '@/lib/deviceMetadata';
import { logger } from '@/lib/logger';

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  vapid_key_hash: string | null;
  last_successful_push_at: string | null;
  device_label: string | null;
  device_id: string | null;
  device_metadata: DeviceMetadata | null;
}

interface DeviceInfo {
  icon: string;
  label: string;
  platform: string;
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  timezone?: string;
}

export function getDeviceType(endpoint: string, metadata?: DeviceMetadata | null): DeviceInfo {
  // If we have rich metadata, use it
  if (metadata) {
    return {
      icon: getDeviceIcon(metadata),
      label: generateDeviceLabel(metadata),
      platform: metadata.os.toLowerCase(),
      os: metadata.os,
      osVersion: metadata.osVersion,
      browser: metadata.browser,
      browserVersion: metadata.browserVersion,
      deviceType: metadata.deviceType,
      timezone: metadata.timezone,
    };
  }

  // Fallback to endpoint-based detection
  if (endpoint.includes('web.push.apple.com')) {
    return { icon: '🍎', label: 'Safari', platform: 'apple' };
  }
  if (endpoint.includes('fcm.googleapis.com')) {
    return { icon: '📱', label: 'Chrome/FCM', platform: 'fcm' };
  }
  if (endpoint.includes('mozilla.com')) {
    return { icon: '🦊', label: 'Firefox', platform: 'mozilla' };
  }
  if (endpoint.includes('notify.windows.com')) {
    return { icon: '🪟', label: 'Edge', platform: 'windows' };
  }
  return { icon: '🌐', label: 'Unknown', platform: 'unknown' };
}

export { getDeviceTypeLabel };

export function checkIOSRequirements(): {
  isIOS: boolean;
  meetsVersion: boolean;
  isHomeScreen: boolean;
  hasPermission: boolean;
  versionNumber: number | null;
} {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const versionMatch = navigator.userAgent.match(/OS (\d+)_/);
  const versionNumber = versionMatch ? parseFloat(versionMatch[1]) : null;
  const meetsVersion = versionNumber !== null && versionNumber >= 16.4;
  const isHomeScreen = window.matchMedia('(display-mode: standalone)').matches;
  const hasPermission = typeof Notification !== 'undefined' && Notification.permission === 'granted';

  return {
    isIOS,
    meetsVersion,
    isHomeScreen,
    hasPermission,
    versionNumber,
  };
}

export async function getCurrentDeviceEndpoint(): Promise<string | null> {
  try {
    if (!('serviceWorker' in navigator)) return null;
    
    // Retry logic for cold start situations where SW may still be activating
    const maxRetries = 5;  // Increased from 3 to 5
    const retryDelay = 800; // Increased from 500ms to 800ms
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Wait for SW to be ready
      const registration = await navigator.serviceWorker.ready;
      
      // Check if SW is actually controlling the page (not just ready)
      if (!navigator.serviceWorker.controller && attempt < maxRetries - 1) {
        logger.log('[usePushSubscriptions] SW ready but not controlling, waiting...');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription?.endpoint) {
        logger.log('[usePushSubscriptions] Found endpoint on attempt', attempt + 1);
        return subscription.endpoint;
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries - 1) {
        logger.log('[usePushSubscriptions] No subscription found, retrying in', retryDelay, 'ms...');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    logger.log('[usePushSubscriptions] No subscription after', maxRetries, 'retries');
    return null;
  } catch (error) {
    logger.error('[usePushSubscriptions] Error getting current endpoint:', error);
    return null;
  }
}

export function usePushSubscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEndpointLoading, setIsEndpointLoading] = useState(true);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [isTestingDevice, setIsTestingDevice] = useState<string | null>(null);
  const [isRemovingDevice, setIsRemovingDevice] = useState<string | null>(null);
  
  // Track if we've already attempted recovery this session to prevent duplicates
  const hasAttemptedRecoveryRef = useRef(false);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) {
      setSubscriptions([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions((data as unknown as PushSubscription[]) || []);
    } catch (error) {
      logger.error('[usePushSubscriptions] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchCurrentEndpoint = useCallback(async () => {
    setIsEndpointLoading(true);
    try {
      // Ensure SW is registered and active before checking subscription
      logger.log('[usePushSubscriptions] Ensuring SW is registered...');
      await registerServiceWorker();
      
      logger.log('[usePushSubscriptions] Checking current endpoint...');
      const endpoint = await getCurrentDeviceEndpoint();
      logger.log('[usePushSubscriptions] Current endpoint:', endpoint ? endpoint.slice(0, 50) + '...' : 'null');
      
      // SILENT RECOVERY: If permission granted but no subscription, auto-resubscribe
      // But ONLY if we haven't already attempted recovery this session
      if (!endpoint && user && !hasAttemptedRecoveryRef.current) {
        const permission = getNotificationPermission();
        logger.log('[usePushSubscriptions] Current permission:', permission);
        
        if (permission === 'granted') {
          // Mark that we're attempting recovery BEFORE doing anything
          hasAttemptedRecoveryRef.current = true;
          
          // Check if we already have a subscription in DB for this device
          const deviceId = getOrCreateDeviceId();
          logger.log('[usePushSubscriptions] Checking DB for device:', deviceId.slice(0, 8) + '...');
          
          const { data: existingRow } = await supabase
            .from('push_subscriptions')
            .select('id, endpoint')
            .eq('user_id', user.id)
            .eq('device_id', deviceId)
            .maybeSingle();
          
          if (existingRow) {
            // Device already has a subscription in DB - skip recovery
            logger.log('[usePushSubscriptions] DB has subscription for this device, skipping recovery');
            // Use the endpoint from DB as current (even if browser lost it temporarily)
            setCurrentEndpoint(existingRow.endpoint);
            setIsEndpointLoading(false);
            return;
          }
          
          // No subscription in DB for this device - proceed with recovery
          logger.log('[usePushSubscriptions] No existing subscription for device, attempting recovery...');
          const recovered = await subscribeToPushNotifications(user.id);
          
          if (recovered) {
            logger.log('[usePushSubscriptions] Silent recovery successful!');
            // Get the new endpoint
            const newEndpoint = await getCurrentDeviceEndpoint();
            setCurrentEndpoint(newEndpoint);
            // Refresh the subscription list from DB
            await fetchSubscriptions();
            return; // Exit early, state is already set
          } else {
            logger.log('[usePushSubscriptions] Silent recovery failed - user may need to manually enable');
          }
        }
      }
      
      setCurrentEndpoint(endpoint);
    } catch (error) {
      logger.error('[usePushSubscriptions] Error fetching endpoint:', error);
    } finally {
      setIsEndpointLoading(false);
    }
  }, [user, fetchSubscriptions]);

  useEffect(() => {
    fetchSubscriptions();
    fetchCurrentEndpoint();
  }, [fetchSubscriptions, fetchCurrentEndpoint]);

  // Debug logging when subscriptions or endpoint change
  useEffect(() => {
    if (!isLoading && !isEndpointLoading) {
      logger.log('[usePushSubscriptions] DB subscriptions:', subscriptions.map(s => s.endpoint.slice(0, 50)));
      logger.log('[usePushSubscriptions] Match found:', subscriptions.some(sub => sub.endpoint === currentEndpoint));
    }
  }, [subscriptions, currentEndpoint, isLoading, isEndpointLoading]);

  const removeSubscription = useCallback(async (subscriptionId: string): Promise<boolean> => {
    if (!user) return false;

    setIsRemovingDevice(subscriptionId);
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscriptionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSubscriptions(prev => prev.filter(s => s.id !== subscriptionId));
      return true;
    } catch (error) {
      logger.error('[usePushSubscriptions] Remove error:', error);
      return false;
    } finally {
      setIsRemovingDevice(null);
    }
  }, [user]);

  const testSubscription = useCallback(async (endpoint: string): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: 'Not authenticated' };

    setIsTestingDevice(endpoint);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-push', {
        body: { userId: user.id, endpoint },
      });

      if (error) throw error;

      // If stale subscriptions were cleaned up, refresh the list
      if (data?.staleDeleted) {
        logger.log('[usePushSubscriptions] Stale entries deleted, refreshing list...');
        await fetchSubscriptions();
      }

      return {
        success: data?.success ?? false,
        message: data?.message ?? 'Unknown result',
      };
    } catch (error) {
      logger.error('[usePushSubscriptions] Test error:', error);
      return { success: false, message: 'Failed to send test notification' };
    } finally {
      setIsTestingDevice(null);
    }
  }, [user, fetchSubscriptions]);

  const isCurrentDevice = useCallback((endpoint: string): boolean => {
    return currentEndpoint === endpoint;
  }, [currentEndpoint]);

  const updateDeviceLabel = useCallback(async (subscriptionId: string, label: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ device_label: label })
        .eq('id', subscriptionId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setSubscriptions(prev => 
        prev.map(s => s.id === subscriptionId ? { ...s, device_label: label } : s)
      );
      return true;
    } catch (error) {
      logger.error('[usePushSubscriptions] Update label error:', error);
      return false;
    }
  }, [user]);

  return {
    subscriptions,
    isLoading,
    isEndpointLoading,
    currentEndpoint,
    isTestingDevice,
    isRemovingDevice,
    fetchSubscriptions,
    removeSubscription,
    testSubscription,
    isCurrentDevice,
    updateDeviceLabel,
  };
}
