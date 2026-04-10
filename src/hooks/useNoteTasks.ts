import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NoteTask {
  id: string;
  user_id: string;
  note_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  reminder_time?: string | null;
  due_at?: string | null;
  notified_at?: string | null;
  priority: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AddTaskParams {
  title: string;
  description?: string;
  due_date?: string | null;
  reminder_time?: string | null;
  priority?: string;
}

export const useNoteTasks = (noteId: string | null) => {
  const [tasks, setTasks] = useState<NoteTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchTasks = useCallback(async () => {
    if (!noteId || !user) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('note_id', noteId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks((data as NoteTask[]) || []);
    } catch (error) {
      console.error('Error fetching note tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [noteId, user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (params: AddTaskParams) => {
    if (!noteId || !user) {
      toast.error('Cannot add task');
      return null;
    }

    try {
      // Compute due_at: if reminder_time is provided use it, otherwise end of day
      let dueAt: string | null = null;
      if (params.due_date) {
        if (params.reminder_time) {
          // reminder_time is expected as HH:mm
          dueAt = new Date(`${params.due_date}T${params.reminder_time}:00`).toISOString();
        } else {
          // Default to end of day
          dueAt = new Date(`${params.due_date}T23:59:00`).toISOString();
        }
      }

      const newTask = {
        user_id: user.id,
        note_id: noteId,
        title: params.title,
        description: params.description || null,
        due_date: params.due_date || null,
        reminder_time: dueAt, // Store as UTC timestamp (same as due_at)
        due_at: dueAt,
        priority: params.priority || 'medium',
        is_completed: false,
      };

      const { data, error } = await supabase
        .from('reminders')
        .insert(newTask)
        .select()
        .single();

      if (error) throw error;

      setTasks(prev => [...prev, data as NoteTask]);
      toast.success('Task added');
      return data;
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
      return null;
    }
  };

  const toggleComplete = async (id: string, isCompleted: boolean) => {
    // Optimistic update
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, is_completed: !isCompleted } : task
      )
    );

    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: !isCompleted })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling task:', error);
      // Rollback
      setTasks(prev =>
        prev.map(task =>
          task.id === id ? { ...task, is_completed: isCompleted } : task
        )
      );
      toast.error('Failed to update task');
    }
  };

  const deleteTask = async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    
    // Optimistic delete
    setTasks(prev => prev.filter(task => task.id !== id));

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Task deleted');
    } catch (error) {
      console.error('Error deleting task:', error);
      // Rollback
      if (taskToDelete) {
        setTasks(prev => [...prev, taskToDelete]);
      }
      toast.error('Failed to delete task');
    }
  };

  return {
    tasks,
    isLoading,
    addTask,
    toggleComplete,
    deleteTask,
    refetch: fetchTasks,
  };
};
