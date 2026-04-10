import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, TrendingDown, Activity, Calendar, 
  Clock, Target, Newspaper, Loader2, Zap, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { TickerLogo } from '@/components/common/TickerLogo';

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

interface TradeEnrichment {
  id: string;
  trade_id: string;
  ticker: string;
  entry_datetime: string;
  exit_datetime?: string;
  above_sma20_entry?: boolean;
  above_sma50_entry?: boolean;
  sma20_entry?: number;
  sma50_entry?: number;
  trend_regime_entry?: string;
  mfe?: number;
  mfe_pct?: number;
  mae?: number;
  mae_pct?: number;
  earnings_in_days?: number;
  news?: {
    headline: string;
    source: string;
    url: string;
    datetime: number;
  }[];
}

interface TradeContextDialogProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TradeContextDialog: React.FC<TradeContextDialogProps> = ({
  trade,
  open,
  onOpenChange,
}) => {
  const [enrichment, setEnrichment] = useState<TradeEnrichment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    if (trade && open) {
      fetchEnrichment();
    }
  }, [trade, open]);

  const fetchEnrichment = async () => {
    if (!trade) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('trade_enrichment')
        .select('*')
        .eq('trade_id', trade.id)
        .maybeSingle();

      if (error) throw error;
      // Cast news from Json to expected type
      if (data) {
        setEnrichment({
          ...data,
          news: data.news as TradeEnrichment['news']
        });
      } else {
        setEnrichment(null);
      }
    } catch (error) {
      console.error('Error fetching enrichment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnrichTrade = async () => {
    if (!trade) return;
    setIsEnriching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enrich-trade', {
        body: { trade_id: trade.id }
      });
      
      if (error) throw error;
      
      if (data?.ok) {
        toast.success('Trade enriched successfully!');
        fetchEnrichment();
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      console.error('Error enriching trade:', error);
      toast.error(error.message || 'Failed to enrich trade');
    } finally {
      setIsEnriching(false);
    }
  };

  if (!trade) return null;

  const newsItems = enrichment?.news?.slice(0, 3) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <TickerLogo symbol={trade.ticker} size="md" />
            <div>
              <span className="font-bold">{trade.ticker}</span>
              <span className="text-muted-foreground ml-2 text-sm capitalize">{trade.trade_type}</span>
            </div>
            <Badge className={cn(
              "ml-auto",
              (trade.pnl || 0) >= 0 ? "bg-profit/10 text-profit border-profit/30" : "bg-loss/10 text-loss border-loss/30"
            )}>
              {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl?.toFixed(2) || '0.00'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trade Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                Entry Date
              </div>
              <p className="font-medium text-sm">{format(parseISO(trade.entry_date), 'MMM d, yyyy')}</p>
              {trade.entry_time && (
                <p className="text-xs text-muted-foreground">{trade.entry_time}</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                Exit Date
              </div>
              <p className="font-medium text-sm">
                {trade.exit_date ? format(parseISO(trade.exit_date), 'MMM d, yyyy') : 'Open'}
              </p>
              {trade.exit_time && (
                <p className="text-xs text-muted-foreground">{trade.exit_time}</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-1">Entry Price</p>
              <p className="font-medium text-sm">${trade.entry_price.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-1">Exit Price</p>
              <p className="font-medium text-sm">
                {trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : '-'}
              </p>
            </div>
          </div>

          {trade.strategy && (
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground mb-1">Strategy</p>
              <p className="font-medium">{trade.strategy}</p>
            </div>
          )}

          {/* Enrichment Section */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : enrichment ? (
            <div className="space-y-4">
              {/* SMA & Trend */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">Trend Context at Entry</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">SMA20</p>
                    <Badge className={cn(
                      enrichment.above_sma20_entry 
                        ? "bg-profit/10 text-profit border-profit/30" 
                        : "bg-loss/10 text-loss border-loss/30"
                    )}>
                      {enrichment.above_sma20_entry ? 'Above' : 'Below'}
                    </Badge>
                    {enrichment.sma20_entry && (
                      <p className="text-xs text-muted-foreground mt-1">${enrichment.sma20_entry.toFixed(2)}</p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">SMA50</p>
                    <Badge className={cn(
                      enrichment.above_sma50_entry 
                        ? "bg-profit/10 text-profit border-profit/30" 
                        : "bg-loss/10 text-loss border-loss/30"
                    )}>
                      {enrichment.above_sma50_entry ? 'Above' : 'Below'}
                    </Badge>
                    {enrichment.sma50_entry && (
                      <p className="text-xs text-muted-foreground mt-1">${enrichment.sma50_entry.toFixed(2)}</p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Trend Regime</p>
                    <Badge variant="secondary" className="capitalize">
                      {enrichment.trend_regime_entry || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Days to Earnings</p>
                    <Badge variant="secondary">
                      {enrichment.earnings_in_days !== null ? `${enrichment.earnings_in_days} days` : 'N/A'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* MFE / MAE */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-profit/5 border border-profit/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-profit" />
                    <h4 className="font-semibold text-sm text-profit">Max Favorable (MFE)</h4>
                  </div>
                  {enrichment.mfe !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-profit">${enrichment.mfe?.toFixed(2)}</span>
                      {enrichment.mfe_pct !== null && (
                        <span className="text-sm text-muted-foreground">({enrichment.mfe_pct?.toFixed(1)}%)</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data</p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-loss/5 border border-loss/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-loss" />
                    <h4 className="font-semibold text-sm text-loss">Max Adverse (MAE)</h4>
                  </div>
                  {enrichment.mae !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-loss">${enrichment.mae?.toFixed(2)}</span>
                      {enrichment.mae_pct !== null && (
                        <span className="text-sm text-muted-foreground">({enrichment.mae_pct?.toFixed(1)}%)</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data</p>
                  )}
                </div>
              </div>

              {/* News Headlines */}
              {newsItems.length > 0 && (
                <div className="p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Newspaper className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">News at Entry</h4>
                  </div>
                  <div className="space-y-2">
                    {newsItems.map((news, i) => (
                      <a 
                        key={i} 
                        href={news.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground line-clamp-2">{news.headline}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{news.source}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(news.datetime * 1000), 'MMM d, yyyy')}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-foreground font-medium">No enrichment data available</p>
                <p className="text-sm text-muted-foreground">Enrich this trade to see market context</p>
              </div>
              <Button
                onClick={handleEnrichTrade}
                disabled={isEnriching}
                className="bg-primary hover:bg-primary/90"
              >
                {isEnriching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Enrich This Trade
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TradeContextDialog;
