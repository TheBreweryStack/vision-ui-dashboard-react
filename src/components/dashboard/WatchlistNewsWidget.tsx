import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, ExternalLink, RefreshCw, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { subDays, format } from 'date-fns';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: string;
  tickers?: string[];
}

interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
}

// Global cache for news by watchlist ID with timestamps
const newsCache: Record<string, { news: NewsItem[]; timestamp: number }> = {};
const CACHE_TTL = 30000; // 30 seconds

export const WatchlistNewsWidget: React.FC = () => {
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch all watchlists with their items
  const fetchWatchlists = async () => {
    if (!user) return;
    
    const { data: wlData } = await supabase
      .from('watchlists')
      .select('id, name')
      .eq('user_id', user.id);

    if (!wlData?.length) {
      setWatchlists([]);
      setIsLoading(false);
      return;
    }

    // Get items for each watchlist
    const watchlistIds = wlData.map(w => w.id);
    const { data: items } = await supabase
      .from('watchlist_items')
      .select('ticker, watchlist_id')
      .in('watchlist_id', watchlistIds);

    const watchlistsWithTickers = wlData.map(wl => ({
      id: wl.id,
      name: wl.name,
      tickers: items?.filter(i => i.watchlist_id === wl.id).map(i => i.ticker) || []
    }));

    setWatchlists(watchlistsWithTickers);
  };

  // Get active tickers based on selection
  const activeTickers = useMemo(() => {
    if (!selectedWatchlistId) {
      // All tickers from all watchlists
      return [...new Set(watchlists.flatMap(w => w.tickers))];
    }
    const wl = watchlists.find(w => w.id === selectedWatchlistId);
    return wl?.tickers || [];
  }, [selectedWatchlistId, watchlists]);

  const cacheKey = selectedWatchlistId || 'all';

  const fetchWatchlistNews = async (refresh = false) => {
    if (!user || activeTickers.length === 0) {
      setNews([]);
      setIsLoading(false);
      return;
    }

    // Check cache validity
    const cached = newsCache[cacheKey];
    if (cached && !refresh) {
      const age = Date.now() - cached.timestamp;
      setNews(cached.news);
      
      // Skip fetch if cache is still fresh
      if (age < CACHE_TTL) {
        setIsLoading(false);
        return;
      }
    }

    // Prevent duplicate fetches
    if (isFetchingRef.current && !refresh) {
      return;
    }
    isFetchingRef.current = true;

    if (refresh) {
      setIsRefreshing(true);
    } else if (!cached) {
      setIsLoading(true);
    }

    try {
      // Fetch news for top 3 tickers (API limit consideration)
      const tickersToFetch = activeTickers.slice(0, 3);
      
      // Request recent news only (last 7 days)
      const timeFrom = format(subDays(new Date(), 7), 'yyyyMMdd') + 'T0000';
      
      const { data, error } = await supabase.functions.invoke('alpha-vantage', {
        body: { 
          action: 'news', 
          symbols: tickersToFetch,
          time_from: timeFrom,
          _ts: Date.now() // Cache bust
        },
      });

      if (error) throw error;

      if (data?.news) {
        // Sort by date (newest first) and take top 5
        const sortedNews = data.news
          .sort((a: NewsItem, b: NewsItem) => {
            const dateA = new Date(a.publishedAt?.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z') || 0);
            const dateB = new Date(b.publishedAt?.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z') || 0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5);
        
        // Update cache with timestamp
        newsCache[cacheKey] = { news: sortedNews, timestamp: Date.now() };
        setNews(sortedNews);
      } else if (!cached) {
        setNews([]);
      }
    } catch (err) {
      console.error('Error fetching watchlist news:', err);
      // Keep existing news on error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  // Initial fetch of watchlists
  useEffect(() => {
    fetchWatchlists();
  }, [user]);

  // Fetch news when active tickers change
  useEffect(() => {
    if (watchlists.length > 0 && activeTickers.length > 0) {
      // Immediately show cached data if available
      const cached = newsCache[cacheKey];
      if (cached) {
        setNews(cached.news);
        // Check if we need to refresh
        const age = Date.now() - cached.timestamp;
        if (age >= CACHE_TTL) {
          fetchWatchlistNews();
        } else {
          setIsLoading(false);
        }
      } else {
        fetchWatchlistNews();
      }
    } else if (watchlists.length > 0 && activeTickers.length === 0) {
      setNews([]);
      setIsLoading(false);
    }
  }, [cacheKey, activeTickers.length, watchlists.length]);

  const getSentimentBadge = (sentiment: string) => {
    const s = sentiment?.toLowerCase() || '';
    if (s.includes('bullish') || s.includes('positive')) {
      return <Badge className="bg-profit/20 text-profit border-0 text-[10px]">Bullish</Badge>;
    }
    if (s.includes('bearish') || s.includes('negative')) {
      return <Badge className="bg-loss/20 text-loss border-0 text-[10px]">Bearish</Badge>;
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const formatted = dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z');
      const date = new Date(formatted);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffHours < 48) return 'Yesterday';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Initial loading state - show skeleton
  if (isLoading && watchlists.length === 0 && news.length === 0) {
    return (
      <div className="content-card h-[320px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Watchlist News</h2>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No watchlists state
  if (activeTickers.length === 0 && watchlists.length === 0) {
    return (
      <div className="content-card h-[320px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Watchlist News</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Eye className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Add tickers to your watchlist to see news</p>
            <Link to="/watchlist">
              <Button variant="outline" size="sm" className="mt-3">
                Go to Watchlist
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card h-[320px] flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Watchlist News</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fetchWatchlistNews(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          </Button>
          <Link to="/watchlist" className="text-xs text-primary hover:text-primary/80 transition-colors">
            View all →
          </Link>
        </div>
      </div>

      {/* Watchlist Tabs */}
      {watchlists.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide flex-shrink-0">
          <button
            onClick={() => setSelectedWatchlistId(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              !selectedWatchlistId
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {watchlists.map(wl => (
            <button
              key={wl.id}
              onClick={() => setSelectedWatchlistId(wl.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                selectedWatchlistId === wl.id
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {wl.name}
            </button>
          ))}
        </div>
      )}

      {/* Content area with fixed height */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Loading skeleton when no cached data */}
        {isLoading && news.length === 0 ? (
          <div className="space-y-3 h-full">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No recent news for your watchlist</p>
          </div>
        ) : (
          <div className="space-y-3 h-full overflow-y-auto scrollbar-hide">
            {news.map((item, idx) => {
              // Find matching ticker from active tickers
              const matchedTicker = activeTickers.find(t => 
                item.title?.toUpperCase().includes(t) || 
                item.tickers?.includes(t)
              ) || activeTickers[0];

              return (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <TickerLogo symbol={matchedTicker} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{item.source}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{formatDate(item.publishedAt)}</span>
                      {getSentimentBadge(item.sentiment)}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
