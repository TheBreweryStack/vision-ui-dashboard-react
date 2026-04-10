import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TradeInboxItem, isGmailVerification, ParsedTrade } from '@/lib/tradeInbox';
import { TickerLogo } from '@/components/common/TickerLogo';
import { Inbox, Mail, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { haptics } from '@/lib/haptics';

interface TradeInboxNotificationItemProps {
  item: TradeInboxItem;
  onClick: () => void;
  onImport?: (e: React.MouseEvent) => void;
  onIgnore?: (e: React.MouseEvent) => void;
}

export function TradeInboxNotificationItem({ item, onClick, onImport, onIgnore }: TradeInboxNotificationItemProps) {
  const isGmail = isGmailVerification(item.parsed_trade);
  const parsedTrade: ParsedTrade | null = !isGmail && item.parsed_trade ? item.parsed_trade as ParsedTrade : null;

  // Swipe state for mobile
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    const diff = startX.current - e.touches[0].clientX;
    // Only allow swiping left (positive diff)
    if (diff > 0) {
      setSwipeX(Math.min(diff, 100));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    
    if (swipeX > 80 && onIgnore) {
      haptics.heavy();
      onIgnore(e as unknown as React.MouseEvent);
    }
    setSwipeX(0);
  };

  const handleClick = () => {
    if (swipeX > 10) return; // Don't trigger click during swipe
    haptics.light();
    onClick();
  };
  
  const getTitle = () => {
    if (isGmail) return 'Gmail verification required';
    if (parsedTrade?.symbol) return `New trade: ${parsedTrade.symbol}`;
    return 'New trade received';
  };

  const getBody = () => {
    if (isGmail) return 'Complete setup to import trades automatically';
    if (!parsedTrade) return 'Review this trade to import it';
    
    const parts: string[] = [];
    if (parsedTrade.action) parts.push(parsedTrade.action.replace(/_/g, ' '));
    if (parsedTrade.quantity) parts.push(`${parsedTrade.quantity}`);
    if (parsedTrade.instrument_type) parts.push(parsedTrade.instrument_type);
    if (parsedTrade.price) parts.push(`@ $${parsedTrade.price.toFixed(2)}`);
    
    return parts.length > 0 ? parts.join(' ') : 'Review trade details';
  };

  const getIcon = () => {
    if (isGmail) {
      return (
        <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
          <Mail className="h-4 w-4 text-warning" />
        </div>
      );
    }
    
    if (parsedTrade?.symbol) {
      return <TickerLogo symbol={parsedTrade.symbol} size="sm" />;
    }
    
    return (
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Inbox className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-lg animate-fade-in">
      {/* Swipe ignore background */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-warning transition-opacity",
          swipeX > 20 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: '100px' }}
      >
        <X className="h-5 w-5 text-warning-foreground" />
      </div>
      
      {/* Main content */}
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "flex flex-col gap-2 p-3 cursor-pointer transition-all",
          "bg-card border border-border shadow-sm",
          "hover:bg-accent hover:border-primary/30 hover:shadow-md"
        )}
        style={{ 
          transform: `translateX(-${swipeX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.2s ease-out'
        }}
      >
      <div className="flex items-start gap-3">
        {getIcon()}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground line-clamp-1">
              {getTitle()}
            </p>
            {/* Unread indicator */}
            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
          </div>
          
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {getBody()}
          </p>
          
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            {formatDistanceToNow(new Date(item.received_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Import / Ignore buttons - like Decline / Accept in reference */}
      {(onImport || onIgnore) && (
        <div className="flex items-center gap-2 ml-12">
          {onIgnore && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3 border-yellow-500/30 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 hover:border-yellow-500/50"
              onClick={onIgnore}
            >
              Ignore
            </Button>
          )}
          {onImport && (
            <Button
              size="sm"
              className="h-7 text-xs px-3 bg-profit hover:bg-profit/90 text-white"
              onClick={onImport}
            >
              Import
            </Button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
