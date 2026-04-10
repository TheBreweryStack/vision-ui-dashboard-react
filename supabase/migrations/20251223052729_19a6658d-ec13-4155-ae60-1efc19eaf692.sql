-- For closed groups without exit_date, set it to entry_date (day trades)
-- This is a fallback for groups that lost their fills during cleanup
UPDATE trade_groups
SET exit_date = entry_date
WHERE status = 'closed' 
  AND exit_date IS NULL;