import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HoldingWithMarketData } from '@/hooks/usePortfolioHoldings';

interface StocksKPICardsProps {
  holdings: HoldingWithMarketData[];
  totalValue: number;
  totalPnl: number;
}

export function StocksKPICards({ holdings, totalValue, totalPnl }: StocksKPICardsProps) {
  const topGainer = holdings.length > 0
    ? holdings.reduce((best, h) => h.unrealizedPnlPercent > (best?.unrealizedPnlPercent ?? -Infinity) ? h : best, holdings[0])
    : null;
  const topLoser = holdings.length > 0
    ? holdings.reduce((worst, h) => h.unrealizedPnlPercent < (worst?.unrealizedPnlPercent ?? Infinity) ? h : worst, holdings[0])
    : null;

  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
      <div className="stat-card p-3 md:p-4">
        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">Portfolio Value</p>
        <p className="text-base md:text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
      </div>

      <div className="stat-card p-3 md:p-4">
        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">Total P&L</p>
        <p className={cn("text-base md:text-2xl font-bold", totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
          {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
        </p>
      </div>

      <div className="stat-card p-3 md:p-4">
        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">Top Gainer</p>
        {topGainer && topGainer.unrealizedPnlPercent > 0 ? (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-profit" />
            <span className="text-base md:text-lg font-bold text-profit">{topGainer.ticker}</span>
            <span className="text-xs text-profit">+{topGainer.unrealizedPnlPercent.toFixed(1)}%</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      <div className="stat-card p-3 md:p-4">
        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider mb-1">Top Loser</p>
        {topLoser && topLoser.unrealizedPnlPercent < 0 ? (
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-loss" />
            <span className="text-base md:text-lg font-bold text-loss">{topLoser.ticker}</span>
            <span className="text-xs text-loss">{topLoser.unrealizedPnlPercent.toFixed(1)}%</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );
}
