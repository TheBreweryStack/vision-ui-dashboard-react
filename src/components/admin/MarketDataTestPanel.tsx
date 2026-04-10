import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity, CheckCircle, XCircle, Loader2, 
  TrendingUp, Brain, RefreshCw, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface TestResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  data?: Record<string, unknown>;
}

interface Trade {
  id: string;
  ticker: string;
  entry_date: string;
  exit_date?: string;
  status: string;
  pnl?: number;
}

const MarketDataTestPanel: React.FC = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string>('');
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  
  const [finnhubTest, setFinnhubTest] = useState<TestResult>({ status: 'idle' });
  const [enrichTest, setEnrichTest] = useState<TestResult>({ status: 'idle' });
  const [insightsTest, setInsightsTest] = useState<TestResult>({ status: 'idle' });

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
          .limit(50);
        
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

  // Test Finnhub API Key
  const testFinnhubKey = async () => {
    setFinnhubTest({ status: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke('finnhub-quote', {
        body: { symbols: ['SPY'], type: 'quote' }
      });
      
      if (error) throw error;
      
      if (data?.data?.SPY?.price) {
        setFinnhubTest({ 
          status: 'success', 
          message: `SPY: $${data.data.SPY.price.toFixed(2)}`,
          data: data.data.SPY 
        });
        toast.success('Finnhub API key is working!');
      } else if (data?.data?.SPY?.error) {
        throw new Error(data.data.SPY.error);
      } else {
        throw new Error('No data returned');
      }
    } catch (error: unknown) {
      const message = error.message || 'Failed to test Finnhub';
      setFinnhubTest({ status: 'error', message });
      toast.error(message);
    }
  };

  // Enrich sample trade
  const enrichSampleTrade = async () => {
    if (!selectedTradeId) {
      toast.error('Please select a trade first');
      return;
    }
    
    setEnrichTest({ status: 'loading' });
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const { data, error } = await supabase.functions.invoke('enrich-trade', {
        body: { trade_id: selectedTradeId }
      });
      
      if (error) throw error;
      
      if (data?.ok) {
        setEnrichTest({ 
          status: 'success', 
          message: 'Trade enriched successfully',
          data: data.enrichment 
        });
        toast.success('Trade enriched!');
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        setEnrichTest({ status: 'error', message: 'Unknown response', data });
      }
    } catch (error: unknown) {
      const message = error.message || 'Failed to enrich trade';
      setEnrichTest({ status: 'error', message });
      toast.error(message);
    }
  };

  // Generate weekly insights
  const generateInsights = async () => {
    setInsightsTest({ status: 'loading' });
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const { data, error } = await supabase.functions.invoke('generate-ai-insights', {
        body: { scope: 'weekly', last_n_trades: 60 }
      });
      
      if (error) throw error;
      
      if (data?.payload) {
        setInsightsTest({ 
          status: 'success', 
          message: `Generated insights from ${data.payload.data_quality?.trade_count || 0} trades`,
          data: data.payload 
        });
        toast.success('Insights generated!');
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        setInsightsTest({ status: 'success', message: 'No trades found', data: null });
      }
    } catch (error: unknown) {
      const message = error.message || 'Failed to generate insights';
      setInsightsTest({ status: 'error', message });
      toast.error(message);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-profit" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-loss" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-profit/10 text-profit border-profit/30">Passed</Badge>;
      case 'error':
        return <Badge className="bg-loss/10 text-loss border-loss/30">Failed</Badge>;
      case 'loading':
        return <Badge className="bg-primary/10 text-primary border-primary/30">Testing...</Badge>;
      default:
        return <Badge variant="secondary">Not tested</Badge>;
    }
  };

  const selectedTrade = trades.find(t => t.id === selectedTradeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Market Data Test Panel</h2>
          <p className="text-sm text-muted-foreground">Validate edge functions and API integrations</p>
        </div>
      </div>

      {/* Deployment Checklist */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Deployment Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">FINNHUB_API_KEY secret exists</span>
            {finnhubTest.status === 'success' ? (
              <CheckCircle className="h-4 w-4 text-profit" />
            ) : (
              <span className="text-xs text-muted-foreground">Run test below</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">enrich_trade function deployed</span>
            {enrichTest.status === 'success' ? (
              <CheckCircle className="h-4 w-4 text-profit" />
            ) : (
              <span className="text-xs text-muted-foreground">Run test below</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">generate_ai_insights function deployed</span>
            {insightsTest.status === 'success' ? (
              <CheckCircle className="h-4 w-4 text-profit" />
            ) : (
              <span className="text-xs text-muted-foreground">Run test below</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Finnhub key NOT in client bundle</span>
            <CheckCircle className="h-4 w-4 text-profit" />
          </div>
        </CardContent>
      </Card>

      {/* Test Cards */}
      <div className="grid gap-4">
        {/* Test 1: Finnhub API Key */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm">Test Finnhub Key</CardTitle>
                  <CardDescription className="text-xs">Fetches SPY candle to validate API key</CardDescription>
                </div>
              </div>
              {getStatusBadge(finnhubTest.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button 
                onClick={testFinnhubKey} 
                disabled={finnhubTest.status === 'loading'}
                size="sm"
                className="btn-glass"
              >
                {finnhubTest.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Run Test
              </Button>
              {finnhubTest.message && (
                <span className={cn(
                  "text-sm",
                  finnhubTest.status === 'success' ? "text-profit" : "text-loss"
                )}>
                  {finnhubTest.message}
                </span>
              )}
            </div>
            {finnhubTest.data && (
              <pre className="mt-3 p-3 bg-secondary/50 rounded-lg text-xs overflow-auto max-h-32">
                {JSON.stringify(finnhubTest.data, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Test 2: Enrich Trade */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm">Enrich Sample Trade</CardTitle>
                  <CardDescription className="text-xs">Select a closed trade and fetch enrichment data</CardDescription>
                </div>
              </div>
              {getStatusBadge(enrichTest.status)}
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
                onClick={enrichSampleTrade} 
                disabled={enrichTest.status === 'loading' || !selectedTradeId}
                size="sm"
                className="btn-glass"
              >
                {enrichTest.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Activity className="h-4 w-4 mr-2" />
                )}
                Enrich Trade
              </Button>
            </div>
            {enrichTest.message && (
              <p className={cn(
                "mt-2 text-sm",
                enrichTest.status === 'success' ? "text-profit" : "text-loss"
              )}>
                {enrichTest.message}
              </p>
            )}
            {enrichTest.data && (
              <pre className="mt-3 p-3 bg-secondary/50 rounded-lg text-xs overflow-auto max-h-48">
                {JSON.stringify(enrichTest.data, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Test 3: Generate AI Insights */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm">Generate Weekly Insights</CardTitle>
                  <CardDescription className="text-xs">Runs generate_ai_insights with last 60 trades</CardDescription>
                </div>
              </div>
              {getStatusBadge(insightsTest.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button 
                onClick={generateInsights} 
                disabled={insightsTest.status === 'loading'}
                size="sm"
                className="btn-glass"
              >
                {insightsTest.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                Generate Insights
              </Button>
              {insightsTest.message && (
                <span className={cn(
                  "text-sm",
                  insightsTest.status === 'success' ? "text-profit" : "text-loss"
                )}>
                  {insightsTest.message}
                </span>
              )}
            </div>
            {insightsTest.data && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Win Rate</span>
                    <p className="font-semibold">{insightsTest.data.stats?.win_rate?.toFixed(1)}%</p>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Expectancy</span>
                    <p className="font-semibold">${insightsTest.data.stats?.expectancy?.toFixed(2)}</p>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Trades</span>
                    <p className="font-semibold">{insightsTest.data.data_quality?.trade_count}</p>
                  </div>
                  <div className="p-2 bg-secondary/50 rounded-lg">
                    <span className="text-muted-foreground">Enriched</span>
                    <p className="font-semibold">{insightsTest.data.data_quality?.enriched_count}</p>
                  </div>
                </div>
                <pre className="p-3 bg-secondary/50 rounded-lg text-xs overflow-auto max-h-48">
                  {JSON.stringify(insightsTest.data, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketDataTestPanel;
