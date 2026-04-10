import { useState, useEffect, useCallback } from 'react';
import { supabase, Watchlist, WatchlistItem } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export const useWatchlists = () => {
  const { user } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);

  const fetchWatchlists = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWatchlists(data || []);
    } catch (error) {
      logger.error('Error fetching watchlists:', error);
      toast.error('Failed to load watchlists');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchItems = useCallback(async (watchlistId: string) => {
    setActiveWatchlistId(watchlistId);
    try {
      const { data, error } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('watchlist_id', watchlistId)
        .order('added_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      logger.error('Error fetching watchlist items:', error);
      toast.error('Failed to load items');
    }
  }, []);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  const createWatchlist = async (name: string, description?: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase
        .from('watchlists')
        .insert({ name, description, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      setWatchlists(prev => [data, ...prev]);
      toast.success('Watchlist created!');
      return { data, error: null };
    } catch (error) {
      logger.error('Error creating watchlist:', error);
      toast.error('Failed to create watchlist');
      return { data: null, error };
    }
  };

  const deleteWatchlist = async (id: string) => {
    try {
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWatchlists(prev => prev.filter(w => w.id !== id));
      if (activeWatchlistId === id) {
        setItems([]);
        setActiveWatchlistId(null);
      }
      toast.success('Watchlist deleted');
      return { error: null };
    } catch (error) {
      logger.error('Error deleting watchlist:', error);
      toast.error('Failed to delete watchlist');
      return { error };
    }
  };

  const addItem = async (watchlistId: string, item: Omit<WatchlistItem, 'id' | 'watchlist_id' | 'created_at'>) => {
    // Prevent duplicate tickers in the same watchlist
    const tickerUpper = item.ticker.toUpperCase();
    const isDuplicate = items.some(
      existing => existing.watchlist_id === watchlistId && existing.ticker.toUpperCase() === tickerUpper
    );
    if (isDuplicate) {
      toast.error(`${tickerUpper} is already in this watchlist`);
      return { data: null, error: new Error('Duplicate ticker') };
    }

    try {
      const { data, error } = await supabase
        .from('watchlist_items')
        .insert({ ...item, ticker: tickerUpper, watchlist_id: watchlistId })
        .select()
        .single();

      if (error) throw error;

      if (activeWatchlistId === watchlistId) {
        setItems(prev => [data, ...prev]);
      }
      toast.success('Ticker added!');
      return { data, error: null };
    } catch (error) {
      logger.error('Error adding item:', error);
      toast.error('Failed to add ticker');
      return { data: null, error };
    }
  };

  const updateItem = async (id: string, updates: Partial<WatchlistItem>) => {
    try {
      const { data, error } = await supabase
        .from('watchlist_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setItems(prev => prev.map(i => i.id === id ? data : i));
      return { data, error: null };
    } catch (error) {
      logger.error('Error updating item:', error);
      toast.error('Failed to update ticker');
      return { data: null, error };
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Ticker removed');
      return { error: null };
    } catch (error) {
      logger.error('Error deleting item:', error);
      toast.error('Failed to remove ticker');
      return { error };
    }
  };

  const setDefaultWatchlist = async (watchlistId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase.rpc('set_default_watchlist', {
        p_watchlist_id: watchlistId,
        p_user_id: user.id,
      });

      if (error) throw error;

      // Update local state
      setWatchlists(prev => prev.map(w => ({
        ...w,
        is_default: w.id === watchlistId,
      })));

      toast.success('Default watchlist set');
      return { error: null };
    } catch (error) {
      logger.error('Error setting default watchlist:', error);
      toast.error('Failed to set default watchlist');
      return { error };
    }
  };

  // Get the default watchlist (or first one if no default set)
  const getDefaultWatchlist = useCallback(() => {
    return watchlists.find(w => w.is_default) || watchlists[0] || null;
  }, [watchlists]);

  return {
    watchlists,
    items,
    isLoading,
    activeWatchlistId,
    createWatchlist,
    deleteWatchlist,
    addItem,
    updateItem,
    deleteItem,
    fetchItems,
    refetch: fetchWatchlists,
    setDefaultWatchlist,
    getDefaultWatchlist,
  };
};
