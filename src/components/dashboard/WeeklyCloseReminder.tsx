import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, X, Loader2 } from 'lucide-react';
import { getDay, startOfWeek, format, getHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface WeeklyCloseReminderProps {
  onCloseWeek: () => void;
  isWeekClosed?: boolean; // From dashboard data - skip DB query if provided
}

export default function WeeklyCloseReminder({ onCloseWeek, isWeekClosed }: WeeklyCloseReminderProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [isCheckingDB, setIsCheckingDB] = useState(true);

  useEffect(() => {
    const checkIfShouldShow = async () => {
      if (!user) {
        setIsCheckingDB(false);
        return;
      }

      const now = new Date();
      const dayOfWeek = getDay(now); // 0 = Sunday, 1 = Monday, 5 = Friday, 6 = Saturday
      const currentHour = getHours(now);
      
      // Show Friday (5), Saturday (6), Sunday (0), and Monday (1) before 9 AM
      const isFridayOrWeekend = dayOfWeek >= 5 || dayOfWeek === 0;
      const isMondayMorning = dayOfWeek === 1 && currentHour < 9;
      const shouldShowByTime = isFridayOrWeekend || isMondayMorning;
      
      if (!shouldShowByTime) {
        setShouldShow(false);
        setIsCheckingDB(false);
        return;
      }
      
      // Get the week key (based on week start date - Monday = weekStartsOn: 1)
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      // Check if dismissed with "Remind Me Later" - only valid until Monday 9 AM
      const dismissedKey = `weekly-close-dismissed-${weekKey}`;
      const dismissedAt = localStorage.getItem(dismissedKey);
      
      let isDismissedValid = false;
      if (dismissedAt) {
        // If it's Monday after 9 AM, clear the dismissal and show again
        if (dayOfWeek === 1 && currentHour >= 9) {
          localStorage.removeItem(dismissedKey);
        } else {
          isDismissedValid = true;
        }
      }
      
      if (isDismissedValid) {
        setShouldShow(false);
        setIsCheckingDB(false);
        return;
      }
      
      // If isWeekClosed is provided from dashboard data, use it directly (skip DB query)
      if (isWeekClosed !== undefined) {
        // Update localStorage to keep it in sync
        if (isWeekClosed) {
          const closedKey = `weekly-close-completed-${weekKey}`;
          localStorage.setItem(closedKey, 'true');
        }
        setShouldShow(!isWeekClosed);
        setIsCheckingDB(false);
        return;
      }
      
      // Fallback: Check database for actual closed status (source of truth)
      try {
        const { data, error } = await supabase
          .from('weekly_balances')
          .select('id')
          .eq('user_id', user.id)
          .eq('week_start_date', weekKey)
          .maybeSingle();
        
        if (error) {
          logger.error('Error checking weekly balance:', error);
        }
        
        const alreadyClosed = !!data;
        
        // Also update localStorage to keep it in sync
        if (alreadyClosed) {
          const closedKey = `weekly-close-completed-${weekKey}`;
          localStorage.setItem(closedKey, 'true');
        }
        
        setShouldShow(!alreadyClosed);
      } catch (error) {
        logger.error('Error checking weekly balance:', error);
        // Fallback to localStorage on error
        const closedKey = `weekly-close-completed-${weekKey}`;
        const alreadyClosed = localStorage.getItem(closedKey) === 'true';
        setShouldShow(!alreadyClosed);
      } finally {
        setIsCheckingDB(false);
      }
    };
    
    checkIfShouldShow();
  }, [user, isWeekClosed]);

  const handleDismiss = () => {
    // Store dismissal with week key - will be valid until Monday 9 AM
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    const dismissedKey = `weekly-close-dismissed-${weekKey}`;
    localStorage.setItem(dismissedKey, new Date().toISOString());
    setDismissed(true);
    setShouldShow(false);
  };

  const handleCloseWeek = () => {
    onCloseWeek();
    // Mark as completed for this week in localStorage (will be synced with DB when modal closes)
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    const closedKey = `weekly-close-completed-${weekKey}`;
    localStorage.setItem(closedKey, 'true');
  };

  // Don't show while checking database
  if (isCheckingDB) {
    return null;
  }

  if (!shouldShow || dismissed) {
    return null;
  }

  const now = new Date();
  const dayOfWeek = getDay(now);
  const dayMessage = dayOfWeek === 5 
    ? "It's Friday!" 
    : dayOfWeek === 6 
      ? "It's Saturday!" 
      : dayOfWeek === 0 
        ? "It's Sunday!" 
        : "It's Monday morning!";

  return (
    <div className={cn(
      "relative p-4 rounded-xl bg-primary/10 border border-primary/30",
      "animate-in fade-in slide-in-from-top-2 duration-300"
    )}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex items-start gap-3 pr-6">
        <div className="p-2 rounded-lg bg-primary/20">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground mb-1">Time to Close Your Week</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {dayMessage} Lock in your trading week results and set your goals for next week.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCloseWeek}>
              Close Week Now
            </Button>
            <Button size="sm" variant="outline" onClick={handleDismiss}>
              Remind Me Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
