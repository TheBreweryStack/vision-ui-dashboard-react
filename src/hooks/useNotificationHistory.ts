import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface Notification {
  id: string;
  user_id: string;
  type: 'reminder' | 'price_alert' | 'trade_inbox' | 'announcement';
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Hook for fetching and managing notification history.
 * 
 * NOTE: Realtime subscriptions, sound playback, and toast notifications are handled
 * centrally by useRealtimeNotificationEffects in MainLayout. This hook only
 * manages data fetching and CRUD operations to avoid duplicate effects.
 */
export function useNotificationHistory(type?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id, type],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to UPDATE and DELETE events for badge sync
  // INSERT events are handled by useRealtimeNotificationEffects to avoid duplicate sounds/toasts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Sync unread count with PWA app badge
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(unreadCount).catch(() => {});
      } else {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {});
      }
    }
  }, [unreadCount]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      // Fetch the notification first so we can restore it
      const { data: notification, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      if (error) throw error;
      
      return notification as Notification;
    },
    onSuccess: (deletedNotification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Show undo toast
      if (deletedNotification) {
        toast('Notification dismissed', {
          description: deletedNotification.title,
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: async () => {
              // Re-insert the notification
              const { error } = await supabase
                .from('notifications')
                .insert([{
                  id: deletedNotification.id,
                  user_id: deletedNotification.user_id,
                  type: deletedNotification.type,
                  title: deletedNotification.title,
                  body: deletedNotification.body,
                  data: deletedNotification.data as Json,
                  is_read: deletedNotification.is_read,
                  created_at: deletedNotification.created_at,
                }]);
              
              if (!error) {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
                toast.success('Notification restored');
              }
            },
          },
        });
      }
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate,
    clearAll: clearAll.mutate,
  };
}
