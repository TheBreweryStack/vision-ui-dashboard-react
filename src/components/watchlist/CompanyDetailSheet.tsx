import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, TrendingDown, ExternalLink, Building2, 
  DollarSign, BarChart3, Calendar, Loader2, Newspaper,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, LineChart, X, GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { logger } from '@/lib/logger';

interface CompanyOverview {
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
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: string;
  sentiment: string;
  sentimentScore: number;
  image: string | null;
}

interface Quote {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume?: number;
}

interface CompanyDetailSheetProps {
  ticker: string | null;
  quote?: Quote | null;
  onClose: () => void;
}

// Global cache for overview and news data
const overviewCache: Record<string, CompanyOverview> = {};
const newsCache: Record<string, NewsItem[]> = {};

export const CompanyDetailSheet: React.FC<CompanyDetailSheetProps> = ({
  ticker,
  quote,
  onClose,
}) => {
  const isMobile = useIsMobile();
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChart, setShowChart] = useState(false);
  
  // Resizable sheet state
  const [sheetWidth, setSheetWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watchlist-sheet-width');
      return saved ? parseInt(saved, 10) : 448;
    }
    return 448;
  });
  const isResizing = useRef(false);
  const minWidth = 320;
  const maxWidth = 800;

  // Retry helper function
  const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = 2): Promise<T> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const result = await fn();
        if (result.data) return result;
        if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
      } catch (err) {
        if (i === retries) throw err;
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
    return { data: null };
  };

  // Fetch overview independently
  const fetchOverview = useCallback(async (symbol: string, forceRefresh = false) => {
    // Show cached data immediately
    if (overviewCache[symbol]) {
      setOverview(overviewCache[symbol]);
      if (!forceRefresh) return; // Skip fetch if not forcing
    }

    setOverviewLoading(true);
    try {
      const result = await fetchWithRetry(() => supabase.functions.invoke('alpha-vantage', {
        body: { action: 'overview', symbols: [symbol], _ts: Date.now() },
      }));
      
      if (result.data?.overview) {
        overviewCache[symbol] = result.data.overview;
        setOverview(result.data.overview);
      }
    } catch (err) {
      logger.error('Error fetching overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // Fetch news independently
  const fetchNews = useCallback(async (symbol: string, forceRefresh = false) => {
    // Show cached data immediately
    if (newsCache[symbol]) {
      setNews(newsCache[symbol]);
      if (!forceRefresh) return; // Skip fetch if not forcing
    }

    setNewsLoading(true);
    try {
      const result = await fetchWithRetry(() => supabase.functions.invoke('alpha-vantage', {
        body: { action: 'news', symbols: [symbol], _ts: Date.now() },
      }));
      
      if (result.data?.news) {
        newsCache[symbol] = result.data.news;
        setNews(result.data.news);
      }
    } catch (err) {
      logger.error('Error fetching news:', err);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const fetchCompanyData = useCallback(async (forceRefresh = false) => {
    if (!ticker) return;
    
    if (forceRefresh) {
      setIsRefreshing(true);
    }

    // Fetch overview and news in parallel independently
    await Promise.all([
      fetchOverview(ticker, forceRefresh),
      fetchNews(ticker, forceRefresh),
    ]);

    setIsRefreshing(false);
  }, [ticker, fetchOverview, fetchNews]);

  useEffect(() => {
    if (ticker) {
      // Immediately show cached data
      if (overviewCache[ticker]) {
        setOverview(overviewCache[ticker]);
      } else {
        setOverview(null);
      }
      if (newsCache[ticker]) {
        setNews(newsCache[ticker]);
      } else {
        setNews([]);
      }
      setShowChart(false);
      
      // Always fetch fresh data
      fetchCompanyData();
    }
  }, [ticker, fetchCompanyData]);

  // Clear data when sheet fully closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      // Delay clearing state for animation
      setTimeout(() => {
        setOverview(null);
        setNews([]);
      }, 300);
    }
  };

  const handleRefresh = () => {
    fetchCompanyData(true);
  };

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setSheetWidth(clampedWidth);
    };
    
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save to localStorage
      localStorage.setItem('watchlist-sheet-width', String(sheetWidth));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isMobile, sheetWidth]);

  const formatMarketCap = (cap: string) => {
    const num = parseFloat(cap);
    if (isNaN(num)) return 'N/A';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatVolume = (vol: string) => {
    const num = parseFloat(vol);
    if (isNaN(num)) return 'N/A';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    // Format: 20241215T120000
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getSentimentBadge = (sentiment: string) => {
    const s = sentiment?.toLowerCase() || '';
    if (s.includes('bullish') || s.includes('positive')) {
      return <Badge className="bg-profit/20 text-profit border-0 text-xs">Bullish</Badge>;
    }
    if (s.includes('bearish') || s.includes('negative')) {
      return <Badge className="bg-loss/20 text-loss border-0 text-xs">Bearish</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Neutral</Badge>;
  };

  const isPositive = quote && quote.change >= 0;
  const isLoading = overviewLoading && !overview;

  return (
    <Sheet open={!!ticker} onOpenChange={handleOpenChange}>
      <SheetContent 
        className="w-full bg-card border-l border-border p-0 flex flex-col"
        style={!isMobile ? { maxWidth: `${sheetWidth}px` } : undefined}
      >
        {/* Resize handle - only on desktop */}
        {!isMobile && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-50 flex items-center justify-center group"
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="h-6 w-6 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
          </div>
        )}
        
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="flex items-center gap-3">
            {ticker && <TickerLogo symbol={ticker} size="lg" />}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-foreground">{ticker}</span>
                {overview?.sector && (
                  <Badge variant="secondary" className="text-xs">
                    {overview.sector}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-normal">
                {overviewLoading && !overview ? 'Loading...' : overview?.name || ticker}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh data"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-6">
            {/* Price Section */}
            {quote ? (
              <div className="pt-4">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-4xl font-bold text-foreground">
                    ${quote.price?.toFixed(2)}
                  </span>
                  <div className={cn(
                    "flex items-center gap-1 text-lg font-semibold",
                    isPositive ? "text-profit" : "text-loss"
                  )}>
                    {isPositive ? (
                      <ArrowUpRight className="h-5 w-5" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5" />
                    )}
                    {isPositive ? '+' : ''}{quote.change?.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent?.toFixed(2)}%)
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground mb-1">Open</p>
                    <p className="font-semibold text-foreground">${quote.open?.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground mb-1">High</p>
                    <p className="font-semibold text-profit">${quote.high?.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground mb-1">Low</p>
                    <p className="font-semibold text-loss">${quote.low?.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground mb-1">Prev Close</p>
                    <p className="font-semibold text-foreground">${quote.previousClose?.toFixed(2)}</p>
                  </div>
                </div>

                {/* TradingView Chart Toggle */}
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setShowChart(!showChart)}
                  >
                    <LineChart className="h-4 w-4" />
                    {showChart ? 'Hide Chart' : 'Show TradingView Chart'}
                  </Button>

                  {showChart && ticker && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-border bg-background">
                      <div className="relative">
                        <iframe
                          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${ticker}&symbol=${ticker}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget_new&utm_campaign=chart&utm_term=${ticker}`}
                          className="w-full h-[350px] border-0"
                          title={`${ticker} TradingView Chart`}
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2 bg-secondary/30 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Chart by TradingView</span>
                        <a 
                          href={`https://www.tradingview.com/chart/?symbol=${ticker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Open full chart
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-4 space-y-3">
                <Skeleton className="h-12 w-32" />
                <div className="grid grid-cols-4 gap-3">
                  {[1,2,3,4].map(i => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              </div>
            )}

            {/* Company Overview */}
            {overviewLoading && !overview ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-2 gap-3">
                  {[1,2,3,4].map(i => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : overview ? (
              <>
                {/* Description */}
                {overview.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      About
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {overview.description.length > 300 
                        ? overview.description.substring(0, 300) + '...' 
                        : overview.description}
                    </p>
                    {overview.industry && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Industry: <span className="text-foreground">{overview.industry}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Key Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Key Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {overview.marketCap && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Market Cap</p>
                        <p className="font-semibold text-foreground">{formatMarketCap(overview.marketCap)}</p>
                      </div>
                    )}
                    {overview.peRatio && overview.peRatio !== 'None' && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">P/E Ratio</p>
                        <p className="font-semibold text-foreground">{parseFloat(overview.peRatio).toFixed(2)}</p>
                      </div>
                    )}
                    {overview.eps && overview.eps !== 'None' && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">EPS</p>
                        <p className="font-semibold text-foreground">${overview.eps}</p>
                      </div>
                    )}
                    {overview.dividendYield && overview.dividendYield !== 'None' && overview.dividendYield !== '0' && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Dividend Yield</p>
                        <p className="font-semibold text-foreground">{(parseFloat(overview.dividendYield) * 100).toFixed(2)}%</p>
                      </div>
                    )}
                    {overview.fiftyTwoWeekHigh && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">52W High</p>
                        <p className="font-semibold text-profit">${parseFloat(overview.fiftyTwoWeekHigh).toFixed(2)}</p>
                      </div>
                    )}
                    {overview.fiftyTwoWeekLow && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">52W Low</p>
                        <p className="font-semibold text-loss">${parseFloat(overview.fiftyTwoWeekLow).toFixed(2)}</p>
                      </div>
                    )}
                    {overview.avgVolume && (
                      <div className="p-3 rounded-lg bg-secondary/30 col-span-2">
                        <p className="text-xs text-muted-foreground">Avg Volume</p>
                        <p className="font-semibold text-foreground">{formatVolume(overview.avgVolume)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : !overviewLoading ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No company data available</p>
              </div>
            ) : null}

            {/* News Section */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                Latest News
              </h3>
              
              {newsLoading && news.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : news.length > 0 ? (
                <div className="space-y-3">
                  {news.slice(0, 5).map((item, idx) => (
                    <a
                      key={idx}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt="" 
                          className="h-12 w-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Newspaper className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
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
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                    </a>
                  ))}
                </div>
              ) : !newsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent news</p>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
