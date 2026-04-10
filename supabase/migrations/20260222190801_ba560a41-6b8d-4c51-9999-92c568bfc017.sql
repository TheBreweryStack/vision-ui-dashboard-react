ALTER TABLE account_settings 
ADD COLUMN initial_deposit numeric NOT NULL DEFAULT 0;

UPDATE account_settings 
SET initial_deposit = starting_balance;