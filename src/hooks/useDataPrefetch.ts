import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// Cache for prefetched data, keyed by userId:portfolioId
interface TradeGroupRow { id: string; [key: string]: unknown }
interface TradeFillRow { trade_group_id: string; [key: string]: unknown }
interface AccountSettingsRow { user_id: string; [key: string]: unknown }
interface DepositRow { id: string; [key: string]: unknown }
interface AnnouncementRow { id: string; [key: string]: unknown }

interface PrefetchCache {
  tradeGroups?: TradeGroupRow[];
  tradeFills?: TradeFillRow[];
  accountSettings?: AccountSettingsRow | null;
  deposits?: DepositRow[];
  announcements?: AnnouncementRow[];
  timestamp: number;
}

const CACHE_TTL = 60000; // 1 minute cache
const prefetchCacheMap = new Map<string, PrefetchCache>();

function getCacheKey(userId: string, portfolioId?: string | null): string {
  return `${userId}:${portfolioId ?? 'all'}`;
}

export function getPrefetchedData(userId?: string, portfolioId?: string | null) {
  if (!userId) return null;
  const key = getCacheKey(userId, portfolioId);
  const cached = prefetchCacheMap.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  return null;
}

export function clearPrefetchCache() {
  prefetchCacheMap.clear();
}

export async function prefetchDashboardData(userId: string, portfolioId?: string | null): Promise<PrefetchCache> {
  const key = getCacheKey(userId, portfolioId);

  // Return cached data if fresh
  const existing = prefetchCacheMap.get(key);
  if (existing && Date.now() - existing.timestamp < CACHE_TTL) {
    return existing;
  }

  try {
    // Build queries with optional portfolio filter
    let groupsQuery = supabase
      .from('trade_groups')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false });
    if (portfolioId) groupsQuery = groupsQuery.eq('portfolio_id', portfolioId);

    let settingsQuery = supabase
      .from('account_settings')
      .select('*')
      .eq('user_id', userId);
    if (portfolioId) settingsQuery = settingsQuery.eq('portfolio_id', portfolioId);

    let depositsQuery = supabase
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('deposit_date', { ascending: false });
    if (portfolioId) depositsQuery = depositsQuery.eq('portfolio_id', portfolioId);

    // Fetch all critical data in parallel
    const [
      groupsResult,
      settingsResult,
      depositsResult,
      announcementsResult,
    ] = await Promise.all([
      groupsQuery,
      settingsQuery.maybeSingle(),
      depositsQuery,
      supabase
        .from('announcements_public')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    // Fetch fills for all groups
    let tradeFills: TradeFillRow[] = [];
    if (groupsResult.data && groupsResult.data.length > 0) {
      const groupIds = groupsResult.data.map((g) => g.id);
      const fillsResult = await supabase
        .from('trade_fills')
        .select('*')
        .in('trade_group_id', groupIds)
        .order('fill_date', { ascending: true });
      tradeFills = fillsResult.data || [];
    }

    const cache: PrefetchCache = {
      tradeGroups: groupsResult.data || [],
      tradeFills,
      accountSettings: settingsResult.data,
      deposits: depositsResult.data || [],
      announcements: announcementsResult.data || [],
      timestamp: Date.now(),
    };

    prefetchCacheMap.set(key, cache);
    return cache;
  } catch (error) {
    logger.error('Prefetch error:', error);
    return { timestamp: 0 };
  }
}

export function useDataPrefetch(userId: string | undefined) {
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (userId && !hasPrefetched.current) {
      hasPrefetched.current = true;
      prefetchDashboardData(userId);
    }
  }, [userId]);
}
