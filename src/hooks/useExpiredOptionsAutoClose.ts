import { useEffect, useState, useCallback } from 'react';
import { getISOWeek, getYear } from 'date-fns';
import { TradeGroupWithFills } from '@/hooks/useTradeGroups';
import { isExpiredOption } from '@/lib/utils';
import { toast } from 'sonner';

type ClosePositionFn = (
  groupId: string,
  quantity: number,
  price: number,
  date: Date
) => Promise<void>;

export function useExpiredOptionsAutoClose(
  groups: TradeGroupWithFills[],
  closePosition: ClosePositionFn
) {
  const [expiredOptions, setExpiredOptions] = useState<TradeGroupWithFills[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Find expired options
  useEffect(() => {
    const expired = groups.filter(g => isExpiredOption(g));
    setExpiredOptions(expired);
  }, [groups]);

  // Check on Monday if there are expired options to close
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday

    // Only run on Monday (or Tuesday if missed Monday)
    if (dayOfWeek !== 1 && dayOfWeek !== 2) return;

    // Check localStorage for already-processed this week
    const weekKey = `auto_closed_week_${getISOWeek(today)}_${getYear(today)}`;
    const alreadyProcessed = localStorage.getItem(weekKey);
    if (alreadyProcessed) return;

    if (expiredOptions.length === 0) return;

    // Show toast prompting user to close expired options
    toast.info(`${expiredOptions.length} expired option${expiredOptions.length !== 1 ? 's' : ''} found`, {
      description: 'Would you like to close them at $0?',
      duration: 10000,
      action: {
        label: 'Close All',
        onClick: () => {
          handleCloseAll();
          localStorage.setItem(weekKey, 'true');
        },
      },
    });

    // Mark as shown (but not processed) so we don't spam the user
    localStorage.setItem(weekKey, 'shown');
  }, [expiredOptions]);

  const handleCloseAll = useCallback(async () => {
    if (isProcessing || expiredOptions.length === 0) return;

    setIsProcessing(true);
    let closed = 0;

    try {
      for (const group of expiredOptions) {
        const expDate = group.expiration_date 
          ? new Date(`${group.expiration_date}T00:00:00`) 
          : new Date();
        
        await closePosition(
          group.id,
          group.remaining_qty,
          0, // Close at $0
          expDate
        );
        closed++;
      }

      toast.success(`Closed ${closed} expired option${closed !== 1 ? 's' : ''} at $0`);
    } catch (error) {
      toast.error(`Failed to close some options. ${closed} of ${expiredOptions.length} closed.`);
    } finally {
      setIsProcessing(false);
    }
  }, [expiredOptions, closePosition, isProcessing]);

  const closeExpiredOption = useCallback(async (group: TradeGroupWithFills) => {
    if (!isExpiredOption(group)) return;

    const expDate = group.expiration_date 
      ? new Date(`${group.expiration_date}T00:00:00`) 
      : new Date();

    await closePosition(
      group.id,
      group.remaining_qty,
      0,
      expDate
    );

    toast.success(`Closed ${group.ticker} at $0`);
  }, [closePosition]);

  return {
    expiredOptions,
    hasExpiredOptions: expiredOptions.length > 0,
    isProcessing,
    handleCloseAll,
    closeExpiredOption,
  };
}
