-- Backfill trade_groups and trade_fills from existing trades table
-- This migrates all legacy trades into the new position-based architecture

-- First, insert groups (one per unique position)
INSERT INTO trade_groups (
  user_id,
  ticker,
  trade_type,
  strike_price,
  expiration_date,
  entry_date,
  status,
  opened_qty,
  closed_qty,
  remaining_qty,
  avg_entry_price,
  avg_exit_price,
  realized_pnl,
  strategy,
  notes,
  images,
  created_at
)
SELECT 
  t.user_id,
  t.ticker,
  t.trade_type::text,
  t.strike_price,
  t.expiration_date,
  t.entry_date,
  t.status::text,
  SUM(t.quantity) as opened_qty,
  CASE WHEN t.status = 'closed' THEN SUM(t.quantity) ELSE 0 END as closed_qty,
  CASE WHEN t.status = 'open' THEN SUM(t.quantity) ELSE 0 END as remaining_qty,
  -- Weighted average entry price
  SUM(t.entry_price * t.quantity) / NULLIF(SUM(t.quantity), 0) as avg_entry_price,
  -- Average exit price (only for closed trades)
  CASE 
    WHEN t.status = 'closed' THEN SUM(COALESCE(t.exit_price, 0) * t.quantity) / NULLIF(SUM(t.quantity), 0) 
    ELSE NULL 
  END as avg_exit_price,
  SUM(COALESCE(t.pnl, 0)) as realized_pnl,
  MAX(t.strategy) as strategy,
  STRING_AGG(NULLIF(t.notes, ''), E'\n---\n') as notes,
  -- Combine all images from trades in this group
  ARRAY(
    SELECT DISTINCT unnest(images) 
    FROM trades t2 
    WHERE t2.user_id = t.user_id 
      AND t2.ticker = t.ticker 
      AND t2.trade_type = t.trade_type 
      AND COALESCE(t2.strike_price, 0) = COALESCE(t.strike_price, 0)
      AND COALESCE(t2.expiration_date, '1900-01-01') = COALESCE(t.expiration_date, '1900-01-01')
      AND t2.entry_date = t.entry_date
      AND t2.images IS NOT NULL
  ) as images,
  MIN(t.created_at) as created_at
FROM trades t
GROUP BY 
  t.user_id,
  t.ticker,
  t.trade_type,
  t.strike_price,
  t.expiration_date,
  t.entry_date,
  t.status
ON CONFLICT DO NOTHING;

-- Now insert fills for each original trade
-- Entry fills (buy to open)
INSERT INTO trade_fills (
  trade_group_id,
  user_id,
  side,
  effect,
  qty,
  price,
  fill_date,
  fill_time,
  source,
  notes,
  created_at
)
SELECT 
  tg.id as trade_group_id,
  t.user_id,
  'buy' as side,
  'open' as effect,
  t.quantity as qty,
  t.entry_price as price,
  t.entry_date as fill_date,
  t.entry_time as fill_time,
  'backfill' as source,
  t.notes,
  t.created_at
FROM trades t
JOIN trade_groups tg ON 
  tg.user_id = t.user_id
  AND tg.ticker = t.ticker
  AND tg.trade_type = t.trade_type::text
  AND COALESCE(tg.strike_price, 0) = COALESCE(t.strike_price, 0)
  AND COALESCE(tg.expiration_date, '1900-01-01'::date) = COALESCE(t.expiration_date, '1900-01-01'::date)
  AND tg.entry_date = t.entry_date;

-- Exit fills (sell to close) for closed trades
INSERT INTO trade_fills (
  trade_group_id,
  user_id,
  side,
  effect,
  qty,
  price,
  fill_date,
  fill_time,
  source,
  notes,
  created_at
)
SELECT 
  tg.id as trade_group_id,
  t.user_id,
  'sell' as side,
  'close' as effect,
  t.quantity as qty,
  t.exit_price as price,
  t.exit_date as fill_date,
  t.exit_time as fill_time,
  'backfill' as source,
  NULL as notes,
  t.updated_at as created_at
FROM trades t
JOIN trade_groups tg ON 
  tg.user_id = t.user_id
  AND tg.ticker = t.ticker
  AND tg.trade_type = t.trade_type::text
  AND COALESCE(tg.strike_price, 0) = COALESCE(t.strike_price, 0)
  AND COALESCE(tg.expiration_date, '1900-01-01'::date) = COALESCE(t.expiration_date, '1900-01-01'::date)
  AND tg.entry_date = t.entry_date
WHERE t.status = 'closed' 
  AND t.exit_price IS NOT NULL 
  AND t.exit_date IS NOT NULL;