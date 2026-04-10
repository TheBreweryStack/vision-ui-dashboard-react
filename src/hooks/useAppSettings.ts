import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type TwoFAEnforcement = 'disabled' | 'optional' | 'prompted' | 'mandatory';

export interface AppSettings {
  id: string;
  app_name: string;
  app_description: string | null;
  logo_url: string | null;
  show_logo: boolean | null;
  primary_color: string | null;
  foreground_color: string | null;
  muted_foreground_color: string | null;
  success_color: string | null;
  destructive_color: string | null;
  background_color: string | null;
  card_color: string | null;
  twofa_enforcement: TwoFAEnforcement;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: '',
  app_name: 'TraderCafé',
  app_description: null,
  logo_url: null,
  show_logo: true,
  primary_color: null,
  foreground_color: null,
  muted_foreground_color: null,
  success_color: null,
  destructive_color: null,
  background_color: null,
  card_color: null,
  twofa_enforcement: 'optional',
  created_at: '',
  updated_at: '',
};

async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('[useAppSettings] Error fetching settings:', error);
    return DEFAULT_SETTINGS;
  }

  if (!data) return DEFAULT_SETTINGS;

  return {
    ...DEFAULT_SETTINGS,
    ...data,
    twofa_enforcement: (data.twofa_enforcement as TwoFAEnforcement) || 'optional',
  };
}

export function useAppSettings() {
  const queryClient = useQueryClient();

  const { data: settings = DEFAULT_SETTINGS, isLoading, error } = useQuery({
    queryKey: ['app-settings'],
    queryFn: fetchAppSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes - settings rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['app-settings'] });
  };

  // Helper to check if 2FA should be shown to users
  const is2FAEnabled = settings.twofa_enforcement !== 'disabled';
  
  // Helper to check if 2FA banner should be shown
  const should2FAPrompt = settings.twofa_enforcement === 'prompted' || settings.twofa_enforcement === 'mandatory';
  
  // Helper to check if 2FA is mandatory
  const is2FAMandatory = settings.twofa_enforcement === 'mandatory';

  return {
    settings,
    isLoading,
    error,
    refetch,
    is2FAEnabled,
    should2FAPrompt,
    is2FAMandatory,
  };
}
