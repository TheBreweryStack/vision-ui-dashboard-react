import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface TotpSetupResponse {
  success: boolean;
  secret: string;
  otpauthUrl: string;
  message: string;
}

interface VerifyResponse {
  success: boolean;
  verified: boolean;
  deviceToken?: string;
  backupCodes?: string[];
  message: string;
}

interface TrustedDeviceResponse {
  trusted: boolean;
  deviceName?: string;
  expiresAt?: string;
  reason?: string;
}

interface VerifyError {
  message: string;
  code?: string;
  driftSeconds?: number;
}

const DEVICE_TOKEN_KEY = 'tradecafe_trusted_device';

export function useTwoFactor() {
  const { session, pending2FA } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<VerifyError | null>(null);

  // Get access token from multiple sources (session, pending2FA, or fallback to getSession)
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // Priority 1: Normal logged-in session
    if (session?.access_token) {
      return session.access_token;
    }
    
    // Priority 2: Pending 2FA session (during login challenge)
    if (pending2FA?.session?.access_token) {
      return pending2FA.session.access_token;
    }
    
    // Priority 3: Fallback to Supabase getSession (covers edge cases)
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    } catch (e) {
      logger.error('[useTwoFactor] Error getting session:', e);
      return null;
    }
  }, [session?.access_token, pending2FA?.session?.access_token]);

  // Get user ID from multiple sources
  const getUserId = useCallback((): string | null => {
    return session?.user?.id ?? pending2FA?.userId ?? null;
  }, [session?.user?.id, pending2FA?.userId]);

  // Check if user has 2FA enabled
  const checkTwoFactorStatus = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return { enabled: false, verified: false };

    try {
      const { data, error } = await supabase
        .from('totp_secrets')
        .select('verified')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      return {
        enabled: !!data,
        verified: data?.verified ?? false,
      };
    } catch (err) {
      logger.error('Error checking 2FA status:', err);
      return { enabled: false, verified: false };
    }
  }, [getUserId]);

  // Start TOTP setup
  const setupTotp = useCallback(async (): Promise<TotpSetupResponse | null> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError('Not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const { data, error } = await supabase.functions.invoke('setup-totp', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as TotpSetupResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to setup 2FA';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  // Parse error from edge function response
  const parseEdgeFunctionError = (error: unknown, data: Record<string, unknown> | null): VerifyError => {
    const err = error as Record<string, unknown> | null;
    // Try to extract error from response body
    const parsedError: VerifyError = { message: 'Verification failed' };
    
    // Check if error has context with body (Supabase FunctionsHttpError)
    const ctx = err?.context as Record<string, unknown> | undefined;
    if (ctx?.body) {
      try {
        const body = (typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body) as Record<string, unknown>;
        if (body.error) {
          parsedError.message = body.error as string;
          parsedError.code = body.code as string | undefined;
          parsedError.driftSeconds = body.driftSeconds as number | undefined;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check data for error
    if (data?.error) {
      parsedError.message = data.error as string;
      parsedError.code = data.code as string | undefined;
      parsedError.driftSeconds = data.driftSeconds as number | undefined;
    }

    // Use error message if available
    const errMsg = (err as { message?: string } | null)?.message;
    if (errMsg && !parsedError.message) {
      parsedError.message = errMsg;
    }
    
    return parsedError;
  };

  // Verify TOTP code
  const verifyTotp = useCallback(
    async (
      code: string,
      options: { isSetup?: boolean; trustDevice?: boolean; useBackupCode?: boolean } = {}
    ): Promise<VerifyResponse | null> => {
      const accessToken = await getAccessToken();
      
      if (!accessToken) {
        const errorMsg = pending2FA 
          ? 'Your login session expired. Please cancel and sign in again.'
          : 'Not authenticated';
        setError(errorMsg);
        setErrorDetails({ message: errorMsg, code: 'NO_TOKEN' });
        return null;
      }

      setIsLoading(true);
      setError(null);
      setErrorDetails(null);

      try {
        const { data, error } = await supabase.functions.invoke('verify-totp', {
          body: {
            code: code.trim().toUpperCase(), // Normalize code
            isSetup: options.isSetup ?? false,
            trustDevice: options.trustDevice ?? false,
            useBackupCode: options.useBackupCode ?? false,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        // Handle edge function errors (non-2xx responses)
        if (error) {
          const parsed = parseEdgeFunctionError(error, data);
          setError(parsed.message);
          setErrorDetails(parsed);
          return null;
        }
        
        // Handle error in response body
        if (data?.error) {
          const parsed: VerifyError = {
            message: data.error,
            code: data.code,
            driftSeconds: data.driftSeconds,
          };
          setError(parsed.message);
          setErrorDetails(parsed);
          return null;
        }

        // Store device token if provided
        if (data.deviceToken) {
          localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
        }

        return data as VerifyResponse;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        setError(message);
        setErrorDetails({ message });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getAccessToken, pending2FA]
  );

  // Check if current device is trusted
  const checkTrustedDevice = useCallback(async (): Promise<TrustedDeviceResponse> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { trusted: false, reason: 'Not authenticated' };
    }

    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!deviceToken) {
      return { trusted: false, reason: 'No device token' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-trusted-device', {
        body: { deviceToken },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;

      if (!data.trusted) {
        // Remove invalid token
        localStorage.removeItem(DEVICE_TOKEN_KEY);
      }

      return data as TrustedDeviceResponse;
    } catch (err) {
      logger.error('Error checking trusted device:', err);
      return { trusted: false, reason: 'Check failed' };
    }
  }, [getAccessToken]);

  // Get stored device token
  const getDeviceToken = useCallback(() => {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  }, []);

  // Clear device trust
  const clearDeviceTrust = useCallback(() => {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  }, []);

  // Disable 2FA (delete TOTP secret)
  const disableTwoFactor = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setError('Not authenticated');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('totp_secrets')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      // Also clear device trust
      clearDeviceTrust();

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getUserId, clearDeviceTrust]);

  // Get trusted devices list
  const getTrustedDevices = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('trusted_devices')
        .select('id, device_name, created_at, expires_at, last_used_at')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false });

      if (error) throw error;

      return data ?? [];
    } catch (err) {
      logger.error('Error fetching trusted devices:', err);
      return [];
    }
  }, [getUserId]);

  // Revoke a trusted device
  const revokeTrustedDevice = useCallback(
    async (deviceId: string) => {
      const userId = getUserId();
      if (!userId) {
        setError('Not authenticated');
        return false;
      }

      try {
        const { error } = await supabase
          .from('trusted_devices')
          .delete()
          .eq('id', deviceId)
          .eq('user_id', userId);

        if (error) throw error;

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke device';
        setError(message);
        return false;
      }
    },
    [getUserId]
  );

  // Revoke all trusted devices
  const revokeAllTrustedDevices = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setError('Not authenticated');
      return false;
    }

    try {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      // Clear local device token
      clearDeviceTrust();

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke devices';
      setError(message);
      return false;
    }
  }, [getUserId, clearDeviceTrust]);

  return {
    isLoading,
    error,
    errorDetails,
    setError,
    checkTwoFactorStatus,
    setupTotp,
    verifyTotp,
    checkTrustedDevice,
    getDeviceToken,
    clearDeviceTrust,
    disableTwoFactor,
    getTrustedDevices,
    revokeTrustedDevice,
    revokeAllTrustedDevices,
  };
}
