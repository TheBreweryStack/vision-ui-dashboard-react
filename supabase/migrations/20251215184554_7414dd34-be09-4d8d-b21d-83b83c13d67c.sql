-- Add position_id field to trades table for proper position grouping
ALTER TABLE public.trades 
ADD COLUMN position_id uuid DEFAULT gen_random_uuid();

-- Add strike_price and expiration_date fields for options tracking
ALTER TABLE public.trades 
ADD COLUMN strike_price numeric DEFAULT NULL,
ADD COLUMN expiration_date date DEFAULT NULL;

-- Create index for faster position lookups
CREATE INDEX idx_trades_position_id ON public.trades(position_id);
CREATE INDEX idx_trades_ticker_type ON public.trades(ticker, trade_type);

-- Add comment explaining the position_id usage
COMMENT ON COLUMN public.trades.position_id IS 'Groups related trades (entries, DCA, partial closes) into a single position';