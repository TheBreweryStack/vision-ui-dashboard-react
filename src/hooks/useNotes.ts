import { useState, useEffect, useCallback } from 'react';
import { supabase, Note } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useNotes = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async (note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          ...note,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setNotes(prev => [data, ...prev]);
      toast.success('Note created!');
      return { data, error: null };
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to create note');
      return { data: null, error };
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      setNotes(prev => prev.map(n => n.id === id ? data : n));
      return { data, error: null };
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
      return { data: null, error };
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setNotes(prev => prev.filter(n => n.id !== id));
      toast.success('Note deleted');
      return { error: null };
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
      return { error };
    }
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    const result = await updateNote(id, { is_pinned: isPinned });
    if (!result.error) {
      toast.success(isPinned ? 'Note pinned!' : 'Note unpinned');
    }
    return result;
  };

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter(n => n.is_pinned);
  const unpinnedNotes = notes.filter(n => !n.is_pinned);

  return {
    notes,
    pinnedNotes,
    unpinnedNotes,
    isLoading,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    refetch: fetchNotes,
  };
};
