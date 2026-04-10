import { useCallback, useMemo } from 'react';
import { supabase, Reminder } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseISO, startOfDay, addDays } from 'date-fns';

// Helper to extract just the date part (YYYY-MM-DD) from a timestamp or date string
function extractDateOnly(dateStr: string | null): string | null {
  if (!dateStr) return null;
  // Handle both timestamp (contains T) and date-only formats
  return dateStr.split('T')[0];
}

// Helper to parse a date string safely without timezone shift
function parseDateSafe(dateStr: string): Date {
  // If it's just a date (YYYY-MM-DD), add T00:00:00 to prevent UTC conversion
  if (dateStr.length === 10) {
    return new Date(`${dateStr}T00:00:00`);
  }
  // If it's a full timestamp, parse it normally
  return parseISO(dateStr);
}

export const useReminders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use React Query for automatic cache sync
  const { data: reminders = [], isLoading, refetch } = useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: async (): Promise<Reminder[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // NOTE: Realtime subscription for reminders is centralized in useRealtimeNotificationEffects
  // to avoid duplicate channels when useReminders is called from multiple components.
  // The central hook invalidates the ['reminders'] query key, which triggers a refetch here.

  const addReminderMutation = useMutation({
    mutationFn: async (reminder: Omit<Reminder, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated');
      
      // Compute due_at as the single source of truth for scheduling
      let dueAt: string | null = null;
      let reminderTime: string | null = null;
      
      if (reminder.due_date) {
        if (reminder.reminder_time) {
          // Combine due_date with reminder_time (expected as HH:mm)
          reminderTime = `${reminder.due_date}T${reminder.reminder_time}:00`;
          dueAt = new Date(reminderTime).toISOString();
        } else {
          // Default to end of day (23:59)
          dueAt = new Date(`${reminder.due_date}T23:59:00`).toISOString();
        }
      }
      
      const { data, error } = await supabase
        .from('reminders')
        .insert({
          title: reminder.title,
          description: reminder.description,
          due_date: reminder.due_date,
          reminder_time: reminderTime,
          due_at: dueAt,
          priority: reminder.priority,
          ticker: reminder.ticker,
          is_completed: reminder.is_completed || false,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      toast.success('Reminder added!');
    },
    onError: (error) => {
      console.error('Error adding reminder:', error);
      toast.error('Failed to add reminder');
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Reminder> }) => {
      const processedUpdates: Record<string, unknown> = { ...updates };
      const existingReminder = reminders.find(r => r.id === id);
      
      // Determine the date to use
      const dateStr = updates.due_date 
        ? extractDateOnly(updates.due_date) 
        : extractDateOnly(existingReminder?.due_date || null);
      
      // Handle reminder_time conversion
      if (updates.reminder_time && updates.reminder_time.length === 5) {
        if (dateStr) {
          processedUpdates.reminder_time = `${dateStr}T${updates.reminder_time}:00`;
          processedUpdates.due_at = new Date(`${dateStr}T${updates.reminder_time}:00`).toISOString();
        }
      } else if (updates.reminder_time) {
        // Full timestamp provided
        processedUpdates.due_at = new Date(updates.reminder_time).toISOString();
      } else if (dateStr && !existingReminder?.reminder_time) {
        // Date update without specific time - use end of day
        processedUpdates.due_at = new Date(`${dateStr}T23:59:00`).toISOString();
      }
      
      const { data, error } = await supabase
        .from('reminders')
        .update(processedUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    },
    onError: (error) => {
      console.error('Error updating reminder:', error);
      toast.error('Failed to update reminder');
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      toast.success('Reminder deleted');
    },
    onError: (error) => {
      console.error('Error deleting reminder:', error);
      toast.error('Failed to delete reminder');
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: isCompleted })
        .eq('id', id);

      if (error) throw error;

      // When marking complete, auto-delete any related notifications
      if (isCompleted) {
        await supabase
          .from('notifications')
          .delete()
          .eq('type', 'reminder')
          .filter('data->>reminderId', 'eq', id);
      }
    },
    onMutate: async ({ id, isCompleted }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['reminders', user?.id] });
      
      // Snapshot previous value
      const previous = queryClient.getQueryData<Reminder[]>(['reminders', user?.id]);
      
      // Optimistically update
      queryClient.setQueryData<Reminder[]>(['reminders', user?.id], (old) =>
        old?.map(r => r.id === id ? { ...r, is_completed: isCompleted } : r) || []
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['reminders', user?.id], context.previous);
      }
      toast.error('Failed to update reminder');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    },
  });

  const dismissReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      // Also delete any associated notification record
      await supabase
        .from('notifications')
        .delete()
        .eq('type', 'reminder')
        .filter('data->>reminderId', 'eq', id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['reminders', user?.id] });
      const previous = queryClient.getQueryData<Reminder[]>(['reminders', user?.id]);
      
      queryClient.setQueryData<Reminder[]>(['reminders', user?.id], (old) =>
        old?.map(r => r.id === id ? { ...r, dismissed_at: new Date().toISOString() } : r) || []
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['reminders', user?.id], context.previous);
      }
      toast.error('Failed to dismiss reminder');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Wrapper functions for backwards compatibility
  const addReminder = useCallback(async (reminder: Omit<Reminder, 'id' | 'user_id' | 'created_at'>) => {
    try {
      const data = await addReminderMutation.mutateAsync(reminder);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [addReminderMutation]);

  const updateReminder = useCallback(async (id: string, updates: Partial<Reminder>) => {
    try {
      const data = await updateReminderMutation.mutateAsync({ id, updates });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [updateReminderMutation]);

  const deleteReminder = useCallback(async (id: string) => {
    try {
      await deleteReminderMutation.mutateAsync(id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }, [deleteReminderMutation]);

  const toggleComplete = useCallback(async (id: string, isCompleted: boolean) => {
    try {
      await toggleCompleteMutation.mutateAsync({ id, isCompleted });
      return { error: null };
    } catch (error) {
      return { error };
    }
  }, [toggleCompleteMutation]);

  const dismissReminder = useCallback(async (id: string) => {
    try {
      await dismissReminderMutation.mutateAsync(id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }, [dismissReminderMutation]);

  // Group reminders using proper date comparison
  const groupedReminders = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);
    const weekEnd = addDays(today, 7);

    return {
      // Only reminders whose due_at time has passed AND not dismissed (for badge/notification counts)
      triggered: reminders.filter(r => {
        if (r.is_completed) return false;
        if (r.dismissed_at) return false; // Exclude dismissed reminders
        if (!r.due_at) return false;
        return new Date(r.due_at) <= now;
      }),
      overdue: reminders.filter(r => {
        if (r.is_completed) return false;
        const dateStr = extractDateOnly(r.due_date);
        if (!dateStr) return false;
        const date = parseDateSafe(dateStr);
        return date < today;
      }),
      today: reminders.filter(r => {
        if (r.is_completed) return false;
        const dateStr = extractDateOnly(r.due_date);
        if (!dateStr) return false;
        const date = parseDateSafe(dateStr);
        return date >= today && date < tomorrow;
      }),
      tomorrow: reminders.filter(r => {
        if (r.is_completed) return false;
        const dateStr = extractDateOnly(r.due_date);
        if (!dateStr) return false;
        const date = parseDateSafe(dateStr);
        return date >= tomorrow && date < dayAfterTomorrow;
      }),
      thisWeek: reminders.filter(r => {
        if (r.is_completed) return false;
        const dateStr = extractDateOnly(r.due_date);
        if (!dateStr) return false;
        const date = parseDateSafe(dateStr);
        return date >= dayAfterTomorrow && date < weekEnd;
      }),
      later: reminders.filter(r => {
        if (r.is_completed) return false;
        const dateStr = extractDateOnly(r.due_date);
        if (!dateStr) return false;
        const date = parseDateSafe(dateStr);
        return date >= weekEnd;
      }),
      completed: reminders.filter(r => r.is_completed),
    };
  }, [reminders]);

  return {
    reminders,
    groupedReminders,
    isLoading,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleComplete,
    dismissReminder,
    refetch,
  };
};
