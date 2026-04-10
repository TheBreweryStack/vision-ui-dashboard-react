import React from 'react';
import { useReminders } from '@/hooks/useReminders';
import { CommandDialog, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Bell, AlertCircle, Clock, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface AlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AlertsDialog: React.FC<AlertsDialogProps> = ({ open, onOpenChange }) => {
  const { groupedReminders, toggleComplete, isLoading } = useReminders();
  const navigate = useNavigate();

  const overdueCount = groupedReminders.overdue.length;
  const todayCount = groupedReminders.today.length;
  const totalAlerts = overdueCount + todayCount;

  const handleViewAll = () => {
    onOpenChange(false);
    navigate('/reminders');
  };

  const handleToggleComplete = async (id: string, currentStatus: boolean) => {
    await toggleComplete(id, !currentStatus);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-loss/20 text-loss border-loss/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const renderReminder = (reminder: ReturnType<typeof useReminders>['reminders'][number]) => (
    <CommandItem
      key={reminder.id}
      className="flex items-center gap-3 p-3 cursor-pointer"
      onSelect={() => handleToggleComplete(reminder.id, reminder.is_completed)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {reminder.ticker ? (
          <TickerLogo symbol={reminder.ticker} size="sm" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{reminder.title}</span>
            {reminder.ticker && (
              <Badge variant="outline" className="text-xs h-5">
                {reminder.ticker}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {reminder.due_date 
                ? format(parseISO(reminder.due_date.split('T')[0]), 'MMM d, yyyy')
                : 'No date'}
            </span>
          </div>
        </div>
      </div>
      <Badge className={cn('text-xs h-5 capitalize', getPriorityColor(reminder.priority))}>
        {reminder.priority}
      </Badge>
    </CommandItem>
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="p-2 rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alerts & Reminders</h2>
          <p className="text-sm text-muted-foreground">Your upcoming reminders</p>
        </div>
        {totalAlerts > 0 && (
          <Badge className="ml-auto bg-loss text-loss-foreground">
            {totalAlerts}
          </Badge>
        )}
      </div>

      <CommandList className="max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : totalAlerts === 0 && groupedReminders.tomorrow.length === 0 ? (
          <CommandEmpty className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="p-4 rounded-full bg-secondary/50">
                <CheckCircle2 className="h-8 w-8 text-profit" />
              </div>
              <div>
                <p className="font-medium text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground">No pending alerts or reminders</p>
              </div>
            </div>
          </CommandEmpty>
        ) : (
          <>
            {/* Overdue */}
            {groupedReminders.overdue.length > 0 && (
              <CommandGroup heading={
                <span className="flex items-center gap-2 text-loss">
                  <AlertCircle className="h-4 w-4" />
                  Overdue ({groupedReminders.overdue.length})
                </span>
              }>
                {groupedReminders.overdue.map(renderReminder)}
              </CommandGroup>
            )}

            {/* Today */}
            {groupedReminders.today.length > 0 && (
              <CommandGroup heading={
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Today ({groupedReminders.today.length})
                </span>
              }>
                {groupedReminders.today.map(renderReminder)}
              </CommandGroup>
            )}

            {/* Tomorrow */}
            {groupedReminders.tomorrow.length > 0 && (
              <CommandGroup heading={
                <span className="flex items-center gap-2 text-muted-foreground">
                  Tomorrow ({groupedReminders.tomorrow.length})
                </span>
              }>
                {groupedReminders.tomorrow.slice(0, 3).map(renderReminder)}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-between text-muted-foreground hover:text-foreground"
          onClick={handleViewAll}
        >
          View all reminders
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </CommandDialog>
  );
};
