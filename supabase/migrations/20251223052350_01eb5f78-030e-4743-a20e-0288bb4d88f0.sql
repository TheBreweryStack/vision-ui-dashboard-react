-- Add unique constraint for trade_groups to prevent duplicate positions
-- For nullable columns, we use a partial unique index approach
-- Position key: user_id, ticker, trade_type, strike_price, expiration_date, entry_date

-- Index for options (with strike and expiration)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_groups_position_key_options
ON trade_groups (user_id, ticker, trade_type, strike_price, expiration_date, entry_date)
WHERE strike_price IS NOT NULL AND expiration_date IS NOT NULL;

-- Index for stocks (no strike or expiration)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_groups_position_key_stock
ON trade_groups (user_id, ticker, trade_type, entry_date)
WHERE strike_price IS NULL AND expiration_date IS NULL;

-- Add unique constraint for trade_fills to prevent duplicate fills
-- Using partial indexes for nullable columns
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_fills_dedup_with_inbox
ON trade_fills (trade_group_id, effect, qty, price, fill_date, fill_time, source_inbox_id)
WHERE fill_time IS NOT NULL AND source_inbox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_fills_dedup_no_time
ON trade_fills (trade_group_id, effect, qty, price, fill_date, source_inbox_id)
WHERE fill_time IS NULL AND source_inbox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_fills_dedup_no_inbox
ON trade_fills (trade_group_id, effect, qty, price, fill_date, fill_time)
WHERE fill_time IS NOT NULL AND source_inbox_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_fills_dedup_minimal
ON trade_fills (trade_group_id, effect, qty, price, fill_date)
WHERE fill_time IS NULL AND source_inbox_id IS NULL;

-- Add exit_date column to trade_groups
ALTER TABLE trade_groups ADD COLUMN IF NOT EXISTS exit_date date;

-- Update exit_date for existing closed groups based on their last close fill
UPDATE trade_groups tg
SET exit_date = (
  SELECT MAX(fill_date)
  FROM trade_fills tf
  WHERE tf.trade_group_id = tg.id
    AND tf.effect = 'close'
)
WHERE tg.status = 'closed' AND tg.exit_date IS NULL;