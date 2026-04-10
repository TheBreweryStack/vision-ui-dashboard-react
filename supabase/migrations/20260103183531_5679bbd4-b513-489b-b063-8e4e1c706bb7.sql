-- Drop legacy unique indexes that include entry_date and block same-day round trips / merges
DROP INDEX IF EXISTS public.trade_groups_position_key;
DROP INDEX IF EXISTS public.trade_groups_position_unique_idx;
DROP INDEX IF EXISTS public.idx_trade_groups_position_key_options;
DROP INDEX IF EXISTS public.idx_trade_groups_position_key_stock;
DROP INDEX IF EXISTS public.idx_trade_groups_options_key;
DROP INDEX IF EXISTS public.idx_trade_groups_stocks_key;