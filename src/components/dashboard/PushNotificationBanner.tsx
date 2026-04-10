import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Bell, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { checkBrowserNotificationPermission } from '@/hooks/useLocalAlerts';
import { logger } from '@/lib/logger';

// Session-level flag to prevent banner showing after dismissal in same session
declare global {
  interface Window {
    __notificationPromptDismissedThisSession?: boolean;
  }
}

/**
 * Banner to request browser notification permission AND subscribe to push.
 * Unified flow: one click enables both browser permission and push registration.
 */
export const PushNotificationBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
  const { profile } = useAuth();
  const { subscribe, isLoading: isSubscribing } = usePushNotifications();
  
  // Check permission on mount
  useEffect(() => {
    setPermissionStatus(checkBrowserNotificationPermission());
  }, []);

  // Check if user already saw the first-time prompt
  const promptAlreadyShown = profile?.notification_prompt_shown === true;
  const dismissedThisSession = window.__notificationPromptDismissedThisSession === true;
  
  // Don't show if:
  // - Dismissed this session
  // - Not supported
  // - Already granted permission
  // - User already saw and responded to the first-time prompt
  // - Dismissed the first-time dialog in this session
  if (
    isDismissed || 
    permissionStatus === null || // Not supported
    permissionStatus === 'granted' ||
    permissionStatus === 'denied' ||
    promptAlreadyShown ||
    dismissedThisSession
  ) {
    return null;
  }
  
  const handleEnable = async () => {
    try {
      // Use unified subscribe which handles permission + push registration
      const success = await subscribe();
      
      if (success) {
        setPermissionStatus('granted');
        toast.success('Push notifications enabled on this device!');
      } else {
        // Check if permission was denied
        const newPermission = checkBrowserNotificationPermission();
        setPermissionStatus(newPermission);
        if (newPermission === 'denied') {
          toast.error('Notifications blocked. You can change this in your browser settings.');
        }
      }
    } catch (error) {
      logger.error('[PushNotificationBanner] Error enabling:', error);
      toast.error('Failed to enable notifications');
    }
  };
  
  return (
    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm">Enable Push Notifications</p>
          <p className="text-xs text-muted-foreground truncate">Get alerts for reminders and price changes</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button 
          size="sm" 
          onClick={handleEnable}
          disabled={isSubscribing}
        >
          {isSubscribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Enable'
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

