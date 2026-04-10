import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Eye,
  Bell,
  StickyNote,
  Settings,
  Globe,
  Plus,
  FileText,
  TrendingUp,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveSearchResultsProps {
  query: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

const pages = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Journal', path: '/journal', icon: BookOpen },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Watchlists', path: '/watchlist', icon: Eye },
  { name: 'Reminders', path: '/reminders', icon: Bell },
  { name: 'Notes', path: '/notes', icon: StickyNote },
  { name: 'Market', path: '/market', icon: Globe },
  { name: 'Settings', path: '/settings', icon: Settings },
];

const actions = [
  { name: 'Add New Trade', path: '/journal?action=add', icon: Plus },
  { name: 'Create Note', path: '/notes?action=add', icon: FileText },
  { name: 'Set Reminder', path: '/reminders?action=add', icon: Clock },
];

export function LiveSearchResults({ query, onSelect, onClose }: LiveSearchResultsProps) {
  const { user } = useAuth();

  // Search trades
  const { data: trades = [], isLoading: loadingTrades } = useQuery({
    queryKey: ['live-search-trades', query],
    queryFn: async () => {
      if (!user || !query || query.length < 2) return [];
      const { data } = await supabase
        .from('trade_groups')
        .select('id, ticker, trade_type, status, strike_price, expiration_date, entry_date')
        .eq('user_id', user.id)
        .ilike('ticker', `%${query}%`)
        .order('entry_date', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user && query.length >= 2,
    staleTime: 10000,
  });

  // Search notes
  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ['live-search-notes', query],
    queryFn: async () => {
      if (!user || !query || query.length < 2) return [];
      const { data } = await supabase
        .from('notes')
        .select('id, title, category')
        .eq('user_id', user.id)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!user && query.length >= 2,
    staleTime: 10000,
  });

  // Search reminders
  const { data: reminders = [], isLoading: loadingReminders } = useQuery({
    queryKey: ['live-search-reminders', query],
    queryFn: async () => {
      if (!user || !query || query.length < 2) return [];
      const { data } = await supabase
        .from('reminders')
        .select('id, title, ticker')
        .eq('user_id', user.id)
        .ilike('title', `%${query}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!user && query.length >= 2,
    staleTime: 10000,
  });

  const isLoading = loadingTrades || loadingNotes || loadingReminders;

  const filteredPages = pages.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredActions = actions.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  const hasResults = trades.length > 0 || notes.length > 0 || reminders.length > 0 || filteredPages.length > 0 || filteredActions.length > 0;

  return (
    <div 
      className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-[400px] overflow-y-auto"
      onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
    >
      {isLoading && query.length >= 2 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && query.length >= 2 && !hasResults && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          No results found
        </div>
      )}

      {/* Trade Results */}
      {trades.length > 0 && (
        <div className="p-2">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Trades</p>
          {trades.map((trade) => {
            const dateToShow = trade.expiration_date || trade.entry_date;
            const formattedDate = dateToShow ? format(new Date(dateToShow), 'MMM d') : null;
            
            return (
              <button
                key={trade.id}
                onClick={() => onSelect(`/journal?trade=${trade.id}`)}
                className="flex items-center gap-2 w-full px-2 py-2 text-sm text-left rounded-lg hover:bg-muted/50 transition-colors"
              >
                <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground">{trade.ticker}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {trade.trade_type}
                  {trade.strike_price && ` $${trade.strike_price}`}
                  {formattedDate && ` ${formattedDate}`}
                  {' • '}{trade.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Note Results */}
      {notes.length > 0 && (
        <div className="p-2 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Notes</p>
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelect(`/notes?note=${note.id}`)}
              className="flex items-center gap-2 w-full px-2 py-2 text-sm text-left rounded-lg hover:bg-muted/50 transition-colors"
            >
              <StickyNote className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground truncate">{note.title}</span>
              <span className="text-xs text-muted-foreground">{note.category}</span>
            </button>
          ))}
        </div>
      )}

      {/* Reminder Results */}
      {reminders.length > 0 && (
        <div className="p-2 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Reminders</p>
          {reminders.map((reminder) => (
            <button
              key={reminder.id}
              onClick={() => onSelect(`/reminders?reminder=${reminder.id}`)}
              className="flex items-center gap-2 w-full px-2 py-2 text-sm text-left rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground truncate">{reminder.title}</span>
              {reminder.ticker && (
                <span className="ticker-badge text-[10px] px-1.5 py-0.5">{reminder.ticker}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Pages */}
      {filteredPages.length > 0 && (
        <div className={cn("p-2", (trades.length > 0 || notes.length > 0 || reminders.length > 0) && "border-t border-border/50")}>
          <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Pages</p>
          {filteredPages.map((page) => (
            <button
              key={page.path}
              onClick={() => onSelect(page.path)}
              className="flex items-center gap-2 w-full px-2 py-2 text-sm text-left rounded-lg hover:bg-muted/50 transition-colors"
            >
              <page.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{page.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      {filteredActions.length > 0 && (
        <div className="p-2 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Actions</p>
          {filteredActions.map((action) => (
            <button
              key={action.path}
              onClick={() => onSelect(action.path)}
              className="flex items-center gap-2 w-full px-2 py-2 text-sm text-left rounded-lg hover:bg-muted/50 transition-colors"
            >
              <action.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-foreground">{action.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Keyboard hint */}
      <div className="p-2 border-t border-border/50 bg-muted/30">
        <p className="text-[10px] text-muted-foreground text-center">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">⌘K</kbd> for full search
        </p>
      </div>
    </div>
  );
}
