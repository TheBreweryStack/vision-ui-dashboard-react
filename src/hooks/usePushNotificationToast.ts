import { useEffect } from 'react';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import React from 'react';
import { logger } from '@/lib/logger';

/**
 * Hook that listens for push messages forwarded from the Service Worker
 * and shows an in-app toast banner.
 * 
 * When a push notification arrives while the app is open in the foreground,
 * the Service Worker forwards the payload to all clients. This hook catches
 * that message and displays a sonner toast in the bottom-right corner.
 */
export function usePushNotificationToast() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handlePushMessage = (event: MessageEvent) => {
      // Only handle PUSH_RECEIVED messages from our Service Worker
      if (event.data?.type !== 'PUSH_RECEIVED') return;
      
      const { title, body, url } = event.data.payload || {};
      
      logger.log('[PushToast] Received push notification:', { title, body, url });
      
      toast(title || 'New Notification', {
        description: body || undefined,
        icon: React.createElement(Bell, { className: 'h-4 w-4 text-primary' }),
        action: url ? {
          label: 'View',
          onClick: () => {
            // Only navigate to relative paths or known-safe origins
            try {
              const parsed = new URL(url, window.location.origin);
              if (parsed.origin === window.location.origin) {
                window.location.href = parsed.href;
              }
            } catch {
              // Invalid URL — ignore
            }
          },
        } : undefined,
        duration: 5000,
        position: 'bottom-right',
      });
    };

    navigator.serviceWorker.addEventListener('message', handlePushMessage);
    logger.log('[PushToast] Listening for push notifications');
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handlePushMessage);
    };
  }, []);
}
