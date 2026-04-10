import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { Bell, Inbox, TrendingUp, Megaphone, X, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/hooks/useNotificationHistory';
import { haptics } from '@/lib/haptics';
import { formatTimeWithTimezone } from '@/lib/timeFormatting';
import { useAccountSettings } from '@/hooks/useAccountSettings';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCompleteTask?: (reminderId: string, notificationId: string) => void;
  onClick?: () => void;
}

const typeConfig = {
  reminder: {
    icon: Bell,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  price_alert: {
    icon: TrendingUp,
    color: 'text-gain',
    bg: 'bg-gain/10',
  },
  trade_inbox: {
    icon: Inbox,
    color: 'text-chart-2',
    bg: 'bg-chart-2/10',
  },
  announcement: {
    icon: Megaphone,
    color: 'text-chart-4',
    bg: 'bg-chart-4/10',
  },
};

export function NotificationItem({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  onCompleteTask,
  onClick 
}: NotificationItemProps) {
  const config = typeConfig[notification.type] || typeConfig.reminder;
  const Icon = config.icon;
  const { settings } = useAccountSettings();
  
  const createdAt = parseISO(notification.created_at);
  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });
  
  // For reminder notifications, show scheduled time with timezone if available
  const scheduledTime = notification.type === 'reminder' && notification.data?.dueAt
    ? formatTimeWithTimezone(notification.data.dueAt as string, { userTimezone: settings?.timezone })
    : null;
  
  // Check if this is a reminder notification with a linked task
  const reminderId = notification.type === 'reminder' 
    ? (notification.data as Record<string, unknown>)?.reminderId as string | undefined
    : undefined;

  // Swipe state for mobile
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    const diff = startX.current - e.touches[0].clientX;
    // Only allow swiping left (positive diff)
    if (diff > 0) {
      setSwipeX(Math.min(diff, 100));
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    
    if (swipeX > 80 && onDelete) {
      haptics.heavy();
      onDelete(notification.id);
    }
    setSwipeX(0);
  };

  const handleClick = () => {
    if (swipeX > 10) return; // Don't trigger click during swipe
    haptics.light();
    if (!notification.is_read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    onClick?.();
  };

  return (
    <div className="relative overflow-hidden rounded-lg animate-fade-in">
      {/* Swipe delete background */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-destructive transition-opacity",
          swipeX > 20 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: '100px' }}
      >
        <Trash2 className="h-5 w-5 text-destructive-foreground" />
      </div>
      
      {/* Main content */}
      <div
        className={cn(
          "flex items-start gap-3 p-3 cursor-pointer transition-all relative group",
          "bg-card border border-border shadow-sm",
          "hover:bg-accent hover:border-primary/30 hover:shadow-md",
          !notification.is_read && "border-l-2 border-l-primary"
        )}
        style={{ 
          transform: `translateX(-${swipeX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.2s ease-out'
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      {/* Icon */}
      <div className={cn("h-9 w-9 rounded-lg shrink-0 flex items-center justify-center", config.bg)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 pr-10">
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-sm text-foreground line-clamp-1",
            !notification.is_read && "font-medium"
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {notification.body}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {scheduledTime ? `${scheduledTime} • ${timeAgo}` : timeAgo}
        </p>
      </div>

      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {/* Complete task button - only for reminder notifications */}
        {reminderId && onCompleteTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity shrink-0 hover:bg-profit/10"
            onClick={(e) => {
              e.stopPropagation();
              haptics.medium();
              onCompleteTask(reminderId, notification.id);
            }}
            title="Complete task"
            aria-label="Complete task"
          >
            <CheckCircle className="h-3.5 w-3.5 text-profit" />
          </Button>
        )}
        {/* Dismiss button */}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      </div>
    </div>
  );
}

// Group notifications by date
export function groupNotificationsByDate(notifications: Notification[]) {
  const groups: { label: string; notifications: Notification[] }[] = [];
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const earlier: Notification[] = [];

  notifications.forEach((notification) => {
    const date = parseISO(notification.created_at);
    if (isToday(date)) {
      today.push(notification);
    } else if (isYesterday(date)) {
      yesterday.push(notification);
    } else {
      earlier.push(notification);
    }
  });

  if (today.length > 0) {
    groups.push({ label: 'Today', notifications: today });
  }
  if (yesterday.length > 0) {
    groups.push({ label: 'Yesterday', notifications: yesterday });
  }
  if (earlier.length > 0) {
    groups.push({ label: 'Earlier', notifications: earlier });
  }

  return groups;
}
