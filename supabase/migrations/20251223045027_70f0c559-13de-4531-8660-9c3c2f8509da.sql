-- Fix remaining duplicates that have NULL strike_price and expiration_date
-- (NULL values are not equal in unique constraints)

-- Step 1: Identify and dedupe remaining duplicates
WITH ranked AS (
  SELECT 
    id,
    user_id,
    ticker,
    trade_type,
    strike_price,
    expiration_date,
    entry_date,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, ticker, trade_type, 
        COALESCE(strike_price::text, ''), 
        COALESCE(expiration_date::text, ''), 
        entry_date
      ORDER BY created_at ASC
    ) as rn
  FROM trade_groups
),
canonical AS (
  SELECT 
    r1.id as canonical_id,
    r2.id as duplicate_id
  FROM ranked r1
  JOIN ranked r2 ON 
    r1.user_id = r2.user_id AND
    r1.ticker = r2.ticker AND
    r1.trade_type = r2.trade_type AND
    COALESCE(r1.strike_price::text, '') = COALESCE(r2.strike_price::text, '') AND
    COALESCE(r1.expiration_date::text, '') = COALESCE(r2.expiration_date::text, '') AND
    r1.entry_date = r2.entry_date AND
    r1.rn = 1 AND r2.rn > 1
)
-- Reassign fills first
UPDATE trade_fills tf
SET trade_group_id = c.canonical_id
FROM canonical c
WHERE tf.trade_group_id = c.duplicate_id;

-- Delete duplicates
DELETE FROM trade_groups 
WHERE id IN (
  WITH ranked AS (
    SELECT 
      id,
      user_id,
      ticker,
      trade_type,
      strike_price,
      expiration_date,
      entry_date,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, ticker, trade_type, 
          COALESCE(strike_price::text, ''), 
          COALESCE(expiration_date::text, ''), 
          entry_date
        ORDER BY created_at ASC
      ) as rn
    FROM trade_groups
  )
  SELECT id FROM ranked WHERE rn > 1
);

-- Recompute aggregates
WITH fill_stats AS (
  SELECT 
    trade_group_id,
    SUM(CASE WHEN effect = 'open' THEN qty ELSE 0 END) as total_opened,
    SUM(CASE WHEN effect = 'close' THEN qty ELSE 0 END) as total_closed,
    SUM(CASE WHEN effect = 'open' THEN qty * price ELSE 0 END) as open_cost,
    SUM(CASE WHEN effect = 'close' THEN qty * price ELSE 0 END) as close_value
  FROM trade_fills
  GROUP BY trade_group_id
),
computed AS (
  SELECT 
    tg.id,
    COALESCE(fs.total_opened, 0) as opened_qty,
    COALESCE(fs.total_closed, 0) as closed_qty,
    COALESCE(fs.total_opened, 0) - COALESCE(fs.total_closed, 0) as remaining_qty,
    CASE WHEN COALESCE(fs.total_opened, 0) > 0 
      THEN fs.open_cost / fs.total_opened 
      ELSE tg.avg_entry_price 
    END as avg_entry_price,
    CASE WHEN COALESCE(fs.total_closed, 0) > 0 
      THEN fs.close_value / fs.total_closed 
      ELSE NULL 
    END as avg_exit_price,
    CASE WHEN COALESCE(fs.total_closed, 0) > 0 
      THEN (
        (fs.close_value / NULLIF(fs.total_closed, 0)) 
        - (fs.open_cost / NULLIF(fs.total_opened, 0))
      ) * fs.total_closed * (CASE WHEN tg.trade_type = 'stock' THEN 1 ELSE 100 END)
      ELSE NULL 
    END as realized_pnl,
    CASE WHEN COALESCE(fs.total_opened, 0) - COALESCE(fs.total_closed, 0) = 0 
      THEN 'closed' 
      ELSE 'open' 
    END as status
  FROM trade_groups tg
  LEFT JOIN fill_stats fs ON tg.id = fs.trade_group_id
)
UPDATE trade_groups tg
SET 
  opened_qty = c.opened_qty,
  closed_qty = c.closed_qty,
  remaining_qty = c.remaining_qty,
  avg_entry_price = ROUND(c.avg_entry_price::numeric, 2),
  avg_exit_price = ROUND(c.avg_exit_price::numeric, 2),
  realized_pnl = ROUND(c.realized_pnl::numeric, 2),
  status = c.status,
  updated_at = now()
FROM computed c
WHERE tg.id = c.id;

-- Drop the old unique constraint and create a partial unique index that handles NULLs
ALTER TABLE trade_groups DROP CONSTRAINT IF EXISTS trade_groups_position_unique;

-- Create unique index that properly handles NULL values
CREATE UNIQUE INDEX trade_groups_position_unique_idx ON trade_groups (
  user_id, 
  ticker, 
  trade_type, 
  COALESCE(strike_price, -1), 
  COALESCE(expiration_date, '1900-01-01'::date), 
  entry_date
);