import React, { useState } from 'react';
import { useDeposits } from '@/hooks/useDeposits';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wallet, ArrowDownLeft, ArrowUpRight, Trash2, DollarSign, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DepositsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DepositsModal: React.FC<DepositsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { deposits, totalDeposits, totalWithdrawals, netFlow, addDeposit, deleteDeposit, isLoading } = useDeposits();
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    setIsSaving(true);
    try {
      await addDeposit({
        transaction_type: type,
        amount: parseFloat(amount),
        deposit_date: date,
        notes: notes || undefined,
      });
      setAmount('');
      setNotes('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this transaction?')) {
      await deleteDeposit(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Deposits & Withdrawals
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-lg bg-profit/10 border border-profit/20 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Deposits</p>
            <p className="text-sm font-bold text-profit">+${totalDeposits.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-loss/10 border border-loss/20 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Withdrawals</p>
            <p className="text-sm font-bold text-loss">-${totalWithdrawals.toFixed(2)}</p>
          </div>
          <div className={cn(
            "p-3 rounded-lg border text-center",
            netFlow >= 0 ? "bg-profit/10 border-profit/20" : "bg-loss/10 border-loss/20"
          )}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Flow</p>
            <p className={cn(
              "text-sm font-bold",
              netFlow >= 0 ? "text-profit" : "text-loss"
            )}>
              {netFlow >= 0 ? '+' : ''}{netFlow >= 0 ? '' : '-'}${Math.abs(netFlow).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={type === 'deposit' ? 'default' : 'outline'}
            onClick={() => setType('deposit')}
            className={cn(
              "h-10",
              type === 'deposit' ? "bg-primary text-primary-foreground" : "bg-secondary/50"
            )}
          >
            <ArrowDownLeft className="h-4 w-4 mr-2" />
            Deposit
          </Button>
          <Button
            variant={type === 'withdrawal' ? 'default' : 'outline'}
            onClick={() => setType('withdrawal')}
            className={cn(
              "h-10",
              type === 'withdrawal' ? "bg-secondary text-foreground" : "bg-secondary/50"
            )}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Withdrawal
          </Button>
        </div>

        {/* Form */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                className="pl-9 bg-secondary/50 border-border/50 h-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9 bg-secondary/50 border-border/50 h-9"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes (Optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for deposit..."
            className="bg-secondary/50 border-border/50 h-9"
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={!amount || isSaving}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          <ArrowDownLeft className="h-4 w-4 mr-2" />
          Add {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
        </Button>

        {/* Transaction History */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Transaction History</h3>
          <ScrollArea className="h-[180px]">
            <div className="space-y-2 pr-3">
              {deposits.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">No transactions yet</p>
              ) : (
              deposits.map((d) => (
                  <div 
                    key={d.id} 
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      d.transaction_type === 'deposit' ? "bg-profit/10" : "bg-loss/10"
                    )}>
                      {d.transaction_type === 'deposit' ? (
                        <ArrowDownLeft className="h-4 w-4 text-profit" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-loss" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-semibold",
                        d.transaction_type === 'deposit' ? "text-profit" : "text-loss"
                      )}>
                        {d.transaction_type === 'deposit' ? '+' : '-'}${d.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(new Date(d.deposit_date), 'MMM d, yyyy')}
                        {d.notes && ` • ${d.notes}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-loss hover:text-loss hover:bg-loss/10"
                      onClick={() => handleDelete(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
