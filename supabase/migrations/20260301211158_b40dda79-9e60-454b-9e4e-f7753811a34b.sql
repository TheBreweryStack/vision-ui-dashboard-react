
-- ============================================================
-- Phase 1: Multi-Portfolio System
-- ============================================================

-- 1. Create portfolios table
CREATE TABLE public.portfolios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'mixed',
  is_default boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portfolios" ON public.portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own portfolios" ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own portfolios" ON public.portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own portfolios" ON public.portfolios FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create portfolio_holdings table
CREATE TABLE public.portfolio_holdings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  asset_type text NOT NULL DEFAULT 'stock',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own holdings" ON public.portfolio_holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own holdings" ON public.portfolio_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own holdings" ON public.portfolio_holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own holdings" ON public.portfolio_holdings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_portfolio_holdings_updated_at
  BEFORE UPDATE ON public.portfolio_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create portfolio_routing_rules table
CREATE TABLE public.portfolio_routing_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  match_type text NOT NULL,
  match_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own routing rules" ON public.portfolio_routing_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own routing rules" ON public.portfolio_routing_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own routing rules" ON public.portfolio_routing_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own routing rules" ON public.portfolio_routing_rules FOR DELETE USING (auth.uid() = user_id);

-- 4. Add portfolio_id columns to existing tables (nullable for backward compat)
ALTER TABLE public.trade_groups ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;
ALTER TABLE public.deposits ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;
ALTER TABLE public.weekly_balances ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;
ALTER TABLE public.account_settings ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;

-- 5. Backfill: Create a default "Main" portfolio for every existing user
INSERT INTO public.portfolios (user_id, name, category, is_default)
SELECT DISTINCT p.id, 'Main', 'mixed', true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.portfolios port WHERE port.user_id = p.id
);

-- 6. Backfill: Link existing data to the default portfolio
UPDATE public.trade_groups tg
SET portfolio_id = (SELECT id FROM public.portfolios WHERE user_id = tg.user_id AND is_default = true LIMIT 1)
WHERE portfolio_id IS NULL;

UPDATE public.deposits d
SET portfolio_id = (SELECT id FROM public.portfolios WHERE user_id = d.user_id AND is_default = true LIMIT 1)
WHERE portfolio_id IS NULL;

UPDATE public.weekly_balances wb
SET portfolio_id = (SELECT id FROM public.portfolios WHERE user_id = wb.user_id AND is_default = true LIMIT 1)
WHERE portfolio_id IS NULL;

UPDATE public.account_settings ac
SET portfolio_id = (SELECT id FROM public.portfolios WHERE user_id = ac.user_id AND is_default = true LIMIT 1)
WHERE portfolio_id IS NULL;

-- 7. Auto-create default portfolio for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_portfolio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.portfolios (user_id, name, category, is_default)
  VALUES (NEW.id, 'Main', 'mixed', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_portfolio
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_portfolio();

-- 8. Update get_journal_data to accept optional portfolio_id
CREATE OR REPLACE FUNCTION public.get_journal_data(p_portfolio_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'groups', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'ticker', g.ticker,
            'trade_type', g.trade_type,
            'strike_price', g.strike_price,
            'expiration_date', g.expiration_date,
            'entry_date', g.entry_date,
            'exit_date', g.exit_date,
            'status', g.status,
            'opened_qty', g.opened_qty,
            'closed_qty', g.closed_qty,
            'remaining_qty', g.remaining_qty,
            'avg_entry_price', g.avg_entry_price,
            'avg_exit_price', g.avg_exit_price,
            'realized_pnl', g.realized_pnl,
            'strategy', g.strategy,
            'notes', g.notes,
            'images', g.images,
            'portfolio_id', g.portfolio_id,
            'created_at', g.created_at,
            'updated_at', g.updated_at,
            'fills', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', f.id,
                    'trade_group_id', f.trade_group_id,
                    'side', f.side,
                    'effect', f.effect,
                    'qty', f.qty,
                    'price', f.price,
                    'fill_date', f.fill_date,
                    'fill_time', f.fill_time,
                    'notes', f.notes,
                    'source', f.source,
                    'created_at', f.created_at
                  )
                  ORDER BY f.fill_date DESC, f.created_at DESC
                )
                FROM trade_fills f
                WHERE f.trade_group_id = g.id
              ),
              '[]'::jsonb
            )
          )
          ORDER BY g.updated_at DESC
        )
        FROM trade_groups g
        WHERE g.user_id = uid
          AND (p_portfolio_id IS NULL OR g.portfolio_id = p_portfolio_id)
      ),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 9. Update get_dashboard_data to accept optional portfolio_id
CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_portfolio_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  uid uuid := auth.uid();
  user_tz text;
  local_now timestamp;
  week_start date;
  week_to_check date;
  is_monday_morning boolean;
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  SELECT COALESCE(timezone, 'America/New_York') INTO user_tz
  FROM account_settings
  WHERE user_id = uid
    AND (p_portfolio_id IS NULL OR portfolio_id = p_portfolio_id)
  LIMIT 1;
  
  IF user_tz IS NULL THEN
    user_tz := 'America/New_York';
  END IF;

  local_now := now() AT TIME ZONE user_tz;
  week_start := date_trunc('week', local_now)::date;
  is_monday_morning := EXTRACT(DOW FROM local_now) = 1 AND EXTRACT(HOUR FROM local_now) < 9;
  
  week_to_check := CASE 
    WHEN is_monday_morning THEN week_start - interval '7 days'
    ELSE week_start
  END;

  with
  settings as (
    select
      coalesce(starting_balance, 0) as starting_balance,
      coalesce(weekly_goal, 500) as weekly_goal
    from account_settings
    where user_id = uid
      and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
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
      and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
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
      and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
  ),
  weekly_pnl as (
    select coalesce(sum(coalesce(g.realized_pnl, 0)), 0) as weekly_pnl
    from trade_groups g
    where g.user_id = uid
      and (p_portfolio_id is null or g.portfolio_id = p_portfolio_id)
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
        and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
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
        and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
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
        and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
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
        and note_id is null
      order by due_date asc, reminder_time asc nulls last
      limit 3
    ) r
  ),
  note_tasks_pending as (
    select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) as items
    from (
      select distinct on (rem.id)
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
      order by rem.id, rem.due_date asc nulls last, rem.created_at desc
      limit 5
    ) r
  ),
  inbox_counts as (
    select
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'needs_review') as needs_review
    from trade_inbox
    where user_id = uid
  ),
  week_closed as (
    select exists(
      select 1 from weekly_balances
      where user_id = uid
      and week_start_date = week_to_check
      and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
    ) as is_closed
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
    'inboxCounts', (select row_to_json(inbox_counts) from inbox_counts),
    'weekClosed', (select is_closed from week_closed)
  ) into result;

  return result;
end;
$$;
