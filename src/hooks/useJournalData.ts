import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';

export interface TradeFill {
  id: string;
  trade_group_id: string;
  side: string;
  effect: string;
  qty: number;
  price: number;
  fill_date: string;
  fill_time: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}

export interface TradeGroupWithFills {
  id: string;
  ticker: string;
  trade_type: string;
  strike_price: number | null;
  expiration_date: string | null;
  entry_date: string;
  exit_date: string | null;
  status: string;
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
  fills: TradeFill[];
}

interface JournalData {
  groups: TradeGroupWithFills[];
}

/**
 * Optimized hook for fetching journal data using a single RPC call
 * that returns trade groups with their fills already joined
 */
export function useJournalData() {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();
  const [data, setData] = useState<JournalData>({ groups: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setData({ groups: [] });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase.rpc('get_journal_data',
        activePortfolioId ? { p_portfolio_id: activePortfolioId } : {}
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Parse the result - it comes as { groups: [...] }
      const journalData = result as unknown as JournalData;
      
      setData({
        groups: journalData?.groups || []
      });
    } catch (err) {
      console.error('Error fetching journal data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch journal data'));
    } finally {
      setIsLoading(false);
    }
  }, [user, activePortfolioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute stats from the groups
  const stats = useMemo(() => {
    const closedGroups = data.groups.filter(g => g.status === 'closed' && g.realized_pnl !== null);
    const wins = closedGroups.filter(g => (g.realized_pnl ?? 0) > 0);
    const losses = closedGroups.filter(g => (g.realized_pnl ?? 0) < 0);

    const totalPnl = closedGroups.reduce((sum, g) => sum + (g.realized_pnl ?? 0), 0);
    const avgWin = wins.length > 0 
      ? wins.reduce((sum, g) => sum + (g.realized_pnl ?? 0), 0) / wins.length 
      : 0;
    const avgLoss = losses.length > 0 
      ? losses.reduce((sum, g) => sum + (g.realized_pnl ?? 0), 0) / losses.length 
      : 0;
    const winRate = closedGroups.length > 0 
      ? (wins.length / closedGroups.length) * 100 
      : 0;

    return {
      totalPnl,
      totalTrades: closedGroups.length,
      openTrades: data.groups.filter(g => g.status === 'open').length,
      winRate,
      avgWin,
      avgLoss
    };
  }, [data.groups]);

  return {
    groups: data.groups,
    stats,
    isLoading,
    error,
    refetch: fetchData
  };
}

export default useJournalData;
