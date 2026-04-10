import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: 'free' | 'trial' | 'monthly' | 'lifetime' | 'unknown';
  subscription_end: string | null;
  is_lifetime: boolean;
  trial_days_remaining: number | null;
  isLoading: boolean;
  error: string | null;
  degraded?: boolean;
}

const fetchSubscription = async (accessToken: string): Promise<Omit<SubscriptionStatus, 'isLoading' | 'error'>> => {
  const { data, error } = await supabase.functions.invoke('check-subscription', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw error;

  return {
    subscribed: data.subscribed,
    tier: data.tier || 'free',
    subscription_end: data.subscription_end,
    is_lifetime: data.is_lifetime,
    trial_days_remaining: data.trial_days_remaining,
    degraded: data.degraded,
  };
};

export function useSubscription() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

  // Use profile data as placeholder while fetching
  const placeholderData: Omit<SubscriptionStatus, 'isLoading' | 'error'> | undefined = profile?.subscription_tier ? {
    subscribed: profile.subscription_tier !== 'free',
    tier: (profile.subscription_tier as SubscriptionStatus['tier']) || 'free',
    subscription_end: profile.subscription_end || null,
    is_lifetime: profile.subscription_tier === 'lifetime',
    trial_days_remaining: null,
  } : undefined;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription', session?.access_token],
    queryFn: () => fetchSubscription(session!.access_token),
    enabled: !!session?.access_token,
    staleTime: 300000, // 5 minutes - subscription rarely changes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    placeholderData,
  });

  // Fall back to profile data if query failed but we have profile
  const effectiveData = data || placeholderData;

  const status: SubscriptionStatus = {
    subscribed: effectiveData?.subscribed ?? false,
    tier: effectiveData?.tier ?? 'free',
    subscription_end: effectiveData?.subscription_end ?? null,
    is_lifetime: effectiveData?.is_lifetime ?? false,
    trial_days_remaining: effectiveData?.trial_days_remaining ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    degraded: effectiveData?.degraded,
  };

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription', session?.access_token] });
  }, [queryClient, session?.access_token]);

  return {
    ...status,
    refresh,
    isPremium: status.subscribed || (status.tier !== 'free' && status.tier !== 'unknown'),
    isTrial: status.tier === 'trial',
  };
}
