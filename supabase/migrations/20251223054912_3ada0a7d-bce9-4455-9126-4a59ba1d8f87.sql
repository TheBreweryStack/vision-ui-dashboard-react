
-- Delete backfill duplicates for ROKU
DELETE FROM trade_fills 
WHERE trade_group_id = 'bb6ce537-2992-4c23-b4bb-9983e7d97ef8' 
AND source = 'backfill';

-- Update ROKU trade_group to correct values (2 opened, 1 closed, 1 remaining)
UPDATE trade_groups 
SET opened_qty = 2, closed_qty = 1, remaining_qty = 1, status = 'open'
WHERE id = 'bb6ce537-2992-4c23-b4bb-9983e7d97ef8';
