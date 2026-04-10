import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserFeatures } from '@/hooks/useUserFeatures';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, TrendingUp, TrendingDown, AlertTriangle, 
  Sparkles, Target, Clock, Calendar, Loader2,
  RefreshCw, Coffee, Zap, BookOpen, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TradesAnalyzedSection from './TradesAnalyzedSection';
import { logger } from '@/lib/logger';

interface InsightPayload {
  summary: string;
  edge: {
    title: string;
    why: string;
    action: string;
  };
  leak: {
    title: string;
    why: string;
    action: string;
  };
  timing: {
    best_time: string;
    worst_time: string;
    best_day: string;
    worst_day: string;
  };
  trend_filter: {
    above_sma50_stats: { winRate: number; avgPnl: number; count: number };
    below_sma50_stats: { winRate: number; avgPnl: number; count: number };
    rule_suggestion: string;
  };
  playbook: {
    a_plus_rules: string[];
    avoid_rules: string[];
    focus_next_week: string[];
  };
  data_quality: {
    trade_count: number;
    enriched_count: number;
    warnings: string[];
  };
  stats: {
    win_rate: number;
    avg_win: number;
    avg_loss: number;
    expectancy: number;
    total_pnl: number;
  };
}

interface CachedInsight {
  id: string;
  payload: InsightPayload;
  created_at: string;
}

