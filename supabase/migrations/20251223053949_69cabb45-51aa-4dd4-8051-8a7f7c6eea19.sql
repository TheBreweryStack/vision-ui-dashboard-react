-- 1) Merge duplicate groups into one canonical group
WITH dups AS (
  SELECT
    user_id, ticker, trade_type, strike_price, expiration_date, entry_date,
    array_agg(id ORDER BY created_at ASC) AS ids,
    count(*) AS cnt
  FROM trade_groups
  GROUP BY 1,2,3,4,5,6
  HAVING count(*) > 1
),
canon AS (
  SELECT
    user_id, ticker, trade_type, strike_price, expiration_date, entry_date,
    ids[1] AS keep_id,
    unnest(ids[2:]) AS drop_id
  FROM dups
)
UPDATE trade_fills f
SET trade_group_id = c.keep_id
FROM canon c
WHERE f.trade_group_id = c.drop_id;

-- Delete the duplicate trade_groups
WITH dups AS (
  SELECT
    user_id, ticker, trade_type, strike_price, expiration_date, entry_date,
    array_agg(id ORDER BY created_at ASC) AS ids,
    count(*) AS cnt
  FROM trade_groups
  GROUP BY 1,2,3,4,5,6
  HAVING count(*) > 1
),
canon AS (
  SELECT unnest(ids[2:]) AS drop_id FROM dups
)
DELETE FROM trade_groups g
USING canon c
WHERE g.id = c.drop_id;

-- 2) Add unique constraint to prevent duplicates forever (drop old indexes first)
DROP INDEX IF EXISTS trade_groups_unique_option;
DROP INDEX IF EXISTS trade_groups_unique_stock;
DROP INDEX IF EXISTS trade_groups_position_key;

CREATE UNIQUE INDEX IF NOT EXISTS trade_groups_position_key
ON trade_groups(user_id, ticker, trade_type, strike_price, expiration_date, entry_date);