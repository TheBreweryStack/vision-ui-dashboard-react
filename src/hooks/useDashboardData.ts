import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';

interface DashboardSettings {
  starting_balance: number;
  weekly_goal: number;
}

interface DashboardStats {
  total_pnl: number;
  total_trades: number;
  open_trades: number;
  avg_win: number;
  avg_loss: number;
  win_rate: number;
}

interface DashboardGroup {
  id: string;
  ticker: string;
  trade_type: string;
  strike_price: number | null;
  entry_date: string;
  status: string;
  remaining_qty: number;
  closed_qty: number;
  realized_pnl: number | null;
  avg_entry_price: number;
  updated_at: string;
}

interface DashboardReminder {
  id: string;
  title: string;
  ticker: string | null;
  priority: string;
  due_date: string;
  reminder_time: string | null;
}

export interface NoteTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  reminder_time: string | null;
  ticker: string | null;
  note_title: string;
  note_id: string;
}

interface InboxCounts {
  pending: number;
  needs_review: number;
}

interface DashboardData {
  settings: DashboardSettings | null;
  netFlow: number;
  stats: DashboardStats;
  weeklyPnl: number;
  consecutiveLosses: number;
  recentGroups: DashboardGroup[];
  openGroups: DashboardGroup[];
  upcomingReminders: DashboardReminder[];
  noteTasks: NoteTask[];
  inboxCounts: InboxCounts;
  weekClosed: boolean;
}

const defaultData: DashboardData = {
  settings: null,
  netFlow: 0,
  stats: {
    total_pnl: 0,
    total_trades: 0,
    open_trades: 0,
    avg_win: 0,
    avg_loss: 0,
    win_rate: 0,
  },
  weeklyPnl: 0,
  consecutiveLosses: 0,
  recentGroups: [],
  openGroups: [],
  upcomingReminders: [],
  noteTasks: [],
  inboxCounts: { pending: 0, needs_review: 0 },
  weekClosed: false,
};

const fetchDashboardData = async (portfolioId: string | null): Promise<DashboardData> => {
  const { data: rpcResult, error: rpcError } = await supabase.rpc('get_dashboard_data', 
    portfolioId ? { p_portfolio_id: portfolioId } : {}
  );

  if (rpcError) throw rpcError;

  if (rpcResult && typeof rpcResult === 'object' && !Array.isArray(rpcResult)) {
    const result = rpcResult as Record<string, unknown>;
    const stats = (result.stats as Record<string, number>) || {};
    const settings = result.settings as DashboardSettings | null;
    const inboxCounts = (result.inboxCounts as InboxCounts) || { pending: 0, needs_review: 0 };
    
    return {
      settings: settings || null,
      netFlow: (result.netFlow as number) || 0,
      stats: {
        total_pnl: stats.total_pnl || 0,
        total_trades: stats.total_trades || 0,
        open_trades: stats.open_trades || 0,
        avg_win: stats.avg_win || 0,
        avg_loss: stats.avg_loss || 0,
        win_rate: stats.win_rate || 0,
      },
      weeklyPnl: (result.weeklyPnl as number) || 0,
      consecutiveLosses: (result.consecutiveLosses as number) || 0,
      recentGroups: (result.recentGroups as DashboardGroup[]) || [],
      openGroups: (result.openGroups as DashboardGroup[]) || [],
      upcomingReminders: (result.upcomingReminders as DashboardReminder[]) || [],
      noteTasks: (result.noteTasks as NoteTask[]) || [],
      inboxCounts,
      weekClosed: (result.weekClosed as boolean) || false,
    };
  }

  return defaultData;
};

export const useDashboardData = () => {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-data', user?.id, activePortfolioId],
    queryFn: () => fetchDashboardData(activePortfolioId),
    enabled: !!user,
    staleTime: 30000, // 30 seconds - shared across navigation
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  return {
    data: data || defaultData,
    isLoading,
    error,
    refetch,
  };
};