const AIAnalysisTab: React.FC = () => {
  const { user } = useAuth();
  const { isFeatureEnabled, isLoading: featuresLoading } = useUserFeatures();
  const [insights, setInsights] = useState<InsightPayload | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingCached, setIsLoadingCached] = useState(true);

  const aiEnabled = isFeatureEnabled('ai_analysis');

  // Load cached insights on mount
  useEffect(() => {
    if (!user || !aiEnabled) {
      setIsLoadingCached(false);
      return;
    }

    const loadCachedInsights = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_insights')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setInsights(data.payload as unknown as InsightPayload);
          setLastGenerated(data.created_at);
        }
      } catch (error) {
        logger.error('Error loading cached insights:', error);
      } finally {
        setIsLoadingCached(false);
      }
    };

    loadCachedInsights();
  }, [user, aiEnabled]);

  const generateInsights = useCallback(async () => {
    if (!user) return;
    
    setIsGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://axvogllmehhrnkdgzeoi.supabase.co/functions/v1/generate-ai-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ scope: 'last_60_trades' }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate insights');
      }

      if (data.payload) {
        setInsights(data.payload);
        setLastGenerated(new Date().toISOString());
        toast.success('AI insights generated successfully!');
      } else if (data.error === 'No closed trades found') {
        toast.error('No closed trades found. Close some trades first to generate insights.');
      }
    } catch (error: unknown) {
      logger.error('Error generating insights:', error);
      toast.error(error.message || 'Failed to generate insights');
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

  if (featuresLoading || isLoadingCached) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show "Coming Soon" if feature not enabled
  if (!aiEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <div className="relative animate-pulse">
              <Coffee className="w-24 h-24 text-primary" />
            </div>
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <div 
                className="w-2 h-4 bg-primary/40 rounded-full animate-bounce"
                style={{ animationDelay: '0ms', animationDuration: '1s' }}
              />
              <div 
                className="w-2 h-6 bg-primary/30 rounded-full animate-bounce"
                style={{ animationDelay: '200ms', animationDuration: '1.2s' }}
              />
              <div 
                className="w-2 h-4 bg-primary/40 rounded-full animate-bounce"
                style={{ animationDelay: '400ms', animationDuration: '1s' }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              AI Analysis Brewing Soon ☕
            </h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
              We're perfecting the blend of AI-powered insights to help you analyze your trading patterns and improve your strategy.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-sm text-primary font-medium">Coming Soon</span>
          </div>
        </div>
      </div>
    );
  }

  // Show generate button if no insights yet
  if (!insights) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Generate Your Trading Insights
            </h2>
            <p className="text-muted-foreground">
              Let AI analyze your trades to find your edge, identify leaks, and build a personalized playbook.
            </p>
          </div>
          <Button 
            onClick={generateInsights} 
            disabled={isGenerating}
            size="lg"
            className="bg-primary hover:bg-primary/90"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Analyzing Trades...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate Weekly Review
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Coach Insights
          </h3>
          {lastGenerated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date(lastGenerated).toLocaleDateString()} at {new Date(lastGenerated).toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateInsights}
          disabled={isGenerating}
          className="btn-glass"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Data Quality Warnings */}
      {insights.data_quality.warnings.length > 0 && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-500">Data Quality Notes</p>
              {insights.data_quality.warnings.map((warning, i) => (
                <p key={i} className="text-xs text-muted-foreground">{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="content-card p-4">
        <p className="text-foreground leading-relaxed">{insights.summary}</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {insights.data_quality.trade_count} trades analyzed
          </Badge>
          <Badge variant="outline" className="bg-secondary">
            {insights.data_quality.enriched_count} enriched
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Win Rate</p>
          <p className="text-xl md:text-2xl font-bold text-foreground">{insights.stats.win_rate.toFixed(1)}%</p>
        </div>
        <div className="stat-card">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Avg Win</p>
          <p className="text-xl md:text-2xl font-bold text-profit">+${insights.stats.avg_win.toFixed(0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Avg Loss</p>
          <p className="text-xl md:text-2xl font-bold text-loss">-${Math.abs(insights.stats.avg_loss).toFixed(0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Expectancy</p>
          <p className={cn(
            "text-xl md:text-2xl font-bold",
            insights.stats.expectancy >= 0 ? "text-profit" : "text-loss"
          )}>
            ${insights.stats.expectancy.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Edge & Leak Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Edge Card */}
        <div className="content-card p-4 border-l-4 border-l-profit">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-box-success h-8 w-8">
              <TrendingUp className="h-4 w-4 text-profit" />
            </div>
            <h4 className="font-semibold text-profit">Your Edge</h4>
          </div>
          <h5 className="font-medium text-foreground mb-2">{insights.edge.title}</h5>
          <p className="text-sm text-muted-foreground mb-3">{insights.edge.why}</p>
          <div className="p-3 rounded-lg bg-profit/10 border border-profit/20">
            <p className="text-sm text-profit font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {insights.edge.action}
            </p>
          </div>
        </div>

        {/* Leak Card */}
        <div className="content-card p-4 border-l-4 border-l-loss">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-box-danger h-8 w-8">
              <TrendingDown className="h-4 w-4 text-loss" />
            </div>
            <h4 className="font-semibold text-loss">Your Leak</h4>
          </div>
          <h5 className="font-medium text-foreground mb-2">{insights.leak.title}</h5>
          <p className="text-sm text-muted-foreground mb-3">{insights.leak.why}</p>
          <div className="p-3 rounded-lg bg-loss/10 border border-loss/20">
            <p className="text-sm text-loss font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {insights.leak.action}
            </p>
          </div>
        </div>
      </div>

      {/* Timing Card */}
      <div className="content-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">Timing Insights</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-profit/10 border border-profit/20 text-center">
            <p className="text-xs text-muted-foreground mb-1">Best Time</p>
            <p className="font-semibold text-profit">{insights.timing.best_time}</p>
          </div>
          <div className="p-3 rounded-lg bg-loss/10 border border-loss/20 text-center">
            <p className="text-xs text-muted-foreground mb-1">Worst Time</p>
            <p className="font-semibold text-loss">{insights.timing.worst_time}</p>
          </div>
          <div className="p-3 rounded-lg bg-profit/10 border border-profit/20 text-center">
            <p className="text-xs text-muted-foreground mb-1">Best Day</p>
            <p className="font-semibold text-profit">{insights.timing.best_day}</p>
          </div>
          <div className="p-3 rounded-lg bg-loss/10 border border-loss/20 text-center">
            <p className="text-xs text-muted-foreground mb-1">Worst Day</p>
            <p className="font-semibold text-loss">{insights.timing.worst_day}</p>
          </div>
        </div>
      </div>

      {/* Trend Filter Card */}
      <div className="content-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">Trend Filter Analysis</h4>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-2">Above SMA50 ({insights.trend_filter.above_sma50_stats.count} trades)</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Win Rate</span>
              <span className="font-semibold">{insights.trend_filter.above_sma50_stats.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-foreground">Avg P&L</span>
              <span className={cn(
                "font-semibold",
                insights.trend_filter.above_sma50_stats.avgPnl >= 0 ? "text-profit" : "text-loss"
              )}>
                ${insights.trend_filter.above_sma50_stats.avgPnl.toFixed(0)}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-2">Below SMA50 ({insights.trend_filter.below_sma50_stats.count} trades)</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Win Rate</span>
              <span className="font-semibold">{insights.trend_filter.below_sma50_stats.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-foreground">Avg P&L</span>
              <span className={cn(
                "font-semibold",
                insights.trend_filter.below_sma50_stats.avgPnl >= 0 ? "text-profit" : "text-loss"
              )}>
                ${insights.trend_filter.below_sma50_stats.avgPnl.toFixed(0)}
              </span>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-primary">{insights.trend_filter.rule_suggestion}</p>
        </div>
      </div>

      {/* Playbook Card */}
      <div className="content-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">Your Playbook</h4>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-profit" />
              A+ Setups
            </p>
            <ul className="space-y-2">
              {insights.playbook.a_plus_rules.map((rule, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-profit">✓</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-loss" />
              Avoid
            </p>
            <ul className="space-y-2">
              {insights.playbook.avoid_rules.map((rule, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-loss">✗</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              Focus Next Week
            </p>
            <ul className="space-y-2">
              {insights.playbook.focus_next_week.map((rule, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-primary">→</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Trades Analyzed Section */}
      <TradesAnalyzedSection />
    </div>
  );
};

export default AIAnalysisTab;
