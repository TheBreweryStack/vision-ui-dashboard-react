import React, { useState, useEffect, useMemo } from 'react';
import { supabase, WeeklyBalance } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSettings } from '@/hooks/useAccountSettings';
import { useWeeklyBalances } from '@/hooks/useWeeklyBalances';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, DollarSign, Loader2, TrendingUp, TrendingDown, 
  Edit, Trash2, X, ChevronDown
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, parseISO, subWeeks, isSameWeek } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface CloseWeekModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  weeklyPnl: number;
}

export const CloseWeekModal: React.FC<CloseWeekModalProps> = ({
  open,
  onOpenChange,
  currentBalance,
  weeklyPnl,
}) => {
  const { user } = useAuth();
  const { settings } = useAccountSettings();
  const { weeklyBalances, addWeeklyBalance, updateWeeklyBalance, deleteWeeklyBalance, isLoading } = useWeeklyBalances();
  const queryClient = useQueryClient();
  
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0); // 0 = current week, 1 = last week, etc.

  // Generate past 8 weeks for selection (weekStartsOn: 1 = Monday)
  const availableWeeks = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < 8; i++) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const alreadyClosed = weeklyBalances.some(wb => 
        isSameWeek(parseISO(wb.week_start_date), weekStart, { weekStartsOn: 1 })
      );
      weeks.push({
        index: i,
        weekStart,
        weekEnd,
        label: i === 0 ? `This Week (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})` : 
               `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
        alreadyClosed,
      });
    }
    return weeks;
  }, [weeklyBalances]);

  const selectedWeek = availableWeeks[selectedWeekIndex];
  const weekStart = selectedWeek?.weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = selectedWeek?.weekEnd || endOfWeek(new Date(), { weekStartsOn: 1 });

  useEffect(() => {
    // Set initial values based on selected week
    const getOpeningBalanceForWeek = () => {
      // Find the closing balance of the previous week (weekStartsOn: 1 = Monday)
      const prevWeekStart = startOfWeek(subWeeks(weekStart, 1), { weekStartsOn: 1 });
      const prevWeekBalance = weeklyBalances.find(wb => 
        isSameWeek(parseISO(wb.week_start_date), prevWeekStart, { weekStartsOn: 1 })
      );
      
      if (prevWeekBalance) {
        // Use previous week's closing balance minus any withdrawal
        return prevWeekBalance.closing_balance - (prevWeekBalance.withdrawn_amount || 0);
      }
      
      // Fallback to starting balance from settings
      return settings?.starting_balance || 0;
    };

    const opening = getOpeningBalanceForWeek();
    setOpeningBalance(opening.toFixed(2));
    
    // For all weeks (including current), leave closing balance empty
    // User should enter the actual balance when they close the week
    setClosingBalance('');
  }, [weeklyBalances, settings, currentBalance, selectedWeekIndex, weekStart]);

  const handleCloseWeek = async () => {
    if (!user) return;

    if (selectedWeek?.alreadyClosed) {
      toast.error('This week has already been closed');
      return;
    }

    setIsSaving(true);
    try {
      const opening = parseFloat(openingBalance) || 0;
      const closing = parseFloat(closingBalance) || currentBalance;
      const withdrawal = parseFloat(withdrawalAmount) || 0;
      const pnl = closing - opening + withdrawal;

      await addWeeklyBalance({
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
        week_end_date: format(weekEnd, 'yyyy-MM-dd'),
        opening_balance: opening,
        closing_balance: closing,
        withdrawn_amount: withdrawal,
        notes: notes || undefined,
      });

      // Calculate next week's opening balance (closing - withdrawal)
      const nextWeekOpening = closing - withdrawal;
      
      // Always update starting balance to reflect the new week's opening
      await supabase
        .from('account_settings')
        .update({ starting_balance: nextWeekOpening })
        .eq('user_id', user.id);
      
      // Invalidate caches to reflect the new balance immediately
      queryClient.invalidateQueries({ queryKey: ['account-settings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      
      toast.success(`Starting balance updated to $${nextWeekOpening.toFixed(2)} for next week`);

      // Mark week as closed in localStorage for the reminder widget
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      localStorage.setItem(`weekly-close-completed-${weekKey}`, 'true');

      onOpenChange(false);
      setNotes('');
      setWithdrawalAmount('0');
      setSelectedWeekIndex(0);
    } catch (error) {
      logger.error('Error closing week:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWeek = async (id: string) => {
    if (!confirm('Delete this week record?')) return;
    await deleteWeeklyBalance(id);
  };

  const calculatePercentChange = (start: number, end: number) => {
    if (start === 0) return 0;
    return ((end - start) / start) * 100;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Close Week
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Week Selector */}
          <div className="space-y-2">
            <Label>Select Week to Close</Label>
            <Select 
              value={selectedWeekIndex.toString()} 
              onValueChange={(v) => setSelectedWeekIndex(parseInt(v))}
            >
              <SelectTrigger className="w-full bg-secondary/50 border-border/50">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((week) => (
                  <SelectItem 
                    key={week.index} 
                    value={week.index.toString()}
                    disabled={week.alreadyClosed}
                  >
                    <span className={cn(week.alreadyClosed && "text-muted-foreground line-through")}>
                      {week.label}
                      {week.alreadyClosed && " (closed)"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Week Period Display */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="font-semibold text-foreground">
              Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </p>
            {selectedWeek?.alreadyClosed && (
              <p className="text-sm text-loss mt-1">This week has already been closed</p>
            )}
          </div>

          {/* Balance Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Opening Balance (Monday)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="openingBalance"
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="pl-10 bg-secondary/50 border-primary"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingBalance">Closing Balance (Friday)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="closingBalance"
                  type="number"
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border/50"
                />
              </div>
            </div>
          </div>

          {/* Withdrawal */}
          <div className="space-y-2">
            <Label htmlFor="withdrawal">Amount to Withdraw</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="withdrawal"
                type="number"
                step="0.01"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will be subtracted from next week's opening balance
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="weekNotes">Notes (optional)</Label>
            <Textarea
              id="weekNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this week..."
              className="bg-secondary/50 border-border/50 resize-none"
              rows={3}
            />
          </div>

          {/* Close Week Button */}
          <Button 
            onClick={handleCloseWeek} 
            disabled={isSaving}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Close Week
          </Button>

          {/* Week History */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Week History</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : weeklyBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No history yet
              </p>
            ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {weeklyBalances.map(week => {
                  const percentChange = calculatePercentChange(week.opening_balance, week.closing_balance);
                  const pnl = week.closing_balance - week.opening_balance + week.withdrawn_amount;
                  const isPositive = pnl >= 0;
                  
                  return (
                    <div 
                      key={week.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 group"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {format(parseISO(week.week_start_date), 'MMM d')} - {format(
                            parseISO(week.week_end_date), 
                            'MMM d'
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${week.opening_balance.toFixed(2)} → ${week.closing_balance.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex items-center gap-1 text-sm font-semibold",
                          isPositive ? 'text-profit' : 'text-loss'
                        )}>
                          {isPositive ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {/* Edit functionality */}}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-loss hover:text-loss"
                            onClick={() => handleDeleteWeek(week.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
