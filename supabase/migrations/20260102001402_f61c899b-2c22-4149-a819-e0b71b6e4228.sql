-- 1) Add computed datetime columns to trades table
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS entry_datetime timestamptz,
ADD COLUMN IF NOT EXISTS exit_datetime timestamptz;

-- Backfill existing trades by combining date + time
UPDATE public.trades 
SET entry_datetime = (entry_date::date + COALESCE(entry_time, '09:30'::time))::timestamptz
WHERE entry_datetime IS NULL;

UPDATE public.trades 
SET exit_datetime = (exit_date::date + COALESCE(exit_time, '16:00'::time))::timestamptz
WHERE exit_datetime IS NULL AND exit_date IS NOT NULL;

-- 2) Create trade_enrichment table for MFE/MAE, SMA, trend data
CREATE TABLE IF NOT EXISTS public.trade_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  entry_datetime timestamptz NOT NULL,
  exit_datetime timestamptz,
  mfe numeric,
  mae numeric,
  mfe_pct numeric,
  mae_pct numeric,
  sma20_entry numeric,
  sma50_entry numeric,
  above_sma20_entry boolean,
  above_sma50_entry boolean,
  trend_regime_entry text, -- 'bull', 'bear', 'neutral'
  earnings_in_days integer,
  news jsonb, -- array of {headline, source, url, datetime}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trade_id)
);

-- Add indexes for trade_enrichment
CREATE INDEX IF NOT EXISTS idx_trade_enrichment_user_trade ON public.trade_enrichment(user_id, trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_enrichment_ticker_datetime ON public.trade_enrichment(ticker, entry_datetime);

-- Enable RLS on trade_enrichment
ALTER TABLE public.trade_enrichment ENABLE ROW LEVEL SECURITY;

-- RLS policies for trade_enrichment
CREATE POLICY "Users can view their own trade enrichment" ON public.trade_enrichment
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade enrichment" ON public.trade_enrichment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade enrichment" ON public.trade_enrichment
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade enrichment" ON public.trade_enrichment
  FOR DELETE USING (auth.uid() = user_id);

-- 3) Create ai_insights cache table
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL, -- 'weekly', 'monthly', 'last_60_trades'
  time_start timestamptz,
  time_end timestamptz,
  payload jsonb NOT NULL, -- structured insights for UI cards
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for ai_insights lookup
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_scope ON public.ai_insights(user_id, scope, created_at DESC);

-- Enable RLS on ai_insights
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_insights
CREATE POLICY "Users can view their own ai insights" ON public.ai_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai insights" ON public.ai_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai insights" ON public.ai_insights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai insights" ON public.ai_insights
  FOR DELETE USING (auth.uid() = user_id);

-- 4) Create trigger to auto-update updated_at on trade_enrichment
CREATE TRIGGER update_trade_enrichment_updated_at
  BEFORE UPDATE ON public.trade_enrichment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();