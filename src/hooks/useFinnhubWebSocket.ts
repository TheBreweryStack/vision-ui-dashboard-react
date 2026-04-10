import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface RealtimePrice {
  price: number;
  volume: number;
  timestamp: number;
}

interface UseFinnhubWebSocketResult {
  prices: Record<string, RealtimePrice>;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
}

// Fallback to REST API when WebSocket fails
const fetchQuotesREST = async (symbols: string[]): Promise<Record<string, RealtimePrice>> => {
  try {
    const { data, error } = await supabase.functions.invoke('finnhub-quote', {
      body: { symbols }
    });
    
    if (error || !data?.quotes) return {};
    
    const prices: Record<string, RealtimePrice> = {};
    for (const [symbol, quote] of Object.entries(data.quotes as Record<string, Record<string, number>>)) {
      if (quote && typeof quote.c === 'number') {
        prices[symbol] = {
          price: quote.c,
          volume: quote.v || 0,
          timestamp: Date.now()
        };
      }
    }
    return prices;
  } catch (err) {
    console.error('[FinnhubWS] REST fallback error:', err);
    return {};
  }
};

export function useFinnhubWebSocket(): UseFinnhubWebSocketResult {
  const [prices, setPrices] = useState<Record<string, RealtimePrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const usingFallbackRef = useRef(false);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 3;
  const connectionTimeoutMs = 8000; // 8 seconds to connect and receive data

  // REST API fallback polling
  const startFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current) return;
    
    usingFallbackRef.current = true;
    console.log('[FinnhubWS] Starting REST API fallback polling');
    
    const poll = async () => {
      const symbols = Array.from(subscribedSymbolsRef.current);
      if (symbols.length === 0) return;
      
      const newPrices = await fetchQuotesREST(symbols);
      if (Object.keys(newPrices).length > 0) {
        setPrices(prev => ({ ...prev, ...newPrices }));
      }
    };
    
    // Initial fetch
    poll();
    
    // Poll every 15 seconds
    fallbackIntervalRef.current = setInterval(poll, 15000);
  }, []);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    usingFallbackRef.current = false;
  }, []);

  const connect = useCallback(async () => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get the WebSocket URL from edge function
      const { data, error: fnError } = await supabase.functions.invoke('finnhub-websocket-proxy', {
        body: { action: 'get-url' }
      });

      // Handle missing API key gracefully
      if (fnError || data?.code === 'MISSING_API_KEY' || !data?.url) {
        const errorMsg = data?.message || fnError?.message || 'Finnhub API not configured';
        console.warn('[FinnhubWS] API not available:', errorMsg);
        setError(errorMsg);
        setIsConnecting(false);
        // Fall back to REST API
        startFallbackPolling();
        return;
      }

      const ws = new WebSocket(data.url);
      wsRef.current = ws;
      
      let receivedTradeData = false;

      // Set connection timeout - if we don't receive trade data, fall back to REST
      connectionTimeoutRef.current = setTimeout(() => {
        if (!receivedTradeData && ws.readyState === WebSocket.OPEN) {
          console.warn('[FinnhubWS] No trade data received within timeout, falling back to REST');
          ws.close(1000, 'No data received');
          startFallbackPolling();
        }
      }, connectionTimeoutMs);

      ws.onopen = () => {
        console.log('[FinnhubWS] Connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        stopFallbackPolling();

        // Resubscribe to all symbols
        subscribedSymbolsRef.current.forEach(symbol => {
          ws.send(JSON.stringify({ type: 'subscribe', symbol }));
        });

        // Start heartbeat to keep connection alive
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            // Finnhub doesn't require pings, but we can check connection health
            // by monitoring if we receive any data
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'trade' && data.data) {
            receivedTradeData = true;
            
            // Clear connection timeout once we receive data
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
            
            // Process trade data
            const updates: Record<string, RealtimePrice> = {};
            
            for (const trade of data.data) {
              const symbol = trade.s;
              const price = trade.p;
              const volume = trade.v;
              const timestamp = trade.t;
              
              // Only keep the latest price per symbol
              if (!updates[symbol] || updates[symbol].timestamp < timestamp) {
                updates[symbol] = { price, volume, timestamp };
              }
            }
            
            if (Object.keys(updates).length > 0) {
              setPrices(prev => ({ ...prev, ...updates }));
            }
          } else if (data.type === 'ping') {
            // Respond to ping
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (err) {
          console.error('[FinnhubWS] Parse error:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[FinnhubWS] Error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[FinnhubWS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        // Attempt reconnect if not a clean close and we have symbols
        if (event.code !== 1000 && 
            subscribedSymbolsRef.current.size > 0 && 
            reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
          reconnectAttemptsRef.current++;
          
          console.log(`[FinnhubWS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          // Max retries reached, fall back to REST
          console.log('[FinnhubWS] Max reconnect attempts reached, falling back to REST API');
          startFallbackPolling();
        }
      };
    } catch (err) {
      console.error('[FinnhubWS] Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnecting(false);
      
      // Fallback to REST API
      startFallbackPolling();
    }
  }, [startFallbackPolling, stopFallbackPolling]);

  const subscribe = useCallback((symbols: string[]) => {
    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      subscribedSymbolsRef.current.add(upperSymbol);
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'subscribe', symbol: upperSymbol }));
      }
    });

    // Connect if not already connected and not using fallback
    if (!wsRef.current && !isConnecting && !usingFallbackRef.current) {
      connect();
    } else if (usingFallbackRef.current) {
      // If using fallback, fetch immediately for new symbols
      fetchQuotesREST(symbols).then(newPrices => {
        if (Object.keys(newPrices).length > 0) {
          setPrices(prev => ({ ...prev, ...newPrices }));
        }
      });
    }
  }, [connect, isConnecting]);

  const unsubscribe = useCallback((symbols: string[]) => {
    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      subscribedSymbolsRef.current.delete(upperSymbol);
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: upperSymbol }));
      }
    });

    // If no more symbols, disconnect
    if (subscribedSymbolsRef.current.size === 0) {
      if (wsRef.current) {
        wsRef.current.close(1000, 'No more symbols');
      }
      stopFallbackPolling();
    }
  }, [stopFallbackPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, []);

  return {
    prices,
    isConnected,
    isConnecting,
    error,
    subscribe,
    unsubscribe,
  };
}
