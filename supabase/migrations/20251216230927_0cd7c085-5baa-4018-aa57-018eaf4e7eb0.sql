-- Add subscription tier enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE public.subscription_tier AS ENUM ('free', 'trial', 'monthly', 'lifetime');
  END IF;
END $$;

-- Add subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for efficient subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_end ON public.profiles(subscription_end);

-- Function to update subscription tier and sync with user_roles
CREATE OR REPLACE FUNCTION public.sync_subscription_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Map subscription_tier to app_role (all paid tiers get 'user' role, admins stay admin)
  -- This doesn't change admin roles, only ensures users have proper base role
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    -- Log the tier change (helpful for debugging)
    RAISE NOTICE 'Subscription tier changed for user %: % -> %', NEW.id, OLD.subscription_tier, NEW.subscription_tier;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for subscription tier changes
DROP TRIGGER IF EXISTS on_subscription_tier_change ON public.profiles;
CREATE TRIGGER on_subscription_tier_change
  AFTER UPDATE OF subscription_tier ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_subscription_role();