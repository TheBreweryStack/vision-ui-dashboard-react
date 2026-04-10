-- Create totp_secrets table for storing encrypted TOTP secrets
CREATE TABLE public.totp_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    encrypted_secret TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ
);

-- Enable RLS on totp_secrets
ALTER TABLE public.totp_secrets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own TOTP secret
CREATE POLICY "Users can view their own TOTP secret"
    ON public.totp_secrets FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Users can insert their own TOTP secret
CREATE POLICY "Users can insert their own TOTP secret"
    ON public.totp_secrets FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own TOTP secret
CREATE POLICY "Users can update their own TOTP secret"
    ON public.totp_secrets FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own TOTP secret
CREATE POLICY "Users can delete their own TOTP secret"
    ON public.totp_secrets FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Create trusted_devices table for 30-day device trust tokens
CREATE TABLE public.trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_token TEXT NOT NULL UNIQUE,
    device_name TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on trusted_devices
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own trusted devices
CREATE POLICY "Users can view their own trusted devices"
    ON public.trusted_devices FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Users can delete their own trusted devices
CREATE POLICY "Users can delete their own trusted devices"
    ON public.trusted_devices FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Create index on backup_codes for faster lookups
CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON public.backup_codes(user_id);

-- Create index on trusted_devices for faster token lookups
CREATE INDEX idx_trusted_devices_token ON public.trusted_devices(device_token);

-- Create index on trusted_devices for user lookups
CREATE INDEX idx_trusted_devices_user_id ON public.trusted_devices(user_id);