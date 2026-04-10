import React from 'react';
import { WatchlistItem } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Activity, Zap, Loader2 } from 'lucide-react';

const ALERT_TYPES = [
  { value: 'price_above', label: 'Price Above $', icon: ArrowUp, needsValue: true, needsPeriods: false },
  { value: 'price_below', label: 'Price Below $', icon: ArrowDown, needsValue: true, needsPeriods: false },
  { value: 'percent_up', label: 'Up by %', icon: TrendingUp, needsValue: true, needsPeriods: false },
  { value: 'percent_down', label: 'Down by %', icon: TrendingDown, needsValue: true, needsPeriods: false },
  { value: 'rsi_overbought', label: 'RSI Overbought (>70)', icon: Activity, needsValue: false, needsPeriods: false },
  { value: 'rsi_oversold', label: 'RSI Oversold (<30)', icon: Activity, needsValue: false, needsPeriods: false },
  { value: 'ema_cross_up', label: 'EMA Cross Up', icon: Zap, needsValue: false, needsPeriods: true },
  { value: 'ema_cross_down', label: 'EMA Cross Down', icon: Zap, needsValue: false, needsPeriods: true },
];

export { ALERT_TYPES };

interface PriceAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: WatchlistItem | null;
  hasExistingAlert: boolean;
  alertType: string;
  setAlertType: (type: string) => void;
  alertThreshold: string;
  setAlertThreshold: (value: string) => void;
  alertEnabled: boolean;
  setAlertEnabled: (enabled: boolean) => void;
  fastEma: string;
  setFastEma: (value: string) => void;
  slowEma: string;
  setSlowEma: (value: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onDelete: () => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  open,
  onOpenChange,
  selectedItem,
  hasExistingAlert,
  alertType,
  setAlertType,
  alertThreshold,
  setAlertThreshold,
  alertEnabled,
  setAlertEnabled,
  fastEma,
  setFastEma,
  slowEma,
  setSlowEma,
  isSaving,
  onSave,
  onDelete,
}) => {
  const config = ALERT_TYPES.find(t => t.value === alertType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Price Alert for {selectedItem?.ticker}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Alert Type</Label>
            <Select value={alertType} onValueChange={setAlertType}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALERT_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {config?.needsValue && (
            <div className="space-y-2">
              <Label htmlFor="threshold">
                {alertType.includes('price') ? 'Price ($)' : 'Percentage (%)'}
              </Label>
              <Input
                id="threshold"
                type="number"
                step={alertType.includes('price') ? '0.01' : '1'}
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder={alertType.includes('price') ? '150.00' : '5'}
                className="bg-secondary/50 border-border/50"
              />
            </div>
          )}

          {config?.needsPeriods && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fast EMA</Label>
                <Select value={fastEma} onValueChange={setFastEma}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['5', '9', '12', '20', '21'].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Slow EMA</Label>
                <Select value={slowEma} onValueChange={setSlowEma}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['20', '21', '50', '100', '200'].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Alert</p>
              <p className="text-xs text-muted-foreground">Receive notifications when triggered</p>
            </div>
            <Switch
              checked={alertEnabled}
              onCheckedChange={setAlertEnabled}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {alertType === 'price_above' && `Alert when ${selectedItem?.ticker} goes above $${alertThreshold || '___'}`}
            {alertType === 'price_below' && `Alert when ${selectedItem?.ticker} goes below $${alertThreshold || '___'}`}
            {alertType === 'percent_up' && `Alert when ${selectedItem?.ticker} is up ${alertThreshold || '___'}% from previous close`}
            {alertType === 'percent_down' && `Alert when ${selectedItem?.ticker} is down ${alertThreshold || '___'}% from previous close`}
            {alertType === 'rsi_overbought' && `Alert when ${selectedItem?.ticker} RSI goes above 70 (overbought)`}
            {alertType === 'rsi_oversold' && `Alert when ${selectedItem?.ticker} RSI goes below 30 (oversold)`}
            {alertType === 'ema_cross_up' && `Alert when ${selectedItem?.ticker} ${fastEma} EMA crosses above ${slowEma} EMA`}
            {alertType === 'ema_cross_down' && `Alert when ${selectedItem?.ticker} ${fastEma} EMA crosses below ${slowEma} EMA`}
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasExistingAlert && (
            <Button
              variant="outline"
              onClick={onDelete}
              className="border-loss/30 text-loss hover:bg-loss/10 sm:mr-auto"
            >
              Delete Alert
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || (config?.needsValue && !alertThreshold)}
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
