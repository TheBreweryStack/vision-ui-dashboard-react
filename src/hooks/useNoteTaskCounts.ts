import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TaskCounts {
  [noteId: string]: {
    total: number;
    incomplete: number;
  };
}

export const useNoteTaskCounts = (noteIds: string[]) => {
  const [taskCounts, setTaskCounts] = useState<TaskCounts>({});
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchTaskCounts = useCallback(async () => {
    if (!user || noteIds.length === 0) {
      setTaskCounts({});
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch all reminders linked to these notes
      const { data, error } = await supabase
        .from('reminders')
        .select('note_id, is_completed')
        .in('note_id', noteIds);

      if (error) throw error;

      // Aggregate counts by note_id
      const counts: TaskCounts = {};
      noteIds.forEach(id => {
        counts[id] = { total: 0, incomplete: 0 };
      });

      (data || []).forEach(reminder => {
        if (reminder.note_id) {
          if (!counts[reminder.note_id]) {
            counts[reminder.note_id] = { total: 0, incomplete: 0 };
          }
          counts[reminder.note_id].total += 1;
          if (!reminder.is_completed) {
            counts[reminder.note_id].incomplete += 1;
          }
        }
      });

      setTaskCounts(counts);
    } catch (error) {
      console.error('Error fetching task counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [noteIds.join(','), user]);

  useEffect(() => {
    fetchTaskCounts();
  }, [fetchTaskCounts]);

  return { taskCounts, isLoading, refetch: fetchTaskCounts };
};
