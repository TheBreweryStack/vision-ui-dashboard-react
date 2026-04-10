import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
const ResponsiveGridLayout = WidthProvider(Responsive);
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useTradeGroupMutations } from "@/hooks/useTradeGroupMutations";
import { useFreeTierLimits } from "@/hooks/useFreeTierLimits";
import { useDeposits } from "@/hooks/useDeposits";
import { useWeeklyBalances } from "@/hooks/useWeeklyBalances";
import { usePortfolios } from "@/hooks/usePortfolios";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { TradeGroupWithFills } from "@/hooks/useTradeGroups";
import { supabase } from "@/lib/supabase";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { TickerLogo } from "@/components/common/TickerLogo";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ResubscribeBanner } from "@/components/notifications/ResubscribeBanner";
import { PushNotificationBanner } from "@/components/dashboard/PushNotificationBanner";
import { TwoFactorPromptBanner } from "@/components/dashboard/TwoFactorPromptBanner";
import { PortfolioDistributionBar } from "@/components/dashboard/PortfolioDistributionBar";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { MarketStatusBanner } from "@/components/dashboard/MarketStatusBanner";
import { AddWidgetModal } from "@/components/dashboard/AddWidgetModal";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  DollarSign,
  FileStack,
  Activity,
  Megaphone,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Crown,
  Wallet,
  LineChart,
  Trophy,
  LayoutGrid,
  Pencil,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { cn, parseDateOnly } from "@/lib/utils";
import { Link } from "react-router-dom";
import CoffeeCupWidget from "@/components/dashboard/CoffeeCupWidget";
import { useIsMobile } from "@/hooks/use-mobile";

import TrialCountdown from "@/components/dashboard/TrialCountdown";
import WeeklyCloseReminder from "@/components/dashboard/WeeklyCloseReminder";
import { CloseWeekModal } from "@/components/journal/CloseWeekModal";
import { Button } from "@/components/ui/button";
import { TradeGroupDetailSheet } from "@/components/journal/TradeGroupDetailSheet";
import { DCAGroupModal } from "@/components/journal/DCAGroupModal";
import { CloseGroupModal } from "@/components/journal/CloseGroupModal";
import { AdminDashboardWidget } from "@/components/dashboard/AdminDashboardWidget";
import { SalesWidget } from "@/components/dashboard/SalesWidget";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { NoteTask } from "@/hooks/useDashboardData";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { PortfolioSwitcher } from "@/components/journal/PortfolioSwitcher";
import { toast } from "sonner";



