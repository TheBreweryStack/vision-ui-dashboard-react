-- Fix search_path for set_default_watchlist function
CREATE OR REPLACE FUNCTION public.set_default_watchlist(p_watchlist_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Unset all other defaults for this user
  UPDATE watchlists SET is_default = false WHERE user_id = p_user_id AND is_default = true;
  -- Set the new default
  UPDATE watchlists SET is_default = true WHERE id = p_watchlist_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;