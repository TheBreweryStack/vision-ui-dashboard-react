import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

interface WeeklyBalanceEntry {
  week_start_date: string;
  closing_balance: number;
  opening_balance: number;
}

interface PerformanceChartProps {
  weeklyBalances: WeeklyBalanceEntry[];
  initialDeposit: number;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  weeklyBalances,
  initialDeposit,
}) => {
  const chartData = useMemo(() => {
    if (!weeklyBalances.length) return [];

    const sorted = [...weeklyBalances].sort(
      (a, b) => a.week_start_date.localeCompare(b.week_start_date)
    );

    return sorted.map((wb) => ({
      date: format(parseISO(wb.week_start_date), 'MMM d'),
      balance: wb.closing_balance,
      pnl: wb.closing_balance - initialDeposit,
    }));
  }, [weeklyBalances, initialDeposit]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Close a week to see your performance chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.75rem',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#pnlGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
