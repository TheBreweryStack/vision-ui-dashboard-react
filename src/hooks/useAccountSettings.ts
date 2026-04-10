import { useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase, AccountSettings } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

const defaultSettings: Omit<AccountSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  starting_balance: 0,
  initial_deposit: 0,
  weekly_goal: 500,
  currency: 'USD',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
};

const fetchOrCreateSettings = async (userId: string, portfolioId: string | null): Promise<AccountSettings> => {
  let query = supabase
    .from('account_settings')
    .select('*')
    .eq('user_id', userId);
  
  if (portfolioId) {
    query = query.eq('portfolio_id', portfolioId);
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error) throw error;
  
  if (data) {
    return data;
  }
  
  // Create default settings if none exist
  const { data: newSettings, error: createError } = await supabase
    .from('account_settings')
    .insert({
      ...defaultSettings,
      user_id: userId,
      portfolio_id: portfolioId,
    })
    .select()
    .single();
  
  if (createError) throw createError;
  return newSettings;
};

export const useAccountSettings = () => {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();
  const queryClient = useQueryClient();
  const queryKey = ['account-settings', user?.id, activePortfolioId];

  const { data: settings = null, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchOrCreateSettings(user!.id, activePortfolioId),
    enabled: !!user,
    staleTime: 60000, // 1 minute - settings rarely change
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<AccountSettings>) => {
      if (!settings) throw new Error('No settings found');
      
      const { data, error } = await supabase
        .from('account_settings')
        .update(updates)
        .eq('id', settings.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      toast.success('Settings updated!');
    },
    onError: (error) => {
      logger.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    },
  });

  const updateSettings = useCallback(async (updates: Partial<AccountSettings>) => {
    try {
      const data = await updateMutation.mutateAsync(updates);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }, [updateMutation]);

  return {
    settings,
    isLoading,
    updateSettings,
    refetch,
  };
};
