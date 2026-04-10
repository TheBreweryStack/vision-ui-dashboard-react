import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AddHoldingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { ticker: string; quantity: number; avg_cost: number }) => Promise<void>;
  isAdding: boolean;
}

export function AddHoldingModal({ open, onOpenChange, onAdd, isAdding }: AddHoldingModalProps) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');

  const handleSubmit = async () => {
    if (!ticker.trim() || !quantity || !avgCost) return;
    try {
      await onAdd({
        ticker: ticker.trim().toUpperCase(),
        quantity: parseFloat(quantity),
        avg_cost: parseFloat(avgCost),
      });
      toast.success(`${ticker.toUpperCase()} added`);
      setTicker('');
      setQuantity('');
      setAvgCost('');
      onOpenChange(false);
    } catch {
      toast.error('Failed to add holding');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Holding</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Ticker</Label>
            <Input
              placeholder="AAPL"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Shares</Label>
              <Input
                type="number"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                step="1"
              />
            </div>
            <div>
              <Label>Avg Cost</Label>
              <Input
                type="number"
                placeholder="150.00"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={isAdding || !ticker.trim() || !quantity || !avgCost}>
            {isAdding ? 'Adding...' : 'Add Holding'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
