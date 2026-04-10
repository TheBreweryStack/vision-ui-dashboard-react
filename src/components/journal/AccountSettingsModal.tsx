import React, { useState, useEffect } from 'react';
import { useAccountSettings } from '@/hooks/useAccountSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, DollarSign, Loader2, AlertTriangle } from 'lucide-react';

interface AccountSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { settings, updateSettings, isLoading } = useAccountSettings();
  const [initialDeposit, setInitialDeposit] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (settings) {
      setInitialDeposit(settings.initial_deposit?.toString() || '');
      setStartingBalance(settings.starting_balance?.toString() || '');
      setWeeklyGoal(settings.weekly_goal?.toString() || '');
      setCurrency(settings.currency || 'USD');
    }
  }, [settings]);

  useEffect(() => {
    if (!open) setShowConfirmation(false);
  }, [open]);

  const depositChanged = (parseFloat(initialDeposit) || 0) !== (settings?.initial_deposit ?? 0);

  const doSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        initial_deposit: parseFloat(initialDeposit) || 0,
        weekly_goal: parseFloat(weeklyGoal) || 500,
        currency,
      });
      setShowConfirmation(false);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (depositChanged) {
      setShowConfirmation(true);
    } else {
      doSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Account Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="initialDeposit">Initial Deposit</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="initialDeposit"
                type="number"
                step="0.01"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                placeholder="2000"
                className="pl-10 bg-primary/5 border-primary/30 focus:border-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">The original amount you deposited when opening the account</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startingBalance">Current Starting Balance</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="startingBalance"
                type="number"
                step="0.01"
                value={startingBalance}
                readOnly
                disabled
                placeholder="10000"
                className="pl-10 bg-secondary/50 border-border/50 opacity-60 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">Automatically updated when you close a week</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={(v: 'USD' | 'CAD') => setCurrency(v)}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="CAD">CAD ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weeklyGoal">Weekly Goal (Optional)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="weeklyGoal"
                type="number"
                step="0.01"
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(e.target.value)}
                placeholder="500"
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">Target profit you want to make each week</p>
          </div>

          {showConfirmation ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Changing your initial deposit will affect your Total P&L calculation. Are you sure?
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={doSave}
                  disabled={isSaving}
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Confirm
                </Button>
                <Button
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSaving}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isLoading} 
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Settings
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
