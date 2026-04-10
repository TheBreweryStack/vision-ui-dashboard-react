import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';
import { toast } from 'sonner';
import { getPrefetchedData } from './useDataPrefetch';
import { logger } from '@/lib/logger';

export interface TradeGroup {
  id: string;
  user_id: string;
  ticker: string;
  trade_type: string;
  strike_price: number | null;
  expiration_date: string | null;
  entry_date: string;
  exit_date: string | null;
  status: 'open' | 'closed';
  opened_qty: number;
  closed_qty: number;
  remaining_qty: number;
  avg_entry_price: number;
  avg_exit_price: number | null;
  realized_pnl: number | null;
  strategy: string | null;
  notes: string | null;
  images: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TradeFill {
  id: string;
  trade_group_id: string;
  user_id: string;
  side: 'buy' | 'sell';
  effect: 'open' | 'close';
  qty: number;
  price: number;
  fill_date: string;
  fill_time: string | null;
  source: string;
  source_inbox_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface TradeGroupWithFills extends TradeGroup {
  fills: TradeFill[];
}

interface TradeGroupStats {
  totalPnl: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export const useTradeGroups = () => {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();
  const [groups, setGroups] = useState<TradeGroupWithFills[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Check for prefetched data first
      const prefetched = getPrefetchedData();
      
      if (prefetched?.tradeGroups && prefetched?.tradeFills) {
        // Use prefetched data (legacy path)
        const groupsData = prefetched.tradeGroups;
        const fills = prefetched.tradeFills as TradeFill[];

        // Combine groups with their fills and compute quantities from fills
        const groupsWithFills: TradeGroupWithFills[] = groupsData.map(group => {
          const groupFills = fills.filter(f => f.trade_group_id === group.id) as TradeFill[];
          
          // Compute quantities from fills (source of truth)
          const openedQty = groupFills
            .filter(f => f.effect === 'open')
            .reduce((sum, f) => sum + f.qty, 0);
          const closedQty = groupFills
            .filter(f => f.effect === 'close')
            .reduce((sum, f) => sum + f.qty, 0);
          const remainingQty = openedQty - closedQty;
          const computedStatus = remainingQty > 0 ? 'open' : 'closed';
          
          return {
            ...group,
            opened_qty: openedQty,
            closed_qty: closedQty,
            remaining_qty: remainingQty,
            status: computedStatus as 'open' | 'closed',
            fills: groupFills,
          };
        });

        setGroups(groupsWithFills);
      } else {
        // Use optimized RPC that returns groups with fills in a single query
        const { data: result, error: rpcError } = await supabase.rpc('get_journal_data',
          activePortfolioId ? { p_portfolio_id: activePortfolioId } : {}
        );

        if (rpcError) {
          // Fallback to legacy fetch if RPC fails
          logger.warn('RPC failed, falling back to legacy fetch:', rpcError);
          await fetchGroupsLegacy();
          return;
        }

        // Parse the result - it comes as { groups: [...] }
        const journalData = result as unknown as { groups: TradeGroupWithFills[] };
        
        // Compute quantities from fills for each group
        const groupsWithFills: TradeGroupWithFills[] = (journalData?.groups || []).map(group => {
          const groupFills = group.fills || [];
          
          // Compute quantities from fills (source of truth)
          const openedQty = groupFills
            .filter(f => f.effect === 'open')
            .reduce((sum, f) => sum + f.qty, 0);
          const closedQty = groupFills
            .filter(f => f.effect === 'close')
            .reduce((sum, f) => sum + f.qty, 0);
          const remainingQty = openedQty - closedQty;
          const computedStatus = remainingQty > 0 ? 'open' : 'closed';
          
          return {
            ...group,
            opened_qty: openedQty,
            closed_qty: closedQty,
            remaining_qty: remainingQty,
            status: computedStatus as 'open' | 'closed',
            fills: groupFills,
          };
        });

        setGroups(groupsWithFills);
      }
    } catch (error) {
      logger.error('Error fetching trade groups:', error);
      toast.error('Failed to load trades');
    } finally {
      setIsLoading(false);
    }
  }, [user, activePortfolioId]);

  // Legacy fetch method as fallback
  const fetchGroupsLegacy = async () => {
    if (!user) return;

    const { data: fetchedGroups, error: groupsError } = await supabase
      .from('trade_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false });

    if (groupsError) throw groupsError;
    const groupsData = fetchedGroups || [];

    // Fetch all fills for these groups
    const groupIds = groupsData.map(g => g.id);
    let fills: TradeFill[] = [];
    
    if (groupIds.length > 0) {
      const { data: fillsData, error: fillsError } = await supabase
        .from('trade_fills')
        .select('*')
        .in('trade_group_id', groupIds)
        .order('fill_date', { ascending: true });

      if (fillsError) throw fillsError;
      fills = (fillsData || []) as TradeFill[];
    }

    // Combine groups with their fills and compute quantities from fills
    const groupsWithFills: TradeGroupWithFills[] = groupsData.map(group => {
      const groupFills = fills.filter(f => f.trade_group_id === group.id) as TradeFill[];
      
      const openedQty = groupFills
        .filter(f => f.effect === 'open')
        .reduce((sum, f) => sum + f.qty, 0);
      const closedQty = groupFills
        .filter(f => f.effect === 'close')
        .reduce((sum, f) => sum + f.qty, 0);
      const remainingQty = openedQty - closedQty;
      const computedStatus = remainingQty > 0 ? 'open' : 'closed';
      
      return {
        ...group,
        opened_qty: openedQty,
        closed_qty: closedQty,
        remaining_qty: remainingQty,
        status: computedStatus as 'open' | 'closed',
        fills: groupFills,
      };
    });

    setGroups(groupsWithFills);
  };

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Find matching open group for a trade (for DCA / averaging into positions)
  // Does NOT match on entry_date so we can average into existing positions from different days
  const findMatchingOpenGroup = async (params: {
    ticker: string;
    trade_type: string;
    strike_price?: number | null;
    expiration_date?: string | null;
    entry_date?: string; // Optional - not used for matching, just for reference
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

    // For options, match strike and expiration (these define the same contract)
    if (params.trade_type !== 'stock') {
      if (params.strike_price !== null && params.strike_price !== undefined) {
        query = query.eq('strike_price', params.strike_price);
      }
      if (params.expiration_date) {
        query = query.eq('expiration_date', params.expiration_date);
      }
    }

    // Get oldest matching position (FIFO for DCA)
    const { data, error } = await query.order('entry_date', { ascending: true }).limit(1);

    if (error) {
      logger.error('Error finding matching group:', error);
      return null;
    }

    return data && data.length > 0 ? { ...data[0], status: data[0].status as 'open' | 'closed' } : null;
  };

  // Create a new trade group with initial fill (or add to existing if duplicate)
  const createGroup = async (params: {
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
      // First check if a group with this key already exists
      const existingGroup = await findMatchingOpenGroup({
        ticker: params.ticker,
        trade_type: params.trade_type,
        strike_price: params.strike_price,
        expiration_date: params.expiration_date,
        entry_date: params.entry_date,
      });

      if (existingGroup) {
        // Add to existing position instead of creating duplicate
        const { error } = await addToPosition(existingGroup.id, {
          quantity: params.quantity,
          price: params.price,
          fill_date: params.entry_date,
          fill_time: params.entry_time,
          source: params.source,
          source_inbox_id: params.source_inbox_id,
        });
        
        if (error) throw error;
        
        // Return the existing group with updated data
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

      // Create new group
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

      // Create the initial fill
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

      await fetchGroups();
      return { data: { ...group, status: group.status as 'open' | 'closed' }, error: null };
    } catch (error) {
      logger.error('Error creating trade group:', error);
      return { data: null, error: error as Error };
    }
  };

  // Add to position (DCA)
  const addToPosition = async (
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
      // Get current group
      const { data: group, error: groupError } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      // Calculate new average entry price
      const currentTotal = group.avg_entry_price * group.opened_qty;
      const newTotal = currentTotal + (params.price * params.quantity);
      const newOpenedQty = group.opened_qty + params.quantity;
      const newAvgPrice = newTotal / newOpenedQty;

      // Update the group
      const { error: updateError } = await supabase
        .from('trade_groups')
        .update({
          opened_qty: newOpenedQty,
          remaining_qty: group.remaining_qty + params.quantity,
          avg_entry_price: Number(newAvgPrice.toFixed(2)),
        })
        .eq('id', groupId);

      if (updateError) throw updateError;

      // Create the fill
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

      await fetchGroups();
      return { error: null };
    } catch (error) {
      logger.error('Error adding to position:', error);
      return { error: error as Error };
    }
  };

  // Close position (partial or full)
  const closePosition = async (
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
      // Get current group
      const { data: group, error: groupError } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const closeQty = Math.min(params.quantity, group.remaining_qty);
      const newRemainingQty = group.remaining_qty - closeQty;
      const newClosedQty = group.closed_qty + closeQty;

      // Calculate realized PnL for this close
      const multiplier = group.trade_type === 'stock' ? 1 : 100;
      const closePnl = (params.price - group.avg_entry_price) * closeQty * multiplier;
      const newRealizedPnl = (group.realized_pnl || 0) + closePnl;

      // Calculate new average exit price
      let newAvgExitPrice: number;
      if (group.avg_exit_price && group.closed_qty > 0) {
        const oldExitTotal = group.avg_exit_price * group.closed_qty;
        newAvgExitPrice = (oldExitTotal + params.price * closeQty) / newClosedQty;
      } else {
        newAvgExitPrice = params.price;
      }

      // Update the group
      const updateData: Record<string, string | number | null> = {
        closed_qty: newClosedQty,
        remaining_qty: newRemainingQty,
        avg_exit_price: Number(newAvgExitPrice.toFixed(2)),
        realized_pnl: Number(newRealizedPnl.toFixed(2)),
        status: newRemainingQty === 0 ? 'closed' : 'open',
      };
      
      // Set exit_date when fully closed
      if (newRemainingQty === 0) {
        updateData.exit_date = params.fill_date;
      }
      
      const { error: updateError } = await supabase
        .from('trade_groups')
        .update(updateData)
        .eq('id', groupId);

      if (updateError) throw updateError;

      // Create the fill
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

      await fetchGroups();
      return { error: null };
    } catch (error) {
      logger.error('Error closing position:', error);
      return { error: error as Error };
    }
  };

  // Update group metadata
  const updateGroup = async (
    groupId: string,
    updates: Partial<Pick<TradeGroup, 'strategy' | 'notes' | 'images'>>
  ): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase
        .from('trade_groups')
        .update(updates)
        .eq('id', groupId);

      if (error) throw error;

      await fetchGroups();
      return { error: null };
    } catch (error) {
      logger.error('Error updating trade group:', error);
      return { error: error as Error };
    }
  };

