-- Create optimized function to fetch journal data with fills in one query
CREATE OR REPLACE FUNCTION get_journal_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'groups', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'ticker', g.ticker,
            'trade_type', g.trade_type,
            'strike_price', g.strike_price,
            'expiration_date', g.expiration_date,
            'entry_date', g.entry_date,
            'exit_date', g.exit_date,
            'status', g.status,
            'opened_qty', g.opened_qty,
            'closed_qty', g.closed_qty,
            'remaining_qty', g.remaining_qty,
            'avg_entry_price', g.avg_entry_price,
            'avg_exit_price', g.avg_exit_price,
            'realized_pnl', g.realized_pnl,
            'strategy', g.strategy,
            'notes', g.notes,
            'images', g.images,
            'created_at', g.created_at,
            'updated_at', g.updated_at,
            'fills', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', f.id,
                    'trade_group_id', f.trade_group_id,
                    'side', f.side,
                    'effect', f.effect,
                    'qty', f.qty,
                    'price', f.price,
                    'fill_date', f.fill_date,
                    'fill_time', f.fill_time,
                    'notes', f.notes,
                    'source', f.source,
                    'created_at', f.created_at
                  )
                  ORDER BY f.fill_date DESC, f.created_at DESC
                )
                FROM trade_fills f
                WHERE f.trade_group_id = g.id
              ),
              '[]'::jsonb
            )
          )
          ORDER BY g.updated_at DESC
        )
        FROM trade_groups g
        WHERE g.user_id = uid
      ),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;