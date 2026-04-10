import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface TradeWithEnrichment {
  id: string;
  ticker: string;
  entry_date: string;
  entry_time?: string;
  exit_date?: string;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  pnl?: number;
  status: string;
  trade_type: string;
  strategy?: string;
  enrichment?: {
    mfe?: number;
    mae?: number;
    mfe_pct?: number;
    mae_pct?: number;
    sma20_entry?: number;
    sma50_entry?: number;
    above_sma20_entry?: boolean;
    above_sma50_entry?: boolean;
    trend_regime_entry?: string;
    earnings_in_days?: number;
  };
}

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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = ["9-10 AM", "10-11 AM", "11-12 PM", "12-1 PM", "1-2 PM", "2-3 PM", "3-4 PM"];

function getTimeSlot(hour: number): string {
  if (hour >= 9 && hour < 10) return "9-10 AM";
  if (hour >= 10 && hour < 11) return "10-11 AM";
  if (hour >= 11 && hour < 12) return "11-12 PM";
  if (hour >= 12 && hour < 13) return "12-1 PM";
  if (hour >= 13 && hour < 14) return "1-2 PM";
  if (hour >= 14 && hour < 15) return "2-3 PM";
  if (hour >= 15 && hour < 16) return "3-4 PM";
  return "Other";
}

function calculateStats(trades: TradeWithEnrichment[]) {
  const closedTrades = trades.filter(t => t.status === "closed" && t.pnl !== null && t.pnl !== undefined);
  
  if (closedTrades.length === 0) {
    return { winRate: 0, avgWin: 0, avgLoss: 0, expectancy: 0, totalPnl: 0, count: 0 };
  }

  const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl || 0) < 0);
  
  const winRate = (wins.length / closedTrades.length) * 100;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length : 0;
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  
  // Expectancy = (Win% × Avg Win) + (Loss% × Avg Loss)
  const expectancy = (winRate / 100 * avgWin) + ((100 - winRate) / 100 * avgLoss);

  return { winRate, avgWin, avgLoss, expectancy, totalPnl, count: closedTrades.length };
}

function analyzeByDayOfWeek(trades: TradeWithEnrichment[]) {
  const byDay: Record<string, { pnl: number; count: number; wins: number }> = {};
  WEEKDAYS.forEach(day => byDay[day] = { pnl: 0, count: 0, wins: 0 });

  trades.filter(t => t.status === "closed").forEach(trade => {
    const date = new Date(trade.entry_date);
    const day = WEEKDAYS[date.getDay()];
    byDay[day].pnl += trade.pnl || 0;
    byDay[day].count++;
    if ((trade.pnl || 0) > 0) byDay[day].wins++;
  });

  const sorted = Object.entries(byDay)
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].pnl - a[1].pnl);

  return {
    best: sorted[0]?.[0] || "N/A",
    worst: sorted[sorted.length - 1]?.[0] || "N/A",
    details: byDay,
  };
}

function analyzeByTimeOfDay(trades: TradeWithEnrichment[]) {
  const byTime: Record<string, { pnl: number; count: number; wins: number }> = {};
  TIME_SLOTS.forEach(slot => byTime[slot] = { pnl: 0, count: 0, wins: 0 });

  trades.filter(t => t.status === "closed" && t.entry_time).forEach(trade => {
    const hour = parseInt(trade.entry_time!.split(":")[0]);
    const slot = getTimeSlot(hour);
    if (byTime[slot]) {
      byTime[slot].pnl += trade.pnl || 0;
      byTime[slot].count++;
      if ((trade.pnl || 0) > 0) byTime[slot].wins++;
    }
  });

  const sorted = Object.entries(byTime)
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].pnl - a[1].pnl);

  return {
    best: sorted[0]?.[0] || "N/A",
    worst: sorted[sorted.length - 1]?.[0] || "N/A",
    details: byTime,
  };
}

function analyzeByStrategy(trades: TradeWithEnrichment[]) {
  const byStrategy: Record<string, { pnl: number; count: number; wins: number }> = {};

  trades.filter(t => t.status === "closed" && t.strategy).forEach(trade => {
    const strategy = trade.strategy || "No Strategy";
    if (!byStrategy[strategy]) {
      byStrategy[strategy] = { pnl: 0, count: 0, wins: 0 };
    }
    byStrategy[strategy].pnl += trade.pnl || 0;
    byStrategy[strategy].count++;
    if ((trade.pnl || 0) > 0) byStrategy[strategy].wins++;
  });

  const sorted = Object.entries(byStrategy)
    .sort((a, b) => b[1].pnl - a[1].pnl);

  return {
    best: sorted[0]?.[0] || "N/A",
    worst: sorted[sorted.length - 1]?.[0] || "N/A",
    details: byStrategy,
  };
}

