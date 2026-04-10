import React, { useState, useEffect } from 'react';
import { supabase, Trade, Profile } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TickerLogo } from '@/components/common/TickerLogo';

interface TradeWithUser extends Trade {
  user?: Profile;
}

export const AllTradesTab: React.FC = () => {
  const [trades, setTrades] = useState<TradeWithUser[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all trades
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

      if (tradesError) throw tradesError;

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*');

      if (usersError) throw usersError;

      // Map users to trades
      const tradesWithUsers = (tradesData || []).map(trade => ({
        ...trade,
        user: usersData?.find(u => u.id === trade.user_id),
      }));

      setTrades(tradesWithUsers);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTrades = trades.filter(trade => {
    const matchesSearch = 
      trade.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trade.user?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trade.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUser = filterUser === 'all' || trade.user_id === filterUser;
    const matchesStatus = filterStatus === 'all' || trade.status === filterStatus;
    return matchesSearch && matchesUser && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trades or users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-full sm:w-[180px] bg-secondary/50 border-border/50">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map(user => (
              <SelectItem key={user.id} value={user.id}>
                {user.display_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[140px] bg-secondary/50 border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trades Table */}
      <div className="content-card overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">User</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Ticker</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Type</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Entry</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Exit</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Qty</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">P&L</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.map(trade => (
              <tr key={trade.id} className="border-b border-border/30 hover:bg-secondary/30">
                <td className="py-3 px-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {trade.user?.display_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {trade.user?.email}
                    </p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <TickerLogo symbol={trade.ticker} size="sm" />
                    <span className="font-medium text-foreground">{trade.ticker}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge variant="outline" className="capitalize text-xs">
                    {trade.trade_type}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-sm text-foreground">
                  ${trade.entry_price.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-sm text-foreground">
                  {trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : '-'}
                </td>
                <td className="py-3 px-4 text-sm text-foreground">
                  {trade.quantity}
                </td>
                <td className="py-3 px-4">
                  {trade.pnl !== undefined && trade.pnl !== null ? (
                    <div className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      trade.pnl >= 0 ? 'text-profit' : 'text-loss'
                    )}>
                      {trade.pnl >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Badge className={cn(
                    "text-xs",
                    trade.status === 'open' 
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-secondary text-muted-foreground'
                  )}>
                    {trade.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {format(new Date(trade.entry_date), 'MMM d, yyyy')}
                </td>
                <td className="py-3 px-4 text-center">
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTrades.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No trades found
          </div>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredTrades.length} of {trades.length} trades
      </div>
    </div>
  );
};
