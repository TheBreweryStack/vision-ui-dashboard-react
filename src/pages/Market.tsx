import React, { useEffect, useState, useMemo } from 'react';
import { useFinnhub } from '@/hooks/useFinnhub';
import { useAlphaVantage, type AlphaVantageOverview, type AlphaVantageNews } from '@/hooks/useAlphaVantage';
import { 
  TrendingUp, TrendingDown, Globe, Newspaper, 
  RefreshCw, Loader2, ExternalLink, Building2, Info, Search, X,
  ChevronLeft, ChevronRight, Calendar, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { TickerLogo } from '@/components/common/TickerLogo';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

interface FinnhubNewsItem {
  headline: string;
  summary: string;
  url: string;
  source: string;
  datetime: number;
  image: string;
}

type NewsArticle = AlphaVantageNews | FinnhubNewsItem;

const indexNames: Record<string, string> = {
  SPY: 'S&P 500',
  QQQ: 'NASDAQ',
  DIA: 'Dow Jones',
  IWM: 'Russell 2000',
  VIX: 'Volatility',
};

const ITEMS_PER_PAGE = 10;

const Market: React.FC = () => {
  const { marketOverview, isLoading: finnhubLoading, fetchMarketOverview } = useFinnhub();
  const { news: alphaNews, isLoading: alphaLoading, fetchNews, fetchOverview } = useAlphaVantage();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [companyOverview, setCompanyOverview] = useState<AlphaVantageOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AlphaVantageNews[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Date filter state
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [showDateFilter, setShowDateFilter] = useState(false);

  const isLoading = finnhubLoading || alphaLoading;

  useEffect(() => {
    fetchMarketOverview();
    fetchNews();
  }, [fetchMarketOverview, fetchNews]);

  const handleSymbolClick = async (symbol: string) => {
    if (selectedSymbol === symbol) {
      setSelectedSymbol(null);
      setCompanyOverview(null);
      return;
    }
    
    setSelectedSymbol(symbol);
    setOverviewLoading(true);
    const overview = await fetchOverview(symbol);
    setCompanyOverview(overview);
    setOverviewLoading(false);
  };

  const handleRefresh = () => {
    fetchMarketOverview();
    fetchNews();
    if (searchQuery) {
      handleSearch();
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    
    setSearchLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    
    try {
      const { data, error } = await supabase.functions.invoke('alpha-vantage', {
        body: { action: 'news', symbols: [searchQuery.toUpperCase()] },
      });
      
      if (data?.news) {
        setSearchResults(data.news);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const clearDateFilter = () => {
    setDateFilter(undefined);
    setCurrentPage(1);
  };

  const getMarketStatusBadge = () => {
    switch (marketOverview?.marketStatus) {
      case 'open':
        return <Badge className="bg-profit/20 text-profit border-profit/30">Market Open</Badge>;
      case 'pre-market':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pre-Market</Badge>;
      case 'after-hours':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">After Hours</Badge>;
      default:
        return <Badge className="bg-secondary text-muted-foreground">Market Closed</Badge>;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'bullish':
      case 'somewhat-bullish':
        return <Badge className="bg-profit/20 text-profit text-xs">{sentiment}</Badge>;
      case 'bearish':
      case 'somewhat-bearish':
        return <Badge className="bg-loss/20 text-loss text-xs">{sentiment}</Badge>;
      default:
        return <Badge className="bg-secondary text-muted-foreground text-xs">Neutral</Badge>;
    }
  };

  // Parse date from Alpha Vantage format (YYYYMMDDTHHMMSS) - returns LOCAL time
  const parseNewsDate = (article: NewsArticle): Date => {
    if ('publishedAt' in article && article.publishedAt) {
      // Alpha Vantage format: 20231215T143000 (UTC time)
      const dateStr = article.publishedAt.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z');
      return new Date(dateStr); // This will convert UTC to local automatically
    }
    if ('datetime' in article && article.datetime) {
      return new Date(article.datetime * 1000);
    }
    return new Date();
  };

  // Sort news by date (latest first), filter by date if set, and paginate
  const sortedAndPaginatedNews = useMemo(() => {
    const baseNews: NewsArticle[] = hasSearched ? searchResults : (alphaNews.length > 0 ? alphaNews : marketOverview?.news || []);
    
    // Sort by date descending (latest first)
    let sorted = [...baseNews].sort((a, b) => {
      const dateA = parseNewsDate(a);
      const dateB = parseNewsDate(b);
      return dateB.getTime() - dateA.getTime();
    });

    // Filter by date if set
    if (dateFilter) {
      const filterStart = startOfDay(dateFilter);
      const filterEnd = endOfDay(dateFilter);
      sorted = sorted.filter(article => {
        const articleDate = parseNewsDate(article);
        return !isBefore(articleDate, filterStart) && !isAfter(articleDate, filterEnd);
      });
    }
    
    return sorted;
  }, [hasSearched, searchResults, alphaNews, marketOverview?.news, dateFilter]);

  const totalPages = Math.ceil(sortedAndPaginatedNews.length / ITEMS_PER_PAGE);
  const paginatedNews = sortedAndPaginatedNews.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Market</h1>
          <p className="page-subtitle hidden sm:block">Real-time market data, news & fundamentals</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {marketOverview && getMarketStatusBadge()}
          <Button 
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-glass border-0 h-9"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search company news (e.g., AAPL, TSLA)..."
              className="pl-10 pr-10 bg-secondary/50 border-border/50"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button 
            onClick={handleSearch}
            disabled={searchLoading || !searchQuery.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
        {hasSearched && searchQuery && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing news for: <span className="text-primary font-medium">{searchQuery.toUpperCase()}</span>
          </p>
        )}
      </div>

      {isLoading && !marketOverview ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : marketOverview ? (
        <>
          {/* Market Indices */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Market Indices
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(marketOverview.indices).map(([symbol, data]) => {
                const isPositive = data.change >= 0;
                const isSelected = selectedSymbol === symbol;
                return (
                  <button
                    key={symbol}
                    onClick={() => handleSymbolClick(symbol)}
                    className={cn(
                      "stat-card text-left transition-all",
                      isSelected && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{indexNames[symbol] || symbol}</span>
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-profit" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-loss" />
                      )}
                    </div>
                    <p className="text-xl font-bold text-foreground">${data.price?.toFixed(2)}</p>
                    <p className={cn(
                      "text-sm font-medium",
                      isPositive ? "text-profit" : "text-loss"
                    )}>
                      {isPositive ? '+' : ''}{data.changePercent?.toFixed(2)}%
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Company Overview Panel */}
          {selectedSymbol && (
            <div className="content-card animate-in">
              <div className="flex items-center gap-3 mb-4">
                <TickerLogo symbol={selectedSymbol} size="lg" />
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {selectedSymbol}
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {companyOverview?.name || indexNames[selectedSymbol] || 'Loading...'}
                  </p>
                </div>
              </div>

              {overviewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : companyOverview ? (
                <div className="space-y-4">
                  {companyOverview.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {companyOverview.description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {companyOverview.sector && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Sector</p>
                        <p className="font-medium text-foreground">{companyOverview.sector}</p>
                      </div>
                    )}
                    {companyOverview.marketCap && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Market Cap</p>
                        <p className="font-medium text-foreground">
                          ${(parseFloat(companyOverview.marketCap) / 1e9).toFixed(2)}B
                        </p>
                      </div>
                    )}
                    {companyOverview.peRatio && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">P/E Ratio</p>
                        <p className="font-medium text-foreground">{companyOverview.peRatio}</p>
                      </div>
                    )}
                    {companyOverview.eps && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">EPS</p>
                        <p className="font-medium text-foreground">${companyOverview.eps}</p>
                      </div>
                    )}
                    {companyOverview.fiftyTwoWeekHigh && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">52W High</p>
                        <p className="font-medium text-foreground">${companyOverview.fiftyTwoWeekHigh}</p>
                      </div>
                    )}
                    {companyOverview.fiftyTwoWeekLow && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">52W Low</p>
                        <p className="font-medium text-foreground">${companyOverview.fiftyTwoWeekLow}</p>
                      </div>
                    )}
                    {companyOverview.dividendYield && companyOverview.dividendYield !== 'None' && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Dividend</p>
                        <p className="font-medium text-foreground">{companyOverview.dividendYield}%</p>
                      </div>
                    )}
                    {companyOverview.avgVolume && (
                      <div className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Avg Volume</p>
                        <p className="font-medium text-foreground">
                          {(parseFloat(companyOverview.avgVolume) / 1e6).toFixed(2)}M
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No detailed data available for ETFs/Indices</p>
                </div>
              )}
            </div>
          )}

          {/* Market News */}
          <div className="space-y-3">
            {/* Header with filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Newspaper className="h-4 w-4" />
                {hasSearched ? `News for ${searchQuery.toUpperCase()}` : 'Latest News'}
                {dateFilter && (
                  <Badge variant="secondary" className="text-xs ml-2">
                    {format(dateFilter, 'MMM d, yyyy')}
                    <button onClick={clearDateFilter} className="ml-1 hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </h2>
              
              <div className="flex items-center gap-2">
                {/* Date Filter */}
                <Popover open={showDateFilter} onOpenChange={setShowDateFilter}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-8 gap-1", dateFilter && "bg-primary/10 border-primary/50")}
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="hidden sm:inline">Filter</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarPicker
                      mode="single"
                      selected={dateFilter}
                      onSelect={(date) => {
                        setDateFilter(date);
                        setShowDateFilter(false);
                        setCurrentPage(1);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Pagination */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[50px] text-center">
                    {currentPage} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : paginatedNews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedNews.map((article, index) => {
                const articleDate = parseNewsDate(article);
                return (
                  <a
                    key={index}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="content-card group hover:border-primary/30 transition-all flex gap-4"
                  >
                    {(article.image || ('banner_image' in article && article.banner_image)) && (
                      <img
                        src={article.image || ('banner_image' in article ? article.banner_image : undefined)}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg shrink-0"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {'title' in article ? article.title : article.headline}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{article.source}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {format(articleDate, 'MMM d, h:mm a')}
                        </span>
                        {'sentiment' in article && article.sentiment && getSentimentBadge(article.sentiment)}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                      </div>
                      {'summary' in article && article.summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
            ) : (
              <div className="content-card text-center py-8">
                <Newspaper className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  {hasSearched ? `No news found for ${searchQuery.toUpperCase()}` : 'No news available'}
                </p>
              </div>
            )}

            {/* Bottom Pagination */}
            {sortedAndPaginatedNews.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="content-card text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Globe className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Market Data Unavailable</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Unable to fetch market data. Please try again later.
          </p>
          <Button onClick={handleRefresh} className="bg-primary hover:bg-primary/90">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};

export default Market;