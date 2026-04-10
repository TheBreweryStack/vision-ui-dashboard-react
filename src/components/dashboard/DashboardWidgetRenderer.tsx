import React from "react";
import { TickerLogo } from "@/components/common/TickerLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortfolioDistributionBar } from "@/components/dashboard/PortfolioDistributionBar";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import CoffeeCupWidget from "@/components/dashboard/CoffeeCupWidget";
import { TradeGroupWithFills } from "@/hooks/useTradeGroups";
import { NoteTask } from "@/hooks/useDashboardData";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  DollarSign,
  FileStack,
  Activity,
  Plus,
  X,
  Wallet,
  LineChart,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { cn, parseDateOnly } from "@/lib/utils";
import { Link } from "react-router-dom";

interface WidgetData {
  totalPnl: number;
  pctChange: number;
  currentBalance: number;
  totalCapitalIn: number;
  initialDeposit: number;
  stats: {
    total_pnl: number;
    win_rate: number;
    total_trades: number;
    avg_win: number;
    avg_loss: number;
    open_trades: number;
  };
  weeklyPnl: number;
  weeklyGoal: number;
  progress: number;
  consecutiveLosses: number;
  recentGroups: TradeGroupWithFills[];
  openGroups: TradeGroupWithFills[];
  noteTasks: NoteTask[];
  upcomingReminders: Array<{
    id: string;
    title: string;
    ticker: string | null;
    due_date: string;
    priority: string;
  }>;
  weeklyBalances: Array<{ week_end_date: string; balance: number }>;
  activePortfolioName: string;
}

interface WidgetCallbacks {
  onGroupClick: (group: TradeGroupWithFills) => void;
  onDcaGroup: (group: TradeGroupWithFills) => void;
  onCloseGroup: (group: TradeGroupWithFills) => void;
}

interface DashboardWidgetRendererProps {
  id: string;
  data: WidgetData;
  callbacks: WidgetCallbacks;
}

