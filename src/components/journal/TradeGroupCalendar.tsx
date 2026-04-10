import { useState, useMemo, useEffect } from 'react';
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
  getWeek,
  getYear,
} from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp, Clock } from 'lucide-react';
import { TradeGroupWithFills } from '@/hooks/useTradeGroups';
import { cn, parseDateOnly, isExpiredOption } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TickerLogo } from '@/components/common/TickerLogo';
import { TradeGroupDetailSheet } from './TradeGroupDetailSheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface WeekStats {
  weekNumber: number;
  pnl: number;
  trades: number;
}

interface DayGroup {
  key: string;
  ticker: string;
  trade_type: string | null;
  strike_price: number | null;
  expiration_date: string | null;
  total_pnl: number;
  trade_group_count: number;
  contracts_closed: number;
  groups: TradeGroupWithFills[];
}

type PnlFilter = 'all' | 'wins' | 'losses';
type CalendarViewMode = 'month' | 'year';

interface TradeGroupCalendarProps {
  groups: TradeGroupWithFills[];
  onUpdateImages?: (groupId: string, images: string[]) => Promise<void>;
  onClosePosition?: (groupId: string, quantity: number, price: number, date: Date) => Promise<void>;
}

function makeContractKey(g: TradeGroupWithFills): string {
  const strike = g.strike_price ?? 'STK';
  const exp = g.expiration_date ?? 'NA';
  const type = g.trade_type ?? 'unknown';
  return `${g.ticker}|${type}|${strike}|${exp}`;
}

function groupDayTradeGroups(tradeGroups: TradeGroupWithFills[]): DayGroup[] {
  const map = new Map<string, DayGroup>();

  for (const g of tradeGroups) {
    const key = makeContractKey(g);
    const pnl = g.realized_pnl ?? 0;

    if (!map.has(key)) {
      map.set(key, {
        key,
        ticker: g.ticker,
        trade_type: g.trade_type ?? null,
        strike_price: g.strike_price ?? null,
        expiration_date: g.expiration_date ?? null,
        total_pnl: pnl,
        trade_group_count: 1,
        contracts_closed: g.closed_qty ?? 0,
        groups: [g],
      });
    } else {
      const existing = map.get(key)!;
      existing.total_pnl += pnl;
      existing.trade_group_count += 1;
      existing.contracts_closed += g.closed_qty ?? 0;
      existing.groups.push(g);
    }
  }

  // Sort by biggest absolute P&L impact
  return Array.from(map.values()).sort(
    (a, b) => Math.abs(b.total_pnl) - Math.abs(a.total_pnl)
  );
}

