-- Add dedupe_key column to trade_fills
ALTER TABLE trade_fills
ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Create unique index on dedupe_key
CREATE UNIQUE INDEX IF NOT EXISTS trade_fills_dedupe_key
ON trade_fills(dedupe_key) WHERE dedupe_key IS NOT NULL;