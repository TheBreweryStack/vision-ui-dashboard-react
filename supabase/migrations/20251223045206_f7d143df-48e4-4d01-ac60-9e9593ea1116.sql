-- Direct cleanup of remaining duplicates (MCD, NKE, GLD on 2025-12-15 with NULL strike/exp)

-- First identify the specific duplicates and reassign their fills
DO $$
DECLARE
  rec RECORD;
  canonical_id UUID;
  dup_id UUID;
BEGIN
  -- For each set of duplicates
  FOR rec IN 
    SELECT 
      user_id, ticker, trade_type, strike_price, expiration_date, entry_date
    FROM trade_groups 
    GROUP BY user_id, ticker, trade_type, strike_price, expiration_date, entry_date 
    HAVING count(*) > 1
  LOOP
    -- Find the canonical (oldest) group
    SELECT id INTO canonical_id
    FROM trade_groups
    WHERE user_id = rec.user_id 
      AND ticker = rec.ticker 
      AND trade_type = rec.trade_type
      AND (strike_price IS NOT DISTINCT FROM rec.strike_price)
      AND (expiration_date IS NOT DISTINCT FROM rec.expiration_date)
      AND entry_date = rec.entry_date
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Reassign all fills from duplicates to canonical
    UPDATE trade_fills
    SET trade_group_id = canonical_id
    WHERE trade_group_id IN (
      SELECT id FROM trade_groups
      WHERE user_id = rec.user_id 
        AND ticker = rec.ticker 
        AND trade_type = rec.trade_type
        AND (strike_price IS NOT DISTINCT FROM rec.strike_price)
        AND (expiration_date IS NOT DISTINCT FROM rec.expiration_date)
        AND entry_date = rec.entry_date
        AND id != canonical_id
    );
    
    -- Delete the duplicates
    DELETE FROM trade_groups
    WHERE user_id = rec.user_id 
      AND ticker = rec.ticker 
      AND trade_type = rec.trade_type
      AND (strike_price IS NOT DISTINCT FROM rec.strike_price)
      AND (expiration_date IS NOT DISTINCT FROM rec.expiration_date)
      AND entry_date = rec.entry_date
      AND id != canonical_id;
  END LOOP;
END $$;

-- Recompute all group aggregates from fills
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