-- Directly merge duplicates for GLD, MCD, NKE

-- GLD: Keep b18f8f33... (older), remove a3c61dc3...
UPDATE trade_fills SET trade_group_id = 'b18f8f33-6fef-4e01-8e95-787e4e5e67ae' 
WHERE trade_group_id = 'a3c61dc3-5a4a-4032-b54d-a35875660715';
DELETE FROM trade_groups WHERE id = 'a3c61dc3-5a4a-4032-b54d-a35875660715';

-- MCD: Keep e2757932... (older), remove fb1b5b30...
UPDATE trade_fills SET trade_group_id = 'e2757932-6706-4579-8e4a-6a93b4a7f9ef' 
WHERE trade_group_id = 'fb1b5b30-4969-4129-b400-4bc2720b37e0';
DELETE FROM trade_groups WHERE id = 'fb1b5b30-4969-4129-b400-4bc2720b37e0';

-- NKE: Keep 72197981... (older), remove 867578c0...
UPDATE trade_fills SET trade_group_id = '72197981-3dd3-4634-830d-2a8403cf5ebe' 
WHERE trade_group_id = '867578c0-8cfe-4f3c-b678-9dbfd6c31eb4';
DELETE FROM trade_groups WHERE id = '867578c0-8cfe-4f3c-b678-9dbfd6c31eb4';

-- Recompute aggregates for these 3 groups
WITH fill_stats AS (
  SELECT 
    trade_group_id,
    SUM(CASE WHEN effect = 'open' THEN qty ELSE 0 END) as total_opened,
    SUM(CASE WHEN effect = 'close' THEN qty ELSE 0 END) as total_closed,
    SUM(CASE WHEN effect = 'open' THEN qty * price ELSE 0 END) as open_cost,
    SUM(CASE WHEN effect = 'close' THEN qty * price ELSE 0 END) as close_value
  FROM trade_fills
  WHERE trade_group_id IN (
    'b18f8f33-6fef-4e01-8e95-787e4e5e67ae',
    'e2757932-6706-4579-8e4a-6a93b4a7f9ef',
    '72197981-3dd3-4634-830d-2a8403cf5ebe'
  )
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
  WHERE tg.id IN (
    'b18f8f33-6fef-4e01-8e95-787e4e5e67ae',
    'e2757932-6706-4579-8e4a-6a93b4a7f9ef',
    '72197981-3dd3-4634-830d-2a8403cf5ebe'
  )
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