import React from 'react';
import { WatchlistItem } from '@/lib/supabase';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Bell, BellRing, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  alert_type: string;
  threshold: number | null;
  target_value: number | null;
  fast_period: number | null;
  slow_period: number | null;
  is_active: boolean;
  watchlist_item_id: string;
}

interface Quote {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  previousClose: number;
}

interface WatchlistItemCardProps {
  item: WatchlistItem;
  quote: Quote | undefined;
  rtPrice: { price: number } | undefined;
  alert: Alert | undefined;
  quotesLoading: boolean;
  isSelected: boolean;
  onSelect: (ticker: string) => void;
  onOpenAlert: (item: WatchlistItem) => void;
  onOpenEdit: (item: WatchlistItem) => void;
  onDelete: (id: string) => void;
  getAlertLabel: (alert: Alert) => string;
}

export const WatchlistItemCard: React.FC<WatchlistItemCardProps> = ({
  item,
  quote,
  rtPrice,
  alert,
  quotesLoading,
  isSelected,
  onSelect,
  onOpenAlert,
  onOpenEdit,
  onDelete,
  getAlertLabel,
}) => {
  const displayPrice = rtPrice?.price ?? quote?.price;
  const isPositive = quote ? quote.change >= 0 : false;
  const showPriceSkeleton = quotesLoading && !quote && !displayPrice;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.ticker)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(item.ticker);
      }}
      className={cn(
        "content-card group hover:border-primary/30 transition-all cursor-pointer",
        isSelected && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 text-left">
          <TickerLogo symbol={item.ticker} size="lg" />
          <div>
            <div className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">
              {item.ticker}
            </div>
            {quote ? (
              <div className={cn(
                "text-sm flex items-center gap-1",
                isPositive ? "text-profit" : "text-loss"
              )}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isPositive ? '+' : ''}{quote.changePercent?.toFixed(2)}%
              </div>
            ) : showPriceSkeleton ? (
              <Skeleton className="h-4 w-12" />
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              alert?.is_active ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => { e.stopPropagation(); onOpenAlert(item); }}
          >
            {alert?.is_active ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          </Button>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onOpenEdit(item); }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-loss hover:text-loss"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {showPriceSkeleton ? (
        <div className="space-y-2 mb-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ) : (quote || displayPrice) ? (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-foreground">
            ${displayPrice?.toFixed(2) ?? quote?.price?.toFixed(2)}
          </span>
          {quote && (
            <span className={cn("text-sm font-medium", isPositive ? "text-profit" : "text-loss")}>
              {isPositive ? '+' : ''}${quote.change?.toFixed(2)}
            </span>
          )}
          {rtPrice && <span className="text-xs text-profit/70 animate-pulse">&bull;</span>}
        </div>
      ) : (
        <div className="text-2xl font-bold text-muted-foreground mb-2">$--</div>
      )}

      {alert?.is_active && (
        <div className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg inline-flex items-center gap-1 mb-2">
          <BellRing className="h-3 w-3" />
          {getAlertLabel(alert)}
        </div>
      )}

      {quote && (
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
          <div>
            <span className="block">High</span>
            <span className="text-foreground">${quote.high?.toFixed(2)}</span>
          </div>
          <div>
            <span className="block">Low</span>
            <span className="text-foreground">${quote.low?.toFixed(2)}</span>
          </div>
          <div>
            <span className="block">Prev</span>
            <span className="text-foreground">${quote.previousClose?.toFixed(2)}</span>
          </div>
        </div>
      )}

      {item.notes && (
        <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t border-border/50">
          {item.notes}
        </p>
      )}
    </div>
  );
};
