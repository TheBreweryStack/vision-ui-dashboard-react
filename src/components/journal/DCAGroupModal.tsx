import { useState } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TradeGroupWithFills } from '@/hooks/useTradeGroups';

interface DCAGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: TradeGroupWithFills;
  onAddToPosition: (quantity: number, price: number, date: Date) => Promise<void>;
}

export function DCAGroupModal({ open, onOpenChange, group, onAddToPosition }: DCAGroupModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const handleSubmit = async () => {
    const qty = parseInt(quantity);
    const prc = parseFloat(price);

    if (!qty || qty <= 0 || !prc || prc <= 0) return;

    setIsSubmitting(true);
    try {
      await onAddToPosition(qty, prc, date);
      setQuantity('1');
      setPrice('');
      setDate(new Date());
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate new weighted average preview
  const newAvgPreview = (() => {
    const qty = parseInt(quantity) || 0;
    const prc = parseFloat(price) || 0;
    if (qty <= 0 || prc <= 0) return null;

    const totalQty = group.remaining_qty + qty;
    const totalCost = (group.avg_entry_price * group.remaining_qty) + (prc * qty);
    return totalCost / totalQty;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add to Position (DCA)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current position info */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">{group.ticker} {group.trade_type.toUpperCase()}</p>
            <p className="text-xs text-muted-foreground">
              Current: {group.remaining_qty} contracts @ ${group.avg_entry_price.toFixed(2)} avg
            </p>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Contracts to Add</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="bg-secondary/50"
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label>Entry Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="bg-secondary/50 pl-7"
              />
            </div>
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

          {/* New average preview */}
          {newAvgPreview && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-muted-foreground">New Weighted Average</p>
              <p className="text-lg font-semibold text-primary">${newAvgPreview.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                Total: {group.remaining_qty + (parseInt(quantity) || 0)} contracts
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !quantity || !price}
            className="bg-primary"
          >
            {isSubmitting ? 'Adding...' : 'Add to Position'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
