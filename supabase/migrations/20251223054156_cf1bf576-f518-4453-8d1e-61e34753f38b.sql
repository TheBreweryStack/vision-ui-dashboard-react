-- Update trade_groups quantities based on actual fills
UPDATE trade_groups tg
SET 
  opened_qty = COALESCE(fill_stats.opened, 0),
  closed_qty = COALESCE(fill_stats.closed, 0),
  remaining_qty = COALESCE(fill_stats.opened, 0) - COALESCE(fill_stats.closed, 0),
  status = CASE 
    WHEN COALESCE(fill_stats.opened, 0) - COALESCE(fill_stats.closed, 0) > 0 THEN 'open'
    ELSE 'closed'
  END,
  exit_date = CASE 
    WHEN COALESCE(fill_stats.opened, 0) - COALESCE(fill_stats.closed, 0) <= 0 THEN fill_stats.last_close_date
    ELSE NULL
  END
FROM (
  SELECT 
    trade_group_id,
    SUM(CASE WHEN effect = 'open' THEN qty ELSE 0 END) AS opened,
    SUM(CASE WHEN effect = 'close' THEN qty ELSE 0 END) AS closed,
    MAX(CASE WHEN effect = 'close' THEN fill_date END) AS last_close_date
  FROM trade_fills
  GROUP BY trade_group_id
) fill_stats
WHERE tg.id = fill_stats.trade_group_id;