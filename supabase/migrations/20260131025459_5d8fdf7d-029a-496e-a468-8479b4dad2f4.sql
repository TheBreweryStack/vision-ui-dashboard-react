-- Add 2FA enforcement setting to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS twofa_enforcement text DEFAULT 'optional' 
CHECK (twofa_enforcement IN ('disabled', 'optional', 'prompted', 'mandatory'));

-- Add comment for documentation
COMMENT ON COLUMN public.app_settings.twofa_enforcement IS 'Controls 2FA policy: disabled (hidden), optional (user choice), prompted (banner shown), mandatory (required to access app)';