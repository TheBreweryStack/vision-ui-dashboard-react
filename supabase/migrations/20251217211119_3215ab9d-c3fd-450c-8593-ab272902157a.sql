-- Add timezone column to account_settings table
ALTER TABLE public.account_settings 
ADD COLUMN timezone TEXT DEFAULT 'America/New_York';

-- Create index for faster lookups
CREATE INDEX idx_account_settings_timezone ON public.account_settings(timezone);