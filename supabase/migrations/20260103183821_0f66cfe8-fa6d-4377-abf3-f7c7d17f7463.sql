-- Create correct partial unique indexes (OPEN only, no entry_date)
-- Options: only one OPEN position per contract
CREATE UNIQUE INDEX IF NOT EXISTS trade_groups_unique_open_options
ON trade_groups (user_id, ticker, trade_type, strike_price, expiration_date)
WHERE status = 'open'
  AND strike_price IS NOT NULL
  AND expiration_date IS NOT NULL;

-- Stocks: only one OPEN position per ticker/type
CREATE UNIQUE INDEX IF NOT EXISTS trade_groups_unique_open_stocks
ON trade_groups (user_id, ticker, trade_type)
WHERE status = 'open'
  AND strike_price IS NULL
  AND expiration_date IS NULL;