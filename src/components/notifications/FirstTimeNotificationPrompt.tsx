import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { checkBrowserNotificationPermission } from '@/hooks/useLocalAlerts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, BellRing, Clock } from 'lucide-react';
import { toast } from 'sonner';

// Session-level flag to coordinate with PushNotificationBanner
declare global {
  interface Window {
    __notificationPromptDismissedThisSession?: boolean;
  }
}

/**
 * First-time prompt for push notification subscription.
 * Unified flow: one click enables both browser permission AND push registration.
 */
export const FirstTimeNotificationPrompt: React.FC = () => {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const { subscribe, isLoading: isEnabling } = usePushNotifications();

  // Check if we should show the prompt
  useEffect(() => {
    if (!user || !profile) return;
    
    // Check browser support
    const permission = checkBrowserNotificationPermission();
    if (permission === null || permission === 'granted' || permission === 'denied') {
      return;
    }
    
    // Check if prompt has already been shown
    const promptShown = (profile as { notification_prompt_shown?: boolean }).notification_prompt_shown;
    if (promptShown) return;

    // Delay showing prompt by 2 seconds for smoother UX
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, profile]);

  const markPromptShown = async () => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ notification_prompt_shown: true })
        .eq('id', user.id);
    } catch (error) {
      console.error('[FirstTimeNotificationPrompt] Error updating profile:', error);
    }
  };

  const handleEnable = async () => {
    try {
      // Use unified subscribe which handles permission + push registration
      const success = await subscribe();
      
      if (success) {
        toast.success('Push notifications enabled on this device!');
      } else {
        // Check if permission was denied
        const newPermission = checkBrowserNotificationPermission();
        if (newPermission === 'denied') {
          toast.error('Notifications blocked. You can change this in your browser settings.');
        }
      }
    } catch (error) {
      console.error('[FirstTimeNotificationPrompt] Error:', error);
      toast.error('Failed to enable notifications');
    } finally {
      await markPromptShown();
      setIsOpen(false);
    }
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    window.__notificationPromptDismissedThisSession = true;
    await markPromptShown();
    setIsOpen(false);
    setIsDismissing(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <BellRing className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Stay in the Loop</DialogTitle>
          <DialogDescription className="text-center">
            Get push notifications for reminders and price alerts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-8 w-8 rounded-full bg-profit/10 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-profit" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">Price Alerts</p>
              <p className="text-muted-foreground">Know when your targets are hit</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">Task Reminders</p>
              <p className="text-muted-foreground">Never forget a trading task</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleEnable} 
            disabled={isEnabling}
            className="w-full"
          >
            {isEnabling ? 'Enabling...' : 'Enable Push Notifications'}
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleDismiss}
            disabled={isDismissing}
            className="w-full text-muted-foreground"
          >
            Maybe Later
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-2">
          You'll receive alerts even when the app is in the background
        </p>
      </DialogContent>
    </Dialog>
  );
};

