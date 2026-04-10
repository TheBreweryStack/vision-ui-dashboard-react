import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Edit2, Trash2, MoreVertical, Plus, X, ChevronRight } from 'lucide-react';
import { Trade } from '@/lib/supabase';
import { parseDateOnly } from '@/lib/utils';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { DCAModal } from './DCAModal';
import { ClosePositionModal } from './ClosePositionModal';
import { TradeDetailSheet } from './TradeDetailSheet';

interface TradeGroup {
  ticker: string;
  trade_type: string;
  trades: Trade[];
  totalPnl: number;
  totalQuantity: number;
  avgEntryPrice: number;
  status: 'open' | 'closed' | 'mixed';
  latestDate: string;
  position_id: string | null;
  strike_price: number | null;
  expiration_date: string | null;
}

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => Promise<{ error: Error | null }>;
  onUpdate: (id: string, updates: Partial<Trade>) => Promise<{ error: Error | null }>;
  isLoading?: boolean;
}

export function TradeList({ trades, onEdit, onDelete, onUpdate, isLoading }: TradeListProps) {
  const isMobile = useIsMobile();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dcaTrade, setDcaTrade] = useState<Trade | null>(null);
  const [closeTrade, setCloseTrade] = useState<Trade | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TradeGroup | null>(null);

  // Group trades by position_id (if exists) or by individual trade
  const groupedTrades = useMemo(() => {
    const groups: Record<string, TradeGroup> = {};
    
    trades.forEach(trade => {
      // Use position_id if available, otherwise create unique key per trade
      // This ensures trades are only grouped if they share the same position
      const key = trade.position_id || `single-${trade.id}`;
      
      if (!groups[key]) {
        groups[key] = {
          ticker: trade.ticker,
          trade_type: trade.trade_type,
          trades: [],
          totalPnl: 0,
          totalQuantity: 0,
          avgEntryPrice: 0,
          status: 'closed',
          latestDate: trade.entry_date,
          position_id: trade.position_id,
          strike_price: trade.strike_price,
          expiration_date: trade.expiration_date,
        };
      }
      
      groups[key].trades.push(trade);
      groups[key].totalPnl += trade.pnl || 0;
      groups[key].totalQuantity += trade.quantity;
      
      // Update latest date
      if (trade.entry_date > groups[key].latestDate) {
        groups[key].latestDate = trade.entry_date;
      }
      
      // Determine status
      const hasOpen = groups[key].trades.some(t => t.status === 'open');
      const hasClosed = groups[key].trades.some(t => t.status === 'closed');
      if (hasOpen && hasClosed) {
        groups[key].status = 'mixed';
      } else if (hasOpen) {
        groups[key].status = 'open';
      }
    });
    
    // Calculate weighted average entry price
    Object.values(groups).forEach(group => {
      const totalCost = group.trades.reduce((sum, t) => sum + (t.entry_price * t.quantity), 0);
      group.avgEntryPrice = totalCost / group.totalQuantity;
    });
    
    // Sort by latest date
    return Object.values(groups).sort((a, b) => 
      new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  }, [trades]);

  const handleDelete = async () => {
    if (deleteId) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleAddToPosition = async (contracts: number, price: number, date: Date) => {
    if (!dcaTrade) return;
    
    // Calculate new weighted average
    const totalContracts = dcaTrade.quantity + contracts;
    const totalCost = (dcaTrade.entry_price * dcaTrade.quantity) + (price * contracts);
    const newAvgPrice = totalCost / totalContracts;
    
    await onUpdate(dcaTrade.id, {
      quantity: totalContracts,
      entry_price: newAvgPrice,
      notes: `${dcaTrade.notes || ''}\nDCA: +${contracts} @ $${price.toFixed(2)} on ${format(date, 'yyyy-MM-dd')}`.trim(),
    });
    
    setDcaTrade(null);
  };

  const handleClosePosition = async (contracts: number, price: number, date: Date) => {
    if (!closeTrade) return;
    
    const multiplier = closeTrade.trade_type === 'stock' ? 1 : 100;
    const pnl = (price - closeTrade.entry_price) * contracts * multiplier;
    
    if (contracts < closeTrade.quantity) {
      // Partial close - create new closed trade and reduce original
      const remainingContracts = closeTrade.quantity - contracts;
      
      // Update original trade with remaining contracts
      await onUpdate(closeTrade.id, {
        quantity: remainingContracts,
        notes: `${closeTrade.notes || ''}\nPartial close: ${contracts} @ $${price.toFixed(2)} on ${format(date, 'yyyy-MM-dd')}`.trim(),
      });
    } else {
      // Full close
      await onUpdate(closeTrade.id, {
        status: 'closed',
        exit_price: price,
        exit_date: format(date, 'yyyy-MM-dd'),
        pnl: pnl,
      });
    }
    
    setCloseTrade(null);
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

  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No trades yet. Add your first trade!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground mb-4">All Trades</h3>
        
        {groupedTrades.map((group) => {
          const openTrade = group.trades.find(t => t.status === 'open');
          
          return (
            <div
              key={group.position_id || `${group.ticker}-${group.trade_type}-${group.strike_price ?? ''}-${group.expiration_date ?? ''}-${group.latestDate}`}
              className="trade-card flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedGroup(group)}
            >
              <div className="flex items-center gap-3">
                <TickerLogo symbol={group.ticker} size="lg" />
                <div>
                  <p className="font-semibold text-foreground">
                    {group.ticker}
                    {group.strike_price && <span className="text-muted-foreground"> ${group.strike_price}</span>}
                    {group.expiration_date && <span className="text-muted-foreground text-xs"> {format(new Date(group.expiration_date), 'MMM d')}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {group.trade_type} • {group.totalQuantity} Contract{group.totalQuantity > 1 ? 's' : ''} • Entry: ${group.avgEntryPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  {group.status === 'open' ? (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      Open
                    </Badge>
                  ) : group.totalPnl !== 0 ? (
                    <>
                      <p className={cn(
                        'font-semibold',
                        group.totalPnl >= 0 ? 'text-profit' : 'text-loss'
                      )}>
                        {group.totalPnl >= 0 ? '+' : ''}${group.totalPnl.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseDateOnly(group.latestDate), 'MMM d, yyyy')}
                      </p>
                    </>
                  ) : null}
                </div>

                {/* Action buttons for open trades */}
                {openTrade && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:text-primary"
                      onClick={() => setDcaTrade(openTrade)}
                      title="Add to Position (DCA)"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setCloseTrade(openTrade)}
                      title="Close Position"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Edit/Delete dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onEdit(group.trades[0]);
                    }}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(group.trades[0].id);
                      }}
                      className="text-loss"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          );
        })}
      </div>

      {/* DCA Modal */}
      {dcaTrade && (
        <DCAModal
          open={!!dcaTrade}
          onOpenChange={(open) => !open && setDcaTrade(null)}
          trade={dcaTrade}
          onAddToPosition={handleAddToPosition}
        />
      )}

      {/* Close Position Modal */}
      {closeTrade && (
        <ClosePositionModal
          open={!!closeTrade}
          onOpenChange={(open) => !open && setCloseTrade(null)}
          trade={closeTrade}
          onClosePosition={handleClosePosition}
        />
      )}

      {/* Trade Detail Sheet */}
      <TradeDetailSheet
        open={!!selectedGroup}
        onOpenChange={(open) => !open && setSelectedGroup(null)}
        group={selectedGroup}
        onEdit={onEdit}
        onUpdateImages={async (tradeId, images) => {
          await onUpdate(tradeId, { images });
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trade</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this trade? This action cannot be undone.
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