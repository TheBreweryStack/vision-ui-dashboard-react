-- Create trade_groups table (one per position lifecycle)
CREATE TABLE public.trade_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  trade_type TEXT NOT NULL, -- 'call', 'put', 'stock'
  strike_price NUMERIC NULL, -- for options
  expiration_date DATE NULL, -- for options
  entry_date DATE NOT NULL, -- first entry date (part of grouping key)
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
  
  -- Quantity tracking
  opened_qty INTEGER NOT NULL DEFAULT 0,
  closed_qty INTEGER NOT NULL DEFAULT 0,
  remaining_qty INTEGER NOT NULL DEFAULT 0,
  
  -- Price/PnL tracking
  avg_entry_price NUMERIC NOT NULL DEFAULT 0,
  avg_exit_price NUMERIC NULL,
  realized_pnl NUMERIC NULL,
  
  -- Metadata
  strategy TEXT NULL,
  notes TEXT NULL,
  images TEXT[] DEFAULT '{}'::TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trade_fills table (each email or manual action)
CREATE TABLE public.trade_fills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_group_id UUID NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  side TEXT NOT NULL, -- 'buy', 'sell'
  effect TEXT NOT NULL, -- 'open', 'close'
  qty INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  
  fill_date DATE NOT NULL,
  fill_time TIME NULL,
  
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'email_import', 'voice', 'screenshot'
  source_inbox_id UUID NULL, -- reference to trade_inbox if from email
  
  notes TEXT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for grouping key (options)
CREATE UNIQUE INDEX idx_trade_groups_options_key ON public.trade_groups (
  user_id, ticker, trade_type, strike_price, expiration_date, entry_date
) WHERE trade_type IN ('call', 'put') AND status = 'open';

-- Create unique constraint for grouping key (stocks)
CREATE UNIQUE INDEX idx_trade_groups_stocks_key ON public.trade_groups (
  user_id, ticker, trade_type, entry_date
) WHERE trade_type = 'stock' AND status = 'open';

-- Enable RLS
ALTER TABLE public.trade_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_fills ENABLE ROW LEVEL SECURITY;

-- RLS policies for trade_groups
CREATE POLICY "Users can view their own trade groups"
  ON public.trade_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade groups"
  ON public.trade_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade groups"
  ON public.trade_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade groups"
  ON public.trade_groups FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for trade_fills
CREATE POLICY "Users can view their own trade fills"
  ON public.trade_fills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade fills"
  ON public.trade_fills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade fills"
  ON public.trade_fills FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade fills"
  ON public.trade_fills FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger for trade_groups
CREATE TRIGGER update_trade_groups_updated_at
  BEFORE UPDATE ON public.trade_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_trade_groups_user_status ON public.trade_groups(user_id, status);
CREATE INDEX idx_trade_groups_entry_date ON public.trade_groups(entry_date);
CREATE INDEX idx_trade_fills_group_id ON public.trade_fills(trade_group_id);
CREATE INDEX idx_trade_fills_date ON public.trade_fills(fill_date);