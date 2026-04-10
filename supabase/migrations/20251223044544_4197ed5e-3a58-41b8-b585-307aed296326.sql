-- Deduplicate trade_groups and add unique constraint
-- Step 1: Create a mapping of duplicate groups to their canonical (oldest) version

-- First, let's create a temp table to store canonical group IDs
CREATE TEMP TABLE canonical_groups AS
WITH ranked AS (
  SELECT 
    id,
    user_id,
    ticker,
    trade_type,
    COALESCE(strike_price::text, 'null') as strike_key,
    COALESCE(expiration_date::text, 'null') as exp_key,
    entry_date,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, ticker, trade_type, 
        COALESCE(strike_price::text, 'null'), 
        COALESCE(expiration_date::text, 'null'), 
        entry_date
      ORDER BY created_at ASC
    ) as rn
  FROM trade_groups
)
SELECT 
  r1.id as canonical_id,
  r2.id as duplicate_id
FROM ranked r1
JOIN ranked r2 ON 
  r1.user_id = r2.user_id AND
  r1.ticker = r2.ticker AND
  r1.trade_type = r2.trade_type AND
  r1.strike_key = r2.strike_key AND
  r1.exp_key = r2.exp_key AND
  r1.entry_date = r2.entry_date AND
  r1.rn = 1 AND r2.rn > 1;

-- Step 2: Reassign trade_fills from duplicate groups to canonical groups
UPDATE trade_fills 
SET trade_group_id = cg.canonical_id
FROM canonical_groups cg
WHERE trade_fills.trade_group_id = cg.duplicate_id;

-- Step 3: Delete duplicate groups (now orphaned)
DELETE FROM trade_groups 
WHERE id IN (SELECT duplicate_id FROM canonical_groups);

-- Step 4: Recompute all trade_group aggregates from their fills
WITH fill_stats AS (
  SELECT 
    trade_group_id,
    SUM(CASE WHEN effect = 'open' THEN qty ELSE 0 END) as total_opened,
    SUM(CASE WHEN effect = 'close' THEN qty ELSE 0 END) as total_closed,
    SUM(CASE WHEN effect = 'open' THEN qty * price ELSE 0 END) as open_cost,
    SUM(CASE WHEN effect = 'close' THEN qty * price ELSE 0 END) as close_value,
    MIN(CASE WHEN effect = 'open' THEN fill_date END) as first_entry_date
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
        (CASE WHEN COALESCE(fs.total_closed, 0) > 0 THEN fs.close_value / fs.total_closed ELSE 0 END) 
        - (CASE WHEN COALESCE(fs.total_opened, 0) > 0 THEN fs.open_cost / fs.total_opened ELSE 0 END)
      ) * fs.total_closed * (CASE WHEN tg.trade_type = 'stock' THEN 1 ELSE 100 END)
      ELSE NULL 
    END as realized_pnl,
    CASE WHEN COALESCE(fs.total_opened, 0) - COALESCE(fs.total_closed, 0) = 0 
      THEN 'closed' 
      ELSE 'open' 
    END as status,
    COALESCE(fs.first_entry_date, tg.entry_date) as entry_date
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
  entry_date = c.entry_date,
  updated_at = now()
FROM computed c
WHERE tg.id = c.id;

-- Step 5: Clean up temp table
DROP TABLE canonical_groups;

-- Step 6: Add unique constraint to prevent future duplicates
-- Handle NULL values in the unique constraint by using COALESCE
ALTER TABLE trade_groups 
ADD CONSTRAINT trade_groups_position_unique 
UNIQUE (user_id, ticker, trade_type, strike_price, expiration_date, entry_date);

-- Step 7: Drop the foreign key from trade_inbox to trades table (it's legacy)
ALTER TABLE trade_inbox 
DROP CONSTRAINT IF EXISTS trade_inbox_imported_trade_id_fkey;

-- Step 8: Add a new column to reference trade_groups instead (nullable for backward compat)
ALTER TABLE trade_inbox 
ADD COLUMN IF NOT EXISTS imported_group_id uuid REFERENCES trade_groups(id) ON DELETE SET NULL;