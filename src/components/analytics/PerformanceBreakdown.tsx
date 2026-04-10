import React, { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TickerLogo } from "@/components/common/TickerLogo";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Activity, Trophy, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, getMonth, startOfYear, endOfYear, startOfMonth, endOfMonth, eachMonthOfInterval, eachWeekOfInterval, subMonths } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Trade {
  id: string;
  ticker: string;
  status: string;
  exit_date: string | null;
  pnl: number | null;
  entry_time: string | null;
}

interface PerformanceByDay {
  day: string;
  wins: number;
  losses: number;
  pnl: number;
  trades: number;
  winRate: number;
  avgPnl: number;
}

interface PerformanceBreakdownProps {
  trades: Trade[];
  performanceByDay: PerformanceByDay[];
  performanceByTime: Array<{ time: string; pnl: number; trades: number; winRate: number }>;
  pnlByTicker: Array<{ ticker: string; pnl: number; trades: number; wins: number; winRate: number }>;
  bestDay: { day: string; winRate: number; pnl: number; trades?: number };
  worstDay: { day: string; winRate: number; pnl: number; trades?: number };
}

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

const DayCard: React.FC<{ data: PerformanceByDay }> = ({ data }) => (
  <div className={cn("p-4 rounded-lg border transition-all", getWinRateBgColor(data.winRate))}>
    <div className="text-center">
      <p className="text-sm font-medium text-foreground mb-1">{data.day}</p>
      <p className={cn("text-xl font-bold mb-1", data.pnl >= 0 ? "text-profit" : "text-loss")}>
        {data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(0)}
      </p>
      <p className={cn("text-sm font-semibold mb-1", getWinRateColor(data.winRate))}>{data.winRate.toFixed(0)}% win</p>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>{data.trades} trades</span><span>•</span><span>{data.wins}W-{data.losses}L</span>
      </div>
    </div>
  </div>
);

