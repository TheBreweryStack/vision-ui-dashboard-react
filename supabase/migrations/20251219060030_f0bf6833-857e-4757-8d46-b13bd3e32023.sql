-- Create email_ingest_addresses table for storing user's unique forwarding email addresses
CREATE TABLE public.email_ingest_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'sendgrid',
  token text NOT NULL UNIQUE,
  email_address text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create trade_inbox table for storing parsed trades before import
CREATE TABLE public.trade_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'wealthsimple_email',
  source_message_id text NULL,
  source_hash text NOT NULL UNIQUE,
  raw_payload jsonb NULL,
  raw_text text NULL,
  parsed_trade jsonb NULL,
  status text NOT NULL DEFAULT 'pending',
  confidence numeric NOT NULL DEFAULT 0.85,
  errors text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  imported_trade_id uuid NULL REFERENCES public.trades(id) ON DELETE SET NULL
);

-- Enable RLS on both tables
ALTER TABLE public.email_ingest_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_inbox ENABLE ROW LEVEL SECURITY;

-- Policies for email_ingest_addresses - users can only manage their own addresses
CREATE POLICY "Users can view their own email ingest addresses"
ON public.email_ingest_addresses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email ingest addresses"
ON public.email_ingest_addresses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email ingest addresses"
ON public.email_ingest_addresses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email ingest addresses"
ON public.email_ingest_addresses
FOR DELETE
USING (auth.uid() = user_id);

-- Policies for trade_inbox - users can view/update their own, insert done by service role
CREATE POLICY "Users can view their own trade inbox items"
ON public.trade_inbox
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade inbox items"
ON public.trade_inbox
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade inbox items"
ON public.trade_inbox
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_email_ingest_addresses_user_id ON public.email_ingest_addresses(user_id);
CREATE INDEX idx_email_ingest_addresses_token ON public.email_ingest_addresses(token);
CREATE INDEX idx_trade_inbox_user_id ON public.trade_inbox(user_id);
CREATE INDEX idx_trade_inbox_status ON public.trade_inbox(status);
CREATE INDEX idx_trade_inbox_source_hash ON public.trade_inbox(source_hash);