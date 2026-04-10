-- 1. Create market_news table for storing historical news
CREATE TABLE public.market_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  sentiment TEXT,
  sentiment_score NUMERIC,
  tickers TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique constraint on URL to prevent duplicates
CREATE UNIQUE INDEX idx_market_news_url ON public.market_news(url);

-- Create index for faster queries
CREATE INDEX idx_market_news_published_at ON public.market_news(published_at DESC);
CREATE INDEX idx_market_news_ticker ON public.market_news(ticker);

-- Enable RLS
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;

-- Anyone can read market news (public data)
CREATE POLICY "Anyone can read market news" 
ON public.market_news 
FOR SELECT 
USING (true);

-- Only service role can insert/update/delete (via edge functions)
CREATE POLICY "Service role can manage market news" 
ON public.market_news 
FOR ALL 
USING (auth.role() = 'service_role');

-- 2. Add new alert types to alerts table by updating the alert_type constraint
-- First, let's add support for technical indicator alerts
-- The existing alert_type column can already hold any string, so we just need to document the new types:
-- price_above, price_below (existing)
-- price_level_above, price_level_below (absolute price targets)
-- rsi_overbought, rsi_oversold
-- ema_crossover_bullish, ema_crossover_bearish
-- percent_up, percent_down (existing percentage based)

-- Add a target_value column for absolute price targets
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS target_value NUMERIC;

-- 3. Update get_dashboard_data RPC to include note tasks
CREATE OR REPLACE FUNCTION public.get_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  week_start date := (date_trunc('week', now() + interval '1 day') - interval '1 day')::date;
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  with
  settings as (
    select
      coalesce(starting_balance, 0) as starting_balance,
      coalesce(weekly_goal, 500) as weekly_goal
    from account_settings
    where user_id = uid
    order by updated_at desc nulls last, created_at desc
    limit 1
  ),
  net_flow as (
    select coalesce(sum(
      case
        when transaction_type = 'deposit' then amount
        when transaction_type = 'withdrawal' then -amount
        else amount
      end
    ), 0) as net_flow
    from deposits
    where user_id = uid
  ),
  stats as (
    select
      coalesce(sum(coalesce(realized_pnl, 0)), 0) as total_pnl,
      count(*) filter (where realized_pnl is not null) as total_trades,
      count(*) filter (where status = 'open') as open_trades,
      coalesce(avg(realized_pnl) filter (where realized_pnl > 0), 0) as avg_win,
      coalesce(avg(realized_pnl) filter (where realized_pnl < 0), 0) as avg_loss,
      case
        when count(*) filter (where realized_pnl is not null) = 0 then 0
        else
          100.0 * count(*) filter (where realized_pnl > 0)
          / count(*) filter (where realized_pnl is not null)
      end as win_rate
    from trade_groups
    where user_id = uid
  ),
  weekly_pnl as (
    select coalesce(sum(coalesce(g.realized_pnl, 0)), 0) as weekly_pnl
    from trade_groups g
    where g.user_id = uid
      and (
        g.entry_date >= week_start
        or exists (
          select 1
          from trade_fills f
          where f.user_id = uid
            and f.trade_group_id = g.id
            and f.fill_date >= week_start
        )
      )
  ),
  consecutive_losses as (
    with closed as (
      select realized_pnl
      from trade_groups
      where user_id = uid
        and status = 'closed'
        and realized_pnl is not null
      order by updated_at desc
      limit 200
    ),
    numbered as (
      select row_number() over () as rn, realized_pnl
      from closed
    ),
    stop as (
      select min(rn) as stop_rn
      from numbered
      where realized_pnl >= 0
    )
    select
      case
        when (select stop_rn from stop) is null
          then (select count(*) from numbered where realized_pnl < 0)
        else
          (select count(*) from numbered
            where rn < (select stop_rn from stop) and realized_pnl < 0)
      end as consecutive_losses
  ),
  recent_groups as (
    select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) as items
    from (
      select
        id, ticker, trade_type, strike_price, entry_date, status,
        remaining_qty, closed_qty, realized_pnl, avg_entry_price, updated_at
      from trade_groups
      where user_id = uid
      order by updated_at desc
      limit 5
    ) r
  ),
  open_groups as (
    select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) as items
    from (
      select
        id, ticker, trade_type, strike_price, entry_date, status,
        remaining_qty, avg_entry_price, updated_at
      from trade_groups
      where user_id = uid
        and status = 'open'
      order by updated_at desc
      limit 5
    ) r
  ),
  reminders_upcoming as (
    select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) as items
    from (
      select id, title, ticker, priority, due_date, reminder_time
      from reminders
      where user_id = uid
        and coalesce(is_completed, false) = false
        and due_date <= (current_date + 1)
      order by due_date asc, reminder_time asc nulls last
      limit 3
    ) r
  ),
  -- NEW: Get incomplete note tasks
  note_tasks_pending as (
    select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) as items
    from (
      select 
        rem.id,
        rem.title,
        rem.priority,
        rem.due_date,
        rem.reminder_time,
        n.ticker,
        n.title as note_title,
        n.id as note_id
      from reminders rem
      inner join notes n on rem.note_id = n.id
      where rem.user_id = uid
        and coalesce(rem.is_completed, false) = false
        and rem.note_id is not null
      order by rem.due_date asc nulls last, rem.created_at desc
      limit 5
    ) r
  ),
  inbox_counts as (
    select
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'needs_review') as needs_review
    from trade_inbox
    where user_id = uid
  )
  select jsonb_build_object(
    'settings', (select row_to_json(settings) from settings),
    'netFlow', (select net_flow from net_flow),
    'stats', (select row_to_json(stats) from stats),
    'weeklyPnl', (select weekly_pnl from weekly_pnl),
    'consecutiveLosses', (select consecutive_losses from consecutive_losses),
    'recentGroups', (select items from recent_groups),
    'openGroups', (select items from open_groups),
    'upcomingReminders', (select items from reminders_upcoming),
    'noteTasks', (select items from note_tasks_pending),
    'inboxCounts', (select row_to_json(inbox_counts) from inbox_counts)
  ) into result;

  return result;
end;
$function$;