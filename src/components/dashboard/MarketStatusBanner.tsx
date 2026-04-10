import React, { useEffect } from 'react';
import { useFinnhub } from '@/hooks/useFinnhub';
import { cn } from '@/lib/utils';

export const MarketStatusBanner: React.FC = () => {
  const { marketOverview, fetchMarketOverview, isLoading } = useFinnhub();

  useEffect(() => {
    fetchMarketOverview();
  }, [fetchMarketOverview]);

  const status = marketOverview?.marketStatus || 'closed';
  const isOpen = status === 'open';
  const isPreAfter = status === 'pre-market' || status === 'after-hours';

  const label = isOpen
    ? 'The market is open'
    : isPreAfter
      ? status === 'pre-market' ? 'Pre-market' : 'After hours'
      : 'The market is closed';

  if (isLoading && !marketOverview) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
          isOpen
            ? 'bg-profit/10 text-profit border-profit/20'
            : isPreAfter
              ? 'bg-warning/10 text-warning border-warning/20'
              : 'bg-loss/10 text-loss border-loss/20',
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full animate-pulse',
            isOpen ? 'bg-profit' : isPreAfter ? 'bg-warning' : 'bg-loss',
          )}
        />
        {label}
      </div>
    </div>
  );
};
