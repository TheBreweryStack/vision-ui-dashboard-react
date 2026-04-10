-- Add missing Stripe sync columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_price_id text,
ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamp with time zone,
ADD COLUMN IF NOT EXISTS stripe_status text,
ADD COLUMN IF NOT EXISTS last_stripe_event_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS has_used_trial boolean DEFAULT false;

-- Create index on stripe fields for webhook lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON public.profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_status ON public.profiles(plan_status);

-- Create billing_events table for webhook audit logging
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  payload jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on billing_events
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view billing events (for debugging)
CREATE POLICY "Admins can view billing events" ON public.billing_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));