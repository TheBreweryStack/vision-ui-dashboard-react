import React, { useMemo, useState } from "react";
import { useJournalData } from "@/hooks/useJournalData";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TickerLogo } from "@/components/common/TickerLogo";
import AIAnalysisTab from "@/components/analytics/AIAnalysisTab";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Clock,
  Award,
  AlertTriangle,
  BarChart3,
  Zap,
  Brain,
  Activity,
  Scale,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Flame,
} from "lucide-react";
import {
  format,
  parseISO,
  getDay,
  getHours,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  subMonths,
  getYear,
  getMonth,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
  primary: "hsl(var(--primary))",
  muted: "hsl(var(--muted-foreground))",
};

const Analytics: React.FC = () => {
  const { groups, stats: journalStats } = useJournalData();
  const { settings } = useAccountSettings();
  const [activeTab, setActiveTab] = useState("day");
  const [mainTab, setMainTab] = useState("performance");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  
  // Convert trade_groups to a compatible format for existing calculations
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
      entry_time: null as string | null, // trade_groups don't have time
      strategy: g.strategy,
      notes: g.notes,
      images: g.images,
    }));
  }, [groups]);
  
  // Compute stats compatible with the old useTrades hook format
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

  // Calculate P&L over time (cumulative)
  const pnlOverTime = useMemo(() => {
    const closedTrades = trades
      .filter((t) => t.status === "closed" && t.exit_date)
      .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());

    let cumulative = settings?.starting_balance || 0;
    return closedTrades.map((t) => {
      cumulative += t.pnl || 0;
      return {
        date: format(parseISO(t.exit_date!), "MMM d"),
        pnl: t.pnl || 0,
        cumulative,
      };
    });
  }, [trades, settings]);

  // Performance by day of week - IMPROVED with win rate
  const performanceByDay = useMemo(() => {
    const byDay: { [key: number]: { wins: number; losses: number; pnl: number; trades: number } } = {};

    for (let i = 0; i < 7; i++) {
      byDay[i] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
    }

    trades
      .filter((t) => t.status === "closed" && t.exit_date)
      .forEach((trade) => {
        const day = getDay(parseISO(trade.exit_date!));
        byDay[day].trades++;
        byDay[day].pnl += trade.pnl || 0;
        if ((trade.pnl || 0) > 0) byDay[day].wins++;
        else if ((trade.pnl || 0) < 0) byDay[day].losses++;
      });

    return WEEKDAYS.map((name, i) => ({
      day: name,
      ...byDay[i],
      winRate: byDay[i].trades > 0 ? (byDay[i].wins / byDay[i].trades) * 100 : 0,
      avgPnl: byDay[i].trades > 0 ? byDay[i].pnl / byDay[i].trades : 0,
    }));
  }, [trades]);

  // FIXED: Best day - prioritize win rate AND positive P&L
  const bestDay = useMemo(() => {
    const daysWithTrades = performanceByDay.filter((d) => d.trades > 0);
    if (daysWithTrades.length === 0) return { day: "N/A", winRate: 0, pnl: 0 };

    // Sort by: 1) Win rate first, 2) Total P&L second
    const sorted = [...daysWithTrades].sort((a, b) => {
      // Prioritize win rate
      if (Math.abs(b.winRate - a.winRate) > 10) {
        return b.winRate - a.winRate;
      }
      // If win rates are similar (within 10%), use P&L
      return b.pnl - a.pnl;
    });

    const best = sorted[0];
    return {
      day: best.day,
      winRate: best.winRate,
      pnl: best.pnl,
      trades: best.trades,
    };
  }, [performanceByDay]);

  // FIXED: Worst day - prioritize low win rate AND negative P&L
  const worstDay = useMemo(() => {
    const daysWithTrades = performanceByDay.filter((d) => d.trades > 0);
    if (daysWithTrades.length === 0) return { day: "N/A", winRate: 0, pnl: 0 };

    // Sort by: 1) Win rate first (ascending), 2) P&L second (ascending)
    const sorted = [...daysWithTrades].sort((a, b) => {
      // Prioritize low win rate
      if (Math.abs(a.winRate - b.winRate) > 10) {
        return a.winRate - b.winRate;
      }
      // If win rates are similar, use P&L
      return a.pnl - b.pnl;
    });

    const worst = sorted[0];
    return {
      day: worst.day,
      winRate: worst.winRate,
      pnl: worst.pnl,
      trades: worst.trades,
    };
  }, [performanceByDay]);

  // Calculate largest win and loss
  const largestTrades = useMemo(() => {
    const closedTrades = trades.filter((t) => t.status === "closed");
    const largestWin = Math.max(...closedTrades.map((t) => t.pnl || 0), 0);
    const largestLoss = Math.min(...closedTrades.map((t) => t.pnl || 0), 0);

    return { largestWin, largestLoss };
  }, [trades]);

  // Calculate streaks
  const streaks = useMemo(() => {
    const closedTrades = trades
      .filter((t) => t.status === "closed" && t.exit_date)
      .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());

    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    closedTrades.forEach((trade) => {
      if ((trade.pnl || 0) > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else if ((trade.pnl || 0) < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    });

    return { maxWinStreak, maxLossStreak, currentWinStreak, currentLossStreak };
  }, [trades]);

  // Advanced metrics
  const advancedMetrics = useMemo(() => {
    const wins = trades.filter((t) => t.status === "closed" && (t.pnl || 0) > 0);
    const losses = trades.filter((t) => t.status === "closed" && (t.pnl || 0) < 0);

    const totalWins = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const expectancy = stats.closedTrades > 0 ? stats.totalPnl / stats.closedTrades : 0;

    // Calculate max drawdown
    let maxDD = 0;
    let peak = 0;
    let cumulative = 0;

    trades
      .filter((t) => t.status === "closed" && t.exit_date)
      .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime())
      .forEach((trade) => {
        cumulative += trade.pnl || 0;
        peak = Math.max(peak, cumulative);
        const drawdown = ((cumulative - peak) / Math.max(peak, 1)) * 100;
        maxDD = Math.min(maxDD, drawdown);
      });

    return {
      profitFactor,
      expectancy,
      maxDrawdown: maxDD,
    };
  }, [trades, stats]);

  // Performance by time of day
  const performanceByTime = useMemo(() => {
    return TIME_SLOTS.map((slot) => {
      const slotTrades = trades.filter((t) => {
        if (!t.entry_time || t.status !== "closed") return false;
        const hour = parseInt(t.entry_time.split(":")[0]);
        return hour >= slot.start && hour < slot.end;
      });

      const pnl = slotTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const wins = slotTrades.filter((t) => (t.pnl || 0) > 0).length;

      return {
        time: slot.label,
        pnl,
        trades: slotTrades.length,
        winRate: slotTrades.length > 0 ? (wins / slotTrades.length) * 100 : 0,
      };
    });
  }, [trades]);

  // P&L by ticker
  const pnlByTicker = useMemo(() => {
    const byTicker: { [ticker: string]: { pnl: number; trades: number; wins: number } } = {};

    trades
      .filter((t) => t.status === "closed")
      .forEach((trade) => {
        if (!byTicker[trade.ticker]) {
          byTicker[trade.ticker] = { pnl: 0, trades: 0, wins: 0 };
        }
        byTicker[trade.ticker].pnl += trade.pnl || 0;
        byTicker[trade.ticker].trades++;
        if ((trade.pnl || 0) > 0) byTicker[trade.ticker].wins++;
      });

    return Object.entries(byTicker)
      .map(([ticker, data]) => ({
        ticker,
        ...data,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  // Weekly/Monthly performance
  const weeklyPerformance = useMemo(() => {
    const last8Weeks = eachWeekOfInterval({
      start: subMonths(new Date(), 2),
      end: new Date(),
    });

    return last8Weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekTrades = trades.filter((t) => {
        if (t.status !== "closed" || !t.exit_date) return false;
        const exitDate = parseISO(t.exit_date);
        return exitDate >= weekStart && exitDate <= weekEnd;
      });

      const pnl = weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      return {
        week: format(weekStart, "MMM d"),
        pnl,
        trades: weekTrades.length,
      };
    });
  }, [trades]);

  // Yearly performance by month
  const yearlyPerformance = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);

      const monthTrades = trades.filter((t) => {
        if (t.status !== "closed" || !t.exit_date) return false;
        const exitDate = parseISO(t.exit_date);
        return exitDate >= monthStart && exitDate <= monthEnd;
      });

      const pnl = monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const wins = monthTrades.filter((t) => (t.pnl || 0) > 0).length;

      return {
        month: MONTHS[getMonth(monthStart)],
        monthIndex: getMonth(monthStart),
        pnl,
        trades: monthTrades.length,
        winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0,
      };
    });
  }, [trades, selectedYear]);

  // Get trades for selected month
  const selectedMonthTrades = useMemo(() => {
    if (selectedMonth === null) return [];

    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth, 1));
    const monthEnd = endOfMonth(monthStart);

    return trades
      .filter((t) => {
        if (t.status !== "closed" || !t.exit_date) return false;
        const exitDate = parseISO(t.exit_date);
        return exitDate >= monthStart && exitDate <= monthEnd;
      })
      .sort((a, b) => new Date(b.exit_date!).getTime() - new Date(a.exit_date!).getTime());
  }, [trades, selectedYear, selectedMonth]);

  // Win/Loss data for pie chart
  const winLossData = [
    { name: "Wins", value: stats.winningTrades, fill: COLORS.profit },
    { name: "Losses", value: stats.losingTrades, fill: COLORS.loss },
  ];

  // Helper function to get win rate color
  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return "text-profit";
    if (winRate >= 40) return "text-yellow-500";
    return "text-loss";
  };

  const getWinRateBgColor = (winRate: number) => {
    if (winRate >= 60) return "bg-profit/10 border-profit/20";
    if (winRate >= 40) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-loss/10 border-loss/20";
  };

  // Component for day card with win rate
  const DayCard: React.FC<{ data: (typeof performanceByDay)[0] }> = ({ data }) => {
    const winRateColor = getWinRateColor(data.winRate);
    const bgColor = getWinRateBgColor(data.winRate);

    return (
      <div className={cn("p-4 rounded-lg border transition-all", bgColor)}>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground mb-1">{data.day}</p>
          <p className={cn("text-xl font-bold mb-1", data.pnl >= 0 ? "text-profit" : "text-loss")}>
            {data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(0)}
          </p>
          {/* WIN RATE - NEW */}
          <p className={cn("text-sm font-semibold mb-1", winRateColor)}>{data.winRate.toFixed(0)}% win</p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>{data.trades} trades</span>
            <span>•</span>
            <span>
              {data.wins}W-{data.losses}L
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Component for month card
  const MonthCard: React.FC<{ data: (typeof yearlyPerformance)[0]; onClick: () => void }> = ({ data, onClick }) => {
    return (
      <button
        onClick={onClick}
        className={cn(
          "p-3 rounded-lg border transition-all hover:scale-105",
          data.pnl >= 0 ? "bg-profit/10 border-profit/20" : "bg-loss/10 border-loss/20",
          data.trades === 0 && "opacity-40",
        )}
      >
        <p className="text-xs font-medium text-muted-foreground mb-1">{data.month}</p>
        <p className={cn("text-lg font-bold", data.pnl >= 0 ? "text-profit" : "text-loss")}>
          {data.pnl >= 0 ? "+" : ""}${Math.abs(data.pnl).toFixed(0)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{data.trades} trades</p>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track your performance and improve</p>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Coach
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab Content */}
        <TabsContent value="performance" className="mt-6 space-y-6">
          {/* IMPROVED: Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total P&L */}
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Total P&L</span>
              </div>
              <p className={cn("text-3xl font-bold", stats.totalPnl >= 0 ? "text-profit" : "text-loss")}>
                {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.closedTrades} closed trades</p>
            </div>

            {/* Win Rate */}
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Win Rate</span>
              </div>
              <p className={cn("text-3xl font-bold", getWinRateColor(stats.winRate))}>{stats.winRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.winningTrades}W - {stats.losingTrades}L
              </p>
            </div>

            {/* Avg Win - MOVED UP */}
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-profit" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Avg Win</span>
              </div>
              <p className="text-3xl font-bold text-profit">+${stats.avgWin.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per winning trade</p>
            </div>

            {/* Avg Loss - MOVED UP */}
            <div className="content-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-loss" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Avg Loss</span>
              </div>
              <p className="text-3xl font-bold text-loss">-${Math.abs(stats.avgLoss).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per losing trade</p>
            </div>
          </div>

          {/* Advanced Metrics */}
          <div className="content-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">Advanced Metrics</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Profit Factor */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Profit Factor</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    advancedMetrics.profitFactor >= 2
                      ? "text-profit"
                      : advancedMetrics.profitFactor >= 1
                        ? "text-yellow-500"
                        : "text-loss",
                  )}
                >
                  {advancedMetrics.profitFactor === Infinity ? "∞" : advancedMetrics.profitFactor.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {advancedMetrics.profitFactor >= 2
                    ? "Excellent"
                    : advancedMetrics.profitFactor >= 1
                      ? "Good"
                      : "Poor"}
                </p>
              </div>

              {/* Risk/Reward */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Risk/Reward</p>
                <p className="text-2xl font-bold text-foreground">
                  1:{stats.avgLoss !== 0 ? (stats.avgWin / Math.abs(stats.avgLoss)).toFixed(1) : "0"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.avgWin / Math.abs(stats.avgLoss) > 1 ? "Reward > Risk" : "Risk > Reward"}
                </p>
              </div>

              {/* Expectancy */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Expectancy</p>
                <p className={cn("text-2xl font-bold", advancedMetrics.expectancy >= 0 ? "text-profit" : "text-loss")}>
                  {advancedMetrics.expectancy >= 0 ? "+" : ""}${advancedMetrics.expectancy.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Per trade</p>
              </div>

              {/* Max Drawdown */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Max Drawdown</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    Math.abs(advancedMetrics.maxDrawdown) < 10 ? "text-profit" : "text-loss",
                  )}
                >
                  {advancedMetrics.maxDrawdown.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.abs(advancedMetrics.maxDrawdown) < 10 ? "Low risk" : "High risk"}
                </p>
              </div>
            </div>
          </div>

          {/* Performance Breakdown Tabs */}
          <div className="content-card p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="day">By Day</TabsTrigger>
                <TabsTrigger value="time">By Time</TabsTrigger>
                <TabsTrigger value="ticker">By Ticker</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>

              {/* By Day Tab */}
              <TabsContent value="day" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Performance by Day of Week</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    See which days you trade best (based on win rate and P&L)
                  </p>

                  {/* IMPROVED: Best/Worst Day Summary */}
                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="h-4 w-4 text-profit" />
                        <p className="text-sm font-medium text-muted-foreground">Best Day</p>
                      </div>
                      <p className="text-2xl font-bold text-profit mb-1">{bestDay.day}</p>
                      <p className={cn("text-sm font-semibold mb-1", getWinRateColor(bestDay.winRate))}>
                        {bestDay.winRate.toFixed(0)}% win rate
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {bestDay.pnl >= 0 ? "+" : ""}${bestDay.pnl.toFixed(0)} total • {bestDay.trades} trades
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-loss" />
                        <p className="text-sm font-medium text-muted-foreground">Worst Day</p>
                      </div>
                      <p className="text-2xl font-bold text-loss mb-1">{worstDay.day}</p>
                      <p className={cn("text-sm font-semibold mb-1", getWinRateColor(worstDay.winRate))}>
                        {worstDay.winRate.toFixed(0)}% win rate
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {worstDay.pnl >= 0 ? "+" : ""}${worstDay.pnl.toFixed(0)} total • {worstDay.trades} trades
                      </p>
                    </div>
                  </div>

                  {/* Day Cards with Win Rate */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {performanceByDay.map((day) => (
                      <DayCard key={day.day} data={day} />
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* By Time Tab */}
              <TabsContent value="time" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Performance by Time of Day</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                    {performanceByTime.map((slot) => (
                      <div
                        key={slot.time}
                        className={cn(
                          "p-3 rounded-lg border",
                          slot.pnl >= 0 ? "bg-profit/10 border-profit/20" : "bg-loss/10 border-loss/20",
                          slot.trades === 0 && "opacity-40",
                        )}
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-1">{slot.time}</p>
                        <p className={cn("text-lg font-bold", slot.pnl >= 0 ? "text-profit" : "text-loss")}>
                          {slot.pnl >= 0 ? "+" : ""}${slot.pnl.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {slot.trades} trades • {slot.winRate.toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* By Ticker Tab */}
              <TabsContent value="ticker" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Performance by Ticker</h3>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {pnlByTicker.length > 0 ? (
                      pnlByTicker.map((ticker) => (
                        <div
                          key={ticker.ticker}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                        >
                          <div className="flex items-center gap-3">
                            <TickerLogo symbol={ticker.ticker} size="sm" />
                            <div>
                              <p className="font-medium text-foreground">{ticker.ticker}</p>
                              <p className="text-xs text-muted-foreground">
                                {ticker.trades} trades • {ticker.winRate.toFixed(0)}% win
                              </p>
                            </div>
                          </div>
                          <p className={cn("font-bold text-lg", ticker.pnl >= 0 ? "text-profit" : "text-loss")}>
                            {ticker.pnl >= 0 ? "+" : ""}${ticker.pnl.toFixed(0)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No closed trades yet</div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Weekly Tab */}
              <TabsContent value="weekly" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Weekly Performance</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={weeklyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="pnl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* Yearly Tab */}
              <TabsContent value="yearly" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h3 className="text-base font-semibold text-foreground">P&L Calendar</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedYear((prev) => prev - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-semibold text-foreground min-w-[80px] text-center">{selectedYear}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedYear((prev) => prev + 1)}
                        disabled={selectedYear >= new Date().getFullYear()}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {selectedMonth !== null ? (
                    /* Month detail view */
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null)}>
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Back to Year
                        </Button>
                        <h4 className="text-lg font-semibold">
                          {MONTHS[selectedMonth]} {selectedYear}
                        </h4>
                      </div>

                      <div
                        className={cn(
                          "p-4 rounded-lg border text-center",
                          yearlyPerformance[selectedMonth].pnl >= 0
                            ? "bg-profit/5 border-profit/20"
                            : "bg-loss/5 border-loss/20",
                        )}
                      >
                        <p className="text-xs text-muted-foreground mb-1">Monthly P&L</p>
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            yearlyPerformance[selectedMonth].pnl >= 0 ? "text-profit" : "text-loss",
                          )}
                        >
                          {yearlyPerformance[selectedMonth].pnl >= 0 ? "+" : ""}$
                          {Math.abs(yearlyPerformance[selectedMonth].pnl).toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {yearlyPerformance[selectedMonth].trades} trades •{" "}
                          {yearlyPerformance[selectedMonth].winRate.toFixed(0)}% win rate
                        </p>
                      </div>

                      {/* Trade list for the month */}
                      {selectedMonthTrades.length > 0 ? (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                          {selectedMonthTrades.map((trade) => (
                            <div
                              key={trade.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                            >
                              <div className="flex items-center gap-3">
                                <TickerLogo symbol={trade.ticker} size="sm" />
                                <div>
                                  <p className="font-medium text-foreground text-sm">{trade.ticker}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {trade.exit_date ? format(parseISO(trade.exit_date), "MMM d") : "Open"}
                                  </p>
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "font-semibold text-sm",
                                  (trade.pnl || 0) >= 0 ? "text-profit" : "text-loss",
                                )}
                              >
                                {(trade.pnl || 0) >= 0 ? "+" : ""}${Math.abs(trade.pnl || 0).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          No trades closed in {MONTHS[selectedMonth]}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Monthly grid */
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {yearlyPerformance.map((month) => (
                        <MonthCard key={month.month} data={month} onClick={() => setSelectedMonth(month.monthIndex)} />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cumulative P&L */}
            <div className="content-card">
              <h3 className="text-base font-semibold text-foreground mb-4">Cumulative P&L</h3>
              {pnlOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={pnlOverTime}>
                    <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="hsl(var(--primary))"
                      fill="url(#pnlGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No closed trades yet
                </div>
              )}
            </div>

            {/* Win/Loss Distribution */}
            <div className="content-card">
              <h3 className="text-base font-semibold text-foreground mb-4">Win/Loss Distribution</h3>
              {stats.closedTrades > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={winLossData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {winLossData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No closed trades yet
                </div>
              )}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-profit" />
                  <span className="text-sm text-muted-foreground">Wins ({stats.winningTrades})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-loss" />
                  <span className="text-sm text-muted-foreground">Losses ({stats.losingTrades})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="content-card">
            <h3 className="text-base font-semibold text-foreground mb-4">Additional Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Win Streak */}
              <div className="p-4 rounded-lg bg-profit/10 border border-profit/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Flame className="h-4 w-4 text-profit" />
                  <p className="text-xs text-muted-foreground">Win Streak</p>
                </div>
                <p className="text-2xl font-bold text-profit">{streaks.maxWinStreak}</p>
                {streaks.currentWinStreak > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Current: {streaks.currentWinStreak}</p>
                )}
              </div>

              {/* Loss Streak */}
              <div className="p-4 rounded-lg bg-loss/10 border border-loss/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-loss" />
                  <p className="text-xs text-muted-foreground">Loss Streak</p>
                </div>
                <p className="text-2xl font-bold text-loss">{streaks.maxLossStreak}</p>
                {streaks.currentLossStreak > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Current: {streaks.currentLossStreak}</p>
                )}
              </div>

              {/* Largest Win - NEW */}
              <div className="p-4 rounded-lg bg-secondary/30 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy className="h-4 w-4 text-profit" />
                  <p className="text-xs text-muted-foreground">Largest Win</p>
                </div>
                <p className="text-2xl font-bold text-profit">+${largestTrades.largestWin.toFixed(2)}</p>
              </div>

              {/* Largest Loss - NEW */}
              <div className="p-4 rounded-lg bg-secondary/30 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-loss" />
                  <p className="text-xs text-muted-foreground">Largest Loss</p>
                </div>
                <p className="text-2xl font-bold text-loss">${Math.abs(largestTrades.largestLoss).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* AI Analysis Tab Content */}
        <TabsContent value="ai" className="mt-0">
          <AIAnalysisTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
