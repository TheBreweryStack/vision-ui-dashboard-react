import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Clock } from 'lucide-react';
import React from 'react';
import { useNotificationPreferences } from './useNotificationPreferences';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Local-only notification system that polls for due reminders
 * and triggers browser-native notifications when the app is open.
 * 
 * This replaces the complex push notification system (VAPID/FCM/APNs)
 * with a simpler approach that works when the app is open in any tab.
 */
export function useLocalAlerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { preferences } = useNotificationPreferences();
  const preferencesRef = useRef(preferences);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInitializedRef = useRef(false);
  const notificationPermissionRef = useRef<NotificationPermission>('default');
  
  // Keep preferences ref updated
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  // Initialize AudioContext on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioInitializedRef.current) {
        const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
        audioInitializedRef.current = true;
      }
    };

    document.addEventListener('pointerdown', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });

    return () => {
      document.removeEventListener('pointerdown', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  // Check browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      notificationPermissionRef.current = Notification.permission;
    }
  }, []);

  // Play a short beep sound
  const playBeep = useCallback(() => {
    if (!audioContextRef.current) return;
    
    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.error('[LocalAlerts] Error playing sound:', error);
    }
  }, []);

  // Trigger vibration if supported
  const vibrate = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, []);

  // Show browser notification via Service Worker for better lock screen support
  const showBrowserNotification = useCallback(async (title: string, body: string, url?: string) => {
    if (notificationPermissionRef.current !== 'granted') return;
    
    // Check if service worker is available
    if (!('serviceWorker' in navigator)) {
      console.log('[LocalAlerts] Service Worker not supported, skipping browser notification');
      return;
    }
    
    try {
      // Use Service Worker's showNotification for better lock screen support
      const registration = await navigator.serviceWorker.ready;
      
      // Send message to SW to show notification
      registration.active?.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        url,
        tag: 'reminder-alert'
      });
      
      console.log('[LocalAlerts] Sent notification via Service Worker');
    } catch (error) {
      console.error('[LocalAlerts] SW notification error, falling back:', error);
      
      // Fallback to direct notification if SW fails
      try {
        new Notification(title, {
          body,
          icon: '/app-icon.png',
          tag: 'reminder-alert'
        });
      } catch (e) {
        console.error('[LocalAlerts] Fallback notification also failed:', e);
      }
    }
  }, []);

  // Main alert function
  const triggerAlert = useCallback((title: string, body: string, url?: string) => {
    const prefs = preferencesRef.current;
    
    if (prefs.mute_all_notifications) return;

    // Play sound and vibrate
    playBeep();
    vibrate();

    // Show in-app toast
    if (prefs.show_toast_banners) {
      toast(title, {
        description: body,
        icon: React.createElement(Clock, { className: 'h-4 w-4 text-primary' }),
        duration: 8000,
        position: 'bottom-right',
        action: url ? {
          label: 'View',
          onClick: () => {
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
      });
    }

    // Show browser notification if tab is hidden
    showBrowserNotification(title, body, url);
  }, [playBeep, vibrate, showBrowserNotification]);

  // Poll for due reminders
  useEffect(() => {
    if (!user?.id) return;

    const checkDueReminders = async () => {
      const prefs = preferencesRef.current;
      if (prefs.mute_all_notifications || !prefs.reminder_alerts) return;

      try {
        const now = new Date().toISOString();
        
        // Find reminders that are due and haven't been notified locally yet
        const { data: dueReminders, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_completed', false)
          .is('notified_at', null)
          .or(`due_at.lte.${now},and(due_at.is.null,reminder_time.lte.${now})`);

        if (error) {
          console.error('[LocalAlerts] Error fetching due reminders:', error);
          return;
        }

        if (!dueReminders?.length) return;

        console.log(`[LocalAlerts] Found ${dueReminders.length} due reminders`);

        // Process each due reminder
        for (const reminder of dueReminders) {
          const url = reminder.note_id 
            ? `/playbook?note=${reminder.note_id}` 
            : '/playbook';
          
          triggerAlert(
            'Reminder Due',
            reminder.title,
            url
          );

          // Mark as notified in database (to prevent duplicate alerts)
          await supabase
            .from('reminders')
            .update({ notified_at: now })
            .eq('id', reminder.id);
        }

        // Invalidate queries to update badges
        queryClient.invalidateQueries({ queryKey: ['reminders', user.id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      } catch (error) {
        console.error('[LocalAlerts] Error in checkDueReminders:', error);
      }
    };

    // Check immediately on mount
    checkDueReminders();

    // Poll every 30 seconds
    const intervalId = setInterval(checkDueReminders, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user?.id, queryClient, triggerAlert]);

  // Request browser notification permission (called from UI)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('[LocalAlerts] Browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      notificationPermissionRef.current = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('[LocalAlerts] Error requesting permission:', error);
      return false;
    }
  }, []);

  return {
    requestPermission,
    isSupported: 'Notification' in window,
    permissionStatus: notificationPermissionRef.current,
  };
}

/**
 * Check if browser notification permission is already granted.
 * Useful for showing/hiding UI prompts.
 */
export function checkBrowserNotificationPermission(): NotificationPermission | null {
  if (!('Notification' in window)) return null;
  return Notification.permission;
}
