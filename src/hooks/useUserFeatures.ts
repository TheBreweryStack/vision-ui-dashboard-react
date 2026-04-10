import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UserFeature {
  id: string;
  feature_name: string;
  enabled: boolean;
}

// Map feature names to routes
const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  journal: ['/journal'],
  analytics: ['/analytics'],
  watchlist: ['/watchlist'],
  notes: ['/playbook'],
  market: ['/market'],
  ai_analysis: ['/analytics'], // Part of analytics page
};

const fetchUserFeatures = async (userId: string): Promise<UserFeature[]> => {
  const { data, error } = await supabase
    .from('user_features')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
};

export function useUserFeatures() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['user-features', user?.id],
    queryFn: () => fetchUserFeatures(user!.id),
    enabled: !!user,
    staleTime: 60000, // 1 minute - features rarely change
    retry: 2,
  });

  // Check if a specific feature is enabled
  // Admins ALWAYS have all features enabled
  const isFeatureEnabled = useCallback((featureName: string): boolean => {
    // Admins always have access to everything - no DB check needed
    if (isAdmin) return true;
    
    const feature = features.find(f => f.feature_name === featureName);
    // If feature exists in DB, respect the enabled flag
    // If it doesn't exist, default to FALSE (feature must be explicitly enabled)
    return feature ? feature.enabled : false;
  }, [features, isAdmin]);

  // Check if a route is accessible
  const isRouteAccessible = useCallback((route: string): boolean => {
    // Admins always have access
    if (isAdmin) return true;

    // Find which feature controls this route
    for (const [featureName, routes] of Object.entries(FEATURE_ROUTE_MAP)) {
      if (routes.some(r => route.startsWith(r))) {
        return isFeatureEnabled(featureName);
      }
    }

    // Routes not in the map are accessible by default
    return true;
  }, [isAdmin, isFeatureEnabled]);

  // Get list of enabled features for navigation filtering
  const getEnabledFeatures = useCallback((): string[] => {
    if (isAdmin) {
      return Object.keys(FEATURE_ROUTE_MAP);
    }

    return Object.keys(FEATURE_ROUTE_MAP).filter(featureName => 
      isFeatureEnabled(featureName)
    );
  }, [isAdmin, isFeatureEnabled]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['user-features', user?.id] });
  }, [queryClient, user?.id]);

  return {
    features,
    isLoading,
    isFeatureEnabled,
    isRouteAccessible,
    getEnabledFeatures,
    refetch,
  };
}