function analyzeTrendFilter(trades: TradeWithEnrichment[]) {
  const aboveSMA50: TradeWithEnrichment[] = [];
  const belowSMA50: TradeWithEnrichment[] = [];

  // FIXED: Only count trades where above_sma50_entry IS NOT NULL
  trades.filter(t => t.status === "closed" && t.enrichment && t.enrichment.above_sma50_entry !== null && t.enrichment.above_sma50_entry !== undefined).forEach(trade => {
    if (trade.enrichment?.above_sma50_entry === true) {
      aboveSMA50.push(trade);
    } else if (trade.enrichment?.above_sma50_entry === false) {
      belowSMA50.push(trade);
    }
  });

  const aboveStats = calculateStats(aboveSMA50);
  const belowStats = calculateStats(belowSMA50);

  let ruleSuggestion = "Not enough data to suggest a trend filter rule.";
  
  if (aboveStats.count >= 5 && belowStats.count >= 5) {
    if (aboveStats.winRate > belowStats.winRate + 10 && aboveStats.expectancy > belowStats.expectancy) {
      ruleSuggestion = "Consider focusing on trades when price is ABOVE SMA50 - your win rate and expectancy are significantly better.";
    } else if (belowStats.winRate > aboveStats.winRate + 10 && belowStats.expectancy > aboveStats.expectancy) {
      ruleSuggestion = "Consider focusing on trades when price is BELOW SMA50 - your performance is better in bearish conditions.";
    } else {
      ruleSuggestion = "Your performance is similar in both trend regimes. No strong edge detected from trend filtering.";
    }
  }

  return {
    above_sma50_stats: { 
      winRate: aboveStats.winRate, 
      avgPnl: aboveStats.count > 0 ? aboveStats.totalPnl / aboveStats.count : 0,
      count: aboveStats.count 
    },
    below_sma50_stats: { 
      winRate: belowStats.winRate, 
      avgPnl: belowStats.count > 0 ? belowStats.totalPnl / belowStats.count : 0,
      count: belowStats.count 
    },
    rule_suggestion: ruleSuggestion,
  };
}

function findBiggestLeak(trades: TradeWithEnrichment[], dayAnalysis: any, timeAnalysis: any, strategyAnalysis: any) {
  // Find the category with most negative expectancy * volume
  const leaks: { category: string; title: string; why: string; action: string; impact: number }[] = [];

  // Check days
  Object.entries(dayAnalysis.details).forEach(([day, data]: [string, any]) => {
    if (data.count >= 3 && data.pnl < 0) {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      leaks.push({
        category: "day",
        title: `${day} Trading`,
        why: `You've lost $${Math.abs(data.pnl).toFixed(0)} over ${data.count} trades on ${day}s with a ${winRate.toFixed(0)}% win rate.`,
        action: `Consider avoiding or reducing position size on ${day}s.`,
        impact: Math.abs(data.pnl),
      });
    }
  });

  // Check times
  Object.entries(timeAnalysis.details).forEach(([time, data]: [string, any]) => {
    if (data.count >= 3 && data.pnl < 0) {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      leaks.push({
        category: "time",
        title: `${time} Entries`,
        why: `${time} entries have cost you $${Math.abs(data.pnl).toFixed(0)} over ${data.count} trades with ${winRate.toFixed(0)}% win rate.`,
        action: `Wait for better setups or avoid trading during ${time}.`,
        impact: Math.abs(data.pnl),
      });
    }
  });

  // Check strategies
  Object.entries(strategyAnalysis.details).forEach(([strategy, data]: [string, any]) => {
    if (data.count >= 3 && data.pnl < 0) {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      leaks.push({
        category: "strategy",
        title: `${strategy} Strategy`,
        why: `The ${strategy} strategy has lost $${Math.abs(data.pnl).toFixed(0)} over ${data.count} trades (${winRate.toFixed(0)}% win rate).`,
        action: `Review and refine this strategy or consider removing it from your playbook.`,
        impact: Math.abs(data.pnl),
      });
    }
  });

  // Sort by impact and return worst
  leaks.sort((a, b) => b.impact - a.impact);
  
  if (leaks.length > 0) {
    return leaks[0];
  }

  return {
    title: "No Major Leaks Detected",
    why: "Your trading patterns don't show obvious losing patterns.",
    action: "Keep monitoring and journaling to catch emerging patterns.",
  };
}

