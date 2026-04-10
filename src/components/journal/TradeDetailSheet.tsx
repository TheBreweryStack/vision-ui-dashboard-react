import { useState } from 'react';
import { format, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { Share2, Edit2, Clock, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TickerLogo } from '@/components/common/TickerLogo';
import { TradeImageGallery } from './TradeImageGallery';
import { ShareTradeModal } from './ShareTradeModal';
import { cn, parseDateOnly } from '@/lib/utils';
import { Trade } from '@/lib/supabase';

interface TradeGroup {
  ticker: string;
  trade_type: string;
  trades: Trade[];
  totalPnl: number;
  totalQuantity: number;
  avgEntryPrice: number;
  status: 'open' | 'closed' | 'mixed';
  position_id?: string | null;
  strike_price?: number | null;
  expiration_date?: string | null;
}

interface TradeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: TradeGroup | null;
  onEdit: (trade: Trade) => void;
  onUpdateImages?: (tradeId: string, images: string[]) => void;
}

function formatDuration(entryDate: string, entryTime: string | null, exitDate: string | null, exitTime: string | null): string {
  if (!exitDate) return 'Open';
  
  const entryDateTime = new Date(`${entryDate}T${entryTime || '09:30'}:00`);
  const exitDateTime = new Date(`${exitDate}T${exitTime || '16:00'}:00`);
  
  const minutes = differenceInMinutes(exitDateTime, entryDateTime);
  const hours = differenceInHours(exitDateTime, entryDateTime);
  const days = differenceInDays(exitDateTime, entryDateTime);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    const remainingMins = minutes - (hours * 60);
    return `${hours}h ${remainingMins}m`;
  } else if (minutes > 0) {
    return `${minutes} min${minutes > 1 ? 's' : ''}`;
  }
  return 'Same day';
}

