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
import { Progress } from "@/components/ui/progress";
import { ResubscribeBanner } from "@/components/notifications/ResubscribeBanner";
import { PushNotificationBanner } from "@/components/dashboard/PushNotificationBanner";
import { TwoFactorPromptBanner } from "@/components/dashboard/TwoFactorPromptBanner";
import { MarketStatusBanner } from "@/components/dashboard/MarketStatusBanner";
import { AddWidgetModal } from "@/components/dashboard/AddWidgetModal";
import { DashboardWidgetRenderer } from "@/components/dashboard/DashboardWidgetRenderer";
import {
  Megaphone,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Crown,
  LayoutGrid,
  Pencil,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
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
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { PortfolioSwitcher } from "@/components/journal/PortfolioSwitcher";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";



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

  // Widget data bag — passed to DashboardWidgetRenderer
  const widgetData = useMemo(() => ({
    totalPnl,
    pctChange,
    currentBalance,
    totalCapitalIn,
    initialDeposit,
    stats,
    weeklyPnl,
    weeklyGoal,
    progress,
    consecutiveLosses,
    recentGroups,
    openGroups,
    noteTasks,
    upcomingReminders,
    weeklyBalances,
    activePortfolioName: activePortfolio?.name || 'Portfolio',
  }), [
    totalPnl, pctChange, currentBalance, totalCapitalIn, initialDeposit,
    stats, weeklyPnl, weeklyGoal, progress, consecutiveLosses,
    recentGroups, openGroups, noteTasks, upcomingReminders,
    weeklyBalances, activePortfolio?.name,
  ]);

  const widgetCallbacks = useMemo(() => ({
    onGroupClick: handleGroupClick,
    onDcaGroup: setDcaGroup,
    onCloseGroup: setCloseGroup,
  }), []);

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
              <DashboardWidgetRenderer id={id} data={widgetData} callbacks={widgetCallbacks} />
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
