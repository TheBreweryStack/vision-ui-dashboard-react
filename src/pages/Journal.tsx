import { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, List, CalendarDays, Settings, ArrowRightLeft, Wallet, TrendingUp, Target, Calendar, Download, Upload, TrendingDown, Inbox, Merge, Clock, Lock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePortfolios } from '@/hooks/usePortfolios';
import { PortfolioSwitcher } from '@/components/journal/PortfolioSwitcher';
import { useTradeGroups, TradeGroupWithFills } from '@/hooks/useTradeGroups';
import { useAccountSettings } from '@/hooks/useAccountSettings';
import { useDeposits } from '@/hooks/useDeposits';
import { useWeeklyBalances } from '@/hooks/useWeeklyBalances';
import { useExpiredOptionsAutoClose } from '@/hooks/useExpiredOptionsAutoClose';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useFreeTierLimits, FREE_TRADE_LIMIT } from '@/hooks/useFreeTierLimits';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TradeGroupList } from '@/components/journal/TradeGroupList';
import { TradeGroupCalendar } from '@/components/journal/TradeGroupCalendar';
import { AccountSettingsModal } from '@/components/journal/AccountSettingsModal';
import { DepositsModal } from '@/components/journal/DepositsModal';
import { CloseWeekModal } from '@/components/journal/CloseWeekModal';
import { DCAGroupModal } from '@/components/journal/DCAGroupModal';
import { CloseGroupModal } from '@/components/journal/CloseGroupModal';
import { AddTradeGroupModal } from '@/components/journal/AddTradeGroupModal';
import { MergePositionsModal } from '@/components/journal/MergePositionsModal';
import { TradeGroupDetailSheet } from '@/components/journal/TradeGroupDetailSheet';
import { TickerLogo } from '@/components/common/TickerLogo';
import { PullToRefresh } from '@/components/common/PullToRefresh';
import { TradeInboxDialog } from '@/components/journal/TradeInboxDialog';
import { JournalSkeleton } from '@/components/skeletons/JournalSkeleton';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { StocksDashboard } from '@/components/stocks/StocksDashboard';
import { DividendsComingSoon } from '@/components/dividends/DividendsComingSoon';
import { useTradeInbox } from '@/hooks/useTradeInbox';
import { supabase } from '@/lib/supabase';
import { cn, parseDateOnly, isExpiredOption } from '@/lib/utils';
import { format, startOfWeek } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export default function Journal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activePortfolio } = usePortfolios();
  const { 
    groups, 
    isLoading, 
    stats, 
    createGroup, 
    addToPosition, 
    closePosition, 
    updateGroup, 
    deleteGroup, 
    refetch 
  } = useTradeGroups();
  const { settings } = useAccountSettings();
  const { deposits, netFlow, totalDeposits, totalWithdrawals } = useDeposits();
  const { weeklyBalances } = useWeeklyBalances();
  const { counts: inboxCounts } = useTradeInbox();
  const { canUseImports, canUseEmailIngest, hasFullAccess } = useAccessControl();
  
  // Get trade count from useTradeGroups which is already fetched - avoid duplicate dashboard RPC
  const totalTradeCount = useMemo(() => groups.length, [groups]);
  const { canAddTrade, tradesRemaining, isAtLimit } = useFreeTierLimits({ 
    overrideTradeCount: totalTradeCount 
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDepositsModal, setShowDepositsModal] = useState(false);
  const [showCloseWeekModal, setShowCloseWeekModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [dcaGroup, setDcaGroup] = useState<TradeGroupWithFills | null>(null);
  const [closeGroup, setCloseGroup] = useState<TradeGroupWithFills | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TradeGroupWithFills | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

  // Handle ?trade= query param to auto-open trade detail
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tradeId = params.get('trade');
    
    if (tradeId && groups.length > 0) {
      const openTradeFromUrl = async () => {
        const { data: fullGroup, error } = await supabase
          .from('trade_groups')
          .select('*, fills:trade_fills(*)')
          .eq('id', tradeId)
          .maybeSingle();

        if (!error && fullGroup) {
          setSelectedGroup(fullGroup as TradeGroupWithFills);
          setShowDetailSheet(true);
          // Clear the query param after opening
          navigate('/journal', { replace: true });
        }
      };
      openTradeFromUrl();
    }
  }, [location.search, groups.length, navigate]);

  const weeklyNetFlow = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    return deposits
      .filter(d => d.deposit_date >= weekStartStr)
      .reduce((sum, d) => {
        return sum + (d.transaction_type === 'deposit' ? d.amount : -d.amount);
      }, 0);
  }, [deposits]);

  const weeklyPnl = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    weekStart.setHours(0, 0, 0, 0);
    
    return groups
      .filter(g => {
        const latestFill = g.fills.length > 0 
          ? g.fills.reduce((latest, fill) => 
              new Date(fill.fill_date) > new Date(latest.fill_date) ? fill : latest
            )
          : null;
        const tradeDate = latestFill 
          ? parseDateOnly(latestFill.fill_date)
          : parseDateOnly(g.entry_date);
        return tradeDate >= weekStart;
      })
      .reduce((sum, g) => sum + (g.realized_pnl || 0), 0);
  }, [groups]);

  const isWeekClosed = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    return weeklyBalances.some(wb => wb.week_start_date === weekStartStr);
  }, [weeklyBalances]);

  const currentBalance = useMemo(() => {
    const initialDeposit = settings?.initial_deposit || 0;
    const allRealizedPnl = groups
      .reduce((sum, g) => sum + (g.realized_pnl || 0), 0);
    return initialDeposit + totalDeposits - totalWithdrawals + allRealizedPnl;
  }, [settings, totalDeposits, totalWithdrawals, groups]);

  const weeklyGoalProgress = useMemo(() => {
    const goal = settings?.weekly_goal || 500;
    return Math.round((weeklyPnl / goal) * 100);
  }, [weeklyPnl, settings]);

  const showCloseWeek = true;

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleAddToPosition = async (groupId: string, quantity: number, price: number, date: Date) => {
    await addToPosition(groupId, {
      quantity,
      price,
      fill_date: format(date, 'yyyy-MM-dd'),
    });
  };

  const handleClosePosition = useCallback(async (groupId: string, quantity: number, price: number, date: Date) => {
    await closePosition(groupId, {
      quantity,
      price,
      fill_date: format(date, 'yyyy-MM-dd'),
    });
  }, [closePosition]);

  // Auto-close expired options hook
  const { expiredOptions, closeExpiredOption } = useExpiredOptionsAutoClose(
    groups,
    handleClosePosition
  );

  const handleCloseExpired = async (group: TradeGroupWithFills) => {
    const expDate = group.expiration_date 
      ? parseDateOnly(group.expiration_date)
      : new Date();
    
    await handleClosePosition(group.id, group.remaining_qty, 0, expDate);
    toast.success(`Closed ${group.ticker} at $0`);
  };

  const handleOpenTradeClick = async (group: TradeGroupWithFills) => {
    // Fetch full group data including fills if needed
    const { data: fullGroup, error } = await supabase
      .from('trade_groups')
      .select('*, fills:trade_fills(*)')
      .eq('id', group.id)
      .maybeSingle();

    if (error || !fullGroup) {
      logger.error('Failed to load trade details:', error);
      return;
    }

    setSelectedGroup(fullGroup as TradeGroupWithFills);
    setShowDetailSheet(true);
  };


  const handleUpdateImages = async (groupId: string, images: string[]) => {
    await updateGroup(groupId, { images });
  };

  const exportToCSV = () => {
    const headers = ['Ticker', 'Type', 'Strike', 'Expiration', 'Entry Date', 'Avg Entry', 'Avg Exit', 'Qty', 'Status', 'P&L', 'Strategy', 'Notes'];
    const rows = groups.map(g => [
      g.ticker,
      g.trade_type,
      g.strike_price || '',
      g.expiration_date || '',
      g.entry_date,
      g.avg_entry_price.toFixed(2),
      g.avg_exit_price?.toFixed(2) || '',
      g.opened_qty,
      g.status,
      g.realized_pnl?.toFixed(2) || '',
      g.strategy || '',
      `"${(g.notes || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openGroups = groups.filter(g => g.status === 'open');
  const expiredOpenGroups = openGroups.filter(g => isExpiredOption(g));

  // Category-aware rendering
  const category = activePortfolio?.category;
  const isStocks = category === 'stocks';
  const isDividends = category === 'dividends';

  // Show skeleton while initial loading (only for options/mixed)
  if (!isStocks && !isDividends && isLoading && groups.length === 0) {
    return <JournalSkeleton />;
  }

  // Stocks dashboard
  if (isStocks) {
    return (
      <div className="space-y-4 md:space-y-6 animate-in">
        <div className="hidden md:flex page-header">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="page-title">Portfolio</h1>
              <p className="page-subtitle">Track and manage your holdings</p>
            </div>
            <PortfolioSwitcher />
          </div>
        </div>
        <div className="flex md:hidden items-center justify-between gap-2 px-1">
          <PortfolioSwitcher compact />
        </div>
        <StocksDashboard />
      </div>
    );
  }

  // Dividends coming soon
  if (isDividends) {
    return (
      <div className="space-y-4 md:space-y-6 animate-in">
        <div className="hidden md:flex page-header">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="page-title">Portfolio</h1>
              <p className="page-subtitle">Dividend tracking</p>
            </div>
            <PortfolioSwitcher />
          </div>
        </div>
        <div className="flex md:hidden items-center justify-between gap-2 px-1">
          <PortfolioSwitcher compact />
        </div>
        <DividendsComingSoon />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
    <div className="space-y-4 md:space-y-6 animate-in">
      {/* Header - simplified on mobile */}
      <div className="hidden md:flex page-header">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="page-title">Portfolio</h1>
            <p className="page-subtitle">Track and manage your positions</p>
          </div>
          <PortfolioSwitcher />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettingsModal(true)}
            className="btn-glass border-0"
            title="Account Settings"
            aria-label="Account Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          {canUseEmailIngest ? (
            <TradeInboxDialog
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  className="relative btn-glass border-0"
                  title="Trade Inbox"
                  aria-label="Trade Inbox"
                >
                  <Inbox className="h-4 w-4" />
                  {(inboxCounts.pending + inboxCounts.needs_review) > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-loss text-white text-[10px] font-bold flex items-center justify-center">
                      {inboxCounts.pending + inboxCounts.needs_review}
                    </span>
                  )}
                </Button>
              }
            />
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="relative btn-glass border-0 opacity-60"
              title="Trade Inbox (Pro)"
              aria-label="Trade Inbox (Pro)"
              onClick={() => {
                setUpgradeFeature('Email Trade Import');
                setShowUpgradeModal(true);
              }}
            >
              <Lock className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowDepositsModal(true)}
            className="btn-glass border-0"
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transactions
          </Button>
          {showCloseWeek && (
            <Button
              variant="outline"
              onClick={() => setShowCloseWeekModal(true)}
              className="btn-glass border-0"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Close Week
            </Button>
          )}
          <Button
            onClick={() => {
              if (!canAddTrade) {
                setUpgradeFeature(`Trade Limit (${FREE_TRADE_LIMIT} max on Free)`);
                setShowUpgradeModal(true);
                return;
              }
              setShowAddModal(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Trade
            {!hasFullAccess && tradesRemaining <= 5 && tradesRemaining > 0 && (
              <Badge variant="outline" className="ml-2 text-[10px] border-primary-foreground/30">
                {tradesRemaining} left
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile action row */}
      <div className="flex md:hidden items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <PortfolioSwitcher compact />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettingsModal(true)}
            className="btn-glass border-0 h-8 w-8 shrink-0"
            title="Account Settings"
            aria-label="Account Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDepositsModal(true)}
            className="btn-glass border-0 h-8 px-2 text-xs shrink-0"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
            Transactions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCloseWeekModal(true)}
            className="btn-glass border-0 h-8 px-2 text-xs shrink-0"
          >
            <Calendar className="h-3.5 w-3.5 mr-1" />
            Close Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!canUseImports) {
                setUpgradeFeature('Merge Positions');
                setShowUpgradeModal(true);
                return;
              }
              setShowMergeModal(true);
            }}
            className={cn("btn-glass border-0 h-8 px-2 text-xs shrink-0", !canUseImports && "opacity-60")}
          >
            {canUseImports ? <Merge className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
            Merge
          </Button>
        </div>
        <Button
          onClick={() => {
            if (!canAddTrade) {
              setUpgradeFeature(`Trade Limit (${FREE_TRADE_LIMIT} max on Free)`);
              setShowUpgradeModal(true);
              return;
            }
            setShowAddModal(true);
          }}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3 text-xs shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
          {!hasFullAccess && tradesRemaining <= 5 && tradesRemaining > 0 && (
            <span className="ml-1 text-[9px] opacity-80">({tradesRemaining})</span>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        <div className="stat-card p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
          <p className="text-base md:text-2xl font-bold text-foreground">
            ${currentBalance >= 1000 ? (currentBalance / 1000).toFixed(1) + 'k' : currentBalance.toFixed(0)}
          </p>
        </div>

        <div className="stat-card p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">Total P&L</p>
          {(() => {
            const initialDeposit = settings?.initial_deposit || 0;
            const totalCapitalIn = initialDeposit + totalDeposits - totalWithdrawals;
            const totalPnl = currentBalance - totalCapitalIn;
            return (
              <p className={cn(
                "text-base md:text-2xl font-bold",
                totalPnl >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(0)}
              </p>
            );
          })()}
        </div>

        <div className="stat-card p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">This Week</p>
          <p className={cn(
            "text-base md:text-2xl font-bold",
            weeklyPnl >= 0 ? 'text-profit' : 'text-loss'
          )}>
            {weeklyPnl >= 0 ? '+' : ''}${Math.abs(weeklyPnl).toFixed(0)}
          </p>
        </div>

        <div className="stat-card p-3 md:p-4">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">Goal</p>
          <p className="text-base md:text-2xl font-bold text-primary">{weeklyGoalProgress}%</p>
        </div>
      </div>

      {/* Action Buttons Row - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <Button 
          variant="outline" 
          onClick={() => {
            if (!canUseImports) {
              setUpgradeFeature('CSV Export');
              setShowUpgradeModal(true);
              return;
            }
            exportToCSV();
          }} 
          className={cn("btn-glass border-0", !canUseImports && "opacity-60")}
        >
          {canUseImports ? <Download className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          Export CSV
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            if (!canUseImports) {
              setUpgradeFeature('CSV Import');
              setShowUpgradeModal(true);
              return;
            }
            // Future: actual import functionality
          }} 
          className={cn("btn-glass border-0", !canUseImports && "opacity-60")}
          disabled={canUseImports}
        >
          {canUseImports ? <Upload className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          Import CSV
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            if (!canUseImports) {
              setUpgradeFeature('Merge Positions');
              setShowUpgradeModal(true);
              return;
            }
            setShowMergeModal(true);
          }} 
          className={cn("btn-glass border-0", !canUseImports && "opacity-60")}
        >
          {canUseImports ? <Merge className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          Merge Positions
        </Button>
      </div>

      {/* Tabs */}
      <div className="content-card">
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="tabs-glass mb-4 w-auto">
            <TabsTrigger 
              value="calendar" 
              className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-4"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Calendar</span>
            </TabsTrigger>
            <TabsTrigger 
              value="list" 
              className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-4"
            >
              <List className="h-4 w-4" />
              <span className="text-xs sm:text-sm">List</span>
            </TabsTrigger>
            <TabsTrigger 
              value="open" 
              className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-4"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Open</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-0">
            <TradeGroupCalendar 
              groups={groups}
              onUpdateImages={handleUpdateImages}
              onClosePosition={handleClosePosition}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <TradeGroupList 
              groups={groups}
              onDelete={deleteGroup}
              onAddToPosition={handleAddToPosition}
              onClosePosition={handleClosePosition}
              onUpdateImages={handleUpdateImages}
              onUpdateGroup={async (groupId, data) => {
                await updateGroup(groupId, data);
              }}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="open" className="mt-0">
            {openGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No open positions</p>
                <p className="text-sm">Add a trade to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openGroups.map(group => {
                  const expired = isExpiredOption(group);
                  
                  return (
                    <div 
                      key={group.id} 
                      className={cn(
                        "p-4 rounded-xl bg-background border transition-colors cursor-pointer",
                        expired 
                          ? "border-loss/30 hover:border-loss/50" 
                          : "border-border hover:border-primary/30"
                      )}
                      onClick={() => handleOpenTradeClick(group)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <TickerLogo symbol={group.ticker} size="md" />
                          <div>
                            <p className="font-semibold text-foreground">
                              {group.ticker}
                              {group.strike_price && <span className="text-muted-foreground"> ${group.strike_price}</span>}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {group.trade_type} • {group.remaining_qty} contract{group.remaining_qty > 1 ? 's' : ''}
                              {group.expiration_date && <span> • Exp: {format(parseDateOnly(group.expiration_date), 'MMM d')}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expired ? (
                            <Badge variant="outline" className="bg-loss/10 text-loss border-loss/30">
                              <Clock className="h-3 w-3 mr-1" />
                              Expired
                            </Badge>
                          ) : (
                            <span className="badge-profit">Open</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Avg Entry</p>
                          <p className="font-medium">${group.avg_entry_price.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Entry Date</p>
                          <p className="font-medium">{format(parseDateOnly(group.entry_date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {expired ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 border-loss/30 text-loss hover:bg-loss/10"
                            onClick={() => handleCloseExpired(group)}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Close at $0
                          </Button>
                        ) : (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setCloseGroup(group)}
                            >
                              Close Position
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => setDcaGroup(group)}
                            >
                              Add Contracts
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AddTradeGroupModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSubmit={async (data) => {
          const result = await createGroup(data);
          if (!result.error) {
            setShowAddModal(false);
          }
          return result;
        }}
      />
      
      <AccountSettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
      />
      
      <DepositsModal
        open={showDepositsModal}
        onOpenChange={setShowDepositsModal}
      />
      
      <CloseWeekModal
        open={showCloseWeekModal}
        onOpenChange={setShowCloseWeekModal}
        currentBalance={currentBalance}
        weeklyPnl={weeklyPnl}
      />

      <MergePositionsModal
        open={showMergeModal}
        onOpenChange={setShowMergeModal}
        groups={groups}
        onMergeComplete={refetch}
      />

      {/* DCA Modal */}
      {dcaGroup && (
        <DCAGroupModal
          open={!!dcaGroup}
          onOpenChange={(open) => !open && setDcaGroup(null)}
          group={dcaGroup}
          onAddToPosition={async (quantity, price, date) => {
            await handleAddToPosition(dcaGroup.id, quantity, price, date);
            setDcaGroup(null);
          }}
        />
      )}

      {/* Close Position Modal */}
      {closeGroup && (
        <CloseGroupModal
          open={!!closeGroup}
          onOpenChange={(open) => !open && setCloseGroup(null)}
          group={closeGroup}
          onClosePosition={async (quantity, price, date) => {
            await handleClosePosition(closeGroup.id, quantity, price, date);
            setCloseGroup(null);
          }}
        />
      )}

      {/* Trade Detail Sheet for Open Trades */}
      {selectedGroup && (
        <TradeGroupDetailSheet
          open={showDetailSheet}
          onOpenChange={setShowDetailSheet}
          group={selectedGroup}
          onUpdateImages={async (groupId, images) => {
            await updateGroup(groupId, { images });
          }}
          onRefresh={refetch}
        />
      )}

      {/* Upgrade Modal for gated features */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature={upgradeFeature}
      />
    </div>
    </PullToRefresh>
  );
}