function findEdge(trades: TradeWithEnrichment[], dayAnalysis: any, timeAnalysis: any, strategyAnalysis: any) {
  const edges: { title: string; why: string; action: string; impact: number }[] = [];

  // Check days
  Object.entries(dayAnalysis.details).forEach(([day, data]: [string, any]) => {
    if (data.count >= 3 && data.pnl > 0) {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      if (winRate >= 60) {
        edges.push({
          title: `${day} Trading Edge`,
          why: `You've made $${data.pnl.toFixed(0)} over ${data.count} trades on ${day}s with ${winRate.toFixed(0)}% win rate.`,
          action: `Consider increasing position size or taking more setups on ${day}s.`,
          impact: data.pnl,
        });
      }
    }
  });

  // Check times
  Object.entries(timeAnalysis.details).forEach(([time, data]: [string, any]) => {
    if (data.count >= 3 && data.pnl > 0) {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      if (winRate >= 60) {
        edges.push({
          title: `${time} Entry Edge`,
          why: `${time} entries have made you $${data.pnl.toFixed(0)} over ${data.count} trades (${winRate.toFixed(0)}% win rate).`,
          action: `Prioritize entries during ${time} for better results.`,
          impact: data.pnl,
        });
      }
    }
  });

  // Check strategies
  Object.entries(strategyAnalysis.details).forEach(([strategy, data]: [string, any]) => {
    if (data.count >= 3 && data.pnl > 0) {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      if (winRate >= 55) {
        edges.push({
          title: `${strategy} Strategy Edge`,
          why: `The ${strategy} strategy has made $${data.pnl.toFixed(0)} over ${data.count} trades (${winRate.toFixed(0)}% win rate).`,
          action: `Focus more on ${strategy} setups - this is working well for you.`,
          impact: data.pnl,
        });
      }
    }
  });

  edges.sort((a, b) => b.impact - a.impact);
  
  if (edges.length > 0) {
    return edges[0];
  }

  return {
    title: "Building Your Edge",
    why: "Not enough consistent winning patterns detected yet.",
    action: "Continue journaling to identify what works best for you.",
  };
}

