import React from 'react';
import { cn } from '@/lib/utils';

interface PortfolioAllocation {
  name: string;
  value: number;
  color: string;
}

interface PortfolioDistributionBarProps {
  allocations: PortfolioAllocation[];
  total: number;
}

const COLORS = [
  'bg-primary',
  'bg-profit',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

const DOT_COLORS = [
  'bg-primary',
  'bg-profit',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

export const PortfolioDistributionBar: React.FC<PortfolioDistributionBarProps> = ({
  allocations,
  total,
}) => {
  if (!allocations.length || total <= 0) {
    return (
      <div className="space-y-3">
        <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
          <div className="h-full w-full bg-muted-foreground/20 rounded-full" />
        </div>
        <p className="text-xs text-muted-foreground">No portfolio data yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-3 rounded-full bg-muted/30 overflow-hidden flex">
        {allocations.map((alloc, i) => {
          const pct = (alloc.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={alloc.name}
              className={cn('h-full transition-all duration-500', COLORS[i % COLORS.length])}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {allocations.map((alloc, i) => {
          const pct = total > 0 ? ((alloc.value / total) * 100).toFixed(1) : '0';
          return (
            <div key={alloc.name} className="flex items-center gap-1.5 text-xs">
              <span className={cn('h-2 w-2 rounded-full shrink-0', DOT_COLORS[i % DOT_COLORS.length])} />
             <span className="text-muted-foreground">{alloc.name}</span>
              <span className="text-foreground font-medium">{pct}%</span>
              <span className="text-muted-foreground">${alloc.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
