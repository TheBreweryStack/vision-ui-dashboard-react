import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';
import { useMemo } from 'react';

export interface Holding {
  id: string;
  portfolio_id: string;
  user_id: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  asset_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingWithMarketData extends Holding {
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  sector: string | null;
  companyName: string | null;
  logo: string | null;
}

export function usePortfolioHoldings() {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();
  const queryClient = useQueryClient();

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ['portfolio-holdings', activePortfolioId],
    queryFn: async () => {
      if (!user || !activePortfolioId) return [];
      const { data, error } = await supabase
        .from('portfolio_holdings')
        .select('*')
        .eq('portfolio_id', activePortfolioId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Holding[];
    },
    enabled: !!user && !!activePortfolioId,
  });

  const tickers = useMemo(() => [...new Set(holdings.map(h => h.ticker))], [holdings]);

  const { data: quotes = {} } = useQuery({
    queryKey: ['finnhub-quotes', tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return {};
      const res = await supabase.functions.invoke('finnhub-quote', {
        body: { symbols: tickers, type: 'quote' },
      });
      return res.data?.data || {};
    },
    enabled: tickers.length > 0,
    refetchInterval: 60000,
  });

  const { data: profiles = {} } = useQuery({
    queryKey: ['finnhub-profiles', tickers.sort().join(',')],
    queryFn: async () => {
      if (tickers.length === 0) return {};
      const res = await supabase.functions.invoke('finnhub-quote', {
        body: { symbols: tickers, type: 'profile' },
      });
      return res.data?.data || {};
    },
    enabled: tickers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // cache profiles for 24h
  });

  const enrichedHoldings: HoldingWithMarketData[] = useMemo(() => {
    return holdings.map(h => {
      const quote = quotes[h.ticker];
      const profile = profiles[h.ticker];
      const currentPrice = quote?.price ?? null;
      const marketValue = currentPrice ? currentPrice * h.quantity : h.avg_cost * h.quantity;
      const costBasis = h.avg_cost * h.quantity;
      const unrealizedPnl = currentPrice ? marketValue - costBasis : 0;
      const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

      return {
        ...h,
        currentPrice,
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        marketValue,
        unrealizedPnl,
        unrealizedPnlPercent,
        sector: profile?.industry ?? null,
        companyName: profile?.name ?? null,
        logo: profile?.logo ?? null,
      };
    });
  }, [holdings, quotes, profiles]);

  const addHolding = useMutation({
    mutationFn: async (data: { ticker: string; quantity: number; avg_cost: number }) => {
      if (!user || !activePortfolioId) throw new Error('Not authenticated');
      const { error } = await supabase.from('portfolio_holdings').insert({
        user_id: user.id,
        portfolio_id: activePortfolioId,
        ticker: data.ticker.toUpperCase(),
        quantity: data.quantity,
        avg_cost: data.avg_cost,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] });
    },
  });

  const updateHolding = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; quantity?: number; avg_cost?: number; notes?: string }) => {
      const { error } = await supabase.from('portfolio_holdings').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] });
    },
  });

  const deleteHolding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('portfolio_holdings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] });
    },
  });

  const totalValue = useMemo(() => enrichedHoldings.reduce((s, h) => s + h.marketValue, 0), [enrichedHoldings]);
  const totalCost = useMemo(() => enrichedHoldings.reduce((s, h) => s + h.avg_cost * h.quantity, 0), [enrichedHoldings]);
  const totalPnl = totalValue - totalCost;

  const sectorAllocation = useMemo(() => {
    const map: Record<string, number> = {};
    enrichedHoldings.forEach(h => {
      const sector = h.sector || 'Unknown';
      map[sector] = (map[sector] || 0) + h.marketValue;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [enrichedHoldings]);

  return {
    holdings: enrichedHoldings,
    isLoading: holdingsLoading,
    totalValue,
    totalCost,
    totalPnl,
    sectorAllocation,
    addHolding: addHolding.mutateAsync,
    updateHolding: updateHolding.mutateAsync,
    deleteHolding: deleteHolding.mutateAsync,
    isAdding: addHolding.isPending,
  };
}
