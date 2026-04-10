import { useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase, WeeklyBalance } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';
import { toast } from 'sonner';

const fetchWeeklyBalances = async (userId: string, portfolioId: string | null): Promise<WeeklyBalance[]> => {
  let query = supabase
    .from('weekly_balances')
    .select('*')
    .eq('user_id', userId)
    .order('week_start_date', { ascending: false });

  if (portfolioId) {
    query = query.eq('portfolio_id', portfolioId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export function useWeeklyBalances() {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();
  const queryClient = useQueryClient();
  const queryKey = ['weekly-balances', user?.id, activePortfolioId];

  const { data: weeklyBalances = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchWeeklyBalances(user!.id, activePortfolioId),
    enabled: !!user,
    staleTime: 60000, // 1 minute
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const addMutation = useMutation({
    mutationFn: async (balance: Omit<WeeklyBalance, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('weekly_balances')
        .insert({
          ...balance,
          user_id: user.id,
          portfolio_id: activePortfolioId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<WeeklyBalance[]>(queryKey, (prev) => 
        prev ? [data, ...prev] : [data]
      );
      toast.success('Week closed successfully!');
    },
    onError: (error) => {
      console.error('Error adding weekly balance:', error);
      toast.error('Failed to close week');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WeeklyBalance> }) => {
      const { data, error } = await supabase
        .from('weekly_balances')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<WeeklyBalance[]>(queryKey, (prev) => 
        prev?.map(b => b.id === data.id ? data : b)
      );
      toast.success('Week updated');
    },
    onError: (error) => {
      console.error('Error updating weekly balance:', error);
      toast.error('Failed to update week');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('weekly_balances')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<WeeklyBalance[]>(queryKey, (prev) => 
        prev?.filter(b => b.id !== id)
      );
      toast.success('Week deleted');
    },
    onError: (error) => {
      console.error('Error deleting weekly balance:', error);
      toast.error('Failed to delete week');
    },
  });

  const addWeeklyBalance = useCallback(async (balance: Omit<WeeklyBalance, 'id' | 'user_id' | 'created_at'>) => {
    return addMutation.mutateAsync(balance);
  }, [addMutation]);

  const updateWeeklyBalance = useCallback(async (id: string, updates: Partial<WeeklyBalance>) => {
    return updateMutation.mutateAsync({ id, updates });
  }, [updateMutation]);

  const deleteWeeklyBalance = useCallback(async (id: string) => {
    return deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  return {
    weeklyBalances,
    isLoading,
    addWeeklyBalance,
    updateWeeklyBalance,
    deleteWeeklyBalance,
    refetch,
  };
}
