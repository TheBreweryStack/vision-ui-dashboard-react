import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';
import { TradeGroup } from './useTradeGroups';

/**
 * Lightweight hook that provides only trade group mutation functions.
 * Use this when you only need to perform actions (DCA, close, update) 
 * without fetching all trade group data.
 * 
 * This is much more efficient for pages like Dashboard that get their
 * data from an RPC call but still need mutation capabilities.
 */
export const useTradeGroupMutations = (onSuccess?: () => void) => {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();

  // Find matching open group for a trade (for DCA / averaging into positions)
  const findMatchingOpenGroup = useCallback(async (params: {
    ticker: string;
    trade_type: string;
    strike_price?: number | null;
    expiration_date?: string | null;
  }): Promise<TradeGroup | null> => {
    if (!user) return null;

    let query = supabase
      .from('trade_groups')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .eq('ticker', params.ticker.toUpperCase())
      .eq('trade_type', params.trade_type);

    if (activePortfolioId) {
      query = query.eq('portfolio_id', activePortfolioId);
    }

    if (params.trade_type !== 'stock') {
      if (params.strike_price !== null && params.strike_price !== undefined) {
        query = query.eq('strike_price', params.strike_price);
      }
      if (params.expiration_date) {
        query = query.eq('expiration_date', params.expiration_date);
      }
    }

    const { data, error } = await query.order('entry_date', { ascending: true }).limit(1);

    if (error) {
      console.error('Error finding matching group:', error);
      throw new Error(`Failed to search for matching trade group: ${error.message}`);
    }

    return data && data.length > 0 ? { ...data[0], status: data[0].status as 'open' | 'closed' } : null;
  }, [user, activePortfolioId]);

  // Add to position (DCA)
  const addToPosition = useCallback(async (
    groupId: string,
    params: {
      quantity: number;
      price: number;
      fill_date: string;
      fill_time?: string | null;
      source?: string;
      source_inbox_id?: string | null;
    }
  ): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data: group, error: groupError } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const currentTotal = group.avg_entry_price * group.opened_qty;
      const newTotal = currentTotal + (params.price * params.quantity);
      const newOpenedQty = group.opened_qty + params.quantity;
      const newAvgPrice = newTotal / newOpenedQty;

      const { error: updateError } = await supabase
        .from('trade_groups')
        .update({
          opened_qty: newOpenedQty,
          remaining_qty: group.remaining_qty + params.quantity,
          avg_entry_price: Number(newAvgPrice.toFixed(2)),
        })
        .eq('id', groupId);

      if (updateError) throw updateError;

      const { error: fillError } = await supabase
        .from('trade_fills')
        .insert({
          trade_group_id: groupId,
          user_id: user.id,
          side: 'buy',
          effect: 'open',
          qty: params.quantity,
          price: params.price,
          fill_date: params.fill_date,
          fill_time: params.fill_time || null,
          source: params.source || 'manual',
          source_inbox_id: params.source_inbox_id || null,
        });

      if (fillError) throw fillError;

      onSuccess?.();
      return { error: null };
    } catch (error) {
      console.error('Error adding to position:', error);
      return { error: error as Error };
    }
  }, [user, onSuccess]);

  // Close position (partial or full)
  const closePosition = useCallback(async (
    groupId: string,
    params: {
      quantity: number;
      price: number;
      fill_date: string;
      fill_time?: string | null;
      source?: string;
      source_inbox_id?: string | null;
    }
  ): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data: group, error: groupError } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const closeQty = Math.min(params.quantity, group.remaining_qty);
      const newRemainingQty = group.remaining_qty - closeQty;
      const newClosedQty = group.closed_qty + closeQty;

      const multiplier = group.trade_type === 'stock' ? 1 : 100;
      const closePnl = (params.price - group.avg_entry_price) * closeQty * multiplier;
      const newRealizedPnl = (group.realized_pnl || 0) + closePnl;

      let newAvgExitPrice: number;
      if (group.avg_exit_price && group.closed_qty > 0) {
        const oldExitTotal = group.avg_exit_price * group.closed_qty;
        newAvgExitPrice = (oldExitTotal + params.price * closeQty) / newClosedQty;
      } else {
        newAvgExitPrice = params.price;
      }

      const updateData: Record<string, string | number | null> = {
        closed_qty: newClosedQty,
        remaining_qty: newRemainingQty,
        avg_exit_price: Number(newAvgExitPrice.toFixed(2)),
        realized_pnl: Number(newRealizedPnl.toFixed(2)),
        status: newRemainingQty === 0 ? 'closed' : 'open',
      };
      
      if (newRemainingQty === 0) {
        updateData.exit_date = params.fill_date;
      }
      
      const { error: updateError } = await supabase
        .from('trade_groups')
        .update(updateData)
        .eq('id', groupId);

      if (updateError) throw updateError;

      const { error: fillError } = await supabase
        .from('trade_fills')
        .insert({
          trade_group_id: groupId,
          user_id: user.id,
          side: 'sell',
          effect: 'close',
          qty: closeQty,
          price: params.price,
          fill_date: params.fill_date,
          fill_time: params.fill_time || null,
          source: params.source || 'manual',
          source_inbox_id: params.source_inbox_id || null,
        });

      if (fillError) throw fillError;

      onSuccess?.();
      return { error: null };
    } catch (error) {
      console.error('Error closing position:', error);
      return { error: error as Error };
    }
  }, [user, onSuccess]);

  // Update group metadata
  const updateGroup = useCallback(async (
    groupId: string,
    updates: Partial<{ strategy: string | null; notes: string | null; images: string[] | null }>
  ): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase
        .from('trade_groups')
        .update(updates)
        .eq('id', groupId);

      if (error) throw error;

      onSuccess?.();
      return { error: null };
    } catch (error) {
      console.error('Error updating trade group:', error);
      return { error: error as Error };
    }
  }, [onSuccess]);

  // Delete group and all its fills
  const deleteGroup = useCallback(async (groupId: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase
        .from('trade_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      onSuccess?.();
      return { error: null };
    } catch (error) {
      console.error('Error deleting trade group:', error);
      return { error: error as Error };
    }
  }, [onSuccess]);

  // Create a new trade group with initial fill
  const createGroup = useCallback(async (params: {
    ticker: string;
    trade_type: string;
    strike_price?: number | null;
    expiration_date?: string | null;
    entry_date: string;
    entry_time?: string | null;
    quantity: number;
    price: number;
    strategy?: string | null;
    notes?: string | null;
    images?: string[] | null;
    source?: string;
    source_inbox_id?: string | null;
  }): Promise<{ data: TradeGroup | null; error: Error | null }> => {
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    try {
      const existingGroup = await findMatchingOpenGroup({
        ticker: params.ticker,
        trade_type: params.trade_type,
        strike_price: params.strike_price,
        expiration_date: params.expiration_date,
      });

      if (existingGroup) {
        const { error } = await addToPosition(existingGroup.id, {
          quantity: params.quantity,
          price: params.price,
          fill_date: params.entry_date,
          fill_time: params.entry_time,
          source: params.source,
          source_inbox_id: params.source_inbox_id,
        });
        
        if (error) throw error;
        
        const { data: updatedGroup } = await supabase
          .from('trade_groups')
          .select('*')
          .eq('id', existingGroup.id)
          .single();
          
        return { 
          data: updatedGroup ? { ...updatedGroup, status: updatedGroup.status as 'open' | 'closed' } : existingGroup, 
          error: null 
        };
      }

      const { data: group, error: groupError } = await supabase
        .from('trade_groups')
        .insert({
          user_id: user.id,
          ticker: params.ticker.toUpperCase(),
          trade_type: params.trade_type,
          strike_price: params.strike_price || null,
          expiration_date: params.expiration_date || null,
          entry_date: params.entry_date,
          status: 'open',
          opened_qty: params.quantity,
          closed_qty: 0,
          remaining_qty: params.quantity,
          avg_entry_price: params.price,
          strategy: params.strategy || null,
          notes: params.notes || null,
          images: params.images || [],
          portfolio_id: activePortfolioId,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: fillError } = await supabase
        .from('trade_fills')
        .insert({
          trade_group_id: group.id,
          user_id: user.id,
          side: 'buy',
          effect: 'open',
          qty: params.quantity,
          price: params.price,
          fill_date: params.entry_date,
          fill_time: params.entry_time || null,
          source: params.source || 'manual',
          source_inbox_id: params.source_inbox_id || null,
        });

      if (fillError) throw fillError;

      onSuccess?.();
      return { data: { ...group, status: group.status as 'open' | 'closed' }, error: null };
    } catch (error) {
      console.error('Error creating trade group:', error);
      return { data: null, error: error as Error };
    }
  }, [user, activePortfolioId, findMatchingOpenGroup, addToPosition, onSuccess]);

  return {
    findMatchingOpenGroup,
    createGroup,
    addToPosition,
    closePosition,
    updateGroup,
    deleteGroup,
  };
};