export const PerformanceBreakdown: React.FC<PerformanceBreakdownProps> = ({
  trades,
  performanceByDay,
  performanceByTime,
  pnlByTicker,
  bestDay,
  worstDay,
}) => {
  const [activeTab, setActiveTab] = useState("day");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const weeklyPerformance = useMemo(() => {
    const last8Weeks = eachWeekOfInterval({ start: subMonths(new Date(), 2), end: new Date() });
    return last8Weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekTrades = trades.filter((t) => {
        if (t.status !== "closed" || !t.exit_date) return false;
        const exitDate = parseISO(t.exit_date);
        return exitDate >= weekStart && exitDate <= weekEnd;
      });
      return { week: format(weekStart, "MMM d"), pnl: weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0), trades: weekTrades.length };
    });
  }, [trades]);

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
      return { month: MONTHS[getMonth(monthStart)], monthIndex: getMonth(monthStart), pnl, trades: monthTrades.length, winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0 };
    });
  }, [trades, selectedYear]);

  const selectedMonthTrades = useMemo(() => {
    if (selectedMonth === null) return [];
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth, 1));
    const monthEnd = endOfMonth(monthStart);
    return trades.filter((t) => {
      if (t.status !== "closed" || !t.exit_date) return false;
      const exitDate = parseISO(t.exit_date);
      return exitDate >= monthStart && exitDate <= monthEnd;
    }).sort((a, b) => new Date(b.exit_date!).getTime() - new Date(a.exit_date!).getTime());
  }, [trades, selectedYear, selectedMonth]);

  return (
    <div className="content-card p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="day">By Day</TabsTrigger>
          <TabsTrigger value="time">By Time</TabsTrigger>
          <TabsTrigger value="ticker">By Ticker</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>

        {/* By Day */}
        <TabsContent value="day" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Performance by Day of Week</h3>
            </div>
            <p className="text-sm text-muted-foreground">See which days you trade best (based on win rate and P&L)</p>
            <div className="grid md:grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
              <div>
                <div className="flex items-center gap-2 mb-2"><Trophy className="h-4 w-4 text-profit" /><p className="text-sm font-medium text-muted-foreground">Best Day</p></div>
                <p className="text-2xl font-bold text-profit mb-1">{bestDay.day}</p>
                <p className={cn("text-sm font-semibold mb-1", getWinRateColor(bestDay.winRate))}>{bestDay.winRate.toFixed(0)}% win rate</p>
                <p className="text-sm text-muted-foreground">{bestDay.pnl >= 0 ? "+" : ""}${bestDay.pnl.toFixed(0)} total • {bestDay.trades} trades</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-loss" /><p className="text-sm font-medium text-muted-foreground">Worst Day</p></div>
                <p className="text-2xl font-bold text-loss mb-1">{worstDay.day}</p>
                <p className={cn("text-sm font-semibold mb-1", getWinRateColor(worstDay.winRate))}>{worstDay.winRate.toFixed(0)}% win rate</p>
                <p className="text-sm text-muted-foreground">{worstDay.pnl >= 0 ? "+" : ""}${worstDay.pnl.toFixed(0)} total • {worstDay.trades} trades</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {performanceByDay.map((day) => <DayCard key={day.day} data={day} />)}
            </div>
          </div>
        </TabsContent>

        {/* By Time */}
        <TabsContent value="time" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><h3 className="text-base font-semibold text-foreground">Performance by Time of Day</h3></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {performanceByTime.map((slot) => (
                <div key={slot.time} className={cn("p-3 rounded-lg border", slot.pnl >= 0 ? "bg-profit/10 border-profit/20" : "bg-loss/10 border-loss/20", slot.trades === 0 && "opacity-40")}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{slot.time}</p>
                  <p className={cn("text-lg font-bold", slot.pnl >= 0 ? "text-profit" : "text-loss")}>{slot.pnl >= 0 ? "+" : ""}${slot.pnl.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{slot.trades} trades • {slot.winRate.toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* By Ticker */}
        <TabsContent value="ticker" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h3 className="text-base font-semibold text-foreground">Performance by Ticker</h3></div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {pnlByTicker.length > 0 ? pnlByTicker.map((ticker) => (
                <div key={ticker.ticker} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <TickerLogo symbol={ticker.ticker} size="sm" />
                    <div>
                      <p className="font-medium text-foreground">{ticker.ticker}</p>
                      <p className="text-xs text-muted-foreground">{ticker.trades} trades • {ticker.winRate.toFixed(0)}% win</p>
                    </div>
                  </div>
                  <p className={cn("font-bold text-lg", ticker.pnl >= 0 ? "text-profit" : "text-loss")}>{ticker.pnl >= 0 ? "+" : ""}${ticker.pnl.toFixed(0)}</p>
                </div>
              )) : <div className="text-center py-8 text-muted-foreground">No closed trades yet</div>}
            </div>
          </div>
        </TabsContent>

        {/* Weekly */}
        <TabsContent value="weekly" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /><h3 className="text-base font-semibold text-foreground">Weekly Performance</h3></div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="pnl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Yearly */}
        <TabsContent value="yearly" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /><h3 className="text-base font-semibold text-foreground">P&L Calendar</h3></div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedYear((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="font-semibold text-foreground min-w-[80px] text-center">{selectedYear}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedYear((p) => p + 1)} disabled={selectedYear >= new Date().getFullYear()}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            {selectedMonth !== null ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null)}><ChevronLeft className="h-4 w-4 mr-1" />Back to Year</Button>
                  <h4 className="text-lg font-semibold">{MONTHS[selectedMonth]} {selectedYear}</h4>
                </div>
                <div className={cn("p-4 rounded-lg border text-center", yearlyPerformance[selectedMonth].pnl >= 0 ? "bg-profit/5 border-profit/20" : "bg-loss/5 border-loss/20")}>
                  <p className="text-xs text-muted-foreground mb-1">Monthly P&L</p>
                  <p className={cn("text-2xl font-bold", yearlyPerformance[selectedMonth].pnl >= 0 ? "text-profit" : "text-loss")}>
                    {yearlyPerformance[selectedMonth].pnl >= 0 ? "+" : ""}${Math.abs(yearlyPerformance[selectedMonth].pnl).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{yearlyPerformance[selectedMonth].trades} trades • {yearlyPerformance[selectedMonth].winRate.toFixed(0)}% win rate</p>
                </div>
                {selectedMonthTrades.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {selectedMonthTrades.map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <TickerLogo symbol={trade.ticker} size="sm" />
                          <div>
                            <p className="font-medium text-foreground text-sm">{trade.ticker}</p>
                            <p className="text-xs text-muted-foreground">{trade.exit_date ? format(parseISO(trade.exit_date), "MMM d") : "Open"}</p>
                          </div>
                        </div>
                        <p className={cn("font-semibold text-sm", (trade.pnl || 0) >= 0 ? "text-profit" : "text-loss")}>
                          {(trade.pnl || 0) >= 0 ? "+" : ""}${Math.abs(trade.pnl || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">No trades closed in {MONTHS[selectedMonth]}</p>}
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {yearlyPerformance.map((month) => (
                  <button key={month.month} onClick={() => setSelectedMonth(month.monthIndex)} className={cn("p-3 rounded-lg border transition-all hover:scale-105", month.pnl >= 0 ? "bg-profit/10 border-profit/20" : "bg-loss/10 border-loss/20", month.trades === 0 && "opacity-40")}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{month.month}</p>
                    <p className={cn("text-lg font-bold", month.pnl >= 0 ? "text-profit" : "text-loss")}>{month.pnl >= 0 ? "+" : ""}${Math.abs(month.pnl).toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{month.trades} trades</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
