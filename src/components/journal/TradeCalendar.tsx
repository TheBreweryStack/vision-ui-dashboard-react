import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  differenceInMinutes,
  differenceInHours,
  getWeek,
  getYear,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, TrendingUp } from 'lucide-react';
import { Trade } from '@/lib/supabase';
import { cn, parseDateOnly } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TickerLogo } from '@/components/common/TickerLogo';
import { TradeDetailSheet } from './TradeDetailSheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

interface WeekStats {
  weekNumber: number;
  pnl: number;
  trades: number;
}

interface TradeCalendarProps {
  trades: Trade[];
  onEdit?: (trade: Trade) => void;
  onUpdateImages?: (tradeId: string, images: string[]) => void;
}

function formatDuration(entryDate: string, entryTime: string | null, exitDate: string | null, exitTime: string | null): string {
  if (!exitDate) return 'Open';
  
  const entryDateTime = new Date(`${entryDate}T${entryTime || '09:30'}:00`);
  const exitDateTime = new Date(`${exitDate}T${exitTime || '16:00'}:00`);
  
  const minutes = differenceInMinutes(exitDateTime, entryDateTime);
  const hours = differenceInHours(exitDateTime, entryDateTime);
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } else if (hours > 0) {
    const remainingMins = minutes - (hours * 60);
    return `${hours}h ${remainingMins}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  }
  return 'Same day';
}

function getTimeOfDay(time: string | null): string {
  if (!time) return 'Market Hours';
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 10) return 'Pre-Market';
  if (hour < 12) return 'Morning';
  if (hour < 14) return 'Midday';
  if (hour < 16) return 'Afternoon';
  return 'After Hours';
}

export function TradeCalendar({ trades, onEdit, onUpdateImages }: TradeCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TradeGroup | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  // Calculate P&L by day - use exit_date for closed trades (the day P&L was realized)
  // Fallback to entry_date if exit_date is not set
  const pnlByDay = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: Trade[]; percentChange?: number }>();
    trades.forEach((trade) => {
      if (trade.status === 'closed' && trade.pnl !== null) {
        // Use exit_date if available, otherwise fallback to entry_date
        const dateKey = trade.exit_date || trade.entry_date;
        const existing = map.get(dateKey) || { pnl: 0, trades: [] };
        existing.pnl += trade.pnl;
        existing.trades.push(trade);
        map.set(dateKey, existing);
      }
    });
    return map;
  }, [trades]);

  // Calculate weekly stats for the current month view
  const weeklyStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    const weeks = new Map<string, WeekStats>();
    
    // Initialize weeks
    let current = calendarStart;
    while (current <= calendarEnd) {
      const weekKey = `${getYear(current)}-${getWeek(current)}`;
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { weekNumber: getWeek(current), pnl: 0, trades: 0 });
      }
      current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    // Aggregate trades into weeks
    trades.forEach((trade) => {
      if (trade.status === 'closed' && trade.pnl !== null) {
        // Use exit_date if available, otherwise fallback to entry_date
        const dateStr = trade.exit_date || trade.entry_date;
        const tradeDate = parseDateOnly(dateStr);
        if (tradeDate >= calendarStart && tradeDate <= calendarEnd) {
          const weekKey = `${getYear(tradeDate)}-${getWeek(tradeDate)}`;
          const weekData = weeks.get(weekKey);
          if (weekData) {
            weekData.pnl += trade.pnl;
            weekData.trades += 1;
          }
        }
      }
    });
    
    return Array.from(weeks.values());
  }, [trades, currentMonth]);

  // Get calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group days by week for display
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  const selectedDayData = selectedDay
    ? pnlByDay.get(format(selectedDay, 'yyyy-MM-dd'))
    : null;

  const groupedDayTrades = useMemo(() => {
    if (!selectedDayData) return [] as TradeGroup[];

    const groups = new Map<string, TradeGroup>();

    selectedDayData.trades.forEach((trade) => {
      const strikeKey = trade.strike_price == null ? '' : String(Number(trade.strike_price));
      const expKey = trade.expiration_date ?? '';
      const key = `${trade.ticker}-${trade.trade_type}-${strikeKey}-${expKey}`;

      if (!groups.has(key)) {
        groups.set(key, {
          ticker: trade.ticker,
          trade_type: trade.trade_type,
          trades: [],
          totalPnl: 0,
          totalQuantity: 0,
          avgEntryPrice: 0,
          status: 'closed',
          position_id: null,
          strike_price: trade.strike_price,
          expiration_date: trade.expiration_date,
        });
      }

      const group = groups.get(key)!;
      group.trades.push(trade);
      group.totalPnl += trade.pnl || 0;
      group.totalQuantity += trade.quantity;
    });

    groups.forEach((group) => {
      const totalCost = group.trades.reduce((sum, t) => sum + (t.entry_price * t.quantity), 0);
      group.avgEntryPrice = totalCost / group.totalQuantity;
    });

    return Array.from(groups.values()).sort((a, b) => b.totalPnl - a.totalPnl);
  }, [selectedDayData]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Handle clicking a grouped trade to show details
  const handleGroupClick = (group: TradeGroup) => {
    setSelectedGroup(group);
    setSelectedDay(null);
    setShowDetailSheet(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-lg font-semibold text-foreground">P&L Calendar</h3>
        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-foreground min-w-[90px] md:min-w-[140px] text-center text-sm md:text-base">
            {format(currentMonth, 'MMM yyyy')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="overflow-x-auto overflow-y-visible py-1">
        {/* Header row: Days only on mobile, Days + Weekly on desktop */}
        <div className="grid grid-cols-7 md:grid-cols-8 gap-1 md:gap-2 mb-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs md:text-sm font-medium text-muted-foreground py-2"
            >
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.slice(0, 1)}</span>
            </div>
          ))}
          {/* Weekly header - hidden on mobile */}
          <div className="hidden md:block text-center text-xs md:text-sm font-medium text-muted-foreground py-2">
            Weekly
          </div>
        </div>

        {/* Calendar rows */}
        <div className="space-y-1 md:space-y-2">
          {calendarWeeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 md:grid-cols-8 gap-1 md:gap-2">
              {week.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayData = pnlByDay.get(dateKey);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={dateKey}
                    onClick={() => dayData && setSelectedDay(day)}
                    disabled={!dayData}
                    className={cn(
                      'aspect-square p-0.5 md:p-1 rounded-lg text-xs md:text-sm flex flex-col items-center justify-center transition-all duration-200 relative min-h-[40px] md:min-h-[60px]',
                      !isCurrentMonth && 'opacity-30',
                      isToday && 'after:absolute after:inset-0 after:rounded-lg after:border-2 after:border-primary after:pointer-events-none',
                      dayData && dayData.pnl > 0 && 'calendar-day-profit',
                      dayData && dayData.pnl < 0 && 'calendar-day-loss',
                      dayData && dayData.pnl === 0 && 'bg-muted/30 border border-dashed border-border/50',
                      !dayData && 'hover:bg-muted/20 cursor-default border border-transparent',
                      dayData && 'cursor-pointer'
                    )}
                  >
                    <span className={cn(
                      'font-medium text-[10px] md:text-sm leading-tight',
                      !isCurrentMonth && 'text-muted-foreground',
                      isCurrentMonth && 'text-foreground'
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayData && (
                      <span className={cn(
                        'text-[8px] md:text-xs font-semibold mt-0.5 leading-tight',
                        dayData.pnl > 0 && 'text-profit',
                        dayData.pnl < 0 && 'text-loss',
                        dayData.pnl === 0 && 'text-muted-foreground'
                      )}>
                        {dayData.pnl >= 0 ? '+' : ''}${Math.abs(dayData.pnl).toFixed(0)}
                      </span>
                    )}
                  </button>
                );
              })}
              
              {/* Weekly Stats Cell - hidden on mobile */}
              {weeklyStats[weekIndex] && (
                <div
                  className={cn(
                    'hidden md:flex rounded-lg p-1 md:p-2 flex-col items-center justify-center transition-all min-h-[44px] md:min-h-[60px]',
                    weeklyStats[weekIndex].pnl > 0 && 'bg-profit/10 border border-profit/30',
                    weeklyStats[weekIndex].pnl < 0 && 'bg-loss/10 border border-loss/30',
                    weeklyStats[weekIndex].pnl === 0 && weeklyStats[weekIndex].trades === 0 && 'bg-muted/10 border border-border/30'
                  )}
                >
                  <span className={cn(
                    'text-[10px] md:text-sm font-bold',
                    weeklyStats[weekIndex].pnl > 0 && 'text-profit',
                    weeklyStats[weekIndex].pnl < 0 && 'text-loss',
                    weeklyStats[weekIndex].pnl === 0 && 'text-muted-foreground'
                  )}>
                    {weeklyStats[weekIndex].pnl !== 0 
                      ? (weeklyStats[weekIndex].pnl >= 0 ? '+' : '') + '$' + Math.abs(weeklyStats[weekIndex].pnl).toFixed(0) 
                      : '$0'}
                  </span>
                  {weeklyStats[weekIndex].trades > 0 && (
                    <span className="text-[8px] md:text-[10px] text-muted-foreground mt-0.5">
                      {weeklyStats[weekIndex].trades} trade{weeklyStats[weekIndex].trades !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Day Detail Modal */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedDay && format(selectedDay, 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>

          {selectedDayData && (
            <div className="space-y-4">
              <div className={cn(
                'text-center p-4 rounded-xl font-semibold text-lg',
                selectedDayData.pnl >= 0 ? 'bg-profit/10 text-profit border border-profit/20' : 'bg-loss/10 text-loss border border-loss/20'
              )}>
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Daily P&L: {selectedDayData.pnl >= 0 ? '+' : ''}${selectedDayData.pnl.toFixed(2)}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Trades ({groupedDayTrades.length})
                </h4>
                {groupedDayTrades.map((group) => {
                  const representative = group.trades[0];
                  const duration = formatDuration(representative.entry_date, representative.entry_time, representative.exit_date, representative.exit_time);
                  const timeOfDay = getTimeOfDay(representative.entry_time);
                  
                  return (
                    <button
                      key={`${group.ticker}-${group.trade_type}-${group.strike_price ?? ''}-${group.expiration_date ?? ''}`}
                      onClick={() => handleGroupClick(group)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-muted/50 transition-colors text-left border border-dashed border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <TickerLogo symbol={group.ticker} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{group.ticker}</p>
                            {group.totalQuantity > 1 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {group.totalQuantity}x
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">
                            {group.trade_type}
                            {group.strike_price && ` • $${group.strike_price}`}
                            {group.expiration_date && ` • Exp ${format(new Date(`${group.expiration_date}T00:00:00`), 'MMM d')}`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {duration}
                            </span>
                            <span className="text-[10px] text-primary/70">
                              {timeOfDay}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={cn(
                        'font-semibold',
                        group.totalPnl >= 0 ? 'text-profit' : 'text-loss'
                      )}>
                        {group.totalPnl >= 0 ? '+' : ''}${group.totalPnl.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trade Detail Sheet */}
      <TradeDetailSheet
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        group={selectedGroup}
        onEdit={(trade) => {
          setShowDetailSheet(false);
          onEdit?.(trade);
        }}
        onUpdateImages={onUpdateImages}
      />
    </div>
  );
}