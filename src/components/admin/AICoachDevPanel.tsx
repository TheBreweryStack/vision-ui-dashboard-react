import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Brain, Loader2, Activity, RefreshCw, 
  CheckCircle, XCircle, Zap, FileJson
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Trade {
  id: string;
  ticker: string;
  entry_date: string;
  exit_date?: string;
  status: string;
  pnl?: number;
}

interface EnrichmentResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  data?: Record<string, unknown>;
  successCount?: number;
  failCount?: number;
}

const AICoachDevPanel: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string>('');
  const [batchSize, setBatchSize] = useState<string>('10');
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  
  const [singleEnrich, setSingleEnrich] = useState<EnrichmentResult>({ status: 'idle' });
  const [batchEnrich, setBatchEnrich] = useState<EnrichmentResult>({ status: 'idle' });
  const [insightsPreview, setInsightsPreview] = useState<EnrichmentResult>({ status: 'idle' });

  // Fetch closed trades for dropdown
  useEffect(() => {
    const fetchTrades = async () => {
      setIsLoadingTrades(true);
      try {
        const { data, error } = await supabase
          .from('trades')
          .select('id, ticker, entry_date, exit_date, status, pnl')
          .eq('status', 'closed')
          .order('exit_date', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        setTrades(data || []);
        if (data && data.length > 0) {
          setSelectedTradeId(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching trades:', error);
        toast.error('Failed to load trades');
      } finally {
        setIsLoadingTrades(false);
      }
    };
    
    fetchTrades();
  }, []);

  // Enrich single trade
  const enrichSingleTrade = async () => {
    if (!selectedTradeId) {
      toast.error('Please select a trade first');
      return;
    }
    
    setSingleEnrich({ status: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke('enrich-trade', {
        body: { trade_id: selectedTradeId }
      });
      
      if (error) throw error;
      
      if (data?.ok) {
        setSingleEnrich({ 
          status: 'success', 
          message: 'Trade enriched successfully',
          data: data.enrichment 
        });
        toast.success('Trade enriched!');
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        setSingleEnrich({ status: 'error', message: 'Unknown response', data });
      }
    } catch (error: unknown) {
      const message = error.message || 'Failed to enrich trade';
      setSingleEnrich({ status: 'error', message });
      toast.error(message);
    }
  };

  // Bulk enrich trades
  const bulkEnrichTrades = async () => {
    const limit = parseInt(batchSize);
    const tradesToEnrich = trades.slice(0, limit);
    
    if (tradesToEnrich.length === 0) {
      toast.error('No trades to enrich');
      return;
    }
    
    setBatchEnrich({ status: 'loading', message: `Enriching 0/${tradesToEnrich.length}...` });
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < tradesToEnrich.length; i++) {
      const trade = tradesToEnrich[i];
      setBatchEnrich({ 
        status: 'loading', 
        message: `Enriching ${i + 1}/${tradesToEnrich.length} (${trade.ticker})...` 
      });
      
      try {
        const { data, error } = await supabase.functions.invoke('enrich-trade', {
          body: { trade_id: trade.id }
        });
        
        if (error || !data?.ok) {
          failCount++;
        } else {
          successCount++;
        }
      } catch {
        failCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setBatchEnrich({ 
      status: 'success', 
      message: `Completed: ${successCount} succeeded, ${failCount} failed`,
      successCount,
      failCount
    });
    toast.success(`Bulk enrichment complete: ${successCount}/${tradesToEnrich.length} trades enriched`);
  };

  // Preview raw insights JSON
  const previewInsights = async () => {
    setInsightsPreview({ status: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-insights', {
        body: { scope: 'last_60_trades' }
      });
      
      if (error) throw error;
      
      if (data?.payload) {
        setInsightsPreview({ 
          status: 'success', 
          message: `Generated from ${data.payload.data_quality?.trade_count || 0} trades`,
          data: data.payload 
        });
        toast.success('Insights generated!');
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        setInsightsPreview({ status: 'success', message: 'No trades found', data: null });
      }
    } catch (error: unknown) {
      const message = error.message || 'Failed to generate insights';
      setInsightsPreview({ status: 'error', message });
      toast.error(message);
    }
  };

  const getStatusBadge = (status: EnrichmentResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-profit/10 text-profit border-profit/30">Complete</Badge>;
      case 'error':
        return <Badge className="bg-loss/10 text-loss border-loss/30">Failed</Badge>;
      case 'loading':
        return <Badge className="bg-primary/10 text-primary border-primary/30">Processing...</Badge>;
      default:
        return <Badge variant="secondary">Ready</Badge>;
    }
  };

  const selectedTrade = trades.find(t => t.id === selectedTradeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Coach Preview (Dev Mode)</h2>
          <p className="text-sm text-muted-foreground">Test enrichment and preview insights payload</p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Single Trade Enrichment */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm">Single Trade Enrichment</CardTitle>
                  <CardDescription className="text-xs">Select and enrich a specific trade</CardDescription>
                </div>
              </div>
              {getStatusBadge(singleEnrich.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedTradeId} onValueChange={setSelectedTradeId} disabled={isLoadingTrades}>
                <SelectTrigger className="w-[280px] bg-secondary/50 border-border/50">
                  <SelectValue placeholder={isLoadingTrades ? "Loading trades..." : "Select a trade"} />
                </SelectTrigger>
                <SelectContent>
                  {trades.map(trade => (
                    <SelectItem key={trade.id} value={trade.id}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{trade.ticker}</span>
                        <span className="text-muted-foreground text-xs">{trade.exit_date}</span>
                        {trade.pnl !== undefined && (
                          <span className={cn(
                            "text-xs",
                            trade.pnl > 0 ? "text-profit" : "text-loss"
                          )}>
                            ${trade.pnl?.toFixed(0)}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={enrichSingleTrade} 
                disabled={singleEnrich.status === 'loading' || !selectedTradeId}
                size="sm"
                className="btn-glass"
              >
                {singleEnrich.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Enrich Trade
              </Button>
            </div>
            {singleEnrich.message && (
              <p className={cn(
                "mt-2 text-sm",
                singleEnrich.status === 'success' ? "text-profit" : "text-loss"
              )}>
                {singleEnrich.message}
              </p>
            )}
            {singleEnrich.data && (
              <pre className="mt-3 p-3 bg-secondary/50 rounded-lg text-xs overflow-auto max-h-48">
                {JSON.stringify(singleEnrich.data, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Bulk Enrichment */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm">Bulk Trade Enrichment</CardTitle>
                  <CardDescription className="text-xs">Enrich multiple recent closed trades</CardDescription>
                </div>
              </div>
              {getStatusBadge(batchEnrich.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Last 10 trades</SelectItem>
                  <SelectItem value="50">Last 50 trades</SelectItem>
                  <SelectItem value="100">Last 100 trades</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={bulkEnrichTrades} 
                disabled={batchEnrich.status === 'loading'}
                size="sm"
                className="btn-glass"
              >
                {batchEnrich.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Run Bulk Enrichment
              </Button>
            </div>
            {batchEnrich.message && (
              <p className={cn(
                "mt-2 text-sm",
                batchEnrich.status === 'success' ? "text-foreground" : "text-muted-foreground"
              )}>
                {batchEnrich.message}
              </p>
            )}
            {batchEnrich.status === 'success' && batchEnrich.successCount !== undefined && (
              <div className="mt-3 flex gap-3">
                <Badge className="bg-profit/10 text-profit border-profit/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {batchEnrich.successCount} succeeded
                </Badge>
                {batchEnrich.failCount! > 0 && (
                  <Badge className="bg-loss/10 text-loss border-loss/30">
                    <XCircle className="h-3 w-3 mr-1" />
                    {batchEnrich.failCount} failed
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Raw Insights Preview */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm">Preview Raw Insights JSON</CardTitle>
                  <CardDescription className="text-xs">Generate and view the complete AI insights payload</CardDescription>
                </div>
              </div>
              {getStatusBadge(insightsPreview.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button 
                onClick={previewInsights} 
                disabled={insightsPreview.status === 'loading'}
                size="sm"
                className="btn-glass"
              >
                {insightsPreview.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                Generate Insights
              </Button>
              {insightsPreview.message && (
                <span className={cn(
                  "text-sm",
                  insightsPreview.status === 'success' ? "text-profit" : "text-loss"
                )}>
                  {insightsPreview.message}
                </span>
              )}
            </div>
            {insightsPreview.data && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Win Rate</span>
                    <p className="font-semibold">{insightsPreview.data.stats?.win_rate?.toFixed(1)}%</p>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Expectancy</span>
                    <p className="font-semibold">${insightsPreview.data.stats?.expectancy?.toFixed(2)}</p>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Trades</span>
                    <p className="font-semibold">{insightsPreview.data.data_quality?.trade_count}</p>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Enriched</span>
                    <p className="font-semibold">{insightsPreview.data.data_quality?.enriched_count}</p>
                  </div>
                </div>
                <pre className="p-3 bg-secondary/50 rounded-lg text-xs overflow-auto max-h-96">
                  {JSON.stringify(insightsPreview.data, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AICoachDevPanel;
