-- Add EMA period columns to alerts table for EMA cross alerts
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS fast_period INTEGER,
ADD COLUMN IF NOT EXISTS slow_period INTEGER;