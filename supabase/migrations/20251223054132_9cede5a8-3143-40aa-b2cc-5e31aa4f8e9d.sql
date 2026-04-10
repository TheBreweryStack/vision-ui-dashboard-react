-- Drop ALL old dedup indexes
DROP INDEX IF EXISTS idx_trade_fills_dedup_with_inbox;
DROP INDEX IF EXISTS idx_trade_fills_dedup_no_time;
DROP INDEX IF EXISTS idx_trade_fills_dedup_no_inbox;
DROP INDEX IF EXISTS idx_trade_fills_dedup_minimal;

-- Keep only the dedupe_key index for idempotent backfills

-- Now backfill OPEN fills (from entry fields)
INSERT INTO trade_fills (
  id, trade_group_id, user_id,
  side, effect, qty, price,
  fill_date, fill_time, source, dedupe_key
)
SELECT
  gen_random_uuid(),
  tg.id,
  t.user_id,
  'buy' AS side,
  'open' AS effect,
  COALESCE(t.quantity, 0)::int,
  COALESCE(t.entry_price, 0)::numeric,
  t.entry_date,
  t.entry_time,
  'backfill',
  'trade:' || t.id || ':open'
FROM trades t
JOIN trade_groups tg
  ON tg.user_id = t.user_id
  AND tg.ticker = t.ticker
  AND tg.trade_type = t.trade_type::text
  AND (tg.strike_price IS NOT DISTINCT FROM t.strike_price)
  AND (tg.expiration_date IS NOT DISTINCT FROM t.expiration_date)
  AND tg.entry_date = t.entry_date
WHERE t.entry_date IS NOT NULL
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

-- CLOSE fills (only if there is an exit)
INSERT INTO trade_fills (
  id, trade_group_id, user_id,
  side, effect, qty, price,
  fill_date, fill_time, source, dedupe_key
)
SELECT
  gen_random_uuid(),
  tg.id,
  t.user_id,
  'sell' AS side,
  'close' AS effect,
  COALESCE(t.quantity, 0)::int,
  COALESCE(t.exit_price, 0)::numeric,
  t.exit_date,
  t.exit_time,
  'backfill',
  'trade:' || t.id || ':close'
FROM trades t
JOIN trade_groups tg
  ON tg.user_id = t.user_id
  AND tg.ticker = t.ticker
  AND tg.trade_type = t.trade_type::text
  AND (tg.strike_price IS NOT DISTINCT FROM t.strike_price)
  AND (tg.expiration_date IS NOT DISTINCT FROM t.expiration_date)
  AND tg.entry_date = t.entry_date
WHERE t.exit_date IS NOT NULL
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;