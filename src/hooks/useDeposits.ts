import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase, Deposit } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';
import { toast } from 'sonner';

const fetchDeposits = async (userId: string, portfolioId: string | null): Promise<Deposit[]> => {
  let query = supabase
    .from('deposits')
    .select('*')
    .eq('user_id', userId)
    .order('deposit_date', { ascending: false });
  
  if (portfolioId) {
    query = query.eq('portfolio_id', portfolioId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const useDeposits = () => {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();
  const queryClient = useQueryClient();
  const queryKey = ['deposits', user?.id, activePortfolioId];

  const { data: deposits = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchDeposits(user!.id, activePortfolioId),
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const addMutation = useMutation({
    mutationFn: async (deposit: Omit<Deposit, 'id' | 'user_id' | 'created_at'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('deposits')
        .insert({
          ...deposit,
          user_id: user.id,
          portfolio_id: activePortfolioId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Deposit[]>(queryKey, (prev) => 
        prev ? [data, ...prev] : [data]
      );
      const type = data.transaction_type === 'deposit' ? 'Deposit' : 'Withdrawal';
      toast.success(`${type} recorded!`);
    },
    onError: (error) => {
      console.error('Error adding deposit:', error);
      toast.error('Failed to record transaction');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deposits')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Deposit[]>(queryKey, (prev) => 
        prev?.filter(d => d.id !== id)
      );
      toast.success('Transaction deleted');
    },
    onError: (error) => {
      console.error('Error deleting deposit:', error);
      toast.error('Failed to delete transaction');
    },
  });

  const addDeposit = useCallback(async (deposit: Omit<Deposit, 'id' | 'user_id' | 'created_at'>) => {
    try {
      const data = await addMutation.mutateAsync(deposit);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [addMutation]);

  const deleteDeposit = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }, [deleteMutation]);

  // Calculate totals
  const { totalDeposits, totalWithdrawals, netFlow } = useMemo(() => {
    const totalDeposits = deposits
      .filter(d => d.transaction_type === 'deposit')
      .reduce((sum, d) => sum + d.amount, 0);
    
    const totalWithdrawals = deposits
      .filter(d => d.transaction_type === 'withdrawal')
      .reduce((sum, d) => sum + d.amount, 0);
    
    return {
      totalDeposits,
      totalWithdrawals,
      netFlow: totalDeposits - totalWithdrawals,
    };
  }, [deposits]);

  return {
    deposits,
    isLoading,
    totalDeposits,
    totalWithdrawals,
    netFlow,
    addDeposit,
    deleteDeposit,
    refetch,
  };
};
