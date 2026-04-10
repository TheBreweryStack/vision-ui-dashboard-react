import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { EmailIngestAddress } from '@/lib/tradeInbox';
import { logger } from '@/lib/logger';

const INGEST_DOMAIN = 'ingest.tradercafe.app';

// Generate a random token
function generateToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const useEmailIngest = () => {
  const { user } = useAuth();
  const [address, setAddress] = useState<EmailIngestAddress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchAddress = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_ingest_addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'sendgrid')
        .maybeSingle();
      
      if (error) throw error;
      setAddress(data as EmailIngestAddress | null);
    } catch (error) {
      logger.error('Error fetching email ingest address:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAddress();
  }, [fetchAddress]);

  const generateAddress = async (): Promise<EmailIngestAddress | null> => {
    if (!user) return null;
    
    setIsGenerating(true);
    try {
      const token = generateToken();
      const emailAddress = `ws+${token}@${INGEST_DOMAIN}`;

      const { data, error } = await supabase
        .from('email_ingest_addresses')
        .insert({
          user_id: user.id,
          provider: 'sendgrid',
          token,
          email_address: emailAddress,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const typedData = data as EmailIngestAddress;
      setAddress(typedData);
      toast.success('Email forwarding address generated!');
      return typedData;
    } catch (error) {
      logger.error('Error generating email address:', error);
      toast.error('Failed to generate email address');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleActive = async (isActive: boolean) => {
    if (!address) return;
    
    try {
      const { error } = await supabase
        .from('email_ingest_addresses')
        .update({ is_active: isActive })
        .eq('id', address.id);
      
      if (error) throw error;
      
      setAddress(prev => prev ? { ...prev, is_active: isActive } : null);
      toast.success(isActive ? 'Email sync enabled' : 'Email sync disabled');
    } catch (error) {
      logger.error('Error toggling email ingest:', error);
      toast.error('Failed to update status');
    }
  };

  const regenerateAddress = async (): Promise<EmailIngestAddress | null> => {
    if (!user || !address) return null;
    
    setIsGenerating(true);
    try {
      // Delete existing address
      await supabase
        .from('email_ingest_addresses')
        .delete()
        .eq('id', address.id);

      // Generate new one
      return await generateAddress();
    } catch (error) {
      logger.error('Error regenerating address:', error);
      toast.error('Failed to regenerate address');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    address,
    isLoading,
    isGenerating,
    generateAddress,
    toggleActive,
    regenerateAddress,
    refetch: fetchAddress,
  };
};
