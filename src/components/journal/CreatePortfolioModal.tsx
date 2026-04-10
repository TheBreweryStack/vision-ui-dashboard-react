import React, { useState } from 'react';
import { Target, TrendingUp, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePortfolios, PortfolioCategory } from '@/hooks/usePortfolios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORIES = [
  {
    key: 'options' as PortfolioCategory,
    icon: Target,
    label: 'Options',
    description: 'Track options trades with P&L calendar',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    ringColor: 'ring-primary/50',
    enabled: true,
  },
  {
    key: 'stocks' as PortfolioCategory,
    icon: TrendingUp,
    label: 'Stocks',
    description: 'Track holdings, sectors & live P&L',
    color: 'text-profit',
    bgColor: 'bg-profit/10',
    borderColor: 'border-profit/30',
    ringColor: 'ring-profit/50',
    enabled: true,
  },
  {
    key: 'dividends' as PortfolioCategory,
    icon: DollarSign,
    label: 'Dividends',
    description: 'Track dividend income & yield',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    ringColor: 'ring-yellow-500/50',
    enabled: false,
  },
];

interface CreatePortfolioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePortfolioModal({ open, onOpenChange }: CreatePortfolioModalProps) {
  const { createPortfolio, isCreating } = usePortfolios();
  const [selectedCategory, setSelectedCategory] = useState<PortfolioCategory | null>(null);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !selectedCategory) return;
    try {
      await createPortfolio(name.trim(), selectedCategory);
      toast.success(`Portfolio "${name.trim()}" created`);
      setName('');
      setSelectedCategory(null);
      onOpenChange(false);
    } catch {
      toast.error('Failed to create portfolio');
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelectedCategory(null);
      setName('');
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Portfolio</DialogTitle>
        </DialogHeader>

        {!selectedCategory ? (
          <div className="grid gap-3 py-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.key}
                  disabled={!cat.enabled}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-xl border text-left transition-all',
                    cat.enabled
                      ? `${cat.borderColor} hover:${cat.bgColor} hover:ring-2 ${cat.ringColor} cursor-pointer`
                      : 'border-border/50 opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className={cn('p-2.5 rounded-lg shrink-0', cat.bgColor)}>
                    <Icon className={cn('h-5 w-5', cat.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{cat.label}</span>
                      {!cat.enabled && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Portfolio Name</label>
              <Input
                placeholder="e.g. My Options Portfolio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedCategory(null)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={isCreating || !name.trim()}
              >
                Create Portfolio
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
