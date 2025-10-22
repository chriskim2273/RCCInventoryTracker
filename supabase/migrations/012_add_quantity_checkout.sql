-- Add quantity_checked_out to checkout_logs
ALTER TABLE checkout_logs ADD COLUMN quantity_checked_out INTEGER NOT NULL DEFAULT 1;

-- Add quantity_checked_in to checkout_logs for partial check-ins
ALTER TABLE checkout_logs ADD COLUMN quantity_checked_in INTEGER;

-- Add comment to explain the fields
COMMENT ON COLUMN checkout_logs.quantity_checked_out IS 'Number of units checked out in this transaction';
COMMENT ON COLUMN checkout_logs.quantity_checked_in IS 'Number of units checked in. NULL means still checked out, can be less than quantity_checked_out for partial returns';

-- Set default values for existing checkout logs
UPDATE checkout_logs SET quantity_checked_out = 1 WHERE quantity_checked_out IS NULL;

-- For historical completed checkouts, set quantity_checked_in to match quantity_checked_out
UPDATE checkout_logs
SET quantity_checked_in = quantity_checked_out
WHERE checked_in_at IS NOT NULL AND quantity_checked_in IS NULL;
