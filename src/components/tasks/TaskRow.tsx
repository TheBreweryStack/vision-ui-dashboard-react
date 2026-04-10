import React from 'react';
import { cn } from '@/lib/utils';
import { Bell, Check, Inbox, Clock, ChevronRight, AlarmClock, CheckCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TickerLogo } from '@/components/common/TickerLogo';
import { formatDistanceToNow } from 'date-fns';
import { formatTimeWithTimezone } from '@/lib/timeFormatting';
import { useAccountSettings } from '@/hooks/useAccountSettings';

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

interface TaskRowProps {
  item: TaskItem;
  onNavigate?: (link: string) => void;
  onMarkDone?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onImport?: (id: string) => void;
  onReview?: (id: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

const getTaskIcon = (type: TaskItem['type']) => {
  switch (type) {
    case 'trade_inbox':
      return { icon: Inbox, color: 'bg-primary/20 text-primary' };
    case 'reminder':
      return { icon: Clock, color: 'bg-yellow-500/20 text-yellow-500' };
    default:
      return { icon: Bell, color: 'bg-secondary text-muted-foreground' };
  }
};

export function TaskRow({ 
  item, 
  onNavigate,
  onMarkDone,
  onSnooze,
  onImport,
  onReview,
  showActions = false,
  compact = false,
}: TaskRowProps) {
  const { icon: Icon, color } = getTaskIcon(item.type);
  const { settings } = useAccountSettings();
  
  // Format time with timezone for reminders, relative time for trade inbox
  const formattedTime = item.type === 'reminder' 
    ? formatTimeWithTimezone(item.timestamp, { userTimezone: settings?.timezone })
    : formatDistanceToNow(new Date(item.timestamp), { addSuffix: false });

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking action buttons
    if ((e.target as HTMLElement).closest('button')) return;
    onNavigate?.(item.link);
  };

  return (
    <div 
      className={cn(
        "flex items-start gap-3 hover:bg-muted/50 cursor-pointer transition-colors relative group",
        compact ? "p-3" : "p-4",
        item.priority === 'high' && "bg-primary/5"
      )}
      onClick={handleClick}
    >
      {/* Left indicator for high priority */}
      {item.priority === 'high' && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-loss rounded-r" />
      )}
      
      {/* Ticker Logo or Avatar/Icon */}
      {item.ticker ? (
        <TickerLogo symbol={item.ticker} size={compact ? "sm" : "md"} />
      ) : (
        <Avatar className={cn(compact ? "h-8 w-8" : "h-10 w-10", "shrink-0")}>
          <AvatarFallback className={cn("text-base", color)}>
            <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
          </AvatarFallback>
        </Avatar>
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium text-foreground truncate",
          compact ? "text-xs" : "text-sm"
        )}>
          {item.title}
        </p>
        <p className={cn(
          "text-muted-foreground mt-0.5",
          compact ? "text-[11px]" : "text-sm"
        )}>
          {item.subtitle}
        </p>
      </div>

      {/* Actions or Time */}
      <div className="flex items-center gap-2 shrink-0">
        {showActions ? (
          <div className={cn(
            "flex items-center gap-1",
            !compact && "opacity-0 group-hover:opacity-100 transition-opacity"
          )}>
            {item.type === 'reminder' && onMarkDone && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkDone(item.originalId);
                }}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Done
              </Button>
            )}
            {item.type === 'reminder' && onSnooze && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSnooze(item.originalId);
                }}
              >
                <AlarmClock className="h-3.5 w-3.5 mr-1" />
                Snooze
              </Button>
            )}
            {item.type === 'trade_inbox' && onImport && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-profit"
                onClick={(e) => {
                  e.stopPropagation();
                  onImport(item.originalId);
                }}
              >
                Review & Import
              </Button>
            )}
            {item.type === 'trade_inbox' && onReview && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onReview(item.originalId);
                }}
              >
                Review
              </Button>
            )}
          </div>
        ) : (
          <span className={cn(
            "text-muted-foreground shrink-0",
            compact ? "text-[10px]" : "text-xs"
          )}>
            {formattedTime}
          </span>
        )}
        
        {!showActions && (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}
