-- Add missing indexes for frequently queried tables
-- These cover watchlists, account_settings, push_subscriptions, portfolios, and notes

-- Watchlists: filtered by user_id, sorted by is_default + created_at
CREATE INDEX IF NOT EXISTS idx_watchlists_user_default
  ON watchlists (user_id, is_default DESC, created_at DESC);

-- Watchlist items: filtered by watchlist_id, sorted by added_at
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_added
  ON watchlist_items (watchlist_id, added_at DESC);

-- Account settings: filtered by user_id + portfolio_id (fetched on every page load)
CREATE INDEX IF NOT EXISTS idx_account_settings_user_portfolio
  ON account_settings (user_id, portfolio_id);

-- Push subscriptions: lookup by user + device, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_device
  ON push_subscriptions (user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_created
  ON push_subscriptions (user_id, created_at DESC);

-- Portfolios: filtered by is_archived, sorted by is_default + created_at
CREATE INDEX IF NOT EXISTS idx_portfolios_archived_default
  ON portfolios (is_archived, is_default DESC, created_at ASC);

-- Notes: filtered by user_id, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_notes_user_created
  ON notes (user_id, created_at DESC);
