import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
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
  Search,
  FileText,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface SearchResult {
  id: string;
  type: 'trade' | 'note' | 'reminder' | 'watchlist' | 'page' | 'action';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  onSelect: () => void;
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

interface GlobalSearchProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GlobalSearch({ open: controlledOpen, onOpenChange }: GlobalSearchProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  // Search trades
  const { data: trades = [] } = useQuery({
    queryKey: ['search-trades', query],
    queryFn: async () => {
      if (!user || !query || query.length < 2) return [];
      const { data } = await supabase
        .from('trade_groups')
        .select('id, ticker, trade_type, status')
        .eq('user_id', user.id)
        .ilike('ticker', `%${query}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!user && query.length >= 2,
    staleTime: 10000,
  });

  // Search notes
  const { data: notes = [] } = useQuery({
    queryKey: ['search-notes', query],
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
  const { data: reminders = [] } = useQuery({
    queryKey: ['search-reminders', query],
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

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  }, [navigate, setOpen]);

  const filteredPages = pages.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredActions = actions.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Search trades, notes, pages..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {/* Recent / Quick Actions */}
        {!query && (
          <>
            <CommandGroup heading="Quick Actions">
              {actions.map((action) => (
                <CommandItem
                  key={action.path}
                  onSelect={() => handleSelect(action.path)}
                  className="cursor-pointer"
                >
                  <action.icon className="mr-2 h-4 w-4 text-primary" />
                  <span>{action.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Trade Results */}
        {trades.length > 0 && (
          <>
            <CommandGroup heading="Trades">
              {trades.map((trade) => (
                <CommandItem
                  key={trade.id}
                  onSelect={() => handleSelect(`/journal?trade=${trade.id}`)}
                  className="cursor-pointer"
                >
                  <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{trade.ticker}</span>
                  <span className="ml-2 text-xs text-muted-foreground capitalize">
                    {trade.trade_type} • {trade.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Note Results */}
        {notes.length > 0 && (
          <>
            <CommandGroup heading="Notes">
              {notes.map((note) => (
                <CommandItem
                  key={note.id}
                  onSelect={() => handleSelect(`/notes?note=${note.id}`)}
                  className="cursor-pointer"
                >
                  <StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{note.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {note.category}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Reminder Results */}
        {reminders.length > 0 && (
          <>
            <CommandGroup heading="Reminders">
              {reminders.map((reminder) => (
                <CommandItem
                  key={reminder.id}
                  onSelect={() => handleSelect(`/reminders?reminder=${reminder.id}`)}
                  className="cursor-pointer"
                >
                  <Bell className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{reminder.title}</span>
                  {reminder.ticker && (
                    <span className="ml-2 ticker-badge text-[10px] px-1.5 py-0.5">
                      {reminder.ticker}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Pages */}
        <CommandGroup heading="Pages">
          {filteredPages.map((page) => (
            <CommandItem
              key={page.path}
              onSelect={() => handleSelect(page.path)}
              className="cursor-pointer"
            >
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{page.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Actions (when searching) */}
        {query && filteredActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {filteredActions.map((action) => (
                <CommandItem
                  key={action.path}
                  onSelect={() => handleSelect(action.path)}
                  className="cursor-pointer"
                >
                  <action.icon className="mr-2 h-4 w-4 text-primary" />
                  <span>{action.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Search trigger button component
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground bg-accent/50 hover:bg-accent rounded-lg transition-colors"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
