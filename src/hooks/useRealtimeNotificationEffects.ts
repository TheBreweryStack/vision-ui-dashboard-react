import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Inbox } from 'lucide-react';
import React from 'react';
import { useNotificationPreferences } from './useNotificationPreferences';

/**
 * Hook that subscribes to Supabase Realtime for new notifications and trade inbox items.
 * Plays a beep sound, triggers vibration, and shows in-app toast when new items arrive.
 * Respects user notification preferences for toast banners.
 */
export function useRealtimeNotificationEffects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { preferences } = useNotificationPreferences();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInitializedRef = useRef(false);
  
  // Use ref to avoid stale closure issues in realtime callbacks
  const preferencesRef = useRef(preferences);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  // Initialize AudioContext on first user interaction (required by browsers)
  useEffect(() => {
    const initAudio = () => {
      if (!audioInitializedRef.current) {
        const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
        audioInitializedRef.current = true;
      }
    };

    // Listen for first user interaction to initialize audio
    document.addEventListener('pointerdown', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });

    return () => {
      document.removeEventListener('pointerdown', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
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
      console.error('Error playing notification sound:', error);
    }
  }, []);

  // Trigger vibration if supported
  const vibrate = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, []);

  // Notify user of new item (sound + vibration) - respects mute preference
  const notifyUser = useCallback(() => {
    if (preferencesRef.current.mute_all_notifications) {
      return;
    }
    playBeep();
    vibrate();
  }, [playBeep, vibrate]);

  // Show toast for notification - respects preferences
  const showNotificationToast = useCallback((title: string, body?: string | null) => {
    // Respect user preferences
    if (preferencesRef.current.mute_all_notifications || !preferencesRef.current.show_toast_banners) {
      return;
    }
    
    toast(title, {
      description: body || undefined,
      icon: React.createElement(Bell, { className: 'h-4 w-4 text-primary' }),
      duration: 5000,
      position: 'bottom-right',
    });
  }, []);

  // Show toast for trade inbox item - ALWAYS shows (unless mute_all is on)
  const showTradeInboxToast = useCallback((ticker?: string) => {
    // Trade inbox: only mute_all stops it (always visible otherwise)
    if (preferencesRef.current.mute_all_notifications) {
      return;
    }
    
    toast('New Trade', {
      description: ticker ? `${ticker} trade ready for review` : 'A new trade is ready for review',
      icon: React.createElement(Inbox, { className: 'h-4 w-4 text-primary' }),
      duration: 5000,
      position: 'bottom-right',
      action: {
        label: 'View',
        onClick: () => window.location.href = '/trade-inbox',
      },
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to notifications table for this user (INSERT only)
    const notificationsChannel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New notification received:', payload);
          notifyUser();
          
          // Show in-app toast
          const notification = payload.new as { title?: string; body?: string };
          showNotificationToast(
            notification.title || 'New Notification',
            notification.body
          );
          
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    // Subscribe to trade_inbox table for this user
    const tradeInboxChannel = supabase
      .channel(`trade_inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_inbox',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New trade inbox item received:', payload);
          notifyUser();
          
          // Show in-app toast with ticker if available (always shows for trade inbox)
          const tradeItem = payload.new as { parsed_trade?: { ticker?: string } };
          showTradeInboxToast(tradeItem.parsed_trade?.ticker);
          
          queryClient.invalidateQueries({ queryKey: ['trade-inbox', user.id] });
        }
      )
      .subscribe();

    // Subscribe to reminders table for this user (centralized subscription)
    // This prevents duplicate channels when useReminders is called from multiple components
    const remindersChannel = supabase
      .channel(`reminders:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate all relevant queries for instant badge sync
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
          queryClient.invalidateQueries({ queryKey: ['reminders', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(tradeInboxChannel);
      supabase.removeChannel(remindersChannel);
    };
  }, [user?.id, queryClient, notifyUser, showNotificationToast, showTradeInboxToast]);
}
