-- Add terms acceptance columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Timestamp when user accepted Terms of Service and Privacy Policy';
COMMENT ON COLUMN public.profiles.terms_version IS 'Version of terms the user accepted (e.g., v1)';