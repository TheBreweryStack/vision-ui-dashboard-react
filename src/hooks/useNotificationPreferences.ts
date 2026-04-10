import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NotificationPreferences {
  price_alerts: boolean;
  reminder_alerts: boolean;
  trade_updates: boolean;
  weekly_summary: boolean;
  announcement_alerts: boolean;
  show_toast_banners: boolean;
  mute_all_notifications: boolean;
  inbox_alerts: boolean;
  trade_inbox_push_mode: string | null;
  trade_inbox_daily_reminder: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  price_alerts: true,
  reminder_alerts: true,
  trade_updates: true,
  weekly_summary: false,
  announcement_alerts: true,
  show_toast_banners: true,
  mute_all_notifications: false,
  inbox_alerts: true,
  trade_inbox_push_mode: null,
  trade_inbox_daily_reminder: false,
};

/**
 * Centralized hook for notification preferences with React Query caching.
 * Uses a 5-minute stale time since preferences rarely change.
 */
export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async (): Promise<NotificationPreferences> => {
      if (!user) return DEFAULT_PREFERENCES;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          price_alerts: data.price_alerts ?? true,
          reminder_alerts: data.reminder_alerts ?? true,
          trade_updates: data.trade_updates ?? true,
          weekly_summary: data.weekly_summary ?? false,
          announcement_alerts: data.announcement_alerts ?? true,
          show_toast_banners: data.show_toast_banners ?? true,
          mute_all_notifications: data.mute_all_notifications ?? false,
          inbox_alerts: data.inbox_alerts ?? true,
          trade_inbox_push_mode: data.trade_inbox_push_mode ?? null,
          trade_inbox_daily_reminder: data.trade_inbox_daily_reminder ?? false,
        };
      }

      return DEFAULT_PREFERENCES;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - preferences rarely change
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', user?.id] });
      toast.success('Notification preferences saved!');
    },
    onError: (error) => {
      console.error('Error saving notification preferences:', error);
      toast.error('Failed to save preferences');
    },
  });

  return {
    preferences: preferences ?? DEFAULT_PREFERENCES,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    isSaving: updatePreferences.isPending,
  };
}