function generatePlaybook(edge: any, leak: any, trendFilter: any, stats: any) {
  const aPlusRules: string[] = [];
  const avoidRules: string[] = [];
  const focusNextWeek: string[] = [];

  // Add edge-based rules
  if (edge.title !== "Building Your Edge") {
    aPlusRules.push(edge.action);
  }

  // Add leak-based rules
  if (leak.title !== "No Major Leaks Detected") {
    avoidRules.push(leak.action);
  }

  // Add trend filter rules
  if (trendFilter.rule_suggestion && !trendFilter.rule_suggestion.includes("Not enough data")) {
    if (trendFilter.rule_suggestion.includes("ABOVE")) {
      aPlusRules.push("Only trade when ticker is above its 50-day moving average.");
    } else if (trendFilter.rule_suggestion.includes("BELOW")) {
      aPlusRules.push("Consider contrarian plays when price is below SMA50.");
    }
  }

  // General rules based on stats
  if (stats.winRate < 50) {
    focusNextWeek.push("Focus on trade quality over quantity - be more selective.");
  }
  if (stats.avgLoss !== 0 && Math.abs(stats.avgWin / stats.avgLoss) < 1.5) {
    focusNextWeek.push("Work on letting winners run - your risk:reward could improve.");
  }

  // Ensure we have at least one item in each
  if (aPlusRules.length === 0) aPlusRules.push("Keep journaling to discover your edge.");
  if (avoidRules.length === 0) avoidRules.push("No clear patterns to avoid yet.");
  if (focusNextWeek.length === 0) focusNextWeek.push("Review your best trades and identify common setups.");

  return { a_plus_rules: aPlusRules, avoid_rules: avoidRules, focus_next_week: focusNextWeek };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scope, time_start, time_end, last_n_trades } = await req.json();

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get the authorization header to verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating AI insights for user ${user.id}, scope: ${scope}`);

    // Build query for trades
    let tradesQuery = supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .order("exit_date", { ascending: false });

    if (time_start) {
      tradesQuery = tradesQuery.gte("exit_date", time_start);
    }
    if (time_end) {
      tradesQuery = tradesQuery.lte("exit_date", time_end);
    }
    if (last_n_trades) {
      tradesQuery = tradesQuery.limit(last_n_trades);
    }

    const { data: trades, error: tradesError } = await tradesQuery;

    if (tradesError) {
      console.error("Error fetching trades:", tradesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch trades" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!trades || trades.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No closed trades found",
          payload: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch enrichment data for trades
    const tradeIds = trades.map(t => t.id);
    const { data: enrichments } = await supabase
      .from("trade_enrichment")
      .select("*")
      .in("trade_id", tradeIds);

    // Merge enrichment data with trades
    const tradesWithEnrichment: TradeWithEnrichment[] = trades.map(trade => ({
      ...trade,
      enrichment: enrichments?.find(e => e.trade_id === trade.id),
    }));

    // Calculate insights
    const stats = calculateStats(tradesWithEnrichment);
    const dayAnalysis = analyzeByDayOfWeek(tradesWithEnrichment);
    const timeAnalysis = analyzeByTimeOfDay(tradesWithEnrichment);
    const strategyAnalysis = analyzeByStrategy(tradesWithEnrichment);
    const trendFilter = analyzeTrendFilter(tradesWithEnrichment);
    
    const leak = findBiggestLeak(tradesWithEnrichment, dayAnalysis, timeAnalysis, strategyAnalysis);
    const edge = findEdge(tradesWithEnrichment, dayAnalysis, timeAnalysis, strategyAnalysis);
    const playbook = generatePlaybook(edge, leak, trendFilter, stats);

    // Data quality warnings
    const warnings: string[] = [];
    const enrichedCount = tradesWithEnrichment.filter(t => t.enrichment).length;
    
    if (trades.length < 10) {
      warnings.push("Less than 10 trades - insights may not be statistically significant.");
    }
    if (enrichedCount < trades.length * 0.5) {
      warnings.push("Less than 50% of trades have enrichment data. Run enrichment for more accurate trend insights.");
    }
    const tradesWithTime = trades.filter(t => t.entry_time);
    if (tradesWithTime.length < trades.length * 0.5) {
      warnings.push("Many trades are missing entry time - time-based analysis may be incomplete.");
    }

    // Build summary
    let summary = `Over ${trades.length} trades, you have a ${stats.winRate.toFixed(1)}% win rate with $${stats.totalPnl.toFixed(0)} total P&L. `;
    if (stats.expectancy > 0) {
      summary += `Your expectancy is positive at $${stats.expectancy.toFixed(2)} per trade.`;
    } else {
      summary += `Your expectancy is negative at $${stats.expectancy.toFixed(2)} per trade - focus on improving your edge.`;
    }

    const payload: InsightPayload = {
      summary,
      edge: {
        title: edge.title,
        why: edge.why,
        action: edge.action,
      },
      leak: {
        title: leak.title,
        why: leak.why,
        action: leak.action,
      },
      timing: {
        best_time: timeAnalysis.best,
        worst_time: timeAnalysis.worst,
        best_day: dayAnalysis.best,
        worst_day: dayAnalysis.worst,
      },
      trend_filter: trendFilter,
      playbook,
      data_quality: {
        trade_count: trades.length,
        enriched_count: enrichedCount,
        warnings,
      },
      stats: {
        win_rate: stats.winRate,
        avg_win: stats.avgWin,
        avg_loss: stats.avgLoss,
        expectancy: stats.expectancy,
        total_pnl: stats.totalPnl,
      },
    };

    // Cache the insights
    const { data: insight, error: insertError } = await supabase
      .from("ai_insights")
      .insert({
        user_id: user.id,
        scope: scope || "last_60_trades",
        time_start: time_start || null,
        time_end: time_end || null,
        payload,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error caching insights:", insertError);
      // Continue anyway - caching failure shouldn't break the response
    }

    console.log(`Successfully generated insights for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, payload, insight_id: insight?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-ai-insights:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
