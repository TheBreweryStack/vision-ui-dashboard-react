-- Add notification_prompt_shown to profiles for onboarding tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_prompt_shown BOOLEAN DEFAULT FALSE;

-- Add last_successful_push_at to push_subscriptions for health tracking
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS last_successful_push_at TIMESTAMPTZ;

-- Add device_label column to track device type (Safari, Chrome, etc.)
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS device_label TEXT;