export const DashboardWidgetRenderer: React.FC<DashboardWidgetRendererProps> = ({
  id,
  data,
  callbacks,
}) => {
  const {
    totalPnl, pctChange, currentBalance, totalCapitalIn, initialDeposit,
    stats, weeklyPnl, weeklyGoal, progress, consecutiveLosses,
    recentGroups, openGroups, noteTasks, upcomingReminders,
    weeklyBalances, activePortfolioName,
  } = data;
  const { onGroupClick, onDcaGroup, onCloseGroup } = callbacks;

  switch (id) {
    case 'total-pnl':
      return (
        <div className="stat-card h-full">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Total P&L</span>
            <div className={cn("icon-box h-7 w-7 md:h-8 md:w-8", totalPnl >= 0 ? "icon-box-success" : "icon-box-danger")}>
              <DollarSign className={cn("h-3.5 w-3.5 md:h-4 md:w-4", totalPnl >= 0 ? "text-profit" : "text-loss")} />
            </div>
          </div>
          <p className={cn("text-xl md:text-2xl font-bold tracking-tight", totalPnl >= 0 ? "text-profit" : "text-loss")}>
            {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      );
    case 'win-rate':
      return (
        <div className="stat-card h-full">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Win Rate</span>
            <div className="icon-box-primary h-7 w-7 md:h-8 md:w-8"><Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" /></div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{stats.win_rate.toFixed(1)}%</p>
        </div>
      );
    case 'positions-count':
      return (
        <div className="stat-card h-full">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Positions</span>
            <div className="icon-box-muted h-7 w-7 md:h-8 md:w-8"><BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" /></div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{stats.total_trades}</p>
        </div>
      );
    case 'avg-win':
      return (
        <div className="stat-card py-2.5 md:py-3 px-3 h-full flex items-center justify-center">
          <div className="flex flex-col items-center md:flex-row md:items-center gap-1 md:gap-2">
            <div className="icon-box-success h-7 w-7 md:h-8 md:w-8 shrink-0"><TrendingUp className="h-3 w-3 md:h-3.5 md:w-3.5 text-profit" /></div>
            <div className="text-center md:text-left">
              <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">Avg Win</p>
              <p className="text-base md:text-lg font-bold text-profit">+${stats.avg_win.toFixed(0)}</p>
            </div>
          </div>
        </div>
      );
    case 'avg-loss':
      return (
        <div className="stat-card py-2.5 md:py-3 px-3 h-full flex items-center justify-center">
          <div className="flex flex-col items-center md:flex-row md:items-center gap-1 md:gap-2">
            <div className="icon-box-danger h-7 w-7 md:h-8 md:w-8 shrink-0"><TrendingDown className="h-3 w-3 md:h-3.5 md:w-3.5 text-loss" /></div>
            <div className="text-center md:text-left">
              <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">Avg Loss</p>
              <p className="text-base md:text-lg font-bold text-loss">-${Math.abs(stats.avg_loss).toFixed(0)}</p>
            </div>
          </div>
        </div>
      );
    case 'open-count':
      return (
        <div className="stat-card py-2.5 md:py-3 px-3 h-full flex items-center justify-center">
          <div className="flex flex-col items-center md:flex-row md:items-center gap-1 md:gap-2">
            <div className="icon-box-muted h-7 w-7 md:h-8 md:w-8 shrink-0">
              <Activity className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />
            </div>
            <div className="text-center md:text-left">
              <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">Open</p>
              <p className="text-base md:text-lg font-bold text-foreground">{stats.open_trades}</p>
            </div>
          </div>
        </div>
      );
    case 'weekly-goal':
      return (
        <div className="h-full">
          <CoffeeCupWidget progress={progress} weeklyGoal={weeklyGoal} currentPnl={weeklyPnl} consecutiveLosses={consecutiveLosses} />
        </div>
      );
    case 'total-assets':
      return (
        <div className="stat-card p-4 md:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="icon-box-primary h-8 w-8"><Wallet className="h-4 w-4 text-primary" /></div>
              <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Assets</span>
            </div>
            <Badge className={cn("text-xs px-2 py-0.5", pctChange >= 0 ? "bg-profit/20 text-profit border-0" : "bg-loss/20 text-loss border-0")}>
              {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
            </Badge>
          </div>
          <div className="mb-5">
            <span className="text-3xl font-bold text-foreground tracking-tight">${Math.floor(currentBalance).toLocaleString()}</span>
            <span className="text-lg text-muted-foreground">.{Math.abs(Math.round((currentBalance % 1) * 100)).toString().padStart(2, '0')}</span>
          </div>
          <PortfolioDistributionBar
            allocations={[{
              name: activePortfolioName,
              value: currentBalance,
              color: '',
            }].filter(a => a.value > 0)}
            total={currentBalance > 0 ? currentBalance : 1}
          />
        </div>
      );
    case 'total-investments':
      return (
        <div className="stat-card p-4 md:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="icon-box-primary h-8 w-8"><LineChart className="h-4 w-4 text-primary" /></div>
              <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Investments</span>
            </div>
            <Badge className={cn("text-xs px-2 py-0.5", totalPnl >= 0 ? "bg-profit/20 text-profit border-0" : "bg-loss/20 text-loss border-0")}>
              {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Badge>
          </div>
          <div className="mb-2">
            <span className="text-2xl font-bold text-foreground tracking-tight">${Math.floor(totalCapitalIn).toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">.{Math.abs(Math.round((totalCapitalIn % 1) * 100)).toString().padStart(2, '0')}</span>
          </div>
          <div className="h-[180px]">
            <PerformanceChart weeklyBalances={weeklyBalances} initialDeposit={initialDeposit} />
          </div>
        </div>
      );
    case 'total-profits':
      return (
        <div className="stat-card p-4 md:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn("icon-box h-8 w-8", stats.total_pnl >= 0 ? "icon-box-success" : "icon-box-danger")}>
                <Trophy className={cn("h-4 w-4", stats.total_pnl >= 0 ? "text-profit" : "text-loss")} />
              </div>
              <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Profits</span>
            </div>
            <Badge className={cn("text-xs px-2 py-0.5", pctChange >= 0 ? "bg-profit/20 text-profit border-0" : "bg-loss/20 text-loss border-0")}>
              {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
            </Badge>
          </div>
          <div>
            <span className={cn("text-3xl font-bold tracking-tight", stats.total_pnl >= 0 ? "text-profit" : "text-loss")}>
              {stats.total_pnl >= 0 ? '+' : '-'}${Math.floor(Math.abs(stats.total_pnl)).toLocaleString()}
            </span>
            <span className={cn("text-lg", stats.total_pnl >= 0 ? "text-profit/70" : "text-loss/70")}>
              .{Math.abs(Math.round((stats.total_pnl % 1) * 100)).toString().padStart(2, '0')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.total_trades} trades &middot; {stats.win_rate.toFixed(0)}% win rate
          </p>
        </div>
      );
    case 'asset-performance':
      return (
        <div className="stat-card p-4 md:p-6 h-full overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Asset Performance</span>
            <Link to="/journal" className="text-xs text-primary hover:text-primary/80 transition-colors">View all &rarr;</Link>
          </div>
          {openGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No open positions</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs text-muted-foreground font-medium py-2 pr-2">Asset</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-2 px-2">Entry</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-2 px-2">Qty</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-2 pl-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {openGroups.slice(0, 6).map(group => (
                    <tr key={group.id} className="border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onGroupClick(group)}>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <TickerLogo symbol={group.ticker} size="sm" />
                          <span className="font-medium text-foreground">{group.ticker}</span>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-2 text-muted-foreground">${group.avg_entry_price.toFixed(2)}</td>
                      <td className="text-right py-2.5 px-2 text-foreground">{group.remaining_qty}</td>
                      <td className="text-right py-2.5 pl-2 capitalize text-muted-foreground">{group.trade_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    case 'performance-chart':
      return (
        <div className="stat-card p-4 md:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="icon-box-primary h-8 w-8"><LineChart className="h-4 w-4 text-primary" /></div>
              <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Performance</span>
            </div>
          </div>
          <div className="h-[200px]">
            <PerformanceChart weeklyBalances={weeklyBalances} initialDeposit={initialDeposit} />
          </div>
        </div>
      );
    case 'recent-trades':
      return (
        <div className="content-card h-full overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Trades</h2>
            <Link to="/journal" className="text-xs text-primary hover:text-primary/80 transition-colors">View all &rarr;</Link>
          </div>
          {recentGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No trades yet. Start logging!</p>
          ) : (
            <div className="space-y-2">
              {recentGroups.slice(0, 4).map((group) => (
                <div key={group.id} className="trade-card flex items-center justify-between cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors" onClick={() => onGroupClick(group)}>
                  <div className="flex items-center gap-3">
                    <TickerLogo symbol={group.ticker} size="sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm">{group.ticker}</p>
                        {group.remaining_qty > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.remaining_qty}x</Badge>}
                        {group.status === "closed" && group.closed_qty > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{group.closed_qty}x closed</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{group.trade_type}{group.strike_price && ` $${group.strike_price}`}{" \u2022 "}{format(parseDateOnly(group.entry_date), "MMM d")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {group.status === "open" ? (
                      <span className="badge-profit text-xs">Open</span>
                    ) : (
                      <p className={cn("font-semibold text-sm", (group.realized_pnl || 0) >= 0 ? "text-profit" : "text-loss")}>
                        {(group.realized_pnl || 0) >= 0 ? "+" : ""}${(group.realized_pnl || 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case 'open-positions':
      return (
        <div className="content-card h-full overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Positions</h2>
            </div>
            <Link to="/journal" className="text-xs text-primary hover:text-primary/80 transition-colors">View all &rarr;</Link>
          </div>
          {openGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No open positions</p>
          ) : (
            <div className="space-y-2">
              {openGroups.slice(0, 4).map((group) => (
                <div key={group.id} className="trade-card flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onGroupClick(group)}>
                  <div className="flex items-center gap-3">
                    <TickerLogo symbol={group.ticker} size="sm" />
                    <div>
                      <p className="font-medium text-foreground text-sm">{group.ticker}{group.strike_price && <span className="text-muted-foreground"> ${group.strike_price}</span>}</p>
                      <p className="text-xs text-muted-foreground capitalize">{group.trade_type} &bull; {group.remaining_qty}x @ ${group.avg_entry_price.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDcaGroup(group)} title="Add Contracts" aria-label="Add Contracts"><Plus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCloseGroup(group)} title="Close Position" aria-label="Close Position"><X className="h-4 w-4" /></Button>
                    <span className="badge-profit text-xs">Open</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case 'playbook-tasks':
      return (
        <div className="content-card h-full overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileStack className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Playbook Tasks</h2>
            </div>
            <Link to="/playbook" className="text-xs text-primary hover:text-primary/80 transition-colors">View all &rarr;</Link>
          </div>
          {noteTasks.length === 0 && upcomingReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No upcoming tasks</p>
          ) : (
            <div className="space-y-3">
              {Array.from(new Map(noteTasks.map((t: NoteTask) => [t.id, t])).values()).slice(0, 3).map((task: NoteTask) => (
                <Link key={`task-${task.id}`} to={`/playbook?note=${task.note_id}`} className="flex items-start gap-3 hover:bg-muted/30 p-2 -mx-2 rounded-lg transition-colors">
                  {task.ticker ? <TickerLogo symbol={task.ticker} size="md" /> : (
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><FileStack className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.note_title}{task.due_date && ` \u00b7 ${format(new Date(task.due_date), "MMM d")}`}</p>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0", task.priority === "high" ? "badge-priority-high" : task.priority === "medium" ? "badge-priority-medium" : "badge-priority-low")}>{task.priority}</Badge>
                </Link>
              ))}
              {noteTasks.length < 3 && upcomingReminders.slice(0, 3 - noteTasks.length).map((r) => (
                <div key={r.id} className="flex items-start gap-3">
                  {r.ticker ? <TickerLogo symbol={r.ticker} size="md" /> : (
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><FileStack className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.ticker && `${r.ticker} \u00b7 `}{format(new Date(r.due_date), "MMM d")}</p>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0", r.priority === "high" ? "badge-priority-high" : r.priority === "medium" ? "badge-priority-medium" : "badge-priority-low")}>{r.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
};
