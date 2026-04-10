import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, DollarSign, Calendar, TrendingUp, 
  Megaphone, ArrowLeft, Loader2, CheckCircle2,
  Inbox, Trash2, AlertCircle, FileText, ExternalLink, BookOpen, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useTradeInbox } from '@/hooks/useTradeInbox';
import { useReminders } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { getSourceDisplayName, ParsedTrade } from '@/lib/tradeInbox';
import { TickerLogo } from '@/components/common/TickerLogo';
import { logger } from '@/lib/logger';

interface PriceAlert {
  id: string;
  alert_type: string;
  threshold: number | null;
  triggered_at: string | null;
  watchlist_items: { ticker: string } | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  is_pinned: boolean;
  created_at: string;
}

type TabValue = 'all' | 'trade_inbox' | 'playbook' | 'alerts';

const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Map old 'settings' tab to 'all' since settings tab is removed
  const tabParam = searchParams.get('tab') as string;
  const initialTab: TabValue = tabParam === 'settings' ? 'all' : (tabParam as TabValue) || 'all';
  
  const { items: inboxItems, counts: inboxCounts, deleteItem: deleteInboxItem, updateStatus } = useTradeInbox();
  const { groupedReminders, toggleComplete, isLoading: remindersLoading } = useReminders();
  
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Filter inbox items
  const pendingInboxItems = inboxItems.filter(item => 
    item.status === 'pending' || item.status === 'action_required' || item.status === 'needs_review'
  );

  // Get pending tasks from reminders
  const pendingTasks = [
    ...groupedReminders.overdue,
    ...groupedReminders.today,
    ...groupedReminders.tomorrow,
    ...groupedReminders.thisWeek,
  ];

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('alerts')
        .select('*, watchlist_items(ticker)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .not('triggered_at', 'is', null)
        .order('triggered_at', { ascending: false })
        .limit(20);
      setAlerts((data as PriceAlert[]) || []);
    } catch (error) {
      logger.error('Error fetching alerts:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();
    fetchAnnouncements();
    setIsLoading(false);
  }, [user, fetchAlerts]);

  const fetchAnnouncements = async () => {
    try {
      const { data } = await supabase
        .from('announcements_public')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      setAnnouncements((data as Announcement[]) || []);
    } catch (error) {
      logger.error('Error fetching announcements:', error);
    }
  };

  const clearAlert = async (alertId: string) => {
    try {
      await supabase
        .from('alerts')
        .update({ triggered_at: null })
        .eq('id', alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert cleared');
    } catch (error) {
      toast.error('Failed to clear alert');
    }
  };



  const handleDeleteInboxItem = async (id: string) => {
    await deleteInboxItem(id);
    toast.success('Item deleted');
  };

  const handleIgnoreInboxItem = async (id: string) => {
    await updateStatus(id, 'ignored');
    toast.success('Trade ignored');
  };

  const handleImportInboxItem = (id: string) => {
    navigate(`/trade-inbox?itemId=${id}`);
  };

  const handleTaskToggle = async (id: string, isCompleted: boolean) => {
    await toggleComplete(id, !isCompleted);
  };

  const notificationTypes = [
    {
      key: 'price_alerts' as const,
      icon: DollarSign,
      title: 'Price Alerts',
      description: 'Get notified when a stock hits your price target',
    },
    {
      key: 'reminder_alerts' as const,
      icon: Calendar,
      title: 'Reminder Alerts',
      description: 'Receive reminders for your scheduled trading tasks',
    },
    {
      key: 'trade_updates' as const,
      icon: TrendingUp,
      title: 'Trade Updates',
      description: 'Notifications about your open positions and trades',
    },
    {
      key: 'announcement_alerts' as const,
      icon: Megaphone,
      title: 'Announcements',
      description: 'Important updates and news from TraderCafé',
    },
  ];

  // Calculate tab counts
  const getTabCount = (tab: TabValue): number => {
    switch (tab) {
      case 'trade_inbox':
        return pendingInboxItems.length;
      case 'playbook':
        return groupedReminders.overdue.length + groupedReminders.today.length;
      case 'alerts':
        return alerts.length;
      case 'all':
        return pendingInboxItems.length + groupedReminders.overdue.length + groupedReminders.today.length + alerts.length;
      default:
        return 0;
    }
  };

  if (isLoading || remindersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6 animate-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">View alerts and configure preferences</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-6 bg-muted p-1.5 rounded-xl border border-border">
          <TabsTrigger 
            value="all" 
            className="text-xs rounded-lg font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center justify-center gap-1"
          >
            All
            {getTabCount('all') > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center bg-loss text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {getTabCount('all')}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="trade_inbox" 
            className="text-xs rounded-lg font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center justify-center gap-1"
          >
            Inbox
            {getTabCount('trade_inbox') > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center bg-loss text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {getTabCount('trade_inbox')}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="playbook" 
            className="text-xs rounded-lg font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center justify-center gap-1"
          >
            Tasks
            {getTabCount('playbook') > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center bg-loss text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {getTabCount('playbook')}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="alerts" 
            className="text-xs rounded-lg font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md flex items-center justify-center gap-1"
          >
            Alerts
            {getTabCount('alerts') > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center bg-loss text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {getTabCount('alerts')}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All Tab */}
        <TabsContent value="all" className="space-y-4">
          {getTabCount('all') === 0 ? (
            <div className="bg-card border border-border rounded-xl text-center py-12 shadow-sm">
              <CheckCircle2 className="h-12 w-12 mx-auto text-profit/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">All caught up!</h3>
              <p className="text-sm text-muted-foreground">
                No pending notifications
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-4">
                {/* Trade Inbox Section */}
                {pendingInboxItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Inbox className="h-4 w-4" />
                        Trade Inbox
                      </h3>
                      <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => setActiveTab('trade_inbox')}>
                        View all →
                      </Button>
                    </div>
                    {pendingInboxItems.slice(0, 3).map((item) => {
                      const parsed = item.parsed_trade as ParsedTrade | null;
                      return (
                        <div
                          key={item.id}
                          className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            {parsed?.symbol ? (
                              <TickerLogo symbol={parsed.symbol} size="sm" />
                            ) : (
                              <div className={cn(
                                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                                item.status === 'action_required' ? "bg-warning/10" : "bg-primary/10"
                              )}>
                                {item.status === 'action_required' ? (
                                  <AlertCircle className="h-4 w-4 text-warning" />
                                ) : (
                                  <FileText className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-foreground truncate">
                                  {parsed?.symbol ? `New trade: ${parsed.symbol}` : 'Trade Confirmation'}
                                </p>
                                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {parsed ? `${parsed.action?.replace(/_/g, ' ')} ${parsed.quantity} @ $${parsed.price?.toFixed(2)}` : 'Pending review'}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {format(new Date(item.received_at), 'MMM d, h:mm a')}
                              </p>
                            </div>
                          </div>
                          {/* Import / Ignore buttons */}
                          <div className="flex items-center gap-2 mt-3 ml-12">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-3 border-yellow-500/30 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 hover:border-yellow-500/50"
                              onClick={(e) => { e.stopPropagation(); handleIgnoreInboxItem(item.id); }}
                            >
                              Ignore
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs px-3 bg-profit hover:bg-profit/90 text-white"
                              onClick={(e) => { e.stopPropagation(); handleImportInboxItem(item.id); }}
                            >
                              Import
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tasks Section */}
                {(groupedReminders.overdue.length > 0 || groupedReminders.today.length > 0) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Playbook Tasks
                      </h3>
                      <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => setActiveTab('playbook')}>
                        View all →
                      </Button>
                    </div>
                    {[...groupedReminders.overdue, ...groupedReminders.today].slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <Checkbox
                          checked={task.is_completed}
                          onCheckedChange={() => handleTaskToggle(task.id, task.is_completed)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {task.ticker && <TickerLogo symbol={task.ticker} size="sm" />}
                            <p className="font-medium text-foreground truncate">{task.title}</p>
                            {task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && (
                              <span className="text-[10px] font-medium text-loss bg-loss/10 px-1.5 py-0.5 rounded">Overdue</span>
                            )}
                            {task.due_date && isToday(parseISO(task.due_date)) && (
                              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Today</span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Alerts Section */}
                {alerts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Price Alerts
                      </h3>
                      <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => setActiveTab('alerts')}>
                        View all →
                      </Button>
                    </div>
                    {alerts.slice(0, 3).map((alert) => (
                      <div
                        key={alert.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{alert.watchlist_items?.ticker || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">Target: ${alert.threshold?.toFixed(2)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => { e.stopPropagation(); clearAlert(alert.id); }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Trade Inbox Tab */}
        <TabsContent value="trade_inbox" className="space-y-4">
          {pendingInboxItems.length === 0 ? (
            <div className="bg-card border border-border rounded-xl text-center py-12 shadow-sm">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No pending trades</h3>
              <p className="text-sm text-muted-foreground">
                Trade confirmations from email will appear here
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/trade-inbox')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Trade Inbox
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-3 pr-4">
                {pendingInboxItems.map((item) => {
                  const parsed = item.parsed_trade as ParsedTrade | null;
                  return (
                    <div
                      key={item.id}
                      className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {parsed?.symbol ? (
                          <TickerLogo symbol={parsed.symbol} size="sm" />
                        ) : (
                          <div className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                            item.status === 'action_required' ? "bg-warning/10" : "bg-primary/10"
                          )}>
                            {item.status === 'action_required' ? (
                              <AlertCircle className="h-4 w-4 text-warning" />
                            ) : (
                              <FileText className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground truncate">
                              {parsed?.symbol ? `New trade: ${parsed.symbol}` : 'Trade Confirmation'}
                            </p>
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {getSourceDisplayName(item.source, parsed)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {parsed ? (
                              <>
                                {parsed.action?.replace(/_/g, ' ')} {parsed.quantity} @ ${parsed.price?.toFixed(2)}
                              </>
                            ) : (
                              'Pending review'
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {format(new Date(item.received_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      {/* Import / Ignore buttons */}
                      <div className="flex items-center gap-2 mt-3 ml-12">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 border-yellow-500/30 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 hover:border-yellow-500/50"
                          onClick={(e) => { e.stopPropagation(); handleIgnoreInboxItem(item.id); }}
                        >
                          Ignore
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3 bg-profit hover:bg-profit/90 text-white"
                          onClick={(e) => { e.stopPropagation(); handleImportInboxItem(item.id); }}
                        >
                          Import
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/trade-inbox')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All in Trade Inbox
                </Button>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Playbook Tasks Tab */}
        <TabsContent value="playbook" className="space-y-4">
          {pendingTasks.length === 0 ? (
            <div className="bg-card border border-border rounded-xl text-center py-12 shadow-sm">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No pending tasks</h3>
              <p className="text-sm text-muted-foreground">
                Create tasks in your Playbook to stay organized
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/playbook')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Playbook
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-4">
                {/* Overdue */}
                {groupedReminders.overdue.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-loss flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Overdue
                    </h3>
                    {groupedReminders.overdue.map((task) => (
                      <div
                        key={task.id}
                        className="bg-card border border-loss/30 rounded-xl p-4 flex items-start gap-3 shadow-sm"
                      >
                        <Checkbox
                          checked={task.is_completed}
                          onCheckedChange={() => handleTaskToggle(task.id, task.is_completed)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {task.ticker && <TickerLogo symbol={task.ticker} size="sm" />}
                            <p className="font-medium text-foreground truncate">{task.title}</p>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                          )}
                          {task.due_date && (
                            <p className="text-xs text-loss mt-1">
                              Due: {format(parseISO(task.due_date), 'MMM d')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Today */}
                {groupedReminders.today.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Today
                    </h3>
                    {groupedReminders.today.map((task) => (
                      <div
                        key={task.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <Checkbox
                          checked={task.is_completed}
                          onCheckedChange={() => handleTaskToggle(task.id, task.is_completed)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {task.ticker && <TickerLogo symbol={task.ticker} size="sm" />}
                            <p className="font-medium text-foreground truncate">{task.title}</p>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tomorrow */}
                {groupedReminders.tomorrow.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Tomorrow
                    </h3>
                    {groupedReminders.tomorrow.map((task) => (
                      <div
                        key={task.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <Checkbox
                          checked={task.is_completed}
                          onCheckedChange={() => handleTaskToggle(task.id, task.is_completed)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {task.ticker && <TickerLogo symbol={task.ticker} size="sm" />}
                            <p className="font-medium text-foreground truncate">{task.title}</p>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* This Week */}
                {groupedReminders.thisWeek.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      This Week
                    </h3>
                    {groupedReminders.thisWeek.map((task) => (
                      <div
                        key={task.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <Checkbox
                          checked={task.is_completed}
                          onCheckedChange={() => handleTaskToggle(task.id, task.is_completed)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {task.ticker && <TickerLogo symbol={task.ticker} size="sm" />}
                            <p className="font-medium text-foreground truncate">{task.title}</p>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                          )}
                          {task.due_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(parseISO(task.due_date), 'EEEE, MMM d')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/playbook')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All in Playbook
                </Button>
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {/* Triggered Price Alerts */}
          {alerts.length === 0 && announcements.length === 0 ? (
            <div className="bg-card border border-border rounded-xl text-center py-12 shadow-sm">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No alerts</h3>
              <p className="text-sm text-muted-foreground">
                Price alerts and announcements will show up here
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/alerts')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Alerts
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-4 pr-4">
                {/* Triggered Price Alerts */}
                {alerts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Triggered Price Alerts
                    </h3>
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">
                              {alert.watchlist_items?.ticker || 'Unknown'}
                            </p>
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {alert.alert_type}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Target: ${alert.threshold?.toFixed(2)}
                          </p>
                          {alert.triggered_at && (
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              Triggered {format(new Date(alert.triggered_at), 'MMM d, h:mm a')}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={() => clearAlert(alert.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Announcements */}
                {announcements.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Megaphone className="h-4 w-4" />
                      Announcements
                    </h3>
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className={cn(
                          "bg-card border rounded-xl p-4 shadow-sm",
                          ann.priority === 'high' ? 'border-loss/30' : 'border-border'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                            ann.priority === 'high' ? 'bg-loss/10' : 'bg-primary/10'
                          )}>
                            <Megaphone className={cn(
                              "h-4 w-4",
                              ann.priority === 'high' ? 'text-loss' : 'text-primary'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground">{ann.title}</p>
                              {ann.is_pinned && (
                                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Pinned</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{ann.content}</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {format(new Date(ann.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/alerts')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage All Alerts
                </Button>
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationSettings;
