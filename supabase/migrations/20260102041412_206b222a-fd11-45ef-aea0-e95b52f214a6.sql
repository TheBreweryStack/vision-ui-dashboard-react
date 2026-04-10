-- Add new columns to profiles table for roles, plans, and comped access
-- NOTE: Roles stay in user_roles table for security, but we add role tracking to profiles
-- for easier querying and UI display

-- Add plan_status column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'free';

-- Add constraint for plan_status values
DO $$ BEGIN
  ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_plan_status_check 
  CHECK (plan_status IN ('trial', 'free', 'monthly', 'lifetime', 'expired'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add trial_ends_at column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone;

-- Add comped access columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS comped_access boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS comped_reason text;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS comped_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS comped_at timestamp with time zone;

-- Add future-proof columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS early_supporter boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS grandfathered boolean NOT NULL DEFAULT false;

-- Update user_roles enum to include owner and moderator if not already
-- First check if we need to add values
DO $$ 
BEGIN
  -- Try to add 'owner' if it doesn't exist
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  -- Try to add 'moderator' if it doesn't exist
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create index for plan queries
CREATE INDEX IF NOT EXISTS idx_profiles_plan_status ON public.profiles(plan_status);
CREATE INDEX IF NOT EXISTS idx_profiles_comped_access ON public.profiles(comped_access);