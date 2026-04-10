import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { NotificationItem, groupNotificationsByDate } from './NotificationItem';
import { TradeInboxNotificationItem } from './TradeInboxNotificationItem';
import { useTradeInbox } from '@/hooks/useTradeInbox';
import { useReminders } from '@/hooks/useReminders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Settings, Loader2, Inbox, ChevronRight, Bell, BookOpen, TrendingUp, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TradeInboxContent } from '@/components/journal/TradeInboxContent';
import { NoteDetailSheet } from '@/components/notes/NoteDetailSheet';
import { supabase } from '@/lib/supabase';
import type { Note, Reminder } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import type { Notification } from '@/hooks/useNotificationHistory';

interface NotificationCenterProps {
  onClose?: () => void;
  className?: string;
}

type TabValue = 'all' | 'trade_inbox' | 'playbook' | 'alerts';

export function NotificationCenter({ onClose, className }: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [tradeDetailOpen, setTradeDetailOpen] = useState(false);
  const [tradeDetailItemId, setTradeDetailItemId] = useState<string | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTaskNote, setSelectedTaskNote] = useState<Note | null>(null);
  const navigate = useNavigate();
  
  // Get trade inbox items for the Trade Inbox tab
  const { items: tradeInboxItems, counts: inboxCounts, isLoading: inboxLoading, updateStatus, deleteItem } = useTradeInbox();
  
  // Get reminders for playbook tab
  const { groupedReminders, isLoading: remindersLoading, toggleComplete, dismissReminder } = useReminders();
  
  // Filter to actionable items only (pending, needs_review, action_required)
  const actionableInboxItems = tradeInboxItems.filter(
    item => item.status === 'pending' || item.status === 'needs_review' || item.status === 'action_required'
  );
  
  // Get TRIGGERED playbook tasks only - where due_at has passed
  // This ensures the badge only counts reminders whose scheduled time has arrived
  const pendingPlaybookTasks = groupedReminders.triggered || [];

  // Map tab values to notification types for filtering (excluding trade_inbox which uses different source)
  const getTypeFilter = (tab: TabValue): string | undefined => {
    switch (tab) {
      case 'playbook': return 'reminder';
      case 'alerts': return undefined; // Will filter for price_alert, announcement in the query
      default: return undefined; // all - no filter, trade_inbox uses separate source
    }
  };

  const { 
    notifications, 
    unreadCount, 
    isLoading: notificationsLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotificationHistory(getTypeFilter(activeTab));

  // For alerts tab, filter notifications manually since we need multiple types
  const filteredNotifications = activeTab === 'alerts' 
    ? notifications.filter(n => n.type === 'price_alert' || n.type === 'announcement')
    : activeTab === 'trade_inbox'
    ? [] // Trade Inbox tab uses different data source
    : notifications.filter(n => n.type !== 'trade_inbox'); // Exclude trade_inbox from All tab (we show live data instead)

  const groupedNotifications = groupNotificationsByDate(filteredNotifications);

  const handleSettingsClick = () => {
    navigate('/settings/notifications?tab=settings');
    onClose?.();
  };

  const handleViewAllClick = () => {
    navigate('/settings/notifications');
    onClose?.();
  };

  const handleNotificationClick = (notification: { type: string; data?: Record<string, unknown> | null }) => {
    // Navigate based on notification type
    switch (notification.type) {
      case 'trade_inbox':
        navigate('/trade-inbox');
        break;
      case 'reminder':
        navigate('/playbook');
        break;
      case 'price_alert':
        navigate('/watchlist');
        break;
      default:
        // For announcements and other types, just mark as read
        break;
    }
    onClose?.();
  };

  const handleTradeInboxItemClick = (itemId: string) => {
    // Open trade detail dialog instead of navigating
    setTradeDetailItemId(itemId);
    setTradeDetailOpen(true);
  };

  const handleImportTrade = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    // Open detail popup for review before import
    setTradeDetailItemId(itemId);
    setTradeDetailOpen(true);
  };

  const handleIgnoreTrade = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    await updateStatus(itemId, 'ignored');
  };

  const getTabCount = (tab: TabValue): number => {
    switch (tab) {
      case 'trade_inbox':
        // Use LIVE count from trade_inbox table
        return actionableInboxItems.length;
      case 'playbook':
        return pendingPlaybookTasks.length;
      case 'alerts':
        return notifications.filter(n => (n.type === 'price_alert' || n.type === 'announcement') && !n.is_read).length;
      case 'all':
        // Aggregate: trade inbox pending + playbook tasks + unread notifications
        return actionableInboxItems.length + pendingPlaybookTasks.length + notifications.filter(n => n.type !== 'trade_inbox' && !n.is_read).length;
      default:
        return 0;
    }
  };

  const isLoading = notificationsLoading || inboxLoading || remindersLoading;
  const totalCount = getTabCount('all');

  const renderTradeInboxItems = () => {
    if (actionableInboxItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="h-12 w-12 rounded-full bg-profit/10 flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-profit/60" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No pending trades</p>
          <p className="text-xs text-muted-foreground">
            Trades will appear here when imported via email
          </p>
        </div>
      );
    }

    return (
      <div className="p-2 space-y-2">
        {actionableInboxItems.map((item) => (
          <TradeInboxNotificationItem
            key={item.id}
            item={item}
            onClick={() => handleTradeInboxItemClick(item.id)}
            onImport={(e) => handleImportTrade(e, item.id)}
            onIgnore={(e) => handleIgnoreTrade(e, item.id)}
          />
        ))}
      </div>
    );
  };

  const renderNotifications = () => {
    if (filteredNotifications.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="h-12 w-12 rounded-full bg-profit/10 flex items-center justify-center mb-3">
            <Check className="h-6 w-6 text-profit/60" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">You're all caught up!</p>
          <p className="text-xs text-muted-foreground">
            No notifications to show
          </p>
        </div>
      );
    }

    return (
      <div className="p-2 space-y-2">
        {groupedNotifications.map((group) => (
          <div key={group.label}>
            <div className="px-2 py-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
            </div>
            <div className="space-y-2">
              {group.notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={() => handleDeleteNotification(notification)}
                  onCompleteTask={handleCompleteTaskFromNotification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleTaskClick = async (task: Reminder) => {
    // Reminders can be associated with notes - fetch the parent note and open its detail
    if (task.note_id) {
      const { data: note } = await supabase
        .from('notes')
        .select('*')
        .eq('id', task.note_id)
        .single();
      
      if (note) {
        setSelectedTaskNote(note as Note);
        setTaskDetailOpen(true);
        return;
      }
    }
    // For standalone reminders without a note, navigate to playbook
    navigate('/playbook');
    onClose?.();
  };

  // Dismiss a task from the notification center (sets dismissed_at on the reminder)
  const handleDismissTask = async (taskId: string) => {
    await dismissReminder(taskId);
  };

  // Handle deleting a notification - also dismiss linked reminder if present
  const handleDeleteNotification = async (notification: Notification) => {
    // If this is a reminder notification, also dismiss the underlying reminder
    const reminderId = notification.type === 'reminder' 
      ? (notification.data as Record<string, unknown>)?.reminderId as string | undefined
      : undefined;
    
    if (reminderId) {
      await dismissReminder(reminderId);
    }
    deleteNotification(notification.id);
  };

  // Complete a task from a notification - marks task complete AND deletes notification
  const handleCompleteTaskFromNotification = async (reminderId: string, notificationId: string) => {
    await toggleComplete(reminderId, true);
    deleteNotification(notificationId);
  };

  const renderPlaybookItems = () => {
    if (pendingPlaybookTasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="h-12 w-12 rounded-full bg-profit/10 flex items-center justify-center mb-3">
            <BookOpen className="h-6 w-6 text-profit/60" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No pending tasks</p>
          <p className="text-xs text-muted-foreground">
            Your playbook tasks will appear here
          </p>
        </div>
      );
    }

    return (
      <div className="p-2 space-y-2">
        {pendingPlaybookTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => handleTaskClick(task)}
            className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:bg-accent hover:border-primary/30 transition-all shadow-sm relative group"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 pr-10">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {task.title}
                  </p>
                  {!task.is_completed && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {task.description}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {task.due_date ? (() => {
                    const dateStr = format(parseISO(task.due_date), 'MMM d');
                    if (task.reminder_time) {
                      const timeParts = task.reminder_time.split(':');
                      const timeStr = format(new Date(0, 0, 0, parseInt(timeParts[0]), parseInt(timeParts[1])), 'h:mm a');
                      return `Due: ${dateStr} at ${timeStr}`;
                    }
                    return `Due: ${dateStr}`;
                  })() : 'No due date'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity shrink-0 absolute top-2 right-2 hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                handleDismissTask(task.id);
              }}
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  const renderAllTab = () => {
    // For All tab, show both trade inbox items and notifications
    const hasTradeInboxItems = actionableInboxItems.length > 0;
    const hasPlaybookTasks = pendingPlaybookTasks.length > 0;
    const hasNotifications = filteredNotifications.length > 0;

    if (!hasTradeInboxItems && !hasPlaybookTasks && !hasNotifications) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="h-12 w-12 rounded-full bg-profit/10 flex items-center justify-center mb-3">
            <Check className="h-6 w-6 text-profit/60" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">All caught up!</p>
          <p className="text-xs text-muted-foreground">
            No pending notifications
          </p>
        </div>
      );
    }

    return (
      <div className="p-2 space-y-3">
        {/* Trade Inbox Items Section */}
        {hasTradeInboxItems && (
          <div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Inbox className="h-3 w-3" />
                Trade Inbox
              </p>
              <button
                onClick={() => setActiveTab('trade_inbox')}
                className="text-[10px] text-primary hover:text-primary/80 font-medium"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {actionableInboxItems.map((item) => (
                <TradeInboxNotificationItem
                  key={item.id}
                  item={item}
                  onClick={() => handleTradeInboxItemClick(item.id)}
                  onImport={(e) => handleImportTrade(e, item.id)}
                  onIgnore={(e) => handleIgnoreTrade(e, item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Playbook Tasks Section */}
        {hasPlaybookTasks && (
          <div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" />
                Playbook Tasks
              </p>
              <button
                onClick={() => setActiveTab('playbook')}
                className="text-[10px] text-primary hover:text-primary/80 font-medium"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {pendingPlaybookTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:bg-accent hover:border-primary/30 transition-all shadow-sm relative group"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bell className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 pr-10">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground line-clamp-1">
                          {task.title}
                        </p>
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {task.due_date ? `Due: ${task.due_date}` : 'No due date'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity shrink-0 absolute top-2 right-2 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismissTask(task.id);
                    }}
                    aria-label="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notification Groups */}
        {groupedNotifications.map((group) => (
          <div key={group.label}>
            <div className="px-2 py-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
            </div>
            <div className="space-y-2">
              {group.notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={() => handleDeleteNotification(notification)}
                  onCompleteTask={handleCompleteTaskFromNotification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className={cn("flex flex-col h-full bg-background", className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 shrink-0">
          <h2 className="font-semibold text-foreground">Your Notifications</h2>
          {totalCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-muted-foreground h-8 gap-1.5 hover:text-foreground"
              onClick={() => markAllAsRead()}
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Tabs - Equally aligned */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="flex-1 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border bg-muted/30 shrink-0">
            <TabsList className="w-full grid grid-cols-4 bg-transparent h-9 p-0 gap-1">
              <TabsTrigger 
                value="all" 
                className="text-xs h-8 px-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm bg-muted/60 border border-transparent data-[state=active]:border-primary/20"
              >
                All{getTabCount('all') > 0 && ` ${getTabCount('all')}`}
              </TabsTrigger>
              <TabsTrigger 
                value="trade_inbox" 
                className="text-xs h-8 px-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm bg-muted/60 border border-transparent data-[state=active]:border-primary/20"
              >
                Inbox{getTabCount('trade_inbox') > 0 && ` ${getTabCount('trade_inbox')}`}
              </TabsTrigger>
              <TabsTrigger 
                value="playbook" 
                className="text-xs h-8 px-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm bg-muted/60 border border-transparent data-[state=active]:border-primary/20"
              >
                Tasks{getTabCount('playbook') > 0 && ` ${getTabCount('playbook')}`}
              </TabsTrigger>
              <TabsTrigger 
                value="alerts" 
                className="text-xs h-8 px-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm bg-muted/60 border border-transparent data-[state=active]:border-primary/20"
              >
                Alerts
              </TabsTrigger>
            </TabsList>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <TabsContent value="all" className="m-0 min-h-0">
                {renderAllTab()}
              </TabsContent>
              <TabsContent value="trade_inbox" className="m-0 min-h-0">
                {renderTradeInboxItems()}
              </TabsContent>
              <TabsContent value="playbook" className="m-0 min-h-0">
                {renderPlaybookItems()}
              </TabsContent>
              <TabsContent value="alerts" className="m-0 min-h-0">
                {renderNotifications()}
              </TabsContent>
            </ScrollArea>
          )}
        </Tabs>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-card/50 shrink-0">
          <Button 
            variant="outline" 
            className="w-full h-10 text-sm font-medium"
            onClick={handleViewAllClick}
          >
            View all notifications
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Trade Detail Dialog */}
      <Dialog open={tradeDetailOpen} onOpenChange={setTradeDetailOpen}>
        <DialogContent className="max-w-lg w-full bg-card border-border max-h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Trade Details
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <TradeInboxContent 
              mode="dialog" 
              initialItemId={tradeDetailItemId} 
              onClose={() => setTradeDetailOpen(false)} 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Task/Note Detail Sheet */}
      <NoteDetailSheet
        note={selectedTaskNote}
        open={taskDetailOpen}
        onOpenChange={(open) => {
          setTaskDetailOpen(open);
          if (!open) setSelectedTaskNote(null);
        }}
        onSave={async () => {
          // Just close for now - note saving is handled within the sheet
        }}
        onDelete={async () => {
          setTaskDetailOpen(false);
          setSelectedTaskNote(null);
        }}
        onTogglePin={async () => {}}
      />
    </>
  );
}
