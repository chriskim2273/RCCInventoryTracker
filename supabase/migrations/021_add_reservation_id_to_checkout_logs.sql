-- Add reservation_id column to checkout_logs table
ALTER TABLE checkout_logs ADD COLUMN IF NOT EXISTS reservation_id text;

-- Add comment to explain the column
COMMENT ON COLUMN checkout_logs.reservation_id IS 'Optional reservation ID for the checkout. Can be used as an alternative identifier if checked_out_to is not provided.';
