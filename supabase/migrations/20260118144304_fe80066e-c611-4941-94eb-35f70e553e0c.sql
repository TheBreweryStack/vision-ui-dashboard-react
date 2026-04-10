-- Add is_default column to watchlists
ALTER TABLE watchlists ADD COLUMN is_default boolean DEFAULT false;

-- Ensure only one default per user (partial unique index)
CREATE UNIQUE INDEX idx_watchlists_user_default 
ON watchlists (user_id) 
WHERE is_default = true;

-- Create function to set default watchlist (atomically unsets others)
CREATE OR REPLACE FUNCTION set_default_watchlist(p_watchlist_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Unset all other defaults for this user
  UPDATE watchlists SET is_default = false WHERE user_id = p_user_id AND is_default = true;
  -- Set the new default
  UPDATE watchlists SET is_default = true WHERE id = p_watchlist_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;