import { useMemo } from 'react';
import { useReminders } from './useReminders';
import { useTradeInbox } from './useTradeInbox';
import { isGmailVerification, ParsedTrade } from '@/lib/tradeInbox';

export interface TaskItem {
  id: string;
  type: 'reminder' | 'trade_inbox';
  title: string;
  subtitle: string;
  timestamp: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
  originalId: string;
  ticker?: string;
}

export function useTaskFeed() {
  const { groupedReminders, isLoading: remindersLoading } = useReminders();
  const { items: inboxItems, isLoading: inboxLoading } = useTradeInbox();

  const feed = useMemo(() => {
    const items: TaskItem[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Add triggered reminders only (where due_at has passed)
    (groupedReminders.triggered || []).forEach(r => {
      const isOverdue = r.due_at && new Date(r.due_at) < todayStart;
      items.push({
        id: `reminder-${r.id}`,
        type: 'reminder',
        title: r.title,
        subtitle: isOverdue ? 'Overdue' : 'Due now',
        timestamp: r.due_date || r.created_at,
        link: '/tasks',
        priority: isOverdue ? 'high' : 'medium',
        originalId: r.id,
        ticker: r.ticker || undefined,
      });
    });

    // Add pending/needs_review/action_required trade inbox items
    inboxItems
      .filter(i => 
        (i.status === 'pending' || i.status === 'needs_review' || i.status === 'action_required') &&
        !isGmailVerification(i.parsed_trade)
      )
      .forEach(i => {
        const parsed = i.parsed_trade as ParsedTrade | null;
        items.push({
          id: `inbox-${i.id}`,
          type: 'trade_inbox',
          title: parsed?.symbol || 'New Trade',
          subtitle: i.status === 'action_required' 
            ? 'Action required' 
            : i.status === 'needs_review' 
              ? 'Needs review' 
              : 'Ready to import',
          timestamp: i.received_at,
          link: '/trade-inbox',
          priority: i.status === 'action_required' ? 'high' : 'medium',
          originalId: i.id,
          ticker: parsed?.symbol || undefined,
        });
      });

    // Sort by priority first (high > medium > low), then by timestamp (newest first)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [groupedReminders, inboxItems]);

  const badgeCount = feed.length;

  const counts = useMemo(() => ({
    all: feed.length,
    reminders: feed.filter(i => i.type === 'reminder').length,
    trades: feed.filter(i => i.type === 'trade_inbox').length,
  }), [feed]);

  return {
    items: feed,
    badgeCount,
    counts,
    isLoading: remindersLoading || inboxLoading,
  };
}