export function TradeDetailSheet({ open, onOpenChange, group, onEdit, onUpdateImages }: TradeDetailSheetProps) {
  const [shareModalTrade, setShareModalTrade] = useState<Trade | null>(null);
  
  if (!group) return null;

  const closedTrades = group.trades.filter(t => t.status === 'closed');
  const openTrades = group.trades.filter(t => t.status === 'open');

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-card border-border overflow-y-auto">
          <SheetHeader className="space-y-4">
            <div className="flex items-center gap-4">
              <TickerLogo symbol={group.ticker} size="xl" />
              <div>
                <SheetTitle className="text-2xl">
                  {group.ticker}
                  {group.strike_price && <span className="text-muted-foreground"> ${group.strike_price}</span>}
                </SheetTitle>
                <p className="text-muted-foreground capitalize">
                  {group.trade_type} • {group.totalQuantity} Contracts
                  {group.expiration_date && <span> • Exp: {format(parseDateOnly(group.expiration_date), 'MMM d, yyyy')}</span>}
                </p>
              </div>
            </div>

            {/* Net P&L Card */}
            <div className={cn(
              'p-4 rounded-xl border flex items-center justify-between',
              group.totalPnl >= 0 ? 'bg-profit/10 border-profit/30' : 'bg-loss/10 border-loss/30'
            )}>
              <span className="text-muted-foreground">Net P&L</span>
              <span className={cn(
                'text-2xl font-bold flex items-center gap-2',
                group.totalPnl >= 0 ? 'text-profit' : 'text-loss'
              )}>
                <TrendingUp className="h-5 w-5" />
                {group.totalPnl >= 0 ? '+' : ''}${group.totalPnl.toFixed(2)}
              </span>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Trade Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>📈</span> AVG ENTRY PRICE
                </p>
                <p className="text-lg font-semibold">${group.avgEntryPrice.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border">
                <p className="text-xs text-muted-foreground">STATUS</p>
                <Badge
                  variant="outline"
                  className={cn(
                    'mt-1',
                    group.status === 'open' && 'bg-primary/10 text-primary border-primary/30',
                    group.status === 'closed' && 'bg-muted text-foreground',
                    group.status === 'mixed' && 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                  )}
                >
                  {group.status === 'mixed' ? 'Partial' : group.status}
                </Badge>
              </div>
            </div>

            {/* Strike & Expiration Info (if options) */}
            {(group.strike_price || group.expiration_date) && (
              <div className="grid grid-cols-2 gap-4">
                {group.strike_price && (
                  <div className="p-4 rounded-xl bg-background border border-border">
                    <p className="text-xs text-muted-foreground">STRIKE PRICE</p>
                    <p className="text-lg font-semibold">${group.strike_price}</p>
                  </div>
                )}
                {group.expiration_date && (
                  <div className="p-4 rounded-xl bg-background border border-border">
                    <p className="text-xs text-muted-foreground">EXPIRATION</p>
                    <p className="text-lg font-semibold">{format(parseDateOnly(group.expiration_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>
            )}

            {/* TradingView Chart */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{group.ticker} CHART</p>
              <div className="rounded-xl overflow-hidden border border-border bg-background">
                <iframe
                  src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en&symbol=${group.ticker}&width=100%25&height=220&noTimeScale=false&valuesTracking=1&changeMode=price-only&chartType=candlesticks&largeChartUrl=&colorTheme=dark&backgroundColor=rgba(15, 17, 23, 1)`}
                  width="100%"
                  height="220"
                  frameBorder="0"
                  allowTransparency
                  scrolling="no"
                  style={{ display: 'block' }}
                />
              </div>
            </div>

            {/* Individual Trades */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                TRADE HISTORY ({group.trades.length})
              </p>
              
              {group.trades.map((trade) => {
                const duration = formatDuration(trade.entry_date, trade.entry_time, trade.exit_date, trade.exit_time);
                
                return (
                  <div
                    key={trade.id}
                    className="p-4 rounded-xl bg-background border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn(
                          trade.status === 'open' && 'bg-primary/10 text-primary border-primary/30'
                        )}>
                          {trade.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {trade.quantity} contract{trade.quantity > 1 ? 's' : ''}
                        </span>
                      </div>
                      {trade.pnl !== null && trade.status === 'closed' && (
                        <span className={cn(
                          'font-semibold',
                          trade.pnl >= 0 ? 'text-profit' : 'text-loss'
                        )}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" /> ENTRY DATE
                        </p>
                        <p>{format(parseDateOnly(trade.entry_date), 'MMM d, yyyy')}</p>
                        {trade.entry_time && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {trade.entry_time}
                          </p>
                        )}
                      </div>
                      {trade.exit_date && (
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" /> EXIT DATE
                          </p>
                          <p>{format(parseDateOnly(trade.exit_date), 'MMM d, yyyy')}</p>
                          {trade.exit_time && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {trade.exit_time}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">ENTRY PRICE</p>
                        <p className="font-medium">${trade.entry_price.toFixed(2)}</p>
                      </div>
                      {trade.exit_price && (
                        <div>
                          <p className="text-xs text-muted-foreground">EXIT PRICE</p>
                          <p className="font-medium">${trade.exit_price.toFixed(2)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> DURATION
                        </p>
                        <p className="font-medium">{duration}</p>
                      </div>
                    </div>

                    {/* Trade Images */}
                    <TradeImageGallery
                      images={trade.images || []}
                      tradeId={trade.id}
                      onImagesChange={(images) => onUpdateImages?.(trade.id, images)}
                      editable={true}
                    />

                    {trade.notes && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">NOTES</p>
                        <p className="text-sm">{trade.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(trade)}
                        className="flex-1"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setShareModalTrade(trade)}
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Share Modal */}
      {shareModalTrade && (
        <ShareTradeModal
          open={!!shareModalTrade}
          onOpenChange={(open) => !open && setShareModalTrade(null)}
          trade={shareModalTrade}
        />
      )}
    </>
  );
}