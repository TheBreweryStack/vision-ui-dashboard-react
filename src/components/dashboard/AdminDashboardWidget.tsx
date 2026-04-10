import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Users, UserCheck, Clock, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminStats {
  totalUsers: number;
  paidUsers: number;
  trialUsers: number;
  compedUsers: number;
}

export function AdminDashboardWidget() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      // Fetch all profiles for stats
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, plan_status, comped_access, trial_ends_at');

      if (error) throw error;

      const now = new Date();
      
      const totalUsers = profiles?.length || 0;
      const paidUsers = profiles?.filter(p => 
        ['monthly', 'lifetime'].includes(p.plan_status)
      ).length || 0;
      const trialUsers = profiles?.filter(p => 
        p.plan_status === 'trial' && 
        p.trial_ends_at && 
        new Date(p.trial_ends_at) > now
      ).length || 0;
      const compedUsers = profiles?.filter(p => p.comped_access).length || 0;

      return {
        totalUsers,
        paidUsers,
        trialUsers,
        compedUsers,
      } as AdminStats;
    },
    staleTime: 60000, // 1 minute
  });

  // Show skeleton while loading instead of null
  if (isLoading) {
    return (
      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-muted/30">
              <Skeleton className="h-8 w-8 rounded-lg mb-2" />
              <Skeleton className="h-5 w-8 mb-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-muted-foreground', bg: 'bg-secondary/50' },
    { label: 'Paid', value: stats.paidUsers, icon: UserCheck, color: 'text-profit', bg: 'bg-profit/10' },
    { label: 'Trial', value: stats.trialUsers, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Comped', value: stats.compedUsers, icon: Gift, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="content-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Admin Overview</h2>
        <a href="/admin" className="text-xs text-primary hover:text-primary/80 transition-colors">
          View all →
        </a>
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="flex flex-col items-center p-3 rounded-xl bg-muted/30">
              <div className={cn("p-2 rounded-lg mb-2", card.bg)}>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
              <p className={cn("text-lg font-bold", card.color)}>{card.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
