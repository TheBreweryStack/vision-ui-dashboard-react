import React, { useMemo, useState } from "react";
import { useJournalData } from "@/hooks/useJournalData";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIAnalysisTab from "@/components/analytics/AIAnalysisTab";
import { PerformanceBreakdown } from "@/components/analytics/PerformanceBreakdown";
import {
  TrendingUp,
  Target,
  AlertTriangle,
  BarChart3,
  Zap,
  Brain,
  Trophy,
  Flame,
} from "lucide-react";
import {
  format,
  parseISO,
  getDay,
  getHours,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = [
  { label: "9-10 AM", start: 9, end: 10 },
  { label: "10-11 AM", start: 10, end: 11 },
  { label: "11-12 PM", start: 11, end: 12 },
  { label: "12-1 PM", start: 12, end: 13 },
  { label: "1-2 PM", start: 13, end: 14 },
  { label: "2-3 PM", start: 14, end: 15 },
  { label: "3-4 PM", start: 15, end: 16 },
];

const COLORS = {
  profit: "hsl(var(--success))",
  loss: "hsl(var(--destructive))",
};

const getWinRateColor = (winRate: number) => {
  if (winRate >= 60) return "text-profit";
  if (winRate >= 40) return "text-yellow-500";
  return "text-loss";
};

const Analytics: React.FC = () => {
  const { groups, stats: journalStats } = useJournalData();
  const { settings } = useAccountSettings();
  const [mainTab, setMainTab] = useState("performance");

  const trades = useMemo(() => {
    return groups.map(g => ({
      id: g.id,
      ticker: g.ticker,
      trade_type: g.trade_type,
      status: g.status,
      entry_date: g.entry_date,
      exit_date: g.exit_date,
      entry_price: g.avg_entry_price,
      exit_price: g.avg_exit_price,
      quantity: g.opened_qty,
      pnl: g.realized_pnl,
      entry_time: null as string | null,
      strategy: g.strategy,
      notes: g.notes,
      images: g.images,
    }));
  }, [groups]);

  const stats = useMemo(() => {
    const closedTrades = trades.filter(t => t.status === 'closed');
    const winningTrades = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl ?? 0) < 0);
    return {
      totalPnl: journalStats.totalPnl,
      closedTrades: journalStats.totalTrades,
      winRate: journalStats.winRate,
      avgWin: journalStats.avgWin,
      avgLoss: journalStats.avgLoss,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
    };
  }, [trades, journalStats]);

  const pnlOverTime = useMemo(() => {
    const closedTrades = trades.filter((t) => t.status === "closed" && t.exit_date).sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());
    let cumulative = settings?.starting_balance || 0;
    return closedTrades.map((t) => { cumulative += t.pnl || 0; return { date: format(parseISO(t.exit_date!), "MMM d"), pnl: t.pnl || 0, cumulative }; });
  }, [trades, settings]);

  const performanceByDay = useMemo(() => {
    const byDay: { [key: number]: { wins: number; losses: number; pnl: number; trades: number } } = {};
    for (let i = 0; i < 7; i++) byDay[i] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
    trades.filter((t) => t.status === "closed" && t.exit_date).forEach((trade) => {
      const day = getDay(parseISO(trade.exit_date!));
      byDay[day].trades++; byDay[day].pnl += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) byDay[day].wins++; else if ((trade.pnl || 0) < 0) byDay[day].losses++;
    });
    return WEEKDAYS.map((name, i) => ({ day: name, ...byDay[i], winRate: byDay[i].trades > 0 ? (byDay[i].wins / byDay[i].trades) * 100 : 0, avgPnl: byDay[i].trades > 0 ? byDay[i].pnl / byDay[i].trades : 0 }));
  }, [trades]);

  const bestDay = useMemo(() => {
    const daysWithTrades = performanceByDay.filter((d) => d.trades > 0);
    if (daysWithTrades.length === 0) return { day: "N/A", winRate: 0, pnl: 0, trades: 0 };
    const sorted = [...daysWithTrades].sort((a, b) => Math.abs(b.winRate - a.winRate) > 10 ? b.winRate - a.winRate : b.pnl - a.pnl);
    return { day: sorted[0].day, winRate: sorted[0].winRate, pnl: sorted[0].pnl, trades: sorted[0].trades };
  }, [performanceByDay]);

  const worstDay = useMemo(() => {
    const daysWithTrades = performanceByDay.filter((d) => d.trades > 0);
    if (daysWithTrades.length === 0) return { day: "N/A", winRate: 0, pnl: 0, trades: 0 };
    const sorted = [...daysWithTrades].sort((a, b) => Math.abs(a.winRate - b.winRate) > 10 ? a.winRate - b.winRate : a.pnl - b.pnl);
    return { day: sorted[0].day, winRate: sorted[0].winRate, pnl: sorted[0].pnl, trades: sorted[0].trades };
  }, [performanceByDay]);

  const largestTrades = useMemo(() => {
    const closedTrades = trades.filter((t) => t.status === "closed");
    return { largestWin: Math.max(...closedTrades.map((t) => t.pnl || 0), 0), largestLoss: Math.min(...closedTrades.map((t) => t.pnl || 0), 0) };
  }, [trades]);

  const streaks = useMemo(() => {
    const closedTrades = trades.filter((t) => t.status === "closed" && t.exit_date).sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());
    let cW = 0, cL = 0, mW = 0, mL = 0;
    closedTrades.forEach((t) => { if ((t.pnl || 0) > 0) { cW++; cL = 0; mW = Math.max(mW, cW); } else if ((t.pnl || 0) < 0) { cL++; cW = 0; mL = Math.max(mL, cL); } });
    return { maxWinStreak: mW, maxLossStreak: mL, currentWinStreak: cW, currentLossStreak: cL };
  }, [trades]);

  const advancedMetrics = useMemo(() => {
    const wins = trades.filter((t) => t.status === "closed" && (t.pnl || 0) > 0);
    const losses = trades.filter((t) => t.status === "closed" && (t.pnl || 0) < 0);
    const totalWins = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const expectancy = stats.closedTrades > 0 ? stats.totalPnl / stats.closedTrades : 0;
    let maxDD = 0, peak = 0, cumulative = 0;
    trades.filter((t) => t.status === "closed" && t.exit_date).sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime()).forEach((t) => {
      cumulative += t.pnl || 0; peak = Math.max(peak, cumulative);
      maxDD = Math.min(maxDD, ((cumulative - peak) / Math.max(peak, 1)) * 100);
    });
    return { profitFactor, expectancy, maxDrawdown: maxDD };
  }, [trades, stats]);

  const performanceByTime = useMemo(() => {
    return TIME_SLOTS.map((slot) => {
      const slotTrades = trades.filter((t) => { if (!t.entry_time || t.status !== "closed") return false; const hour = parseInt(t.entry_time.split(":")[0]); return hour >= slot.start && hour < slot.end; });
      const pnl = slotTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const wins = slotTrades.filter((t) => (t.pnl || 0) > 0).length;
      return { time: slot.label, pnl, trades: slotTrades.length, winRate: slotTrades.length > 0 ? (wins / slotTrades.length) * 100 : 0 };
    });
  }, [trades]);

  const pnlByTicker = useMemo(() => {
    const byTicker: { [ticker: string]: { pnl: number; trades: number; wins: number } } = {};
    trades.filter((t) => t.status === "closed").forEach((trade) => {
      if (!byTicker[trade.ticker]) byTicker[trade.ticker] = { pnl: 0, trades: 0, wins: 0 };
      byTicker[trade.ticker].pnl += trade.pnl || 0; byTicker[trade.ticker].trades++;
      if ((trade.pnl || 0) > 0) byTicker[trade.ticker].wins++;
    });
    return Object.entries(byTicker).map(([ticker, data]) => ({ ticker, ...data, winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0 })).sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const winLossData = [
    { name: "Wins", value: stats.winningTrades, fill: COLORS.profit },
    { name: "Losses", value: stats.losingTrades, fill: COLORS.loss },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track your performance and improve</p>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="performance" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Performance</TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2"><Brain className="h-4 w-4" />AI Coach</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-6 space-y-6">
          {/* Top Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-5 w-5 text-primary" /><span className="text-xs font-medium text-muted-foreground uppercase">Total P&L</span></div>
              <p className={cn("text-3xl font-bold", stats.totalPnl >= 0 ? "text-profit" : "text-loss")}>{stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.closedTrades} closed trades</p>
            </div>
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2"><Target className="h-5 w-5 text-primary" /><span className="text-xs font-medium text-muted-foreground uppercase">Win Rate</span></div>
              <p className={cn("text-3xl font-bold", getWinRateColor(stats.winRate))}>{stats.winRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.winningTrades}W - {stats.losingTrades}L</p>
            </div>
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2"><Trophy className="h-5 w-5 text-profit" /><span className="text-xs font-medium text-muted-foreground uppercase">Avg Win</span></div>
              <p className="text-3xl font-bold text-profit">+${stats.avgWin.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per winning trade</p>
            </div>
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-5 w-5 text-loss" /><span className="text-xs font-medium text-muted-foreground uppercase">Avg Loss</span></div>
              <p className="text-3xl font-bold text-loss">-${Math.abs(stats.avgLoss).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per losing trade</p>
            </div>
          </div>

          {/* Advanced Metrics */}
          <div className="content-card p-6">
            <div className="flex items-center gap-2 mb-4"><Zap className="h-5 w-5 text-primary" /><h4 className="font-semibold text-foreground">Advanced Metrics</h4></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Profit Factor</p>
                <p className={cn("text-2xl font-bold", advancedMetrics.profitFactor >= 2 ? "text-profit" : advancedMetrics.profitFactor >= 1 ? "text-yellow-500" : "text-loss")}>{advancedMetrics.profitFactor === Infinity ? "∞" : advancedMetrics.profitFactor.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{advancedMetrics.profitFactor >= 2 ? "Excellent" : advancedMetrics.profitFactor >= 1 ? "Good" : "Poor"}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Risk/Reward</p>
                <p className="text-2xl font-bold text-foreground">1:{stats.avgLoss !== 0 ? (stats.avgWin / Math.abs(stats.avgLoss)).toFixed(1) : "0"}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.avgWin / Math.abs(stats.avgLoss) > 1 ? "Reward > Risk" : "Risk > Reward"}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Expectancy</p>
                <p className={cn("text-2xl font-bold", advancedMetrics.expectancy >= 0 ? "text-profit" : "text-loss")}>{advancedMetrics.expectancy >= 0 ? "+" : ""}${advancedMetrics.expectancy.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Per trade</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Max Drawdown</p>
                <p className={cn("text-2xl font-bold", Math.abs(advancedMetrics.maxDrawdown) < 10 ? "text-profit" : "text-loss")}>{advancedMetrics.maxDrawdown.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">{Math.abs(advancedMetrics.maxDrawdown) < 10 ? "Low risk" : "High risk"}</p>
              </div>
            </div>
          </div>

          {/* Performance Breakdown */}
          <PerformanceBreakdown
            trades={trades}
            performanceByDay={performanceByDay}
            performanceByTime={performanceByTime}
            pnlByTicker={pnlByTicker}
            bestDay={bestDay}
            worstDay={worstDay}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="content-card">
              <h3 className="text-base font-semibold text-foreground mb-4">Cumulative P&L</h3>
              {pnlOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={pnlOverTime}>
                    <defs><linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" fill="url(#pnlGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-[250px] text-muted-foreground">No closed trades yet</div>}
            </div>
            <div className="content-card">
              <h3 className="text-base font-semibold text-foreground mb-4">Win/Loss Distribution</h3>
              {stats.closedTrades > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={winLossData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{winLossData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} /></PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex items-center justify-center h-[250px] text-muted-foreground">No closed trades yet</div>}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-profit" /><span className="text-sm text-muted-foreground">Wins ({stats.winningTrades})</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-loss" /><span className="text-sm text-muted-foreground">Losses ({stats.losingTrades})</span></div>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="content-card">
            <h3 className="text-base font-semibold text-foreground mb-4">Additional Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-profit/10 border border-profit/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2"><Flame className="h-4 w-4 text-profit" /><p className="text-xs text-muted-foreground">Win Streak</p></div>
                <p className="text-2xl font-bold text-profit">{streaks.maxWinStreak}</p>
                {streaks.currentWinStreak > 0 && <p className="text-xs text-muted-foreground mt-1">Current: {streaks.currentWinStreak}</p>}
              </div>
              <div className="p-4 rounded-lg bg-loss/10 border border-loss/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-loss" /><p className="text-xs text-muted-foreground">Loss Streak</p></div>
                <p className="text-2xl font-bold text-loss">{streaks.maxLossStreak}</p>
                {streaks.currentLossStreak > 0 && <p className="text-xs text-muted-foreground mt-1">Current: {streaks.currentLossStreak}</p>}
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 text-center">
                <div className="flex items-center justify-center gap-2 mb-2"><Trophy className="h-4 w-4 text-profit" /><p className="text-xs text-muted-foreground">Largest Win</p></div>
                <p className="text-2xl font-bold text-profit">+${largestTrades.largestWin.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 text-center">
                <div className="flex items-center justify-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-loss" /><p className="text-xs text-muted-foreground">Largest Loss</p></div>
                <p className="text-2xl font-bold text-loss">${Math.abs(largestTrades.largestLoss).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-0">
          <AIAnalysisTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
