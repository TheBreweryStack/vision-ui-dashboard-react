import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, Loader2, ChevronRight, CheckCircle, 
  Clock, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { TickerLogo } from '@/components/common/TickerLogo';
import TradeContextDialog from './TradeContextDialog';
import { logger } from '@/lib/logger';

interface Trade {
  id: string;
  ticker: string;
  entry_date: string;
  entry_time?: string;
  exit_date?: string;
  exit_time?: string;
  pnl?: number;
  strategy?: string;
  trade_type: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
}

interface TradeWithEnrichment extends Trade {
  enrichment_status: 'enriched' | 'pending' | 'failed';
}

const TradesAnalyzedSection: React.FC = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeWithEnrichment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // Fetch last 15 closed trades
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('exit_date', { ascending: false })
        .limit(15);

      if (tradesError) throw tradesError;

      // Fetch enrichment status for these trades
      const tradeIds = (tradesData || []).map(t => t.id);
      const { data: enrichments, error: enrichError } = await supabase
        .from('trade_enrichment')
        .select('trade_id')
        .in('trade_id', tradeIds);

      if (enrichError) throw enrichError;

      const enrichedIds = new Set((enrichments || []).map(e => e.trade_id));

      const tradesWithStatus: TradeWithEnrichment[] = (tradesData || []).map(trade => ({
        ...trade,
        enrichment_status: enrichedIds.has(trade.id) ? 'enriched' : 'pending'
      }));

      setTrades(tradesWithStatus);
    } catch (error) {
      logger.error('Error fetching trades:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user, fetchTrades]);

  const handleTradeClick = (trade: Trade) => {
    setSelectedTrade(trade);
    setDialogOpen(true);
  };

  const getEnrichmentBadge = (status: TradeWithEnrichment['enrichment_status']) => {
    switch (status) {
      case 'enriched':
        return (
          <Badge className="bg-profit/10 text-profit border-profit/30 text-[10px] h-5">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enriched
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-[10px] h-5">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-loss/10 text-loss border-loss/30 text-[10px] h-5">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="content-card p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="content-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">Trades Analyzed</h4>
          <Badge variant="secondary" className="ml-auto">
            {trades.length} trades
          </Badge>
        </div>

        {trades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No closed trades found</p>
            <p className="text-sm mt-1">Close some trades to see them here</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {trades.map(trade => (
              <button
                key={trade.id}
                onClick={() => handleTradeClick(trade)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left group"
              >
                <TickerLogo symbol={trade.ticker} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{trade.ticker}</span>
                    <span className="text-xs text-muted-foreground capitalize">{trade.trade_type}</span>
                    {trade.strategy && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {trade.strategy}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(parseISO(trade.entry_date), 'MMM d')}</span>
                    {trade.entry_time && (
                      <span>@ {trade.entry_time.slice(0, 5)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getEnrichmentBadge(trade.enrichment_status)}
                  <span className={cn(
                    "font-semibold text-sm",
                    (trade.pnl || 0) >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl?.toFixed(0) || 0}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <TradeContextDialog
        trade={selectedTrade}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};

export default TradesAnalyzedSection;
