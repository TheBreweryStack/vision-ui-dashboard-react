import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';

interface SalesSummary {
  gross_30d: number;
  gross_7d: number;
  net_30d: number;
  net_7d: number;
  refunds_30d: number;
  currency: string;
}

interface Transaction {
  id: string;
  created: number;
  amount: number;
  currency: string;
  status: string;
  customer_email: string | null;
  description: string;
}

export const SalesWidget: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSalesData = async () => {
    // Check for active session before making the API call
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-sales', {
        body: { rangeDays: 30, limit: 5 },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSummary(data.summary);
      setTransactions(data.transactions || []);
    } catch (err: unknown) {
      logger.error('Error fetching sales data:', err);
      setError((err instanceof Error ? err.message : null) || 'Failed to load sales data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Small delay to ensure auth state is settled
    const timer = setTimeout(() => {
      fetchSalesData();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const formatCurrency = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  if (error) {
    return (
      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-profit" />
            Sales
          </h2>
          <Button variant="ghost" size="icon" onClick={fetchSalesData} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-profit" />
          Sales (30d)
        </h2>
        <button 
          onClick={() => navigate('/sales')}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View all →
        </button>
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Gross (30d)</p>
                <p className="text-lg font-bold text-profit">
                  {formatCurrency(summary?.gross_30d || 0)}
                </p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Net (30d)</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(summary?.net_30d || 0)}
                </p>
              </div>
            </div>

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Recent Transactions
                </p>
                <div className="space-y-1.5">
                  {transactions.slice(0, 3).map((txn) => (
                    <div 
                      key={txn.id}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TrendingUp className="h-3.5 w-3.5 text-profit shrink-0" />
                        <span className="truncate text-foreground">
                          {txn.customer_email || 'Customer'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium text-profit">
                          +{formatCurrency(txn.amount, txn.currency)}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] h-5",
                            txn.status === 'succeeded' 
                              ? 'text-profit border-profit/30' 
                              : 'text-muted-foreground'
                          )}
                        >
                          {txn.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No transactions in the last 30 days
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
