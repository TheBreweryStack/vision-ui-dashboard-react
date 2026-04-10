import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TradeGroupWithFills } from '@/hooks/useTradeGroups';

interface CloseGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: TradeGroupWithFills;
  onClosePosition: (quantity: number, price: number, date: Date) => Promise<void>;
}

export function CloseGroupModal({ open, onOpenChange, group, onClosePosition }: CloseGroupModalProps) {
  const [quantity, setQuantity] = useState(group.remaining_qty.toString());
  const [price, setPrice] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [breakEven, setBreakEven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (breakEven) {
      setPrice(group.avg_entry_price.toFixed(2));
    }
  }, [breakEven, group.avg_entry_price]);

  const handleSubmit = async () => {
    const qty = parseInt(quantity);
    const prc = parseFloat(price);

    if (!qty || qty <= 0 || !prc || prc < 0 || qty > group.remaining_qty) return;

    setIsSubmitting(true);
    try {
      await onClosePosition(qty, prc, date);
      setQuantity(group.remaining_qty.toString());
      setPrice('');
      setDate(new Date());
      setBreakEven(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate P&L preview
  const pnlPreview = (() => {
    const qty = parseInt(quantity) || 0;
    const prc = parseFloat(price) || 0;
    if (qty <= 0 || prc < 0) return null;

    const multiplier = group.trade_type === 'stock' ? 1 : 100;
    return (prc - group.avg_entry_price) * qty * multiplier;
  })();

  const isPartialClose = (parseInt(quantity) || 0) < group.remaining_qty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Close Position</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current position info */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">{group.ticker} {group.trade_type.toUpperCase()}</p>
            <p className="text-xs text-muted-foreground">
              {group.remaining_qty} contracts @ ${group.avg_entry_price.toFixed(2)} avg
            </p>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Contracts to Close</Label>
            <Input
              type="number"
              min="1"
              max={group.remaining_qty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={group.remaining_qty.toString()}
              className="bg-secondary/50"
            />
            <p className="text-xs text-muted-foreground">
              Max: {group.remaining_qty} contracts
            </p>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label>Exit Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (parseFloat(e.target.value) !== group.avg_entry_price) {
                    setBreakEven(false);
                  }
                }}
                placeholder="0.00"
                className="bg-secondary/50 pl-7"
                disabled={breakEven}
              />
            </div>
          </div>

          {/* Break-even checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="breakeven"
              checked={breakEven}
              onCheckedChange={(checked) => setBreakEven(!!checked)}
            />
            <label
              htmlFor="breakeven"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Close at break-even (${group.avg_entry_price.toFixed(2)})
            </label>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-secondary/50',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'MMM d, yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) setDate(d);
                    setDateOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* P&L preview */}
          {pnlPreview !== null && (
            <div className={cn(
              'p-3 rounded-lg border',
              pnlPreview >= 0 ? 'bg-profit/10 border-profit/20' : 'bg-loss/10 border-loss/20'
            )}>
              <p className="text-xs text-muted-foreground">
                {isPartialClose ? 'Partial Close' : 'Full Close'} P&L
              </p>
              <p className={cn(
                'text-lg font-semibold',
                pnlPreview >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {pnlPreview >= 0 ? '+' : ''}${pnlPreview.toFixed(2)}
              </p>
              {isPartialClose && (
                <p className="text-xs text-muted-foreground">
                  {group.remaining_qty - (parseInt(quantity) || 0)} contracts will remain open
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !quantity || !price || (parseInt(quantity) || 0) > group.remaining_qty}
            className={pnlPreview && pnlPreview < 0 ? 'bg-loss hover:bg-loss/90' : 'bg-primary'}
          >
            {isSubmitting ? 'Closing...' : isPartialClose ? 'Close Partial' : 'Close Position'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
