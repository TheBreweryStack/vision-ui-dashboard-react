import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface AlphaVantageQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface AlphaVantageNews {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: string;
  sentiment: string;
  sentimentScore: number;
  image: string | null;
}

export interface AlphaVantageOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: string;
  peRatio: string;
  eps: string;
  dividendYield: string;
  fiftyTwoWeekHigh: string;
  fiftyTwoWeekLow: string;
  avgVolume: string;
  beta: string;
}

export interface OptionContract {
  contractID: string;
  symbol: string;
  expiration: string;
  strike: number;
  type: 'call' | 'put';
  last: number;
  mark: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  inTheMoney: boolean;
}

export interface OptionsChain {
  symbol: string;
  expirations: string[];
  calls: OptionContract[];
  puts: OptionContract[];
}

export const useAlphaVantage = () => {
  const [quotes, setQuotes] = useState<Record<string, AlphaVantageQuote>>({});
  const [news, setNews] = useState<AlphaVantageNews[]>([]);
  const [overview, setOverview] = useState<AlphaVantageOverview | null>(null);
  const [optionsChain, setOptionsChain] = useState<OptionsChain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('alpha-vantage', {
        body: { action: 'quotes', symbols },
      });

      if (fnError) throw fnError;
      
      if (data?.quotes) {
        setQuotes(data.quotes);
      }
    } catch (err) {
      logger.error('Alpha Vantage quotes error:', err);
      setError('Failed to fetch quotes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchQuote = useCallback(async (symbol: string): Promise<AlphaVantageQuote | null> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('alpha-vantage', {
        body: { action: 'quotes', symbols: [symbol] },
      });

      if (fnError) throw fnError;
      
      if (data?.quotes?.[symbol]) {
        return data.quotes[symbol];
      }
      return null;
    } catch (err) {
      logger.error('Alpha Vantage quote error:', err);
      return null;
    }
  }, []);

  const fetchNews = useCallback(async (symbols?: string[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('alpha-vantage', {
        body: { action: 'news', symbols },
      });

      if (fnError) throw fnError;
      
      if (data?.news) {
        setNews(data.news);
      }
    } catch (err) {
      logger.error('Alpha Vantage news error:', err);
      setError('Failed to fetch news');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async (symbol: string): Promise<AlphaVantageOverview | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('alpha-vantage', {
        body: { action: 'overview', symbols: [symbol] },
      });

      if (fnError) throw fnError;
      
      if (data?.overview) {
        setOverview(data.overview);
      }
      return data?.overview;
    } catch (err) {
      logger.error('Alpha Vantage overview error:', err);
      setError('Failed to fetch company overview');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async (symbol: string, date?: string): Promise<OptionsChain | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('alpha-vantage', {
        body: { action: 'options', symbols: [symbol], date },
      });

      if (fnError) throw fnError;
      
      if (data?.error) {
        setError(data.error);
        return null;
      }
      
      if (data?.options) {
        setOptionsChain(data.options);
        return data.options;
      }
      return null;
    } catch (err) {
      logger.error('Alpha Vantage options error:', err);
      setError('Failed to fetch options chain');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    quotes,
    news,
    overview,
    optionsChain,
    isLoading,
    error,
    fetchQuotes,
    fetchQuote,
    fetchNews,
    fetchOverview,
    fetchOptions,
  };
};
