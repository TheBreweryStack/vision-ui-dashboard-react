import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { TickerLogo } from '@/components/common/TickerLogo';
import { format } from 'date-fns';
import { parseDateOnly, cn } from '@/lib/utils';
import { Merge, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { TradeGroupWithFills } from '@/hooks/useTradeGroups';
import { useIsMobile } from '@/hooks/use-mobile';
import { logger } from '@/lib/logger';

interface MergePositionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TradeGroupWithFills[];
  onMergeComplete: () => void;
}

interface DuplicateGroup {
  key: string;
  items: TradeGroupWithFills[];
}

function MergePositionsContent({
  groups,
  onOpenChange,
  onMergeComplete,
}: Omit<MergePositionsModalProps, 'open'>) {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isMerging, setIsMerging] = useState(false);

  // Find duplicate groups (same ticker, type, strike, expiration)
  const duplicateGroups = useMemo(() => {
    const groupMap = new Map<string, TradeGroupWithFills[]>();

    groups.forEach((group) => {
      // Create a key based on unique contract properties
      const key = [
        group.ticker,
        group.trade_type,
        group.strike_price || 'stock',
        group.expiration_date || 'none',
        group.status, // Only merge same status
      ].join('|');

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(group);
    });

    // Only return groups with duplicates
    const duplicates: DuplicateGroup[] = [];
    groupMap.forEach((items, key) => {
      if (items.length > 1) {
        duplicates.push({ key, items: items.sort((a, b) => 
          new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
        )});
      }
    });

    return duplicates;
  }, [groups]);

  const handleToggleGroup = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = (duplicateGroup: DuplicateGroup) => {
    const newSelected = new Set(selectedGroups);
    duplicateGroup.items.forEach((item) => {
      newSelected.add(item.id);
    });
    setSelectedGroups(newSelected);
  };

  const handleMerge = async () => {
    if (selectedGroups.size < 2) {
      toast.error('Select at least 2 positions to merge');
      return;
    }

    // Verify all selected are from the same duplicate group
    const selectedItems = groups.filter((g) => selectedGroups.has(g.id));
    const firstItem = selectedItems[0];
    const allSame = selectedItems.every(
      (item) =>
        item.ticker === firstItem.ticker &&
        item.trade_type === firstItem.trade_type &&
        item.strike_price === firstItem.strike_price &&
        item.expiration_date === firstItem.expiration_date &&
        item.status === firstItem.status
    );

    if (!allSame) {
      toast.error('Can only merge positions with the same ticker, type, strike, and expiration');
      return;
    }

    setIsMerging(true);

    try {
      // Sort by entry_date to keep oldest as the target
      const sortedItems = [...selectedItems].sort(
        (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
      );
      const targetGroup = sortedItems[0];
      const groupsToMerge = sortedItems.slice(1);

      // Calculate merged values
      let totalOpenedQty = targetGroup.opened_qty;
      let totalClosedQty = targetGroup.closed_qty;
      let totalRealizedPnl = targetGroup.realized_pnl || 0;
      let weightedEntryTotal = targetGroup.avg_entry_price * targetGroup.opened_qty;
      let weightedExitTotal = (targetGroup.avg_exit_price || 0) * targetGroup.closed_qty;

      for (const group of groupsToMerge) {
        totalOpenedQty += group.opened_qty;
        totalClosedQty += group.closed_qty;
        totalRealizedPnl += group.realized_pnl || 0;
        weightedEntryTotal += group.avg_entry_price * group.opened_qty;
        weightedExitTotal += (group.avg_exit_price || 0) * group.closed_qty;
      }

      const newAvgEntryPrice = totalOpenedQty > 0 ? weightedEntryTotal / totalOpenedQty : 0;
      const newAvgExitPrice = totalClosedQty > 0 ? weightedExitTotal / totalClosedQty : null;
      const remainingQty = totalOpenedQty - totalClosedQty;

      // Merge notes
      const allNotes = selectedItems
        .filter((g) => g.notes)
        .map((g) => g.notes)
        .join('\n---\n');

      // Merge images
      const allImages = selectedItems.flatMap((g) => g.images || []);

      // Move fills from other groups to target
      for (const group of groupsToMerge) {
        await supabase
          .from('trade_fills')
          .update({ trade_group_id: targetGroup.id })
          .eq('trade_group_id', group.id);
      }

      // Update target group with merged data
      await supabase
        .from('trade_groups')
        .update({
          opened_qty: totalOpenedQty,
          closed_qty: totalClosedQty,
          remaining_qty: remainingQty,
          avg_entry_price: Number(newAvgEntryPrice.toFixed(2)),
          avg_exit_price: newAvgExitPrice ? Number(newAvgExitPrice.toFixed(2)) : null,
          realized_pnl: Number(totalRealizedPnl.toFixed(2)),
          status: remainingQty > 0 ? 'open' : 'closed',
          notes: allNotes || targetGroup.notes,
          images: allImages.length > 0 ? allImages : targetGroup.images,
        })
        .eq('id', targetGroup.id);

      // Delete merged groups
      for (const group of groupsToMerge) {
        await supabase.from('trade_groups').delete().eq('id', group.id);
      }

      toast.success(`Merged ${selectedGroups.size} positions into one`);
      setSelectedGroups(new Set());
      onMergeComplete();
      onOpenChange(false);
    } catch (error) {
      logger.error('Error merging positions:', error);
      toast.error('Failed to merge positions');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-1">
        {duplicateGroups.length === 0 ? (
          <div className="text-center py-12">
            <Merge className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No duplicate positions found</p>
            <p className="text-sm text-muted-foreground mt-1">
              All your positions are unique
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Select 2 or more positions with the same contract details to merge them. 
                The oldest position will be kept and all fills will be combined into it.
              </p>
            </div>

            {duplicateGroups.map((duplicateGroup) => {
              const firstItem = duplicateGroup.items[0];
              return (
                <div key={duplicateGroup.key} className="border border-border rounded-xl p-3 md:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TickerLogo symbol={firstItem.ticker} size="sm" />
                      <div>
                        <p className="font-medium text-sm md:text-base">
                          {firstItem.ticker}
                          {firstItem.strike_price && (
                            <span className="text-muted-foreground">
                              {' '}${firstItem.strike_price} {firstItem.trade_type.toUpperCase()}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {duplicateGroup.items.length} duplicate positions
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectAll(duplicateGroup)}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {duplicateGroup.items.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg border transition-colors cursor-pointer',
                          selectedGroups.has(item.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => handleToggleGroup(item.id)}
                      >
                        <Checkbox
                          checked={selectedGroups.has(item.id)}
                          onCheckedChange={() => handleToggleGroup(item.id)}
                        />
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                          <div>
                            <p className="text-[10px] md:text-xs text-muted-foreground">Entry</p>
                            <p>{format(parseDateOnly(item.entry_date), 'MMM d, yy')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] md:text-xs text-muted-foreground">Qty</p>
                            <p>{item.opened_qty}x @ ${item.avg_entry_price.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] md:text-xs text-muted-foreground">P&L</p>
                            <p className={cn(
                              (item.realized_pnl || 0) >= 0 ? 'text-profit' : 'text-loss'
                            )}>
                              {item.realized_pnl
                                ? `${item.realized_pnl >= 0 ? '+' : ''}$${item.realized_pnl.toFixed(0)}`
                                : '-'}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={item.status === 'open' ? 'secondary' : 'outline'} className="text-[10px]">
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border mt-4 px-1">
        <p className="text-xs md:text-sm text-muted-foreground">
          {selectedGroups.size} position{selectedGroups.size !== 1 ? 's' : ''} selected
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleMerge}
            disabled={selectedGroups.size < 2 || isMerging}
          >
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="h-4 w-4 mr-2" />
                Merge
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MergePositionsModal({
  open,
  onOpenChange,
  groups,
  onMergeComplete,
}: MergePositionsModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader className="pb-2 flex-shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5 text-primary" />
              Merge Duplicate Positions
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <MergePositionsContent
              groups={groups}
              onOpenChange={onOpenChange}
              onMergeComplete={onMergeComplete}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Merge Duplicate Positions
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          <MergePositionsContent
            groups={groups}
            onOpenChange={onOpenChange}
            onMergeComplete={onMergeComplete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
