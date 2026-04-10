// Re-export from the auto-generated integration client
export { supabase } from '@/integrations/supabase/client';

// Types matching actual database schema - using string for enum fields to avoid type casting issues
export type SubscriptionTier = 'free' | 'trial' | 'monthly' | 'lifetime';

export interface Profile {
  id: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  subscription_tier?: SubscriptionTier | null;
  subscription_end?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  stripe_customer_id?: string | null;
  // Stripe sync fields
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  stripe_current_period_end?: string | null;
  stripe_status?: string | null;
  last_stripe_event_at?: string | null;
  // Plan/access fields
  plan_status?: string | null;
  comped_access?: boolean;
  comped_by?: string | null;
  comped_at?: string | null;
  comped_reason?: string | null;
  early_supporter?: boolean;
  grandfathered?: boolean;
  has_used_trial?: boolean;
  onboarding_completed?: boolean;
  onboarding_dismissed_until?: string | null;
  notification_prompt_shown?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Trade {
  id: string;
  user_id: string;
  ticker: string;
  trade_type: string;
  entry_price: number;
  entry_date: string;
  entry_time?: string | null;
  exit_price?: number | null;
  exit_date?: string | null;
  exit_time?: string | null;
  quantity: number;
  strategy?: string | null;
  notes?: string | null;
  images?: string[] | null;
  status: string;
  pnl?: number | null;
  position_id?: string | null;
  strike_price?: number | null;
  expiration_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  reminder_time?: string | null;
  due_at?: string | null;
  notified_at?: string | null;
  dismissed_at?: string | null;
  priority: string;
  ticker?: string | null;
  note_id?: string | null;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  ticker: string;
  notes?: string | null;
  added_at?: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content?: string | null;
  category: string;
  ticker?: string | null;
  images?: string[] | null;
  links?: string[] | null;
  is_pinned: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AccountSettings {
  id: string;
  user_id: string;
  starting_balance: number;
  initial_deposit: number;
  weekly_goal?: number | null;
  currency: string;
  timezone?: string | null;
  dashboard_layout?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  deposit_date: string;
  notes?: string | null;
  created_at?: string;
}

export interface WeeklyBalance {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  opening_balance: number;
  closing_balance: number;
  withdrawn_amount: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

export interface Announcement {
  id: string;
  user_id: string;
  title: string;
  content: string;
  priority: string;
  is_pinned: boolean;
  scheduled_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
}
