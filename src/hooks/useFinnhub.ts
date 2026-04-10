import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Quote {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

interface CompanyProfile {
  name: string;
  logo: string;
  industry: string;
  marketCap: number;
  exchange: string;
  weburl: string;
}

interface MarketOverview {
  indices: Record<string, { price: number; change: number; changePercent: number }>;
  news: Array<{
    headline: string;
    summary: string;
    url: string;
    source: string;
    datetime: number;
    image: string;
  }>;
  marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours';
}

export function useFinnhub() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [profiles, setProfiles] = useState<Record<string, CompanyProfile>>({});
  const [marketOverview, setMarketOverview] = useState<MarketOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('finnhub-quote', {
        body: { symbols, type: 'quote' },
      });
      
      if (error) throw error;
      if (data?.data) {
        setQuotes(prev => ({ ...prev, ...data.data }));
      }
    } catch (err: unknown) {
      console.error('Failed to fetch quotes:', err);
      setError(err.message || 'Failed to fetch quotes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProfiles = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('finnhub-quote', {
        body: { symbols, type: 'profile' },
      });
      
      if (error) throw error;
      if (data?.data) {
        setProfiles(prev => ({ ...prev, ...data.data }));
      }
    } catch (err: unknown) {
      console.error('Failed to fetch profiles:', err);
      setError(err.message || 'Failed to fetch profiles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMarketOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('market-overview', {
        body: {},
      });
      
      if (error) throw error;
      setMarketOverview(data);
    } catch (err: unknown) {
      console.error('Failed to fetch market overview:', err);
      setError(err.message || 'Failed to fetch market overview');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    quotes,
    profiles,
    marketOverview,
    isLoading,
    error,
    fetchQuotes,
    fetchProfiles,
    fetchMarketOverview,
  };
}