  // Delete group and all its fills
  const deleteGroup = async (groupId: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase
        .from('trade_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      await fetchGroups();
      return { error: null };
    } catch (error) {
      logger.error('Error deleting trade group:', error);
      return { error: error as Error };
    }
  };

  // Calculate stats
  const stats: TradeGroupStats = useMemo(() => {
    const closedGroups = groups.filter(g => g.status === 'closed');
    const openGroups = groups.filter(g => g.status === 'open');
    
    const wins = closedGroups.filter(g => (g.realized_pnl || 0) > 0);
    const losses = closedGroups.filter(g => (g.realized_pnl || 0) < 0);

    const totalPnl = groups.reduce((sum, g) => sum + (g.realized_pnl || 0), 0);
    const avgWin = wins.length > 0 
      ? wins.reduce((sum, g) => sum + (g.realized_pnl || 0), 0) / wins.length 
      : 0;
    const avgLoss = losses.length > 0 
      ? losses.reduce((sum, g) => sum + (g.realized_pnl || 0), 0) / losses.length 
      : 0;

    return {
      totalPnl,
      totalTrades: groups.length,
      openTrades: openGroups.length,
      closedTrades: closedGroups.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: closedGroups.length > 0 ? (wins.length / closedGroups.length) * 100 : 0,
      avgWin,
      avgLoss,
    };
  }, [groups]);

  return {
    groups,
    isLoading,
    stats,
    fetchGroups,
    findMatchingOpenGroup,
    createGroup,
    addToPosition,
    closePosition,
    updateGroup,
    deleteGroup,
    refetch: fetchGroups,
  };
};
