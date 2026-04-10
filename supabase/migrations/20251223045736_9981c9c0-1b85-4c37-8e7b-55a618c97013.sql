
-- First, delete all duplicate backfill fills and keep data clean
-- For ROKU: should be 2 buy (qty 2 total), 1 sell (qty 1)
-- For MRK: should only have fills from actual imports

-- Delete ALL backfill fills - they were duplicated
DELETE FROM trade_fills WHERE source = 'backfill';

-- Delete duplicate email_import fills for MRK (keep only 1 open and the closes that were actually imported)
-- MRK has 3 duplicate buy fills and 3 duplicate sell fills but user only bought 1 contract

-- First delete all MRK fills - it's corrupted
DELETE FROM trade_fills 
WHERE trade_group_id IN (
  SELECT id FROM trade_groups WHERE ticker = 'MRK'
);

-- Delete the MRK trade group - it needs to be reimported fresh
DELETE FROM trade_groups WHERE ticker = 'MRK';

-- Now fix ROKU - delete all fills and recreate based on actual inbox data
DELETE FROM trade_fills 
WHERE trade_group_id IN (
  SELECT id FROM trade_groups WHERE ticker = 'ROKU'
);

-- Update ROKU trade_group to reflect the actual imported data:
-- 2 contracts bought, 1 closed = remaining 1
UPDATE trade_groups 
SET 
  opened_qty = 2,
  closed_qty = 1,
  remaining_qty = 1,
  avg_entry_price = 1.34,
  avg_exit_price = 1.50,
  realized_pnl = (1.50 - 1.34) * 100 * 1, -- 1 closed contract
  status = 'open'
WHERE ticker = 'ROKU';

-- Recreate the correct fills for ROKU based on inbox data
INSERT INTO trade_fills (trade_group_id, user_id, side, effect, qty, price, fill_date, fill_time, source, source_inbox_id)
SELECT 
  tg.id,
  tg.user_id,
  'buy',
  'open',
  2,
  1.34,
  '2025-12-22',
  '11:38:00',
  'email_import',
  'a2f8b032-d78e-459c-9887-3d2c4af2fe39'
FROM trade_groups tg
WHERE tg.ticker = 'ROKU';

INSERT INTO trade_fills (trade_group_id, user_id, side, effect, qty, price, fill_date, fill_time, source, source_inbox_id)
SELECT 
  tg.id,
  tg.user_id,
  'sell',
  'close',
  1,
  1.50,
  '2025-12-22',
  '12:00:00',
  'email_import',
  'f6924877-de9b-4161-ac16-f332e5a191af'
FROM trade_groups tg
WHERE tg.ticker = 'ROKU';

-- Reset MRK inbox items to pending so they can be reimported cleanly
UPDATE trade_inbox 
SET status = 'pending', imported_group_id = NULL
WHERE parsed_trade->>'symbol' = 'MRK';
