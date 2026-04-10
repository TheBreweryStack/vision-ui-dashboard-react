import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TickerLogo } from '@/components/common/TickerLogo';
import { cn } from '@/lib/utils';
import { HoldingWithMarketData } from '@/hooks/usePortfolioHoldings';

interface HoldingsTableProps {
  holdings: HoldingWithMarketData[];
  totalValue: number;
  onDelete: (id: string) => void;
}

export function HoldingsTable({ holdings, totalValue, onDelete }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No holdings yet</p>
        <p className="text-sm">Add your first stock holding to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Ticker</th>
            <th className="text-right py-3 px-2 text-xs text-muted-foreground font-medium">Qty</th>
            <th className="text-right py-3 px-2 text-xs text-muted-foreground font-medium hidden sm:table-cell">Avg Cost</th>
            <th className="text-right py-3 px-2 text-xs text-muted-foreground font-medium">Price</th>
            <th className="text-right py-3 px-2 text-xs text-muted-foreground font-medium hidden md:table-cell">Market Value</th>
            <th className="text-right py-3 px-2 text-xs text-muted-foreground font-medium">P&L</th>
            <th className="text-right py-3 px-2 text-xs text-muted-foreground font-medium hidden lg:table-cell">Alloc %</th>
            <th className="py-3 px-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const alloc = totalValue > 0 ? ((h.marketValue / totalValue) * 100).toFixed(1) : '0';
            return (
              <tr key={h.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <TickerLogo symbol={h.ticker} size="sm" />
                    <div>
                      <p className="font-medium text-foreground">{h.ticker}</p>
                      {h.companyName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{h.companyName}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-right py-3 px-2 text-foreground">{h.quantity}</td>
                <td className="text-right py-3 px-2 text-foreground hidden sm:table-cell">${h.avg_cost.toFixed(2)}</td>
                <td className="text-right py-3 px-2">
                  {h.currentPrice ? (
                    <div>
                      <p className="text-foreground">${h.currentPrice.toFixed(2)}</p>
                      {h.changePercent !== null && (
                        <p className={cn('text-xs', h.changePercent >= 0 ? 'text-profit' : 'text-loss')}>
                          {h.changePercent >= 0 ? '+' : ''}{h.changePercent.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-right py-3 px-2 text-foreground hidden md:table-cell">
                  ${h.marketValue.toFixed(0)}
                </td>
                <td className="text-right py-3 px-2">
                  <p className={cn('font-medium', h.unrealizedPnl >= 0 ? 'text-profit' : 'text-loss')}>
                    {h.unrealizedPnl >= 0 ? '+' : ''}${Math.abs(h.unrealizedPnl).toFixed(0)}
                  </p>
                  <p className={cn('text-xs', h.unrealizedPnlPercent >= 0 ? 'text-profit' : 'text-loss')}>
                    {h.unrealizedPnlPercent >= 0 ? '+' : ''}{h.unrealizedPnlPercent.toFixed(1)}%
                  </p>
                </td>
                <td className="text-right py-3 px-2 text-muted-foreground hidden lg:table-cell">{alloc}%</td>
                <td className="py-3 px-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(h.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
