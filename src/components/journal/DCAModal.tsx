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
import { Trade } from '@/lib/supabase';

interface DCAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade;
  onAddToPosition: (contracts: number, price: number, date: Date) => Promise<void>;
}

export function DCAModal({ open, onOpenChange, trade, onAddToPosition }: DCAModalProps) {
  const [contracts, setContracts] = useState(1);
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (contracts <= 0 || price <= 0) return;
    setIsSubmitting(true);
    try {
      await onAddToPosition(contracts, price, date);
      onOpenChange(false);
      setContracts(1);
      setPrice(0);
      setDate(new Date());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Position (DCA)</DialogTitle>
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

          {/* Contracts to Add */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contracts to Add</Label>
              <Input
                type="number"
                min={1}
                value={contracts}
                onChange={(e) => setContracts(parseInt(e.target.value) || 1)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Entry Price</Label>
              <Input
                type="number"
                step="0.01"
                min={0.01}
                value={price || ''}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Entry Date */}
          <div className="space-y-2">
            <Label>Entry Date</Label>
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

          {/* New Average Preview */}
          {price > 0 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-xs text-muted-foreground">New Weighted Average</p>
              <p className="font-semibold text-primary">
                ${((trade.entry_price * trade.quantity + price * contracts) / (trade.quantity + contracts)).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {trade.quantity + contracts} total contracts
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
            disabled={isSubmitting || contracts <= 0 || price <= 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? 'Adding...' : 'Add to Position'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}