const Dashboard: React.FC = () => {
  const isMobile = useIsMobile();
  const { profile, isAdmin, isRoleLoading, userRole } = useAuth();
  const { data: dashboardData, isLoading, refetch: refetchDashboard } = useDashboardData();
  const { weeklyBalances } = useWeeklyBalances();
  const { portfolios, activePortfolio } = usePortfolios();
  const { tradeCount, tradeLimit, tradesRemaining, isAtLimit, hasFullAccess } = useFreeTierLimits();
  const { needsResubscribe, resubscribe, isLoading: pushLoading } = usePushNotifications();
  const { data: announcements = [] } = useAnnouncements();
  const { addToPosition, closePosition, updateGroup } = useTradeGroupMutations(refetchDashboard);
  const {
    enabledWidgets,
    enabledWidgetMetas,
    availableWidgets,
    layouts,
    addWidget,
    removeWidget,
    resetToDefault,
    isEditing: isEditingLayout,
    isDirty,
    startEditing,
    cancelEditing,
    saveLayout,
    onLayoutChange,
  } = useDashboardWidgets();

  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<TradeGroupWithFills | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [dcaGroup, setDcaGroup] = useState<TradeGroupWithFills | null>(null);
  const [closeGroup, setCloseGroup] = useState<TradeGroupWithFills | null>(null);
  const [showCloseWeekModal, setShowCloseWeekModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [weekCloseKey, setWeekCloseKey] = useState(0);
  const [showAddWidget, setShowAddWidget] = useState(false);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      const dismissedUntil = profile.onboarding_dismissed_until;
      if (!dismissedUntil || new Date(dismissedUntil) < new Date()) {
        setShowOnboarding(true);
      }
    }
  }, [profile]);

  const settings = dashboardData.settings;
  const stats = dashboardData.stats;
  const weeklyPnl = dashboardData.weeklyPnl;
  const consecutiveLosses = dashboardData.consecutiveLosses;
  const recentGroups = dashboardData.recentGroups;
  const openGroups = dashboardData.openGroups;
  const upcomingReminders = dashboardData.upcomingReminders;
  const noteTasks = dashboardData.noteTasks;
  const inboxCounts = dashboardData.inboxCounts;
  const netFlow = dashboardData.netFlow;

  const { deposits, totalDeposits, totalWithdrawals } = useDeposits();
  const weeklyNetFlow = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    return deposits
      .filter(d => d.deposit_date >= weekStartStr)
      .reduce((sum, d) => sum + (d.transaction_type === 'deposit' ? d.amount : -d.amount), 0);
  }, [deposits]);

  const currentBalance = useMemo(() => {
    const initialDeposit = settings?.initial_deposit || 0;
    const allRealizedPnl = stats.total_pnl || 0;
    return initialDeposit + totalDeposits - totalWithdrawals + allRealizedPnl;
  }, [settings, totalDeposits, totalWithdrawals, stats.total_pnl]);

  const weeklyGoal = settings?.weekly_goal || 500;
  const progress = (weeklyPnl / weeklyGoal) * 100;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const dismissAnnouncement = (id: string) => {
    setDismissedAnnouncements((prev) => new Set([...prev, id]));
  };
  const visibleAnnouncements = announcements.filter((a) => !dismissedAnnouncements.has(a.id));

  useEffect(() => {
    if (visibleAnnouncements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAnnouncementIndex((prev) => (prev + 1) % visibleAnnouncements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [visibleAnnouncements.length]);

  const goToPrevAnnouncement = useCallback(() => {
    setCurrentAnnouncementIndex((prev) => (prev === 0 ? visibleAnnouncements.length - 1 : prev - 1));
  }, [visibleAnnouncements.length]);

  const goToNextAnnouncement = useCallback(() => {
    setCurrentAnnouncementIndex((prev) => (prev + 1) % visibleAnnouncements.length);
  }, [visibleAnnouncements.length]);

  const currentAnnouncement = visibleAnnouncements[currentAnnouncementIndex];

  const handleGroupClick = async (group: TradeGroupWithFills) => {
    const { data: fullGroup, error } = await supabase
      .from('trade_groups')
      .select('*, fills:trade_fills(*)')
      .eq('id', group.id)
      .maybeSingle();
    if (error || !fullGroup) return;
    setSelectedGroup(fullGroup as TradeGroupWithFills);
    setShowDetailSheet(true);
  };

  const handleAddToPosition = async (groupId: string, quantity: number, price: number, date: Date) => {
    const { error } = await addToPosition(groupId, { quantity, price, fill_date: format(date, "yyyy-MM-dd") });
    if (!error) { setDcaGroup(null); refetchDashboard(); }
  };

  const handleClosePosition = async (groupId: string, quantity: number, price: number, date: Date) => {
    const { error } = await closePosition(groupId, { quantity, price, fill_date: format(date, "yyyy-MM-dd") });
    if (!error) { setCloseGroup(null); refetchDashboard(); }
  };

  const handleUpdateImages = async (groupId: string, images: string[]) => {
    await updateGroup(groupId, { images });
  };

  const handleResubscribe = async () => {
    const success = await resubscribe();
    if (success) toast.success("Push notifications re-enabled!");
    else toast.error("Failed to re-enable notifications. Please try again.");
  };

  // Derived values
  const initialDeposit = settings?.initial_deposit || 0;
  const totalCapitalIn = initialDeposit + totalDeposits - totalWithdrawals;
  const totalPnl = currentBalance - totalCapitalIn;
  const pctChange = totalCapitalIn > 0 ? ((currentBalance - totalCapitalIn) / totalCapitalIn * 100) : 0;

  // --- Widget renderer ---
  const renderWidget = (id: string) => {
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
                name: activePortfolio?.name || 'Portfolio',
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
              {stats.total_trades} trades · {stats.win_rate.toFixed(0)}% win rate
            </p>
          </div>
        );
      case 'asset-performance':
        return (
          <div className="stat-card p-4 md:p-6 h-full overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">Asset Performance</span>
              <Link to="/journal" className="text-xs text-primary hover:text-primary/80 transition-colors">View all →</Link>
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
                      <tr key={group.id} className="border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleGroupClick(group)}>
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
              <Link to="/journal" className="text-xs text-primary hover:text-primary/80 transition-colors">View all →</Link>
            </div>
            {recentGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No trades yet. Start logging!</p>
            ) : (
              <div className="space-y-2">
                {recentGroups.slice(0, 4).map((group) => (
                  <div key={group.id} className="trade-card flex items-center justify-between cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors" onClick={() => handleGroupClick(group)}>
                    <div className="flex items-center gap-3">
                      <TickerLogo symbol={group.ticker} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm">{group.ticker}</p>
                          {group.remaining_qty > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.remaining_qty}x</Badge>}
                          {group.status === "closed" && group.closed_qty > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{group.closed_qty}x closed</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{group.trade_type}{group.strike_price && ` $${group.strike_price}`}{" • "}{format(parseDateOnly(group.entry_date), "MMM d")}</p>
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
              <Link to="/journal" className="text-xs text-primary hover:text-primary/80 transition-colors">View all →</Link>
            </div>
            {openGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No open positions</p>
            ) : (
              <div className="space-y-2">
                {openGroups.slice(0, 4).map((group) => (
                  <div key={group.id} className="trade-card flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleGroupClick(group)}>
                    <div className="flex items-center gap-3">
                      <TickerLogo symbol={group.ticker} size="sm" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{group.ticker}{group.strike_price && <span className="text-muted-foreground"> ${group.strike_price}</span>}</p>
                        <p className="text-xs text-muted-foreground capitalize">{group.trade_type} • {group.remaining_qty}x @ ${group.avg_entry_price.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDcaGroup(group)} title="Add Contracts"><Plus className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCloseGroup(group)} title="Close Position"><X className="h-4 w-4" /></Button>
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
              <Link to="/playbook" className="text-xs text-primary hover:text-primary/80 transition-colors">View all →</Link>
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
                      <p className="text-xs text-muted-foreground">{task.note_title}{task.due_date && ` · ${format(new Date(task.due_date), "MMM d")}`}</p>
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
                      <p className="text-xs text-muted-foreground">{r.ticker && `${r.ticker} · `}{format(new Date(r.due_date), "MMM d")}</p>
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

  if (isLoading || isRoleLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <PullToRefresh onRefresh={async () => { await refetchDashboard(); }}>
    <div className="space-y-4 md:space-y-6 animate-in">
      {/* Market Status Banner */}
      <MarketStatusBanner />

      {/* Header Section */}
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            {getGreeting()}, <span className="text-primary">{profile?.display_name || "Trader"}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEditingLayout ? (
            <>
              <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={saveLayout}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save Layout</span>
                <span className="sm:hidden">Save</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={cancelEditing}>
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={resetToDefault}>
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddWidget(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Widget</span>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Edit Layout</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          )}
          <PortfolioSwitcher />
        </div>
      </div>

      {/* Announcement Widget */}
      {currentAnnouncement && (
        <div className="lg:max-w-md w-full">
          <div className={cn("relative p-3 rounded-xl flex items-start gap-3 bg-secondary/50 border border-border/50", currentAnnouncement.priority === "high" && "bg-loss/10 border-loss/30", currentAnnouncement.priority === "medium" && "bg-yellow-500/10 border-yellow-500/30")}>
            <Megaphone className={cn("h-4 w-4 shrink-0 mt-0.5", currentAnnouncement.priority === "high" ? "text-loss" : currentAnnouncement.priority === "medium" ? "text-yellow-500" : "text-muted-foreground")} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm text-foreground truncate">{currentAnnouncement.title}</h3>
                {currentAnnouncement.is_pinned && <Badge variant="outline" className="text-[10px] shrink-0">Pinned</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{currentAnnouncement.content}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {visibleAnnouncements.length > 1 && (
                <>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goToPrevAnnouncement}><ChevronLeft className="h-3 w-3" /></Button>
                  <span className="text-xs text-muted-foreground">{currentAnnouncementIndex + 1}/{visibleAnnouncements.length}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goToNextAnnouncement}><ChevronRight className="h-3 w-3" /></Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dismissAnnouncement(currentAnnouncement.id)}><X className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      )}

      <PushNotificationBanner />
      <TwoFactorPromptBanner />
      {needsResubscribe && <ResubscribeBanner onResubscribe={handleResubscribe} isLoading={pushLoading} />}
      <WeeklyCloseReminder key={weekCloseKey} onCloseWeek={() => setShowCloseWeekModal(true)} isWeekClosed={dashboardData.weekClosed} />
      <TrialCountdown />

      {/* Widget Grid - react-grid-layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 996, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={80}
        isDraggable={isEditingLayout}
        isResizable={isEditingLayout}
        onLayoutChange={onLayoutChange}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        margin={[16, 16]}
      >
        {enabledWidgets.map((id) => (
          <div key={id} className="relative group overflow-hidden">
            {isEditingLayout && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                <button
                  onClick={() => removeWidget(id)}
                  className="h-5 w-5 rounded-full bg-muted/80 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                  title="Remove widget"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className={cn("h-full", isEditingLayout && "widget-drag-handle cursor-grab active:cursor-grabbing")}>
              {renderWidget(id)}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Free Tier Trade Limit Widget */}
      {!hasFullAccess && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Trade Limit</span>
            </div>
            <span className={cn("text-sm font-semibold", isAtLimit ? "text-loss" : tradesRemaining <= 3 ? "text-amber-500" : "text-foreground")}>
              {tradeCount}/{tradeLimit}
            </span>
          </div>
          <Progress value={(tradeCount / tradeLimit) * 100} className={cn("h-2", isAtLimit ? "[&>div]:bg-loss" : tradesRemaining <= 3 ? "[&>div]:bg-amber-500" : "")} />
          {tradesRemaining <= 5 && (
            <p className="text-xs text-muted-foreground mt-2">
              {isAtLimit ? (<>Limit reached! <Link to="/pricing" className="text-primary hover:underline">Upgrade for unlimited trades</Link></>) : (<>{tradesRemaining} trade{tradesRemaining !== 1 ? 's' : ''} remaining. <Link to="/pricing" className="text-primary hover:underline">Upgrade</Link></>)}
            </p>
          )}
        </div>
      )}

      {/* Admin Overview Section */}
      {(isAdmin || isRoleLoading) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin Overview</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          {isRoleLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="content-card animate-pulse">
                <div className="h-5 w-32 bg-muted rounded mb-4" />
                <div className="grid grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-muted/30">
                      <div className="h-8 w-8 rounded-lg bg-muted mb-2" />
                      <div className="h-5 w-8 bg-muted rounded mb-1" />
                      <div className="h-3 w-12 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="content-card animate-pulse">
                <div className="h-5 w-24 bg-muted rounded mb-4" />
                <div className="space-y-3"><div className="h-16 bg-muted rounded" /><div className="h-16 bg-muted rounded" /></div>
              </div>
            </div>
          ) : isAdmin ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AdminDashboardWidget />
              <SalesWidget />
            </div>
          ) : null}
        </div>
      )}

      {/* Debug info — development only */}
      {import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === '1' && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-xs font-mono text-muted-foreground">
          <div>Role: {userRole?.role ?? 'null'} | isAdmin: {String(isAdmin)}</div>
          <div>User: {profile?.email ?? 'not loaded'}</div>
        </div>
      )}

      {/* Modals & Sheets */}
      <TradeGroupDetailSheet open={showDetailSheet} onOpenChange={setShowDetailSheet} group={selectedGroup} onUpdateImages={handleUpdateImages} />
      {dcaGroup && (
        <DCAGroupModal open={!!dcaGroup} onOpenChange={(open) => !open && setDcaGroup(null)} group={dcaGroup}
          onAddToPosition={async (quantity, price, date) => { await handleAddToPosition(dcaGroup.id, quantity, price, date); }} />
      )}
      {closeGroup && (
        <CloseGroupModal open={!!closeGroup} onOpenChange={(open) => !open && setCloseGroup(null)} group={closeGroup}
          onClosePosition={async (quantity, price, date) => { await handleClosePosition(closeGroup.id, quantity, price, date); }} />
      )}
      <CloseWeekModal
        open={showCloseWeekModal}
        onOpenChange={(open) => { setShowCloseWeekModal(open); if (!open) setWeekCloseKey(prev => prev + 1); }}
        currentBalance={currentBalance}
        weeklyPnl={weeklyPnl}
      />
      <OnboardingGuide open={showOnboarding} onOpenChange={setShowOnboarding} />
      <AddWidgetModal open={showAddWidget} onOpenChange={setShowAddWidget} availableWidgets={availableWidgets} onAdd={(id) => { addWidget(id); }} />
    </div>
    </PullToRefresh>
  );
};

export default Dashboard;
