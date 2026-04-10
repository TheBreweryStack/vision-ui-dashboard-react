-- Create NKE trade_group (missing from trade_groups)
INSERT INTO trade_groups (
    id, user_id, ticker, trade_type, entry_date, exit_date, status,
    avg_entry_price, avg_exit_price, opened_qty, closed_qty, remaining_qty, realized_pnl, notes
) VALUES (
    gen_random_uuid(),
    '2b3c07d6-cf2e-480d-aead-4ad6467e2c8a',
    'NKE',
    'call',
    '2025-12-15',
    '2025-12-15',
    'closed',
    1.71,
    1.86,
    1,
    1,
    0,
    15.00,
    'Migrated from trades table'
);

-- Create Dec 15 GLD trade_group (the -$108 one)
INSERT INTO trade_groups (
    id, user_id, ticker, trade_type, entry_date, exit_date, status,
    avg_entry_price, avg_exit_price, opened_qty, closed_qty, remaining_qty, realized_pnl, notes
) VALUES (
    gen_random_uuid(),
    '2b3c07d6-cf2e-480d-aead-4ad6467e2c8a',
    'GLD',
    'call',
    '2025-12-15',
    '2025-12-15',
    'closed',
    1.37,
    1.01,
    3,
    3,
    0,
    -108.00,
    'Migrated from trades table'
);

-- Create Dec 15 MCD trade_group
INSERT INTO trade_groups (
    id, user_id, ticker, trade_type, entry_date, exit_date, status,
    avg_entry_price, avg_exit_price, opened_qty, closed_qty, remaining_qty, realized_pnl, notes
) VALUES (
    gen_random_uuid(),
    '2b3c07d6-cf2e-480d-aead-4ad6467e2c8a',
    'MCD',
    'call',
    '2025-12-15',
    '2025-12-15',
    'closed',
    1.32,
    1.50,
    1,
    1,
    0,
    18.00,
    'Migrated from trades table'
);