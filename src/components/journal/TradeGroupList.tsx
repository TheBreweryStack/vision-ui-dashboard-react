import { useState } from 'react';
import { format } from 'date-fns';
import { Edit2, Trash2, MoreVertical, Plus, X, ChevronRight, Clock } from 'lucide-react';
import { TradeGroupWithFills } from '@/hooks/useTradeGroups';
import { parseDateOnly, isExpiredOption } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TickerLogo } from '@/components/common/TickerLogo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TradeGroupDetailSheet } from './TradeGroupDetailSheet';
import { DCAGroupModal } from './DCAGroupModal';
import { CloseGroupModal } from './CloseGroupModal';
import { EditTradeGroupModal } from './EditTradeGroupModal';
import { toast } from 'sonner';

interface TradeGroupListProps {
  groups: TradeGroupWithFills[];
  onDelete: (id: string) => Promise<{ error: Error | null }>;
  onAddToPosition: (groupId: string, quantity: number, price: number, date: Date) => Promise<void>;
  onClosePosition: (groupId: string, quantity: number, price: number, date: Date) => Promise<void>;
  onUpdateImages: (groupId: string, images: string[]) => Promise<void>;
  onUpdateGroup?: (groupId: string, data: { strategy?: string; notes?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function TradeGroupList({ 
  groups, 
  onDelete, 
  onAddToPosition, 
  onClosePosition,
  onUpdateImages,
  onUpdateGroup,
  isLoading 
}: TradeGroupListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dcaGroup, setDcaGroup] = useState<TradeGroupWithFills | null>(null);
  const [closeGroup, setCloseGroup] = useState<TradeGroupWithFills | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TradeGroupWithFills | null>(null);
  const [editGroup, setEditGroup] = useState<TradeGroupWithFills | null>(null);

  const handleDelete = async () => {
    if (deleteId) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleDcaClick = (group: TradeGroupWithFills) => {
    setDcaGroup(group);
  };

  const handleCloseClick = (group: TradeGroupWithFills) => {
    setCloseGroup(group);
  };

  const handleCloseExpired = async (group: TradeGroupWithFills, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpiredOption(group)) return;
    
    const expDate = group.expiration_date 
      ? parseDateOnly(group.expiration_date)
      : new Date();
    
    await onClosePosition(group.id, group.remaining_qty, 0, expDate);
    toast.success(`Closed ${group.ticker} at $0`);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-card/50 animate-pulse rounded-xl border border-dashed border-border/50" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No trades yet. Add your first trade!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground mb-4">All Positions</h3>
        
        {groups.map((group) => (
          <div
            key={group.id}
            className="trade-card flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedGroup(group)}
          >
            <div className="flex items-center gap-3">
              <TickerLogo symbol={group.ticker} size="lg" />
              <div>
                <p className="font-semibold text-foreground">
                  {group.ticker}
                  {group.strike_price && <span className="text-muted-foreground"> ${group.strike_price}</span>}
                  {group.expiration_date && <span className="text-muted-foreground text-xs"> {format(parseDateOnly(group.expiration_date), 'MMM d')}</span>}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {group.trade_type} • {group.remaining_qty}/{group.opened_qty} Contract{group.opened_qty > 1 ? 's' : ''} • Entry: ${group.avg_entry_price.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(parseDateOnly(group.entry_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div>
                {group.status === 'open' ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      Open
                    </Badge>
                    {isExpiredOption(group) && (
                      <Badge variant="outline" className="bg-loss/10 text-loss border-loss/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Expired
                      </Badge>
                    )}
                  </div>
                ) : group.realized_pnl !== null && group.realized_pnl !== 0 ? (
                  <>
                    <p className={cn(
                      'font-semibold',
                      group.realized_pnl >= 0 ? 'text-profit' : 'text-loss'
                    )}>
                      {group.realized_pnl >= 0 ? '+' : ''}${group.realized_pnl.toFixed(2)}
                    </p>
                    {group.avg_exit_price && (
                      <p className="text-xs text-muted-foreground">
                        Exit: ${group.avg_exit_price.toFixed(2)}
                      </p>
                    )}
                  </>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Closed
                  </Badge>
                )}
              </div>

              {/* Action buttons for open positions */}
              {group.status === 'open' && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {isExpiredOption(group) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-loss hover:text-loss hover:bg-loss/10"
                      onClick={(e) => handleCloseExpired(group, e)}
                      title="Close at $0"
                    >
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      Close $0
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary"
                        onClick={() => setDcaGroup(group)}
                        title="Add to Position (DCA)"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setCloseGroup(group)}
                        title="Close Position"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditGroup(group);
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Position
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(group.id);
                    }}
                    className="text-loss"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Position
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      {/* DCA Modal */}
      {dcaGroup && (
        <DCAGroupModal
          open={!!dcaGroup}
          onOpenChange={(open) => !open && setDcaGroup(null)}
          group={dcaGroup}
          onAddToPosition={async (quantity, price, date) => {
            await onAddToPosition(dcaGroup.id, quantity, price, date);
            setDcaGroup(null);
          }}
        />
      )}

      {/* Close Position Modal */}
      {closeGroup && (
        <CloseGroupModal
          open={!!closeGroup}
          onOpenChange={(open) => !open && setCloseGroup(null)}
          group={closeGroup}
          onClosePosition={async (quantity, price, date) => {
            await onClosePosition(closeGroup.id, quantity, price, date);
            setCloseGroup(null);
          }}
        />
      )}

      {/* Trade Group Detail Sheet */}
      <TradeGroupDetailSheet
        open={!!selectedGroup}
        onOpenChange={(open) => !open && setSelectedGroup(null)}
        group={selectedGroup}
        onUpdateImages={onUpdateImages}
      />

      {/* Edit Position Modal */}
      {editGroup && onUpdateGroup && (
        <EditTradeGroupModal
          open={!!editGroup}
          onOpenChange={(open) => !open && setEditGroup(null)}
          group={editGroup}
          onSave={async (groupId, data) => {
            await onUpdateGroup(groupId, data);
            setEditGroup(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entire position and all its fills? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-loss hover:bg-loss/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
