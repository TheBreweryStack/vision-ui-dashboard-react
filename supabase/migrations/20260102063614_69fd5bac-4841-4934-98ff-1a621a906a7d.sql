-- Performance indexes for faster dashboard and RLS queries

-- Trade groups indexes
CREATE INDEX IF NOT EXISTS idx_trade_groups_user_status 
  ON trade_groups(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trade_groups_user_updated 
  ON trade_groups(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_groups_user_entry 
  ON trade_groups(user_id, entry_date DESC);

-- Trade fills indexes  
CREATE INDEX IF NOT EXISTS idx_trade_fills_user_group 
  ON trade_fills(user_id, trade_group_id);
CREATE INDEX IF NOT EXISTS idx_trade_fills_group_date 
  ON trade_fills(trade_group_id, fill_date);

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user_date 
  ON reminders(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_user_completed 
  ON reminders(user_id, is_completed);

-- Deposits index
CREATE INDEX IF NOT EXISTS idx_deposits_user_id 
  ON deposits(user_id);

-- Weekly balances index
CREATE INDEX IF NOT EXISTS idx_weekly_balances_user_date 
  ON weekly_balances(user_id, week_end_date DESC);

-- Trade inbox index
CREATE INDEX IF NOT EXISTS idx_trade_inbox_user_status 
  ON trade_inbox(user_id, status);