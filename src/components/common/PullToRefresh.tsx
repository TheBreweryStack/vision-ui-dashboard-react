import React, { useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

const THRESHOLD = 80;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const hasReachedThreshold = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      const newDistance = Math.min(diff * 0.5, THRESHOLD * 1.5);
      setPullDistance(newDistance);
      
      // Haptic feedback when threshold is reached
      if (newDistance >= THRESHOLD && !hasReachedThreshold.current) {
        hasReachedThreshold.current = true;
        haptics.threshold();
      } else if (newDistance < THRESHOLD) {
        hasReachedThreshold.current = false;
      }
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    hasReachedThreshold.current = false;
    
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      
      // Success haptic feedback on refresh trigger
      haptics.success();
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-all duration-200 pointer-events-none z-10",
          pullDistance > 0 ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: -40,
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20",
          isRefreshing && "animate-pulse"
        )}>
          <Loader2 className={cn(
            "h-5 w-5 text-primary transition-transform duration-200",
            isRefreshing && "animate-spin",
            !isRefreshing && pullDistance >= THRESHOLD && "rotate-180"
          )} />
        </div>
      </div>
      
      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};