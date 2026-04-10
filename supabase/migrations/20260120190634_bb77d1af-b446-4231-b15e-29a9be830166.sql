-- Function to check if user has full access (admin/owner/paid/comped)
CREATE OR REPLACE FUNCTION public.user_has_full_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Check for admin/owner role
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id 
      AND role IN ('admin', 'owner')
    )
    OR
    -- Check for paid plan or comped access in profiles
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id
      AND (
        plan_status IN ('monthly', 'lifetime')
        OR comped_access = true
      )
    )
$$;

-- Function to count user's trade groups
CREATE OR REPLACE FUNCTION public.count_user_trade_groups(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.trade_groups WHERE user_id = _user_id
$$;

-- Function to count user's watchlists
CREATE OR REPLACE FUNCTION public.count_user_watchlists(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.watchlists WHERE user_id = _user_id
$$;

-- Drop existing INSERT policy on trade_groups if exists
DROP POLICY IF EXISTS "Users can insert their own trade groups" ON public.trade_groups;

-- Create new INSERT policy with 15 trade limit for free users
CREATE POLICY "Users can insert their own trade groups" 
ON public.trade_groups FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Full access users have no limit
    public.user_has_full_access(auth.uid())
    OR
    -- Free users limited to 15 trade groups
    public.count_user_trade_groups(auth.uid()) < 15
  )
);

-- Drop existing INSERT policy on watchlists if exists
DROP POLICY IF EXISTS "Users can insert their own watchlists" ON public.watchlists;

-- Create new INSERT policy with 1 watchlist limit for free users
CREATE POLICY "Users can insert their own watchlists" 
ON public.watchlists FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Full access users have no limit
    public.user_has_full_access(auth.uid())
    OR
    -- Free users limited to 1 watchlist
    public.count_user_watchlists(auth.uid()) < 1
  )
);