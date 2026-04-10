import { useState, useEffect, useCallback } from 'react';
import { supabase, Trade } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export const useTrades = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });
      
      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      logger.error('Error fetching trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const addTrade = async (trade: Omit<Trade, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    try {
      const insertData: Record<string, unknown> = {
        ticker: trade.ticker,
        trade_type: trade.trade_type as 'call' | 'put' | 'stock',
        entry_price: trade.entry_price,
        entry_date: trade.entry_date,
        entry_time: trade.entry_time,
        exit_price: trade.exit_price,
        exit_date: trade.exit_date,
        exit_time: trade.exit_time,
        quantity: trade.quantity,
        strategy: trade.strategy,
        notes: trade.notes,
        images: trade.images,
        status: (trade.status || 'open') as 'open' | 'closed',
        pnl: trade.pnl,
        strike_price: trade.strike_price ?? null,
        expiration_date: trade.expiration_date ?? null,
        user_id: user.id,
      };

      // Only set position_id if explicitly provided (otherwise let DB default generate it)
      if (trade.position_id) {
        insertData.position_id = trade.position_id;
      }
      
      const { data, error } = await supabase
        .from('trades')
        .insert([insertData])
        .select()
        .single();
      
      if (error) throw error;
      
      setTrades(prev => [data, ...prev]);
      toast.success('Trade added successfully!');
      return { data, error: null };
    } catch (error) {
      logger.error('Error adding trade:', error);
      toast.error('Failed to add trade');
      return { data: null, error };
    }
  };

  const updateTrade = async (id: string, updates: Partial<Trade>) => {
    try {
      // Build update object with proper types
      const updateData: Record<string, unknown> = {};
      if (updates.ticker !== undefined) updateData.ticker = updates.ticker;
      if (updates.trade_type !== undefined) updateData.trade_type = updates.trade_type as 'call' | 'put' | 'stock';
      if (updates.entry_price !== undefined) updateData.entry_price = updates.entry_price;
      if (updates.entry_date !== undefined) updateData.entry_date = updates.entry_date;
      if (updates.entry_time !== undefined) updateData.entry_time = updates.entry_time;
      if (updates.exit_price !== undefined) updateData.exit_price = updates.exit_price;
      if (updates.exit_date !== undefined) updateData.exit_date = updates.exit_date;
      if (updates.exit_time !== undefined) updateData.exit_time = updates.exit_time;
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.strategy !== undefined) updateData.strategy = updates.strategy;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.images !== undefined) updateData.images = updates.images;
      if (updates.status !== undefined) updateData.status = updates.status as 'open' | 'closed';
      if (updates.pnl !== undefined) updateData.pnl = updates.pnl;
      if (updates.position_id !== undefined) updateData.position_id = updates.position_id;
      if (updates.strike_price !== undefined) updateData.strike_price = updates.strike_price;
      if (updates.expiration_date !== undefined) updateData.expiration_date = updates.expiration_date;
      
      const { data, error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      setTrades(prev => prev.map(t => t.id === id ? data : t));
      toast.success('Trade updated!');
      return { data, error: null };
    } catch (error) {
      logger.error('Error updating trade:', error);
      toast.error('Failed to update trade');
      return { data: null, error };
    }
  };

  const deleteTrade = async (id: string) => {
    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setTrades(prev => prev.filter(t => t.id !== id));
      toast.success('Trade deleted');
      return { error: null };
    } catch (error) {
      logger.error('Error deleting trade:', error);
      toast.error('Failed to delete trade');
      return { error };
    }
  };

  // Calculate stats
  const stats = {
    totalPnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    totalTrades: trades.length,
    openTrades: trades.filter(t => t.status === 'open').length,
    closedTrades: trades.filter(t => t.status === 'closed').length,
    winningTrades: trades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).length,
    losingTrades: trades.filter(t => t.status === 'closed' && (t.pnl || 0) < 0).length,
    winRate: trades.filter(t => t.status === 'closed').length > 0
      ? (trades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).length / trades.filter(t => t.status === 'closed').length) * 100
      : 0,
    avgWin: trades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).length > 0
      ? trades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / trades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).length
      : 0,
    avgLoss: trades.filter(t => t.status === 'closed' && (t.pnl || 0) < 0).length > 0
      ? trades.filter(t => t.status === 'closed' && (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / trades.filter(t => t.status === 'closed' && (t.pnl || 0) < 0).length
      : 0,
  };

  return {
    trades,
    isLoading,
    stats,
    addTrade,
    updateTrade,
    deleteTrade,
    refetch: fetchTrades,
  };
};
