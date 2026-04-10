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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Trade } from '@/lib/supabase';

interface ClosePositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade;
  onClosePosition: (contracts: number, price: number, date: Date) => Promise<void>;
}

export function ClosePositionModal({ open, onOpenChange, trade, onClosePosition }: ClosePositionModalProps) {
  const [contracts, setContracts] = useState(trade.quantity);
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [breakEven, setBreakEven] = useState(false);

  const handleBreakEvenChange = (checked: boolean) => {
    setBreakEven(checked);
    if (checked) {
      setPrice(trade.entry_price);
    }
  };

  const handleSubmit = async () => {
    if (contracts <= 0 || price < 0) return;
    setIsSubmitting(true);
    try {
      await onClosePosition(contracts, price, date);
      onOpenChange(false);
      setContracts(trade.quantity);
      setPrice(0);
      setDate(new Date());
      setBreakEven(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPartial = contracts < trade.quantity;
  const multiplier = trade.trade_type === 'stock' ? 1 : 100;
  const estimatedPnL = (price - trade.entry_price) * contracts * multiplier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Close Position</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Position Info */}
          <div className="p-3 rounded-lg bg-background border border-border">
            <p className="text-xs text-muted-foreground">Current Position</p>
            <p className="font-semibold">{trade.ticker} • {trade.trade_type.toUpperCase()}</p>
            <p className="text-sm text-muted-foreground">
              {trade.quantity} contracts @ ${trade.entry_price.toFixed(2)}
            </p>
          </div>

          {/* Contracts to Close */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contracts to Close</Label>
              <Input
                type="number"
                min={1}
                max={trade.quantity}
                value={contracts}
                onChange={(e) => setContracts(Math.min(parseInt(e.target.value) || 1, trade.quantity))}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Exit Price</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={price || ''}
                onChange={(e) => {
                  setPrice(parseFloat(e.target.value) || 0);
                  setBreakEven(false);
                }}
                placeholder="0.00"
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Break Even Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="breakeven"
              checked={breakEven}
              onCheckedChange={handleBreakEvenChange}
            />
            <Label htmlFor="breakeven" className="text-sm text-muted-foreground cursor-pointer">
              Close at break-even (${trade.entry_price.toFixed(2)})
            </Label>
          </div>

          {/* Exit Date */}
          <div className="space-y-2">
            <Label>Exit Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-background border-border',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'yyyy-MM-dd') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border-border">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* P&L Preview */}
          {price > 0 && (
            <div className={cn(
              'p-3 rounded-lg border',
              estimatedPnL >= 0 ? 'bg-profit/10 border-profit/30' : 'bg-loss/10 border-loss/30'
            )}>
              <p className="text-xs text-muted-foreground">Estimated P&L</p>
              <p className={cn(
                'font-semibold',
                estimatedPnL >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {estimatedPnL >= 0 ? '+' : ''}${estimatedPnL.toFixed(2)}
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
            disabled={isSubmitting || contracts <= 0 || price < 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? 'Closing...' : isPartial ? 'Close Partial' : 'Close Position'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}