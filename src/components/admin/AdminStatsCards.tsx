import React from 'react';
import { Users, BarChart3, DollarSign, TrendingUp, Activity, LineChart, UserCheck, UserX, Clock, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminStats {
  totalUsers: number;
  totalTrades: number;
  platformPnl: number;
  winRate: number;
  activeToday: number;
  openPositions: number;
  paidUsers: number;
  compedUsers: number;
  trialUsers?: number;
  churnedUsers?: number;
}

interface AdminStatsCardsProps {
  stats: AdminStats;
  isLoading: boolean;
}

export const AdminStatsCards: React.FC<AdminStatsCardsProps> = ({ stats, isLoading }) => {
  const cards = [
    {
      label: 'Total Users',
      value: stats.totalUsers.toString(),
      icon: Users,
      color: 'text-muted-foreground',
      bgColor: 'bg-secondary/50',
    },
    {
      label: 'Paid Users',
      value: stats.paidUsers.toString(),
      icon: UserCheck,
      color: 'text-profit',
      bgColor: 'bg-profit/10',
    },
    {
      label: 'On Trial',
      value: (stats.trialUsers ?? 0).toString(),
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Comped Users',
      value: stats.compedUsers.toString(),
      icon: Gift,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Churned',
      value: (stats.churnedUsers ?? 0).toString(),
      icon: UserX,
      color: 'text-loss',
      bgColor: 'bg-loss/10',
    },
    {
      label: 'Platform P&L',
      value: `${stats.platformPnl >= 0 ? '+' : ''}$${stats.platformPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: stats.platformPnl >= 0 ? 'text-profit' : 'text-loss',
      bgColor: stats.platformPnl >= 0 ? 'bg-profit/10' : 'bg-loss/10',
    },
    {
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Open Positions',
      value: stats.openPositions.toString(),
      icon: LineChart,
      color: 'text-muted-foreground',
      bgColor: 'bg-secondary/50',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="content-card animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/50" />
            </div>
            <div className="h-7 w-20 bg-secondary/50 rounded mb-1" />
            <div className="h-4 w-16 bg-secondary/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="content-card">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2.5 rounded-lg", card.bgColor)}>
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
            </div>
            <p className={cn("text-xl font-bold", card.color)}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
};
