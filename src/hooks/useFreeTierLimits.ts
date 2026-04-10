import { useMemo } from 'react';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useDashboardData } from '@/hooks/useDashboardData';

export const FREE_TRADE_LIMIT = 15;
export const FREE_WATCHLIST_LIMIT = 1;

interface FreeTierLimitsOptions {
  /**
   * Override the trade count instead of fetching from dashboard data.
   * Use this when you already have the trade count from another source
   * (e.g., useTradeGroups) to avoid duplicate RPC calls.
   */
  overrideTradeCount?: number;
}

export function useFreeTierLimits(options?: FreeTierLimitsOptions) {
  const { hasFullAccess, isLoading: accessLoading } = useAccessControl();
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboardData();
  
  // Use override if provided, otherwise use stats from dashboard RPC
  // total_trades = closed trades, open_trades = open trades
  const tradeCount = options?.overrideTradeCount !== undefined
    ? options.overrideTradeCount
    : (dashboardData.stats.total_trades || 0) + (dashboardData.stats.open_trades || 0);
  
  const { canAddTrade, tradesRemaining, isAtLimit } = useMemo(() => {
    if (hasFullAccess) {
      return {
        canAddTrade: true,
        tradesRemaining: Infinity,
        isAtLimit: false,
      };
    }
    
    const remaining = Math.max(0, FREE_TRADE_LIMIT - tradeCount);
    return {
      canAddTrade: tradeCount < FREE_TRADE_LIMIT,
      tradesRemaining: remaining,
      isAtLimit: tradeCount >= FREE_TRADE_LIMIT,
    };
  }, [hasFullAccess, tradeCount]);
  
  return {
    canAddTrade,
    tradesRemaining,
    tradeCount,
    tradeLimit: FREE_TRADE_LIMIT,
    watchlistLimit: FREE_WATCHLIST_LIMIT,
    isAtLimit,
    hasFullAccess,
    // Only show loading if we're actually fetching dashboard data (not when using override)
    isLoading: accessLoading || (options?.overrideTradeCount === undefined && dashboardLoading),
  };
}