export function TradeGroupCalendar({ groups, onUpdateImages, onClosePosition }: TradeGroupCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TradeGroupWithFills | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>('all');
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Year filter state - default to most recent year with trade data
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const yearsWithTrades = new Set<number>();
    groups.forEach(g => {
      yearsWithTrades.add(getYear(parseDateOnly(g.entry_date)));
      if (g.exit_date) yearsWithTrades.add(getYear(parseDateOnly(g.exit_date)));
    });
    
    if (yearsWithTrades.size > 0) {
      return Math.max(...Array.from(yearsWithTrades));
    }
    return new Date().getFullYear();
  });

  // Get available months from groups
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    
    groups.forEach(group => {
      // Include entry month and exit month
      const entryDate = parseDateOnly(group.entry_date);
      monthSet.add(format(entryDate, 'yyyy-MM'));
      
      if (group.exit_date) {
        const exitDate = parseDateOnly(group.exit_date);
        monthSet.add(format(exitDate, 'yyyy-MM'));
      }
      
      // Also include fill dates
      group.fills.forEach(fill => {
        const fillDate = parseDateOnly(fill.fill_date);
        monthSet.add(format(fillDate, 'yyyy-MM'));
      });
    });

    // Add current month if not present
    monthSet.add(format(new Date(), 'yyyy-MM'));

    // Sort descending (newest first)
    return Array.from(monthSet)
      .sort((a, b) => b.localeCompare(a))
      .map(monthStr => {
        const date = parseDateOnly(`${monthStr}-01`);
        return {
          value: monthStr,
          label: format(date, 'MMMM yyyy'),
          date,
        };
      });
  }, [groups]);

  // Get available years from trade groups
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    
    groups.forEach(group => {
      yearSet.add(getYear(parseDateOnly(group.entry_date)));
      if (group.exit_date) {
        yearSet.add(getYear(parseDateOnly(group.exit_date)));
      }
      group.fills.forEach(fill => {
        yearSet.add(getYear(parseDateOnly(fill.fill_date)));
      });
    });
    
    // Add current year if not present
    yearSet.add(new Date().getFullYear());
    
    // Sort descending (newest first)
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [groups]);

  // Filter months by selected year
  const filteredMonths = useMemo(() => {
    return availableMonths.filter(m => getYear(m.date) === selectedYear);
  }, [availableMonths, selectedYear]);

  // When year changes, update currentMonth to a month in that year
  useEffect(() => {
    if (getYear(currentMonth) !== selectedYear) {
      const monthsInYear = availableMonths.filter(m => getYear(m.date) === selectedYear);
      if (monthsInYear.length > 0) {
        setCurrentMonth(monthsInYear[0].date); // Set to most recent month in that year
      } else {
        // Fallback to January of selected year
        setCurrentMonth(new Date(selectedYear, 0, 1));
      }
    }
  }, [selectedYear, availableMonths, currentMonth]);

  // Aggregate monthly P&L for Year view
  const monthlyPnL = useMemo(() => {
    const monthData = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      pnl: 0,
      trades: 0,
    }));

    groups.forEach(group => {
      if (group.status === 'closed' && group.exit_date && group.realized_pnl !== null) {
        const exitDate = parseDateOnly(group.exit_date);
        if (getYear(exitDate) === selectedYear) {
          const monthIndex = exitDate.getMonth();
          monthData[monthIndex].pnl += group.realized_pnl;
          monthData[monthIndex].trades += 1;
        }
      }
    });

    return monthData;
  }, [groups, selectedYear]);

  // Reset expanded groups when modal closes
  const handleDayModalClose = () => {
    setSelectedDay(null);
    setExpandedGroups(new Set());
  };

  // Calculate P&L by day from closed groups (with filter applied)
  // Use exit_date if available, otherwise use the date of the last closing fill
  const pnlByDay = useMemo(() => {
    const map = new Map<string, { pnl: number; groups: TradeGroupWithFills[] }>();
    
    groups.forEach((group) => {
      if (group.status === 'closed' && group.realized_pnl !== null) {
        // Apply P&L filter
        if (pnlFilter === 'wins' && group.realized_pnl <= 0) return;
        if (pnlFilter === 'losses' && group.realized_pnl >= 0) return;

        // Priority: exit_date > last close fill date > entry_date
        let dateKey: string;
        
        if (group.exit_date) {
          dateKey = group.exit_date;
        } else {
          // Fallback: find the last closing fill date
          const closingFills = group.fills.filter(f => f.effect === 'close');
          const lastCloseFill = closingFills.length > 0 
            ? closingFills.reduce((latest, fill) => 
                new Date(fill.fill_date) > new Date(latest.fill_date) ? fill : latest
              )
            : null;
          
          dateKey = lastCloseFill?.fill_date || group.entry_date;
        }
        
        const existing = map.get(dateKey) || { pnl: 0, groups: [] };
        existing.pnl += group.realized_pnl;
        existing.groups.push(group);
        map.set(dateKey, existing);
      }
    });
    
    return map;
  }, [groups, pnlFilter]);

  // Calculate weekly stats
  const weeklyStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    const weeks = new Map<string, WeekStats>();
    
    let current = calendarStart;
    while (current <= calendarEnd) {
      const weekKey = `${getYear(current)}-${getWeek(current)}`;
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { weekNumber: getWeek(current), pnl: 0, trades: 0 });
      }
      current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    pnlByDay.forEach((dayData, dateStr) => {
      const tradeDate = parseDateOnly(dateStr);
      if (tradeDate >= calendarStart && tradeDate <= calendarEnd) {
        const weekKey = `${getYear(tradeDate)}-${getWeek(tradeDate)}`;
        const weekData = weeks.get(weekKey);
        if (weekData) {
          weekData.pnl += dayData.pnl;
          weekData.trades += dayData.groups.length;
        }
      }
    });
    
    return Array.from(weeks.values());
  }, [pnlByDay, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

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

  const groupedDayData = useMemo(() => {
    if (!selectedDayData) return [];
    return groupDayTradeGroups(selectedDayData.groups);
  }, [selectedDayData]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleGroupClick = (group: TradeGroupWithFills) => {
    setSelectedGroup(group);
    setSelectedDay(null);
    setExpandedGroups(new Set());
    setShowDetailSheet(true);
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCloseExpired = async (group: TradeGroupWithFills) => {
    if (!onClosePosition || !isExpiredOption(group)) return;
    
    const expDate = group.expiration_date 
      ? parseDateOnly(group.expiration_date)
      : new Date();
    
    await onClosePosition(group.id, group.remaining_qty, 0, expDate);
  };

  return (
    <div className="space-y-4">
      {/* Header with Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-foreground">P&L Calendar</h3>
            
            {/* Month/Year Toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as CalendarViewMode)}
              className="bg-muted/30 rounded-lg p-0.5"
            >
              <ToggleGroupItem
                value="month"
                className="text-xs px-3 py-1.5 data-[state=on]:bg-background data-[state=on]:text-foreground"
              >
                Month
              </ToggleGroupItem>
              <ToggleGroupItem
                value="year"
                className="text-xs px-3 py-1.5 data-[state=on]:bg-background data-[state=on]:text-foreground"
              >
                Year
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex items-center gap-2">
            {/* Year Selector */}
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[80px] bg-background border-border">
                <SelectValue>{selectedYear}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Month Navigation - Only show in month view */}
            {viewMode === 'month' && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="h-8 w-8"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={format(currentMonth, 'yyyy-MM')}
                  onValueChange={(value) => {
                    const month = filteredMonths.find(m => m.value === value);
                    if (month) setCurrentMonth(month.date);
                  }}
                >
                  <SelectTrigger className="w-[130px] bg-background border-border">
                    <SelectValue>{format(currentMonth, 'MMMM')}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-[300px]">
                    {filteredMonths.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {format(month.date, 'MMMM')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="h-8 w-8"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* P&L Filter - Only show in month view */}
        {viewMode === 'month' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <ToggleGroup
              type="single"
              value={pnlFilter}
              onValueChange={(value) => value && setPnlFilter(value as PnlFilter)}
              className="bg-muted/30 rounded-lg p-0.5"
            >
              <ToggleGroupItem
                value="all"
                className="text-xs px-3 py-1.5 data-[state=on]:bg-background data-[state=on]:text-foreground"
              >
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="wins"
                className="text-xs px-3 py-1.5 data-[state=on]:bg-profit/20 data-[state=on]:text-profit"
              >
                Wins
              </ToggleGroupItem>
              <ToggleGroupItem
                value="losses"
                className="text-xs px-3 py-1.5 data-[state=on]:bg-loss/20 data-[state=on]:text-loss"
              >
                Losses
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* Year View - 12 Month Grid */}
      {viewMode === 'year' && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
          {monthlyPnL.map((data, index) => {
            const isPositive = data.pnl >= 0;
            const hasTrades = data.trades > 0;
            const monthName = format(new Date(selectedYear, index, 1), 'MMM');
            
            return (
              <button
                key={index}
                onClick={() => {
                  setCurrentMonth(new Date(selectedYear, index, 1));
                  setViewMode('month');
                }}
                className={cn(
                  "p-4 md:p-6 rounded-lg text-center transition-all duration-200 cursor-pointer",
                  hasTrades && isPositive && "calendar-day-profit",
                  hasTrades && !isPositive && "calendar-day-loss",
                  !hasTrades && "bg-muted/30 border border-dashed border-border/50 hover:bg-muted/40"
                )}
              >
                <div className="text-sm font-medium text-foreground mb-1">
                  {monthName}.
                </div>
                <div className={cn(
                  "text-base md:text-lg font-semibold",
                  hasTrades 
                    ? isPositive ? "text-profit" : "text-loss"
                    : "text-muted-foreground"
                )}>
                  {hasTrades 
                    ? `${isPositive ? '+' : ''}$${Math.abs(data.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '-'
                  }
                </div>
                {hasTrades && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {data.trades} trade{data.trades !== 1 ? 's' : ''}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Month View - Day Calendar */}
      {viewMode === 'month' && (
        <div className="overflow-x-auto">
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
            <div className="hidden md:block text-center text-xs md:text-sm font-medium text-muted-foreground py-2">
              Weekly
            </div>
          </div>

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
                      'aspect-square p-1 rounded-lg text-xs md:text-sm flex flex-col items-center justify-center transition-all duration-200 relative min-h-[44px] md:min-h-[60px]',
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
                      'font-medium text-[11px] md:text-sm',
                      !isCurrentMonth && 'text-muted-foreground',
                      isCurrentMonth && 'text-foreground'
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayData && (
                      <span className={cn(
                        'text-[9px] md:text-xs font-semibold mt-0.5',
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
      )}

      {/* Day Detail Modal with Grouped Breakdown */}
      <Dialog open={!!selectedDay} onOpenChange={handleDayModalClose}>
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
                  Breakdown ({groupedDayData.length} position{groupedDayData.length !== 1 ? 's' : ''})
                </h4>
                
                {groupedDayData.map((dayGroup) => {
                  const isExpanded = expandedGroups.has(dayGroup.key);
                  const hasMultiple = dayGroup.trade_group_count > 1;

                  return (
                    <div key={dayGroup.key} className="space-y-1">
                      {/* Parent row */}
                      <button
                        onClick={() => {
                          if (hasMultiple) {
                            toggleGroupExpanded(dayGroup.key);
                          } else {
                            handleGroupClick(dayGroup.groups[0]);
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-muted/50 transition-colors text-left border border-dashed border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <TickerLogo symbol={dayGroup.ticker} size="md" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{dayGroup.ticker}</p>
                              {dayGroup.contracts_closed > 1 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {dayGroup.contracts_closed}x
                                </Badge>
                              )}
                              {hasMultiple && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({dayGroup.trade_group_count} trades)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">
                              {dayGroup.trade_type}
                              {dayGroup.strike_price && ` • $${dayGroup.strike_price}`}
                              {dayGroup.expiration_date && ` • Exp ${format(parseDateOnly(dayGroup.expiration_date), 'MMM d')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-semibold',
                            dayGroup.total_pnl >= 0 ? 'text-profit' : 'text-loss'
                          )}>
                            {dayGroup.total_pnl >= 0 ? '+' : ''}${dayGroup.total_pnl.toFixed(2)}
                          </span>
                          {hasMultiple && (
                            isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )
                          )}
                        </div>
                      </button>

                      {/* Expanded child rows */}
                      {isExpanded && hasMultiple && (
                        <div className="ml-4 space-y-1">
                          {dayGroup.groups.map((group) => (
                            <button
                              key={group.id}
                              onClick={() => handleGroupClick(group)}
                              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left border border-border/30"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-6 bg-border/50 rounded-full" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">{group.ticker}</p>
                                    {group.opened_qty > 1 && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                                        {group.opened_qty}x
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    Entry: ${group.avg_entry_price.toFixed(2)} → Exit: ${(group.avg_exit_price ?? 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <span className={cn(
                                'text-sm font-semibold',
                                (group.realized_pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'
                              )}>
                                {(group.realized_pnl ?? 0) >= 0 ? '+' : ''}${(group.realized_pnl ?? 0).toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trade Group Detail Sheet */}
      <TradeGroupDetailSheet
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        group={selectedGroup}
        onUpdateImages={onUpdateImages ? (groupId, images) => onUpdateImages(groupId, images) : undefined}
      />
    </div>
  );
}