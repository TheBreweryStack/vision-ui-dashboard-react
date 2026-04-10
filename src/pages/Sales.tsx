import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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

const Sales: React.FC = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState('30');

  const fetchSalesData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-sales', {
        body: { rangeDays: parseInt(rangeDays), limit: 50 },
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
    if (isAdmin) {
      fetchSalesData();
    }
  }, [isAdmin, rangeDays]);

  const formatCurrency = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  // Redirect non-admins
  if (!authLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales</h1>
          <p className="text-sm text-muted-foreground">Stripe revenue and transaction history</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="w-[140px] bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchSalesData} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="bg-card border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchSalesData}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Gross (7d)
                    </p>
                    <p className="text-2xl font-bold text-profit mt-1">
                      {formatCurrency(summary?.gross_7d || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-profit/10">
                    <ArrowUpRight className="h-5 w-5 text-profit" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Gross (30d)
                    </p>
                    <p className="text-2xl font-bold text-profit mt-1">
                      {formatCurrency(summary?.gross_30d || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-profit/10">
                    <TrendingUp className="h-5 w-5 text-profit" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Net (30d)
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {formatCurrency(summary?.net_30d || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-primary/10">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Refunds (30d)
                    </p>
                    <p className="text-2xl font-bold text-loss mt-1">
                      {formatCurrency(summary?.refunds_30d || 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-loss/10">
                    <ArrowDownRight className="h-5 w-5 text-loss" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions Table */}
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Customer</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr key={txn.id} className="border-b border-border/30 hover:bg-secondary/30">
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(txn.created * 1000), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {txn.customer_email || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground truncate max-w-[200px]">
                          {txn.description}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-profit">
                            +{formatCurrency(txn.amount, txn.currency)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-xs",
                              txn.status === 'succeeded' 
                                ? 'text-profit border-profit/30 bg-profit/10'
                                : txn.status === 'pending'
                                ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'
                                : 'text-muted-foreground'
                            )}
                          >
                            {txn.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {transactions.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No transactions found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Sales;
