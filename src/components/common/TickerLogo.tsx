import React, { useState, useEffect, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface TickerLogoProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[8px]',
  md: 'w-8 h-8 text-[10px]',
  lg: 'w-10 h-10 text-xs',
  xl: 'w-14 h-14 text-sm',
};

// Normalize symbol: trim, uppercase, remove $ and invalid chars
const normalizeSymbol = (symbol: string): string => {
  return symbol.trim().toUpperCase().replace(/[$^]/g, '').replace(/[^A-Z0-9]/g, '');
};

// Generate a consistent color based on the ticker symbol
const getTickerColor = (symbol: string): string => {
  const colors = [
    'from-blue-500/20 to-blue-600/30',
    'from-green-500/20 to-green-600/30',
    'from-purple-500/20 to-purple-600/30',
    'from-orange-500/20 to-orange-600/30',
    'from-pink-500/20 to-pink-600/30',
    'from-cyan-500/20 to-cyan-600/30',
    'from-yellow-500/20 to-yellow-600/30',
    'from-red-500/20 to-red-600/30',
  ];
  
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Multiple logo sources for fallback
const getLogoUrls = (symbol: string) => [
  `https://assets.parqet.com/logos/symbol/${symbol}?format=png`,
  `https://storage.googleapis.com/iex/api/logos/${symbol}.png`,
  `https://logo.clearbit.com/${symbol.toLowerCase()}.com`,
];

export const TickerLogo = forwardRef<HTMLDivElement, TickerLogoProps>(({ 
  symbol, 
  size = 'md',
  className 
}, ref) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const [logoIndex, setLogoIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const logoUrls = getLogoUrls(normalizedSymbol);
  
  // Reset state when symbol changes
  useEffect(() => {
    setLogoIndex(0);
    setAllFailed(false);
  }, [normalizedSymbol]);
  
  const handleError = () => {
    setLogoIndex((prev) => {
      if (prev < logoUrls.length - 1) {
        return prev + 1;
      } else {
        setAllFailed(true);
        return prev;
      }
    });
  };
  
  if (allFailed || !normalizedSymbol) {
    // Fallback to initials with gradient background
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg flex items-center justify-center font-bold text-foreground bg-gradient-to-br border border-border/30",
          sizeClasses[size],
          getTickerColor(normalizedSymbol || 'XX'),
          className
        )}
      >
        {(normalizedSymbol || 'XX').slice(0, 2)}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn(sizeClasses[size], className)}>
      <img
        src={logoUrls[logoIndex]}
        alt={`${normalizedSymbol} logo`}
        className={cn(
          "rounded-lg object-contain bg-secondary/50 w-full h-full",
        )}
        onError={handleError}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
});

TickerLogo.displayName = 'TickerLogo';

export default TickerLogo;
